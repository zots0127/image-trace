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


def _get_optimal_feature_count(image_path: str) -> int:
    """
    根据图像尺寸自动调整ORB特征点数量
    """
    try:
        with PILImage.open(image_path) as img:
            width, height = img.size
            # 基于图像面积计算特征点数量，更合理的分布
            area = width * height
            # 基准：每1000像素约1个特征点
            base_features = area // 1000

            # 根据图像比例调整，正方形图像特征点更密集
            aspect_ratio = max(width, height) / min(width, height)
            ratio_factor = 1.0 / (1.0 + (aspect_ratio - 1.0) * 0.2)  # 长宽比越大，特征点越稀疏

            adjusted_features = int(base_features * ratio_factor)

            # 限制在合理范围内，提高下限以获得更好的匹配效果
            optimal_features = min(2000, max(600, adjusted_features))
            return optimal_features
    except Exception as e:
        print(f"Error calculating optimal feature count for {image_path}: {e}")
        return 800  # 回退到默认值


def _get_dynamic_distance_threshold(matches: List, percentile: float = 75) -> float:
    """
    基于匹配距离分布计算动态阈值
    """
    if not matches:
        return 100  # 默认阈值

    distances = [m.distance for m in matches]
    # 使用百分位数作为阈值，更具自适应性
    threshold = float(np.percentile(distances, percentile))
    # 限制在合理范围内
    return max(50, min(200, threshold))


def _filter_high_quality_matches(
    matches: List,
    image_size_factor: float = 1.0,
    min_matches: int = 10
) -> List:
    """
    多层高质量匹配点筛选
    """
    if len(matches) < min_matches:
        return matches  # 匹配点太少，返回全部

    # 第一层：基于距离分布的动态筛选
    threshold = _get_dynamic_distance_threshold(matches, percentile=70)
    good_matches = [m for m in matches if m.distance <= threshold]

    # 第二层：保留最佳匹配（基于图像大小调整比例）
    good_matches.sort(key=lambda m: m.distance)
    keep_ratio = max(0.2, min(0.5, 0.3 * image_size_factor))  # 20%-50%
    max_keep = max(min_matches, int(len(good_matches) * keep_ratio))
    good_matches = good_matches[:max_keep]

    # 第三层：统计筛选，剔除异常值
    if len(good_matches) >= 4:
        distances = [m.distance for m in good_matches]
        mean_dist = np.mean(distances)
        std_dist = np.std(distances)

        filtered_matches = []
        for m in good_matches:
            z_score = (m.distance - mean_dist) / std_dist if std_dist > 0 else 0
            if abs(z_score) < 2.0:  # 保留2个标准差内的匹配
                filtered_matches.append(m)

        # 确保不会过度筛选
        if len(filtered_matches) >= min_matches:
            good_matches = filtered_matches

    return good_matches


def _compute_enhanced_similarity(
    matches: List,
    des1_count: int,
    des2_count: int,
    inlier_count: int = 0,
    image_size_factor: float = 1.0
) -> float:
    """
    增强的相似度计算，考虑多维度质量指标
    """
    if not matches:
        return 0.0

    # 基础匹配比例（对描述子数量进行上限裁剪，避免多尺度导致比例过低）
    min_descriptors = min(des1_count, des2_count)
    effective_descriptors = max(1, min(min_descriptors, 2000))
    match_ratio = len(matches) / float(effective_descriptors)

    # 内点质量权重（如果有RANSAC结果）
    inlier_ratio = 0.0
    if inlier_count > 0 and len(matches) > 0:
        inlier_ratio = inlier_count / len(matches)

    # 平均距离质量（距离越小相似度越高）
    distances = [m.distance for m in matches]
    avg_distance = np.mean(distances)
    distance_score = 1.0 / (1.0 + avg_distance / 50.0)  # 归一化到[0,1]

    # 距离一致性（标准差越小越好）
    distance_consistency = 1.0 / (1.0 + np.std(distances) / 20.0)

    # 综合评分权重（提高几何一致性权重）
    base_weights = {
        'match_ratio': 0.25,
        'inlier_ratio': 0.55 if inlier_count > 0 else 0.0,
        'distance_score': 0.15,
        'consistency': 0.05
    }

    # 动态调整权重
    total_weight = sum(base_weights.values())
    weights = {k: v/total_weight for k, v in base_weights.items()}

    # 计算最终分数
    final_score = (
        weights['match_ratio'] * match_ratio +
        weights['inlier_ratio'] * inlier_ratio +
        weights['distance_score'] * distance_score +
        weights['consistency'] * distance_consistency
    )

    return min(1.0, final_score)


