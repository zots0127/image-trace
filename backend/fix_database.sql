-- 修复数据库结构 - 添加缺失的列

-- 检查 analysis_results 表结构
.schema analysis_results

-- 添加缺失的列（如果不存在）
ALTER TABLE analysis_results ADD COLUMN status VARCHAR(20) DEFAULT 'pending';
ALTER TABLE analysis_results ADD COLUMN progress REAL DEFAULT 0.0;
ALTER TABLE analysis_results ADD COLUMN error_message TEXT;

-- 验证表结构
.schema analysis_results