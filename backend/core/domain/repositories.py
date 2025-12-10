from __future__ import annotations

from typing import Protocol, Sequence
from uuid import UUID

from .entities import AnalysisResult, ImageItem, Project


class ProjectRepository(Protocol):
    def get(self, project_id: UUID) -> Project | None:
        ...

    def exists(self, project_id: UUID) -> bool:
        ...


class ImageRepository(Protocol):
    def list_by_project(self, project_id: UUID) -> Sequence[ImageItem]:
        ...


class AnalysisRepository(Protocol):
    def save(self, result: AnalysisResult) -> AnalysisResult:
        ...

    def update_status(
        self, result_id: UUID, status: str, progress: float, error: str | None = None
    ) -> None:
        ...

