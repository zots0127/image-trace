# Image Trace - 简化版

一个极简的图像比对和文档图片提取系统。

## 核心功能

1. **文件处理** - 提取PDF/DOCX/PPTX中的图片
2. **特征计算** - 使用感知哈希算法
3. **图像比对** - 基于汉明距离的快速分组

## 系统架构

- **后端**: FastAPI + SQLite
- **存储**: 本地文件系统
- **图像处理**: PIL + imagehash
- **部署**: 单容器（可选Docker）

## 快速开始

### 方法1: 直接运行（推荐）

```bash
# 1. 进入简化版目录
cd backend_simplified

# 2. 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 3. 安装依赖
pip install -r requirements.txt

# 4. 运行应用
uvicorn app.main:app --reload
```

访问 http://localhost:8000 查看API文档

### 方法2: 使用Docker

```bash
# 使用简化版docker-compose
docker compose -f docker-compose.simplified.yml up
```

## API接口

### 项目管理
- `POST /projects` - 创建项目
- `GET /projects` - 获取项目列表
- `GET /projects/{id}` - 获取项目详情
- `DELETE /projects/{id}` - 删除项目

### 文件处理
- `POST /upload` - 上传文件（自动识别类型）
  - 支持：PDF、DOCX、PPTX、JPG、PNG等
  - 自动提取文档中的图片
  - 自动计算图像特征

### 图像比对
- `POST /compare/{project_id}` - 执行比对
  - 参数：threshold（阈值，默认0.85）
  - 参数：hash_type（哈希类型，默认phash）
- `GET /results/{project_id}` - 获取比对结果

### 其他
- `GET /images/{project_id}` - 获取项目中的图像列表
- `DELETE /images/{image_id}` - 删除图像
- `GET /download/{file_path}` - 下载文件
- `GET /health` - 健康检查

## 数据结构

```json
// 比对结果示例
{
  "project_id": 1,
  "total_images": 100,
  "groups": [
    {
      "group_id": 1,
      "similarity_score": 0.95,
      "images": [
        {
          "id": 1,
          "filename": "image1.jpg",
          "file_path": "data/uploads/image1.jpg",
          "phash": "...",
          "similarity_type": "exact_match"
        }
      ]
    }
  ],
  "unique_images": []
}
```

## 使用示例

### 1. 创建项目并上传文件

```bash
# 创建项目
curl -X POST "http://localhost:8000/projects" \
  -H "Content-Type: application/json" \
  -d '{"name": "测试项目", "description": "测试图片比对"}'

# 上传PDF文件
curl -X POST "http://localhost:8000/upload" \
  -F "project_id=1" \
  -F "file=@document.pdf"

# 上传图片文件
curl -X POST "http://localhost:8000/upload" \
  -F "project_id=1" \
  -F "file=@image.jpg"
```

### 2. 执行图像比对

```bash
# 使用默认设置比对
curl -X POST "http://localhost:8000/compare/1"

# 自定义相似度阈值（更严格）
curl -X POST "http://localhost:8000/compare/1" \
  -F "threshold=0.95"

# 使用不同的哈希算法
curl -X POST "http://localhost:8000/compare/1" \
  -F "hash_type=dhash"
```

## 性能特性

- **文件处理**: PDF图片提取 < 1秒/页
- **哈希计算**: < 0.1秒/图
- **相似度比对**: 1000张图片 < 1秒
- **总体性能**: 100张图片的项目 < 30秒完成

## 算法说明

### 哈希类型
- **phash** (感知哈希): 默认，抗缩放和压缩效果最好
- **dhash** (差异哈希): 对颜色变化敏感
- **ahash** (平均哈希): 最快，适合精确匹配
- **whash** (小波哈希): 对噪声和模糊有较好的鲁棒性

### 相似度阈值
- 0.95+ : 几乎完全相同
- 0.85-0.95: 高度相似（推荐）
- 0.70-0.85: 部分相似
- <0.70: 差异较大

## 项目结构

```
backend_simplified/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI应用
│   ├── models.py            # 数据模型
│   ├── image_processor.py   # 图像处理
│   ├── document_parser.py   # 文档解析
│   └── utils.py             # 工具函数
├── requirements.txt
├── Dockerfile
└── ...

data/                      # 数据存储
├── uploads/              # 上传文件
├── extracted/            # 提取的图片
└── database.db          # SQLite数据库
```

## 与原版对比

| 特性 | 原版 | 简化版 |
|------|------|--------|
| 代码量 | 10000+ 行 | ~2000 行 |
| 依赖服务 | Redis + MinIO + PostgreSQL | 无 |
| 部署方式 | 5个容器 | 1个容器或直接运行 |
| 学习成本 | 高 | 低 |
| 维护成本 | 高 | 低 |
| 性能 | 中等 | 更快（小数据量） |

## 扩展建议

如果需要更多功能，可以考虑：

1. **用户认证**: 添加JWT或OAuth
2. **批量处理**: 支持多文件同时上传
3. **结果导出**: 导出CSV或PDF报告
4. **API限流**: 使用slowapi等库
5. **前端界面**: 添加Vue/React前端

## 许可证

MIT License