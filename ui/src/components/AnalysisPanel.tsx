import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Zap, Cpu, Layers, Play, type LucideIcon } from "lucide-react";
import { HashType } from "@/lib/api";
import { cn } from "@/lib/utils";

interface AnalysisPanelProps {
  projectId: string;
  hasImages: boolean;
  loading?: boolean;
  onAnalyze: (hashType: HashType) => void;
}

const algorithms: { value: HashType; label: string; description: string; icon: LucideIcon }[] = [
  {
    value: "orb",
    label: "ORB 局部特征",
    description: "关键点+描述子匹配，精度高但计算更慢",
    icon: Cpu,
  },
  {
    value: "brisk",
    label: "BRISK 二进制特征",
    description: "二进制描述子，速度快，抗旋转",
    icon: Zap,
  },
  {
    value: "sift",
    label: "SIFT 关键点",
    description: "尺度不变特征，更稳健（计算更慢）",
    icon: Layers,
  },
];

export function AnalysisPanel({ projectId, hasImages, onAnalyze, loading }: AnalysisPanelProps) {
  const [algorithm, setAlgorithm] = useState<HashType>("orb");

  const handleAnalyze = async () => {
    onAnalyze(algorithm);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>图像分析</CardTitle>
        <CardDescription>选择分析算法并开始处理</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup value={algorithm} onValueChange={(v) => setAlgorithm(v as HashType)}>
          <div className="space-y-3">
            {algorithms.map((algo) => {
              const Icon = algo.icon;
              return (
                <div
                  key={algo.value}
                  className={cn(
                    "flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer",
                    algorithm === algo.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  )}
                  onClick={() => setAlgorithm(algo.value)}
                >
                  <RadioGroupItem value={algo.value} id={algo.value} className="mt-1" />
                  <div className="flex-1">
                    <Label
                      htmlFor={algo.value}
                      className="flex items-center gap-2 text-base font-medium cursor-pointer"
                    >
                      <Icon className="h-5 w-5 text-primary" />
                      {algo.label}
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">{algo.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </RadioGroup>

        <Button
          onClick={handleAnalyze}
          disabled={!hasImages || loading}
          className="w-full gap-2"
          size="lg"
        >
          <Play className="h-4 w-4" />
          {loading ? "分析中..." : "开始分析"}
        </Button>

        {!hasImages && (
          <p className="text-sm text-center text-muted-foreground">
            请先上传至少一张图片
          </p>
        )}
      </CardContent>
    </Card>
  );
}
