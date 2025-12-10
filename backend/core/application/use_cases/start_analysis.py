from __future__ import annotations

from typing import List
from uuid import UUID

from core.domain.entities import AnalysisResult, FeatureVector, SimilarityMatrix
from core.domain.repositories import AnalysisRepository, ImageRepository, ProjectRepository
from core.domain.services import Clock, FeatureCache, FeatureExtractor, SimilarityCalculator
from core.application.dto import StartAnalysisRequest


class StartAnalysisUseCase:
    """
    启动分析用例：加载项目图片，计算特征，生成相似度矩阵。
    """

    def __init__(
        self,
        projects: ProjectRepository,
        images: ImageRepository,
        analyses: AnalysisRepository,
        feature_cache: FeatureCache,
        extractor: FeatureExtractor,
        similarity: SimilarityCalculator,
        clock: Clock,
    ):
        self.projects = projects
        self.images = images
        self.analyses = analyses
        self.feature_cache = feature_cache
        self.extractor = extractor
        self.similarity = similarity
        self.clock = clock

    def execute(self, req: StartAnalysisRequest) -> AnalysisResult:
        if not self.projects.exists(req.project_id):
            raise ValueError("project_not_found")

        result = AnalysisResult(
            project_id=req.project_id,
            status="processing",
            progress=0.05,
            parameters=req.parameters,
        )
        result = self.analyses.save(result)

        imgs = list(self.images.list_by_project(req.project_id))
        if not imgs:
            result.status = "completed"
            result.progress = 1.0
            result.completed_at = self.clock.now()
            return self.analyses.save(result)

        features: List[FeatureVector] = []
        errors: List[str] = []

        for idx, img in enumerate(imgs):
            cached = self.feature_cache.get_fast(img.id)
            try:
                if cached:
                    feat = self.extractor.from_cached(cached)
                else:
                    feat = self.extractor.compute(img.id, img.path, req.screenshot_mode)
                    self.feature_cache.set_fast(img.id, feat.to_fast_dict())
                features.append(feat)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"{img.filename}:{exc}")
            progress = (idx + 1) / (len(imgs) + 1)
            self.analyses.update_status(result.id, "processing", progress)

        if not features:
            result.status = "failed"
            result.error_message = "no_features_generated"
            result.errors = errors
            return self.analyses.save(result)

        matrix: SimilarityMatrix = self.similarity.compute(
            [img.id for img in imgs[: len(features)]],
            features,
        )
        result.similarity = matrix
        result.status = "completed"
        result.progress = 1.0
        result.errors = errors
        result.completed_at = self.clock.now()
        return self.analyses.save(result)

