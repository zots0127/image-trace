import hashlib
import os
from typing import List, Tuple, Dict, Any
from PIL import Image as PILImage
import imagehash


def compute_file_md5(file_path: str) -> str:
    """计算文件的MD5哈希值"""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


def compute_image_features(image_path: str) -> Dict[str, Any]:
    """
    计算图像的多种哈希值和基本信息

    Args:
        image_path: 图像文件路径

    Returns:
        包含各种哈希值和图像信息的字典
    """
    features = {}

    # 文件哈希
    features['file_hash'] = compute_file_md5(image_path)
    features['file_size'] = os.path.getsize(image_path)

    try:
        with PILImage.open(image_path) as img:
            # 获取图像尺寸
            features['width'], features['height'] = img.size

            # 转换为RGB模式（如果需要）
            if img.mode != 'RGB':
                img = img.convert('RGB')

            # 计算各种感知哈希
            # hash_size=8 生成64位哈希，适合快速比对
            features['phash'] = str(imagehash.phash(img, hash_size=8))
            features['dhash'] = str(imagehash.dhash(img, hash_size=8))
            features['ahash'] = str(imagehash.average_hash(img, hash_size=8))
            features['whash'] = str(imagehash.whash(img, hash_size=8))

    except Exception as e:
        raise ValueError(f"无法处理图像文件 {image_path}: {str(e)}")

    return features


def hamming_distance(hash1: str, hash2: str) -> int:
    """
    计算两个哈希值的汉明距离

    Args:
        hash1, hash2: 十六进制哈希字符串

    Returns:
        汉明距离（不同位的数量）
    """
    # 将十六进制转换为二进制
    bin1 = bin(int(hash1, 16))[2:].zfill(len(hash1) * 4)
    bin2 = bin(int(hash2, 16))[2:].zfill(len(hash2) * 4)

    # 计算不同位的数量
    return sum(c1 != c2 for c1, c2 in zip(bin1, bin2))


def calculate_similarity(hash1: str, hash2: str, max_bits: int = 64) -> float:
    """
    计算两个哈希值的相似度

    Args:
        hash1, hash2: 十六进制哈希字符串
        max_bits: 哈希的最大位数（默认64位）

    Returns:
        相似度分数 (0-1，1表示完全相同)
    """
    distance = hamming_distance(hash1, hash2)
    similarity = (max_bits - distance) / max_bits
    return max(0.0, min(1.0, similarity))


def find_similar_images(
    query_image: Dict[str, Any],
    image_list: List[Dict[str, Any]],
    threshold: float = 0.85,
    hash_type: str = 'phash'
) -> List[Tuple[Dict[str, Any], float]]:
    """
    查找与查询图像相似的图像

    Args:
        query_image: 查询图像的特征字典
        image_list: 待比对的图像列表
        threshold: 相似度阈值（0-1）
        hash_type: 使用的哈希类型（'phash', 'dhash', 'ahash', 'whash'）

    Returns:
        包含相似图像和相似度分数的列表，按相似度降序排列
    """
    query_hash = query_image.get(hash_type)
    if not query_hash:
        raise ValueError(f"查询图像缺少 {hash_type} 哈希值")

    similar_images = []

    for img in image_list:
        img_hash = img.get(hash_type)
        if not img_hash:
            continue

        # 跳过与自身比较
        if img['file_hash'] == query_image['file_hash']:
            continue

        similarity = calculate_similarity(query_hash, img_hash)

        if similarity >= threshold:
            similar_images.append((img, similarity))

    # 按相似度降序排列
    similar_images.sort(key=lambda x: x[1], reverse=True)

    return similar_images


def group_similar_images(
    images: List[Dict[str, Any]],
    threshold: float = 0.85,
    hash_type: str = 'phash'
) -> Tuple[List[List[Dict[str, Any]]], List[Dict[str, Any]]]:
    """
    将相似的图像分组

    Args:
        images: 图像列表
        threshold: 相似度阈值
        hash_type: 使用的哈希类型

    Returns:
        (相似组列表, 未分组图像列表)
    """
    if not images:
        return [], []

    # 复制列表，避免修改原数据
    remaining_images = images.copy()
    groups = []
    processed_hashes = set()

    for i, query_img in enumerate(images):
        # 跳过已处理的图像
        if query_img['file_hash'] in processed_hashes:
            continue

        # 查找相似图像
        similar = find_similar_images(query_img, remaining_images, threshold, hash_type)

        if similar:
            # 创建新组，包含查询图像和所有相似图像
            group = [query_img] + [img for img, _ in similar]
            groups.append(group)

            # 标记已处理的图像
            processed_hashes.add(query_img['file_hash'])
            for img, _ in similar:
                processed_hashes.add(img['file_hash'])

    # 找出未分组的图像
    ungrouped = [img for img in images if img['file_hash'] not in processed_hashes]

    return groups, ungrouped


def is_image_file(file_path: str) -> bool:
    """检查文件是否为支持的图像格式"""
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'}
    _, ext = os.path.splitext(file_path.lower())
    return ext in image_extensions


def resize_image_if_needed(
    image_path: str,
    max_size: int = 1024,
    output_path: str = None
) -> str:
    """
    如果图像尺寸过大，调整图像大小

    Args:
        image_path: 输入图像路径
        max_size: 最大尺寸（宽度或高度）
        output_path: 输出路径（如果为None，则覆盖原文件）

    Returns:
        处理后的图像路径
    """
    with PILImage.open(image_path) as img:
        width, height = img.size

        # 如果图像尺寸在限制内，直接返回
        if max(width, height) <= max_size:
            return image_path

        # 计算新尺寸
        if width > height:
            new_width = max_size
            new_height = int(height * max_size / width)
        else:
            new_height = max_size
            new_width = int(width * max_size / height)

        # 调整大小
        resized_img = img.resize((new_width, new_height), PILImage.Resampling.LANCZOS)

        # 保存图像
        output = output_path or image_path
        resized_img.save(output, quality=85, optimize=True)

        return output