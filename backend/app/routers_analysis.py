import asyncio
import json
import time
import threading
from enum import Enum
from typing import Dict, List, Tuple, Optional, Any
from uuid import UUID, uuid4

import cv2  # type: ignore[import-not-found]
import numpy as np
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from PIL import Image as PILImage
from sqlmodel import select

from .db import get_session
from .models import AnalysisResult, AnalysisResultRead, Image
from .feature_cache import feature_cache


class AnalysisMode(str, Enum):
    """用户可选的分析模式。

    - fast: 只用轻量特征（平均颜色 + 感知哈希），速度快；
    - accurate: 只用 ORB 局部特征，比裁剪/旋转更鲁棒，较慢；
    - hybrid: 综合 fast 和 accurate 的相似度，作为最终矩阵。
    """

    fast = "fast"
    accurate = "accurate"
    hybrid = "hybrid"


router = APIRouter(prefix="/analysis", tags=["analysis"])


def _compute_average_color(image_path: str) -> List[float]:
    """基础特征 1：平均 RGB 颜色，归一化到 [0, 1]。"""
    with PILImage.open(image_path) as img:
        img = img.convert("RGB")
        arr = np.array(img, dtype=np.float32) / 255.0
        mean_rgb = arr.reshape(-1, 3).mean(axis=0)
        return mean_rgb.tolist()


def _compute_ahash(image_path: str, size: int = 8) -> List[int]:
    """基础特征 2：简单平均哈希 (aHash)，返回 0/1 向量。"""
    with PILImage.open(image_path) as img:
        img = img.convert("L").resize((size, size), PILImage.Resampling.LANCZOS)
        arr = np.array(img, dtype=np.float32)
        mean = arr.mean()
        bits = (arr > mean).astype(np.uint8).flatten()
        return bits.tolist()


async def _compute_fast_features_cached(image_id: str, image_path: str) -> Tuple[List[float], List[int]]:
    """
    计算快速特征（平均颜色 + aHash），优先从缓存获取
    """
    # 尝试从缓存获取fast特征
    cached_fast = await feature_cache.get_image_features(image_id, "fast")
    if cached_fast:
        print(f"Fast features loaded from cache for image {image_id}")
        avg_color = cached_fast.get("avg_color_features", [])
        ahash = cached_fast.get("ahash_features", [])
        return avg_color, ahash

    # 缓存未命中，计算特征
    print(f"Computing fast features for image {image_id}")
    avg_color = _compute_average_color(image_path)
    ahash = _compute_ahash(image_path)

    # 缓存计算结果
    fast_data = {
        "avg_color_features": avg_color,
        "ahash_features": ahash,
        "computed_at": time.time()
    }

    await feature_cache.cache_image_features(image_id, {"fast": fast_data})

    return avg_color, ahash


async def _batch_compute_fast_features(image_ids: List[str], image_paths: List[str]) -> Tuple[List[List[float]], List[List[int]]]:
    """
    批量计算快速特征，利用缓存优化性能
    """
    # 批量尝试从缓存获取特征
    cached_features = await feature_cache.batch_get_features(image_ids)

    avg_colors = []
    ahashes = []
    compute_tasks = []
    compute_indices = []

    # 处理已缓存的特征
    for i, image_id in enumerate(image_ids):
        if image_id in cached_features and "fast" in cached_features[image_id].get("features", {}):
            fast_features = cached_features[image_id]["features"]["fast"]
            avg_colors.append(fast_features.get("avg_color_features", []))
            ahashes.append(fast_features.get("ahash_features", []))
        else:
            # 需要计算的特征
            compute_indices.append(i)
            compute_tasks.append(_compute_fast_features_cached(image_id, image_paths[i]))

    # 批量计算缺失的特征
    if compute_tasks:
        computed_results = await asyncio.gather(*compute_tasks)

        # 将计算结果插入到正确位置
        for idx, (avg_color, ahash) in zip(compute_indices, computed_results):
            # 扩展列表以容纳新结果
            while len(avg_colors) <= idx:
                avg_colors.append([])
                ahashes.append([])

            avg_colors[idx] = avg_color
            ahashes[idx] = ahash

    # 确保列表长度正确
    while len(avg_colors) < len(image_ids):
        avg_colors.append([])
        ahashes.append([])

    return avg_colors, ahashes


