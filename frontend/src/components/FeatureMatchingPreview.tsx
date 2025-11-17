import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Badge } from "@/components/ui/badge";

interface FeaturePoint {
  x: number;
  y: number;
  size?: number;
  angle?: number;
  response?: number;
  octave?: number;
}

interface FeatureMatch {
  queryIdx: number;
  trainIdx: number;
  distance: number;
  queryPoint: FeaturePoint;
  trainPoint: FeaturePoint;
}

interface FeatureMatchingPreviewProps {
  image1Url: string;
  image2Url: string;
  image1Filename: string;
  image2Filename: string;
  matches: FeatureMatch[];
  keypoints1: FeaturePoint[];
  keypoints2: FeaturePoint[];
  similarity: number;
}

export function FeatureMatchingPreview({
  image1Url,
  image2Url,
  image1Filename,
  image2Filename,
  matches,
  keypoints1,
  keypoints2,
  similarity
}: FeatureMatchingPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [image1, setImage1] = useState<HTMLImageElement | null>(null);
  const [image2, setImage2] = useState<HTMLImageElement | null>(null);

  // 加载图片
  useEffect(() => {
    const img1 = new Image();
    const img2 = new Image();
    let loadedCount = 0;

    const handleLoad = () => {
      loadedCount++;
      if (loadedCount === 2) {
        setImage1(img1);
        setImage2(img2);
        setImagesLoaded(true);
      }
    };

    img1.onload = handleLoad;
    img2.onload = handleLoad;
    img1.onerror = () => console.error('Failed to load image1:', image1Url);
    img2.onerror = () => console.error('Failed to load image2:', image2Url);
    img1.src = image1Url;
    img2.src = image2Url;
  }, [image1Url, image2Url]);

  // 绘制特征点匹配
  const drawFeatureMatches = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image1 || !image2 || !imagesLoaded || matches.length === 0) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置画布尺寸
    const maxImageHeight = 250;
    const padding = 20;
    const gap = 60; // 两张图片之间的间距

    // 计算缩放比例以适应显示区域
    const scale1 = Math.min(1, maxImageHeight / image1.height);
    const scale2 = Math.min(1, maxImageHeight / image2.height);

    const displayWidth1 = image1.width * scale1;
    const displayHeight1 = image1.height * scale1;
    const displayWidth2 = image2.width * scale2;
    const displayHeight2 = image2.height * scale2;

    // 画布总尺寸
    const canvasWidth = displayWidth1 + gap + displayWidth2 + padding * 2;
    const canvasHeight = Math.max(displayHeight1, displayHeight2) + padding * 2;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // 绘制背景
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 图片1的位置
    const img1X = padding;
    const img1Y = padding + (canvasHeight - padding * 2 - displayHeight1) / 2;

    // 图片2的位置
    const img2X = padding + displayWidth1 + gap;
    const img2Y = padding + (canvasHeight - padding * 2 - displayHeight2) / 2;

    // 绘制图片
    ctx.drawImage(image1, img1X, img1Y, displayWidth1, displayHeight1);
    ctx.drawImage(image2, img2X, img2Y, displayWidth2, displayHeight2);

    // 绘制图片边框
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(img1X, img1Y, displayWidth1, displayHeight1);

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.strokeRect(img2X, img2Y, displayWidth2, displayHeight2);

    // 绘制特征点匹配连接线
    const maxDisplayMatches = Math.min(matches.length, 50); // 最多显示50个匹配点

    // 根据匹配质量（distance）排序，优先显示最好的匹配
    const sortedMatches = [...matches]
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxDisplayMatches);

    sortedMatches.forEach((match, index) => {
      // 计算特征点在画布上的位置
      const pt1X = img1X + match.queryPoint.x * scale1;
      const pt1Y = img1Y + match.queryPoint.y * scale1;
      const pt2X = img2X + match.trainPoint.x * scale2;
      const pt2Y = img2Y + match.trainPoint.y * scale2;

      // 根据匹配质量（distance越小越好）设置颜色
      const maxDistance = 100; // 假设最大距离为100
      const normalizedDistance = Math.min(match.distance / maxDistance, 1);
      
      // 从绿色（好）到黄色到红色（差）
      let hue = (1 - normalizedDistance) * 120; // 0-120度，绿色到红色
      const alpha = Math.max(0.3, 1 - normalizedDistance * 0.5);

      // 绘制连接线
      ctx.strokeStyle = `hsla(${hue}, 70%, 50%, ${alpha})`;
      ctx.lineWidth = normalizedDistance > 0.5 ? 1 : 2;
      ctx.setLineDash(normalizedDistance > 0.5 ? [4, 4] : []);
      
      ctx.beginPath();
      ctx.moveTo(pt1X, pt1Y);
      ctx.lineTo(pt2X, pt2Y);
      ctx.stroke();

      // 绘制特征点（源图像 - 蓝色）
      ctx.fillStyle = '#3b82f6';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(pt1X, pt1Y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // 绘制特征点（目标图像 - 绿色）
      ctx.fillStyle = '#10b981';
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(pt2X, pt2Y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    });

    // 绘制文字标签
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('源图像', img1X + displayWidth1 / 2, img1Y - 5);
    ctx.fillText('目标图像', img2X + displayWidth2 / 2, img2Y - 5);

    // 绘制统计信息
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(`${matches.length} 个匹配点`, padding, canvasHeight - padding / 2);

  }, [image1, image2, imagesLoaded, matches]);

  // 当图片或匹配数据变化时重新绘制
  useEffect(() => {
    if (imagesLoaded) {
      drawFeatureMatches();
    }
  }, [imagesLoaded, drawFeatureMatches]);

  if (!matches || matches.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        暂无特征点匹配数据
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 信息栏 */}
      <div className="flex items-center justify-between gap-2 px-2">
        <div className="text-sm font-medium">特征点匹配预览</div>
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-xs">
            相似度: {(similarity * 100).toFixed(1)}%
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {matches.length} 个匹配点
          </Badge>
        </div>
      </div>

      {/* 画布 */}
      <div className="overflow-auto">
        {!imagesLoaded ? (
          <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
            加载中...
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="w-full h-auto rounded-lg shadow-sm"
          />
        )}
      </div>

      {/* 图例 */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-blue-500 rounded-full border border-white"></div>
          <span>源图特征点</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-green-500 rounded-full border border-white"></div>
          <span>目标特征点</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-0.5 bg-gradient-to-r from-green-500 to-red-500"></div>
          <span>匹配连接</span>
        </div>
      </div>
    </div>
  );
}

