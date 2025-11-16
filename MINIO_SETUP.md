# MinIO对象存储配置

## 📋 概述

本项目使用MinIO作为对象存储后端，用于存储上传的图片、分析结果和临时文件。

## 🚀 快速启动

### 方法1: 使用启动脚本
```bash
./scripts/start-minio.sh
```

### 方法2: 手动启动
```bash
docker-compose up -d minio
```

## ⚙️ 配置信息

### 连接信息
- **API端点**: `http://localhost:9000`
- **Web控制台**: `http://localhost:9001`
- **用户名**: `minioadmin`
- **密码**: `minioadmin123`

### 存储桶
| 存储桶名称 | 用途 |
|-----------|------|
| `image-trace-uploads` | 用户上传的图片文件 |
| `image-trace-analysis` | 分析结果数据 |
| `image-trace-temp` | 临时文件 |

### 环境变量配置

创建 `.env` 文件：
```bash
# MinIO配置
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_SECURE=false
```

## 🔧 管理命令

### 查看服务状态
```bash
docker-compose ps minio
```

### 查看日志
```bash
docker-compose logs minio
```

### 停止服务
```bash
docker-compose down minio
```

### 重启服务
```bash
docker-compose restart minio
```

## 📊 监控

### 通过API监控
```bash
# 健康检查
curl http://localhost:9000/minio/health/live

# 服务统计（包含MinIO信息）
curl http://localhost:8000/health/stats
```

### 通过健康检查查看存储状态
```bash
curl -s "http://localhost:8000/health/stats" | python -m json.tool
```

## 🔒 安全注意事项

⚠️ **生产环境请务必：**

1. **修改默认密码**
   ```bash
   # 在.env文件中修改
   MINIO_ACCESS_KEY=your_access_key
   MINIO_SECRET_KEY=your_strong_password
   ```

2. **启用HTTPS**
   ```bash
   MINIO_SECURE=true
   ```

3. **配置反向代理**
   ```nginx
   server {
       listen 443 ssl;
       server_name your-domain.com;

       location /minio/ {
           proxy_pass http://localhost:9000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

## 🛠️ 故障排除

### 常见问题

1. **端口冲突**
   ```bash
   # 检查端口占用
   lsof -i :9000
   lsof -i :9001
   ```

2. **权限问题**
   ```bash
   # 检查Docker权限
   sudo usermod -aG docker $USER
   ```

3. **存储桶权限**
   ```bash
   # 重新创建存储桶
   docker run --rm --network image-trace_default minio/mc mb minio/image-trace-uploads
   ```

## 📚 客户端使用

### Python集成
```python
from app.minio_client import storage_service

# 上传文件
with open("image.jpg", "rb") as f:
    result = storage_service.upload_file(f, "image.jpg", "image/jpeg")

# 获取预签名URL
url = storage_service.get_file_url(result["object_name"])

# 下载文件
data = storage_service.download_file(result["object_name"])
```

### 命令行操作
```bash
# 设置MinIO客户端
docker run --rm --network image-trace_default minio/mc alias set minio http://minio:9000 minioadmin minioadmin123

# 列出文件
docker run --rm --network image-trace_default minio/mc ls minio/image-trace-uploads

# 上传文件
docker run --rm --network image-trace_default minio/mc cp ./test.txt minio/image-trace-uploads/
```

## 🔄 数据迁移

### 备份
```bash
# 导出数据
docker run --rm --network image-trace_default -v $(pwd):/backup minio/mc mirror minio/image-trace-uploads /backup/uploads
```

### 恢复
```bash
# 导入数据
docker run --rm --network image-trace_default -v $(pwd):/backup minio/mc mirror /backup/uploads minio/image-trace-uploads
```