#!/bin/bash

# 图片溯源分析系统 - 服务启动脚本

echo "🚀 启动图片溯源分析系统服务..."

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker daemon 未运行"
    echo "请先启动 Docker Desktop，然后重新运行此脚本"
    exit 1
fi

echo "✅ Docker daemon 正在运行"

# 启动基础设施服务
echo "📦 启动基础设施服务（Redis 和 MinIO）..."
docker-compose up -d

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
echo ""
echo "📊 服务状态："
docker-compose ps

echo ""
echo "✅ 基础设施服务已启动！"
echo ""
echo "📝 下一步："
echo "1. 启动后端：cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
echo "2. 启动前端：cd frontend && npm run dev"
echo ""
echo "🌐 服务地址："
echo "  - 后端 API: http://localhost:8000"
echo "  - 前端应用: http://localhost:8080"
echo "  - MinIO 控制台: http://localhost:9001 (用户名: minioadmin, 密码: minioadmin123)"
echo "  - Redis Commander: http://localhost:8081"

