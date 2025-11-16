#!/bin/bash

# MinIO服务启动脚本

echo "🚀 启动MinIO对象存储服务..."

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker未运行，请先启动Docker"
    exit 1
fi

# 切换到项目根目录
cd "$(dirname "$0")/.."

# 启动MinIO
echo "📦 启动MinIO容器..."
docker-compose up -d minio

# 等待MinIO启动
echo "⏳ 等待MinIO服务启动..."
sleep 10

# 检查MinIO健康状态
echo "🔍 检查MinIO服务状态..."
if curl -s http://localhost:9000/minio/health/live > /dev/null; then
    echo "✅ MinIO API服务正常"
else
    echo "❌ MinIO API服务异常"
    exit 1
fi

# 创建存储桶（如果不存在）
echo "📁 创建存储桶..."
docker run --rm --network image-trace_default minio/mc alias set minio http://minio:9000 minioadmin minioadmin123 > /dev/null 2>&1

for bucket in "image-trace-uploads" "image-trace-analysis" "image-trace-temp"; do
    docker run --rm --network image-trace_default minio/mc mb minio/$bucket --ignore-existing > /dev/null 2>&1
    echo "✅ 存储桶 $bucket 已就绪"
done

echo ""
echo "🎉 MinIO服务启动完成！"
echo ""
echo "📋 服务信息:"
echo "  API端点: http://localhost:9000"
echo "  控制台: http://localhost:9001"
echo "  用户名: minioadmin"
echo "  密码: minioadmin123"
echo ""
echo "📦 存储桶:"
echo "  - image-trace-uploads: 图片上传"
echo "  - image-trace-analysis: 分析结果"
echo "  - image-trace-temp: 临时文件"
echo ""
echo "🌐 访问Web控制台:"
echo "  open http://localhost:9001"