def _cosine_similarity_matrix(vectors: List[List[float]]) -> List[List[float]]:
    if not vectors:
        return []
    X = np.array(vectors, dtype=np.float32)
    norms = np.linalg.norm(X, axis=1, keepdims=True) + 1e-8
    X_norm = X / norms
    sim = X_norm @ X_norm.T
    return sim.astype(float).tolist()


def _ahash_similarity_matrix(hashes: List[List[int]]) -> List[List[float]]:
    if not hashes:
        return []
    H = np.array(hashes, dtype=np.uint8)
    n = H.shape[0]
    sim = np.zeros((n, n), dtype=np.float32)
    bit_len = H.shape[1]
    for i in range(n):
        sim[i, i] = 1.0
        for j in range(i + 1, n):
            dist = np.count_nonzero(H[i] ^ H[j])
            score = 1.0 - dist / float(bit_len)
            sim[i, j] = sim[j, i] = score
    return sim.astype(float).tolist()


def _orb_pairwise_analysis(
    image_paths: List[str],
) -> Tuple[List[List[float]], List[List[int]], List[Dict[str, object]]]:
    """使用 ORB 局部特征做两两匹配，并估计局部区域位置。

    返回：
    - sim: ORB 相似度矩阵
    - match_counts: 匹配数量矩阵
    - pairwise_regions: 列表，每项描述 source_index 在 target_index 中的一个候选区域
        现在包含特征点连线可视化数据
    """
    if not image_paths:
        return [], [], []

    orb = cv2.ORB_create(nfeatures=800)
    images: List[np.ndarray | None] = []
    keypoints_list: List[list] = []
    descriptors: List[np.ndarray | None] = []

    for path in image_paths:
        img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            images.append(None)
            keypoints_list.append([])
            descriptors.append(None)
            continue
        keypoints, des = orb.detectAndCompute(img, None)
        images.append(img)
        keypoints_list.append(keypoints)
        descriptors.append(des)

    n = len(image_paths)
    sim = [[0.0 for _ in range(n)] for _ in range(n)]
    match_counts = [[0 for _ in range(n)] for _ in range(n)]
    pairwise_regions: List[Dict[str, object]] = []

    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)

    for i in range(n):
        sim[i][i] = 1.0
        for j in range(i + 1, n):
            des1, des2 = descriptors[i], descriptors[j]
            if des1 is None or des2 is None:
                score = 0.0
                count = 0
                sim[i][j] = sim[j][i] = float(score)
                match_counts[i][j] = match_counts[j][i] = int(count)
                continue

            matches = bf.match(des1, des2)
            # 距离越小越好，过滤一部分差匹配
            matches = sorted(matches, key=lambda m: m.distance)[:200]
            # 放宽匹配阈值，允许更多匹配点
            good = [m for m in matches if m.distance < 100]  # 从60增加到100
            count = len(good)

            denom = float(min(len(des1), len(des2))) or 1.0
            score = min(1.0, count / denom)
            sim[i][j] = sim[j][i] = float(score)
            match_counts[i][j] = match_counts[j][i] = int(count)

            # 只要至少有3个匹配点就生成可视化数据
            if count >= 3 and images[i] is not None and images[j] is not None:
                # 生成特征点连线数据用于可视化（无论单应矩阵是否成功）
                good_matches = good
                src_keypoints = []
                dst_keypoints = []

                for match in good_matches:
                    # 获取匹配点在源图像和目标图像中的坐标
                    src_kp = keypoints_list[i][match.queryIdx]
                    dst_kp = keypoints_list[j][match.trainIdx]

                    src_keypoints.append({
                        "x": float(src_kp.pt[0]),
                        "y": float(src_kp.pt[1]),
                        "size": float(src_kp.size),
                        "angle": float(src_kp.angle)
                    })

                    dst_keypoints.append({
                        "x": float(dst_kp.pt[0]),
                        "y": float(dst_kp.pt[1]),
                        "size": float(dst_kp.size),
                        "angle": float(dst_kp.angle)
                    })

                # 初始化区域数据
                region = {
                    "source_index": i,
                    "target_index": j,
                    "score": float(score),
                    "match_count": int(count),
                    "inlier_count": 0,  # 默认值，如果单应矩阵成功会更新
                    "quad_in_target": None,
                    "bbox_in_target": None,
                    # 特征点匹配可视化数据
                    "feature_matches": {
                        "source_keypoints": src_keypoints,
                        "target_keypoints": dst_keypoints,
                        "source_image_size": [images[i].shape[1], images[i].shape[0]],  # [width, height]
                        "target_image_size": [images[j].shape[1], images[j].shape[0]],  # [width, height]
                        "match_distances": [float(m.distance) for m in good_matches]
                    }
                }

                # 尝试计算单应矩阵（可选，失败也不影响可视化）
                try:
                    src_pts = np.float32(
                        [keypoints_list[i][m.queryIdx].pt for m in good]
                    ).reshape(-1, 1, 2)
                    dst_pts = np.float32(
                        [keypoints_list[j][m.trainIdx].pt for m in good]
                    ).reshape(-1, 1, 2)

                    H, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 8.0)
                    if H is not None and mask is not None:
                        inliers = int(mask.ravel().sum())
                        if inliers >= 3:
                            # 更新内点数量
                            region["inlier_count"] = inliers

                            # 计算变换区域
                            h1, w1 = images[i].shape[:2]
                            h2, w2 = images[j].shape[:2]

                            src_corners = np.float32(
                                [[0, 0], [w1, 0], [w1, h1], [0, h1]]
                            ).reshape(-1, 1, 2)
                            dst_corners = cv2.perspectiveTransform(src_corners, H).reshape(-1, 2)

                            xs = dst_corners[:, 0]
                            ys = dst_corners[:, 1]

                            x_min = float(xs.min())
                            y_min = float(ys.min())
                            x_max = float(xs.max())
                            y_max = float(ys.max())

                            # 简单裁剪到目标图像边界
                            x_min_clamped = max(0.0, min(x_min, float(w2)))
                            y_min_clamped = max(0.0, min(y_min, float(h2)))
                            x_max_clamped = max(0.0, min(x_max, float(w2)))
                            y_max_clamped = max(0.0, min(y_max, float(h2)))

                            region["quad_in_target"] = dst_corners.tolist()
                            region["bbox_in_target"] = [
                                x_min_clamped,
                                y_min_clamped,
                                x_max_clamped,
                                y_max_clamped,
                            ]
                except Exception as e:
                    # 单应矩阵计算失败，但不影响特征点可视化
                    print(f"Warning: Homography calculation failed for images {i}-{j}: {e}")

                pairwise_regions.append(region)

    return sim, match_counts, pairwise_regions


