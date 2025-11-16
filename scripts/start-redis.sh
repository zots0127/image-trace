#!/bin/bash

# Redis特征缓存启动脚本
# 用于启动图像特征缓存系统

echo "🚀 启动Redis特征缓存系统..."

# 检查Docker是否运行
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker未运行，请先启动Docker"
    exit 1
fi

# 检查docker-compose是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose未安装"
    exit 1
fi

# 切换到项目根目录
cd "$(dirname "$0")/.."

# 创建必要的目录
mkdir -p redis/data/master redis/data/slave1 redis/data/slave2

echo "📦 启动Redis服务..."

# 启动Redis（主从架构）
docker-compose -f docker-compose.redis.yml up -d redis-master redis-slave-1 redis-slave-2 redis-sentinel

# 等待Redis启动
echo "⏳ 等待Redis服务启动..."
sleep 10

# 检查Redis服务状态
echo "🔍 检查Redis服务状态..."
docker-compose -f docker-compose.redis.yml ps

# 启动Redis管理界面（可选）
echo "🌐 启动Redis管理界面..."
docker-compose -f docker-compose.redis.yml up -d redis-commander

# 测试Redis连接
echo "🧪 测试Redis连接..."
if docker exec image-trace-redis-master redis-cli ping | grep -q PONG; then
    echo "✅ Redis Master连接正常"
else
    echo "❌ Redis Master连接失败"
fi

if docker exec image-trace-redis-slave-1 redis-cli ping | grep -q PONG; then
    echo "✅ Redis Slave-1连接正常"
else
    echo "❌ Redis Slave-1连接失败"
fi

if docker exec image-trace-redis-slave-2 redis-cli ping | grep -q PONG; then
    echo "✅ Redis Slave-2连接正常"
else
    echo "❌ Redis Slave-2连接失败"
fi

echo ""
echo "🎉 Redis特征缓存系统启动完成！"
echo ""
echo "📊 Redis管理界面: http://localhost:8081"
echo "🔗 Redis Master: localhost:6379"
echo "🔗 Redis Slave-1: localhost:6380"
echo "🔗 Redis Slave-2: localhost:6381"
echo "🔍 Redis Sentinel: localhost:26379"
echo ""
echo "💡 使用以下命令查看日志："
echo "   docker-compose -f docker-compose.redis.yml logs -f redis-master"
echo ""
echo "💡 使用以下命令停止服务："
echo "   docker-compose -f docker-compose.redis.yml down"