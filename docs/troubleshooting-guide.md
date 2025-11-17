# 故障排查指南

## 图片对比详情页面问题

### 问题1：点击"查看详情"按钮没有跳转

**可能原因：**
1. `projectId` 或 `analysisId` 未正确传递
2. 路由配置错误
3. 浏览器控制台有JavaScript错误

**排查步骤：**
1. 打开浏览器开发者工具（F12）
2. 查看Console标签页
3. 点击"查看详情"按钮
4. 查看控制台输出：
   ```
   Navigating to: /project/{projectId}/analysis/{analysisId}/pair?image1=0&image2=1
   ```
5. 检查URL是否正确生成

**解决方案：**
- 确保在 `ProjectAnalysis.tsx` 中向 `SimilarityMatrix` 传递了 `projectId` 和 `analysisId`
- 检查路由配置在 `App.tsx` 中是否正确

### 问题2：详情页面显示"数据未找到"

**可能原因：**
1. 后端未返回 `pairwise_regions` 数据
2. 数据结构不匹配
3. 图片索引超出范围

**排查步骤：**
1. 打开浏览器开发者工具（F12）
2. 查看Console标签页
3. 查看以下日志：
   ```
   Loading image pair detail: {projectId, analysisId, image1Index, image2Index}
   Analysis data loaded: {...}
   Pairwise regions: [...]
   ORB data: {...}
   ```
4. 检查 `pairwise_regions` 数组是否为空
5. 检查 `image1Index` 和 `image2Index` 是否在有效范围内

**解决方案：**
- 确保后端分析完成且状态为 "completed"
- 确保使用的是ORB或混合分析方法（不是仅快速特征）
- 重新运行分析以生成最新数据

### 问题3：无法获取匹配点数据

**可能原因：**
1. 后端返回的数据结构与前端期望不一致
2. `matches` 数组为空
3. 相似度太低，未生成匹配数据

**排查步骤：**
1. 检查控制台日志中的 region 数据：
   ```
   Searching for region: {image1Index, image2Index, totalRegions}
   Found region: {...}
   ```
2. 确认 region 对象包含以下字段：
   - `matches`: Array (匹配点数据)
   - `keypoints1`: Array (图片1的特征点)
   - `keypoints2`: Array (图片2的特征点)
   - `similarity`: Number (相似度分数)

**解决方案：**
- 后端已更新为同时支持两种数据路径：
  - `results.pairwise_regions` (向后兼容)
  - `results.orb.pairwise_regions` (新路径)
- 如果使用旧的分析结果，请重新运行分析

## 后端数据结构

### 正确的返回格式

```json
{
  "analysis_id": "...",
  "status": "completed",
  "results": {
    "similarity_matrix": [[...]],
    "pairwise_regions": [...],  // 向后兼容
    "orb": {
      "pairwise_regions": [     // 推荐使用此路径
        {
          "image1_idx": 0,
          "image2_idx": 1,
          "similarity": 0.68,
          "match_count": 45,
          "inlier_count": 38,
          "matches": [
            {
              "queryIdx": 0,
              "trainIdx": 0,
              "distance": 25.5,
              "queryPoint": {"x": 100, "y": 200, "size": 5, "angle": 45},
              "trainPoint": {"x": 110, "y": 210, "size": 5, "angle": 47}
            }
          ],
          "keypoints1": [...],
          "keypoints2": [...]
        }
      ]
    }
  }
}
```

## 调试技巧

### 1. 启用详细日志

前端代码已添加详细的console.log输出：
- 页面加载时的参数
- API响应数据
- 区域查找过程
- 导航URL

### 2. 检查网络请求

1. 打开开发者工具 -> Network 标签
2. 过滤 "analysis" 请求
3. 查看响应数据结构
4. 验证status code是否为200

### 3. React DevTools

1. 安装 React DevTools 浏览器扩展
2. 查看组件状态：
   - `ImagePairDetail` 的 `analysis` state
   - `region` 计算结果
   - `images` 数组

## 常见错误信息

### "Missing projectId or analysisId"
- 检查URL参数是否正确
- 确保路由配置正确

### "No pairwise_regions found in analysis results"
- 分析结果不包含ORB数据
- 需要重新运行分析

### "Region not found for images"
- 请求的图片对没有匹配数据
- 可能相似度太低，未生成region
- 检查图片索引是否正确

### "数据未找到"
- projectId、analysisId、或图片索引无效
- API请求失败
- 查看控制台错误详情

## 性能优化建议

1. **大量图片时**：
   - 相似度矩阵会自动优化显示
   - 建议提高相似度阈值过滤低质量匹配

2. **详情页面加载慢**：
   - 检查网络连接
   - 图片可能较大，考虑压缩
   - 使用CDN加速图片加载

3. **内存占用高**：
   - 关闭不需要的浏览器标签
   - 清除浏览器缓存
   - 减少同时显示的匹配点数量

## 联系支持

如果以上方法都无法解决问题，请提供以下信息：
1. 浏览器控制台完整日志
2. 网络请求的响应数据
3. 使用的分析方法和参数
4. 重现步骤

