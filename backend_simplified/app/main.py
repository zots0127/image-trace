import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional
import uuid

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlmodel import Session, select

from .models import (
    Project, ProjectCreate, ProjectRead, Image, ImageCreate, ImageRead,
    ComparisonResult, AnalysisRun
)
from .utils import (
    get_session, get_database_url, ensure_directory, save_upload_file,
    is_supported_image_format, is_supported_document_format,
    compare_images_in_project
)
from .image_processor import compute_image_features, is_image_file, ALL_ALGOS, HASH_ALGOS, DESCRIPTOR_ALGOS
from .image_processor import draw_feature_matches
from .image_processor import get_or_compute_similarity, invalidate_feature_cache, invalidate_similarity_cache
from .feature_matrix import (
    precompute_feature_matrix, compute_similarity_matrix_fast,
    are_features_ready, ALGO_TO_FEATURE,
)
from .document_parser import DocumentParser


# 创建FastAPI应用
app = FastAPI(
    title="Image Trace API (简化版)",
    description="简化的图像比对和文档图片提取系统",
    version="2.0.0"
)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 配置目录
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "data/uploads"))
EXTRACT_DIR = Path(os.getenv("EXTRACT_DIR", "data/extracted"))
STATIC_DIR = Path(os.getenv("STATIC_DIR", "data"))

# 确保目录存在
ensure_directory(UPLOAD_DIR)
ensure_directory(EXTRACT_DIR)
ensure_directory(STATIC_DIR)

# 挂载静态文件服务
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# 文档解析器实例
doc_parser = DocumentParser(str(UPLOAD_DIR), str(EXTRACT_DIR))


# 依赖注入：获取数据库会话
def get_db():
    database_url = get_database_url()
    with get_session(database_url) as session:
        yield session


@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "Image Trace API (简化版)",
        "version": "2.0.0",
        "endpoints": {
            "projects": "/projects",
            "upload": "/upload",
            "compare": "/compare/{project_id}",
            "results": "/results/{project_id}",
            "download": "/download/{file_path:path}",
            "docs": "/docs"
        }
    }


@app.post("/projects", response_model=ProjectRead)
async def create_project(
    project: ProjectCreate,
    session: Session = Depends(get_db)
):
    """创建新项目"""
    db_project = Project.model_validate(project)
    session.add(db_project)
    session.commit()
    session.refresh(db_project)

    # 计算图片数量（ProjectRead 字段，不写回 Project 表模型）
    statement = select(Image).where(Image.project_id == db_project.id)
    images = session.exec(statement).all()
    payload = db_project.model_dump()
    payload["image_count"] = len(images)
    return ProjectRead.model_validate(payload)


@app.get("/projects", response_model=List[ProjectRead])
async def list_projects(
    skip: int = 0,
    limit: int = 100,
    session: Session = Depends(get_db)
):
    """获取项目列表"""
    statement = select(Project).offset(skip).limit(limit)
    projects = session.exec(statement).all()

    # 添加图片数量（返回 ProjectRead 列表）
    project_reads: List[ProjectRead] = []
    for project in projects:
        statement = select(Image).where(Image.project_id == project.id)
        images = session.exec(statement).all()
        payload = project.model_dump()
        payload["image_count"] = len(images)
        project_reads.append(ProjectRead.model_validate(payload))

    return project_reads


@app.get("/projects/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: int,
    session: Session = Depends(get_db)
):
    """获取项目详情"""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # 添加图片数量（返回 ProjectRead）
    statement = select(Image).where(Image.project_id == project_id)
    images = session.exec(statement).all()
    payload = project.model_dump()
    payload["image_count"] = len(images)
    return ProjectRead.model_validate(payload)


@app.delete("/projects/{project_id}")
async def delete_project(
    project_id: int,
    session: Session = Depends(get_db)
):
    """删除项目"""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # 删除项目相关的图像记录
    statement = select(Image).where(Image.project_id == project_id)
    images = session.exec(statement).all()
    for image in images:
        session.delete(image)

    # 删除项目
    session.delete(project)
    session.commit()

    return {"message": "项目已删除"}


def _bg_precompute_features(image_id: int, image_path: str):
    """Background task: precompute feature matrix for a single image."""
    from sqlmodel import Session as _Session
    from sqlalchemy import create_engine as _ce
    try:
        engine = _ce(get_database_url())
        with _Session(engine) as session:
            precompute_feature_matrix(image_id, image_path, session)
    except Exception as e:
        print(f"Background precompute failed for image {image_id}: {e}")


