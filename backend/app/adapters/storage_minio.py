from datetime import datetime
from pathlib import Path
from typing import BinaryIO, Dict, Any
import uuid

from .storage import StorageAdapter
from ..minio_client import storage_service
from ..minio_client import UPLOADS_BUCKET, DOCUMENTS_BUCKET, EXTRACTED_BUCKET, ANALYSIS_BUCKET, TEMP_BUCKET


class MinioStorageAdapter(StorageAdapter):
    """基于现有 storage_service 的适配器，实现统一接口。"""

    def upload(self, file_data: BinaryIO, filename: str, bucket: str, content_type: str) -> Dict[str, Any]:
        # 直接复用 storage_service，保持行为一致
        if bucket == UPLOADS_BUCKET:
            return storage_service.upload_file(file_data=file_data, filename=filename, bucket=bucket, content_type=content_type)
        if bucket == DOCUMENTS_BUCKET:
            return storage_service.upload_document(file_data=file_data, filename=filename, content_type=content_type)
        if bucket == EXTRACTED_BUCKET:
            # 按现有接口需要 document_id 和 image_name，这里使用通用路径
            date_path = datetime.now().strftime('%Y/%m/%d')
            image_name = Path(filename).name or f"{uuid.uuid4()}.jpg"
            return storage_service.upload_extracted_image(
                file_data=file_data,
                document_id="generic",
                image_name=image_name,
                content_type=content_type
            )
        # 默认直接上传
        return storage_service.upload_file(file_data=file_data, filename=filename, bucket=bucket, content_type=content_type)

    def download(self, object_name: str, bucket: str) -> bytes:
        return storage_service.download_file(object_name=object_name, bucket=bucket)

    def delete(self, object_name: str, bucket: str) -> bool:
        return storage_service.delete_file(object_name, bucket)

