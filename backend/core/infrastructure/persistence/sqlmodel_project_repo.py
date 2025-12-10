from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlmodel import select

from app.db import get_session
from app.models import Project as ProjectModel
from core.domain.entities import Project
from core.domain.repositories import ProjectRepository


class SqlModelProjectRepository(ProjectRepository):
    """基于 SQLModel 的项目仓储，位于基础设施层。"""

    def get(self, project_id: UUID) -> Optional[Project]:
        with get_session() as session:
            row = session.get(ProjectModel, project_id)
            if not row:
                return None
            return Project(
                id=row.id,
                name=row.name,
                description=row.description,
                status=row.status,
            )

    def exists(self, project_id: UUID) -> bool:
        with get_session() as session:
            stmt = select(ProjectModel.id).where(ProjectModel.id == project_id)
            return session.exec(stmt).first() is not None

