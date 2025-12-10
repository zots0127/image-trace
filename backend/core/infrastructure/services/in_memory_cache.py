from __future__ import annotations

from typing import Dict
from uuid import UUID

from core.domain.services import FeatureCache


class InMemoryFeatureCache(FeatureCache):
    def __init__(self):
        self.storage: Dict[UUID, dict] = {}

    def get_fast(self, image_id: UUID) -> dict | None:
        return self.storage.get(image_id)

    def set_fast(self, image_id: UUID, data: dict) -> None:
        self.storage[image_id] = data

