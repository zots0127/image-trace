import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

// 等待时显示的提示信息（类似 Windows 安装提示）
const WAITING_TIPS = [
  "正在使用 ORB 算法提取图像特征点...",
  "正在进行特征点匹配，这可能需要一些时间...",
  "系统正在计算图像相似度矩阵...",
  "正在应用几何验证过滤误匹配...",
  "正在优化匹配结果，提高准确度...",
  "处理大量图像时可能需要更多时间，请耐心等待...",
  "系统正在使用多种算法确保最佳匹配效果...",
  "正在分析图像的颜色、纹理和形状特征...",
  "即将完成，感谢您的耐心等待...",
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
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tipRotationIntervalRef = useRef<NodeJS.Timeout | null>(null);
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

  // 提示文字轮播
  useEffect(() => {
    if (isWaitingForCompletion) {
      // 每4秒切换一次提示文字
      tipRotationIntervalRef.current = setInterval(() => {
        setCurrentTipIndex((prev) => (prev + 1) % WAITING_TIPS.length);
      }, 4000);
    } else {
      if (tipRotationIntervalRef.current) {
        clearInterval(tipRotationIntervalRef.current);
        tipRotationIntervalRef.current = null;
      }
      setCurrentTipIndex(0);
    }

    return () => {
      if (tipRotationIntervalRef.current) {
        clearInterval(tipRotationIntervalRef.current);
        tipRotationIntervalRef.current = null;
      }
    };
  }, [isWaitingForCompletion]);

  // 清理轮询定时器
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (tipRotationIntervalRef.current) {
        clearInterval(tipRotationIntervalRef.current);
        tipRotationIntervalRef.current = null;
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
    // 打开全屏蓝屏界面并开始加载动画
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

      {/* 全屏蓝屏分析界面（融合进度和等待） */}
      {(showDialog || isWaitingForCompletion) && (
        <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900 flex items-center justify-center overflow-hidden">
          {/* 背景装饰圆圈 */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          </div>

          <div className="relative text-center space-y-12 px-8 max-w-4xl w-full">
            {/* 主标题区域 */}
            <div className="space-y-6">
              <div className="flex justify-center">
                <div className="relative">
                  <Loader2 className="h-24 w-24 animate-spin text-white drop-shadow-2xl" />
                  <div className="absolute inset-0 blur-xl opacity-50">
                    <Loader2 className="h-24 w-24 animate-spin text-white" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-5xl font-light text-white tracking-wide drop-shadow-lg">
                  正在分析图像
                </h1>
                <p className="text-lg text-white/60 font-light">
                  Image Trace Analysis
                </p>
              </div>
            </div>

            {/* 动画阶段：显示进度条和步骤 */}
            {!isWaitingForCompletion && (
              <div className="space-y-8 max-w-2xl mx-auto">
                {/* 进度条 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/80 font-light">处理进度</span>
                    <span className="text-2xl font-light text-white">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                    <div 
                      className="h-full bg-white/90 rounded-full transition-all duration-300 shadow-lg"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
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
                        className={`flex items-center gap-4 p-4 rounded-lg backdrop-blur-md border transition-all duration-300 ${
                          isActive
                            ? "bg-white/20 border-white/40 shadow-xl scale-105"
                            : isCompleted
                            ? "bg-white/10 border-white/30"
                            : "bg-white/5 border-white/10"
                        }`}
                      >
                        {/* 图标 */}
                        <div
                          className={`flex-shrink-0 transition-all duration-300 ${
                            isActive
                              ? "text-white animate-pulse scale-110"
                              : isCompleted
                              ? "text-white"
                              : "text-white/40"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : isActive ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <div className="h-5 w-5">{step.icon}</div>
                          )}
                        </div>

                        {/* 标签 */}
                        <span
                          className={`text-base font-light transition-all duration-300 ${
                            isActive
                              ? "text-white"
                              : isCompleted
                              ? "text-white/90"
                              : "text-white/50"
                          }`}
                        >
                          {step.label}
                        </span>

                        {/* 状态指示器 */}
                        {isActive && (
                          <div className="ml-auto flex gap-1.5">
                            <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: "0ms" }} />
                            <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: "150ms" }} />
                            <div className="w-2 h-2 rounded-full bg-white animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 当前步骤提示 */}
                <div className="text-center">
                  <p className="text-lg text-white/90 font-light animate-pulse">
                    {progress < 30 && "正在准备分析环境..."}
                    {progress >= 30 && progress < 60 && "正在提取图像特征..."}
                    {progress >= 60 && progress < 90 && "正在计算相似度..."}
                    {progress >= 90 && progress < 100 && "即将完成..."}
                    {progress === 100 && "✨ 初始化完成！"}
                  </p>
                </div>
              </div>
            )}

            {/* 等待阶段：显示轮播提示 */}
            {isWaitingForCompletion && (
              <div className="space-y-12">
                {/* 进度指示点 */}
                <div className="flex justify-center gap-3">
                  <div className="w-4 h-4 bg-white/70 rounded-full animate-bounce shadow-lg" style={{ animationDelay: "0ms", animationDuration: "1s" }} />
                  <div className="w-4 h-4 bg-white/70 rounded-full animate-bounce shadow-lg" style={{ animationDelay: "200ms", animationDuration: "1s" }} />
                  <div className="w-4 h-4 bg-white/70 rounded-full animate-bounce shadow-lg" style={{ animationDelay: "400ms", animationDuration: "1s" }} />
                </div>

                {/* 提示文字（轮播）- 带淡入淡出效果 */}
                <div className="min-h-[100px] flex items-center justify-center px-4">
                  <div className="relative w-full">
                    <p 
                      className="text-2xl text-white/95 font-light leading-relaxed drop-shadow-md transition-all duration-700 ease-in-out" 
                      key={currentTipIndex}
                      style={{
                        animation: "fadeIn 0.7s ease-in-out"
                      }}
                    >
                      {WAITING_TIPS[currentTipIndex]}
                    </p>
                  </div>
                </div>

                {/* 底部提示区域 */}
                <div className="space-y-3 pt-8">
                  <div className="h-px w-48 mx-auto bg-white/20" />
                  <p className="text-base text-white/80 font-light">
                    请稍候，系统正在处理...
                  </p>
                  <p className="text-sm text-white/50">
                    这可能需要 30 秒到几分钟的时间，完成后将自动跳转
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* CSS 动画定义 */}
          <style>{`
            @keyframes fadeIn {
              0% {
                opacity: 0;
                transform: translateY(10px);
              }
              100% {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
