from __future__ import annotations

import json
from typing import Optional
from uuid import UUID

import redis

from core.domain.services import FeatureCache


class RedisFeatureCache(FeatureCache):
    """
    基于 Redis 的快速特征缓存，仅存储 fast 特征（avg_color/ahash）。
    纯同步实现，避免在 Use Case 中混用事件循环。
    """

    def __init__(self, redis_url: str, prefix: str = "img_features:fast:", ttl_seconds: int = 86400):
        self.client = redis.Redis.from_url(redis_url, decode_responses=True)
        self.prefix = prefix
        self.ttl_seconds = ttl_seconds

    def _key(self, image_id: UUID) -> str:
        return f"{self.prefix}{image_id}"

    def get_fast(self, image_id: UUID) -> Optional[dict]:
        try:
            data = self.client.get(self._key(image_id))
            if not data:
                return None
            return json.loads(data)
        except Exception:
            return None

    def set_fast(self, image_id: UUID, data: dict) -> None:
        try:
            self.client.set(self._key(image_id), json.dumps(data), ex=self.ttl_seconds)
        except Exception:
            # 不中断主流程；缓存失败视为忽略
            return

