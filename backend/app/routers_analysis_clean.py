from __future__ import annotations

from typing import Any, Dict, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies_analysis import get_start_analysis_use_case
from core.application.dto import StartAnalysisRequest
from core.application.use_cases.start_analysis import StartAnalysisUseCase


router = APIRouter(
    prefix="/analysis/clean",
    tags=["analysis"],
)


@router.post(
    "/start",
    summary="启动分析（Clean Architecture 流程）",
    description="""
    通过用例层启动分析，使用 Redis 缓存 + SQLModel 仓储。
    - 支持 screenshot_mode
    - 返回相似度矩阵和错误列表
    """,
)
def start_analysis(
    project_id: UUID,
    screenshot_mode: bool = False,
    parameters: Optional[Dict[str, Any]] = None,
    use_case: StartAnalysisUseCase = Depends(get_start_analysis_use_case),
):
    try:
        req = StartAnalysisRequest(
            project_id=project_id,
            screenshot_mode=screenshot_mode,
            parameters=parameters or {},
        )
        result = use_case.execute(req)
        return {
            "id": str(result.id),
            "project_id": str(result.project_id),
            "status": result.status,
            "progress": result.progress,
            "errors": result.errors,
            "similarity": (
                {
                    "image_ids": [str(x) for x in result.similarity.image_ids],
                    "scores": result.similarity.scores,
                }
                if result.similarity
                else None
            ),
            "completed_at": result.completed_at,
        }
    except ValueError as e:
        if "project_not_found" in str(e):
            raise HTTPException(status_code=404, detail="Project not found")
        raise