def _run_analysis_task_wrapper(
    analysis_id: UUID,
    project_id: UUID,
    mode: AnalysisMode
):
    """包装函数，用于在后台任务中运行异步分析任务"""
    asyncio.run(_run_analysis_task(analysis_id, project_id, mode))


async def _run_analysis_task(
    analysis_id: UUID,
    project_id: UUID,
    mode: AnalysisMode
):
    """后台任务：执行实际的分析工作"""
    start_time = time.time()

    try:
        with get_session() as session:
            # 更新状态为处理中
            analysis = session.get(AnalysisResult, analysis_id)
            if not analysis:
                return

            analysis.status = "processing"
            analysis.progress = 0.1  # 开始处理
            session.commit()

            # 获取图片
            images = session.exec(select(Image).where(Image.project_id == project_id)).all()

            # 过滤出真正的图片文件
            actual_images = [img for img in images if img.mime_type and img.mime_type.startswith('image/')]
            if not actual_images:
                analysis.status = "failed"
                analysis.error_message = "No actual image files found for project"
                analysis.progress = 1.0
                session.commit()
                return

            image_ids: List[str] = [str(img.id) for img in actual_images]
            filenames: List[str] = [img.filename for img in actual_images]

            # 更新进度：下载图片
            analysis.progress = 0.3
            session.commit()

            # 从MinIO下载图片文件到临时位置
            import tempfile
            import os
            from .minio_client import storage_service

            temp_dir = tempfile.mkdtemp()
            paths: List[str] = []
            try:
                for i, img in enumerate(actual_images):
                    # 确定图片来源和存储桶
                    bucket = "image-trace-uploads"  # 默认存储桶

                    # 检查图片元数据确定是否为文档提取图片
                    if img.image_metadata:
                        try:
                            metadata = json.loads(img.image_metadata)
                            if metadata.get("source") == "document_extraction":
                                bucket = "image-trace-extracted"
                        except:
                            pass

                    # 从MinIO下载文件
                    file_data = storage_service.download_file(
                        object_name=img.file_path,
                        bucket=bucket
                    )

                    # 保存到临时文件
                    temp_path = os.path.join(temp_dir, img.filename)
                    with open(temp_path, 'wb') as f:
                        f.write(file_data)
                    paths.append(temp_path)

                    # 更新进度
                    progress = 0.3 + (0.2 * (i + 1) / len(actual_images))
                    analysis.progress = min(progress, 0.5)
                    session.commit()

            except Exception as e:
                analysis.status = "failed"
                analysis.error_message = f"Failed to download images from storage: {str(e)}"
                analysis.progress = 1.0
                session.commit()
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
                return

            # 执行分析
            try:
                analysis.progress = 0.6  # 开始分析
                session.commit()

                # fast 特征：平均颜色 + 感知哈希（使用缓存优化）
                avg_colors: List[List[float]] = []
                ahashes: List[List[int]] = []
                if mode in (AnalysisMode.fast, AnalysisMode.hybrid):
                    # 使用批量缓存计算
                    print("Starting batch feature computation with cache optimization...")
                    avg_colors, ahashes = await _batch_compute_fast_features(image_ids, paths)
                    print(f"Completed batch feature computation for {len(paths)} images")

                    # 更新进度
                    analysis.progress = 0.8
                    session.commit()

                    sim_color = _cosine_similarity_matrix(avg_colors)
                    sim_hash = _ahash_similarity_matrix(ahashes)
                    sim_fast = (
                        (np.array(sim_color, dtype=np.float32) + np.array(sim_hash, dtype=np.float32)) / 2.0
                    ).astype(float).tolist()
                else:
                    sim_fast = []

                # accurate 特征：ORB 局部特征 + RANSAC 局部区域
                if mode in (AnalysisMode.accurate, AnalysisMode.hybrid):
                    sim_orb, orb_match_counts, orb_regions = _orb_pairwise_analysis(paths)
                else:
                    sim_orb, orb_match_counts, orb_regions = [], [], []

                # 最终主相似度矩阵：
                if mode == AnalysisMode.fast:
                    main_sim = sim_fast
                    algorithm_type = "fast_multi_feature"
                elif mode == AnalysisMode.accurate:
                    main_sim = sim_orb
                    algorithm_type = "orb_local_feature"
                else:  # hybrid
                    if sim_fast and sim_orb:
                        main_sim = (
                            (np.array(sim_fast, dtype=np.float32) + np.array(sim_orb, dtype=np.float32)) / 2.0
                        ).astype(float).tolist()
                    else:
                        main_sim = sim_fast or sim_orb
                    algorithm_type = "hybrid_fast_orb"

                elapsed = time.time() - start_time

                # 保存结果
                analysis.results = json.dumps({
                    "image_ids": image_ids,
                    "filenames": filenames,
                    "mode": mode.value,
                    "similarity_matrix": main_sim,
                    "fast": {
                        "avg_color_features": avg_colors if avg_colors else None,
                        "ahash_features": ahashes if ahashes else None,
                        "similarity_matrix": sim_fast if sim_fast else None,
                    },
                    "orb": {
                        "similarity_matrix": sim_orb if sim_orb else None,
                        "match_counts": orb_match_counts if orb_match_counts else None,
                        "pairwise_regions": orb_regions if orb_regions else None,
                    },
                })
                analysis.algorithm_type = algorithm_type
                analysis.confidence_score = 1.0
                analysis.processing_time_seconds = elapsed
                analysis.status = "completed"
                analysis.progress = 1.0
                session.commit()

            except Exception as e:
                analysis.status = "failed"
                analysis.error_message = f"Analysis failed: {str(e)}"
                analysis.progress = 1.0
                session.commit()
            finally:
                # 清理临时目录
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)

    except Exception as e:
        # 顶级错误处理
        with get_session() as session:
            analysis = session.get(AnalysisResult, analysis_id)
            if analysis:
                analysis.status = "failed"
                analysis.error_message = f"Task failed: {str(e)}"
                analysis.progress = 1.0
                session.commit()


