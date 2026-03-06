"""
Feature Matrix Engine — 预计算特征矩阵 + 矩阵级比对

核心思路：
  上传时 → precompute_feature_matrix(image_id) 计算全部特征向量
  比对时 → load_feature_vectors() + matrix ops → 毫秒级 N×N 相似度矩阵

特征类型：
  - *_bits  (64维 uint8)  → Hash算法，XOR + popcount
  - *_pooled (D维 float32) → Descriptor 聚合向量，余弦相似度
  - histogram_hsv (3000维 float32) → HSV 直方图，相关性
  - gray_flat (16384维 uint8)  → 灰度缩略图，余弦相似度
"""

import os
import base64
import numpy as np
from typing import Dict, List, Optional, Tuple, Any

try:
    import cv2
except ImportError:
    cv2 = None

try:
    import imagehash
    from PIL import Image as PILImage
except ImportError:
    imagehash = None
    PILImage = None


# ============================================================================
#  Constants
# ============================================================================

# Feature algorithms to compute for each image variant
HASH_FEATURES = ['phash_bits', 'dhash_bits', 'ahash_bits', 'whash_bits']
DESCRIPTOR_FEATURES = ['sift_pooled', 'orb_pooled', 'brisk_pooled', 'akaze_pooled', 'kaze_pooled']
PIXEL_FEATURES = ['histogram_hsv', 'gray_flat']
ALL_FEATURES = HASH_FEATURES + DESCRIPTOR_FEATURES + PIXEL_FEATURES

# Mapping from feature name to comparison algorithm name used in UI
FEATURE_TO_ALGO = {
    'phash_bits': 'phash', 'dhash_bits': 'dhash', 'ahash_bits': 'ahash', 'whash_bits': 'whash',
    'sift_pooled': 'sift', 'orb_pooled': 'orb', 'brisk_pooled': 'brisk',
    'akaze_pooled': 'akaze', 'kaze_pooled': 'kaze',
    'histogram_hsv': 'histogram', 'gray_flat': 'ssim',
}
ALGO_TO_FEATURE = {v: k for k, v in FEATURE_TO_ALGO.items()}

DESCRIPTOR_ALGO_MAP = {
    'sift_pooled': ('sift', 128),
    'orb_pooled': ('orb', 32),
    'brisk_pooled': ('brisk', 64),
    'akaze_pooled': ('akaze', 61),
    'kaze_pooled': ('kaze', 61),
}

# Orientation variants (index → PIL transform)
VARIANT_TRANSFORMS = [
    None,                                    # 0: original
    PILImage.Transpose.ROTATE_90 if PILImage else None,
    PILImage.Transpose.ROTATE_180 if PILImage else None,
    PILImage.Transpose.ROTATE_270 if PILImage else None,
    PILImage.Transpose.FLIP_LEFT_RIGHT if PILImage else None,
    PILImage.Transpose.FLIP_TOP_BOTTOM if PILImage else None,
]
# 6 + 7: diagonal flips (rotate 90 + flip)
NUM_VARIANTS = 8

GRAY_FLAT_SIZE = 128  # 128×128 → 16384 dim


# ============================================================================
#  Serialization: numpy ↔ base64 string (for SQLite TEXT column)
# ============================================================================

def vector_to_b64(arr: np.ndarray) -> str:
    """Serialize numpy array to base64 string for DB storage."""
    return base64.b64encode(arr.tobytes()).decode('ascii')


def b64_to_vector(b64_str: str, dtype=np.float32, shape=None) -> np.ndarray:
    """Deserialize base64 string back to numpy array."""
    raw = base64.b64decode(b64_str)
    arr = np.frombuffer(raw, dtype=dtype)
    if shape is not None:
        arr = arr.reshape(shape)
    return arr.copy()  # copy to make writable


# ============================================================================
#  Hash → Binary Vector
# ============================================================================

