from typing import List
from uuid import UUID
import io
import os

from fastapi import APIRouter, File, HTTPException, UploadFile

from .db import get_session
from .models import Image
from .minio_client import storage_service

# 获取公网基础URL
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://127.0.0.1:8000")

router = APIRouter(prefix="/upload", tags=["upload"])


@router.post("/batch")
async def upload_batch(
    project_id: UUID,
    files: List[UploadFile] = File(...),
) -> dict:
    """批量上传文件到MinIO存储"""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    saved_files: list[dict] = []
    with get_session() as session:
        for file in files:
            try:
                # 读取文件内容
                content = await file.read()
                file_stream = io.BytesIO(content)

                # 上传到MinIO
                upload_result = storage_service.upload_file(
                    file_data=file_stream,
                    filename=file.filename,
                    content_type=file.content_type or "application/octet-stream"
                )

                # 保存到数据库
                image = Image(
                    project_id=project_id,
                    filename=file.filename,
                    file_path=upload_result["object_name"],  # 存储MinIO对象名
                    file_size=upload_result["size"],
                    mime_type=file.content_type,
                    checksum=upload_result.get("etag"),
                    image_metadata=None,
                )
                session.add(image)
                session.commit()
                session.refresh(image)

                saved_files.append(
                    {
                        "id": str(image.id),
                        "filename": image.filename,
                        "file_size": image.file_size,
                        "mime_type": image.mime_type,
                        "public_url": f"{PUBLIC_BASE_URL}/projects/{project_id}/images/{image.id}/file",  # 动态公网访问URL
                        "object_name": upload_result["object_name"],
                        "bucket": upload_result["bucket"]
                    }
                )

            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to upload file {file.filename}: {str(e)}"
                )

    return {
        "project_id": str(project_id),
        "files": saved_files,
        "message": f"Successfully uploaded {len(saved_files)} files to MinIO"
    }


@router.get("/image/{image_id}/url")
def get_image_public_url(image_id: UUID):
    """获取图片的公网访问URL"""
    with get_session() as session:
        image = session.get(Image, image_id)
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")

        # 生成公网访问URL
        public_url = f"/projects/{image.project_id}/images/{image.id}/file"

        return {
            "id": str(image.id),
            "filename": image.filename,
            "public_url": public_url,
            "object_name": image.file_path,
            "file_size": image.file_size,
            "mime_type": image.mime_type
        }