@router.post("/start")
def start_analysis(
    background_tasks: BackgroundTasks,
    project_id: UUID,
    mode: AnalysisMode = Query(AnalysisMode.fast, description="fast / accurate / hybrid"),
) -> Dict[str, str]:
    """多特征图像相似度分析入口（异步）。

    - fast: 平均颜色 + aHash，适合快速粗筛；
    - accurate: ORB 局部特征相似度，对裁剪/旋转更鲁棒；
    - hybrid: 综合 fast 与 ORB 两种结果。

    返回task_id，可通过轮询获取分析进度和结果。
    """
    task_id = f"task-{uuid4()}"

    with get_session() as session:
        images = session.exec(select(Image).where(Image.project_id == project_id)).all()
        actual_images = [img for img in images if img.mime_type and img.mime_type.startswith('image/')]
        if not actual_images:
            raise HTTPException(status_code=400, detail="No actual image files found for project")

        # 创建分析记录
        analysis = AnalysisResult(
            project_id=project_id,
            task_id=task_id,
            algorithm_type="pending",
            parameters=json.dumps({"mode": mode.value}),
            status="pending",
            progress=0.0
        )
        session.add(analysis)
        session.commit()
        session.refresh(analysis)

        # 启动后台任务
        background_tasks.add_task(_run_analysis_task_wrapper, analysis.id, project_id, mode)

        return {"task_id": task_id, "analysis_id": str(analysis.id)}


