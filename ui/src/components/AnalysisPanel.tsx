import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Zap, Cpu, Layers, Play, Copy } from "lucide-react";
import { analyzeImages } from "@/lib/api";
import { copyErrorToClipboard, APIError } from "@/lib/errorHandler";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AnalysisPanelProps {
  projectId: string;
  hasImages: boolean;
  onAnalysisStarted: (analysisId: string) => void;
}

const algorithms = [
  {
    value: "fast",
    label: "快速特征分析",
    description: "平均颜色 + 感知哈希，速度最快",
    icon: Zap,
  },
  {
    value: "orb",
    label: "ORB局部特征",
    description: "检测关键点和描述符，精度较高",
    icon: Cpu,
  },
  {
    value: "hybrid",
    label: "混合模式",
    description: "结合多种特征，最准确",
    icon: Layers,
  },
];

export function AnalysisPanel({ projectId, hasImages, onAnalysisStarted }: AnalysisPanelProps) {
  const [algorithm, setAlgorithm] = useState<"fast" | "orb" | "hybrid">("fast");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const result = await analyzeImages(projectId, algorithm);
      toast({
        title: "分析已启动",
        description: "图片分析正在进行中，请稍候...",
      });
      onAnalysisStarted(result.analysis_id);
    } catch (error) {
      const err = error as APIError;
      toast({
        title: "分析失败",
        description: err.message,
        variant: "destructive",
        action: (
          <Button
            variant="secondary"
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            onClick={async () => {
              const success = await copyErrorToClipboard(err);
              if (success) {
                toast({ title: "已复制错误详情" });
              }
            }}
          >
            <Copy className="h-3 w-3 mr-1" />
            复制
          </Button>
        ),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>图像分析</CardTitle>
        <CardDescription>选择分析算法并开始处理</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup value={algorithm} onValueChange={(v) => setAlgorithm(v as any)}>
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
                  onClick={() => setAlgorithm(algo.value as any)}
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
