from __future__ import annotations

import json
import sys
from pathlib import Path
from uuid import UUID

import httpx
import pytest
from fastapi import FastAPI
from httpx import ASGITransport
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.dependencies_analysis import get_start_analysis_use_case
from app.routers_analysis_clean import router as analysis_clean_router
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
from core.infrastructure.services.system_clock import SystemClock


def _load_fixture(name: str) -> dict:
    base = Path(__file__).resolve().parents[1] / "fixtures"
    with open(base / name, "r", encoding="utf-8") as f:
        return json.load(f)


def _prepare_images(tmp_path: Path, fixture: dict) -> list[ImageItem]:
    images = []
    for img_meta in fixture["images"]:
        file_path = tmp_path / Path(img_meta["file_path"]).name
        color = (0, 128, 255) if "doc_page" in img_meta["filename"] else (255, 120, 0)
        if img_meta.get("metadata", {}).get("resolution") == "3840x2160":
            Image.new("RGB", (256, 144), color=color).save(file_path, format="PNG")
        else:
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


def _override_use_case(project_id: UUID, images):
    projects = InMemoryProjectRepository({project_id: Project(id=project_id, name="demo", description=None)})
    image_repo = InMemoryImageRepository(images)
    analysis_repo = InMemoryAnalysisRepository()
    cache = InMemoryFeatureCache()
    extractor = SimpleFeatureExtractor()
    similarity = SimpleSimilarity()
    clock = SystemClock()
    return StartAnalysisUseCase(
        projects=projects,
        images=image_repo,
        analyses=analysis_repo,
        feature_cache=cache,
        extractor=extractor,
        similarity=similarity,
        clock=clock,
    )


@pytest.mark.asyncio
async def test_clean_route_happy(monkeypatch, tmp_path):
    fixture = _load_fixture("analysis_happy.json")
    images = _prepare_images(tmp_path, fixture)
    uc = _override_use_case(UUID(fixture["project_id"]), images)

    test_app = FastAPI()
    test_app.include_router(analysis_clean_router)
    test_app.dependency_overrides[get_start_analysis_use_case] = lambda: uc
    async with httpx.AsyncClient(transport=ASGITransport(app=test_app), base_url="http://testserver") as client:
        resp = await client.post(
            "/analysis/clean/start",
            params={"project_id": fixture["project_id"], "screenshot_mode": False},
            json={"parameters": fixture["parameters"]},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert data["similarity"]["image_ids"] and len(data["similarity"]["scores"]) == 2
    assert data["errors"] == []

    test_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_clean_route_screenshot_mode(monkeypatch, tmp_path):
    fixture = _load_fixture("analysis_large.json")
    images = _prepare_images(tmp_path, fixture)
    uc = _override_use_case(UUID(fixture["project_id"]), images)

    test_app = FastAPI()
    test_app.include_router(analysis_clean_router)
    test_app.dependency_overrides[get_start_analysis_use_case] = lambda: uc
    async with httpx.AsyncClient(transport=ASGITransport(app=test_app), base_url="http://testserver") as client:
        resp = await client.post(
            "/analysis/clean/start",
            params={"project_id": fixture["project_id"], "screenshot_mode": True},
            json={"parameters": fixture["parameters"]},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert data["errors"] == []
    assert data["similarity"]["image_ids"]

    test_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_clean_route_empty_project(monkeypatch, tmp_path):
    project_id = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    uc = _override_use_case(project_id, images=[])

    test_app = FastAPI()
    test_app.include_router(analysis_clean_router)
    test_app.dependency_overrides[get_start_analysis_use_case] = lambda: uc
    async with httpx.AsyncClient(transport=ASGITransport(app=test_app), base_url="http://testserver") as client:
        resp = await client.post(
            "/analysis/clean/start",
            params={"project_id": str(project_id), "screenshot_mode": False},
            json={"parameters": {"mode": "fast"}},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "completed"
    assert data["similarity"] is None

    test_app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_clean_route_project_not_found(tmp_path):
    """
    项目不存在时应返回 404，验证依赖注入的用例错误传播。
    """
    missing_project_id = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

    test_app = FastAPI()
    test_app.include_router(analysis_clean_router)
    # 仓储为空，必然不存在
    def _uc():
        return StartAnalysisUseCase(
            projects=InMemoryProjectRepository({}),
            images=InMemoryImageRepository([]),
            analyses=InMemoryAnalysisRepository(),
            feature_cache=InMemoryFeatureCache(),
            extractor=SimpleFeatureExtractor(),
            similarity=SimpleSimilarity(),
            clock=SystemClock(),
        )

    test_app.dependency_overrides[get_start_analysis_use_case] = _uc

    async with httpx.AsyncClient(transport=ASGITransport(app=test_app), base_url="http://testserver") as client:
        resp = await client.post(
            "/analysis/clean/start",
            params={"project_id": str(missing_project_id), "screenshot_mode": False},
            json={"parameters": {"mode": "fast"}},
        )
    assert resp.status_code == 404
    test_app.dependency_overrides.clear()