def hash_str_to_bits(hash_str: str) -> np.ndarray:
    """Convert hex hash string (e.g. 'a3f1...') to 64-dim uint8 bit vector."""
    if not hash_str:
        return np.zeros(64, dtype=np.uint8)
    # Each hex char = 4 bits
    bits = []
    for ch in hash_str:
        val = int(ch, 16)
        bits.extend([(val >> (3 - b)) & 1 for b in range(4)])
    arr = np.array(bits[:64], dtype=np.uint8)
    if len(arr) < 64:
        arr = np.pad(arr, (0, 64 - len(arr)))
    return arr


# ============================================================================
#  Precompute Feature Matrix for a Single Image
# ============================================================================

def _compute_single_variant_features(image_path: str) -> Dict[str, Tuple[np.ndarray, int]]:
    """
    Compute ALL feature vectors for a single image file.
    Returns dict of { feature_name: (vector, dimensions) }
    """
    features = {}

    # --- Hash features ---
    if PILImage and imagehash:
        try:
            img = PILImage.open(image_path)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            features['phash_bits'] = (hash_str_to_bits(str(imagehash.phash(img, hash_size=8))), 64)
            features['dhash_bits'] = (hash_str_to_bits(str(imagehash.dhash(img, hash_size=8))), 64)
            features['ahash_bits'] = (hash_str_to_bits(str(imagehash.average_hash(img, hash_size=8))), 64)
            features['whash_bits'] = (hash_str_to_bits(str(imagehash.whash(img, hash_size=8))), 64)
            img.close()
        except Exception:
            for h in HASH_FEATURES:
                features[h] = (np.zeros(64, dtype=np.uint8), 64)

    # --- Grayscale flat (for SSIM/Template approximation) ---
    if cv2 is not None:
        try:
            gray = cv2.imread(str(image_path), cv2.IMREAD_GRAYSCALE)
            if gray is not None:
                gray = cv2.resize(gray, (GRAY_FLAT_SIZE, GRAY_FLAT_SIZE))
                features['gray_flat'] = (gray.flatten().astype(np.uint8), GRAY_FLAT_SIZE * GRAY_FLAT_SIZE)
        except Exception:
            pass

    # --- Histogram HSV ---
    if cv2 is not None:
        try:
            color_img = cv2.imread(str(image_path))
            if color_img is not None:
                h, w = color_img.shape[:2]
                if max(h, w) > 512:
                    scale = 512 / max(h, w)
                    color_img = cv2.resize(color_img, (int(w * scale), int(h * scale)))
                hsv = cv2.cvtColor(color_img, cv2.COLOR_BGR2HSV)
                hist = cv2.calcHist([hsv], [0, 1], None, [50, 60], [0, 180, 0, 256])
                cv2.normalize(hist, hist)
                features['histogram_hsv'] = (hist.flatten().astype(np.float32), 3000)
        except Exception:
            pass

    # --- Descriptor pooled ---
    if cv2 is not None:
        for feat_name, (algo, dim) in DESCRIPTOR_ALGO_MAP.items():
            try:
                from app.image_processor import compute_descriptor
                desc, norm = compute_descriptor(image_path, algo, max_features=512)
                if desc is not None and len(desc) > 0:
                    pooled = desc.mean(axis=0).astype(np.float32)
                    features[feat_name] = (pooled, len(pooled))
                else:
                    features[feat_name] = (np.zeros(dim, dtype=np.float32), dim)
            except Exception:
                features[feat_name] = (np.zeros(dim, dtype=np.float32), dim)

    return features


