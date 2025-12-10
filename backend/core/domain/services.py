from __future__ import annotations

from typing import Protocol, Tuple
from uuid import UUID

from .entities import FeatureVector, SimilarityMatrix


class FeatureExtractor(Protocol):
    def compute(self, image_id: UUID, path: str, screenshot_mode: bool) -> FeatureVector:
        ...

    def from_cached(self, data: dict) -> FeatureVector:
        ...


class SimilarityCalculator(Protocol):
    def compute(self, ids: list[UUID], features: list[FeatureVector]) -> SimilarityMatrix:
        ...


class FeatureCache(Protocol):
    def get_fast(self, image_id: UUID) -> dict | None:
        ...

    def set_fast(self, image_id: UUID, data: dict) -> None:
        ...


class Clock(Protocol):
    def now(self):
        ...

