from typing import List
from uuid import UUID
import io
import json
import hashlib

from fastapi import APIRouter, File, HTTPException, UploadFile, BackgroundTasks
from sqlmodel import Session, select

from .db import get_session
from .models import Document, ExtractedImage, Image
from .minio_client import storage_service
from .document_processor import document_processor

router = APIRouter(prefix="/documents", tags=["documents"])


def process_document_images(document_id: UUID, project_id: UUID, file_data: bytes, filename: str, content_type: str):
    """后台处理文档图片提取的任务"""
    try:
        with get_session() as session:
            # 获取文档记录
            document = session.get(Document, document_id)
            if not document:
                print(f"Document {document_id} not found")
                return

            # 提取图片
            extraction_result = document_processor.extract_images(file_data, filename, content_type)

            if not extraction_result['success']:
                # 更新文档状态为失败
                document.processing_status = "failed"
                document.document_metadata = json.dumps({
                    "error": extraction_result['error'],
                    "format": extraction_result.get('format', 'unknown')
                })
                session.commit()
                print(f"Failed to extract images from document {document_id}: {extraction_result['error']}")
                return

            # 更新文档元数据和状态
            metadata = extraction_result['metadata']
            metadata['extraction_info'] = {
                'total_images': extraction_result['image_count'],
                'processed_at': str(document.created_at)
            }
            document.document_metadata = json.dumps(metadata)
            document.processing_status = "completed"
            document.extracted_image_count = extraction_result['image_count']

            # 保存提取的图片
            extracted_images = []
            for idx, (img_data, extraction_metadata) in enumerate(extraction_result['images']):
                try:
                    # 生成图片文件名
                    ext = "jpg"
                    if extraction_metadata.get('extraction_method') == 'pymupdf_embedded':
                        ext = "png"

                    img_filename = f"extracted_{idx+1:03d}.{ext}"

                    # 上传到MinIO
                    upload_result = storage_service.upload_extracted_image(
                        file_data=io.BytesIO(img_data),
                        document_id=str(document_id),
                        image_name=img_filename,
                        content_type=f"image/{ext}"
                    )

                    # 创建提取的图片记录
                    img_checksum = hashlib.sha256(img_data).hexdigest()
                    extracted_image = ExtractedImage(
                        document_id=document_id,
                        project_id=project_id,
                        filename=img_filename,
                        file_path=upload_result["object_name"],
                        file_size=upload_result["size"],
                        mime_type=f"image/{ext}",
                        checksum=img_checksum,
                        extraction_metadata=json.dumps(extraction_metadata)
                    )
                    session.add(extracted_image)

                    # 同时在主Image表中创建记录，用于溯源分析
                    main_image = Image(
                        project_id=project_id,
                        filename=f"{document.filename}_{img_filename}",
                        file_path=upload_result["object_name"],
                        file_size=upload_result["size"],
                        mime_type=f"image/{ext}",
                        checksum=img_checksum,
                        image_metadata=json.dumps({
                            "source": "document_extraction",
                            "document_id": str(document_id),
                            "document_filename": document.filename,
                            "document_checksum": document.checksum,
                            "extraction_metadata": extraction_metadata
                        })
                    )
                    session.add(main_image)
                    session.flush()  # 获取ID

                    extracted_image.image_id = main_image.id
                    extracted_images.append({
                        "id": str(extracted_image.id),
                        "filename": img_filename,
                        "file_size": upload_result["size"],
                        "public_url": upload_result.get("local_url", ""),
                        "extraction_metadata": extraction_metadata
                    })

                except Exception as e:
                    print(f"Failed to save extracted image {idx}: {e}")
                    continue

            session.commit()

            print(f"Successfully processed document {document_id}, extracted {len(extracted_images)} images")

    except Exception as e:
        print(f"Error processing document images for {document_id}: {e}")
        try:
            with get_session() as session:
                document = session.get(Document, document_id)
                if document:
                    document.processing_status = "failed"
                    session.commit()
        except:
            pass


