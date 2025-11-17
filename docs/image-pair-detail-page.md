# 图片对比详情页面

## 功能概述

新增了一个独立的图片对比详情页面，用户可以从相似度矩阵点击"查看详情"按钮跳转到该页面，查看两张图片之间的详细匹配信息。

## 新增页面

### ImagePairDetail.tsx

路由：`/project/:projectId/analysis/:analysisId/pair?image1=<index>&image2=<index>`

**功能特性：**

1. **统计信息卡片**
   - 相似度百分比
   - 匹配点数量
   - 内点数量
   - 匹配质量

2. **特征点匹配可视化**
   - 并排对比视图（已实现）
     - 两张图片并排显示
     - 各自显示特征点分布
   - 叠加对比视图（待实现）
     - 将来可显示特征点连接线

3. **控制面板**
   - 显示/隐藏所有特征点
   - 匹配阈值滑动条（10-200）
   - 缩放控制（0.5x - 3x）

4. **详细统计**
   - 源图像特征点数量
   - 目标图像特征点数量
   - 匹配成功数量
   - 平均匹配距离

5. **工具栏**
   - 放大 (Zoom In)
   - 缩小 (Zoom Out)
   - 重置 (Reset)
   - 下载 (Download - 待实现)

## 更新的组件

### SimilarityMatrix.tsx

**新增功能：**

1. 接收 `projectId` 和 `analysisId` props
2. 在悬停信息中添加"查看详情"按钮
3. 点击按钮跳转到 `ImagePairDetail` 页面

**按钮位置：**
- 在悬停预览框的右上角
- 使用 `ExternalLink` 图标
- 只在提供了 projectId 和 analysisId 时显示

### ProjectAnalysis.tsx

**更新：**
- 向 `SimilarityMatrix` 组件传递 `projectId` 和 `analysisId` props

### App.tsx

**新增路由：**
```typescript
<Route
  path="/project/:projectId/analysis/:analysisId/pair"
  element={
    <ProtectedRoute>
      <ImagePairDetail />
    </ProtectedRoute>
  }
/>
```

## 用户体验流程

1. 用户在分析结果页面查看相似度矩阵
2. 鼠标悬停在感兴趣的单元格上
3. 看到快速预览和基本信息
4. 点击"查看详情"按钮
5. 跳转到专门的详情页面
6. 可以查看更详细的统计和可视化
7. 可以使用各种控制工具调整显示

## 数据流

```
ProjectAnalysis
  └─> SimilarityMatrix (带 projectId & analysisId)
        └─> 点击"查看详情"
              └─> 跳转到 ImagePairDetail
                    └─> 从URL参数获取 projectId, analysisId, image1, image2
                    └─> 加载完整的分析数据
                    └─> 提取对应的区域数据
                    └─> 显示详细可视化
```

## URL参数

- `projectId`: 项目ID
- `analysisId`: 分析结果ID
- `image1`: 第一张图片的索引
- `image2`: 第二张图片的索引

示例：
```
/project/abc123/analysis/def456/pair?image1=0&image2=1
```

## 后续优化方向

1. ✅ 实现叠加对比视图，显示特征点连接线
2. ✅ 实现下载功能，保存可视化结果
3. 添加更多分析指标（变换类型、置信度等）
4. 支持批量对比多个图片对
5. 添加导出报告功能

