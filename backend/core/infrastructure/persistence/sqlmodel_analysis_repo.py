from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlmodel import select

from app.db import get_session
from app.models import AnalysisResult as AnalysisModel
from core.domain.entities import AnalysisResult, SimilarityMatrix
from core.domain.repositories import AnalysisRepository


def _to_model_payload(result: AnalysisResult) -> AnalysisModel:
    return AnalysisModel(
        id=result.id,
        project_id=result.project_id,
        task_id=str(result.id),
        algorithm_type=result.algorithm_type,
        parameters_json=result.parameters,
        results_json=_similarity_to_json(result.similarity),
        confidence_score=None,
        processing_time_seconds=None,
        status=result.status,
        progress=result.progress,
        error_message=result.error_message,
        completed_at=result.completed_at,
    )


def _similarity_to_json(sim: Optional[SimilarityMatrix]) -> Optional[dict]:
    if sim is None:
        return None
    return {
        "image_ids": [str(x) for x in sim.image_ids],
        "scores": sim.scores,
    }


class SqlModelAnalysisRepository(AnalysisRepository):
    """基于 SQLModel 的分析结果仓储，位于基础设施层。"""

    def save(self, result: AnalysisResult) -> AnalysisResult:
        payload = _to_model_payload(result)
        with get_session() as session:
            existing = session.get(AnalysisModel, result.id)
            if existing:
                for key, value in payload.dict().items():
                    setattr(existing, key, value)
                session.add(existing)
            else:
                session.add(payload)
            session.commit()
            session.refresh(existing or payload)
        return result

    def update_status(
        self, result_id: UUID, status: str, progress: float, error: str | None = None
    ) -> None:
        with get_session() as session:
            row = session.get(AnalysisModel, result_id)
            if not row:
                return
            row.status = status
            row.progress = progress
            if error:
                row.error_message = error
            session.add(row)
            session.commit()

