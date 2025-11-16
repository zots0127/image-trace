from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import init_db
from .routers_projects import router as projects_router
from .routers_upload import router as upload_router
from .routers_analysis import router as analysis_router
from .routers_health import router as health_router
from .routers_auth import router as auth_router
from .routers_documents import router as documents_router

app = FastAPI(
    title="Image Traceability Analysis API",
    description="""
## 图片溯源分析系统 API

这是一个用于图片溯源分析的系统，支持：

### 🖼️ 图片上传功能
- 直接上传图片文件进行溯源分析
- 支持批量上传

### 📄 文档上传功能
- 上传PDF、DOCX、PPT、PPTX文档
- 自动提取文档中的图片
- 提取的图片自动纳入溯源分析

### 🔍 图片溯源分析
- 多种算法进行图片相似度分析
- 支持快速分析和详细分析模式
- 提供完整的溯源链路追踪

### 📊 项目管理
- 创建和管理分析项目
- 查看项目中的所有图片和分析结果

### 🔗 溯源关系
- 图片可追溯到原始文档
- 完整的元数据记录提取信息
- 支持混合项目（直接上传+文档提取）

**使用方式：**
1. 创建项目
2. 上传图片或文档
3. 等待文档处理完成
4. 开始分析
5. 查看结果和溯源信息

**API地址：** `http://localhost:8000`
**文档地址：** `http://localhost:8000/docs`
    """,
    version="2.0.0",
    contact={
        "name": "Image Traceability Team",
        "description": "图片溯源分析系统技术支持"
    }
)

# 允许所有来源访问API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有HTTP方法
    allow_headers=["*"],  # 允许所有请求头
)


@app.on_event("startup")
async def on_startup() -> None:
    init_db()


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok"}


app.include_router(health_router)
app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(upload_router)
app.include_router(documents_router)
app.include_router(analysis_router)
