"""Tests for feature_matrix.py — precompute, serialize, matrix comparison."""

import os
import numpy as np
import pytest
from PIL import Image as PILImage
from tests.conftest import make_upload_bytes


# ---------- Vector serialization -------------------------------------------

class TestVectorSerialization:
    def test_b64_roundtrip_float32(self):
        from app.feature_matrix import vector_to_b64, b64_to_vector
        arr = np.random.rand(128).astype(np.float32)
        b64 = vector_to_b64(arr)
        recovered = b64_to_vector(b64, dtype=np.float32)
        np.testing.assert_array_almost_equal(arr, recovered)

    def test_b64_roundtrip_uint8(self):
        from app.feature_matrix import vector_to_b64, b64_to_vector
        arr = np.array([0, 1, 1, 0, 1] * 12 + [0, 1, 1, 0], dtype=np.uint8)
        b64 = vector_to_b64(arr)
        recovered = b64_to_vector(b64, dtype=np.uint8)
        np.testing.assert_array_equal(arr, recovered)


# ---------- Hash bit conversion -------------------------------------------

class TestHashBits:
    def test_hash_str_to_bits(self):
        from app.feature_matrix import hash_str_to_bits
        bits = hash_str_to_bits("ff00")
        assert bits.shape == (64,)
        # 'f' = 1111, 'f' = 1111, '0' = 0000, '0' = 0000
        assert bits[0] == 1  # first nibble of 'f'
        assert bits[8] == 0  # first nibble of '0'

    def test_empty_hash(self):
        from app.feature_matrix import hash_str_to_bits
        bits = hash_str_to_bits("")
        assert bits.shape == (64,)
        assert bits.sum() == 0


# ---------- Single variant feature computation ----------------------------

class TestSingleVariantFeatures:
    def test_compute_features(self, tmp_path):
        from app.feature_matrix import _compute_single_variant_features
        img_path = str(tmp_path / "test.png")
        PILImage.new("RGB", (200, 200), color="red").save(img_path)
        features = _compute_single_variant_features(img_path)

        # Should have hash features
        assert 'phash_bits' in features
        assert 'dhash_bits' in features
        assert features['phash_bits'][1] == 64  # dimensions

        # Should have histogram
        assert 'histogram_hsv' in features
        assert features['histogram_hsv'][1] == 3000

        # Should have gray flat
        assert 'gray_flat' in features
        assert features['gray_flat'][1] == 128 * 128

        # Should have descriptor pooled
        assert 'sift_pooled' in features
        assert 'orb_pooled' in features


# ---------- Variant generation -------------------------------------------

class TestVariantGeneration:
    def test_generate_8_variants(self, tmp_path):
        from app.feature_matrix import _generate_variant_paths
        img_path = str(tmp_path / "test.png")
        PILImage.new("RGB", (100, 100), color="blue").save(img_path)
        paths = _generate_variant_paths(img_path)
        assert len(paths) == 8
        assert paths[0] == img_path  # original
        for p in paths:
            assert os.path.exists(p)
        # Cleanup
        for p in paths[1:]:
            os.unlink(p)


# ---------- Hash matrix comparison ----------------------------------------

class TestHashMatrix:
    def test_identical_images_score_1(self):
        from app.feature_matrix import compute_hash_similarity_matrix
        bits = np.array([1, 0, 1, 0] * 16, dtype=np.uint8)
        vectors = {
            1: {0: bits.copy()},
            2: {0: bits.copy()},
        }
        matrix = compute_hash_similarity_matrix(vectors, [1, 2])
        assert matrix[0, 1] == 1.0
        assert matrix[1, 0] == 1.0

    def test_different_images_score_low(self):
        from app.feature_matrix import compute_hash_similarity_matrix
        vectors = {
            1: {0: np.zeros(64, dtype=np.uint8)},
            2: {0: np.ones(64, dtype=np.uint8)},
        }
        matrix = compute_hash_similarity_matrix(vectors, [1, 2])
        assert matrix[0, 1] == 0.0  # all bits different


# ---------- Cosine matrix comparison ---------------------------------------

class TestCosineMatrix:
    def test_identical_vectors_score_1(self):
        from app.feature_matrix import compute_cosine_similarity_matrix
        vec = np.random.rand(128).astype(np.float32)
        vectors = {
            1: {0: vec.copy()},
            2: {0: vec.copy()},
        }
        matrix = compute_cosine_similarity_matrix(vectors, [1, 2])
        assert abs(matrix[0, 1] - 1.0) < 0.001

    def test_orthogonal_vectors_score_0(self):
        from app.feature_matrix import compute_cosine_similarity_matrix
        vec_a = np.array([1, 0, 0, 0], dtype=np.float32)
        vec_b = np.array([0, 1, 0, 0], dtype=np.float32)
        vectors = {
            1: {0: vec_a},
            2: {0: vec_b},
        }
        matrix = compute_cosine_similarity_matrix(vectors, [1, 2])
        assert abs(matrix[0, 1]) < 0.001

    def test_rotation_invariant_best_variant(self):
        from app.feature_matrix import compute_cosine_similarity_matrix
        vec_a = np.array([1, 0, 0, 0], dtype=np.float32)
        vectors = {
            1: {0: vec_a},
            2: {0: np.array([0, 1, 0, 0], dtype=np.float32),  # bad match
                1: vec_a.copy()},  # perfect match (e.g. rotated variant)
        }
        matrix = compute_cosine_similarity_matrix(vectors, [1, 2], rotation_invariant=True)
        assert abs(matrix[0, 1] - 1.0) < 0.001  # should pick best variant


# ---------- Feature status endpoint ----------------------------------------

class TestFeatureStatus:
    def test_feature_status_empty(self, client):
        resp = client.post("/projects", json={"name": "StatusTest"})
        pid = resp.json()["id"]
        resp = client.get(f"/feature_status/{pid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["all_ready"] is False

    def test_feature_status_after_upload(self, client):
        resp = client.post("/projects", json={"name": "StatusUpload"})
        pid = resp.json()["id"]
        file_tuple = make_upload_bytes("status_test.png", color=(100, 100, 100))
        client.post("/upload", data={"project_id": str(pid)}, files={"file": file_tuple})
        resp = client.get(f"/feature_status/{pid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert len(data["images"]) == 1
