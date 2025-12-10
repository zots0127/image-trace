from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID


@dataclass
class StartAnalysisRequest:
    project_id: UUID
    screenshot_mode: bool
    parameters: dict

