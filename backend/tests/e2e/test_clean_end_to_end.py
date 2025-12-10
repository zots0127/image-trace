from __future__ import annotations

import asyncio
import os
from datetime import datetime
from io import BytesIO
from uuid import uuid4

import httpx
import pytest
from PIL import Image


BASE_URL = os.getenv("E2E_BASE_URL", "").rstrip("/")
RUN_E2E = bool(BASE_URL)


def _make_image(color: tuple[int, int, int], size=(64, 64), fmt="JPEG") -> bytes:
    buf = BytesIO()
    Image.new("RGB", size, color=color).save(buf, format=fmt)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_clean_flow_end_to_end():
    if not RUN_E2E:
        pytest.skip("E2E_BASE_URL 未设置，跳过端到端测试")

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30) as client:
        # 1) 创建项目
        project_name = f"e2e-clean-{datetime.utcnow().isoformat()}"
        resp = await client.post(
            "/projects",
            json={"name": project_name, "description": "e2e clean flow"},
        )
        assert resp.status_code == 200, resp.text
        project_id = resp.json()["id"]

        # 2) 上传两张图片
        img1 = _make_image((255, 120, 0))
        img2 = _make_image((0, 128, 255))
        files = [
            ("files", ("img1.jpg", img1, "image/jpeg")),
            ("files", ("img2.jpg", img2, "image/jpeg")),
        ]
        resp = await client.post(f"/upload/batch", params={"project_id": project_id}, files=files)
        assert resp.status_code == 200, resp.text
        uploaded = resp.json()["files"]
        assert len(uploaded) == 2

        # 3) 启动分析（Clean 路由）
        resp = await client.post(
            "/analysis/clean/start",
            params={"project_id": project_id, "screenshot_mode": False},
            json={"parameters": {"match_percentile": 70}},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["status"] == "completed"
        assert data["similarity"] is not None
        assert data["errors"] == []

        # 4) 再次运行验证缓存/幂等
        resp2 = await client.post(
            "/analysis/clean/start",
            params={"project_id": project_id, "screenshot_mode": False},
            json={"parameters": {"match_percentile": 70}},
        )
        assert resp2.status_code == 200, resp2.text
        data2 = resp2.json()
        assert data2["status"] == "completed"

