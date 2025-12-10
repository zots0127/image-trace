from __future__ import annotations

from functools import lru_cache

from core.application.use_cases.start_analysis import StartAnalysisUseCase
from core.infrastructure.persistence.sqlmodel_project_repo import SqlModelProjectRepository
from core.infrastructure.persistence.sqlmodel_image_repo import SqlModelImageRepository
from core.infrastructure.persistence.sqlmodel_analysis_repo import SqlModelAnalysisRepository
from core.infrastructure.services.redis_feature_cache import RedisFeatureCache
from core.infrastructure.services.simple_feature_extractor import SimpleFeatureExtractor
from core.infrastructure.services.simple_similarity import SimpleSimilarity
from core.infrastructure.services.system_clock import SystemClock
from app.config import settings


@lru_cache()
def get_start_analysis_use_case() -> StartAnalysisUseCase:
    """
    DI 入口：为 FastAPI 控制器提供用例实例。
    可按需替换缓存、特征、相似度实现。
    """
    return StartAnalysisUseCase(
        projects=SqlModelProjectRepository(),
        images=SqlModelImageRepository(),
        analyses=SqlModelAnalysisRepository(),
        feature_cache=RedisFeatureCache(settings.redis_url),
        extractor=SimpleFeatureExtractor(),
        similarity=SimpleSimilarity(),
        clock=SystemClock(),
    )

