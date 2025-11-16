import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showOnlyInliers, setShowOnlyInliers] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // 筛选出有特征点匹配数据的区域
  const regionsWithMatches = regions.filter(region =>
    region.feature_matches &&
    region.feature_matches.source_keypoints.length > 0
  );

  useEffect(() => {
    if (selectedRegion && canvasRef.current) {
      setIsLoading(true);
      drawFeatureMatches()
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [selectedRegion, scale, offset, showOnlyInliers]);

  const drawFeatureMatches = async () => {
    if (!canvasRef.current || !selectedRegion?.feature_matches) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { feature_matches } = selectedRegion;
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

    const totalWidth = sourceWidth + targetWidth + padding * 2;
    const totalHeight = Math.max(sourceHeight, targetHeight) + padding * 2;

    canvas.width = totalWidth;
    canvas.height = totalHeight;

    // 绘制背景
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制源图像
    const sourceX = padding + offset.x;
    const sourceY = padding + offset.y;

    // 绘制目标图像
    const targetX = sourceX + sourceWidth + padding;
    const targetY = sourceY;

    // 加载并绘制实际图像
    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // 允许跨域图像加载
        img.onload = () => resolve(img);
        img.onerror = () => {
          console.warn(`Failed to load image: ${url}`);
          reject(new Error(`Failed to load image: ${url}`));
        };
        // 添加时间戳避免缓存问题
        img.src = url.includes('?') ? `${url}&_t=${Date.now()}` : `${url}?_t=${Date.now()}`;
      });
    };

    // 计算图像实际绘制位置和尺寸（保持宽高比）
    const calculateImageDisplay = (
      canvasWidth: number, canvasHeight: number,
      imageWidth: number, imageHeight: number
    ) => {
      const imgAspect = imageWidth / imageHeight;
      const canvasAspect = canvasWidth / canvasHeight;

      let drawWidth, drawHeight, drawX, drawY;

      if (imgAspect > canvasAspect) {
        // 图像更宽，以宽度为准
        drawWidth = canvasWidth;
        drawHeight = canvasWidth / imgAspect;
        drawX = 0;
        drawY = (canvasHeight - drawHeight) / 2;
      } else {
        // 图像更高，以高度为准
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
      const sourceImg = await loadImage(imageUrls[selectedRegion.source_index]);
      const targetImg = await loadImage(imageUrls[selectedRegion.target_index]);

      // 计算实际显示位置
      sourceDisplay = calculateImageDisplay(sourceWidth, sourceHeight, sourceImg.width, sourceImg.height);
      targetDisplay = calculateImageDisplay(targetWidth, targetHeight, targetImg.width, targetImg.height);

      // 调整到画布坐标
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
      ctx.strokeRect(sourceX, sourceY, sourceWidth, sourceHeight);
      ctx.strokeRect(targetX, targetY, targetWidth, targetHeight);

    } catch (error) {
      console.warn('Failed to load images:', error);
      // 降级到占位符
      ctx.fillStyle = '#e9ecef';
      ctx.fillRect(sourceX, sourceY, sourceWidth, sourceHeight);
      ctx.fillRect(targetX, targetY, targetWidth, targetHeight);
      ctx.strokeStyle = '#dee2e6';
      ctx.strokeRect(sourceX, sourceY, sourceWidth, sourceHeight);
      ctx.strokeRect(targetX, targetY, targetWidth, targetHeight);

      ctx.fillStyle = '#6c757d';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(imageFilenames[selectedRegion.source_index] || `Image ${selectedRegion.source_index + 1}`,
                   sourceX + sourceWidth / 2, sourceY + sourceHeight / 2);
      ctx.fillText(imageFilenames[selectedRegion.target_index] || `Image ${selectedRegion.target_index + 1}`,
                   targetX + targetWidth / 2, targetY + targetHeight / 2);
    }

    // 绘制特征点和连线
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;

    const matches = showOnlyInliers ?
      source_keypoints.slice(0, selectedRegion.inlier_count) :
      source_keypoints;

    for (let i = 0; i < matches.length; i++) {
      const srcKp = source_keypoints[i];
      const dstKp = target_keypoints[i];

      // 计算特征点在图像显示区域中的实际位置
      // 源图像特征点坐标
      const srcScaleX = sourceDisplay.drawWidth / source_image_size[0];
      const srcScaleY = sourceDisplay.drawHeight / source_image_size[1];
      const srcX = sourceDisplay.drawX + srcKp.x * srcScaleX;
      const srcY = sourceDisplay.drawY + srcKp.y * srcScaleY;

      // 目标图像特征点坐标
      const dstScaleX = targetDisplay.drawWidth / target_image_size[0];
      const dstScaleY = targetDisplay.drawHeight / target_image_size[1];
      const dstX = targetDisplay.drawX + dstKp.x * dstScaleX;
      const dstY = targetDisplay.drawY + dstKp.y * dstScaleY;

      // 绘制连线
      ctx.strokeStyle = `rgba(0, 255, 0, ${0.3 + (1 - srcKp.size / 50) * 0.4})`; // 根据特征点大小调整透明度
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(srcX, srcY);
      ctx.lineTo(dstX, dstY);
      ctx.stroke();

      // 绘制源图像中的特征点
      ctx.fillStyle = '#ff0000';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(srcX, srcY, Math.max(3, srcKp.size * srcScaleX * 0.1), 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // 绘制目标图像中的特征点
      ctx.fillStyle = '#0000ff';
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(dstX, dstY, Math.max(3, dstKp.size * dstScaleX * 0.1), 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }

    ctx.globalAlpha = 1.0;

    // 绘制图例
    ctx.fillStyle = '#000000';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`匹配点数: ${matches.length}`, 10, 20);
    ctx.fillText(`相似度: ${selectedRegion.score.toFixed(3)}`, 10, 40);

    if (showOnlyInliers) {
      ctx.fillText(`内点数: ${selectedRegion.inlier_count}`, 10, 60);
    }

    // 图例
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(10, 80, 10, 10);
    ctx.fillStyle = '#000000';
    ctx.fillText('源图像特征点', 25, 89);

    ctx.fillStyle = '#0000ff';
    ctx.fillRect(10, 100, 10, 10);
    ctx.fillStyle = '#000000';
    ctx.fillText('目标图像特征点', 25, 109);
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev * 1.2, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev / 1.2, 0.5));
  const handleReset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const handleExportVisualization = () => {
    if (!canvasRef.current) return;

    const link = document.createElement('a');
    link.download = `feature-matches-${selectedRegion?.source_index}-${selectedRegion?.target_index}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>特征点匹配可视化</CardTitle>
        <CardDescription>
          显示ORB特征点匹配结果，绿色连线表示匹配的特征点对
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 区域选择 */}
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">选择图像匹配对</label>
            <Select
              value={selectedRegion ? `${selectedRegion.source_index}-${selectedRegion.target_index}` : ""}
              onValueChange={(value) => {
                const [sourceIdx, targetIdx] = value.split('-').map(Number);
                const region = regionsWithMatches.find(r =>
                  r.source_index === sourceIdx && r.target_index === targetIdx
                );
                setSelectedRegion(region || null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择要可视化的匹配对" />
              </SelectTrigger>
              <SelectContent>
                {regionsWithMatches.map((region, index) => (
                  <SelectItem
                    key={index}
                    value={`${region.source_index}-${region.target_index}`}
                  >
                    图像 {region.source_index + 1} ↔ 图像 {region.target_index + 1}
                    (相似度: {region.score.toFixed(3)}, 匹配: {region.match_count}个)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRegion && (
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">
                匹配数: {selectedRegion.match_count}
              </Badge>
              <Badge variant="secondary">
                内点数: {selectedRegion.inlier_count}
              </Badge>
              <Badge variant="secondary">
                相似度: {selectedRegion.score.toFixed(3)}
              </Badge>
            </div>
          )}
        </div>

        {/* 控制按钮 */}
        {selectedRegion && (
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportVisualization}>
              <Download className="h-4 w-4" />
              导出图片
            </Button>
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
        )}

        {/* 可视化画布 */}
        {selectedRegion ? (
          <div className="border rounded-lg overflow-auto bg-gray-50 p-4 relative">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  <span className="text-sm text-gray-600">正在加载图像...</span>
                </div>
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="border border-gray-300 bg-white cursor-move"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            />
          </div>
        ) : (
          <div className="border rounded-lg p-8 text-center text-gray-500 bg-gray-50">
            请选择一个图像匹配对来显示特征点匹配可视化
          </div>
        )}

        {/* 提示信息 */}
        {selectedRegion && (
          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
            <p><strong>操作说明：</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li><span className="text-red-600 font-semibold">红色圆点</span>：源图像中的ORB特征点（带白色边框）</li>
              <li><span className="text-blue-600 font-semibold">蓝色圆点</span>：目标图像中的ORB特征点（带白色边框）</li>
              <li><span className="text-green-600 font-semibold">绿色连线</span>：匹配的特征点对（透明度表示匹配质量）</li>
              <li>特征点大小根据检测到的关键点尺度自动调整</li>
              <li>图像保持原始宽高比显示</li>
              <li>使用鼠标拖拽画布可以平移视图</li>
              <li>使用缩放按钮调整显示大小</li>
              <li>勾选"仅显示内点"可过滤掉低质量的匹配</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}