import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Play, CheckCircle2, Loader2, Image, Sparkles, Network, BarChart3 } from "lucide-react";
import { analyzeImages, getAnalysisStatus } from "@/lib/api";
import { APIError } from "@/lib/errorHandler";
import { useGlobalError } from "@/contexts/ErrorContext";
import { useToast } from "@/hooks/use-toast";

interface AnalysisPanelProps {
  projectId: string;
  hasImages: boolean;
  onAnalysisStarted?: (analysisId: string) => void;
}

interface ProcessingStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  duration: number; // 模拟持续时间（毫秒）
}

const PROCESSING_STEPS: ProcessingStep[] = [
  { id: "init", label: "初始化分析引擎", icon: <Sparkles className="h-4 w-4" />, duration: 800 },
  { id: "load", label: "加载图像数据", icon: <Image className="h-4 w-4" />, duration: 1200 },
  { id: "extract", label: "提取特征点", icon: <Network className="h-4 w-4" />, duration: 1500 },
  { id: "match", label: "计算相似度矩阵", icon: <BarChart3 className="h-4 w-4" />, duration: 1800 },
  { id: "optimize", label: "优化匹配结果", icon: <Sparkles className="h-4 w-4" />, duration: 1000 },
];

export function AnalysisPanel({ projectId, hasImages, onAnalysisStarted }: AnalysisPanelProps) {
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [isWaitingForCompletion, setIsWaitingForCompletion] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { showErrorFromException } = useGlobalError();

  // 模拟处理步骤动画
  useEffect(() => {
    if (!loading) {
      setCurrentStep(0);
      setProgress(0);
      setCompletedSteps(new Set());
      return;
    }

    let currentStepIndex = 0;
    let progressValue = 0;

    const runStep = (stepIndex: number) => {
      if (stepIndex >= PROCESSING_STEPS.length) {
        return;
      }

      const step = PROCESSING_STEPS[stepIndex];
      setCurrentStep(stepIndex);

      // 渐进式进度增长
      const stepProgress = 100 / PROCESSING_STEPS.length;
      const startProgress = progressValue;
      const endProgress = Math.min(progressValue + stepProgress, 95); // 最多到95%，留5%给真实完成
      const progressIncrement = (endProgress - startProgress) / (step.duration / 50);

      const progressInterval = setInterval(() => {
        progressValue += progressIncrement;
        if (progressValue >= endProgress) {
          progressValue = endProgress;
          clearInterval(progressInterval);
        }
        setProgress(Math.min(progressValue, 95));
      }, 50);

      // 步骤完成后继续下一步
      setTimeout(() => {
        clearInterval(progressInterval);
        setCompletedSteps(prev => new Set([...prev, step.id]));
        runStep(stepIndex + 1);
      }, step.duration);
    };

    runStep(0);
  }, [loading]);

  // 清理轮询定时器
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // 开始轮询分析状态
  const startPolling = (analysisIdToCheck: string) => {
    // 清理之前的定时器
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    const checkStatus = async () => {
      try {
        const status = await getAnalysisStatus(analysisIdToCheck);
        
        if (status.status === "completed") {
          // 分析完成，停止轮询
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          // 跳转到结果页面
          toast({
            title: "分析完成",
            description: "正在打开分析结果...",
          });
          
          setTimeout(() => {
            setShowDialog(false);
            setLoading(false);
            setIsWaitingForCompletion(false);
            navigate(`/project/${projectId}/analysis`);
            
            if (onAnalysisStarted) {
              onAnalysisStarted(analysisIdToCheck);
            }
          }, 500);
        } else if (status.status === "failed") {
          // 分析失败
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          
          setShowDialog(false);
          setLoading(false);
          setIsWaitingForCompletion(false);
          
          showErrorFromException(
            new Error(status.error_message || "分析失败"),
            "分析失败"
          );
        }
        // 如果是 processing 状态，继续轮询
      } catch (error) {
        console.error("轮询状态失败:", error);
        // 继续轮询，不中断
      }
    };

    // 立即检查一次
    checkStatus();
    
    // 每2秒轮询一次
    pollingIntervalRef.current = setInterval(checkStatus, 2000);
  };

  const handleAnalyze = async () => {
    // 打开对话框并开始加载动画
    setShowDialog(true);
    setLoading(true);
    setIsWaitingForCompletion(false);
    
    // 计算所有步骤的总时长
    const totalAnimationDuration = PROCESSING_STEPS.reduce((sum, step) => sum + step.duration, 0);
    const animationStartTime = Date.now();
    
    try {
      // 使用综合分析，不需要传递算法参数
      const result = await analyzeImages(projectId);
      setAnalysisId(result.analysis_id);
      
      // 完成所有步骤动画
      setProgress(100);
      setCompletedSteps(new Set(PROCESSING_STEPS.map(s => s.id)));
      
      // 计算已经过去的时间
      const elapsedTime = Date.now() - animationStartTime;
      // 确保至少显示完整动画（总时长）
      const minimumDisplayTime = totalAnimationDuration;
      const remainingTime = Math.max(0, minimumDisplayTime - elapsedTime);
      
      // 等待动画完成后开始轮询
      setTimeout(() => {
        setIsWaitingForCompletion(true);
        startPolling(result.analysis_id);
      }, remainingTime);
    } catch (error) {
      const err = error as APIError;

      // 关闭对话框
      setShowDialog(false);
      setLoading(false);

      // 使用新的错误对话框系统
      showErrorFromException(error, `分析失败: ${err.message}`);

      // 同时显示简短的 toast 通知
      toast({
        title: "分析失败",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>图像分析</CardTitle>
          <CardDescription>点击开始分析，系统将自动应用多种算法进行最佳匹配</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button
            onClick={handleAnalyze}
            disabled={!hasImages || loading}
            className="w-full gap-2"
            size="lg"
          >
            <Play className="h-4 w-4" />
            开始分析
          </Button>

          {!hasImages && (
            <p className="text-sm text-center text-muted-foreground">
              请先上传至少一张图片
            </p>
          )}
        </CardContent>
      </Card>

      {/* 分析进度对话框 */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              正在分析图像
            </DialogTitle>
            <DialogDescription>
              系统正在使用综合分析策略处理您的图片，请稍候...
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 进度条 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-muted-foreground">处理进度</span>
                <span className="font-bold text-primary">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* 处理步骤 */}
            <div className="space-y-3">
              {PROCESSING_STEPS.map((step, index) => {
                const isActive = index === currentStep;
                const isCompleted = completedSteps.has(step.id);
                const isPending = index > currentStep;

                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${
                      isActive
                        ? "bg-primary/10 border-primary shadow-sm scale-105"
                        : isCompleted
                        ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                        : "bg-muted/50 border-muted"
                    }`}
                  >
                    {/* 图标 */}
                    <div
                      className={`flex-shrink-0 transition-all duration-300 ${
                        isActive
                          ? "text-primary animate-pulse"
                          : isCompleted
                          ? "text-green-600 dark:text-green-400"
                          : "text-muted-foreground opacity-50"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : isActive ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        step.icon
                      )}
                    </div>

                    {/* 标签 */}
                    <span
                      className={`text-sm font-medium transition-all duration-300 ${
                        isActive
                          ? "text-primary"
                          : isCompleted
                          ? "text-green-700 dark:text-green-300"
                          : isPending
                          ? "text-muted-foreground opacity-50"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>

                    {/* 状态指示器 */}
                    {isActive && (
                      <div className="ml-auto flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 提示信息 */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground animate-pulse">
                {!isWaitingForCompletion && progress < 30 && "正在准备分析环境..."}
                {!isWaitingForCompletion && progress >= 30 && progress < 60 && "正在提取图像特征..."}
                {!isWaitingForCompletion && progress >= 60 && progress < 90 && "正在计算相似度..."}
                {!isWaitingForCompletion && progress >= 90 && progress < 100 && "即将完成..."}
                {!isWaitingForCompletion && progress === 100 && "✨ 处理完成！"}
                {isWaitingForCompletion && "🔍 正在后台处理分析数据，马上就好..."}
              </p>
            </div>
            
            {/* 等待真实完成时的额外提示 */}
            {isWaitingForCompletion && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">
                  等待服务器处理完成...
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
