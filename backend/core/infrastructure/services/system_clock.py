from __future__ import annotations

from datetime import datetime, timezone

from core.domain.services import Clock


class SystemClock(Clock):
    def now(self):
        return datetime.now(timezone.utc)