def _detect_screenshot_mode(image_path: str) -> bool:
    """
    检测图像是否为截图
    """
    try:
        with PILImage.open(image_path) as img:
            width, height = img.size

            # 1. 检查尺寸是否为常见屏幕分辨率
            common_screens = [
                (1920, 1080), (1366, 768), (1536, 864), (1440, 900),
                (1280, 720), (1600, 900), (2560, 1440), (3840, 2160),
                (1080, 1920), (750, 1334), (1242, 2208), (1125, 2436)
            ]

            # 检查是否接近常见屏幕分辨率（允许10%误差）
            for screen_w, screen_h in common_screens:
                if (abs(width - screen_w) / screen_w < 0.1 and
                    abs(height - screen_h) / screen_h < 0.1):
                    return True

            # 2. 检查宽高比是否为常见屏幕比例
            aspect_ratio = width / height
            common_ratios = [16/9, 16/10, 4/3, 3/2, 21/9, 9/16]
            for ratio in common_ratios:
                if abs(aspect_ratio - ratio) < 0.1:
                    return True

            # 3. 检查文件大小与像素比例（截图通常压缩率高）
            import os
            file_size = os.path.getsize(image_path)
            pixel_count = width * height
            bytes_per_pixel = file_size / pixel_count

            # 如果每像素字节数很低（<0.5），可能是压缩过的截图
            if bytes_per_pixel < 0.5:
                return True

            return False
    except Exception as e:
        print(f"Error detecting screenshot mode for {image_path}: {e}")
        return False


def _extract_enhanced_features(image_path: str, screenshot_mode: bool = False) -> Tuple[List, List]:
    """
    增强的特征提取，支持多尺度和截图优化
    扩展尺度范围以支持大比例缩放的图像匹配
    """
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        return [], None

    h, w = img.shape

    # 对于非常小的图像，跳过多尺度处理
    min_size_for_multiscale = 100
    if h < min_size_for_multiscale or w < min_size_for_multiscale:
        print(f"Small image detected ({w}x{h}), using single-scale processing")
        scales = [1.0]  # 只使用原始尺度
        features_per_scale = 2000  # 增加特征点数量以补偿
    elif screenshot_mode:
        # 截图模式：使用极广范围的尺度以处理10倍甚至更大的缩放比例
        # 支持0.1x（10倍缩小）到10x（10倍放大）的缩放范围
        # 使用对数分布的采样点以高效覆盖大范围
        scales = [
            0.1,   # 10倍缩小
            0.2,   # 5倍缩小
            0.35,  # 约3倍缩小
            0.5,   # 2倍缩小
            0.7,   # 约1.4倍缩小
            1.0,   # 原始尺度
            1.4,   # 约1.4倍放大
            2.0,   # 2倍放大
            3.0,   # 3倍放大
            5.0,   # 5倍放大
            10.0   # 10倍放大
        ]
        features_per_scale = 1500  # 增加特征点以提高匹配成功率
        print(f"🔍 Screenshot mode: using extreme wide-scale range (0.1x - 10x) with {len(scales)} scales")
    else:
        # 常规模式：适度扩展标准多尺度范围
        scales = [0.4, 0.6, 0.8, 1.0, 1.25, 1.6, 2.5]
        features_per_scale = 1000

    all_keypoints = []
    all_descriptors = []

    for scale in scales:
        # 缩放图像（确保最小尺寸）
        if scale != 1.0:
            h, w = img.shape
            new_h, new_w = int(h * scale), int(w * scale)

            # 确保缩放后的图像尺寸有效（最小32x32）
            new_h = max(32, new_h)
            new_w = max(32, new_w)

            # 计算实际使用的缩放因子
            actual_scale_h = new_h / h
            actual_scale_w = new_w / w
            actual_scale = min(actual_scale_h, actual_scale_w)

            try:
                scaled_img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
            except cv2.error as e:
                print(f"Warning: Failed to resize image with scale {scale}: {e}")
                # 如果缩放失败，跳过这个尺度
                continue
        else:
            scaled_img = img
            actual_scale = 1.0

        # 提取ORB特征
        orb = cv2.ORB_create(nfeatures=features_per_scale)
        keypoints, descriptors = orb.detectAndCompute(scaled_img, None)

        if descriptors is not None:
            # 将关键点坐标转换回原始图像尺度
            scaled_keypoints = []
            for kp in keypoints:
                # 确保不会除零
                if actual_scale > 0:
                    original_x = kp.pt[0] / actual_scale
                    original_y = kp.pt[1] / actual_scale
                    original_size = kp.size / actual_scale
                else:
                    # 如果缩放因子异常，使用原始坐标
                    original_x = kp.pt[0]
                    original_y = kp.pt[1]
                    original_size = kp.size

                scaled_keypoints.append(cv2.KeyPoint(
                    x=original_x, y=original_y,
                    size=original_size,
                    angle=kp.angle,
                    response=kp.response,
                    octave=kp.octave,
                    class_id=kp.class_id
                ))

            all_keypoints.extend(scaled_keypoints)
            all_descriptors.extend(descriptors)

    # 合并所有描述子
    if all_descriptors:
        combined_descriptors = np.vstack(all_descriptors)
    else:
        combined_descriptors = None

    return all_keypoints, combined_descriptors


