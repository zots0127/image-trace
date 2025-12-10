# Image Traceability Analysis - Backend MVP

本项目正在按 Clean Architecture + TDD 迭代。核心关注：
- 领域/用例无框架依赖，仓储/特征/缓存为外层实现。
- 真实业务夹具驱动测试，先红后绿再重构。

## 目录蓝图（核心相关）
```
backend/
  core/
    domain/            # 实体 + 抽象接口（无框架依赖）
    application/       # 用例（仅依赖抽象）
    infrastructure/    # SQLModel 仓储、特征/相似度、缓存、时钟实现
  tests/
    fixtures/          # 真实场景夹具（正常/损坏/4K 截图）
    application/       # 用例层单元测试
```

## TDD 快速上手
```bash
cd backend
pytest tests/application/test_start_analysis.py
pytest tests/integration/test_analysis_clean_route.py
# 如需真实端到端（需本地/compose 服务运行）：RUN_E2E=1 pytest tests/e2e/test_clean_flow.py
```
- 夹具：
  - `analysis_happy.json`：上传+文档提取双图，正常路径
  - `analysis_edge.json`：极小图 + 损坏图
  - `analysis_large.json`：4K 截图 + screenshot_mode

## 用例装配示例（Application + Infrastructure）
```python
from core.application.use_cases.start_analysis import StartAnalysisUseCase
from core.infrastructure.services.redis_feature_cache import RedisFeatureCache
from core.infrastructure.persistence.sqlmodel_project_repo import SqlModelProjectRepository
from core.infrastructure.persistence.sqlmodel_image_repo import SqlModelImageRepository
from core.infrastructure.persistence.sqlmodel_analysis_repo import SqlModelAnalysisRepository
from core.infrastructure.services.simple_feature_extractor import SimpleFeatureExtractor
from core.infrastructure.services.simple_similarity import SimpleSimilarity
from core.infrastructure.services.system_clock import SystemClock

def build_start_analysis_uc():
    return StartAnalysisUseCase(
        projects=SqlModelProjectRepository(),
        images=SqlModelImageRepository(),
        analyses=SqlModelAnalysisRepository(),
        feature_cache=RedisFeatureCache("redis://localhost:6379/1"),  # 生产使用 Redis
        extractor=SimpleFeatureExtractor(),    # 可替换为 ORB/AHash 生产版
        similarity=SimpleSimilarity(),
        clock=SystemClock(),
    )
```
- FastAPI 路由可直接依赖 `app.dependencies_analysis.get_start_analysis_use_case`，保持控制器只做 IO 转换。
- 新增路由 `/analysis/clean/start` 走 Clean Architecture 流程：
  - `project_id` (query)
  - `screenshot_mode` (query)
  - `parameters` (body JSON，可选)
- 请求示例：
  ```bash
  curl -X POST "http://localhost:8000/analysis/clean/start?project_id=UUID&screenshot_mode=false" \
       -H "Content-Type: application/json" \
       -d '{"parameters": {"match_percentile":70}}'
  ```
- 响应示例：
  ```json
  {
    "id": "...",
    "project_id": "...",
    "status": "completed",
    "progress": 1.0,
    "errors": [],
    "similarity": {
      "image_ids": ["...","..."],
      "scores": [[1.0,0.8],[0.8,1.0]]
    },
    "completed_at": "2025-12-08T00:00:00Z"
  }
  ```

## 后续建议
- 在接口层替换现有路由直连数据库的模式，改为依赖 `StartAnalysisUseCase`。
- 将缓存实现切换为 Redis 适配器，特征提取切换为生产 ORB/AHash 实现，保持接口不变。
- 增加 API 集成测试（TestClient + 临时 SQLite/Redis），验证路由-用例装配链路。

## 快速开始

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows 使用 .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

启动后访问 `http://127.0.0.1:8000/docs` 查看接口文档。

## Docker Compose 本地开发

```bash
# 在仓库根目录
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d backend-dev
# 访问接口/文档
open http://localhost:30080/health
open http://localhost:30080/docs
```

### 常用环境变量（与 compose.dev 对齐）
```
DATABASE_URL=postgresql+psycopg2://image_trace:image_trace_pw@postgres:5432/image_trace
REDIS_URL=redis://redis:6379/1
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_SECURE=false
PUBLIC_BASE_URL=http://localhost:30080
# 如需 Supabase 认证：
# SUPABASE_URL=
# SUPABASE_KEY=
```

### 数据库迁移（Alembic）
```bash
cd backend
alembic upgrade head
```
说明：
- `alembic.ini` 已指向环境变量 `DATABASE_URL`
- 首个迁移 `2025_12_08_0001_add_jsonb_and_indexes`：为分析结果添加 JSON 列，给 images/documents/analysis_results 增加常用索引

## MVP 使用流程

1. 创建项目：
   - POST `/api/projects`，Body 例如：
   - `{ "name": "demo", "description": "first project" }`
2. 批量上传图片：
   - POST `/api/upload/batch?project_id={项目ID}`
   - `form-data` 中添加多个 `files` 字段（类型为 File）。
3. 启动分析：
   - POST `/api/analysis/start?project_id={项目ID}`
   - 返回 `{ "id": "分析结果ID", "task_id": "任务ID" }`。
4. 查看分析结果：
   - GET `/api/analysis/results/{分析结果ID}`
   - 返回包含 `image_ids`、`features` 和 `similarity_matrix` 的 JSON，用于后续可视化。
