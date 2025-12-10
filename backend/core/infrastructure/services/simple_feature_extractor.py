from __future__ import annotations

import io
from typing import List
from uuid import UUID

import numpy as np
from PIL import Image

from core.domain.entities import FeatureVector
from core.domain.services import FeatureExtractor


def _compute_average_color(path: str) -> List[float]:
    with Image.open(path) as img:
        img = img.convert("RGB")
        arr = np.array(img, dtype=np.float32) / 255.0
        mean_rgb = arr.reshape(-1, 3).mean(axis=0)
        return mean_rgb.tolist()


def _compute_ahash(path: str, size: int = 8) -> List[int]:
    with Image.open(path) as img:
        img = img.convert("L").resize((size, size))
        arr = np.array(img, dtype=np.float32)
        mean = arr.mean()
        bits = (arr > mean).astype(np.uint8).flatten()
        return bits.tolist()


def _compute_descriptors(path: str, take: int = 64) -> List[List[float]]:
    with Image.open(path) as img:
        img = img.convert("L").resize((32, 32))
        arr = np.array(img, dtype=np.float32)
        flat = arr.flatten() / 255.0
        # 切分为小块作为简化描述子，便于测试与比较
        chunk = len(flat) // take if take else len(flat)
        if chunk == 0:
            return [flat.tolist()]
        descriptors = []
        for i in range(0, len(flat), chunk):
            part = flat[i : i + chunk]
            descriptors.append(part.tolist())
            if len(descriptors) >= take:
                break
        return descriptors


class SimpleFeatureExtractor(FeatureExtractor):
    def compute(self, image_id: UUID, path: str, screenshot_mode: bool) -> FeatureVector:
        try:
            avg_color = _compute_average_color(path)
            ahash = _compute_ahash(path)
            descriptors = _compute_descriptors(path)
            return FeatureVector(
                avg_color=avg_color,
                ahash=ahash,
                descriptors=descriptors,
                screenshot_mode=screenshot_mode,
            )
        except Exception as exc:  # noqa: BLE001
            raise ValueError(f"feature_extraction_failed:{exc}") from exc

    def from_cached(self, data: dict) -> FeatureVector:
        return FeatureVector(
            avg_color=data.get("avg_color_features", []),
            ahash=data.get("ahash_features", []),
            descriptors=data.get("descriptors"),
            screenshot_mode=data.get("screenshot_mode", False),
        )