def _adaptive_screenshot_match_filter(matches: List, screenshot_mode: bool = False) -> List:
    """
    针对截图的自适应匹配过滤
    支持极大比例变化（10倍或更大）
    """
    if not matches:
        return []

    if screenshot_mode:
        # 截图模式：非常宽松的匹配条件以处理极大尺度变化
        # 使用非常宽松的百分位数阈值（90%）
        threshold = _get_dynamic_distance_threshold(matches, percentile=90)

        # 进一步降低最小匹配要求
        min_matches = 3

        # 保留更多匹配点
        good_matches = [m for m in matches if m.distance <= threshold]
        good_matches.sort(key=lambda m: m.distance)

        # 对于极大比例的截图，保留更高比例的匹配点（70%）
        keep_count = max(min_matches, int(len(good_matches) * 0.7))
        good_matches = good_matches[:keep_count]

        # 如果还是太少，进一步放宽条件
        if len(good_matches) < min_matches and len(matches) >= min_matches:
            good_matches = sorted(matches, key=lambda m: m.distance)[:min_matches]

        return good_matches
    else:
        # 常规模式：使用原有的高质量筛选
        return _filter_high_quality_matches(matches)


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

    try:
        await feature_cache.cache_image_features(image_id, {"fast": fast_data})
    except Exception as e:
        try:
            print(f"Fast feature cache skipped for {image_id}: {e}")
        except Exception:
            pass

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
    现在支持截图检测和增强特征提取。

    返回：
    - sim: ORB 相似度矩阵
    - match_counts: 匹配数量矩阵
    - pairwise_regions: 列表，每项描述 source_index 在 target_index 中的一个候选区域
        现在包含特征点连线可视化数据
    """
    if not image_paths:
        return [], [], []

    # 检测所有图像的截图模式
    screenshot_modes = []
    image_sizes = []  # 记录图像尺寸用于比较
    
    for path in image_paths:
        is_screenshot = _detect_screenshot_mode(path)
        screenshot_modes.append(is_screenshot)
        
        # 记录图像尺寸
        try:
            with PILImage.open(path) as img:
                image_sizes.append(img.size)  # (width, height)
        except:
            image_sizes.append((0, 0))
        
        if is_screenshot:
            print(f"Detected screenshot mode for image: {path}")

    # 检测是否有显著的分辨率差异（可能是缩放截图）
    # 支持极大的比例差异（最高100倍）
    has_resolution_mismatch = False
    if len(image_sizes) >= 2:
        for i in range(len(image_sizes)):
            for j in range(i + 1, len(image_sizes)):
                w1, h1 = image_sizes[i]
                w2, h2 = image_sizes[j]
                if w1 > 0 and w2 > 0 and h1 > 0 and h2 > 0:
                    # 计算面积比例
                    area1 = w1 * h1
                    area2 = w2 * h2
                    area_ratio = max(area1, area2) / min(area1, area2)
                    
                    # 计算宽高比例（检测单维度的巨大差异）
                    width_ratio = max(w1, w2) / min(w1, w2)
                    height_ratio = max(h1, h2) / min(h1, h2)
                    max_dimension_ratio = max(width_ratio, height_ratio)
                    
                    # 如果面积差异超过1.3倍，或任意维度差异超过1.5倍，启用截图模式
                    # 这样可以捕获10倍甚至更大的缩放比例
                    if area_ratio > 1.3 or max_dimension_ratio > 1.5:
                        has_resolution_mismatch = True
                        print(f"⚠️ Resolution mismatch detected: {w1}x{h1} vs {w2}x{h2}")
                        print(f"   📊 Area ratio: {area_ratio:.2f}x, Width ratio: {width_ratio:.2f}x, Height ratio: {height_ratio:.2f}x")
                        # 对这两张图都启用截图模式
                        screenshot_modes[i] = True
                        screenshot_modes[j] = True

    # 如果有任何截图或分辨率差异，则启用截图优化模式
    has_screenshots = any(screenshot_modes) or has_resolution_mismatch
    if has_screenshots:
        print("🔍 Screenshot/scale detection enabled - using enhanced matching")

    images: List[np.ndarray | None] = []
    keypoints_list: List[list] = []
    descriptors: List[np.ndarray | None] = []

    # 使用增强特征提取
    for i, path in enumerate(image_paths):
        img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        if img is None:
            images.append(None)
            keypoints_list.append([])
            descriptors.append(None)
            continue

        # 使用增强特征提取（支持多尺度和截图优化）
        keypoints, des = _extract_enhanced_features(path, screenshot_mode=screenshot_modes[i])

        images.append(img)
        keypoints_list.append(keypoints)
        descriptors.append(des)

        print(f"Image {i+1}: {len(keypoints)} keypoints extracted "
              f"{'(screenshot mode)' if screenshot_modes[i] else '(normal mode)'}")

    n = len(image_paths)
    sim = [[0.0 for _ in range(n)] for _ in range(n)]
    match_counts = [[0 for _ in range(n)] for _ in range(n)]
    pairwise_regions: List[Dict[str, object]] = []

    # 使用KNN匹配器而不是crossCheck，对尺度变化更鲁棒
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

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

            # 使用KNN匹配（k=2）以应用Lowe's ratio test
            # 这对于处理不同尺度的图像更鲁棒
            try:
                knn_matches = bf.knnMatch(des1, des2, k=2)
            except Exception as e:
                print(f"Warning: KNN matching failed for images {i}-{j}: {e}")
                score = 0.0
                count = 0
                sim[i][j] = sim[j][i] = float(score)
                match_counts[i][j] = match_counts[j][i] = int(count)
                continue

            # 检查是否涉及截图
            is_screenshot_pair = screenshot_modes[i] or screenshot_modes[j]
            is_crop_pair = False
            try:
                h1, w1 = images[i].shape[:2]
                h2, w2 = images[j].shape[:2]
                area1 = float(w1 * h1)
                area2 = float(w2 * h2)
                size_ratio = min(area1, area2) / max(area1, area2) if max(area1, area2) > 0 else 1.0
                ar1 = float(w1) / float(h1) if h1 > 0 else 1.0
                ar2 = float(w2) / float(h2) if h2 > 0 else 1.0
                aspect_diff = abs(ar1 - ar2)
                is_crop_pair = (size_ratio < 0.65) and (aspect_diff < 0.25)
            except Exception:
                is_crop_pair = False
            
            # 应用Lowe's ratio test过滤良好匹配
            # 对于极大比例变化的截图场景使用非常宽松的ratio
            # 因为大尺度变化会导致特征描述子差异增大
            if is_screenshot_pair or is_crop_pair:
                ratio_threshold = 0.90
            else:
                ratio_threshold = 0.85
            
            matches = []
            for match_pair in knn_matches:
                if len(match_pair) == 2:
                    m, n_match = match_pair
                    if m.distance < ratio_threshold * n_match.distance:
                        matches.append(m)
                elif len(match_pair) == 1:
                    # 只有一个匹配，也接受
                    matches.append(match_pair[0])
            
            print(f"Images {i}-{j}: {len(knn_matches)} raw matches -> {len(matches)} after ratio test (ratio={ratio_threshold})")

            # 计算图像大小因子用于动态调整
            img1_size = images[i].shape[0] * images[i].shape[1] if images[i] is not None else 1000*1000
            img2_size = images[j].shape[0] * images[j].shape[1] if images[j] is not None else 1000*1000
            avg_img_size = (img1_size + img2_size) / 2
            image_size_factor = avg_img_size / (1000*1000)  # 相对于1MP的基准

            # 使用自适应匹配筛选（支持截图模式）
            good_matches = _adaptive_screenshot_match_filter(
                matches,
                screenshot_mode=(is_screenshot_pair or is_crop_pair)
            )
            count = len(good_matches)

            # 使用增强的相似度计算
            score = _compute_enhanced_similarity(
                good_matches,
                len(des1),
                len(des2),
                image_size_factor=image_size_factor
            )

            # 截图模式下的额外相似度补偿（针对极大比例变化）
            if is_screenshot_pair and count >= 3:
                # 对于极大比例的截图，降低匹配点要求并提供更大的奖励
                # 每多一个匹配点增加8%（比之前的5%更激进）
                bonus_factor = 1.0 + (count - 3) * 0.08
                score = min(1.0, score * bonus_factor)
                print(f"Screenshot match bonus applied: {count} matches, factor: {bonus_factor:.2f}, final score: {score:.3f}")

            sim[i][j] = sim[j][i] = float(score)
            match_counts[i][j] = match_counts[j][i] = int(count)

            # 降低可视化的匹配点要求（从3降到2）
            if count >= 2 and images[i] is not None and images[j] is not None:
                # 步骤1：先尝试计算单应矩阵来验证几何一致性
                # 获取inlier mask以过滤只显示几何一致的匹配点
                visualization_matches = good_matches
                inlier_mask = None
                H = None
                
                try:
                    src_pts = np.float32(
                        [keypoints_list[i][m.queryIdx].pt for m in good_matches]
                    ).reshape(-1, 1, 2)
                    dst_pts = np.float32(
                        [keypoints_list[j][m.trainIdx].pt for m in good_matches]
                    ).reshape(-1, 1, 2)

                    # 对于截图模式，使用非常宽松的RANSAC参数以处理极大尺度变化
                    if is_screenshot_pair:
                        ransac_threshold = 15.0
                        min_inliers = 2
                    elif is_crop_pair:
                        ransac_threshold = 12.0
                        min_inliers = 2
                    else:
                        ransac_threshold = 10.0
                        min_inliers = 3

                    H, inlier_mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, ransac_threshold)
                    
                    if H is not None and inlier_mask is not None:
                        inliers = int(inlier_mask.ravel().sum())
                        
                        if inliers >= min_inliers:
                            # 步骤2：根据mask过滤出真正的inlier matches
                            # 只有这些匹配点会被可视化
                            visualization_matches = [
                                m for idx, m in enumerate(good_matches) 
                                if inlier_mask[idx][0] == 1
                            ]
                            print(f"✓ Geometric verification: {len(good_matches)} matches -> {len(visualization_matches)} inliers")
                        else:
                            print(f"⚠ Too few inliers ({inliers}), showing all matches")
                            inlier_mask = None  # 内点太少，显示所有匹配
                    else:
                        print(f"⚠ Homography failed, showing all matches")
                        inlier_mask = None
                        
                except Exception as e:
                    print(f"⚠ Geometric verification error: {e}, showing all matches")
                    inlier_mask = None
                
                # 步骤3：生成可视化数据（只包含几何一致的内点）
                src_keypoints = []
                dst_keypoints = []
                matches_data = []

                for idx, match in enumerate(visualization_matches):
                    # 获取匹配点在源图像和目标图像中的坐标
                    src_kp = keypoints_list[i][match.queryIdx]
                    dst_kp = keypoints_list[j][match.trainIdx]

                    src_kp_data = {
                        "x": float(src_kp.pt[0]),
                        "y": float(src_kp.pt[1]),
                        "size": float(src_kp.size),
                        "angle": float(src_kp.angle)
                    }

                    dst_kp_data = {
                        "x": float(dst_kp.pt[0]),
                        "y": float(dst_kp.pt[1]),
                        "size": float(dst_kp.size),
                        "angle": float(dst_kp.angle)
                    }

                    src_keypoints.append(src_kp_data)
                    dst_keypoints.append(dst_kp_data)

                    # 添加配对的match数据（用于前端直接渲染）
                    matches_data.append({
                        "queryIdx": match.queryIdx,
                        "trainIdx": match.trainIdx,
                        "distance": float(match.distance),
                        "queryPoint": src_kp_data,
                        "trainPoint": dst_kp_data,
                        "is_inlier": True  # 标记为内点
                    })

                # 初始化区域数据
                inlier_count = len(visualization_matches) if inlier_mask is not None else 0
                region = {
                    "source_index": i,
                    "target_index": j,
                    "image1_idx": i,
                    "image2_idx": j,
                    "score": float(score),
                    "similarity": float(score),
                    "match_count": int(count),
                    "inlier_count": inlier_count,  # 实际内点数量
                    "quad_in_target": None,
                    "bbox_in_target": None,
                    "matches": matches_data,  # 只包含inliers
                    "keypoints1": src_keypoints,
                    "keypoints2": dst_keypoints,
                    "feature_matches": {
                        "source_keypoints": src_keypoints,
                        "target_keypoints": dst_keypoints,
                        "source_image_size": [images[i].shape[1], images[i].shape[0]],
                        "target_image_size": [images[j].shape[1], images[j].shape[0]],
                        "match_distances": [float(m.distance) for m in visualization_matches],
                        "all_inliers": inlier_mask is not None  # 标记是否通过几何验证
                    }
                }

                # 步骤4：如果有有效的单应矩阵，计算变换区域和更新相似度
                if H is not None and inlier_mask is not None and inlier_count >= min_inliers:
                    try:
                        # 使用内点信息重新计算更准确的相似度分数
                        enhanced_score = _compute_enhanced_similarity(
                            visualization_matches,
                            len(des1),
                            len(des2),
                            inlier_count=inlier_count,
                            image_size_factor=image_size_factor
                        )

                        # 更新相似度分数（仅当内点验证通过时）
                        region["score"] = float(enhanced_score)
                        region["similarity"] = float(enhanced_score)
                        sim[i][j] = sim[j][i] = float(enhanced_score)

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
                        print(f"Warning: Failed to compute transformation region: {e}")
                else:
                    # 几何验证失败的处理
                    if is_screenshot_pair:
                        fallback_score = score * 0.7
                        region["score"] = float(fallback_score)
                        region["similarity"] = float(fallback_score)
                        print(f"Screenshot fallback: {fallback_score:.3f} (no geometric verification)")
                    elif is_crop_pair:
                        fallback_score = score * 0.8
                        region["score"] = float(fallback_score)
                        region["similarity"] = float(fallback_score)
                        print(f"Crop fallback: {fallback_score:.3f} (no geometric verification)")
                    else:
                        fallback_score = score * 0.5
                        region["score"] = float(fallback_score)
                        region["similarity"] = float(fallback_score)
                        print(f"Standard fallback: {fallback_score:.3f} (no geometric verification)")

                pairwise_regions.append(region)

    return sim, match_counts, pairwise_regions


def _run_analysis_task_wrapper(
    analysis_id: UUID,
    project_id: UUID
):
    """在线程池中运行异步分析任务的包装函数"""
    import asyncio
    import threading
    from concurrent.futures import ThreadPoolExecutor

    def run_in_new_loop():
        """在新的事件循环中运行异步任务"""
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(_run_analysis_task(analysis_id, project_id))
        finally:
            loop.close()

    # 在线程中运行
    thread = threading.Thread(target=run_in_new_loop)
    thread.start()
    return thread




async def _run_analysis_task(
    analysis_id: UUID,
    project_id: UUID
):
    """统一分析任务：智能应用所有分析方法获得最佳结果

    综合快速分析和精确分析的优势：
    - 快速特征分析（平均颜色 + 感知哈希）
    - ORB局部特征匹配（支持截图检测）
    - 智能权重混合（根据ORB匹配质量动态调整）
    """
    start_time = time.time()
    temp_dir = None

    try:
        await feature_cache._force_reconnect()
        print("🔄 Redis connection reset for new event loop")
    except Exception as e:
        print(f"⚠ Redis reconnect failed: {e}")

    try:
        with get_session() as session:
            analysis = session.get(AnalysisResult, analysis_id)
            if not analysis:
                raise ValueError(f"Analysis not found: {analysis_id}")

            images = session.exec(select(Image).where(Image.project_id == project_id)).all()
            actual_images = [img for img in images if img.mime_type and img.mime_type.startswith('image/')]

            if not actual_images:
                raise ValueError("No actual image files found for project")

            # 从MinIO下载图片文件到临时位置
            import tempfile
            import os
            from .minio_client import storage_service

            temp_dir = tempfile.mkdtemp()
            print(f"Created temporary directory: {temp_dir}")

            image_paths = []
            image_ids = []

            for img in actual_images:
                try:
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
                    with open(temp_path, "wb") as f:
                        f.write(file_data)

                    image_paths.append(temp_path)
                    image_ids.append(str(img.id))
                    print(f"Downloaded image: {img.filename}")

                except Exception as e:
                    print(f"Failed to download image {img.filename}: {e}")
                    # 继续处理其他图像，不中断整个流程
                    continue

            if not image_paths:
                raise ValueError("Failed to download any images from MinIO")

            # 服务健康检查
            print("Performing service health checks...")

            # 检查Redis连接（不可用时继续执行）
            try:
                await feature_cache.ping()
                print("✅ Redis connection: OK")
            except Exception as e:
                print(f"⚠ Redis unavailable, proceeding without cache: {e}")

            try:
                from .minio_client import storage_service
                if getattr(storage_service, "_available", False):
                    buckets = storage_service.client.list_buckets()
                    print(f"✅ MinIO connection: OK (found {len(buckets)} buckets)")
                else:
                    print("✅ MinIO local filesystem fallback: OK")
            except Exception as e:
                print(f"⚠ MinIO connection check failed: {e}")
                print("Proceeding with local filesystem fallback")

            # 更新状态
            analysis.status = "running"
            analysis.algorithm_type = "unified"
            session.commit()

            # 阶段1：快速特征分析
            print("Starting unified analysis - Phase 1: Fast features (color + hash)")
            analysis.progress = 0.1
            session.commit()

            fast_avg_colors, fast_ahashes = await _batch_compute_fast_features(image_ids, image_paths)
            fast_sim = _cosine_similarity_matrix(fast_avg_colors)
            fast_ahash_sim = _ahash_similarity_matrix(fast_ahashes)

            # 综合快速相似度（50%颜色 + 50%哈希）
            combined_fast_sim = []
            for i in range(len(fast_sim)):
                row = []
                for j in range(len(fast_sim[i])):
                    combined_score = 0.5 * fast_sim[i][j] + 0.5 * fast_ahash_sim[i][j]
                    row.append(combined_score)
                combined_fast_sim.append(row)

            analysis.progress = 0.4
            session.commit()

            # 阶段2：ORB局部特征分析（包含截图优化）
            print("Phase 2: ORB local features with screenshot detection")
            orb_sim, orb_match_counts, orb_regions = _orb_pairwise_analysis(image_paths)

            analysis.progress = 0.7
            session.commit()

            # 阶段3：智能权重混合计算
            print("Phase 3: Dynamic weight hybrid computation")
            final_sim = []

            for i in range(len(combined_fast_sim)):
                row = []
                for j in range(len(combined_fast_sim[i])):
                    # 动态权重调整
                    fast_score = combined_fast_sim[i][j]
                    orb_score = orb_sim[i][j]

                    # 如果ORB匹配度高，增加其权重
                    if orb_score > 0.3:
                        # 高质量ORB匹配：ORB权重70%，快速特征30%
                        hybrid_score = 0.7 * orb_score + 0.3 * fast_score
                    elif orb_score > 0.1:
                        # 中等质量ORB匹配：ORB权重50%，快速特征50%
                        hybrid_score = 0.5 * orb_score + 0.5 * fast_score
                    else:
                        # 低质量ORB匹配：快速特征权重70%，ORB权重30%
                        hybrid_score = 0.3 * orb_score + 0.7 * fast_score

                    row.append(hybrid_score)
                final_sim.append(row)

            # 保存结果
            analysis.results = json.dumps({
                "similarity_matrix": final_sim,
                "fast_similarity": combined_fast_sim,
                "orb_similarity": orb_sim,
                "match_counts": orb_match_counts,
                "pairwise_regions": orb_regions,  # 保留向后兼容
                "orb": {
                    "pairwise_regions": orb_regions,  # 前端期望的路径
                    "match_counts": orb_match_counts,
                    "similarity_matrix": orb_sim
                },
                "analysis_method": "unified",
                "strategy": "dynamic_weighting",
                "screenshot_detection": "enabled",
                "features": ["color_histogram", "perceptual_hash", "orb_local_features"]
            })

            analysis.status = "completed"
            analysis.progress = 1.0
            from datetime import datetime
            analysis.completed_at = datetime.utcnow()
            session.commit()

            print(f"Unified analysis completed in {time.time() - start_time:.2f}s")

    except Exception as e:
        # 错误处理
        print(f"Unified analysis failed: {e}")
        import traceback
        traceback.print_exc()

        # 更新分析状态为失败
        try:
            with get_session() as session:
                analysis = session.get(AnalysisResult, analysis_id)
                if analysis:
                    analysis.status = "failed"
                    analysis.error_message = f"Unified analysis failed: {str(e)}"
                    analysis.progress = 1.0
                    session.commit()
        except Exception as db_error:
            print(f"Failed to update analysis status: {db_error}")

    finally:
        # 清理临时目录
        if temp_dir and os.path.exists(temp_dir):
            try:
                import shutil
                shutil.rmtree(temp_dir, ignore_errors=True)
                print(f"Cleaned up temporary directory: {temp_dir}")
            except Exception as cleanup_error:
                print(f"Failed to cleanup temporary directory: {cleanup_error}")
        
        # 关闭Redis连接以避免连接泄漏
        try:
            await feature_cache._force_reconnect()
            print("🔄 Redis connection closed for event loop cleanup")
        except Exception as redis_cleanup_error:
            print(f"Warning: Failed to cleanup Redis connection: {redis_cleanup_error}")


@router.post("/start")
def start_analysis(
    background_tasks: BackgroundTasks,
    project_id: UUID,
) -> Dict[str, str]:
    """图像相似度分析入口（异步）。

    使用统一分析策略，智能应用所有分析方法：
    - 快速特征分析（平均颜色 + 感知哈希）
    - ORB局部特征匹配（支持截图检测）
    - 智能权重混合（根据匹配质量动态调整权重）

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
            algorithm_type="unified",
            parameters=json.dumps({
                "strategy": "unified",
                "methods": ["fast", "orb", "hybrid_weighting"],
                "screenshot_detection": True,
                "dynamic_weighting": True
            }),
            status="pending",
            progress=0.0
        )
        session.add(analysis)
        session.commit()
        session.refresh(analysis)

        # 启动统一分析任务
        background_tasks.add_task(_run_analysis_task_wrapper, analysis.id, project_id)

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
            "redis_url": feature_cache.redis_url,
            "used_memory": info.get("used_memory_human", "N/A"),
            "connected_clients": info.get("connected_clients", "N/A"),
            "uptime_seconds": info.get("uptime_in_seconds", "N/A")
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "redis_connected": False,
            "redis_url": feature_cache.redis_url,
            "error": str(e)
        }
