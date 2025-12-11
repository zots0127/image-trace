from datetime import datetime
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship


class ProjectBase(SQLModel):
    name: str = Field(max_length=255)
    description: Optional[str] = Field(default=None, max_length=1000)


class Project(ProjectBase, table=True):
    __tablename__ = "projects"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

    # 关联关系
    images: List["Image"] = Relationship(back_populates="project")


class ProjectCreate(ProjectBase):
    pass


class ProjectRead(ProjectBase):
    id: int
    created_at: datetime
    image_count: Optional[int] = 0


class ImageBase(SQLModel):
    filename: str = Field(max_length=255)
    project_id: int = Field(foreign_key="projects.id")
    file_path: str = Field(max_length=500)
    file_hash: str = Field(index=True, max_length=32)  # MD5 hash
    phash: str = Field(index=True, max_length=64)     # Perceptual hash
    dhash: Optional[str] = Field(default=None, max_length=64)  # Difference hash
    ahash: Optional[str] = Field(default=None, max_length=64)  # Average hash
    whash: Optional[str] = Field(default=None, max_length=64)  # Wavelet hash
    extracted_from: Optional[str] = Field(default=None, max_length=255)  # 来源文档名
    file_size: Optional[int] = None  # 文件大小（字节）
    width: Optional[int] = None      # 图片宽度
    height: Optional[int] = None     # 图片高度


class Image(ImageBase, table=True):
    __tablename__ = "images"

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: Optional[datetime] = Field(default_factory=datetime.utcnow)

    # 关联关系
    project: Project = Relationship(back_populates="images")


class ImageCreate(ImageBase):
    pass


class ImageRead(ImageBase):
    id: int
    created_at: datetime


class SimilarGroup(SQLModel):
    """相似图片组"""
    group_id: int
    similarity_score: float  # 相似度分数 (0-1)
    images: List[ImageRead]


class ComparisonResult(SQLModel):
    """比对结果"""
    project_id: int
    total_images: int
    groups: List[SimilarGroup]
    unique_images: List[ImageRead]  # 未找到相似图的独立图片