@app.post("/upload")
async def upload_file(
    project_id: int = Form(...),
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    session: Session = Depends(get_db)
):
    """
    上传文件（自动识别类型：图片或文档）

    Args:
        project_id: 项目ID
        file: 上传的文件

    Returns:
        上传结果
    """
    # 验证项目是否存在
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # 检查文件名
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名为空")

    # 保存上传文件
    file_path = UPLOAD_DIR / file.filename
    saved_path = save_upload_file(file, file_path)

    # 返回/入库使用相对于 data 目录的路径（例如：uploads/a.jpg、extracted/b.jpg）
    try:
        saved_rel_path = str(saved_path.relative_to(STATIC_DIR))
    except Exception:
        saved_rel_path = str(saved_path)

    result = {
        "project_id": project_id,
        "filename": file.filename,
        "file_path": saved_rel_path,
        "file_size": saved_path.stat().st_size,
        "file_type": "unknown",
        "processed_images": [],
        "error": None
    }

    try:
        if is_supported_image_format(file.filename):
            # 处理图片文件
            result['file_type'] = 'image'

            # 计算图片特征
            features = compute_image_features(str(saved_path))
            features.update({
                'filename': file.filename,
                'project_id': project_id,
                'file_path': saved_rel_path,
                'extracted_from': None
            })

            # 保存到数据库
            db_image = Image.model_validate(features)
            session.add(db_image)
            session.commit()
            session.refresh(db_image)

            result['processed_images'].append({
                'id': db_image.id,
                'filename': db_image.filename,
                'file_path': db_image.file_path,
                'type': 'direct_upload'
            })

            # Trigger async feature matrix precomputation
            if background_tasks:
                background_tasks.add_task(
                    _bg_precompute_features, db_image.id, str(saved_path)
                )

        elif is_supported_document_format(file.filename):
            # 处理文档文件
            result['file_type'] = 'document'

            # 提取文档中的图片
            extraction_result = doc_parser.process_document(str(saved_path))

            if extraction_result['status'] == 'success':
                db_images = []
                for img_info in extraction_result['images']:
                    img_info['project_id'] = project_id
                    # 保存到数据库
                    db_image = Image.model_validate(img_info)
                    session.add(db_image)
                    db_images.append(db_image)

                session.commit()
                for db_image in db_images:
                    session.refresh(db_image)

                result['processed_images'] = [{
                    'id': db_image.id,
                    'filename': db_image.filename,
                    'file_path': db_image.file_path,
                    'type': 'extracted_from_document'
                } for db_image in db_images]
            else:
                result['error'] = extraction_result['error']

        else:
            result['error'] = f"不支持的文件格式: {file.filename}"

    except Exception as e:
        result['error'] = str(e)
        # 如果处理失败，删除上传的文件
        saved_path.unlink(missing_ok=True)

    return result


@app.post("/extract/{file_path:path}")
async def extract_from_document(
    file_path: str,
    project_id: int = Form(...),
    session: Session = Depends(get_db)
):
    """
    从已上传的文档中提取图片

    Args:
        file_path: 文档文件路径（相对于data目录）
        project_id: 项目ID

    Returns:
        提取结果
    """
    # 验证项目是否存在
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # 构建完整文件路径
    full_path = UPLOAD_DIR / file_path
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    try:
        # 提取图片
        extraction_result = doc_parser.process_document(str(full_path))

        if extraction_result['status'] == 'success':
            # 保存到数据库
            for img_info in extraction_result['images']:
                img_info['project_id'] = project_id
                db_image = Image.model_validate(img_info)
                session.add(db_image)

            session.commit()

            # 为结果添加ID
            for img in extraction_result['images']:
                if 'id' not in img:
                    # 通过文件路径查找刚插入的记录
                    statement = select(Image).where(
                        Image.file_path == img['file_path'],
                        Image.project_id == project_id
                    )
                    db_img = session.exec(statement).first()
                    if db_img:
                        img['id'] = db_img.id

        return extraction_result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"提取失败: {str(e)}")


