from __future__ import annotations

import numpy as np
from uuid import UUID

from core.domain.entities import FeatureVector, SimilarityMatrix
from core.domain.services import SimilarityCalculator


def _hamming(a: list[int], b: list[int]) -> float:
    if not a or not b:
        return 1.0
    size = min(len(a), len(b))
    dist = sum(1 for i in range(size) if a[i] != b[i])
    return dist / float(size)


def _l2(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 1.0
    size = min(len(a), len(b))
    arr_a = np.array(a[:size])
    arr_b = np.array(b[:size])
    return float(np.linalg.norm(arr_a - arr_b) / max(size, 1))


class SimpleSimilarity(SimilarityCalculator):
    def compute(self, ids: list[UUID], features: list[FeatureVector]) -> SimilarityMatrix:
        n = len(features)
        scores = [[0.0 for _ in range(n)] for _ in range(n)]
        for i in range(n):
            for j in range(i, n):
                score = self._pair_score(features[i], features[j])
                scores[i][j] = scores[j][i] = score
        return SimilarityMatrix(image_ids=ids, scores=scores)

    def _pair_score(self, f1: FeatureVector, f2: FeatureVector) -> float:
        color_dist = _l2(f1.avg_color, f2.avg_color)
        ahash_dist = _hamming(f1.ahash, f2.ahash)
        # 简单组合：距离越小相似度越高
        combined = (color_dist + ahash_dist) / 2.0
        similarity = 1.0 / (1.0 + combined)
        return float(round(similarity, 4))