@router.get("/results/{analysis_id}")
def get_results(analysis_id: UUID) -> dict:
    with get_session() as session:
        analysis = session.get(AnalysisResult, analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis result not found")

        # 解析JSON字符串为字典
        result_dict = {
            "analysis_id": str(analysis.id),
            "project_id": str(analysis.project_id),
            "task_id": analysis.task_id,
            "algorithm_type": analysis.algorithm_type,
            "parameters": json.loads(analysis.parameters) if analysis.parameters else None,
            "results": json.loads(analysis.results) if analysis.results else None,
            "confidence_score": analysis.confidence_score,
            "processing_time_seconds": analysis.processing_time_seconds,
            "status": analysis.status,
            "progress": analysis.progress,
            "error_message": analysis.error_message,
            "created_at": analysis.created_at.isoformat(),
        }
        return result_dict


@router.get("/status/{analysis_id}")
def get_status(analysis_id: UUID):
    with get_session() as session:
        analysis = session.get(AnalysisResult, analysis_id)
        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis result not found")

        return {
            "analysis_id": str(analysis.id),
            "task_id": analysis.task_id,
            "status": analysis.status,
            "progress": analysis.progress,
            "error_message": analysis.error_message
        }


@router.get("/cache/stats")
async def get_cache_stats():
    """获取特征缓存统计信息"""
    try:
        stats = await feature_cache.get_cache_stats()
        return {
            "success": True,
            "stats": stats
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get cache stats: {str(e)}")


@router.delete("/cache/image/{image_id}")
async def invalidate_image_cache(image_id: UUID):
    """使指定图像的特征缓存失效"""
    try:
        success = await feature_cache.invalidate_image_cache(str(image_id))
        return {
            "success": success,
            "message": f"Cache for image {image_id} {'invalidated' if success else 'failed to invalidate'}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to invalidate cache: {str(e)}")


@router.post("/cache/cleanup")
async def cleanup_expired_cache():
    """清理过期的特征缓存"""
    try:
        cleaned_count = await feature_cache.cleanup_expired_features()
        return {
            "success": True,
            "cleaned_keys": cleaned_count,
            "message": f"Cleaned up {cleaned_count} expired cache keys"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cleanup cache: {str(e)}")


@router.get("/cache/health")
async def cache_health_check():
    """Redis缓存健康检查"""
    try:
        # 测试Redis连接
        client = await feature_cache.async_redis_client
        await client.ping()

        # 获取基本统计
        info = await client.info()

        return {
            "status": "healthy",
            "redis_connected": True,
            "used_memory": info.get("used_memory_human", "N/A"),
            "connected_clients": info.get("connected_clients", "N/A"),
            "uptime_seconds": info.get("uptime_in_seconds", "N/A")
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "redis_connected": False,
            "error": str(e)
        }