@app.post("/compare/{project_id}")
async def compare_project_images(
    project_id: int,
    threshold: float = Form(default=0.85),
    hash_type: str = Form(default="phash"),
    rotation_invariant: bool = Form(default=False),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    session: Session = Depends(get_db)
):
    """
    比对项目中的所有图像

    Args:
        project_id: 项目ID
        threshold: 相似度阈值 (0-1)
        hash_type: 比对算法
        rotation_invariant: 是否启用旋转/翻转不变性（测试8种方向取最高分）

    Returns:
        比对结果
    """
    # 验证项目是否存在
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # 验证参数
    if not 0 <= threshold <= 1:
        raise HTTPException(status_code=400, detail="阈值必须在0-1之间")

    if hash_type not in ALL_ALGOS:
        raise HTTPException(status_code=400, detail=f"不支持的比对算法: {hash_type}。支持: {', '.join(sorted(ALL_ALGOS))}")

    try:
        # 执行比对
        result = compare_images_in_project(
            session, project_id, threshold, hash_type,
            rotation_invariant=rotation_invariant
        )
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"比对失败: {str(e)}")


@app.get("/results/{project_id}")
async def get_comparison_results(
    project_id: int,
    threshold: float = 0.85,
    hash_type: str = "phash",
    session: Session = Depends(get_db)
):
    """
    获取项目的比对结果（同POST /compare，但使用GET方法）
    """
    return await compare_project_images(
        project_id=project_id,
        threshold=threshold,
        hash_type=hash_type,
        rotation_invariant=False,
        background_tasks=BackgroundTasks(),
        session=session,
    )


@app.get("/analysis_runs")
async def list_analysis_runs(
    project_id: int,
    skip: int = 0,
    limit: int = 50,
    session: Session = Depends(get_db)
):
    statement = (
        select(AnalysisRun)
        .where(AnalysisRun.project_id == project_id)
        .order_by(AnalysisRun.id.desc())
        .offset(skip)
        .limit(limit)
    )
    runs = session.exec(statement).all()
    return runs


@app.get("/analysis_runs/{run_id}")
async def get_analysis_run(
    run_id: int,
    session: Session = Depends(get_db)
):
    run = session.get(AnalysisRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="分析记录不存在")

    parsed = None
    if run.summary:
        try:
            parsed = json.loads(run.summary)
        except Exception:
            parsed = None

    return {
        "run": run,
        "result": parsed
    }


@app.get("/download/{file_path:path}")
async def download_file(file_path: str):
    """
    下载文件

    Args:
        file_path: 文件路径（相对于data目录）

    Returns:
        文件响应
    """
    # 兼容旧数据：历史上可能保存为 data/uploads/xxx
    if file_path.startswith("data/"):
        file_path = file_path[len("data/"):]

    # 构建完整文件路径
    base_dir = STATIC_DIR
    full_path = base_dir / file_path

    # 安全检查：确保文件在允许的目录内
    try:
        full_path.resolve().relative_to(base_dir.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="访问被拒绝")

    if not full_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    # 确定MIME类型
    if is_image_file(str(full_path)):
        media_type = "image/jpeg"
    elif file_path.endswith('.pdf'):
        media_type = "application/pdf"
    else:
        media_type = "application/octet-stream"

    return FileResponse(
        path=full_path,
        filename=full_path.name,
        media_type=media_type
    )


