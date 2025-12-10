from __future__ import annotations

from typing import Dict, List, Sequence
from uuid import UUID

from core.domain.entities import AnalysisResult, ImageItem, Project
from core.domain.repositories import AnalysisRepository, ImageRepository, ProjectRepository


class InMemoryProjectRepository(ProjectRepository):
    def __init__(self, projects: Dict[UUID, Project]):
        self.projects = projects

    def get(self, project_id: UUID) -> Project | None:
        return self.projects.get(project_id)

    def exists(self, project_id: UUID) -> bool:
        return project_id in self.projects


class InMemoryImageRepository(ImageRepository):
    def __init__(self, images: List[ImageItem]):
        self.images = images

    def list_by_project(self, project_id: UUID) -> Sequence[ImageItem]:
        return [img for img in self.images if img.project_id == project_id]


class InMemoryAnalysisRepository(AnalysisRepository):
    def __init__(self):
        self.results: Dict[UUID, AnalysisResult] = {}

    def save(self, result: AnalysisResult) -> AnalysisResult:
        self.results[result.id] = result
        return result

    def update_status(
        self, result_id: UUID, status: str, progress: float, error: str | None = None
    ) -> None:
        if result_id not in self.results:
            return
        res = self.results[result_id]
        res.status = status
        res.progress = progress
        if error:
            res.error_message = error
        self.results[result_id] = res

