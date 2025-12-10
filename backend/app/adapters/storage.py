from abc import ABC, abstractmethod
from typing import BinaryIO, Dict, Any


class StorageAdapter(ABC):
    """存储抽象，便于切换 MinIO / 本地等实现。"""

    @abstractmethod
    def upload(self, file_data: BinaryIO, filename: str, bucket: str, content_type: str) -> Dict[str, Any]:
        ...

    @abstractmethod
    def download(self, object_name: str, bucket: str) -> bytes:
        ...

    @abstractmethod
    def delete(self, object_name: str, bucket: str) -> bool:
        ...

