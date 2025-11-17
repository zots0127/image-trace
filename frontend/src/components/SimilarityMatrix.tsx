import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ImagePairFeatureMatching } from "./ImagePairFeatureMatching";
import { FeatureMatchingPreview } from "./FeatureMatchingPreview";
import { ExternalLink } from "lucide-react";

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

interface SimilarityMatrixProps {
  matrix: number[][];
  imageNames?: string[];
  imageUrls?: string[];
  threshold?: number;
  showThumbnails?: boolean;
  onCellClick?: (rowIndex: number, colIndex: number, value: number) => void;
  onThresholdChange?: (threshold: number) => void;
  selectedCell?: { row: number; col: number } | null;
  orbData?: ORBData;
  projectId?: string;
  analysisId?: string;
}

export function SimilarityMatrix({
  matrix,
  imageNames = [],
  imageUrls = [],
  threshold = 0,
  showThumbnails = true,
  onCellClick,
  onThresholdChange,
  selectedCell,
  orbData,
  projectId,
  analysisId
}: SimilarityMatrixProps) {
  const navigate = useNavigate();
  if (!matrix || matrix.length === 0) {
    return null;
  }

  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<{row: number, col: number} | null>(null);
  const [filterByThreshold, setFilterByThreshold] = useState(true); // 新增：是否按阈值过滤

  const getColorForValue = (value: number) => {
    // 相似度越高，颜色越深（蓝绿色）
    const intensity = Math.round(value * 255);
    return `rgb(${255 - intensity}, ${255 - Math.round(intensity * 0.3)}, 255)`;
  };

  const isCellSelected = (row: number, col: number) => {
    return selectedCell && (
      (selectedCell.row === row && selectedCell.col === col) ||
      (selectedCell.row === col && selectedCell.col === row)
    );
  };

  const isCellHighlighted = (row: number, col: number) => {
    if (!selectedCell || row === col) return false;
    return selectedCell.row === row || selectedCell.col === row ||
           selectedCell.row === col || selectedCell.col === row;
  };

  const shouldShowValue = (value: number, row: number, col: number) => {
    // 对角线不显示值
    if (row === col) return false;
    // 应用阈值过滤
    return value >= threshold;
  };

  // 计算哪些图片有有效连接（超过阈值）
  const getActiveImages = () => {
    if (!filterByThreshold) {
      // 不过滤，返回所有图片索引
      return Array.from({ length: matrix.length }, (_, i) => i);
    }

    const activeSet = new Set<number>();
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix.length; j++) {
        if (i !== j && matrix[i][j] >= threshold) {
          activeSet.add(i);
          activeSet.add(j);
        }
      }
    }
    return Array.from(activeSet).sort((a, b) => a - b);
  };

  const activeImages = getActiveImages();
  const filteredSize = activeImages.length;
  const size = filterByThreshold ? filteredSize : matrix.length;
  const isLargeMatrix = size > 16;
  // 如果图像数量超过16张，使用单像素渲染
  const cellSize = isLargeMatrix ? 1 : (size === 1 ? 200 : Math.min(120, 600 / size));
  const thumbnailSize = Math.min(50, cellSize - 10);

  // 计算有效连接数
  const validConnections = matrix.flat().filter((val, idx) => {
    const row = Math.floor(idx / matrix.length);
    const col = idx % matrix.length;
    return row < col && val >= threshold;
  }).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>相似度矩阵</CardTitle>
            <CardDescription>
              {isLargeMatrix
                ? `图片之间的相似度热力图（${size}张图片，已优化显示）`
                : "图片之间的相似度热力图 (1.0 = 完全相同, 0.0 = 完全不同)"}
            </CardDescription>
          </div>
          <Badge variant="outline">
            {validConnections} 个有效连接
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* 阈值控制 */}
        {onThresholdChange && (
          <div className="mb-6 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">
                  相似度阈值: {threshold.toFixed(2)}
                </label>
              </div>
              <Slider
                value={[threshold]}
                onValueChange={(value) => onThresholdChange(value[0])}
                max={1}
                min={0}
                step={0.05}
                className="w-full"
              />
            </div>
            
            {/* 过滤选项 */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="filter-by-threshold"
                checked={filterByThreshold}
                onChange={(e) => setFilterByThreshold(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="filter-by-threshold" className="text-sm font-medium cursor-pointer">
                只显示有连接的图片 ({filteredSize}/{matrix.length})
              </label>
            </div>
          </div>
        )}

        {isLargeMatrix && (
          <div className="mb-4 p-3 bg-muted rounded-md text-sm text-muted-foreground">
            <p>
              图像数量较多（{size}张），矩阵已优化显示以提高性能。
              鼠标悬停在单元格上可查看详细数值。
            </p>
          </div>
        )}

        <div className="overflow-auto">
          <div className="inline-block min-w-full">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="border border-border p-1 bg-muted" style={{ width: showThumbnails ? thumbnailSize + 8 : 'auto' }}></th>
                  {activeImages.map((originalIdx) => (
                    <th
                      key={originalIdx}
                      className="border border-border p-1 bg-muted text-xs font-medium"
                      style={{ minWidth: isLargeMatrix ? 1 : cellSize }}
                    >
                      {showThumbnails && !isLargeMatrix && imageUrls[originalIdx] ? (
                        <img
                          src={imageUrls[originalIdx]}
                          alt={imageNames[originalIdx] || `图片 ${originalIdx + 1}`}
                          className="w-8 h-8 mx-auto rounded object-cover"
                          title={imageNames[originalIdx] || `图片 ${originalIdx + 1}`}
                        />
                      ) : isLargeMatrix ? "" : (imageNames[originalIdx] || `图片 ${originalIdx + 1}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeImages.map((rowOriginalIdx) => (
                  <tr key={rowOriginalIdx}>
                    <td className="border border-border p-1 bg-muted text-xs font-medium">
                      {showThumbnails && !isLargeMatrix && imageUrls[rowOriginalIdx] ? (
                        <img
                          src={imageUrls[rowOriginalIdx]}
                          alt={imageNames[rowOriginalIdx] || `图片 ${rowOriginalIdx + 1}`}
                          className="w-8 h-8 mx-auto rounded object-cover"
                          title={imageNames[rowOriginalIdx] || `图片 ${rowOriginalIdx + 1}`}
                        />
                      ) : isLargeMatrix ? "" : (imageNames[rowOriginalIdx] || `图片 ${rowOriginalIdx + 1}`)}
                    </td>
                    {activeImages.map((colOriginalIdx) => {
                      const value = matrix[rowOriginalIdx][colOriginalIdx];
                      const i = rowOriginalIdx;
                      const j = colOriginalIdx;
                      const isSelected = isCellSelected(i, j);
                      const isHighlighted = isCellHighlighted(i, j);
                      const shouldShow = shouldShowValue(value, i, j);

                      return (
                        <td
                          key={j}
                          className={`border border-border text-center relative group transition-all ${
                            i !== j ? 'cursor-pointer' : ''
                          } ${isSelected ? 'ring-2 ring-purple-500' : ''}`}
                          style={{
                            backgroundColor: i === j ? '#f1f5f9' : (
                              shouldShow ? getColorForValue(value) : '#f8fafc'
                            ),
                            minWidth: cellSize,
                            width: cellSize,
                            height: cellSize,
                            padding: isLargeMatrix ? 0 : undefined,
                            opacity: shouldShow ? 1 : 0.3,
                            transform: isHighlighted ? 'scale(1.05)' : 'scale(1)',
                            transformOrigin: 'center',
                            zIndex: isSelected ? 10 : 1
                          }}
                          title={`图片${i + 1} - 图片${j + 1}: ${value.toFixed(3)}${orbData ? ' (点击查看特征匹配)' : ' (点击查看详情)'}`}
                          onClick={() => i !== j && setSelectedConnection({ row: i, col: j })}
                          onMouseEnter={() => setHoveredCell({ row: i, col: j })}
                          onMouseLeave={() => setHoveredCell(null)}
                          style={{ cursor: i !== j ? 'pointer' : 'default' }}
                        >
                          {/* 对角线显示标识 */}
                          {i === j && !isLargeMatrix && (
                            <div className="text-xs font-bold text-gray-400">-</div>
                          )}

                          {/* 显示相似度值 */}
                          {!isLargeMatrix && shouldShow && (
                            <span className={`relative z-10 font-bold text-xs font-mono ${
                              value > 0.4 ? 'text-white' : 'text-gray-900'
                            }`}
                            style={{
                              textShadow: value > 0.4 ? '0 0 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.6)' : 'none'
                            }}>
                              {value.toFixed(2)}
                            </span>
                          )}

                          {/* 悬停效果 */}
                          <div className={`absolute inset-0 bg-black opacity-0 group-hover:opacity-10 transition-opacity ${
                            isSelected ? 'opacity-20 bg-purple-500' : ''
                          }`} />

                          {/* 选中指示器 */}
                          {isSelected && (
                            <div className="absolute inset-0 border-2 border-purple-500 pointer-events-none" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 悬停信息和特征点匹配可视化 */}
        {hoveredCell && hoveredCell.row !== hoveredCell.col && !isLargeMatrix && (
          <div className="mt-4 space-y-4">
            {/* 基本信息 */}
            <div className="p-3 bg-muted rounded-md text-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium">图片 {hoveredCell.row + 1}:</span> {imageNames[hoveredCell.row] || ''}
                    </div>
                    <div>
                      <span className="font-medium">图片 {hoveredCell.col + 1}:</span> {imageNames[hoveredCell.col] || ''}
                    </div>
                  </div>
                  <div>
                    <span className="font-medium">相似度:</span> {matrix[hoveredCell.row][hoveredCell.col].toFixed(4)}
                  </div>
                </div>
                {projectId && analysisId && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const url = `/project/${projectId}/analysis/${analysisId}/pair?image1=${hoveredCell.row}&image2=${hoveredCell.col}`;
                      console.log("Navigating to:", url);
                      navigate(url);
                    }}
                    className="shrink-0"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    查看详情
                  </Button>
                )}
              </div>
            </div>

            {/* 特征点匹配可视化 */}
            {orbData?.pairwise_regions && (() => {
              const region = orbData.pairwise_regions?.find(
                r => (r.image1_idx === hoveredCell.row && r.image2_idx === hoveredCell.col) ||
                     (r.image1_idx === hoveredCell.col && r.image2_idx === hoveredCell.row)
              );

              if (!region || !region.matches || region.matches.length === 0) {
                return (
                  <div className="p-4 border rounded-lg bg-muted/50 text-center text-sm text-muted-foreground">
                    暂无特征点匹配数据
                  </div>
                );
              }

              // 如果索引顺序相反，需要调换
              const needSwap = region.image1_idx === hoveredCell.col;
              const displayMatches = needSwap ? region.matches.map(m => ({
                ...m,
                queryPoint: m.trainPoint,
                trainPoint: m.queryPoint,
                queryIdx: m.trainIdx,
                trainIdx: m.queryIdx
              })) : region.matches;

              const displayKeypoints1 = needSwap ? region.keypoints2 : region.keypoints1;
              const displayKeypoints2 = needSwap ? region.keypoints1 : region.keypoints2;

              return (
                <div className="border rounded-lg bg-muted/20 p-4">
                  <FeatureMatchingPreview
                    image1Url={imageUrls[hoveredCell.row]}
                    image2Url={imageUrls[hoveredCell.col]}
                    image1Filename={imageNames[hoveredCell.row]}
                    image2Filename={imageNames[hoveredCell.col]}
                    matches={displayMatches}
                    keypoints1={displayKeypoints1}
                    keypoints2={displayKeypoints2}
                    similarity={region.similarity || matrix[hoveredCell.row][hoveredCell.col]}
                  />
                </div>
              );
            })()}
          </div>
        )}

        {/* 图例 */}
        <div className="mt-4 flex items-center justify-center gap-6 text-xs text-gray-700 dark:text-gray-300">
          <div className="flex items-center gap-2">
            <div className="w-8 h-4 rounded border border-gray-300" style={{ backgroundColor: getColorForValue(0) }} />
            <span className="font-medium">0.0 (不同)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-4 rounded border border-gray-300" style={{ backgroundColor: getColorForValue(0.3) }} />
            <span className="font-medium">0.3 (低相似)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-4 rounded border border-gray-300" style={{ backgroundColor: getColorForValue(0.5) }} />
            <span className="font-medium">0.5 (中等)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-4 rounded border border-gray-300" style={{ backgroundColor: getColorForValue(0.7) }} />
            <span className="font-medium">0.7 (高相似)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-4 rounded border border-gray-300" style={{ backgroundColor: getColorForValue(1) }} />
            <span className="font-medium">1.0 (相同)</span>
          </div>
        </div>

        {/* 特征点匹配弹窗 */}
        {selectedConnection && (
          <ImagePairFeatureMatching
            image1Url={imageUrls[selectedConnection.row]}
            image2Url={imageUrls[selectedConnection.col]}
            image1Filename={imageNames[selectedConnection.row]}
            image2Filename={imageNames[selectedConnection.col]}
            matches={(() => {
              console.log("🔍 查找匹配数据:", {
                selectedConnection,
                hasOrbData: !!orbData,
                hasPairwiseRegions: !!orbData?.pairwise_regions,
                regionsCount: orbData?.pairwise_regions?.length || 0
              });

              if (!orbData?.pairwise_regions) {
                console.warn("❌ 没有 pairwise_regions 数据");
                return [];
              }

              const region = orbData.pairwise_regions?.find(
                r => (r.image1_idx === selectedConnection.row && r.image2_idx === selectedConnection.col) ||
                     (r.image1_idx === selectedConnection.col && r.image2_idx === selectedConnection.row)
              );

              if (!region) {
                console.warn("❌ 未找到匹配的 region:", { row: selectedConnection.row, col: selectedConnection.col });
                console.log("可用的 regions:", orbData.pairwise_regions.map(r => ({
                  image1_idx: r.image1_idx,
                  image2_idx: r.image2_idx,
                  hasMatches: !!r.matches,
                  matchCount: r.matches?.length || 0
                })));
                return [];
              }

              console.log("✅ 找到 region:", {
                image1_idx: region.image1_idx,
                image2_idx: region.image2_idx,
                hasMatches: !!region.matches,
                matchesCount: region.matches?.length || 0,
                similarity: region.similarity,
                match_count: region.match_count
              });

              if (!region.matches || region.matches.length === 0) {
                console.warn("❌ region 中没有 matches 数据");
                return [];
              }

              if (region.image1_idx === selectedConnection.col) {
                // 如果索引顺序相反，需要调换query和train点
                console.log("🔄 需要交换索引顺序");
                return region.matches.map(m => ({
                  ...m,
                  queryPoint: m.trainPoint,
                  trainPoint: m.queryPoint,
                  queryIdx: m.trainIdx,
                  trainIdx: m.queryIdx
                }));
              }

              console.log("✅ 返回 matches:", region.matches.length);
              return region.matches || [];
            })()}
            keypoints1={(() => {
              if (!orbData?.pairwise_regions) return [];

              const region = orbData.pairwise_regions?.find(
                r => (r.image1_idx === selectedConnection.row && r.image2_idx === selectedConnection.col) ||
                     (r.image1_idx === selectedConnection.col && r.image2_idx === selectedConnection.row)
              );

              if (region && region.image1_idx === selectedConnection.col) {
                return region.keypoints2;
              }

              return region?.keypoints1 || [];
            })()}
            keypoints2={(() => {
              if (!orbData?.pairwise_regions) return [];

              const region = orbData.pairwise_regions?.find(
                r => (r.image1_idx === selectedConnection.row && r.image2_idx === selectedConnection.col) ||
                     (r.image1_idx === selectedConnection.col && r.image2_idx === selectedConnection.row)
              );

              if (region && region.image1_idx === selectedConnection.col) {
                return region.keypoints1;
              }

              return region?.keypoints2 || [];
            })()}
            similarity={(() => {
              if (orbData?.pairwise_regions) {
                const region = orbData.pairwise_regions?.find(
                  r => (r.image1_idx === selectedConnection.row && r.image2_idx === selectedConnection.col) ||
                       (r.image1_idx === selectedConnection.col && r.image2_idx === selectedConnection.row)
                );
                return region?.similarity || matrix[selectedConnection.row][selectedConnection.col];
              }
              return matrix[selectedConnection.row][selectedConnection.col];
            })()}
            onClose={() => setSelectedConnection(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