def precompute_feature_matrix(image_id: int, image_path: str, session) -> bool:
    """
    Precompute ALL feature vectors for an image (original + 7 variants).
    Stores results in feature_store table. Updates image.feature_status.

    Called as a background task after upload.
    """
    from app.models import FeatureStore, Image

    # Mark as computing
    image = session.get(Image, image_id)
    if not image:
        return False
    image.feature_status = "computing"
    session.add(image)
    session.commit()

    try:
        # Clear any existing features for this image
        from sqlmodel import select
        existing = session.exec(
            select(FeatureStore).where(FeatureStore.image_id == image_id)
        ).all()
        for e in existing:
            session.delete(e)
        session.commit()

        # Generate all 8 orientation variants
        variant_paths = _generate_variant_paths(image_path)

        for variant_idx, v_path in enumerate(variant_paths):
            features = _compute_single_variant_features(v_path)

            for feat_name, (vector, dims) in features.items():
                entry = FeatureStore(
                    image_id=image_id,
                    variant_idx=variant_idx,
                    algorithm=feat_name,
                    vector=vector_to_b64(vector),
                    dimensions=dims,
                )
                session.add(entry)

            session.commit()

        # Cleanup temp variant files
        for p in variant_paths[1:]:
            try:
                os.unlink(p)
            except OSError:
                pass

        # Mark as ready
        image.feature_status = "ready"
        session.add(image)
        session.commit()
        return True

    except Exception as e:
        try:
            image.feature_status = "pending"
            session.add(image)
            session.commit()
        except Exception:
            pass
        return False


def _generate_variant_paths(image_path: str) -> List[str]:
    """Generate 8 orientation variant image files, return list of paths."""
    if PILImage is None:
        return [image_path]

    paths = [image_path]
    try:
        img = PILImage.open(image_path)
        if img.mode != 'RGB':
            img = img.convert('RGB')

        base, ext = os.path.splitext(image_path)
        transforms = [
            PILImage.Transpose.ROTATE_90,
            PILImage.Transpose.ROTATE_180,
            PILImage.Transpose.ROTATE_270,
            PILImage.Transpose.FLIP_LEFT_RIGHT,
            PILImage.Transpose.FLIP_TOP_BOTTOM,
        ]

        for i, t in enumerate(transforms):
            v_path = f"{base}_v{i + 1}{ext}"
            img.transpose(t).save(v_path)
            paths.append(v_path)

        # variant 6: rotate 90 + flip horizontal
        v6_path = f"{base}_v6{ext}"
        img.transpose(PILImage.Transpose.ROTATE_90).transpose(
            PILImage.Transpose.FLIP_LEFT_RIGHT
        ).save(v6_path)
        paths.append(v6_path)

        # variant 7: rotate 90 + flip vertical
        v7_path = f"{base}_v7{ext}"
        img.transpose(PILImage.Transpose.ROTATE_90).transpose(
            PILImage.Transpose.FLIP_TOP_BOTTOM
        ).save(v7_path)
        paths.append(v7_path)

        img.close()
    except Exception:
        pass

    return paths


# ============================================================================
#  Matrix Comparison Engine
# ============================================================================

def load_feature_vectors(
    session,
    image_ids: List[int],
    algorithm: str,
    variants: List[int] = None,
) -> Dict[int, Dict[int, np.ndarray]]:
    """
    Load pre-computed feature vectors from DB.

    Returns: { image_id: { variant_idx: numpy_array } }
    """
    from sqlmodel import select
    from app.models import FeatureStore

    feature_name = ALGO_TO_FEATURE.get(algorithm, algorithm)
    if variants is None:
        variants = [0]

    stmt = (
        select(FeatureStore)
        .where(
            FeatureStore.image_id.in_(image_ids),
            FeatureStore.algorithm == feature_name,
            FeatureStore.variant_idx.in_(variants),
        )
    )
    rows = session.exec(stmt).all()

    result = {}
    for row in rows:
        if row.image_id not in result:
            result[row.image_id] = {}
        dtype = np.uint8 if feature_name.endswith('_bits') or feature_name == 'gray_flat' else np.float32
        result[row.image_id][row.variant_idx] = b64_to_vector(row.vector, dtype=dtype)

    return result


