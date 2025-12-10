from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field
try:
    from pydantic_settings import BaseSettings, SettingsConfigDict
except Exception:  # pragma: no cover
    from pydantic import BaseModel

    class BaseSettings(BaseModel):
        """Fallback for environments未安装 pydantic-settings（测试用）"""

    class SettingsConfigDict(dict):
        def __init__(self, **kwargs):
            super().__init__(**kwargs)


class Settings(BaseSettings):
    """集中管理配置，便于不同环境统一加载。"""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str = Field("sqlite:///./image_trace.db")
    redis_url: str = Field("redis://localhost:6379/1")

    minio_endpoint: str = Field("localhost:9000")
    minio_access_key: str = Field("minioadmin")
    minio_secret_key: str = Field("minioadmin123")
    minio_secure: bool = Field(False)

    public_base_url: str = Field("http://127.0.0.1:8000")

    supabase_url: Optional[str] = Field(None)
    supabase_key: Optional[str] = Field(None)

    # 本地回退目录：MinIO 不可用时使用
    local_data_dir: Path = Field(default_factory=lambda: Path(__file__).resolve().parents[2] / "data")

    # 上传限制与白名单
    upload_max_bytes: int = Field(20 * 1024 * 1024)  # 默认 20MB
    allowed_image_mime: list[str] = Field(
        default_factory=lambda: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/bmp",
            "image/gif",
            "image/tiff",
        ]
    )
    allowed_document_mime: list[str] = Field(
        default_factory=lambda: [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/msword",
            "application/vnd.ms-powerpoint",
        ]
    )

    # 鉴权开关（例如跳过或强制校验，可根据环境调整）
    auth_required: bool = Field(default=True)


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

