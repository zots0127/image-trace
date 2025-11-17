import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { ImagePairFeatureMatching } from "./ImagePairFeatureMatching";

interface SimpleNetworkNode {
  id: string;
  index: number;
  url: string;
  filename: string;
  x: number;
  y: number;
}

interface SimpleConnection {
  sourceIndex: number;
  targetIndex: number;
  source: SimpleNetworkNode;
  target: SimpleNetworkNode;
  similarity: number;
  thickness: number;
}

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

interface ORBData {
  pairwise_regions?: Array<{
    image1_idx: number;
    image2_idx: number;
    matches: FeatureMatch[];
    keypoints1: FeaturePoint[];
    keypoints2: FeaturePoint[];
    match_count: number;
    similarity: number;
  }>;
}

interface ImageConnectionNetworkSimpleProps {
  matrix: number[][];
  imageUrls: string[];
  imageFilenames: string[];
  threshold?: number;
  onThresholdChange?: (threshold: number) => void;
  onNodeSelect?: (nodeIndex: number) => void;
  selectedNode?: number | null;
  orbData?: ORBData;
}

export function ImageConnectionNetworkSimple({
  matrix,
  imageUrls,
  imageFilenames,
  threshold = 0.3,
  onThresholdChange,
  onNodeSelect,
  selectedNode,
  orbData
}: ImageConnectionNetworkSimpleProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [connections, setConnections] = useState<SimpleConnection[]>([]);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<{sourceIdx: number, targetIdx: number} | null>(null);

  // 处理数据
  useEffect(() => {
    if (!matrix || matrix.length === 0 || imageUrls.length === 0) return;

    // 过滤符合条件的图片：宽度 >= 100px 且高度 >= 100px
    const validImages: SimpleNetworkNode[] = [];

    matrix.forEach((_, index) => {
      const url = imageUrls[index];
      const filename = imageFilenames[index] || `图片 ${index + 1}`;

      // 基础验证
      if (!url) return;

      // 对于装饰性图片的启发式过滤规则
      const isLikelyDecoration =
        filename.toLowerCase().includes('logo') ||
        filename.toLowerCase().includes('icon') ||
        filename.toLowerCase().includes('banner') ||
        filename.toLowerCase().includes('header') ||
        filename.toLowerCase().includes('footer') ||
        filename.toLowerCase().includes('background') ||
        filename.toLowerCase().includes('wallpaper') ||
        filename.toLowerCase().includes('watermark') ||
        filename.toLowerCase().includes('pattern') ||
        filename.toLowerCase().includes('texture') ||
        filename.toLowerCase().includes('ui') ||
        filename.toLowerCase().includes('button') ||
        filename.toLowerCase().includes('arrow') ||
        filename.toLowerCase().includes('icon-');

      // 简单的尺寸估算：如果是小图片（如头像、图标），可能是装饰
      // 我们可以通过文件名推断尺寸，或者暂时跳过明显的装饰图片
      if (isLikelyDecoration) {
        return;
      }

      validImages.push({
        id: `node-${index}`,
        index,
        url: url,
        filename: filename,
        x: 0,
        y: 0
      });
    });

    // 如果有效图片少于2张，不显示网络图
    if (validImages.length < 2) {
      setConnections([]);
      return;
    }

    // 限制最多显示20张图片，避免过度拥挤
    const maxImages = Math.min(validImages.length, 20);
    const nodes = validImages.slice(0, maxImages);

    // 创建连接 - 只基于过滤后的节点
    const newConnections: SimpleConnection[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const sourceIndex = nodes[i].index;
        const targetIndex = nodes[j].index;
        const similarity = matrix[sourceIndex][targetIndex];

        if (similarity >= threshold) {
          newConnections.push({
            sourceIndex: sourceIndex,
            targetIndex: targetIndex,
            source: nodes[i],
            target: nodes[j],
            similarity,
            thickness: Math.max(1, similarity * 10) // 1-10px
          });
        }
      }
    }

    // 智能圆形布局，根据节点数量调整
    const centerX = 400;
    const centerY = 300;
    const maxRadius = Math.min(250, Math.min(centerX, centerY) * 0.8);
    const minRadius = 80;

    // 根据节点数量动态调整半径
    const radius = Math.max(minRadius, maxRadius * (1 - nodes.length / 40));

    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      node.x = centerX + radius * Math.cos(angle);
      node.y = centerY + radius * Math.sin(angle);
    });

    setConnections(newConnections);
  }, [matrix, imageUrls, imageFilenames, threshold]);

  // 渲染SVG
  useEffect(() => {
    if (!svgRef.current || matrix.length === 0 || imageUrls.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 800;
    const height = 600;

    // 创建缩放行为
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on('zoom', (event) => {
        svg.select('.network-group')
          .attr('transform', event.transform);
      });

    svg.call(zoom);

    // 创建主要的组
    const g = svg.append('g').attr('class', 'network-group');

    // 创建连线
    const link = g.append('g')
      .selectAll('line')
      .data(connections)
      .enter().append('line')
      .attr('class', 'connection')
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y)
      .attr('stroke', d => {
        const intensity = Math.round(d.similarity * 255);
        return `rgba(59, 130, 246, ${0.3 + d.similarity * 0.7})`;
      })
      .attr('stroke-width', d => d.thickness)
      .attr('stroke-linecap', 'round')
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedConnection({
          sourceIdx: d.sourceIndex,
          targetIdx: d.targetIndex
        });
      })
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', d => d.thickness + 2);
      })
      .on('mouseout', function(event, d) {
        const intensity = Math.round(d.similarity * 255);
        d3.select(this)
          .attr('stroke', `rgba(59, 130, 246, ${0.3 + d.similarity * 0.7})`)
          .attr('stroke-width', d => d.thickness);
      });

    // 创建节点组
    const nodeGroup = g.append('g')
      .selectAll('g')
      .data(connections.length > 0 ? connections.map(c => [c.source, c.target]).flat() : [])
      .enter().append('g')
      .attr('class', 'node-group')
      .attr('transform', d => `translate(${d.x},${d.y})`);

    // 添加节点圆形背景
    nodeGroup.append('circle')
      .attr('class', 'node-circle')
      .attr('r', 35)
      .attr('fill', d => d.index === selectedNode ? '#ddd6fe' : '#f1f5f9')
      .attr('stroke', d => d.index === selectedNode ? '#7c3aed' : '#cbd5e1')
      .attr('stroke-width', d => d.index === selectedNode ? 3 : 2)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        onNodeSelect?.(d.index);
      })
      .on('mouseover', function(event, d) {
        setHoveredNode(d.index);
        d3.select(this)
          .attr('fill', '#e0e7ff')
          .attr('stroke', '#6366f1');
      })
      .on('mouseout', function(event, d) {
        const isSelected = d.index === selectedNode;
        d3.select(this)
          .attr('fill', isSelected ? '#ddd6fe' : '#f1f5f9')
          .attr('stroke', isSelected ? '#7c3aed' : '#cbd5e1');
      });

    // 添加节点图片
    nodeGroup.append('image')
      .attr('xlink:href', d => d.url)
      .attr('x', -30)
      .attr('y', -30)
      .attr('width', 60)
      .attr('height', 60)
      .attr('clip-path', 'circle(30px at center)')
      .style('pointer-events', 'none');

    // 添加节点标签
    nodeGroup.append('text')
      .attr('dy', 50)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#374151')
      .style('pointer-events', 'none')
      .text(d => d.filename.length > 12 ? d.filename.substring(0, 12) + '...' : d.filename);

    // 添加相似度标签
    const linkLabels = g.append('g')
      .selectAll('text')
      .data(connections)
      .enter().append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', -5)
      .style('font-size', '10px')
      .style('fill', '#6b7280')
      .style('pointer-events', 'none')
      .text(d => d.similarity.toFixed(2));

    linkLabels
      .attr('x', d => (d.source.x + d.target.x) / 2)
      .attr('y', d => (d.source.y + d.target.y) / 2);

  }, [connections, selectedNode, matrix.length, imageUrls.length]);

  // 缩放控制
  const handleZoomIn = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const currentTransform = d3.zoomTransform(svgRef.current);
    const newScale = Math.min(3, currentTransform.k * 1.2);
    svg.transition().duration(300).call(
      d3.zoom<SVGSVGElement, unknown>().transform,
      d3.zoomIdentity.translate(currentTransform.x, currentTransform.y).scale(newScale)
    );
  };

  const handleZoomOut = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const currentTransform = d3.zoomTransform(svgRef.current);
    const newScale = Math.max(0.5, currentTransform.k / 1.2);
    svg.transition().duration(300).call(
      d3.zoom<SVGSVGElement, unknown>().transform,
      d3.zoomIdentity.translate(currentTransform.x, currentTransform.y).scale(newScale)
    );
  };

  const handleReset = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(
      d3.zoom<SVGSVGElement, unknown>().transform,
      d3.zoomIdentity
    );
  };

  if (!matrix || matrix.length === 0) {
    return null;
  }

  // 检查是否有有效图片（非装饰图片且数量足够）
  const checkValidImages = () => {
    if (!matrix || matrix.length === 0 || imageUrls.length === 0) {
      return { hasValid: false, reason: 'no_images' };
    }

    let validCount = 0;
    matrix.forEach((_, index) => {
      const filename = imageFilenames[index] || '';
      const url = imageUrls[index];

      if (!url) return;

      const isLikelyDecoration =
        filename.toLowerCase().includes('logo') ||
        filename.toLowerCase().includes('icon') ||
        filename.toLowerCase().includes('banner') ||
        filename.toLowerCase().includes('header') ||
        filename.toLowerCase().includes('footer') ||
        filename.toLowerCase().includes('background') ||
        filename.toLowerCase().includes('wallpaper') ||
        filename.toLowerCase().includes('watermark') ||
        filename.toLowerCase().includes('pattern') ||
        filename.toLowerCase().includes('texture') ||
        filename.toLowerCase().includes('ui') ||
        filename.toLowerCase().includes('button') ||
        filename.toLowerCase().includes('arrow') ||
        filename.toLowerCase().includes('icon-');

      if (!isLikelyDecoration) {
        validCount++;
      }
    });

    if (validCount < 2) {
      return { hasValid: false, reason: 'not_enough_images', count: validCount };
    }

    return { hasValid: true, count: validCount };
  };

  const validation = checkValidImages();

  if (!validation.hasValid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>网络关系图</CardTitle>
          <CardDescription>
            图片关系网络可视化
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            {validation.reason === 'no_images' && (
              <div>
                <p className="text-lg font-medium mb-2">暂无图像数据</p>
                <p className="text-sm">请上传图片后再查看网络关系图</p>
              </div>
            )}
            {validation.reason === 'not_enough_images' && (
              <div>
                <p className="text-lg font-medium mb-2">
                  有效图片数量不足 ({validation.count}/2)
                </p>
                <p className="text-sm mb-2">
                  网络图需要至少2张有效的内容图片
                </p>
                <div className="text-xs bg-muted p-2 rounded">
                  <p className="mb-1">💡 建议上传：</p>
                  <ul className="text-left text-left ml-4">
                    <li>• 高清照片或截图</li>
                    <li>• 尺寸建议 100x100px 以上</li>
                    <li>• 避免logo、图标、背景等装饰图片</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>网络关系图</CardTitle>
            <CardDescription>
              图片关系网络图（连线越粗表示相似度越高）
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleZoomOut}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 阈值控制 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">
              相似度阈值: {threshold.toFixed(2)}
            </label>
            <span className="text-xs text-muted-foreground">
              显示 {connections.length} 个连接
            </span>
          </div>
          <Slider
            value={[threshold]}
            onValueChange={(value) => onThresholdChange?.(value[0])}
            max={1}
            min={0.1}
            step={0.05}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0.1 (宽松)</span>
            <span>0.5 (中等)</span>
            <span>1.0 (严格)</span>
          </div>
        </div>

        {/* 网络图容器 */}
        <div className="relative w-full h-96 border rounded-lg bg-muted/10 overflow-hidden">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            className="cursor-move"
            viewBox="0 0 800 600"
            preserveAspectRatio="xMidYMid meet"
          />
        </div>

        {/* 悬停信息 */}
        {hoveredNode !== null && (
          <div className="mt-4 p-3 bg-muted rounded-md text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="font-medium">图片 {hoveredNode + 1}:</span> {imageFilenames[hoveredNode] || ''}
              </div>
            </div>
          </div>
        )}

        {/* 图例 */}
        <div className="mt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-blue-300 rounded-full"></div>
            <span>低相似度</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-1 bg-blue-600 rounded-full"></div>
            <span>高相似度</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 border-2 border-purple-600 rounded-full bg-purple-100"></div>
            <span>选中图片</span>
          </div>
          {orbData && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-amber-500 rounded-full"></div>
              <span>点击连线查看特征匹配</span>
            </div>
          )}
        </div>
      </CardContent>

      {/* 特征点匹配弹窗 */}
      {selectedConnection && orbData?.pairwise_regions && (
        <ImagePairFeatureMatching
          image1Url={imageUrls[selectedConnection.sourceIdx]}
          image2Url={imageUrls[selectedConnection.targetIdx]}
          image1Filename={imageFilenames[selectedConnection.sourceIdx]}
          image2Filename={imageFilenames[selectedConnection.targetIdx]}
          matches={(() => {
            const region = orbData.pairwise_regions?.find(
              r => (r.image1_idx === selectedConnection.sourceIdx && r.image2_idx === selectedConnection.targetIdx) ||
                   (r.image1_idx === selectedConnection.targetIdx && r.image2_idx === selectedConnection.sourceIdx)
            );

            if (region && region.image1_idx === selectedConnection.targetIdx) {
              // 如果索引顺序相反，需要调换query和train点
              return region.matches.map(m => ({
                ...m,
                queryPoint: m.trainPoint,
                trainPoint: m.queryPoint,
                queryIdx: m.trainIdx,
                trainIdx: m.queryIdx
              }));
            }

            return region?.matches || [];
          })()}
          keypoints1={(() => {
            const region = orbData.pairwise_regions?.find(
              r => (r.image1_idx === selectedConnection.sourceIdx && r.image2_idx === selectedConnection.targetIdx) ||
                   (r.image1_idx === selectedConnection.targetIdx && r.image2_idx === selectedConnection.sourceIdx)
            );

            if (region && region.image1_idx === selectedConnection.targetIdx) {
              return region.keypoints2;
            }

            return region?.keypoints1 || [];
          })()}
          keypoints2={(() => {
            const region = orbData.pairwise_regions?.find(
              r => (r.image1_idx === selectedConnection.sourceIdx && r.image2_idx === selectedConnection.targetIdx) ||
                   (r.image1_idx === selectedConnection.targetIdx && r.image2_idx === selectedConnection.sourceIdx)
            );

            if (region && region.image1_idx === selectedConnection.targetIdx) {
              return region.keypoints1;
            }

            return region?.keypoints2 || [];
          })()}
          similarity={(() => {
            const region = orbData.pairwise_regions?.find(
              r => (r.image1_idx === selectedConnection.sourceIdx && r.image2_idx === selectedConnection.targetIdx) ||
                   (r.image1_idx === selectedConnection.targetIdx && r.image2_idx === selectedConnection.sourceIdx)
            );
            return region?.similarity || matrix[selectedConnection.sourceIdx][selectedConnection.targetIdx];
          })()}
          onClose={() => setSelectedConnection(null)}
        />
      )}
    </Card>
  );
}