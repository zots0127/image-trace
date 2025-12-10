from __future__ import annotations

import json
import sys
from pathlib import Path
from uuid import UUID

import pytest
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from core.application.dto import StartAnalysisRequest
from core.application.use_cases.start_analysis import StartAnalysisUseCase
from core.domain.entities import ImageItem, Project
from core.infrastructure.persistence.in_memory_repos import (
    InMemoryAnalysisRepository,
    InMemoryImageRepository,
    InMemoryProjectRepository,
)
from core.infrastructure.services.in_memory_cache import InMemoryFeatureCache
from core.infrastructure.services.simple_feature_extractor import SimpleFeatureExtractor
from core.infrastructure.services.simple_similarity import SimpleSimilarity


class FixedClock:
    def __init__(self, ts):
        self.ts = ts

    def now(self):
        return self.ts


class CountingExtractor(SimpleFeatureExtractor):
    def __init__(self):
        super().__init__()
        self.calls = 0

    def compute(self, image_id: UUID, path: str, screenshot_mode: bool):
        self.calls += 1
        return super().compute(image_id, path, screenshot_mode)


def _load_fixture(name: str) -> dict:
    base = Path(__file__).resolve().parents[1] / "fixtures"
    with open(base / name, "r", encoding="utf-8") as f:
        return json.load(f)


def _prepare_images(tmp_path: Path, fixture: dict) -> list[ImageItem]:
    images = []
    for img_meta in fixture["images"]:
        file_path = tmp_path / Path(img_meta["file_path"]).name
        if img_meta.get("corrupted"):
            file_path.write_bytes(b"not-an-image")
        else:
            color = (0, 128, 255) if "doc_page" in img_meta["filename"] else (255, 120, 0)
            Image.new("RGB", (64, 64), color=color).save(file_path, format="JPEG")

        images.append(
            ImageItem(
                id=UUID(img_meta["id"]),
                project_id=UUID(fixture["project_id"]),
                filename=img_meta["filename"],
                path=str(file_path),
                mime_type=img_meta["mime_type"],
                checksum=img_meta["checksum"],
                metadata=img_meta.get("metadata", {}),
                file_size=img_meta.get("file_size"),
            )
        )
    return images


def _build_use_case(project_id: UUID, images, clock):
    projects = InMemoryProjectRepository({project_id: Project(id=project_id, name="demo", description=None)})
    image_repo = InMemoryImageRepository(images)
    analysis_repo = InMemoryAnalysisRepository()
    cache = InMemoryFeatureCache()
    extractor = SimpleFeatureExtractor()
    similarity = SimpleSimilarity()
    uc = StartAnalysisUseCase(
        projects=projects,
        images=image_repo,
        analyses=analysis_repo,
        feature_cache=cache,
        extractor=extractor,
        similarity=similarity,
        clock=clock,
    )
    return uc, analysis_repo, cache


def test_start_analysis_happy_path(tmp_path):
    fixture = _load_fixture("analysis_happy.json")
    images = _prepare_images(tmp_path, fixture)
    clock = FixedClock(ts="2025-12-08T00:00:00Z")
    uc, repo, _ = _build_use_case(UUID(fixture["project_id"]), images, clock)

    req = StartAnalysisRequest(
        project_id=UUID(fixture["project_id"]),
        screenshot_mode=False,
        parameters=fixture["parameters"],
    )
    result = uc.execute(req)

    assert result.status == "completed"
    assert result.similarity is not None
    assert len(result.similarity.image_ids) == 2
    assert len(result.similarity.scores) == 2
    assert repo.results[result.id].progress == 1.0
    assert result.errors == []


def test_start_analysis_handles_corrupted_and_tiny(tmp_path):
    fixture = _load_fixture("analysis_edge.json")
    images = _prepare_images(tmp_path, fixture)
    clock = FixedClock(ts="2025-12-08T00:00:00Z")
    uc, _, _ = _build_use_case(UUID(fixture["project_id"]), images, clock)

    req = StartAnalysisRequest(
        project_id=UUID(fixture["project_id"]),
        screenshot_mode=True,
        parameters=fixture["parameters"],
    )
    result = uc.execute(req)

    assert result.status == "completed"
    assert result.similarity is not None
    assert len(result.similarity.image_ids) == 1
    assert result.errors  # 至少记录损坏图片错误


def test_cached_fast_features_are_reused(tmp_path):
    fixture = _load_fixture("analysis_happy.json")
    images = _prepare_images(tmp_path, fixture)[:1]
    clock = FixedClock(ts="2025-12-08T00:00:00Z")
    projects = InMemoryProjectRepository({UUID(fixture["project_id"]): Project(id=UUID(fixture["project_id"]), name="demo", description=None)})
    image_repo = InMemoryImageRepository(images)
    analysis_repo = InMemoryAnalysisRepository()
    cache = InMemoryFeatureCache()
    extractor = CountingExtractor()
    similarity = SimpleSimilarity()

    uc = StartAnalysisUseCase(
        projects=projects,
        images=image_repo,
        analyses=analysis_repo,
        feature_cache=cache,
        extractor=extractor,
        similarity=similarity,
        clock=clock,
    )

    req = StartAnalysisRequest(
        project_id=UUID(fixture["project_id"]),
        screenshot_mode=False,
        parameters=fixture["parameters"],
    )

    first = uc.execute(req)
    second = uc.execute(req)

    assert first.status == "completed"
    assert second.status == "completed"
    assert extractor.calls == 1  # 第二次命中缓存未重新计算


def test_screenshot_mode_sets_cache_flag(tmp_path):
    fixture = _load_fixture("analysis_large.json")
    images = _prepare_images(tmp_path, fixture)[:1]
    clock = FixedClock(ts="2025-12-08T00:00:00Z")
    projects = InMemoryProjectRepository({UUID(fixture["project_id"]): Project(id=UUID(fixture["project_id"]), name="demo", description=None)})
    image_repo = InMemoryImageRepository(images)
    analysis_repo = InMemoryAnalysisRepository()
    cache = InMemoryFeatureCache()
    extractor = SimpleFeatureExtractor()
    similarity = SimpleSimilarity()

    uc = StartAnalysisUseCase(
        projects=projects,
        images=image_repo,
        analyses=analysis_repo,
        feature_cache=cache,
        extractor=extractor,
        similarity=similarity,
        clock=clock,
    )

    req = StartAnalysisRequest(
        project_id=UUID(fixture["project_id"]),
        screenshot_mode=True,
        parameters=fixture["parameters"],
    )

    result = uc.execute(req)
    assert result.status == "completed"
    cached = cache.storage[images[0].id]
    assert cached.get("screenshot_mode") is True

