"""
Redis特征缓存模块
用于大规模图像特征的高性能缓存，支持上万用户和上亿张图像
"""

import json
import pickle
import hashlib
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime, timedelta
from uuid import UUID
import logging
import redis
from redis.asyncio import Redis as AsyncRedis
from redis.exceptions import RedisError
import numpy as np

logger = logging.getLogger(__name__)

class ImageFeatureCache:
    """
    图像特征缓存类

    设计考虑：
    1. 上亿张图像：使用Redis集群和分片策略
    2. 高性能：批量操作和管道技术
    3. 可扩展：支持水平扩展
    4. 数据一致性：TTL和版本控制
    5. 内存优化：压缩存储和数据结构优化
    """

    def __init__(self, redis_url: str = "redis://localhost:6379/1"):
        self.redis_url = redis_url
        self._redis_client = None
        self._async_redis_client = None

        # 缓存配置
        self.default_ttl = 86400 * 30  # 30天过期
        self.feature_version = "1.0"   # 特征版本，用于兼容性

        # Redis键前缀，避免键冲突
        self.key_prefix = "img_features:"
        self.metadata_prefix = "img_meta:"
        self.stats_prefix = "cache_stats:"

        # 批量操作大小
        self.batch_size = 100

    @property
    def redis_client(self):
        """同步Redis客户端（懒加载）"""
        if self._redis_client is None:
            self._redis_client = redis.from_url(
                self.redis_url,
                decode_responses=False,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
        return self._redis_client

    @property
    async def async_redis_client(self):
        """异步Redis客户端（懒加载）"""
        if self._async_redis_client is None:
            self._async_redis_client = AsyncRedis.from_url(
                self.redis_url,
                decode_responses=False,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
        return self._async_redis_client

    def _get_feature_key(self, image_id: str, feature_type: str) -> str:
        """生成特征缓存键"""
        return f"{self.key_prefix}{feature_type}:{image_id}"

    def _get_metadata_key(self, image_id: str) -> str:
        """生成元数据缓存键"""
        return f"{self.metadata_prefix}{image_id}"

    def _get_stats_key(self, metric: str) -> str:
        """生成统计键"""
        return f"{self.stats_prefix}{metric}"

    def _serialize_features(self, features: Dict[str, Any]) -> bytes:
        """序列化特征数据（使用pickle，更高效）"""
        return pickle.dumps(features)

    def _deserialize_features(self, data: bytes) -> Dict[str, Any]:
        """反序列化特征数据"""
        return pickle.loads(data)

    def _compress_feature_vector(self, vector: List[float]) -> List[int]:
        """
        压缩浮点特征向量到整数，节省内存
        float32 -> uint16 (精度损失可接受)
        """
        if not vector:
            return []

        # 转换为numpy数组，缩放到0-65535范围
        arr = np.array(vector, dtype=np.float32)
        # 假设特征值在[0,1]范围内，如果不是则归一化
        if arr.max() > 1.0 or arr.min() < 0.0:
            arr = (arr - arr.min()) / (arr.max() - arr.min())

        compressed = (arr * 65535).astype(np.uint16)
        return compressed.tolist()

    def _decompress_feature_vector(self, compressed: List[int]) -> List[float]:
        """解压缩特征向量"""
        if not compressed:
            return []

        arr = np.array(compressed, dtype=np.uint16)
        return (arr / 65535.0).astype(np.float32).tolist()

    async def cache_image_features(
        self,
        image_id: str,
        features: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """
        缓存单张图像的特征

        Args:
            image_id: 图像ID
            features: 特征字典，包含avg_color, ahash, orb等
            ttl: 过期时间（秒）

        Returns:
            bool: 是否成功缓存
        """
        try:
            client = await self.async_redis_client

            # 准备缓存数据
            cache_data = {
                "image_id": image_id,
                "features": features,
                "version": self.feature_version,
                "created_at": datetime.utcnow().isoformat(),
                "ttl": ttl or self.default_ttl
            }

            # 压缩特征向量以节省内存
            if "avg_color_features" in features["fast"]:
                cache_data["features"]["fast"]["avg_color_features_compressed"] = \
                    self._compress_feature_vector(features["fast"]["avg_color_features"])
                del cache_data["features"]["fast"]["avg_color_features"]

            # 序列化并存储
            serialized_data = self._serialize_features(cache_data)

            pipe = client.pipeline()

            # 存储不同类型的特征
            for feature_type, feature_data in features.items():
                key = self._get_feature_key(image_id, feature_type)
                pipe.setex(
                    key,
                    ttl or self.default_ttl,
                    self._serialize_features({
                        **feature_data,
                        "image_id": image_id,
                        "version": self.feature_version,
                        "created_at": datetime.utcnow().isoformat()
                    })
                )

            # 存储元数据
            metadata_key = self._get_metadata_key(image_id)
            metadata = {
                "image_id": image_id,
                "feature_types": list(features.keys()),
                "created_at": datetime.utcnow().isoformat(),
                "version": self.feature_version,
                "ttl": ttl or self.default_ttl
            }
            pipe.setex(metadata_key, ttl or self.default_ttl, pickle.dumps(metadata))

            # 更新统计
            pipe.incr(self._get_stats_key("cache_operations"))
            pipe.incr(self._get_stats_key("cached_images"))

            await pipe.execute()

            logger.info(f"Successfully cached features for image {image_id}")
            return True

        except RedisError as e:
            logger.error(f"Failed to cache features for image {image_id}: {e}")
            return False

    async def get_image_features(self, image_id: str, feature_type: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        获取图像特征

        Args:
            image_id: 图像ID
            feature_type: 特征类型（fast, orb等），如果为None则获取所有特征

        Returns:
            特征数据或None
        """
        try:
            client = await self.async_redis_client

            if feature_type:
                # 获取特定类型的特征
                key = self._get_feature_key(image_id, feature_type)
                data = await client.get(key)

                if data:
                    features = self._deserialize_features(data)
                    # 解压缩特征向量
                    if "avg_color_features_compressed" in features:
                        features["avg_color_features"] = self._decompress_feature_vector(
                            features["avg_color_features_compressed"]
                        )
                        del features["avg_color_features_compressed"]

                    await client.incr(self._get_stats_key("cache_hits"))
                    return features
                else:
                    await client.incr(self._get_stats_key("cache_misses"))
                    return None
            else:
                # 获取所有特征类型
                metadata_key = self._get_metadata_key(image_id)
                metadata_data = await client.get(metadata_key)

                if not metadata_data:
                    await client.incr(self._get_stats_key("cache_misses"))
                    return None

                metadata = pickle.loads(metadata_data)
                feature_types = metadata.get("feature_types", [])

                all_features = {}
                pipe = client.pipeline()

                for f_type in feature_types:
                    key = self._get_feature_key(image_id, f_type)
                    pipe.get(key)

                results = await pipe.execute()

                for i, data in enumerate(results):
                    if data:
                        features = self._deserialize_features(data)
                        # 解压缩特征向量
                        if "avg_color_features_compressed" in features:
                            features["avg_color_features"] = self._decompress_feature_vector(
                                features["avg_color_features_compressed"]
                            )
                            del features["avg_color_features_compressed"]
                        all_features[feature_types[i]] = features

                if all_features:
                    await client.incr(self._get_stats_key("cache_hits"))
                    return {"image_id": image_id, "features": all_features}
                else:
                    await client.incr(self._get_stats_key("cache_misses"))
                    return None

        except RedisError as e:
            logger.error(f"Failed to get features for image {image_id}: {e}")
            await client.incr(self._get_stats_key("cache_errors"))
            return None

    async def batch_get_features(self, image_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        批量获取图像特征，提高性能

        Args:
            image_ids: 图像ID列表

        Returns:
            图像ID到特征数据的映射
        """
        results = {}

        try:
            client = await self.async_redis_client

            # 分批处理，避免一次性请求过多
            for i in range(0, len(image_ids), self.batch_size):
                batch_ids = image_ids[i:i + self.batch_size]
                pipe = client.pipeline()

                # 为每个图像获取元数据
                metadata_keys = [self._get_metadata_key(image_id) for image_id in batch_ids]
                for key in metadata_keys:
                    pipe.get(key)

                metadata_results = await pipe.execute()

                # 对于有元数据的图像，获取所有特征
                feature_requests = []
                valid_indices = []

                for j, metadata_data in enumerate(metadata_results):
                    if metadata_data:
                        metadata = pickle.loads(metadata_data)
                        feature_types = metadata.get("feature_types", [])

                        for f_type in feature_types:
                            feature_key = self._get_feature_key(batch_ids[j], f_type)
                            feature_requests.append(feature_key)
                            valid_indices.append((batch_ids[j], f_type))

                # 批量获取特征
                if feature_requests:
                    pipe = client.pipeline()
                    for key in feature_requests:
                        pipe.get(key)

                    feature_results = await pipe.execute()

                    # 组装结果
                    current_pos = 0
                    batch_results = {}

                    for image_id, f_type in valid_indices:
                        if current_pos < len(feature_results):
                            data = feature_results[current_pos]
                            current_pos += 1

                            if data and image_id not in batch_results:
                                batch_results[image_id] = {"features": {}}

                            if data:
                                features = self._deserialize_features(data)
                                # 解压缩特征向量
                                if "avg_color_features_compressed" in features:
                                    features["avg_color_features"] = self._decompress_feature_vector(
                                        features["avg_color_features_compressed"]
                                    )
                                    del features["avg_color_features_compressed"]
                                batch_results[image_id]["features"][f_type] = features

                    results.update(batch_results)

            # 更新统计
            await client.incrby(self._get_stats_key("cache_hits"), len(results))
            await client.incrby(self._get_stats_key("cache_misses"), len(image_ids) - len(results))

            logger.info(f"Batch retrieved features for {len(results)}/{len(image_ids)} images")
            return results

        except RedisError as e:
            logger.error(f"Failed to batch get features: {e}")
            await client.incr(self._get_stats_key("cache_errors"))
            return results

    async def invalidate_image_cache(self, image_id: str) -> bool:
        """
        使图像特征缓存失效

        Args:
            image_id: 图像ID

        Returns:
            bool: 是否成功
        """
        try:
            client = await self.async_redis_client

            # 获取元数据以了解有哪些特征类型
            metadata_key = self._get_metadata_key(image_id)
            metadata_data = await client.get(metadata_key)

            pipe = client.pipeline()

            if metadata_data:
                metadata = pickle.loads(metadata_data)
                feature_types = metadata.get("feature_types", [])

                # 删除所有特征键
                for f_type in feature_types:
                    key = self._get_feature_key(image_id, f_type)
                    pipe.delete(key)

            # 删除元数据键
            pipe.delete(metadata_key)

            await pipe.execute()

            # 更新统计
            await client.incr(self._get_stats_key("cache_invalidations"))

            logger.info(f"Successfully invalidated cache for image {image_id}")
            return True

        except RedisError as e:
            logger.error(f"Failed to invalidate cache for image {image_id}: {e}")
            return False

    async def get_cache_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        try:
            client = await self.async_redis_client

            stats_keys = [
                "cache_operations",
                "cached_images",
                "cache_hits",
                "cache_misses",
                "cache_errors",
                "cache_invalidations"
            ]

            pipe = client.pipeline()
            for key in stats_keys:
                pipe.get(self._get_stats_key(key))

            results = await pipe.execute()

            stats = {}
            for i, key in enumerate(stats_keys):
                value = results[i]
                stats[key] = int(value) if value else 0

            # 计算命中率
            total_requests = stats["cache_hits"] + stats["cache_misses"]
            hit_rate = stats["cache_hits"] / total_requests if total_requests > 0 else 0
            stats["hit_rate"] = round(hit_rate, 4)

            return stats

        except RedisError as e:
            logger.error(f"Failed to get cache stats: {e}")
            return {}

    async def cleanup_expired_features(self) -> int:
        """
        清理过期的特征数据

        Returns:
            清理的键数量
        """
        try:
            client = await self.async_redis_client

            # 使用SCAN模式查找所有特征键
            cursor = 0
            cleaned_count = 0

            while True:
                cursor, keys = await client.scan(
                    cursor=cursor,
                    match=f"{self.key_prefix}*",
                    count=1000
                )

                if keys:
                    # 检查TTL
                    pipe = client.pipeline()
                    for key in keys:
                        pipe.ttl(key)

                    ttls = await pipe.execute()

                    # 删除已过期的键
                    expired_keys = [keys[i] for i, ttl in enumerate(ttls) if ttl == -2]
                    if expired_keys:
                        await client.delete(*expired_keys)
                        cleaned_count += len(expired_keys)

                if cursor == 0:
                    break

            logger.info(f"Cleaned up {cleaned_count} expired feature keys")
            return cleaned_count

        except RedisError as e:
            logger.error(f"Failed to cleanup expired features: {e}")
            return 0

    async def close(self):
        """关闭Redis连接"""
        if self._async_redis_client:
            await self._async_redis_client.close()
        if self._redis_client:
            self._redis_client.close()

# 全局实例
feature_cache = ImageFeatureCache()