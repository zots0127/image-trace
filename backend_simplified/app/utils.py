import os
import uuid
from pathlib import Path
from typing import List, Optional, Union, Callable, Any
import shutil

from sqlmodel import Session, create_engine, select
from sqlmodel.pool import StaticPool

from .models import Project, Image, ImageRead, ComparisonResult, SimilarGroup, ProjectRead, AnalysisRun
import json
from .image_processor import (
    group_similar_images,
    calculate_similarity,
    calculate_descriptor_similarity,
    get_cached_descriptor,
)

# 静态文件根目录（存储 uploads/extracted），默认 data
STATIC_DIR = Path(os.getenv("STATIC_DIR", "data"))


def get_database_url(db_path: str = "data/database.db"):
    """获取数据库连接URL"""
    # 优先读取环境变量（便于 Docker/Compose 配置）
    env_url = os.getenv("DATABASE_URL")
    if env_url:
        # sqlite:///relative/path.db 或 sqlite:////absolute/path.db
        if env_url.startswith("sqlite:///"):
            sqlite_path = env_url.replace("sqlite:///", "", 1)
            # relative path 会相对于当前工作目录；这里确保父目录存在
            Path(sqlite_path).parent.mkdir(parents=True, exist_ok=True)
        return env_url

    # 默认使用本地 SQLite 文件
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{db_path}"


def create_db_and_tables(engine):
    """创建数据库和表"""
    from sqlmodel import SQLModel
    from .models import Project, Image

    SQLModel.metadata.create_all(engine)


def get_session(database_url: str):
    """获取数据库会话"""
    engine = create_engine(
        database_url,
        poolclass=StaticPool,
        connect_args={
            "check_same_thread": False,
        },
        echo=False  # 设置为True可以看到SQL日志
    )
    create_db_and_tables(engine)
    return Session(engine)


def ensure_directory(directory: Union[str, Path]) -> Path:
    """确保目录存在"""
    dir_path = Path(directory)
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path


def generate_unique_filename(original_filename: str, directory: Union[str, Path]) -> str:
    """生成唯一的文件名，避免冲突"""
    directory = Path(directory)
    name, ext = os.path.splitext(original_filename)

    # 如果文件不存在，直接使用原名
    file_path = directory / original_filename
    if not file_path.exists():
        return original_filename

    # 添加序号直到找到不存在的文件名
    counter = 1
    while True:
        new_filename = f"{name}_{counter}{ext}"
        new_path = directory / new_filename
        if not new_path.exists():
            return new_filename
        counter += 1


def save_upload_file(upload_file, destination: Union[str, Path]) -> Path:
    """保存上传的文件"""
    destination = Path(destination)
    ensure_directory(destination.parent)

    # 生成唯一文件名
    unique_filename = generate_unique_filename(upload_file.filename, destination.parent)
    file_path = destination.parent / unique_filename

    # 保存文件
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)

    return file_path


def get_file_size_mb(file_path: Union[str, Path]) -> float:
    """获取文件大小（MB）"""
    return os.path.getsize(file_path) / (1024 * 1024)


