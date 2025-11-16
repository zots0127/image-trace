#!/usr/bin/env python3
"""
Redis特征缓存性能测试脚本
模拟上万用户和上亿张图像的场景
"""

import asyncio
import time
import random
import string
import json
import sys
import os
from typing import List, Dict, Any
import numpy as np

# 添加后端路径
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.feature_cache import ImageFeatureCache

class CachePerformanceTest:
    """Redis特征缓存性能测试类"""

    def __init__(self, redis_url: str = "redis://localhost:6379/1"):
        self.cache = ImageFeatureCache(redis_url)
        self.test_results = {}

    def generate_test_image_id(self, user_id: int, image_index: int) -> str:
        """生成测试图像ID"""
        return f"user_{user_id:06d}_img_{image_index:06d}"

    def generate_test_features(self) -> Dict[str, Any]:
        """生成测试特征数据"""
        return {
            "fast": {
                "avg_color_features": np.random.rand(3).tolist(),
                "ahash_features": np.random.randint(0, 2, 64).tolist()
            },
            "orb": {
                "keypoints_count": random.randint(100, 800),
                "descriptors_shape": [random.randint(100, 800), 32]
            }
        }

    async def test_basic_operations(self, num_images: int = 1000) -> Dict[str, Any]:
        """基础操作性能测试"""
        print(f"🧪 开始基础操作测试 ({num_images} 张图像)...")

        results = {
            "cache_writes": [],
            "cache_reads": [],
            "batch_reads": []
        }

        # 测试写入性能
        print("  📝 测试缓存写入...")
        start_time = time.time()

        tasks = []
        for i in range(num_images):
            image_id = self.generate_test_image_id(1, i)
            features = self.generate_test_features()
            tasks.append(self.cache.cache_image_features(image_id, features))

        await asyncio.gather(*tasks)
        write_time = time.time() - start_time

        results["cache_writes"] = {
            "total_images": num_images,
            "total_time": write_time,
            "images_per_second": num_images / write_time,
            "avg_time_per_image": (write_time / num_images) * 1000  # ms
        }

        print(f"    ✅ 写入完成: {num_images} 张图像，耗时 {write_time:.2f}s，速度 {num_images/write_time:.1f} images/s")

        # 测试单个读取性能
        print("  📖 测试单个缓存读取...")
        start_time = time.time()

        for i in range(num_images):
            image_id = self.generate_test_image_id(1, i)
            await self.cache.get_image_features(image_id)

        read_time = time.time() - start_time

        results["cache_reads"] = {
            "total_images": num_images,
            "total_time": read_time,
            "images_per_second": num_images / read_time,
            "avg_time_per_image": (read_time / num_images) * 1000  # ms
        }

        print(f"    ✅ 读取完成: {num_images} 张图像，耗时 {read_time:.2f}s，速度 {num_images/read_time:.1f} images/s")

        # 测试批量读取性能
        print("  📚 测试批量缓存读取...")
        image_ids = [self.generate_test_image_id(1, i) for i in range(num_images)]

        start_time = time.time()
        await self.cache.batch_get_features(image_ids)
        batch_read_time = time.time() - start_time

        results["batch_reads"] = {
            "total_images": num_images,
            "total_time": batch_read_time,
            "images_per_second": num_images / batch_read_time,
            "avg_time_per_image": (batch_read_time / num_images) * 1000  # ms
        }

        print(f"    ✅ 批量读取完成: {num_images} 张图像，耗时 {batch_read_time:.2f}s，速度 {num_images/batch_read_time:.1f} images/s")

        return results

    async def test_concurrent_access(self, num_users: int = 100, images_per_user: int = 50) -> Dict[str, Any]:
        """并发访问性能测试"""
        print(f"👥 开始并发访问测试 ({num_users} 用户，每人 {images_per_user} 张图像)...")

        results = {
            "total_operations": num_users * images_per_user,
            "concurrent_users": num_users,
            "total_time": 0,
            "operations_per_second": 0
        }

        async def user_tasks(user_id: int):
            """模拟单个用户的操作"""
            tasks = []
            for img_idx in range(images_per_user):
                image_id = self.generate_test_image_id(user_id, img_idx)
                features = self.generate_test_features()

                # 随机选择操作类型（70%读取，30%写入）
                if random.random() < 0.7:
                    # 读取操作
                    tasks.append(self.cache.get_image_features(image_id))
                else:
                    # 写入操作
                    tasks.append(self.cache.cache_image_features(image_id, features))

            await asyncio.gather(*tasks)

        # 启动所有用户任务
        start_time = time.time()
        all_user_tasks = [user_tasks(user_id) for user_id in range(num_users)]
        await asyncio.gather(*all_user_tasks)
        total_time = time.time() - start_time

        results["total_time"] = total_time
        results["operations_per_second"] = results["total_operations"] / total_time

        print(f"    ✅ 并发测试完成: {results['total_operations']} 个操作，耗时 {total_time:.2f}s，速度 {results['operations_per_second']:.1f} ops/s")

        return results

    async def test_memory_usage(self, num_images: int = 10000) -> Dict[str, Any]:
        """内存使用测试"""
        print(f"💾 开始内存使用测试 ({num_images} 张图像)...")

        # 获取初始内存使用
        client = await self.cache.async_redis_client
        initial_info = await client.info("memory")
        initial_memory = initial_info.get("used_memory", 0)

        # 写入大量图像特征
        print("  📝 写入大量图像特征...")
        batch_size = 100
        for batch_start in range(0, num_images, batch_size):
            batch_end = min(batch_start + batch_size, num_images)
            tasks = []

            for i in range(batch_start, batch_end):
                image_id = self.generate_test_image_id(2, i)
                features = self.generate_test_features()
                tasks.append(self.cache.cache_image_features(image_id, features))

            await asyncio.gather(*tasks)

            if batch_end % 1000 == 0:
                print(f"    已处理 {batch_end}/{num_images} 张图像...")

        # 获取最终内存使用
        final_info = await client.info("memory")
        final_memory = final_info.get("used_memory", 0)

        memory_used = final_memory - initial_memory
        memory_per_image = memory_used / num_images

        results = {
            "total_images": num_images,
            "memory_used_bytes": memory_used,
            "memory_used_mb": memory_used / (1024 * 1024),
            "memory_per_image_bytes": memory_per_image,
            "memory_per_image_kb": memory_per_image / 1024
        }

        print(f"    ✅ 内存测试完成: {results['memory_used_mb']:.2f} MB 总共，{results['memory_per_image_kb']:.2f} KB 每张图像")

        return results

    async def test_cache_efficiency(self, num_images: int = 5000) -> Dict[str, Any]:
        """缓存效率测试（命中率）"""
        print(f"🎯 开始缓存效率测试 ({num_images} 张图像)...")

        # 第一阶段：预热缓存
        print("  🔥 预热缓存...")
        for i in range(num_images):
            image_id = self.generate_test_image_id(3, i)
            features = self.generate_test_features()
            await self.cache.cache_image_features(image_id, features)

        # 获取初始统计
        initial_stats = await self.cache.get_cache_stats()

        # 第二阶段：混合读写操作
        print("  🔄 执行混合读写操作...")
        operations = num_images * 2  # 2倍数量的操作

        for i in range(operations):
            image_id = self.generate_test_image_id(3, random.randint(0, num_images - 1))

            if random.random() < 0.8:  # 80%读取操作
                await self.cache.get_image_features(image_id)
            else:  # 20%写入操作
                features = self.generate_test_features()
                await self.cache.cache_image_features(image_id, features)

        # 获取最终统计
        final_stats = await self.cache.get_cache_stats()

        # 计算缓存效率
        hits_during_test = final_stats.get("cache_hits", 0) - initial_stats.get("cache_hits", 0)
        misses_during_test = final_stats.get("cache_misses", 0) - initial_stats.get("cache_misses", 0)
        total_requests = hits_during_test + misses_during_test

        hit_rate = hits_during_test / total_requests if total_requests > 0 else 0

        results = {
            "total_operations": operations,
            "cache_hits": hits_during_test,
            "cache_misses": misses_during_test,
            "hit_rate": hit_rate,
            "final_stats": final_stats
        }

        print(f"    ✅ 效率测试完成: 命中率 {hit_rate:.2%} ({hits_during_test}/{total_requests})")

        return results

    async def run_all_tests(self) -> Dict[str, Any]:
        """运行所有测试"""
        print("🚀 开始Redis特征缓存性能测试套件")
        print("=" * 60)

        all_results = {}

        try:
            # 基础操作测试
            all_results["basic_operations"] = await self.test_basic_operations(1000)
            print()

            # 并发访问测试
            all_results["concurrent_access"] = await self.test_concurrent_access(50, 20)
            print()

            # 内存使用测试
            all_results["memory_usage"] = await self.test_memory_usage(5000)
            print()

            # 缓存效率测试
            all_results["cache_efficiency"] = await self.test_cache_efficiency(2000)
            print()

        except Exception as e:
            print(f"❌ 测试过程中发生错误: {e}")
            all_results["error"] = str(e)

        finally:
            # 清理测试数据
            print("🧹 清理测试数据...")
            await self.cache.cleanup_expired_features()

        return all_results

    def print_summary(self, results: Dict[str, Any]):
        """打印测试结果摘要"""
        print("\n" + "=" * 60)
        print("📊 测试结果摘要")
        print("=" * 60)

        if "error" in results:
            print(f"❌ 测试失败: {results['error']}")
            return

        # 基础操作结果
        if "basic_operations" in results:
            basic = results["basic_operations"]
            print(f"🔧 基础操作:")
            print(f"   写入速度: {basic['cache_writes']['images_per_second']:.1f} images/s")
            print(f"   读取速度: {basic['cache_reads']['images_per_second']:.1f} images/s")
            print(f"   批量读取速度: {basic['batch_reads']['images_per_second']:.1f} images/s")

        # 并发访问结果
        if "concurrent_access" in results:
            concurrent = results["concurrent_access"]
            print(f"👥 并发访问:")
            print(f"   并发用户数: {concurrent['concurrent_users']}")
            print(f"   操作速度: {concurrent['operations_per_second']:.1f} ops/s")

        # 内存使用结果
        if "memory_usage" in results:
            memory = results["memory_usage"]
            print(f"💾 内存使用:")
            print(f"   每张图像内存: {memory['memory_per_image_kb']:.2f} KB")
            print(f"   总内存使用: {memory['memory_used_mb']:.2f} MB")

        # 缓存效率结果
        if "cache_efficiency" in results:
            efficiency = results["cache_efficiency"]
            print(f"🎯 缓存效率:")
            print(f"   命中率: {efficiency['hit_rate']:.2%}")

        print("\n✅ 所有测试完成！")


async def main():
    """主函数"""
    test = CachePerformanceTest()

    # 检查Redis连接
    try:
        client = await test.cache.async_redis_client
        await client.ping()
        print("✅ Redis连接正常")
    except Exception as e:
        print(f"❌ Redis连接失败: {e}")
        print("请确保Redis服务正在运行: ./scripts/start-redis.sh")
        return

    # 运行测试
    results = await test.run_all_tests()

    # 打印摘要
    test.print_summary(results)

    # 保存详细结果
    with open("cache_performance_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)

    print(f"\n📁 详细测试结果已保存到: cache_performance_results.json")


if __name__ == "__main__":
    asyncio.run(main())