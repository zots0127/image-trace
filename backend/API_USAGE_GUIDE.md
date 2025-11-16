# 图片溯源分析系统 API 使用指南

## 📋 目录
- [系统概述](#系统概述)
- [基础信息](#基础信息)
- [项目管理](#项目管理)
- [文档上传与处理](#文档上传与处理)
- [图片上传](#图片上传)
- [溯源分析](#溯源分析)
- [溯源查询](#溯源查询)
- [错误处理](#错误处理)
- [前端集成建议](#前端集成建议)

## 🎯 系统概述

本系统提供完整的图片溯源分析功能，支持：
- 📄 文档上传（PDF、DOCX、PPTX）并自动提取图片
- 🖼️ 直接图片上传
- 🔍 图片相似度分析
- 🔗 完整的溯源链路追踪

## 📊 基础信息

```
API地址: http://localhost:8000
文档地址: http://localhost:8000/docs
OpenAPI: http://localhost:8000/openapi.json
```

## 🗂️ 项目管理

### 1. 创建项目
```bash
curl -X POST "http://localhost:8000/projects" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "溯源分析项目",
       "description": "测试文档图片提取功能"
     }'
```

**响应示例：**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "溯源分析项目",
  "description": "测试文档图片提取功能",
  "status": "active",
  "created_at": "2025-11-15T07:30:00.000Z",
  "updated_at": "2025-11-15T07:30:00.000Z"
}
```

### 2. 获取项目列表
```bash
curl "http://localhost:8000/projects"
```

### 3. 获取项目详情
```bash
curl "http://localhost:8000/projects/PROJECT_ID"
```

## 📄 文档上传与处理

### 1. 上传文档
```bash
curl -X POST "http://localhost:8000/documents/upload?project_id=PROJECT_ID" \
     -H "Content-Type: multipart/form-data" \
     -F "file=@document.pdf"
```

**支持格式：**
- PDF: `.pdf`
- Word: `.docx`
- PowerPoint: `.pptx`
- 旧格式: `.doc`, `.ppt`

**响应示例：**
```json
{
  "id": "456e7890-e89b-12d3-a456-426614174001",
  "project_id": "123e4567-e89b-12d3-a456-426614174000",
  "filename": "document.pdf",
  "file_size": 2048576,
  "mime_type": "application/pdf",
  "processing_status": "pending",
  "public_url": "https://sotrages.0.af/image-trace-documents/2025/11/15/uuid.pdf",
  "message": "Document uploaded successfully. Image extraction started in background."
}
```

### 2. 检查处理状态
```bash
curl "http://localhost:8000/documents/DOCUMENT_ID"
```

**状态说明：**
- `pending`: 正在处理
- `completed`: 处理完成
- `failed`: 处理失败

### 3. 获取提取的图片
```bash
curl "http://localhost:8000/documents/DOCUMENT_ID/extracted-images"
```

**响应示例：**
```json
{
  "document_id": "456e7890-e89b-12d3-a456-426614174001",
  "document_filename": "document.pdf",
  "processing_status": "completed",
  "total_images": 3,
  "images": [
    {
      "id": "789e0123-e89b-12d3-a456-426614174002",
      "filename": "extracted_001.jpg",
      "file_size": 45678,
      "public_url": "https://sotrages.0.af/image-trace-extracted/2025/11/15/456e7890/extracted_001.jpg",
      "extraction_metadata": {
        "source_page": 1,
        "image_index": 1,
        "extraction_method": "pymupdf_embedded",
        "width": 800,
        "height": 600
      }
    }
  ]
}
```

### 4. 获取项目文档列表
```bash
curl "http://localhost:8000/documents/project/PROJECT_ID"
```

## 🖼️ 图片上传

### 批量上传图片
```bash
curl -X POST "http://localhost:8000/upload/batch?project_id=PROJECT_ID" \
     -H "Content-Type: multipart/form-data" \
     -F "files=@image1.jpg" \
     -F "files=@image2.png"
```

## 🔍 溯源分析

### 开始分析
```bash
curl -X POST "http://localhost:8000/analysis/start?mode=fast&project_id=PROJECT_ID"
```

**分析模式：**
- `fast`: 快速分析
- `detailed`: 详细分析

### 获取分析结果
```bash
curl "http://localhost:8000/analysis/results/TASK_ID"
```

## 🔗 溯源查询

### 1. 通过项目查看所有图片
```bash
curl "http://localhost:8000/projects/PROJECT_ID/images/"
```

### 2. 查看图片溯源信息
图片的溯源信息存储在 `image_metadata` 字段中：

```json
{
  "source": "document_extraction",
  "document_id": "456e7890-e89b-12d3-a456-426614174001",
  "document_filename": "document.pdf",
  "extraction_metadata": {
    "source_page": 1,
    "image_index": 3,
    "extraction_method": "pymupdf_embedded",
    "width": 800,
    "height": 600
  }
}
```

### 3. 溯源链路
```
原始文档 → 提取记录 → 主图片表 → 分析结果
    ↓           ↓         ↓         ↓
Document → ExtractedImage → Image → AnalysisResult
```

## ❌ 错误处理

### 常见错误码
- `400`: 请求参数错误
- `404`: 资源不存在
- `422`: 文件格式不支持
- `500`: 服务器内部错误

### 错误响应示例
```json
{
  "detail": "Unsupported file type: application/zip. Supported types: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']"
}
```

## 💻 前端集成建议

### 1. 项目管理页面
```javascript
// 创建项目
const createProject = async (name, description) => {
  const response = await fetch('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description })
  });
  return response.json();
};

// 获取项目列表
const getProjects = async () => {
  const response = await fetch('/projects');
  return response.json();
};
```

### 2. 文档上传组件
```javascript
// 上传文档
const uploadDocument = async (projectId, file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`/documents/upload?project_id=${projectId}`, {
    method: 'POST',
    body: formData
  });
  return response.json();
};

// 轮询处理状态
const pollDocumentStatus = async (documentId) => {
  const checkStatus = async () => {
    const doc = await fetch(`/documents/${documentId}`).then(r => r.json());
    if (doc.processing_status === 'completed') {
      return doc;
    } else if (doc.processing_status === 'failed') {
      throw new Error('Document processing failed');
    } else {
      setTimeout(checkStatus, 2000); // 2秒后重试
    }
  };
  return checkStatus();
};
```

### 3. 图片展示组件
```javascript
// 获取项目图片
const getProjectImages = async (projectId) => {
  const response = await fetch(`/projects/${projectId}/images/`);
  return response.json();
};

// 渲染溯源信息
const renderImageMetadata = (image) => {
  if (image.image_metadata) {
    const metadata = JSON.parse(image.image_metadata);
    if (metadata.source === 'document_extraction') {
      return `来源: ${metadata.document_filename} (第${metadata.extraction_metadata.source_page}页)`;
    }
  }
  return '直接上传';
};
```

### 4. 状态管理建议
```javascript
// 项目状态
const projectState = {
  projects: [],
  currentProject: null,
  documents: [],
  images: [],
  analyses: []
};

// 处理流程
const uploadFlow = async (projectId, file) => {
  try {
    // 1. 上传文档
    const doc = await uploadDocument(projectId, file);

    // 2. 显示处理状态
    showProcessingStatus(doc.id);

    // 3. 轮询处理结果
    const result = await pollDocumentStatus(doc.id);

    // 4. 更新UI
    updateProjectImages(projectId);

  } catch (error) {
    showError(error.message);
  }
};
```

## 📱 UI组件建议

### 1. 项目卡片
- 项目名称和描述
- 图片/文档统计
- 最近分析状态
- 操作按钮（查看、删除）

### 2. 文档上传区域
- 拖拽上传支持
- 文件格式验证
- 上传进度显示
- 处理状态实时更新

### 3. 图片画廊
- 缩略图展示
- 溯源信息标签
- 批量选择功能
- 相似度分析结果覆盖

### 4. 溯源信息面板
- 原始文档信息
- 提取位置详情
- 查看原始文档链接
- 导出溯源报告

## 🔄 完整工作流程示例

```javascript
// 1. 创建项目
const project = await createProject("测试项目", "文档溯源测试");

// 2. 上传文档
const doc = await uploadDocument(project.id, documentFile);

// 3. 等待处理完成
const processedDoc = await pollDocumentStatus(doc.id);

// 4. 获取提取的图片
const images = await fetch(`/documents/${doc.id}/extracted-images`).then(r => r.json());

// 5. 开始分析
const analysis = await fetch(`/analysis/start?mode=fast&project_id=${project.id}`, {
  method: 'POST'
}).then(r => r.json());

// 6. 获取分析结果
const results = await fetch(`/analysis/results/${analysis.task_id}`).then(r => r.json());

// 7. 显示溯源链路
displayTraceabilityChain(images.images, results);
```

## 📞 技术支持

如有问题，请查看：
- API文档：`http://localhost:8000/docs`
- 健康检查：`http://localhost:8000/health`
- 系统状态：`http://localhost:8000/health/stats`

---

**最后更新：** 2025-11-15
**版本：** v2.0.0