@app.post("/visualize_match")
async def visualize_match(
    image_a_id: int = Form(...),
    image_b_id: int = Form(...),
    hash_type: str = Form(default="orb"),
    session: Session = Depends(get_db)
):
    """
    生成两张图片的特征点匹配可视化，返回可下载路径
    """
    descriptor_algos = ['orb', 'brisk', 'sift', 'akaze', 'kaze']
    algo = hash_type
    if algo not in descriptor_algos:
        raise HTTPException(status_code=400, detail=f"该算法不支持特征点可视化，支持: {', '.join(descriptor_algos)}")

    img_a = session.get(Image, image_a_id)
    img_b = session.get(Image, image_b_id)
    if not img_a or not img_b:
        raise HTTPException(status_code=404, detail="图像不存在")

    def resolve_path(fp: str) -> Path:
        if fp.startswith("data/"):
            fp = fp[len("data/"):]
        return STATIC_DIR / fp

    path_a = resolve_path(img_a.file_path or "")
    path_b = resolve_path(img_b.file_path or "")
    if not path_a.exists() or not path_b.exists():
        raise HTTPException(status_code=404, detail="图像文件不存在")

    try:
        vis_path = draw_feature_matches(str(path_a), str(path_b), algo=algo, output_dir=STATIC_DIR / "visualizations")
        rel_path = vis_path.relative_to(STATIC_DIR)
        return {
            "file_path": str(rel_path),
            "media_type": "image/jpeg"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成可视化失败: {str(e)}")



@app.get("/pairwise_matrix/{project_id}")
async def pairwise_matrix(
    project_id: int,
    hash_type: str = "sift",
    rotation_invariant: bool = False,
    session: Session = Depends(get_db)
):
    """
    Compute N×N pairwise similarity matrix for all images in a project.
    Returns: { names: [...], matrix: [[...]], algorithm: str }
    """
    if hash_type not in ALL_ALGOS:
        raise HTTPException(status_code=400, detail=f"Unsupported algorithm: {hash_type}")

    statement = select(Image).where(Image.project_id == project_id)
    images = session.exec(statement).all()
    if not images:
        return {"names": [], "matrix": [], "algorithm": hash_type}

    n = len(images)
    names = [img.filename for img in images]
    ids = [img.id for img in images]

    # ---- Fast path: use pre-computed feature matrix ----
    feature_name = ALGO_TO_FEATURE.get(hash_type)
    if feature_name and are_features_ready(session, ids):
        try:
            sim_matrix = compute_similarity_matrix_fast(
                session, ids, hash_type, rotation_invariant
            )
            matrix = [[round(float(sim_matrix[i, j]), 4) for j in range(n)] for i in range(n)]
            return {
                "names": names, "image_ids": ids,
                "matrix": matrix, "algorithm": hash_type,
                "engine": "matrix",
            }
        except Exception:
            pass  # fall through to legacy path

    # ---- Legacy path: per-pair computation ----
    def resolve(fp):
        if fp and fp.startswith("data/"):
            fp = fp[len("data/"):]
        return str(STATIC_DIR / (fp or ""))

    paths = [resolve(img.file_path) for img in images]

    features = []
    for img in images:
        features.append({
            "phash": img.phash or "",
            "dhash": img.dhash or "",
            "ahash": img.ahash or "",
            "whash": img.whash or "",
            "colorhash": img.colorhash or "",
            "file_hash": img.file_hash,
        })

    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        matrix[i][i] = 1.0

    for i in range(n):
        for j in range(i + 1, n):
            try:
                score = get_or_compute_similarity(
                    path_a=paths[i], path_b=paths[j],
                    file_hash_a=images[i].file_hash,
                    file_hash_b=images[j].file_hash,
                    algorithm=hash_type,
                    features_a=features[i], features_b=features[j],
                    rotation_invariant=rotation_invariant,
                    session=session,
                )
            except Exception:
                score = 0.0

            matrix[i][j] = round(score, 4)
            matrix[j][i] = round(score, 4)

    return {
        "names": names, "image_ids": ids,
        "matrix": matrix, "algorithm": hash_type,
        "engine": "legacy",
    }


@app.get("/feature_status/{project_id}")
async def feature_status(
    project_id: int,
    session: Session = Depends(get_db)
):
    """Check feature precomputation status for all images in a project."""
    statement = select(Image).where(Image.project_id == project_id)
    images = session.exec(statement).all()
    statuses = [{"id": img.id, "filename": img.filename, "status": img.feature_status or "pending"} for img in images]
    total = len(statuses)
    ready = sum(1 for s in statuses if s["status"] == "ready")
    return {
        "project_id": project_id,
        "total": total,
        "ready": ready,
        "all_ready": ready == total and total > 0,
        "images": statuses,
    }


@app.get("/system_info")
async def system_info():
    """Return system capabilities: engine type, supported algorithms."""
    return {
        "engines": ["matrix", "legacy"],
        "algorithms": list(ALL_ALGOS),
        "matrix_engine": "numpy_blas",
        "description": "Upload precomputes all features (11 types × 8 variants). Comparison uses BLAS mat@mat.T.",
    }


@app.get("/images/{project_id}")
async def list_project_images(
    project_id: int,
    skip: int = 0,
    limit: int = 100,
    session: Session = Depends(get_db)
):
    """获取项目中的图像列表"""
    # 验证项目是否存在
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # 获取图像列表
    statement = select(Image).where(Image.project_id == project_id).offset(skip).limit(limit)
    images = session.exec(statement).all()

    return images


@app.delete("/images/{image_id}")
async def delete_image(
    image_id: int,
    session: Session = Depends(get_db)
):
    """删除图像"""
    image = session.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="图像不存在")

    file_hash = image.file_hash
    # Resolve full path for cache invalidation
    full_path = None
    try:
        fp = image.file_path or ""
        if fp.startswith("data/"):
            fp = fp[len("data/"):]
        if fp:
            full_path = str(STATIC_DIR / fp)
            (STATIC_DIR / fp).unlink(missing_ok=True)
    except Exception:
        pass  # 忽略文件删除错误

    # Invalidate all caches for this image
    if full_path:
        invalidate_feature_cache(full_path)
    invalidate_similarity_cache(session, file_hash)

    # 删除数据库记录
    session.delete(image)
    session.commit()

    return {"message": "图像已删除"}


