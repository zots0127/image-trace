#!/usr/bin/env python3
"""
MinIO存储服务测试脚本
"""

import os
import tempfile
from io import BytesIO
from app.minio_client import storage_service

def test_minio_connection():
    """测试MinIO连接和基本功能"""
    print("🚀 开始测试MinIO存储服务")
    print("="*50)

    # 1. 测试连接
    try:
        print("\n📡 测试MinIO连接...")
        # 通过列出存储桶来测试连接
        buckets = storage_service.client.list_buckets()
        bucket_names = [bucket.name for bucket in buckets]
        print(f"✅ 连接成功！发现存储桶: {bucket_names}")
    except Exception as e:
        print(f"❌ 连接失败: {e}")
        return

    # 2. 获取存储桶信息
    print("\n📊 获取存储桶信息...")
    for bucket_name in ["image-trace-uploads", "image-trace-analysis", "image-trace-temp"]:
        try:
            info = storage_service.get_bucket_info(bucket_name)
            print(f"  📦 {bucket_name}: {info['file_count']} 文件, {info['total_size_mb']} MB")
        except Exception as e:
            print(f"  ❌ {bucket_name}: {e}")

    # 3. 测试文件上传
    print("\n⬆️ 测试文件上传...")
    try:
        # 创建测试文件
        test_content = b"This is a test file for MinIO upload."
        test_file = BytesIO(test_content)

        # 上传文件
        result = storage_service.upload_file(
            file_data=test_file,
            filename="test.txt",
            content_type="text/plain"
        )
        print(f"✅ 文件上传成功!")
        print(f"  对象名称: {result['object_name']}")
        print(f"  存储桶: {result['bucket']}")
        print(f"  文件大小: {result['size']} bytes")
        print(f"  URL: {result['url']}")

        # 保存对象名称用于后续测试
        object_name = result['object_name']

    except Exception as e:
        print(f"❌ 文件上传失败: {e}")
        return

    # 4. 测试文件下载
    print("\n⬇️ 测试文件下载...")
    try:
        downloaded_data = storage_service.download_file(object_name)
        if downloaded_data == test_content:
            print("✅ 文件下载成功! 内容匹配")
        else:
            print("❌ 文件下载成功但内容不匹配")
    except Exception as e:
        print(f"❌ 文件下载失败: {e}")

    # 5. 测试预签名URL
    print("\n🔗 测试预签名URL...")
    try:
        url = storage_service.get_file_url(object_name)
        print(f"✅ 预签名URL生成成功: {url[:80]}...")
    except Exception as e:
        print(f"❌ 预签名URL生成失败: {e}")

    # 6. 列出文件
    print("\n📋 列出存储桶文件...")
    try:
        files = storage_service.list_files()
        print(f"✅ 发现 {len(files)} 个文件")
        for file in files[:3]:  # 只显示前3个
            print(f"  📄 {file['object_name']} ({file['size']} bytes)")
    except Exception as e:
        print(f"❌ 列出文件失败: {e}")

    # 7. 清理测试文件
    print("\n🗑️ 清理测试文件...")
    try:
        success = storage_service.delete_file(object_name)
        if success:
            print("✅ 测试文件删除成功")
        else:
            print("❌ 测试文件删除失败")
    except Exception as e:
        print(f"❌ 删除文件失败: {e}")

    print("\n" + "="*50)
    print("🎉 MinIO存储服务测试完成!")

def print_config_info():
    """打印配置信息"""
    print("\n📋 MinIO配置信息:")
    print(f"  端点: {os.getenv('MINIO_ENDPOINT', 'localhost:9000')}")
    print(f"  访问密钥: {os.getenv('MINIO_ACCESS_KEY', 'minioadmin')}")
    print(f"  安全模式: {os.getenv('MINIO_SECURE', 'false')}")
    print(f"  上传存储桶: image-trace-uploads")
    print(f"  分析存储桶: image-trace-analysis")
    print(f"  临时存储桶: image-trace-temp")

    print("\n🌐 MinIO控制台:")
    print("  Web UI: http://localhost:9001")
    print("  API: http://localhost:9000")
    print("  用户名: minioadmin")
    print("  密码: minioadmin123")

if __name__ == "__main__":
    print_config_info()
    test_minio_connection()