@router.post(
    "/upload",
    summary="上传文档并自动提取图片",
    description="""
    上传文档文件到指定项目，系统会自动在后台提取文档中的所有图片。

    ## 支持的文档格式：
    - **PDF**: `.pdf` - 提取嵌入图片和渲染页面为图片
    - **Word文档**: `.docx` - 提取文档中的所有图片
    - **PowerPoint**: `.pptx` - 提取幻灯片中的图片
    - **旧格式**: `.doc`, `.ppt` - 基础支持

    ## 处理流程：
    1. 上传文档到存储系统
    2. 后台自动提取图片
    3. 提取的图片添加到项目中
    4. 保存完整的溯源关系

    ## 溯源信息：
    每个提取的图片都会保存：
    - 原始文档ID和文件名
    - 提取位置（页码、图片序号）
    - 提取方法和尺寸信息
    - 与原始文档的关联关系

    ## 使用方式：
    ```bash
    curl -X POST "http://localhost:8000/documents/upload?project_id=PROJECT_ID" \
         -H "Content-Type: multipart/form-data" \
         -F "file=@document.pdf"
    ```

    ## 注意事项：
    - 文档处理在后台进行，需要轮询状态检查完成情况
    - 大文件处理时间较长，请耐心等待
    - 提取的图片会自动转换为JPEG格式以节省空间
    """
)
async def upload_document(
    project_id: UUID,
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks()
) -> dict:
    """上传文档文件并提取图片"""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")

    # 检查文件类型
    supported_types = list(document_processor.SUPPORTED_FORMATS.keys())
    if file.content_type not in supported_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Supported types: {supported_types}"
        )

    try:
        # 读取文件内容
        content = await file.read()
        file_stream = io.BytesIO(content)

        doc_checksum = hashlib.sha256(content).hexdigest()

        # 上传文档到MinIO
        upload_result = storage_service.upload_document(
            file_data=file_stream,
            filename=file.filename,
            content_type=file.content_type or "application/octet-stream"
        )

        # 保存文档记录到数据库
        document = Document(
            project_id=project_id,
            filename=file.filename,
            file_path=upload_result["object_name"],
            file_size=upload_result["size"],
            mime_type=file.content_type,
            checksum=doc_checksum,
            processing_status="pending"  # 设置为待处理状态
        )

        with get_session() as session:
            session.add(document)
            session.commit()
            session.refresh(document)

            # 添加后台任务处理图片提取
            background_tasks.add_task(
                process_document_images,
                document_id=document.id,
                project_id=project_id,
                file_data=content,
                filename=file.filename,
                content_type=file.content_type
            )

        return {
            "id": str(document.id),
            "project_id": str(project_id),
            "filename": document.filename,
            "file_size": document.file_size,
            "mime_type": document.mime_type,
            "processing_status": document.processing_status,
            "public_url": upload_result.get("local_url", ""),
            "message": "Document uploaded successfully. Image extraction started in background."
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload document: {str(e)}"
        )


