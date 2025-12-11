import os
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
from .image_processor import compute_image_features, is_image_file
from .image_processor import draw_feature_matches
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


@app.post("/upload")
async def upload_file(
    project_id: int = Form(...),
    file: UploadFile = File(...),
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
    background_tasks: BackgroundTasks = BackgroundTasks(),
    session: Session = Depends(get_db)
):
    """
    比对项目中的所有图像

    Args:
        project_id: 项目ID
        threshold: 相似度阈值 (0-1)
        hash_type: 哈希类型 (phash/dhash/ahash/whash)

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

    if hash_type not in ['orb', 'brisk', 'sift']:
        raise HTTPException(status_code=400, detail="不支持的哈希类型")

    try:
        # 执行比对
        result = compare_images_in_project(session, project_id, threshold, hash_type)
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
    return await compare_project_images(project_id, threshold, hash_type, BackgroundTasks(), session)


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
    descriptor_algos = ['orb', 'brisk', 'sift']
    algo = hash_type
    if algo not in descriptor_algos:
        raise HTTPException(status_code=400, detail="该算法不支持特征点可视化")

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

    # 删除文件
    try:
        fp = image.file_path or ""
        # 兼容旧数据：data/uploads/xxx
        if fp.startswith("data/"):
            fp = fp[len("data/"):]
        if fp:
            (STATIC_DIR / fp).unlink(missing_ok=True)
    except Exception:
        pass  # 忽略文件删除错误

    # 删除数据库记录
    session.delete(image)
    session.commit()

    return {"message": "图像已删除"}


@app.get("/health")
async def health_check():
    """健康检查"""
    return {
        "status": "healthy",
        "version": "2.0.0"
    }


# 启动事件
@app.on_event("startup")
async def startup_event():
    """应用启动时执行"""
    # 确保目录存在
    ensure_directory(UPLOAD_DIR)
    ensure_directory(EXTRACT_DIR)
    ensure_directory(STATIC_DIR)

    # 初始化数据库（建表 + 兼容旧数据的路径规范化）
    database_url = get_database_url()
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