# 相似度矩阵悬停特征点匹配功能

## 功能概述

当鼠标悬停在相似度矩阵的单元格上时，会显示两张图片之间的特征点匹配可视化，展示真实的特征点连接线。

## 实现细节

### 前端组件

1. **FeatureMatchingPreview.tsx** (新增)
   - 轻量级的特征点匹配预览组件
   - 使用Canvas绘制两张图片并排显示
   - 用不同颜色的连接线表示匹配质量：
     - 绿色：高质量匹配
     - 黄色：中等质量匹配
     - 红色：低质量匹配
   - 显示最多50个最佳匹配点
   - 自动缩放图片以适应显示区域

2. **SimilarityMatrix.tsx** (更新)
   - 添加了对`FeatureMatchingPreview`组件的导入和使用
   - 在悬停时从`orbData.pairwise_regions`中提取匹配数据
   - 自动处理索引顺序（确保显示正确的图片对应关系）

### 后端API

**routers_analysis.py** (更新)
- 返回的`pairwise_regions`数据现在包含：
  - `matches`: 配对的特征点匹配数据（包含queryPoint和trainPoint）
  - `keypoints1/keypoints2`: 所有特征点坐标
  - `image1_idx/image2_idx`: 图片索引（前端兼容）
  - `similarity`: 相似度分数（前端兼容）
  - 向后兼容的`feature_matches`字段

## 数据格式

### Match对象
```typescript
interface FeatureMatch {
  queryIdx: number;        // 源图像特征点索引
  trainIdx: number;        // 目标图像特征点索引
  distance: number;        // 匹配距离（越小越好）
  queryPoint: {           // 源图像特征点坐标
    x: number;
    y: number;
    size: number;
    angle: number;
  };
  trainPoint: {           // 目标图像特征点坐标
    x: number;
    y: number;
    size: number;
    angle: number;
  };
}
```

### Region对象
```python
{
    "image1_idx": 0,           # 图片1索引
    "image2_idx": 1,           # 图片2索引
    "similarity": 0.68,        # 相似度分数
    "match_count": 45,         # 匹配点数量
    "inlier_count": 38,        # 内点数量
    "matches": [...],          # 配对的匹配数据
    "keypoints1": [...],       # 图片1的所有特征点
    "keypoints2": [...]        # 图片2的所有特征点
}
```

## 用户体验

1. 将鼠标移动到相似度矩阵的任意非对角线单元格上
2. 等待片刻，下方会出现特征点匹配预览
3. 预览显示：
   - 两张图片并排展示
   - 蓝色点：源图像特征点
   - 绿色点：目标图像特征点
   - 彩色连线：特征点匹配连接（颜色表示质量）
   - 统计信息：相似度、匹配点数量

## 性能优化

- 最多显示50个最佳匹配点，避免过度绘制
- 图片自动缩放到合适尺寸（最大高度250px）
- 按匹配质量排序，优先显示最好的匹配

## 与弹窗的区别

- **悬停预览**: 快速浏览，轻量级，内嵌显示
- **点击弹窗**: 详细分析，全功能，可缩放、可调节参数