@router.get(
    "/{document_id}",
    summary="获取文档详细信息",
    description="""
    获取指定文档的详细信息，包括处理状态和提取的图片数量。

    ## 返回信息：
    - 文档基本信息（文件名、大小、类型）
    - 处理状态（pending/completed/failed）
    - 提取的图片数量
    - 文档元数据（页数、作者、创建时间等）
    - 公网访问URL

    ## 处理状态说明：
    - **pending**: 正在处理中
    - **completed**: 处理完成，所有图片已提取
    - **failed**: 处理失败，检查metadata中的错误信息

    ## 使用方式：
    ```bash
    curl "http://localhost:8000/documents/DOCUMENT_ID"
    ```
    """
)
def get_document(document_id: UUID) -> dict:
    """获取文档信息"""
    with get_session() as session:
        document = session.get(Document, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # 生成公网访问URL
        public_url = f"https://sotrages.0.af/image-trace-documents/{document.file_path}"

        result = {
            "id": str(document.id),
            "project_id": str(document.project_id),
            "filename": document.filename,
            "file_size": document.file_size,
            "mime_type": document.mime_type,
            "checksum": document.checksum,
            "processing_status": document.processing_status,
            "extracted_image_count": document.extracted_image_count,
            "public_url": public_url,
            "created_at": document.created_at.isoformat(),
            "updated_at": document.updated_at.isoformat()
        }

        # 解析文档元数据
        if document.document_metadata:
            try:
                result["metadata"] = json.loads(document.document_metadata)
            except:
                result["metadata"] = {"raw": document.document_metadata}

        return result


@router.get(
    "/{document_id}/extracted-images",
    summary="获取文档提取的图片列表",
    description="""
    获取指定文档中所有提取的图片列表，包含完整的溯源信息。

    ## 返回信息：
    - 每张图片的基本信息（文件名、大小、类型）
    - 公网访问URL
    - 提取元数据（页码、位置、提取方法等）
    - 与主图片表的关联ID

    ## 溯源链路：
    ```
    原始文档 → 提取记录 → 主图片表 → 分析结果
    ```

    ## 提取元数据示例：
    ```json
    {
      "source_page": 1,
      "image_index": 3,
      "extraction_method": "pymupdf_embedded",
      "width": 800,
      "height": 600,
      "processed_size": 45678
    }
    ```

    ## 使用方式：
    ```bash
    curl "http://localhost:8000/documents/DOCUMENT_ID/extracted-images"
    ```

    ## 前端使用建议：
    1. 显示图片缩略图
    2. 显示提取位置信息（如：第1页，第3张图）
    3. 提供点击查看大图功能
    4. 显示溯源信息（来源文档）
    """
)
def get_extracted_images(document_id: UUID) -> dict:
    """获取文档中提取的图片列表"""
    with get_session() as session:
        document = session.get(Document, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # 查询提取的图片
        extracted_images = session.exec(
            select(ExtractedImage).where(ExtractedImage.document_id == document_id)
        ).all()

        images_list = []
        for img in extracted_images:
            public_url = f"https://sotrages.0.af/image-trace-extracted/{img.file_path}"

            image_data = {
                "id": str(img.id),
                "filename": img.filename,
                "file_size": img.file_size,
                "mime_type": img.mime_type,
                "public_url": public_url,
                "created_at": img.created_at.isoformat()
            }

            # 解析提取元数据
            if img.extraction_metadata:
                try:
                    image_data["extraction_metadata"] = json.loads(img.extraction_metadata)
                except:
                    image_data["extraction_metadata"] = {"raw": img.extraction_metadata}

            images_list.append(image_data)

        return {
            "document_id": str(document_id),
            "document_filename": document.filename,
            "processing_status": document.processing_status,
            "total_images": len(images_list),
            "images": images_list
        }


@router.get(
    "/project/{project_id}",
    summary="获取项目文档列表",
    description="""
    获取指定项目中的所有文档列表，用于项目管理界面。

    ## 返回信息：
    - 项目内所有文档的基本信息
    - 每个文档的处理状态
    - 提取图片数量统计
    - 公网访问URL

    ## 使用场景：
    - 项目管理页面显示所有文档
    - 统计项目中的文档数量
    - 监控文档处理状态

    ## 使用方式：
    ```bash
    curl "http://localhost:8000/documents/project/PROJECT_ID"
    ```

    ## 前端使用建议：
    1. 按处理状态分组显示
    2. 显示处理进度条
    3. 提供重新处理失败文档的功能
    4. 显示每个文档的提取图片数量
    """
)
def get_project_documents(project_id: UUID) -> dict:
    """获取项目中的所有文档"""
    with get_session() as session:
        documents = session.exec(
            select(Document).where(Document.project_id == project_id)
        ).all()

        documents_list = []
        for doc in documents:
            public_url = f"https://sotrages.0.af/image-trace-documents/{doc.file_path}"

            doc_data = {
                "id": str(doc.id),
                "filename": doc.filename,
                "file_size": doc.file_size,
                "mime_type": doc.mime_type,
                "processing_status": doc.processing_status,
                "extracted_image_count": doc.extracted_image_count,
                "public_url": public_url,
                "created_at": doc.created_at.isoformat(),
                "updated_at": doc.updated_at.isoformat()
            }
            documents_list.append(doc_data)

        return {
            "project_id": str(project_id),
            "total_documents": len(documents_list),
            "documents": documents_list
        }


@router.delete(
    "/{document_id}",
    summary="删除文档和关联图片",
    description="""
    删除指定文档及其所有提取的图片，包括：
    - 原始文档文件
    - 所有提取的图片文件
    - 数据库中的相关记录
    - 关联的分析结果

    ## 清理范围：
    1. MinIO存储中的文档文件
    2. MinIO存储中的提取图片
    3. Document表记录
    4. ExtractedImage表记录
    5. Image表中的关联记录

    ## 注意事项：
    - 删除操作不可恢复
    - 会同时删除所有提取的图片
    - 如果图片已被用于分析，分析结果仍保留

    ## 使用方式：
    ```bash
    curl -X DELETE "http://localhost:8000/documents/DOCUMENT_ID"
    ```

    ## 前端使用建议：
    1. 添加删除确认对话框
    2. 显示将要删除的内容列表
    3. 提供批量删除功能
    4. 删除后刷新项目统计
    """
)
def delete_document(document_id: UUID) -> dict:
    """删除文档及其提取的图片"""
    with get_session() as session:
        document = session.get(Document, document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        try:
            # 删除提取的图片记录
            extracted_images = session.exec(
                select(ExtractedImage).where(ExtractedImage.document_id == document_id)
            ).all()

            for img in extracted_images:
                # 删除关联的Image记录
                if img.image_id:
                    main_image = session.get(Image, img.image_id)
                    if main_image:
                        session.delete(main_image)

                # 从MinIO删除提取的图片文件
                from .minio_client import EXTRACTED_BUCKET, DOCUMENTS_BUCKET
                storage_service.delete_file(img.file_path, EXTRACTED_BUCKET)

                session.delete(img)

            # 从MinIO删除文档文件
            storage_service.delete_file(document.file_path, DOCUMENTS_BUCKET)

            # 删除文档记录
            session.delete(document)
            session.commit()

            return {
                "message": f"Document {document.filename} and its extracted images deleted successfully"
            }

        except Exception as e:
            session.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete document: {str(e)}"
            )
@router.get("/hash/{checksum}")
def get_documents_by_hash(checksum: str) -> dict:
    with get_session() as session:
        documents = session.exec(select(Document).where(Document.checksum == checksum)).all()
        return {
            "checksum": checksum,
            "count": len(documents),
            "documents": [
                {
                    "id": str(doc.id),
                    "project_id": str(doc.project_id),
                    "filename": doc.filename,
                    "file_size": doc.file_size,
                    "mime_type": doc.mime_type,
                    "checksum": doc.checksum,
                    "processing_status": doc.processing_status,
                    "extracted_image_count": doc.extracted_image_count,
                    "created_at": doc.created_at.isoformat(),
                    "updated_at": doc.updated_at.isoformat()
                }
                for doc in documents
            ]
        }
