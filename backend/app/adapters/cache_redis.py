from typing import Any, Dict, List, Optional

from .cache import CacheAdapter
from ..feature_cache import feature_cache


class RedisCacheAdapter(CacheAdapter):
    """基于现有 feature_cache 的适配器。"""

    async def get_image_features(self, image_id: str, feature_type: Optional[str] = None) -> Optional[Dict[str, Any]]:
        return await feature_cache.get_image_features(image_id, feature_type)

    async def cache_image_features(self, image_id: str, features: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        return await feature_cache.cache_image_features(image_id, features, ttl)

    async def batch_get_features(self, image_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        return await feature_cache.batch_get_features(image_ids)

    async def invalidate_image_cache(self, image_id: str) -> bool:
        return await feature_cache.invalidate_image_cache(image_id)

    async def get_cache_stats(self) -> Dict[str, Any]:
        return await feature_cache.get_cache_stats()

