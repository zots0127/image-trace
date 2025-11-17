# Redis连接错误修复

## 问题描述

分析任务失败，错误信息：
```
Unified analysis failed: unable to perform operation on <TCPTransport closed=True reading=False>; the handler is closed
```

## 根本原因

**事件循环绑定问题**：分析任务在新线程和新事件循环中运行，但Redis异步客户端的连接池绑定到旧的事件循环，导致连接关闭错误。

具体原因：
1. `_run_analysis_task_wrapper` 在新线程中创建新的事件循环
2. Redis异步连接池与原事件循环绑定
3. 在新事件循环中使用旧连接池导致 "closed connection" 错误
4. 代码中存在 `UnboundLocalError`，因为函数内部重复导入 `feature_cache`

## 修复方案

### 1. 在新事件循环开始时重置Redis连接

在 `routers_analysis.py` 的 `_run_analysis_task` 函数开始处：
```python
# 重要：在新事件循环中强制重置Redis连接
# 因为Redis异步客户端与事件循环绑定，必须在新循环中重新连接
await feature_cache._force_reconnect()
print("🔄 Redis connection reset for new event loop")
```

### 2. 改进Redis重连逻辑

在 `feature_cache.py` 中增强 `_force_reconnect` 方法：
- 正确关闭旧的连接和连接池
- 重置实例变量
- 在当前事件循环中创建新连接
- 执行ping测试确保连接可用

### 3. 清理重复导入

移除函数内部的 `from .feature_cache import feature_cache` 导入（第819行），使用文件顶部的全局导入（第17行），避免 `UnboundLocalError`。

### 4. 任务完成后清理连接

在 `finally` 块中关闭Redis连接，避免连接泄漏。

## 修改文件

1. `backend/app/routers_analysis.py`
   - 在 `_run_analysis_task` 开始时添加 Redis 重连
   - 移除重复的 feature_cache 导入
   - 在 finally 块添加连接清理

2. `backend/app/feature_cache.py`
   - 增强 `_force_reconnect` 方法
   - 添加连接测试和错误处理

## 测试方法

1. 确保Docker服务运行：`docker ps | grep redis`
2. 启动分析任务
3. 检查后端日志，应该看到：
   ```
   🔄 Redis connection reset for new event loop
   ✅ Redis connection: OK
   ```
4. 分析应该成功完成，不再出现连接关闭错误

## 技术要点

- **异步事件循环**: 每个事件循环需要独立的连接池
- **连接池管理**: 正确关闭和重建连接池
- **变量作用域**: 避免函数内部重复导入导致的作用域问题
- **资源清理**: 使用 finally 块确保资源被正确释放

## 日期

2025年11月17日

