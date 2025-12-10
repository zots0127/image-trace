from __future__ import annotations

from typing import Sequence
from uuid import UUID

from sqlmodel import select

from app.db import get_session
from app.models import Image as ImageModel
from core.domain.entities import ImageItem
from core.domain.repositories import ImageRepository


def _parse_metadata(row: ImageModel):
    metadata = {}
    if getattr(row, "image_metadata_json", None):
        metadata = row.image_metadata_json or {}
    elif row.image_metadata:
        try:
            import json

            metadata = json.loads(row.image_metadata)
        except Exception:
            metadata = {"raw": row.image_metadata}
    return metadata or {}


class SqlModelImageRepository(ImageRepository):
    """基于 SQLModel 的图片仓储，位于基础设施层。"""

    def list_by_project(self, project_id: UUID) -> Sequence[ImageItem]:
        with get_session() as session:
            rows = session.exec(select(ImageModel).where(ImageModel.project_id == project_id)).all()
            return [
                ImageItem(
                    id=row.id,
                    project_id=row.project_id,
                    filename=row.filename,
                    path=row.file_path,
                    mime_type=row.mime_type or "application/octet-stream",
                    checksum=row.checksum or "",
                    metadata=_parse_metadata(row),
                    file_size=row.file_size,
                )
                for row in rows
            ]

