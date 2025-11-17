import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

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

interface ImagePairFeatureMatchingProps {
  image1Url: string;
  image2Url: string;
  image1Filename: string;
  image2Filename: string;
  matches: FeatureMatch[];
  keypoints1?: FeaturePoint[];
  keypoints2?: FeaturePoint[];
  similarity?: number;
  onClose?: () => void;
}

export function ImagePairFeatureMatching({
  image1Url,
  image2Url,
  image1Filename,
  image2Filename,
  matches,
  keypoints1 = [],
  keypoints2 = [],
  similarity = 0,
  onClose
}: ImagePairFeatureMatchingProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [image1Size, setImage1Size] = useState({ width: 0, height: 0 });
  const [image2Size, setImage2Size] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const [showAllKeypoints, setShowAllKeypoints] = useState(true);
  const [maxDistance, setMaxDistance] = useState(100);

  // 图片加载完成后获取尺寸
  useEffect(() => {
    const img1 = new Image();
    const img2 = new Image();
    let loadedCount = 0;

    const handleLoad = () => {
      loadedCount++;
      if (loadedCount === 2) {
        setImage1Size({ width: img1.width, height: img1.height });
        setImage2Size({ width: img2.width, height: img2.height });
        setImagesLoaded(true);
      }
    };

    img1.onload = handleLoad;
    img2.onload = handleLoad;
    img1.src = image1Url;
    img2.src = image2Url;
  }, [image1Url, image2Url]);

  // 渲染特征点匹配连接线
  const drawConnectionLines = useCallback(() => {
    if (!svgRef.current || !imagesLoaded || matches.length === 0) return;

    const svg = svgRef.current;
    const container = document.getElementById('feature-matching-container');
    const image1El = document.getElementById('image1') as HTMLImageElement;
    const image2El = document.getElementById('image2') as HTMLImageElement;

    if (!image1El || !image2El || !container) {
      console.log('Missing elements:', { svg: !!svg, container: !!container, image1: !!image1El, image2: !!image2El });
      return;
    }

    // 清除之前的内容
    svg.innerHTML = '';

    // 获取图片在视口中的实际位置和尺寸
    const img1Rect = image1El.getBoundingClientRect();
    const img2Rect = image2El.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    console.log('Rects:', { img1Rect, img2Rect, containerRect });

    // 设置SVG尺寸和位置 - 覆盖整个容器
    const svgWidth = containerRect.width;
    const svgHeight = containerRect.height;
    svg.style.position = 'absolute';
    svg.style.top = '0';
    svg.style.left = '0';
    svg.style.width = `${svgWidth}px`;
    svg.style.height = `${svgHeight}px`;
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '20';

    // 计算图片缩放比例（相对于原始尺寸）
    const scale1 = img1Rect.naturalWidth ? img1Rect.width / img1Rect.naturalWidth : scale;
    const scale2 = img2Rect.naturalWidth ? img2Rect.width / img2Rect.naturalWidth : scale;

    console.log('Scales:', { scale1, scale2, userScale: scale });

    // 创建命名空间
    const svgNS = "http://www.w3.org/2000/svg";

    // 绘制连接线
    const validMatches = matches.filter(match => match.distance <= maxDistance);
    console.log('Drawing lines for matches:', validMatches.length);

    validMatches.forEach((match, index) => {
      // 计算特征点在容器中的实际位置
      const kp1X = (img1Rect.left - containerRect.left) + (match.queryPoint.x * scale1);
      const kp1Y = (img1Rect.top - containerRect.top) + (match.queryPoint.y * scale1);
      const kp2X = (img2Rect.left - containerRect.left) + (match.trainPoint.x * scale2);
      const kp2Y = (img2Rect.top - containerRect.top) + (match.trainPoint.y * scale2);

      // 连接线
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', kp1X.toFixed(2));
      line.setAttribute('y1', kp1Y.toFixed(2));
      line.setAttribute('x2', kp2X.toFixed(2));
      line.setAttribute('y2', kp2Y.toFixed(2));

      // 根据距离设置颜色和透明度
      const normalizedDistance = Math.min(match.distance / maxDistance, 1);
      const opacity = Math.max(0.3, 1 - normalizedDistance * 0.5); // 连接线透明度
      const hue = (1 - normalizedDistance) * 120; // 从红色(0)到绿色(120)

      line.setAttribute('stroke', `hsla(${hue}, 70%, 45%, ${opacity})`);
      line.setAttribute('stroke-width', Math.max(2, 5 * opacity).toString());
      line.setAttribute('stroke-dasharray', normalizedDistance > 0.5 ? '8,4' : 'none');
      line.setAttribute('stroke-linecap', 'round');
      line.classList.add('feature-match-line');

      svg.appendChild(line);
    });

    console.log('SVG dimensions:', { svgWidth, svgHeight });

  }, [imagesLoaded, matches, image1Size, image2Size, scale, maxDistance]);

  // 主要渲染效果
  useEffect(() => {
    drawConnectionLines();
  }, [drawConnectionLines]);

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setTimeout(drawConnectionLines, 100); // 延迟一下确保图片重新渲染完成
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawConnectionLines]);

  // 监听缩放变化
  useEffect(() => {
    setTimeout(drawConnectionLines, 300); // 等待缩放动画完成
  }, [scale, drawConnectionLines]);

  // 监听图片加载完成
  useEffect(() => {
    if (imagesLoaded) {
      console.log('Images loaded, triggering connection lines draw');
      setTimeout(drawConnectionLines, 500); // 等待DOM完全渲染
    }
  }, [imagesLoaded, drawConnectionLines]);

  // 添加matches变化监听
  useEffect(() => {
    if (imagesLoaded && matches.length > 0) {
      console.log('Matches updated, triggering connection lines draw');
      setTimeout(drawConnectionLines, 200);
    }
  }, [matches, imagesLoaded, drawConnectionLines]);

  // 缩放控制
  const handleZoomIn = () => setScale(prev => Math.min(3, prev * 1.2));
  const handleZoomOut = () => setScale(prev => Math.max(0.5, prev / 1.2));
  const handleReset = () => setScale(1);

  // 过滤匹配点
  const goodMatches = matches.filter(m => m.distance <= maxDistance);
  const matchQuality = matches.length > 0 ? (goodMatches.length / matches.length * 100) : 0;

  // 调试信息
  console.log('ImagePairFeatureMatching render:', {
    imagesLoaded,
    matchesCount: matches.length,
    goodMatchesCount: goodMatches.length,
    maxDistance,
    keypoints1Count: keypoints1.length,
    keypoints2Count: keypoints2.length
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-7xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex-1">
            <CardTitle className="text-xl">特征点匹配对比</CardTitle>
            <div className="flex flex-wrap gap-4 mt-2">
              <Badge variant="outline">
                相似度: {(similarity * 100).toFixed(1)}%
              </Badge>
              <Badge variant="outline">
                匹配点: {goodMatches.length}/{matches.length}
              </Badge>
              <Badge variant={matchQuality > 50 ? "default" : matchQuality > 25 ? "secondary" : "destructive"}>
                匹配质量: {matchQuality.toFixed(1)}%
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 控制面板 */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="show-keypoints"
                checked={showAllKeypoints}
                onChange={(e) => setShowAllKeypoints(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="show-keypoints" className="text-sm font-medium">
                显示所有特征点
              </label>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="max-distance" className="text-sm font-medium">
                匹配阈值:
              </label>
              <input
                type="range"
                id="max-distance"
                min="10"
                max="200"
                step="10"
                value={maxDistance}
                onChange={(e) => setMaxDistance(Number(e.target.value))}
                className="w-32"
              />
              <span className="text-sm text-muted-foreground w-12">
                {maxDistance}
              </span>
            </div>
          </div>

          {/* 图片信息 */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center p-3 bg-muted/50 rounded">
              <div className="font-medium truncate">{image1Filename}</div>
              <div className="text-muted-foreground">
                {image1Size.width} × {image1Size.height}
              </div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded">
              <div className="font-medium truncate">{image2Filename}</div>
              <div className="text-muted-foreground">
                {image2Size.width} × {image2Size.height}
              </div>
            </div>
          </div>

          {/* 特征点匹配可视化 */}
          <div className="relative overflow-auto border rounded-lg bg-muted/20">
            {!imagesLoaded ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-muted-foreground">加载图片中...</div>
              </div>
            ) : matches.length === 0 ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-muted-foreground text-center">
                  <div className="mb-2">暂无特征点匹配数据</div>
                  <div className="text-sm">请确保分析包含ORB特征提取</div>
                </div>
              </div>
            ) : (
              <div className="relative min-h-[600px]" id="feature-matching-container">
                {/* 图片容器 */}
                <div className="flex items-center justify-center gap-16 py-8 px-4">
                  {/* 第一张图片 */}
                  <div className="flex flex-col items-center">
                    <div className="text-sm font-medium mb-2 text-center max-w-[400px] truncate">
                      {image1Filename}
                    </div>
                    <div className="relative border-2 border-blue-200 rounded-lg overflow-hidden bg-blue-50/20">
                      <img
                        src={image1Url}
                        alt={image1Filename}
                        className="block w-auto h-auto max-w-[450px] max-h-[350px] object-contain"
                        style={{ transform: `scale(${scale})` }}
                        id="image1"
                      />
                      {/* 特征点叠加层1 */}
                      <svg
                        className="absolute top-0 left-0 pointer-events-none"
                        width="100%"
                        height="100%"
                        style={{ transform: `scale(${scale})` }}
                      >
                        {showAllKeypoints && keypoints1.map((kp, index) => (
                          <circle
                            key={`kp1-${index}`}
                            cx={kp.x}
                            cy={kp.y}
                            r={Math.max(2, Math.min(6, (kp.response || 1) * 4))}
                            fill="#3b82f6"
                            stroke="#1e40af"
                            strokeWidth="1"
                            opacity="0.7"
                          />
                        ))}
                        {matches.map((match, index) => (
                          <circle
                            key={`match1-${index}`}
                            cx={match.queryPoint.x}
                            cy={match.queryPoint.y}
                            r={Math.max(3, Math.min(8, (1 - match.distance / maxDistance) * 8))}
                            fill="#f59e0b"
                            stroke="#d97706"
                            strokeWidth="2"
                            opacity="0.9"
                          />
                        ))}
                      </svg>
                    </div>
                  </div>

                  {/* 连接线视觉指示器 */}
                  <div className="flex flex-col items-center justify-center">
                    <div className="text-xs text-muted-foreground mb-2">特征匹配连接</div>
                    <div className="flex flex-col gap-1">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-0.5 w-8 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"></div>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      {matches.filter(m => m.distance <= maxDistance).length} 条连接
                    </div>
                  </div>

                  {/* 第二张图片 */}
                  <div className="flex flex-col items-center">
                    <div className="text-sm font-medium mb-2 text-center max-w-[400px] truncate">
                      {image2Filename}
                    </div>
                    <div className="relative border-2 border-green-200 rounded-lg overflow-hidden bg-green-50/20">
                      <img
                        src={image2Url}
                        alt={image2Filename}
                        className="block w-auto h-auto max-w-[450px] max-h-[350px] object-contain"
                        style={{ transform: `scale(${scale})` }}
                        id="image2"
                      />
                      {/* 特征点叠加层2 */}
                      <svg
                        className="absolute top-0 left-0 pointer-events-none"
                        width="100%"
                        height="100%"
                        style={{ transform: `scale(${scale})` }}
                      >
                        {showAllKeypoints && keypoints2.map((kp, index) => (
                          <circle
                            key={`kp2-${index}`}
                            cx={kp.x}
                            cy={kp.y}
                            r={Math.max(2, Math.min(6, (kp.response || 1) * 4))}
                            fill="#10b981"
                            stroke="#047857"
                            strokeWidth="1"
                            opacity="0.7"
                          />
                        ))}
                        {matches.map((match, index) => (
                          <circle
                            key={`match2-${index}`}
                            cx={match.trainPoint.x}
                            cy={match.trainPoint.y}
                            r={Math.max(3, Math.min(8, (1 - match.distance / maxDistance) * 8))}
                            fill="#f59e0b"
                            stroke="#d97706"
                            strokeWidth="2"
                            opacity="0.9"
                          />
                        ))}
                      </svg>
                    </div>
                  </div>
                </div>

                {/* 连接线层 - 覆盖整个容器 */}
                <svg
                  id="matching-svg"
                  ref={svgRef}
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                  style={{ zIndex: 20 }}
                />
              </div>
            )}
          </div>

          {/* 图例 */}
          <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full border border-blue-700"></div>
              <span>图片1特征点</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full border border-green-700"></div>
              <span>图片2特征点</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500 rounded-full border border-amber-600"></div>
              <span>匹配点</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-green-500"></div>
              <span>高质量匹配</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-red-500" style={{ strokeDasharray: '5,5' }}></div>
              <span>低质量匹配</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}