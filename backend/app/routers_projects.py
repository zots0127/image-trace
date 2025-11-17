from typing import List
from uuid import UUID
import json

from fastapi import APIRouter, HTTPException, Response
from sqlmodel import select

from .db import get_session
from .models import Project, ProjectCreate, ProjectRead, Image, AnalysisResult, Document
from .minio_client import storage_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post(
    "",
    response_model=ProjectRead,
    summary="创建新项目",
    description="""
    创建一个新的图片溯源分析项目。

    ## 项目用途：
    - 组织和管理相关的图片和文档
    - 进行批量图片溯源分析
    - 保持分析结果的独立性

    ## 使用方式：
    ```bash
    curl -X POST "http://localhost:8000/projects" \
         -H "Content-Type: application/json" \
         -d '{
           "name": "项目名称",
           "description": "项目描述"
         }'
    ```

    ## 前端使用建议：
    1. 提供项目名称和描述输入框
    2. 创建成功后跳转到项目详情页
    3. 在项目列表中显示创建时间
    4. 提供项目编辑和删除功能
    """
)
def create_project(payload: ProjectCreate) -> ProjectRead:
    with get_session() as session:
        project = Project.from_orm(payload)
        session.add(project)
        session.commit()
        session.refresh(project)
        return project


@router.get(
    "",
    summary="获取项目列表",
    description="""
    获取所有项目的列表，按创建时间倒序排列。

    ## 返回信息：
    - 项目基本信息（名称、描述、状态）
    - 创建和更新时间
    - 项目统计信息（图片数量、文档数量、分析结果数量）

    ## 使用方式：
    ```bash
    curl "http://localhost:8000/projects"
    ```

    ## 前端使用建议：
    1. 显示项目卡片列表
    2. 显示每个项目的图片和文档数量
    3. 提供搜索和排序功能
    4. 显示最近的分析状态
    """
)
def list_projects():
    with get_session() as session:
        projects = session.exec(select(Project).order_by(Project.created_at.desc())).all()
        result = []
        for project in projects:
            # 统计图片数量
            image_count = session.exec(
                select(Image).where(Image.project_id == project.id)
            ).all()
            image_count = len(image_count)
            
            # 统计文档数量
            document_count = session.exec(
                select(Document).where(Document.project_id == project.id)
            ).all()
            document_count = len(document_count)
            
            # 统计分析结果数量
            analysis_count = session.exec(
                select(AnalysisResult).where(AnalysisResult.project_id == project.id)
            ).all()
            analysis_count = len(analysis_count)
            
            # 构建返回数据
            project_data = {
                "id": str(project.id),
                "name": project.name,
                "description": project.description,
                "created_at": project.created_at.isoformat(),
                "updated_at": project.updated_at.isoformat(),
                "image_count": image_count,
                "document_count": document_count,
                "analysis_count": analysis_count,
            }
            result.append(project_data)
        return result


@router.get(
    "/{project_id}",
    summary="获取项目详情",
    description="""
    获取指定项目的详细信息，包括所有图片和分析结果。

    ## 返回信息：
    - 项目基本信息
    - 项目内所有图片列表（包含溯源信息）
    - 分析结果数量统计
    - 公网访问URL

    ## 图片溯源信息：
    每张图片都会包含：
    - 如果来自文档提取：显示原始文档信息
    - 如果直接上传：显示上传信息
    - 公网访问地址

    ## 使用方式：
    ```bash
    curl "http://localhost:8000/projects/PROJECT_ID"
    ```

    ## 前端使用建议：
    1. 项目详情页面的主要数据源
    2. 区分显示直接上传和文档提取的图片
    3. 显示每张图片的溯源信息
    4. 提供图片预览和下载功能
    """
)
def get_project(project_id: UUID) -> dict:
    """获取项目详情，包含图片和分析信息"""
    with get_session() as session:
        project = session.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # 获取项目图片
        images = session.exec(select(Image).where(Image.project_id == project_id)).all()

        # 获取项目分析结果
        analyses = session.exec(select(AnalysisResult).where(AnalysisResult.project_id == project_id)).all()

        # 构建图片列表，包含文档信息
        images_list = []
        for img in images:
            image_data = {
                "id": str(img.id),
                "filename": img.filename,
                "file_size": img.file_size,
                "mime_type": img.mime_type,
                "created_at": img.created_at.isoformat(),
                "public_url": f"/projects/{project_id}/images/{img.id}/file",
                "object_name": img.file_path
            }
            
            # 解析图片元数据，提取文档信息
            if img.image_metadata:
                try:
                    metadata = json.loads(img.image_metadata)
                    if metadata.get("source") == "document_extraction":
                        image_data["document_filename"] = metadata.get("document_filename")
                        image_data["document_id"] = metadata.get("document_id")
                        image_data["source"] = "document"
                except:
                    pass
            
            images_list.append(image_data)

        return {
            "id": str(project.id),
            "name": project.name,
            "description": project.description,
            "status": project.status,
            "created_at": project.created_at.isoformat(),
            "updated_at": project.updated_at.isoformat(),
            "images": images_list,
            "images_count": len(images),
            "analyses_count": len(analyses)
        }


