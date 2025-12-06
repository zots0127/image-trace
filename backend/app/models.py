from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel
from sqlalchemy import Column, Text


class UserBase(SQLModel):
    email: str = Field(index=True, max_length=255)
    display_name: Optional[str] = Field(default=None, max_length=100)
    is_active: bool = Field(default=True)


class User(UserBase, table=True):
    __tablename__ = "users"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    supabase_id: str = Field(index=True, max_length=255, unique=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class UserCreate(UserBase):
    supabase_id: str


class UserRead(UserBase):
    id: UUID
    supabase_id: str
    created_at: datetime
    updated_at: datetime


class ProjectBase(SQLModel):
    name: str = Field(max_length=255)
    description: Optional[str] = None
    status: str = Field(default="active", max_length=50)
    owner_id: Optional[UUID] = Field(default=None)
    # Store settings as JSON string (to avoid SQLModel dict type issues)
    settings: Optional[str] = Field(default=None)


class Project(ProjectBase, table=True):
    __tablename__ = "projects"  # align with requirements

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ProjectCreate(ProjectBase):
    pass


class ProjectRead(ProjectBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class ImageBase(SQLModel):
    project_id: UUID = Field(foreign_key="projects.id")
    filename: str = Field(max_length=255)
    file_path: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    checksum: Optional[str] = None
    # Arbitrary image metadata stored as JSON string
    image_metadata: Optional[str] = Field(default=None)


class Image(ImageBase, table=True):
    __tablename__ = "images"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ImageRead(ImageBase):
    id: UUID
    created_at: datetime


class AnalysisResultBase(SQLModel):
    project_id: UUID = Field(foreign_key="projects.id")
    task_id: str = Field(max_length=100, unique=True)
    algorithm_type: str = Field(max_length=50)
    # Input parameters and results stored as JSON string
    parameters: Optional[str] = Field(default=None, sa_column=Column(Text))
    results: Optional[str] = Field(default=None, sa_column=Column(Text))
    confidence_score: Optional[float] = None
    processing_time_seconds: Optional[float] = Field(default=None)
    # Status and progress tracking
    status: str = Field(default="pending", max_length=20)  # pending, processing, completed, failed
    progress: float = Field(default=0.0)  # 0.0 to 1.0
    error_message: Optional[str] = Field(default=None)
    completed_at: Optional[datetime] = Field(default=None)


class AnalysisResult(AnalysisResultBase, table=True):
    __tablename__ = "analysis_results"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AnalysisResultRead(AnalysisResultBase):
    id: UUID
    created_at: datetime
    completed_at: Optional[datetime] = None


class DocumentBase(SQLModel):
    project_id: UUID = Field(foreign_key="projects.id")
    filename: str = Field(max_length=255)
    file_path: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    checksum: Optional[str] = None
    # Document metadata stored as JSON string (page count, author, etc.)
    document_metadata: Optional[str] = Field(default=None)
    # Processing status
    processing_status: str = Field(default="pending", max_length=50)
    # Number of images extracted from this document
    extracted_image_count: Optional[int] = Field(default=0)


class Document(DocumentBase, table=True):
    __tablename__ = "documents"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DocumentCreate(DocumentBase):
    pass


class DocumentRead(DocumentBase):
    id: UUID
    created_at: datetime
    updated_at: datetime


class ExtractedImageBase(SQLModel):
    document_id: UUID = Field(foreign_key="documents.id")
    project_id: UUID = Field(foreign_key="projects.id")
    filename: str = Field(max_length=255)
    file_path: str
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    checksum: Optional[str] = None
    # Extraction metadata (page number, position in document, etc.)
    extraction_metadata: Optional[str] = Field(default=None)
    # Reference to the main Image table if this image is also tracked there
    image_id: Optional[UUID] = Field(default=None, foreign_key="images.id")


class ExtractedImage(ExtractedImageBase, table=True):
    __tablename__ = "extracted_images"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ExtractedImageRead(ExtractedImageBase):
    id: UUID
    created_at: datetime
