import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ZoomIn, ZoomOut, RotateCw, Download } from "lucide-react";

interface FeaturePoint {
  x: number;
  y: number;
  size: number;
  angle: number;
}

interface FeatureMatches {
  source_keypoints: FeaturePoint[];
  target_keypoints: FeaturePoint[];
  source_image_size: [number, number];
  target_image_size: [number, number];
  match_distances: number[];
}

interface Region {
  source_index: number;
  target_index: number;
  score: number;
  match_count: number;
  inlier_count: number;
  total_source_features?: number;
  total_target_features?: number;
  source_document_filename?: string;
  target_document_filename?: string;
  is_cross_document?: boolean;
  quad_in_target: number[][];
  bbox_in_target: number[];
  feature_matches?: FeatureMatches;
}

interface FeatureMatchingVisualizationProps {
  regions: Region[];
  imageUrls: string[];
  imageFilenames: string[];
}

export function FeatureMatchingVisualization({
  regions,
  imageUrls,
  imageFilenames
}: FeatureMatchingVisualizationProps) {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [scales, setScales] = useState<number[]>([]);
  const [offsets, setOffsets] = useState<{ x: number; y: number }[]>([]);
  const [isDragging, setIsDragging] = useState<{ index: number; active: boolean } | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showOnlyInliers, setShowOnlyInliers] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // 筛选出有特征点匹配数据的区域，并按优先级排序
  // 优先级：1. 跨文档匹配（不同文件） 2. 相似度 3. 匹配质量
  const regionsWithMatches = regions
    .filter(region =>
      region.feature_matches &&
      region.feature_matches.source_keypoints.length > 0
    )
    .sort((a, b) => {
      // 优先显示跨文档匹配（不同文件的匹配）
      const aIsCrossDoc = a.is_cross_document === true;
      const bIsCrossDoc = b.is_cross_document === true;
      
      if (aIsCrossDoc && !bIsCrossDoc) return -1;
      if (!aIsCrossDoc && bIsCrossDoc) return 1;
      
      // 计算匹配点比例
      const aTotalFeatures = Math.max(
        a.total_source_features || 0,
        a.total_target_features || 0,
        a.feature_matches?.source_keypoints.length || 0
      );
      const bTotalFeatures = Math.max(
        b.total_source_features || 0,
        b.total_target_features || 0,
        b.feature_matches?.source_keypoints.length || 0
      );
      
      const aMatchRatio = aTotalFeatures > 0 ? a.match_count / aTotalFeatures : 0;
      const bMatchRatio = bTotalFeatures > 0 ? b.match_count / bTotalFeatures : 0;
      
      const aIsLowRatio = aMatchRatio < 0.15 && aTotalFeatures > 200 && a.match_count < 50;
      const bIsLowRatio = bMatchRatio < 0.15 && bTotalFeatures > 200 && b.match_count < 50;
      
      if (aIsLowRatio && !bIsLowRatio) return 1;
      if (!aIsLowRatio && bIsLowRatio) return -1;
      
      if (aIsLowRatio && bIsLowRatio) {
        if (Math.abs(a.score - b.score) < 0.01) {
          return b.match_count - a.match_count;
        }
        return b.score - a.score;
      }
      
      return b.score - a.score;
    });

  // 获取前5个匹配
  const top5Regions = regionsWithMatches.slice(0, 5);

  // 初始化scales和offsets
  useEffect(() => {
    if (scales.length !== top5Regions.length) {
      setScales(new Array(top5Regions.length).fill(1));
      setOffsets(new Array(top5Regions.length).fill({ x: 0, y: 0 }));
    }
  }, [top5Regions.length]);

  useEffect(() => {
    if (top5Regions.length > 0) {
      setIsLoading(true);
      Promise.all(top5Regions.map((_, index) => drawFeatureMatchesForRegion(index)))
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [top5Regions, scales, offsets, showOnlyInliers, imageUrls]);

  const drawFeatureMatchesForRegion = async (index: number) => {
    const region = top5Regions[index];
    const canvas = canvasRefs.current[index];
    if (!canvas || !region?.feature_matches) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { feature_matches } = region;
    const scale = scales[index] || 1;
    const offset = offsets[index] || { x: 0, y: 0 };
    const { source_keypoints, target_keypoints, source_image_size, target_image_size } = feature_matches;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 计算布局：两张图并排显示
    const padding = 50;
    const maxImageHeight = 300;

    const sourceScale = Math.min(maxImageHeight / source_image_size[1], 1);
    const targetScale = Math.min(maxImageHeight / target_image_size[1], 1);

    const sourceWidth = source_image_size[0] * sourceScale * scale;
    const sourceHeight = source_image_size[1] * sourceScale * scale;
    const targetWidth = target_image_size[0] * targetScale * scale;
    const targetHeight = target_image_size[1] * targetScale * scale;

    const totalWidth = sourceWidth + targetWidth + padding * 3;
    const totalHeight = Math.max(sourceHeight, targetHeight) + padding * 2 + 30; // 为标签留出空间

    canvas.width = totalWidth;
    canvas.height = totalHeight;

    // 绘制背景
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制源图像位置（为Source标签留出空间）
    const sourceX = padding + offset.x;
    const sourceY = padding + offset.y + 25; // 为Source标签留出空间

    // 绘制目标图像位置
    const targetX = sourceX + sourceWidth + padding + offset.x;
    const targetY = sourceY + offset.y;

    // 标注Source和Target
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Source', sourceX + sourceWidth / 2, sourceY - 10);
    ctx.fillText('Target', targetX + targetWidth / 2, targetY - 10);

    // 加载并绘制实际图像
    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        const timeout = setTimeout(() => {
          reject(new Error(`Image load timeout: ${url}`));
        }, 10000);
        
        img.onload = () => {
          clearTimeout(timeout);
          resolve(img);
        };
        
        img.onerror = (error) => {
          clearTimeout(timeout);
          console.error(`Failed to load image: ${url}`, error);
          reject(new Error(`Failed to load image: ${url}`));
        };
        
        let imageUrl = url;
        if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
          imageUrl = `http://localhost:8000${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
        }
        img.src = imageUrl.includes('?') ? `${imageUrl}&_t=${Date.now()}` : `${imageUrl}?_t=${Date.now()}`;
      });
    };

    const calculateImageDisplay = (
      canvasWidth: number, canvasHeight: number,
      imageWidth: number, imageHeight: number
    ) => {
      const imgAspect = imageWidth / imageHeight;
      const canvasAspect = canvasWidth / canvasHeight;

      let drawWidth, drawHeight, drawX, drawY;

      if (imgAspect > canvasAspect) {
        drawWidth = canvasWidth;
        drawHeight = canvasWidth / imgAspect;
        drawX = 0;
        drawY = (canvasHeight - drawHeight) / 2;
      } else {
        drawHeight = canvasHeight;
        drawWidth = canvasHeight * imgAspect;
        drawX = (canvasWidth - drawWidth) / 2;
        drawY = 0;
      }

      return { drawX, drawY, drawWidth, drawHeight };
    };

    let sourceDisplay = { drawX: sourceX, drawY: sourceY, drawWidth: sourceWidth, drawHeight: sourceHeight };
    let targetDisplay = { drawX: targetX, drawY: targetY, drawWidth: targetWidth, drawHeight: targetHeight };

    try {
      const sourceImg = await loadImage(imageUrls[region.source_index]);
      const targetImg = await loadImage(imageUrls[region.target_index]);

      sourceDisplay = calculateImageDisplay(sourceWidth, sourceHeight, sourceImg.width, sourceImg.height);
      targetDisplay = calculateImageDisplay(targetWidth, targetHeight, targetImg.width, targetImg.height);

      sourceDisplay.drawX += sourceX;
      sourceDisplay.drawY += sourceY;
      targetDisplay.drawX += targetX;
      targetDisplay.drawY += targetY;

      // 绘制源图像
      ctx.drawImage(sourceImg, sourceDisplay.drawX, sourceDisplay.drawY,
                   sourceDisplay.drawWidth, sourceDisplay.drawHeight);

      // 绘制目标图像
      ctx.drawImage(targetImg, targetDisplay.drawX, targetDisplay.drawY,
                   targetDisplay.drawWidth, targetDisplay.drawHeight);

      // 绘制边框
      ctx.strokeStyle = '#dee2e6';
      ctx.lineWidth = 2;
      ctx.strokeRect(sourceX, sourceY, sourceWidth, sourceHeight);
      ctx.strokeRect(targetX, targetY, targetWidth, targetHeight);

    } catch (error) {
      console.error('Failed to load images:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      
      ctx.fillStyle = '#e9ecef';
      ctx.fillRect(sourceX, sourceY, sourceWidth, sourceHeight);
      ctx.fillRect(targetX, targetY, targetWidth, targetHeight);
      ctx.strokeStyle = '#dc3545';
      ctx.lineWidth = 2;
      ctx.strokeRect(sourceX, sourceY, sourceWidth, sourceHeight);
      ctx.strokeRect(targetX, targetY, targetWidth, targetHeight);

      ctx.fillStyle = '#dc3545';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('图像加载失败', sourceX + sourceWidth / 2, sourceY + sourceHeight / 2 - 20);
      ctx.fillText('图像加载失败', targetX + targetWidth / 2, targetY + targetHeight / 2 - 20);
      
      ctx.fillStyle = '#6c757d';
      ctx.font = '12px sans-serif';
      ctx.fillText(imageFilenames[region.source_index] || `Image ${region.source_index + 1}`,
                   sourceX + sourceWidth / 2, sourceY + sourceHeight / 2 + 10);
      ctx.fillText(imageFilenames[region.target_index] || `Image ${region.target_index + 1}`,
                   targetX + targetWidth / 2, targetY + targetHeight / 2 + 10);
    }

    // 绘制特征点和连线
    ctx.globalAlpha = 0.6;

    const useInliersOnly = showOnlyInliers && region.inlier_count > 0;
    const matchCount = useInliersOnly ? region.inlier_count : source_keypoints.length;
    
    for (let i = 0; i < matchCount; i++) {
      const srcKp = source_keypoints[i];
      const dstKp = target_keypoints[i];

      const srcScaleX = sourceDisplay.drawWidth / source_image_size[0];
      const srcScaleY = sourceDisplay.drawHeight / source_image_size[1];
      const srcX = sourceDisplay.drawX + srcKp.x * srcScaleX;
      const srcY = sourceDisplay.drawY + srcKp.y * srcScaleY;

      const dstScaleX = targetDisplay.drawWidth / target_image_size[0];
      const dstScaleY = targetDisplay.drawHeight / target_image_size[1];
      const dstX = targetDisplay.drawX + dstKp.x * dstScaleX;
      const dstY = targetDisplay.drawY + dstKp.y * dstScaleY;

      let lineColor = '#00ff00';
      let lineAlpha = 0.6;
      
      if (useInliersOnly && region.inlier_count > 0) {
        lineColor = '#00ff00';
        lineAlpha = 0.8;
      } else if (!useInliersOnly && region.inlier_count > 0 && i >= region.inlier_count) {
        lineColor = '#888888';
        lineAlpha = 0.3;
      }

      // 绘制连线
      ctx.strokeStyle = lineColor === '#00ff00' ? 'rgba(0, 255, 0, ' + lineAlpha + ')' : 'rgba(136, 136, 136, ' + lineAlpha + ')';
      ctx.lineWidth = useInliersOnly ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(srcX, srcY);
      ctx.lineTo(dstX, dstY);
      ctx.stroke();

      // 绘制源图像中的特征点
      ctx.fillStyle = useInliersOnly ? '#ff0000' : '#ff6666';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(srcX, srcY, Math.max(3, srcKp.size * srcScaleX * 0.1), 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // 绘制目标图像中的特征点
      ctx.fillStyle = useInliersOnly ? '#0000ff' : '#6666ff';
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(dstX, dstY, Math.max(3, dstKp.size * dstScaleX * 0.1), 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }

    ctx.globalAlpha = 1.0;

    // 绘制图例和信息
    ctx.fillStyle = '#000000';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`匹配: ${matchCount}点`, 10, 20);
    ctx.fillText(`相似度: ${region.score.toFixed(3)}`, 10, 35);
    if (showOnlyInliers && region.inlier_count > 0) {
      ctx.fillText(`内点: ${region.inlier_count}`, 10, 50);
    }

    // 图例
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(10, totalHeight - 40, 10, 10);
    ctx.fillStyle = '#000000';
    ctx.fillText('Source特征点', 25, totalHeight - 32);

    ctx.fillStyle = '#0000ff';
    ctx.fillRect(10, totalHeight - 25, 10, 10);
    ctx.fillStyle = '#000000';
    ctx.fillText('Target特征点', 25, totalHeight - 17);
  };

  const handleZoomIn = (index: number) => {
    const newScales = [...scales];
    newScales[index] = Math.min((newScales[index] || 1) * 1.2, 3);
    setScales(newScales);
  };

  const handleZoomOut = (index: number) => {
    const newScales = [...scales];
    newScales[index] = Math.max((newScales[index] || 1) / 1.2, 0.5);
    setScales(newScales);
  };

  const handleReset = (index: number) => {
    const newScales = [...scales];
    const newOffsets = [...offsets];
    newScales[index] = 1;
    newOffsets[index] = { x: 0, y: 0 };
    setScales(newScales);
    setOffsets(newOffsets);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>, index: number) => {
    setIsDragging({ index, active: true });
    const offset = offsets[index] || { x: 0, y: 0 };
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging?.active) {
      const newOffsets = [...offsets];
      newOffsets[isDragging.index] = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      };
      setOffsets(newOffsets);
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(null);
  };

  const handleExportVisualization = (index: number) => {
    const canvas = canvasRefs.current[index];
    const region = top5Regions[index];
    if (!canvas || !region) return;

    const link = document.createElement('a');
    link.download = `feature-matches-${region.source_index}-${region.target_index}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>特征点匹配可视化 - Top 5</CardTitle>
        <CardDescription>
          自动显示前5个最佳匹配结果，绿色连线表示匹配的特征点对
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 全局控制 */}
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-2 text-sm">
            <input
              type="checkbox"
              checked={showOnlyInliers}
              onChange={(e) => setShowOnlyInliers(e.target.checked)}
              className="rounded"
            />
            <span>仅显示内点</span>
          </label>
        </div>

        {/* 显示前5个匹配 */}
        {top5Regions.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            没有找到匹配的图像对
          </div>
        ) : (
          <div className="space-y-6">
            {top5Regions.map((region, index) => (
              <div key={`${region.source_index}-${region.target_index}`} className="border rounded-lg p-4 space-y-3">
                {/* 匹配信息 */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {region.is_cross_document && (
                      <Badge variant="default" className="bg-blue-600 text-xs px-1.5 py-0">
                        跨文档
                      </Badge>
                    )}
                    <span className="font-medium">
                      图像 {region.source_index + 1} ↔ 图像 {region.target_index + 1}
                    </span>
                    <Badge variant="secondary">
                      相似度: {region.score.toFixed(3)}
                    </Badge>
                    <Badge variant="secondary">
                      匹配: {region.match_count}点
                    </Badge>
                    {region.inlier_count > 0 && (
                      <Badge variant="secondary">
                        内点: {region.inlier_count}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleZoomIn(index)}>
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleZoomOut(index)}>
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleReset(index)}>
                      <RotateCw className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExportVisualization(index)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* 文档信息 */}
                {(region.source_document_filename || region.target_document_filename) && (
                  <div className="text-xs text-muted-foreground">
                    {region.source_document_filename && `源文档: ${region.source_document_filename}`}
                    {region.source_document_filename && region.target_document_filename && " | "}
                    {region.target_document_filename && `目标文档: ${region.target_document_filename}`}
                  </div>
                )}

                {/* Canvas */}
                <div className="border rounded-lg overflow-auto bg-muted/30 p-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="text-muted-foreground">加载中...</div>
                    </div>
                  ) : (
                    <canvas
                      ref={(el) => {
                        canvasRefs.current[index] = el;
                      }}
                      onMouseDown={(e) => handleCanvasMouseDown(e, index)}
                      onMouseMove={handleCanvasMouseMove}
                      onMouseUp={handleCanvasMouseUp}
                      onMouseLeave={handleCanvasMouseUp}
                      className="cursor-move"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
