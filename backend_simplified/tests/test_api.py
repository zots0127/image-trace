"""API integration tests for Image Trace backend."""

import pytest

from tests.conftest import make_upload_bytes


class TestHealthAndRoot:
    def test_health(self, client):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"

    def test_root(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert "endpoints" in data


class TestProjects:
    def test_create_project(self, client):
        resp = client.post("/projects", json={"name": "Test Project", "description": "desc"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Test Project"
        assert data["id"] is not None
        assert data["image_count"] == 0

    def test_list_projects(self, client):
        client.post("/projects", json={"name": "P1"})
        client.post("/projects", json={"name": "P2"})
        resp = client.get("/projects")
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    def test_get_project(self, client):
        create_resp = client.post("/projects", json={"name": "Detail"})
        pid = create_resp.json()["id"]
        resp = client.get(f"/projects/{pid}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Detail"

    def test_get_project_not_found(self, client):
        resp = client.get("/projects/9999")
        assert resp.status_code == 404

    def test_delete_project(self, client):
        create_resp = client.post("/projects", json={"name": "ToDelete"})
        pid = create_resp.json()["id"]
        resp = client.delete(f"/projects/{pid}")
        assert resp.status_code == 200
        # 确认已删除
        resp2 = client.get(f"/projects/{pid}")
        assert resp2.status_code == 404


class TestUpload:
    def _create_project(self, client):
        resp = client.post("/projects", json={"name": "Upload Test"})
        return resp.json()["id"]

    def test_upload_png(self, client):
        pid = self._create_project(client)
        file_tuple = make_upload_bytes("test.png")
        resp = client.post("/upload", data={"project_id": str(pid)}, files={"file": file_tuple})
        assert resp.status_code == 200
        data = resp.json()
        assert data["file_type"] == "image"
        assert data["error"] is None
        assert len(data["processed_images"]) == 1

    def test_upload_tif(self, client):
        """验证 .tif 格式上传可用。"""
        pid = self._create_project(client)
        file_tuple = make_upload_bytes("sample.tif")
        resp = client.post("/upload", data={"project_id": str(pid)}, files={"file": file_tuple})
        assert resp.status_code == 200
        data = resp.json()
        assert data["file_type"] == "image"
        assert data["error"] is None

    def test_upload_jpg(self, client):
        pid = self._create_project(client)
        file_tuple = make_upload_bytes("photo.jpg")
        resp = client.post("/upload", data={"project_id": str(pid)}, files={"file": file_tuple})
        assert resp.status_code == 200
        assert resp.json()["file_type"] == "image"

    def test_upload_unsupported_format(self, client):
        pid = self._create_project(client)
        from io import BytesIO
        file_tuple = ("readme.txt", BytesIO(b"hello world"), "text/plain")
        resp = client.post("/upload", data={"project_id": str(pid)}, files={"file": file_tuple})
        assert resp.status_code == 200
        data = resp.json()
        assert data["error"] is not None

    def test_upload_to_nonexistent_project(self, client):
        file_tuple = make_upload_bytes("test.png")
        resp = client.post("/upload", data={"project_id": "9999"}, files={"file": file_tuple})
        assert resp.status_code == 404


class TestImages:
    def _upload_image(self, client, pid, filename="test.png"):
        file_tuple = make_upload_bytes(filename)
        resp = client.post("/upload", data={"project_id": str(pid)}, files={"file": file_tuple})
        return resp.json()

    def test_list_project_images(self, client):
        resp = client.post("/projects", json={"name": "ImgList"})
        pid = resp.json()["id"]
        self._upload_image(client, pid, "a.png")
        self._upload_image(client, pid, "b.png")

        resp = client.get(f"/images/{pid}")
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_list_images_nonexistent_project(self, client):
        resp = client.get("/images/9999")
        assert resp.status_code == 404

    def test_delete_image(self, client):
        resp = client.post("/projects", json={"name": "DelImg"})
        pid = resp.json()["id"]
        upload_data = self._upload_image(client, pid)
        img_id = upload_data["processed_images"][0]["id"]

        resp = client.delete(f"/images/{img_id}")
        assert resp.status_code == 200

        # 确认已删除
        resp2 = client.get(f"/images/{pid}")
        assert len(resp2.json()) == 0


class TestCompare:
    def _setup_project_with_images(self, client, count=3):
        resp = client.post("/projects", json={"name": "Compare Test"})
        pid = resp.json()["id"]
        colors = [(128, 64, 32), (128, 64, 32), (0, 255, 0)]
        for i in range(count):
            color = colors[i] if i < len(colors) else (i * 50, i * 30, i * 10)
            file_tuple = make_upload_bytes(f"img_{i}.png", color=color)
            client.post("/upload", data={"project_id": str(pid)}, files={"file": file_tuple})
        return pid

    def test_compare_empty_project(self, client):
        resp = client.post("/projects", json={"name": "Empty"})
        pid = resp.json()["id"]
        resp = client.post(f"/compare/{pid}", data={"threshold": "0.85", "hash_type": "orb"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_images"] == 0

    def test_compare_with_images(self, client):
        pid = self._setup_project_with_images(client)
        resp = client.post(f"/compare/{pid}", data={"threshold": "0.85", "hash_type": "orb"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_images"] == 3
        assert "groups" in data
        assert "unique_images" in data

    def test_compare_nonexistent_project(self, client):
        resp = client.post("/compare/9999", data={"threshold": "0.85", "hash_type": "orb"})
        assert resp.status_code == 404

    def test_compare_invalid_threshold(self, client):
        resp = client.post("/projects", json={"name": "Invalid"})
        pid = resp.json()["id"]
        resp = client.post(f"/compare/{pid}", data={"threshold": "2.0", "hash_type": "orb"})
        assert resp.status_code == 400

    def test_compare_invalid_hash_type(self, client):
        resp = client.post("/projects", json={"name": "Invalid2"})
        pid = resp.json()["id"]
        resp = client.post(f"/compare/{pid}", data={"threshold": "0.85", "hash_type": "invalid"})
        assert resp.status_code == 400