def format_file_size(size_bytes: int) -> str:
    """格式化文件大小为可读字符串"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


def is_supported_image_format(filename: str) -> bool:
    """检查是否为支持的图像格式"""
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'}
    _, ext = os.path.splitext(filename.lower())
    return ext in image_extensions


def is_supported_document_format(filename: str) -> bool:
    """检查是否为支持的文档格式"""
    doc_extensions = {'.pdf', '.docx', '.pptx'}
    _, ext = os.path.splitext(filename.lower())
    return ext in doc_extensions


def delete_file_if_exists(file_path: Union[str, Path]) -> bool:
    """删除文件（如果存在）"""
    try:
        file_path = Path(file_path)
        if file_path.exists():
            file_path.unlink()
            return True
        return False
    except Exception:
        return False


def cleanup_project_files(project: Project, upload_dir: str = "data/uploads", extract_dir: str = "data/extracted") -> dict:
    """清理项目相关的文件"""
    results = {
        'deleted_files': [],
        'errors': []
    }

    try:
        # 删除项目中的图像文件
        for image in project.images:
            if delete_file_if_exists(image.file_path):
                results['deleted_files'].append(image.file_path)

        # 注意：这里不删除原始上传文件，因为可能被多个项目使用
        # 可以根据需要调整这个策略

    except Exception as e:
        results['errors'].append(str(e))

    return results


def group_similar_by_metric(
    images: List[dict],
    threshold: float,
    scorer: Callable[[dict, dict], float]
) -> tuple[list[list[dict]], list[dict]]:
    """
    通用分组：基于自定义相似度 scorer。
    返回 (groups, ungrouped)
    """
    groups: list[list[dict]] = []
    ungrouped: list[dict] = []
    visited = set()

    for i, img in enumerate(images):
        if img['id'] in visited:
            continue
        group = [img]
        visited.add(img['id'])
        for j in range(i + 1, len(images)):
            other = images[j]
            if other['id'] in visited:
                continue
            sim = scorer(img, other)
            if sim >= threshold:
                group.append(other)
                visited.add(other['id'])
        if len(group) > 1:
            groups.append(group)
        else:
            ungrouped.append(img)

    # 补上未访问的（理论上无）
    for img in images:
        if img['id'] not in visited:
            ungrouped.append(img)

    return groups, ungrouped


def compare_images_in_project(
    session: Session,
    project_id: int,
    threshold: float = 0.85,
    hash_type: str = 'orb'
) -> ComparisonResult:
    """
    比对项目中的所有图像

    Args:
        session: 数据库会话
        project_id: 项目ID
        threshold: 相似度阈值
        hash_type: 使用的哈希类型

    Returns:
        比对结果
    """
    # 获取项目
    project = session.get(Project, project_id)
    if not project:
        raise ValueError(f"项目不存在: {project_id}")

    # 获取项目中的所有图像
    statement = select(Image).where(Image.project_id == project_id)
    images = session.exec(statement).all()

    if not images:
        return ComparisonResult(
            project_id=project_id,
            total_images=0,
            groups=[],
            unique_images=[]
        )

    # 转换为字典格式
    image_dicts = []
    for img in images:
        image_dict = {
            'id': img.id,
            'filename': img.filename,
            'file_path': img.file_path,
            'file_hash': img.file_hash,
            'phash': img.phash,
            'dhash': img.dhash,
            'ahash': img.ahash,
            'whash': img.whash,
            'extracted_from': img.extracted_from,
            'file_size': img.file_size,
            'width': img.width,
            'height': img.height,
            'created_at': img.created_at
        }
        image_dicts.append(image_dict)

    # 特征类算法需要读取文件计算描述子
    descriptor_algos = ['orb', 'brisk', 'sift']
    if hash_type in descriptor_algos:
        for img in image_dicts:
            try:
                fp = STATIC_DIR / img['file_path']
            desc, norm = get_cached_descriptor(str(fp), img['file_hash'], hash_type)
                img['descriptor'] = desc
                img['descriptor_norm'] = norm
            except Exception:
                img['descriptor'] = None
                img['descriptor_norm'] = None

    # 执行相似度分组
    if hash_type in descriptor_algos:
        def scorer(a: dict, b: dict) -> float:
            desc_sim = calculate_descriptor_similarity(
                a.get('descriptor'),
                b.get('descriptor'),
                a.get('descriptor_norm') or b.get('descriptor_norm') or 4  # 默认 NORM_L2=4
            )
            return desc_sim

        groups, ungrouped = group_similar_by_metric(image_dicts, threshold, scorer)
    else:
        groups, ungrouped = group_similar_images(image_dicts, threshold, hash_type)

    # 转换为响应格式
    similar_groups = []
    for group in groups:
        # 计算组的平均相似度
        if len(group) > 1:
            # 计算所有图片对之间的平均相似度
            total_similarity = 0
            count = 0
            for i in range(len(group)):
                for j in range(i + 1, len(group)):
                    if hash_type in descriptor_algos:
                        similarity = scorer(group[i], group[j])
                    else:
                        similarity = calculate_similarity(
                            group[i][hash_type],
                            group[j][hash_type]
                        )
                    total_similarity += similarity
                    count += 1
            avg_similarity = total_similarity / count if count > 0 else 1.0
        else:
            avg_similarity = 1.0

        # 转换图片格式
        group_images = []
        for img_dict in group:
            img_read = ImageRead(
                id=img_dict['id'],
                filename=img_dict['filename'],
                project_id=img_dict.get('project_id', project_id),
                file_path=img_dict['file_path'],
                file_hash=img_dict['file_hash'],
                phash=img_dict['phash'],
                dhash=img_dict.get('dhash'),
                ahash=img_dict.get('ahash'),
                whash=img_dict.get('whash'),
                extracted_from=img_dict.get('extracted_from'),
                file_size=img_dict.get('file_size'),
                width=img_dict.get('width'),
                height=img_dict.get('height'),
                created_at=img_dict['created_at']
            )
            group_images.append(img_read)

        similar_groups.append(SimilarGroup(
            group_id=len(similar_groups) + 1,
            similarity_score=avg_similarity,
            images=group_images
        ))

    # 转换未分组图片格式
    unique_images = []
    for img_dict in ungrouped:
        img_read = ImageRead(
            id=img_dict['id'],
            filename=img_dict['filename'],
            project_id=img_dict.get('project_id', project_id),
            file_path=img_dict['file_path'],
            file_hash=img_dict['file_hash'],
            phash=img_dict['phash'],
            dhash=img_dict.get('dhash'),
            ahash=img_dict.get('ahash'),
            whash=img_dict.get('whash'),
            extracted_from=img_dict.get('extracted_from'),
            file_size=img_dict.get('file_size'),
            width=img_dict.get('width'),
            height=img_dict.get('height'),
            created_at=img_dict['created_at']
        )
        unique_images.append(img_read)

    result = ComparisonResult(
        project_id=project_id,
        total_images=len(images),
        groups=similar_groups,
        unique_images=unique_images
    )

    # 落库存储概要（不含大对象）
    try:
        run = AnalysisRun(
            project_id=project_id,
            hash_type=hash_type,
            threshold=threshold,
            total_images=len(images),
            groups_count=len(similar_groups),
            unique_count=len(unique_images),
            summary=json.dumps(result.model_dump())
        )
        session.add(run)
        session.commit()
        session.refresh(run)
        # 附加 run_id 以便前端引用
        result_dict = result.model_dump()
        result_dict["run_id"] = run.id
        return ComparisonResult.model_validate(result_dict)
    except Exception:
        # 持久化失败不影响主流程
        return result