@router.get(
    "/{project_id}/images/",
    summary="获取项目图片列表",
    description="""
    获取指定项目中的所有图片列表，包含溯源信息。

    ## 返回信息：
    - 图片基本信息（文件名、大小、类型）
    - 公网访问URL
    - 溯源元数据（来源文档、提取位置等）
    - 创建时间

    ## 溯源信息类型：
    1. **直接上传图片**: 显示上传信息
    2. **文档提取图片**: 显示文档来源和提取位置

    ## 使用方式：
    ```bash
    curl "http://localhost:8000/projects/PROJECT_ID/images/"
    ```

    ## 前端使用建议：
    1. 图片画廊页面数据源
    2. 按来源分组显示图片
    3. 显示图片的溯源标签
    4. 提供筛选和排序功能
    """
)
def get_project_images(project_id: UUID) -> List[dict]:
    """获取项目的所有图片"""
    with get_session() as session:
        project = session.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        images = session.exec(select(Image).where(Image.project_id == project_id)).all()

        result = []
        for img in images:
            image_data = {
                "id": str(img.id),
                "filename": img.filename,
                "file_size": img.file_size,
                "mime_type": img.mime_type,
                "created_at": img.created_at.isoformat(),
                "public_url": f"/projects/{project_id}/images/{img.id}/file",
                "object_name": img.file_path
            }
            
            # 解析图片元数据，提取文档信息
            if img.image_metadata:
                try:
                    metadata = json.loads(img.image_metadata)
                    if metadata.get("source") == "document_extraction":
                        image_data["document_filename"] = metadata.get("document_filename")
                        image_data["document_id"] = metadata.get("document_id")
                        image_data["source"] = "document"
                except:
                    pass
            
            result.append(image_data)
        
        return result


@router.get("/{project_id}/analyses/")
def get_project_analyses(project_id: UUID) -> List[dict]:
    """获取项目的所有分析结果"""
    with get_session() as session:
        project = session.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        analyses = session.exec(
            select(AnalysisResult).where(AnalysisResult.project_id == project_id)
            .order_by(AnalysisResult.created_at.desc())
        ).all()

        result = []
        for analysis in analyses:
            # 解析results字段（JSON字符串）
            results_data = None
            if analysis.results:
                try:
                    results_data = json.loads(analysis.results)
                except:
                    results_data = None

            # 解析parameters字段
            parameters_data = None
            if analysis.parameters:
                try:
                    parameters_data = json.loads(analysis.parameters)
                except:
                    parameters_data = None

            result.append({
                "id": str(analysis.id),
                "task_id": analysis.task_id,
                "algorithm_type": analysis.algorithm_type,
                "parameters": parameters_data,
                "results": results_data,
                "confidence_score": analysis.confidence_score,
                "processing_time_seconds": analysis.processing_time_seconds,
                "status": analysis.status,
                "error_message": analysis.error_message,
                "created_at": analysis.created_at.isoformat()
            })

        return result


@router.delete("/{project_id}")
def delete_project(project_id: UUID) -> dict:
    """删除项目"""
    with get_session() as session:
        project = session.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        session.delete(project)
        session.commit()
        return {"message": "Project deleted successfully"}


@router.get("/{project_id}/images/{image_id}/file")
def get_image_file(project_id: UUID, image_id: UUID):
    """获取图像文件内容"""
    with get_session() as session:
        # 验证项目存在
        project = session.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # 获取图像记录
        image = session.get(Image, image_id)
        if not image or image.project_id != project_id:
            raise HTTPException(status_code=404, detail="Image not found")

        try:
            # 确定图片来源和存储桶
            bucket = "image-trace-uploads"  # 默认存储桶

            # 检查图片元数据确定是否为文档提取图片
            if image.image_metadata:
                try:
                    import json
                    metadata = json.loads(image.image_metadata)
                    if metadata.get("source") == "document_extraction":
                        bucket = "image-trace-extracted"
                except:
                    pass

            # 从MinIO下载文件
            file_data = storage_service.download_file(
                object_name=image.file_path,
                bucket=bucket
            )

            # 返回文件内容
            # 正确编码文件名以支持中文和特殊字符
            from urllib.parse import quote
            encoded_filename = quote(image.filename)
            
            return Response(
                content=file_data,
                media_type=image.mime_type or "application/octet-stream",
                headers={
                    "Content-Disposition": f"inline; filename*=UTF-8''{encoded_filename}",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET",
                    "Access-Control-Allow-Headers": "*"
                }
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to retrieve image: {str(e)}")