def compute_hash_similarity_matrix(
    vectors: Dict[int, Dict[int, np.ndarray]],
    image_ids: List[int],
    rotation_invariant: bool = False,
) -> np.ndarray:
    """
    Compute N×N similarity matrix for hash algorithms using XOR + popcount.
    If rotation_invariant, tries all 8 variants and takes best score.
    """
    n = len(image_ids)
    matrix = np.eye(n, dtype=np.float64)

    for i in range(n):
        for j in range(i + 1, n):
            id_a, id_b = image_ids[i], image_ids[j]
            va = vectors.get(id_a, {})
            vb = vectors.get(id_b, {})

            best_score = 0.0
            variants_a = list(va.keys())
            variants_b = list(vb.keys())

            if not rotation_invariant:
                variants_a = [0] if 0 in va else variants_a[:1]
                variants_b = [0] if 0 in vb else variants_b[:1]

            for vi in variants_a:
                for vj in variants_b:
                    if vi in va and vj in vb:
                        xor = np.bitwise_xor(va[vi], vb[vj])
                        hamming = int(xor.sum())
                        bits = len(va[vi])
                        score = 1.0 - hamming / max(bits, 1)
                        best_score = max(best_score, score)

            matrix[i, j] = best_score
            matrix[j, i] = best_score

    return matrix


def compute_cosine_similarity_matrix(
    vectors: Dict[int, Dict[int, np.ndarray]],
    image_ids: List[int],
    rotation_invariant: bool = False,
) -> np.ndarray:
    """
    Compute N×N similarity matrix using cosine similarity (for float vectors).
    If rotation_invariant, tries all variants and takes best score.
    """
    n = len(image_ids)
    matrix = np.eye(n, dtype=np.float64)

    for i in range(n):
        for j in range(i + 1, n):
            id_a, id_b = image_ids[i], image_ids[j]
            va = vectors.get(id_a, {})
            vb = vectors.get(id_b, {})

            best_score = 0.0
            variants_a = list(va.keys())
            variants_b = list(vb.keys())

            if not rotation_invariant:
                variants_a = [0] if 0 in va else variants_a[:1]
                variants_b = [0] if 0 in vb else variants_b[:1]

            for vi in variants_a:
                for vj in variants_b:
                    if vi in va and vj in vb:
                        a_vec = va[vi].astype(np.float64)
                        b_vec = vb[vj].astype(np.float64)
                        norm_a = np.linalg.norm(a_vec)
                        norm_b = np.linalg.norm(b_vec)
                        if norm_a > 0 and norm_b > 0:
                            cos_sim = np.dot(a_vec, b_vec) / (norm_a * norm_b)
                            score = float(max(0.0, min(1.0, cos_sim)))
                        else:
                            score = 0.0
                        best_score = max(best_score, score)

            matrix[i, j] = best_score
            matrix[j, i] = best_score

    return matrix


def compute_similarity_matrix_fast(
    session,
    image_ids: List[int],
    algorithm: str,
    rotation_invariant: bool = False,
) -> np.ndarray:
    """
    High-level: load vectors + compute N×N similarity matrix.
    This is the main entry point for fast matrix comparison.

    Returns: (N, N) numpy array of similarity scores.
    """
    feature_name = ALGO_TO_FEATURE.get(algorithm, algorithm)
    variants = list(range(NUM_VARIANTS)) if rotation_invariant else [0]

    vectors = load_feature_vectors(session, image_ids, algorithm, variants)

    if feature_name.endswith('_bits'):
        return compute_hash_similarity_matrix(vectors, image_ids, rotation_invariant)
    elif feature_name == 'histogram_hsv':
        # For histogram, correlation ≈ (dot + 1) / 2
        return compute_cosine_similarity_matrix(vectors, image_ids, rotation_invariant)
    else:
        return compute_cosine_similarity_matrix(vectors, image_ids, rotation_invariant)


def are_features_ready(session, image_ids: List[int]) -> bool:
    """Check if all images have pre-computed features (feature_status='ready')."""
    from sqlmodel import select
    from app.models import Image
    for img_id in image_ids:
        img = session.get(Image, img_id)
        if img is None or img.feature_status != 'ready':
            return False
    return True
