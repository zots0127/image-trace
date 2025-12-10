from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
from uuid import UUID, uuid4


@dataclass
class Project:
    id: UUID
    name: str
    description: Optional[str]
    status: str = "active"


@dataclass
class ImageItem:
    id: UUID
    project_id: UUID
    filename: str
    path: str
    mime_type: str
    checksum: str
    metadata: Dict[str, str]
    file_size: Optional[int] = None


@dataclass
class FeatureVector:
    avg_color: List[float]
    ahash: List[int]
    descriptors: Optional[List[List[float]]] = None
    screenshot_mode: bool = False

    def to_fast_dict(self) -> Dict:
        return {
            "avg_color_features": self.avg_color,
            "ahash_features": self.ahash,
            "screenshot_mode": self.screenshot_mode,
        }


@dataclass
class SimilarityMatrix:
    image_ids: List[UUID]
    scores: List[List[float]]


@dataclass
class AnalysisResult:
    id: UUID = field(default_factory=uuid4)
    project_id: UUID = field(default_factory=uuid4)
    status: str = "pending"  # pending/processing/completed/failed
    progress: float = 0.0
    error_message: Optional[str] = None
    errors: List[str] = field(default_factory=list)
    algorithm_type: str = "orb+ahash"
    parameters: Dict = field(default_factory=dict)
    similarity: Optional[SimilarityMatrix] = None
    completed_at: Optional[datetime] = None

