import os
from dotenv import load_dotenv
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, BinaryIO, Dict, Any

from minio import Minio
from minio.error import S3Error

# 加载环境变量
load_dotenv()

# MinIO配置
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin123")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

# 公网访问URL配置
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "http://127.0.0.1:8000")

# 存储桶名称
UPLOADS_BUCKET = "image-trace-uploads"
DOCUMENTS_BUCKET = "image-trace-documents"
EXTRACTED_BUCKET = "image-trace-extracted"
ANALYSIS_BUCKET = "image-trace-analysis"
TEMP_BUCKET = "image-trace-temp"

class MinIOStorageService:
    """MinIO存储服务"""

    def __init__(self):
        self.client = Minio(
            endpoint=MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_SECURE
        )
        self._available = False
        self._ensure_buckets()

    def _ensure_buckets(self):
        """确保必要的存储桶存在"""
        try:
            # Test connection
            self.client.list_buckets()
            self._available = True
            buckets = [UPLOADS_BUCKET, DOCUMENTS_BUCKET, EXTRACTED_BUCKET, ANALYSIS_BUCKET, TEMP_BUCKET]
            for bucket in buckets:
                if not self.client.bucket_exists(bucket):
                    self.client.make_bucket(bucket)
                    print(f"Created bucket: {bucket}")
        except Exception as e:
            print(f"Warning: MinIO not available: {e}")
            self._available = False

    def upload_file(
        self,
        file_data: BinaryIO,
        filename: str,
        bucket: str = UPLOADS_BUCKET,
        content_type: str = "application/octet-stream"
    ) -> Dict[str, Any]:
        """
        上传文件到MinIO

        Args:
            file_data: 文件数据流
            filename: 文件名
            bucket: 存储桶名称
            content_type: 文件类型

        Returns:
            包含文件信息的字典
        """
        if not self._available:
            raise Exception("MinIO storage service is not available")

        try:
            # 生成唯一的对象名称
            file_extension = Path(filename).suffix
            object_name = f"{datetime.now().strftime('%Y/%m/%d')}/{uuid.uuid4()}{file_extension}"

            # 读取文件数据以获取大小
            file_data.seek(0, 2)  # 移动到文件末尾
            file_size = file_data.tell()  # 获取文件大小
            file_data.seek(0)  # 重置到文件开头

            # 上传文件
            result = self.client.put_object(
                bucket_name=bucket,
                object_name=object_name,
                data=file_data,
                length=file_size,
                part_size=10*1024*1024,  # 10MB分块
                content_type=content_type
            )

            # 不在这里生成公网URL，由API层根据需要生成

            return {
                "object_name": object_name,
                "bucket": bucket,
                "size": file_size,
                "etag": result.etag if hasattr(result, 'etag') else None,
                "local_url": f"http://{MINIO_ENDPOINT}/{bucket}/{object_name}"
            }

        except S3Error as e:
            raise Exception(f"Failed to upload file: {e}")

    def upload_document(
        self,
        file_data: BinaryIO,
        filename: str,
        content_type: str = "application/octet-stream"
    ) -> Dict[str, Any]:
        """
        上传文档文件到MinIO

        Args:
            file_data: 文件数据流
            filename: 文件名
            content_type: 文件类型

        Returns:
            包含文件信息的字典
        """
        return self.upload_file(
            file_data=file_data,
            filename=filename,
            bucket=DOCUMENTS_BUCKET,
            content_type=content_type
        )

    def upload_extracted_image(
        self,
        file_data: BinaryIO,
        document_id: str,
        image_name: str,
        content_type: str = "image/jpeg"
    ) -> Dict[str, Any]:
        """
        上传从文档提取的图片到MinIO

        Args:
            file_data: 图片数据流
            document_id: 文档ID
            image_name: 图片名称 (如 page_001.jpg)
            content_type: 图片类型

        Returns:
            包含文件信息的字典
        """
        try:
            # 生成基于文档ID的对象路径
            date_path = datetime.now().strftime('%Y/%m/%d')
            object_name = f"{date_path}/{document_id}/{image_name}"

            # 读取文件数据以获取大小
            file_data.seek(0, 2)
            file_size = file_data.tell()
            file_data.seek(0)

            # 上传文件
            result = self.client.put_object(
                bucket_name=EXTRACTED_BUCKET,
                object_name=object_name,
                data=file_data,
                length=file_size,
                part_size=10*1024*1024,
                content_type=content_type
            )

            # 不在这里生成公网URL，由API层根据需要生成

            return {
                "object_name": object_name,
                "bucket": EXTRACTED_BUCKET,
                "size": file_size,
                "etag": result.etag if hasattr(result, 'etag') else None,
                "local_url": f"http://{MINIO_ENDPOINT}/{EXTRACTED_BUCKET}/{object_name}"
            }

        except S3Error as e:
            raise Exception(f"Failed to upload extracted image: {e}")

    def get_file_url(
        self,
        object_name: str,
        bucket: str = UPLOADS_BUCKET,
        expires: timedelta = timedelta(hours=1)
    ) -> str:
        """
        获取文件的预签名URL

        Args:
            object_name: 对象名称
            bucket: 存储桶名称
            expires: 过期时间

        Returns:
            预签名URL
        """
        try:
            return self.client.presigned_get_object(
                bucket_name=bucket,
                object_name=object_name,
                expires=expires
            )
        except S3Error as e:
            raise Exception(f"Failed to generate URL: {e}")

    def download_file(
        self,
        object_name: str,
        bucket: str = UPLOADS_BUCKET
    ) -> bytes:
        """
        下载文件

        Args:
            object_name: 对象名称
            bucket: 存储桶名称

        Returns:
            文件数据
        """
        try:
            response = self.client.get_object(bucket, object_name)
            return response.read()
        except S3Error as e:
            raise Exception(f"Failed to download file: {e}")

    def delete_file(
        self,
        object_name: str,
        bucket: str = UPLOADS_BUCKET
    ) -> bool:
        """
        删除文件

        Args:
            object_name: 对象名称
            bucket: 存储桶名称

        Returns:
            是否成功删除
        """
        try:
            self.client.remove_object(bucket, object_name)
            return True
        except S3Error as e:
            print(f"Failed to delete file: {e}")
            return False

    def list_files(
        self,
        bucket: str = UPLOADS_BUCKET,
        prefix: str = ""
    ) -> list:
        """
        列出存储桶中的文件

        Args:
            bucket: 存储桶名称
            prefix: 前缀过滤

        Returns:
            文件列表
        """
        try:
            objects = self.client.list_objects(bucket, prefix=prefix)
            return [
                {
                    "object_name": obj.object_name,
                    "size": obj.size or 0,
                    "last_modified": obj.last_modified,
                    "etag": obj.etag
                }
                for obj in objects
            ]
        except S3Error as e:
            raise Exception(f"Failed to list files: {e}")

    def get_bucket_info(self, bucket: str = UPLOADS_BUCKET) -> Dict[str, Any]:
        """
        获取存储桶信息

        Args:
            bucket: 存储桶名称

        Returns:
            存储桶信息
        """
        try:
            # 获取存储桶统计信息
            files = self.list_files(bucket)
            total_size = sum(f["size"] for f in files if f["size"] is not None)

            return {
                "bucket": bucket,
                "file_count": len(files),
                "total_size": total_size,
                "total_size_mb": round(total_size / (1024 * 1024), 2)
            }
        except S3Error as e:
            raise Exception(f"Failed to get bucket info: {e}")

    def cleanup_temp_files(self, older_than_hours: int = 24) -> int:
        """
        清理过期的临时文件

        Args:
            older_than_hours: 清理多少小时前的文件

        Returns:
            清理的文件数量
        """
        try:
            cutoff_time = datetime.now() - timedelta(hours=older_than_hours)
            deleted_count = 0

            objects = self.client.list_objects(TEMP_BUCKET)
            for obj in objects:
                if obj.last_modified.replace(tzinfo=None) < cutoff_time:
                    try:
                        self.client.remove_object(TEMP_BUCKET, obj.object_name)
                        deleted_count += 1
                    except S3Error:
                        pass

            return deleted_count
        except S3Error as e:
            raise Exception(f"Failed to cleanup temp files: {e}")

# 全局存储服务实例
storage_service = MinIOStorageService()