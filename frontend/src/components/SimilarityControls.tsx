import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, BarChart3, Network } from "lucide-react";

export type ViewMode = 'matrix' | 'network' | 'combined';

interface SimilarityControlsProps {
  threshold: number;
  onThresholdChange: (threshold: number) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  connectionCount: number;
  totalPossibleConnections: number;
  selectedImage: number | null;
  onClearSelection: () => void;
}

const THRESHOLD_PRESETS = [
  { label: '宽松', value: 0.1, description: '显示所有可能的连接' },
  { label: '中等', value: 0.3, description: '平衡的相似度要求' },
  { label: '严格', value: 0.5, description: '只显示较相似的连接' },
  { label: '很严格', value: 0.7, description: '只显示高度相似的连接' },
];

export function SimilarityControls({
  threshold,
  onThresholdChange,
  viewMode,
  onViewModeChange,
  connectionCount,
  totalPossibleConnections,
  selectedImage,
  onClearSelection
}: SimilarityControlsProps) {
  const connectionPercentage = totalPossibleConnections > 0
    ? (connectionCount / totalPossibleConnections * 100).toFixed(1)
    : '0';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>相似度控制</CardTitle>
          </div>
          {selectedImage !== null && (
            <Badge variant="secondary" className="cursor-pointer" onClick={onClearSelection}>
              已选择图片 {selectedImage + 1}
            </Badge>
          )}
        </div>
        <CardDescription>
          调整相似度阈值和视图模式来探索图片关系
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 视图模式切换 */}
        <div>
          <label className="text-sm font-medium mb-3 block">视图模式</label>
          <Tabs value={viewMode} onValueChange={(value) => onViewModeChange(value as ViewMode)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="matrix" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                矩阵
              </TabsTrigger>
              <TabsTrigger value="network" className="flex items-center gap-2">
                <Network className="h-4 w-4" />
                网络
              </TabsTrigger>
              <TabsTrigger value="combined" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                组合
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* 相似度阈值控制 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">
              相似度阈值
            </label>
            <Badge variant="outline">
              {connectionCount} / {totalPossibleConnections} 连接 ({connectionPercentage}%)
            </Badge>
          </div>

          <Slider
            value={[threshold]}
            onValueChange={(value) => onThresholdChange(value[0])}
            max={1}
            min={0.1}
            step={0.05}
            className="w-full mb-3"
          />

          <div className="text-center text-sm font-medium text-muted-foreground mb-3">
            当前阈值: {threshold.toFixed(2)}
          </div>

          {/* 预设阈值按钮 */}
          <div className="grid grid-cols-2 gap-2">
            {THRESHOLD_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                variant={threshold === preset.value ? "default" : "outline"}
                size="sm"
                onClick={() => onThresholdChange(preset.value)}
                className="h-auto p-2 flex flex-col items-start"
              >
                <span className="font-medium">{preset.label}</span>
                <span className="text-xs opacity-70">{preset.value.toFixed(1)}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* 统计信息 */}
        <div className="space-y-2 pt-2 border-t">
          <h4 className="text-sm font-medium">统计信息</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">连接密度:</span>
              <div className="font-medium">{connectionPercentage}%</div>
            </div>
            <div>
              <span className="text-muted-foreground">有效连接:</span>
              <div className="font-medium">{connectionCount}</div>
            </div>
          </div>
        </div>

        {/* 使用提示 */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p>• <strong>矩阵视图:</strong> 热力图显示所有图片对的相似度</p>
          <p>• <strong>网络视图:</strong> 节点和连线显示图片关系</p>
          <p>• <strong>组合视图:</strong> 同时显示矩阵和网络</p>
          <p>• 点击图片可高亮显示其所有连接</p>
          <p>• 拖拽网络节点可调整布局</p>
        </div>
      </CardContent>
    </Card>
  );
}