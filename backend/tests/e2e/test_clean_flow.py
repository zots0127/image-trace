from __future__ import annotations

import io
import os
import uuid

import pytest
import httpx
from PIL import Image


RUN_E2E = os.getenv("RUN_E2E") == "1"
BASE_URL = os.getenv("E2E_BASE_URL", "http://127.0.0.1:8000")


pytestmark = [
    pytest.mark.asyncio,
    pytest.mark.skipif(not RUN_E2E, reason="Set RUN_E2E=1 to run live E2E tests"),
]


def _make_image_bytes(color: tuple[int, int, int] = (255, 120, 0), size=(96, 96)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color=color).save(buf, format="JPEG")
    return buf.getvalue()


async def test_clean_flow_end_to_end():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=20) as client:
        # 1) 创建项目
        project_payload = {"name": f"e2e-clean-{uuid.uuid4()}", "description": "e2e flow"}
        resp = await client.post("/projects", json=project_payload)
        assert resp.status_code == 200, resp.text
        project_id = resp.json()["id"]

        # 2) 批量上传两张图片
        files = [
            ("files", ("img1.jpg", _make_image_bytes(color=(255, 120, 0)), "image/jpeg")),
            ("files", ("img2.jpg", _make_image_bytes(color=(0, 128, 255)), "image/jpeg")),
        ]
        upload_resp = await client.post(f"/upload/batch", params={"project_id": project_id}, files=files)
        assert upload_resp.status_code == 200, upload_resp.text

        # 3) 启动分析（Clean 路由）
        analysis_resp = await client.post(
            "/analysis/clean/start",
            params={"project_id": project_id, "screenshot_mode": False},
            json={"parameters": {"match_percentile": 70}},
        )
        assert analysis_resp.status_code == 200, analysis_resp.text
        data = analysis_resp.json()
        assert data["status"] == "completed"
        assert data["similarity"] is not None
        assert data["similarity"]["image_ids"]
        assert data["errors"] == []

