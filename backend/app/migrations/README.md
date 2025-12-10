# 迁移说明

- 目前使用 SQLModel/SQLite/Postgres，建议通过 Alembic 管理迁移。
- 新增 JSON 列与索引的示例见下方 SQL。

## 示例：为 analysis_results 增加 JSON 列与索引
```sql
ALTER TABLE analysis_results ADD COLUMN parameters_json JSONB;
ALTER TABLE analysis_results ADD COLUMN results_json JSONB;
CREATE INDEX IF NOT EXISTS idx_analysis_project ON analysis_results (project_id);
CREATE INDEX IF NOT EXISTS idx_analysis_status ON analysis_results (status);
```

## 示例：为 images/documents 增加 checksum 索引
```sql
CREATE INDEX IF NOT EXISTS idx_images_project ON images (project_id);
CREATE INDEX IF NOT EXISTS idx_images_checksum ON images (checksum);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents (project_id);
CREATE INDEX IF NOT EXISTS idx_documents_checksum ON documents (checksum);
```