@app.get("/thumbnail/{image_id}")
async def get_thumbnail(
    image_id: int,
    size: int = 400,
    session: Session = Depends(get_db)
):
    """
    Return a browser-friendly JPEG thumbnail for any image (including TIF/RAW).
    Caches the result in data/thumbnails/.
    """
    image = session.get(Image, image_id)
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")

    fp = image.file_path or ""
    if fp.startswith("data/"):
        fp = fp[len("data/"):]
    src_path = STATIC_DIR / fp
    if not src_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")

    # Cache directory
    thumb_dir = STATIC_DIR / "thumbnails"
    thumb_dir.mkdir(exist_ok=True)
    thumb_path = thumb_dir / f"{image_id}_{size}.jpg"

    if not thumb_path.exists():
        try:
            from PIL import Image as PILImage
            img = PILImage.open(str(src_path))
            img = img.convert("RGB")
            img.thumbnail((size, size), PILImage.LANCZOS)
            img.save(str(thumb_path), "JPEG", quality=85)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Thumbnail generation failed: {e}")

    return FileResponse(
        path=thumb_path,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@app.post("/match_data")
async def get_match_data(
    image_a_id: int = Form(...),
    image_b_id: int = Form(...),
    hash_type: str = Form(default="sift"),
    session: Session = Depends(get_db)
):
    """
    Return keypoint coordinates and match lines as JSON for frontend SVG rendering.
    Response: {
      image_a: { width, height, keypoints: [{x, y}] },
      image_b: { width, height, keypoints: [{x, y}] },
      matches: [{a_idx, b_idx, distance}],
      score: float
    }
    """
    import cv2
    import numpy as np

    descriptor_algos = ['orb', 'brisk', 'sift', 'akaze', 'kaze']
    if hash_type not in descriptor_algos:
        raise HTTPException(status_code=400, detail=f"Supports: {', '.join(descriptor_algos)}")

    img_a = session.get(Image, image_a_id)
    img_b = session.get(Image, image_b_id)
    if not img_a or not img_b:
        raise HTTPException(status_code=404, detail="Image not found")

    def resolve(fp):
        if fp and fp.startswith("data/"):
            fp = fp[len("data/"):]
        return str(STATIC_DIR / (fp or ""))

    path_a, path_b = resolve(img_a.file_path), resolve(img_b.file_path)
    if not os.path.exists(path_a) or not os.path.exists(path_b):
        raise HTTPException(status_code=404, detail="Image file not found")

    try:
        im_a = cv2.imread(path_a)
        im_b = cv2.imread(path_b)
        if im_a is None or im_b is None:
            raise HTTPException(status_code=500, detail="Failed to read image")

        gray_a = cv2.cvtColor(im_a, cv2.COLOR_BGR2GRAY)
        gray_b = cv2.cvtColor(im_b, cv2.COLOR_BGR2GRAY)

        # Create detector
        algo = hash_type.lower()
        if algo == "sift":
            detector = cv2.SIFT_create()
        elif algo == "orb":
            detector = cv2.ORB_create(nfeatures=500)
        elif algo == "brisk":
            detector = cv2.BRISK_create()
        elif algo == "akaze":
            detector = cv2.AKAZE_create()
        elif algo == "kaze":
            detector = cv2.KAZE_create()
        else:
            detector = cv2.ORB_create()

        kp_a, desc_a = detector.detectAndCompute(gray_a, None)
        kp_b, desc_b = detector.detectAndCompute(gray_b, None)

        if desc_a is None or desc_b is None or len(desc_a) == 0 or len(desc_b) == 0:
            return {
                "image_a": {"width": im_a.shape[1], "height": im_a.shape[0], "keypoints": []},
                "image_b": {"width": im_b.shape[1], "height": im_b.shape[0], "keypoints": []},
                "matches": [],
                "score": 0.0,
            }

        # Match
        if algo in ("sift", "kaze"):
            bf = cv2.BFMatcher(cv2.NORM_L2)
        else:
            bf = cv2.BFMatcher(cv2.NORM_HAMMING)

        raw_matches = bf.knnMatch(desc_a, desc_b, k=2)
        good = []
        for m_pair in raw_matches:
            if len(m_pair) == 2:
                m, n = m_pair
                if m.distance < 0.75 * n.distance:
                    good.append(m)

        # Sort by distance, take top 50
        good.sort(key=lambda x: x.distance)
        good = good[:50]

        score = len(good) / max(len(kp_a), len(kp_b), 1)
        score = min(score, 1.0)

        return {
            "image_a": {
                "width": im_a.shape[1],
                "height": im_a.shape[0],
                "keypoints": [{"x": round(kp.pt[0], 1), "y": round(kp.pt[1], 1)} for kp in kp_a[:200]],
            },
            "image_b": {
                "width": im_b.shape[1],
                "height": im_b.shape[0],
                "keypoints": [{"x": round(kp.pt[0], 1), "y": round(kp.pt[1], 1)} for kp in kp_b[:200]],
            },
            "matches": [
                {"a_idx": m.queryIdx, "b_idx": m.trainIdx, "distance": round(m.distance, 2)}
                for m in good
            ],
            "score": round(score, 4),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Match computation failed: {e}")

@app.get("/report/{project_id}")
async def generate_report(
    project_id: int,
    hash_type: str = "sift",
    threshold: float = 0.85,
    rotation_invariant: bool = False,
    session: Session = Depends(get_db)
):
    """
    Generate a comprehensive duplicate detection report:
    - Project metadata
    - Image list with thumbnail URLs
    - Pairwise similarity matrix
    - Similar groups with per-pair match data (keypoints + matches)
    - Summary statistics
    """
    import cv2
    import numpy as np

    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    images = session.exec(
        select(Image).where(Image.project_id == project_id)
    ).all()

    if not images:
        return {
            "project": {"id": project.id, "name": project.name, "description": project.description},
            "generated_at": datetime.utcnow().isoformat(),
            "algorithm": hash_type,
            "threshold": threshold,
            "rotation_invariant": rotation_invariant,
            "images": [],
            "matrix": {"names": [], "image_ids": [], "values": []},
            "groups": [],
            "summary": {"total_images": 0, "similar_groups": 0, "unique_images": 0, "duplicate_rate": 0},
        }

    # --- 1. Build image metadata ---
    image_meta = []
    for img in images:
        image_meta.append({
            "id": img.id,
            "filename": img.filename,
            "width": img.width,
            "height": img.height,
            "file_size": img.file_size,
        })

    # --- 2. Pairwise matrix ---
    n = len(images)
    paths = []
    features = []
    for img in images:
        fp = img.file_path or ""
        if fp.startswith("data/"):
            fp = fp[len("data/"):]
        paths.append(str(STATIC_DIR / fp))
        features.append({
            "phash": img.phash or "",
            "dhash": img.dhash or "",
            "ahash": img.ahash or "",
            "whash": img.whash or "",
            "colorhash": img.colorhash or "",
        })

    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        matrix[i][i] = 1.0

    for i in range(n):
        for j in range(i + 1, n):
            try:
                score = get_or_compute_similarity(
                    path_a=paths[i], path_b=paths[j],
                    file_hash_a=images[i].file_hash,
                    file_hash_b=images[j].file_hash,
                    algorithm=hash_type,
                    features_a=features[i], features_b=features[j],
                    rotation_invariant=rotation_invariant,
                    session=session,
                )
            except Exception:
                score = 0.0

            matrix[i][j] = round(score, 4)
            matrix[j][i] = round(score, 4)

    # --- 3. Find similar groups ---
    from app.utils import group_similar_images as _group
    group_input = []
    for i in range(n):
        for j in range(i + 1, n):
            if matrix[i][j] >= threshold:
                group_input.append((images[i].id, images[j].id, matrix[i][j]))

    # Build groups using union-find
    parent = {}
    def find(x):
        while parent.get(x, x) != x:
            parent[x] = parent.get(parent[x], parent[x])
            x = parent[x]
        return x
    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    group_scores = {}
    for a_id, b_id, score in group_input:
        union(a_id, b_id)
        group_scores[(a_id, b_id)] = score

    clusters = {}
    for img in images:
        root = find(img.id)
        if root not in clusters:
            clusters[root] = []
        clusters[root].append(img)

    # --- 4. Build groups with match data ---
    groups = []
    group_id = 0
    for root, imgs in clusters.items():
        if len(imgs) < 2:
            continue
        group_id += 1

        # Compute match data for each pair in the group
        pair_matches = []
        for a_idx in range(len(imgs)):
            for b_idx in range(a_idx + 1, len(imgs)):
                a, b = imgs[a_idx], imgs[b_idx]
                pair_score = group_scores.get((a.id, b.id), group_scores.get((b.id, a.id), 0))

                match_info = {"image_a_id": a.id, "image_b_id": b.id, "score": pair_score, "matches": [], "keypoints_a": [], "keypoints_b": []}

                # Only compute keypoint matches for descriptor algorithms
                if hash_type in DESCRIPTOR_ALGOS:
                    try:
                        fp_a = a.file_path or ""
                        fp_b = b.file_path or ""
                        if fp_a.startswith("data/"): fp_a = fp_a[len("data/"):]
                        if fp_b.startswith("data/"): fp_b = fp_b[len("data/"):]

                        im_a = cv2.imread(str(STATIC_DIR / fp_a))
                        im_b = cv2.imread(str(STATIC_DIR / fp_b))
                        if im_a is not None and im_b is not None:
                            gray_a = cv2.cvtColor(im_a, cv2.COLOR_BGR2GRAY)
                            gray_b = cv2.cvtColor(im_b, cv2.COLOR_BGR2GRAY)

                            if hash_type == "sift": detector = cv2.SIFT_create()
                            elif hash_type == "orb": detector = cv2.ORB_create(nfeatures=500)
                            elif hash_type == "brisk": detector = cv2.BRISK_create()
                            elif hash_type == "akaze": detector = cv2.AKAZE_create()
                            elif hash_type == "kaze": detector = cv2.KAZE_create()
                            else: detector = cv2.ORB_create()

                            kp_a, desc_a = detector.detectAndCompute(gray_a, None)
                            kp_b, desc_b = detector.detectAndCompute(gray_b, None)

                            if desc_a is not None and desc_b is not None and len(desc_a) > 0 and len(desc_b) > 0:
                                norm = cv2.NORM_L2 if hash_type in ("sift", "kaze") else cv2.NORM_HAMMING
                                bf = cv2.BFMatcher(norm)
                                raw = bf.knnMatch(desc_a, desc_b, k=2)
                                good = []
                                for mp in raw:
                                    if len(mp) == 2 and mp[0].distance < 0.75 * mp[1].distance:
                                        good.append(mp[0])
                                good.sort(key=lambda x: x.distance)
                                good = good[:50]

                                match_info["keypoints_a"] = [{"x": round(kp.pt[0], 1), "y": round(kp.pt[1], 1)} for kp in kp_a[:200]]
                                match_info["keypoints_b"] = [{"x": round(kp.pt[0], 1), "y": round(kp.pt[1], 1)} for kp in kp_b[:200]]
                                match_info["matches"] = [{"a_idx": m.queryIdx, "b_idx": m.trainIdx, "distance": round(m.distance, 2)} for m in good]
                                match_info["image_a_size"] = {"width": im_a.shape[1], "height": im_a.shape[0]}
                                match_info["image_b_size"] = {"width": im_b.shape[1], "height": im_b.shape[0]}
                    except Exception:
                        pass

                pair_matches.append(match_info)

        avg_score = sum(p["score"] for p in pair_matches) / max(len(pair_matches), 1)
        groups.append({
            "group_id": group_id,
            "similarity_score": round(avg_score, 4),
            "images": [{"id": img.id, "filename": img.filename} for img in imgs],
            "pair_matches": pair_matches,
        })

    unique_ids = {img.id for img in images} - {img.id for g in groups for img_d in g["images"] for img in [type('', (), img_d)()]}
    unique_count = n - sum(len(g["images"]) for g in groups)

    duplicate_rate = round((n - unique_count) / n * 100, 1) if n > 0 else 0

    return {
        "project": {"id": project.id, "name": project.name, "description": project.description},
        "generated_at": datetime.utcnow().isoformat(),
        "algorithm": hash_type,
        "threshold": threshold,
        "rotation_invariant": rotation_invariant,
        "images": image_meta,
        "matrix": {
            "names": [img.filename for img in images],
            "image_ids": [img.id for img in images],
            "values": matrix,
        },
        "groups": groups,
        "summary": {
            "total_images": n,
            "similar_groups": len(groups),
            "unique_images": unique_count,
            "duplicate_rate": duplicate_rate,
        },
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "version": "2.0.0"
    }


# 启动事件
def _migrate_db_schema(database_url: str):
    """Auto-migrate SQLite schema: add missing columns to existing tables."""
    import sqlite3
    if not database_url.startswith("sqlite"):
        return
    db_path = database_url.replace("sqlite:///", "")
    if not os.path.exists(db_path):
        return
    conn = sqlite3.connect(db_path)
    try:
        cursor = conn.execute("PRAGMA table_info(images)")
        existing_cols = {row[1] for row in cursor.fetchall()}
        # Expected columns from the Image model (nullable optional fields)
        expected_optional = {
            "colorhash": "VARCHAR",
            "dhash": "VARCHAR",
            "ahash": "VARCHAR",
            "whash": "VARCHAR",
            "extracted_from": "VARCHAR",
            "file_size": "INTEGER",
            "width": "INTEGER",
            "height": "INTEGER",
        }
        for col, col_type in expected_optional.items():
            if col not in existing_cols:
                conn.execute(f"ALTER TABLE images ADD COLUMN {col} {col_type}")
                print(f"DB migration: added column images.{col}")
        # Create similarity_cache table if not exists
        conn.execute("""
            CREATE TABLE IF NOT EXISTS similarity_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hash_a VARCHAR(32),
                hash_b VARCHAR(32),
                algorithm VARCHAR(32),
                rotation_invariant BOOLEAN DEFAULT 0,
                score REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Create indexes for fast lookup
        conn.execute("CREATE INDEX IF NOT EXISTS idx_simcache_a ON similarity_cache(hash_a)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_simcache_b ON similarity_cache(hash_b)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_simcache_algo ON similarity_cache(algorithm)")
        # Create feature_store table if not exists
        conn.execute("""
            CREATE TABLE IF NOT EXISTS feature_store (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                image_id INTEGER NOT NULL REFERENCES images(id),
                variant_idx INTEGER NOT NULL DEFAULT 0,
                algorithm VARCHAR(32) NOT NULL,
                vector TEXT NOT NULL,
                dimensions INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(image_id, variant_idx, algorithm)
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_fs_image ON feature_store(image_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_fs_algo ON feature_store(algorithm)")
        # Add feature_status column to images if missing
        if 'feature_status' not in existing_cols:
            conn.execute("ALTER TABLE images ADD COLUMN feature_status VARCHAR(16) DEFAULT 'pending'")
            print("DB migration: added column images.feature_status")
        conn.commit()
    except Exception as e:
        print(f"DB migration warning: {e}")
    finally:
        conn.close()


@app.on_event("startup")
async def startup_event():
    """应用启动时执行"""
    # 确保目录存在
    ensure_directory(UPLOAD_DIR)
    ensure_directory(EXTRACT_DIR)
    ensure_directory(STATIC_DIR)

    # Auto-migrate DB schema (add missing columns)
    database_url = get_database_url()
    _migrate_db_schema(database_url)

    # 初始化数据库（建表 + 兼容旧数据的路径规范化）
    session = get_session(database_url)
    try:
        changed = False
        images = session.exec(select(Image)).all()
        for img in images:
            if img.file_path and img.file_path.startswith("data/"):
                img.file_path = img.file_path[len("data/"):]
                changed = True
            if img.extracted_from and img.extracted_from.startswith("data/"):
                img.extracted_from = img.extracted_from[len("data/"):]
                changed = True
        if changed:
            session.commit()
    finally:
        session.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )