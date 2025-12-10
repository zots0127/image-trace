from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class CacheAdapter(ABC):
    """缓存抽象，便于替换 Redis/内存实现。"""

    @abstractmethod
    async def get_image_features(self, image_id: str, feature_type: Optional[str] = None) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    async def cache_image_features(self, image_id: str, features: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        ...

    @abstractmethod
    async def batch_get_features(self, image_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        ...

    @abstractmethod
    async def invalidate_image_cache(self, image_id: str) -> bool:
        ...

    @abstractmethod
    async def get_cache_stats(self) -> Dict[str, Any]:
        ...

