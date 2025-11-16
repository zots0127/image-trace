#!/bin/bash

# AI Image Traceability Analysis System - Docker启动脚本
# 使用方法: ./docker-start.sh [选项]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# 显示帮助信息
show_help() {
    cat << EOF
AI Image Traceability Analysis System - Docker启动脚本

使用方法:
    $0 [选项]

选项:
    -h, --help          显示帮助信息
    -b, --build         构建Docker镜像
    -u, --up            启动所有服务
    -d, --down          停止所有服务
    -r, --restart       重启所有服务
    -l, --logs          查看服务日志
    -s, --status        查看服务状态
    --build-only        仅构建，不启动
    --dev               开发模式启动
    --prod              生产模式启动

示例:
    $0 --build --up     构建并启动所有服务
    $0 --dev            开发模式启动
    $0 --down           停止所有服务

EOF
}

# 检查Docker是否运行
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_message $RED "错误: Docker未运行，请先启动Docker"
        exit 1
    fi
}

# 构建镜像
build_images() {
    print_message $BLUE "🔨 构建Docker镜像..."

    # 构建后端镜像
    print_message $YELLOW "构建后端镜像..."
    if ! docker-compose build backend; then
        print_message $RED "后端镜像构建失败"
        exit 1
    fi

    # 构建前端镜像
    print_message $YELLOW "构建前端镜像..."
    if ! docker-compose build frontend; then
        print_message $RED "前端镜像构建失败"
        exit 1
    fi

    print_message $GREEN "✅ 所有镜像构建完成"
}

# 启动服务
start_services() {
    local mode=${1:-"prod"}

    print_message $BLUE "🚀 启动服务 ($mode 模式)..."

    if [ "$mode" = "dev" ]; then
        # 开发模式：挂载源代码，启用热重载
        docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
    else
        # 生产模式
        docker-compose up -d
    fi

    # 等待服务启动
    print_message $YELLOW "等待服务启动..."
    sleep 10

    # 检查服务状态
    check_services

    print_message $GREEN "✅ 所有服务启动完成"
    show_service_info
}

# 停止服务
stop_services() {
    print_message $BLUE "🛑 停止服务..."
    docker-compose down
    print_message $GREEN "✅ 所有服务已停止"
}

# 重启服务
restart_services() {
    print_message $BLUE "🔄 重启服务..."
    docker-compose restart
    sleep 5
    check_services
    print_message $GREEN "✅ 所有服务重启完成"
}

# 查看日志
show_logs() {
    print_message $BLUE "📋 服务日志:"
    docker-compose logs -f
}

# 检查服务状态
check_services() {
    print_message $BLUE "🔍 检查服务状态..."

    local services=("backend:8000" "frontend:3000" "redis:6379" "minio:9000")
    local healthy_count=0

    for service in "${services[@]}"; do
        local name=$(echo $service | cut -d: -f1)
        local port=$(echo $service | cut -d: -f2)

        if docker-compose ps | grep -q "Up.*healthy"; then
            print_message $GREEN "✅ $name: 健康"
            ((healthy_count++))
        elif docker-compose ps | grep -q "Up"; then
            print_message $YELLOW "⚠️  $name: 运行中 (健康检查中)"
            ((healthy_count++))
        else
            print_message $RED "❌ $name: 未运行"
        fi
    done

    if [ $healthy_count -eq ${#services[@]} ]; then
        print_message $GREEN "🎉 所有服务运行正常"
    else
        print_message $YELLOW "⚠️  部分服务可能存在问题"
    fi
}

# 显示服务信息
show_service_info() {
    cat << EOF

🌐 服务访问地址:
    前端应用:     http://localhost:8080
    后端API:      http://localhost:8000
    API文档:      http://localhost:8000/docs
    MinIO控制台:  http://localhost:9001 (minioadmin/minioadmin123)
    Redis:        localhost:6379

🔧 管理命令:
    查看状态:     $0 --status
    查看日志:     $0 --logs
    停止服务:     $0 --down
    重启服务:     $0 --restart

EOF
}

# 查看服务状态
show_status() {
    print_message $BLUE "📊 服务状态:"
    docker-compose ps
    echo ""
    check_services
}

# 清理资源
cleanup() {
    print_message $BLUE "🧹 清理Docker资源..."
    docker-compose down -v --remove-orphans
    docker system prune -f
    print_message $GREEN "✅ 清理完成"
}

# 默认参数
BUILD=false
UP=false
DOWN=false
RESTART=false
LOGS=false
STATUS=false
BUILD_ONLY=false
MODE="prod"

# 解析命令行参数
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -b|--build)
            BUILD=true
            shift
            ;;
        -u|--up)
            UP=true
            shift
            ;;
        -d|--down)
            DOWN=true
            shift
            ;;
        -r|--restart)
            RESTART=true
            shift
            ;;
        -l|--logs)
            LOGS=true
            shift
            ;;
        -s|--status)
            STATUS=true
            shift
            ;;
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        --dev)
            MODE="dev"
            shift
            ;;
        --prod)
            MODE="prod"
            shift
            ;;
        --cleanup)
            cleanup
            exit 0
            ;;
        *)
            print_message $RED "未知选项: $1"
            show_help
            exit 1
            ;;
    esac
done

# 主逻辑
main() {
    check_docker

    if [ "$BUILD_ONLY" = true ]; then
        build_images
    elif [ "$DOWN" = true ]; then
        stop_services
    elif [ "$RESTART" = true ]; then
        restart_services
    elif [ "$LOGS" = true ]; then
        show_logs
    elif [ "$STATUS" = true ]; then
        show_status
    else
        if [ "$BUILD" = true ]; then
            build_images
        fi
        if [ "$UP" = true ] || [ "$BUILD" = true ]; then
            start_services $MODE
        fi

        # 如果没有指定任何操作，显示状态
        if [ "$BUILD" = false ] && [ "$UP" = false ]; then
            show_status
            show_service_info
        fi
    fi
}

# 运行主函数
main