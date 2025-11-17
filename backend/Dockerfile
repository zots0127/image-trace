# AI Image Traceability Analysis System - Backend Dockerfile
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 设置环境变量
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# 配置中科大镜像源
RUN sed -i 's|http://deb.debian.org|http://mirrors.ustc.edu.cn|g' /etc/apt/sources.list.d/debian.sources && \
    sed -i 's|http://security.debian.org|http://mirrors.ustc.edu.cn|g' /etc/apt/sources.list.d/debian.sources

# 安装系统依赖 - 分步骤安装以减少内存使用
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc g++ libpq-dev curl && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libgl1-mesa-glx:arm64 libgl1-mesa-dev || \
    apt-get install -y --no-install-recommends \
    libgl1-mesa-dev && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libgtk-3-0 libavcodec-dev libavformat-dev libswscale-dev && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# 配置pip中科大镜像源
RUN pip config set global.index-url https://pypi.mirrors.ustc.edu.cn/simple

# 复制requirements文件并安装Python依赖
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 复制应用代码
COPY . .

# 创建必要的目录
RUN mkdir -p /app/uploads /app/temp /app/logs

# 设置权限
RUN chmod +x /app/reset_database.sh 2>/dev/null || true

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# 启动命令
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]