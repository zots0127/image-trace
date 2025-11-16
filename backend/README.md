# Image Traceability Analysis - Backend MVP

## 快速开始

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows 使用 .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

启动后访问 `http://127.0.0.1:8000/docs` 查看接口文档。

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
