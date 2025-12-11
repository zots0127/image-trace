import { useEffect, useRef, useState, ReactNode } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { checkHealth } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface BackendGateProps {
  children: ReactNode;
}

type Status = "checking" | "ready" | "error";

export function BackendGate({ children }: BackendGateProps) {
  const [status, setStatus] = useState<Status>("checking");
  const [showRetry, setShowRetry] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const retryDelayRef = useRef<ReturnType<typeof setTimeout>>();

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  };

  const probe = async (delayMs = 800) => {
    clearTimer();
    setStatus("checking");
    try {
      await checkHealth();
      setStatus("ready");
    } catch {
      setStatus("error");
      const nextDelay = Math.min(delayMs + 400, 4000);
      timerRef.current = setTimeout(() => probe(nextDelay), nextDelay);
    }
  };

  useEffect(() => {
    probe();
    retryDelayRef.current = setTimeout(() => setShowRetry(true), 120_000); // 2 分钟后才显示“立即重试”
    return () => {
      clearTimer();
      if (retryDelayRef.current) {
        clearTimeout(retryDelayRef.current);
        retryDelayRef.current = undefined;
      }
    };
  }, []);

  if (status === "ready") {
    return <>{children}</>;
  }

  const isRetrying = status === "checking";

  const steps = [
    "正在启动后端服务…",
    "正在加载图像分析模块…",
    "正在加载后端二进制（Nuitka / PyInstaller 构建）…",
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <div className="relative">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
        </div>
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          {steps.map((msg) => (
            <div key={msg} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span>{msg}</span>
            </div>
          ))}
        </div>
        {showRetry && (
          <div className="flex gap-2 mt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => probe()}
              className="gap-1"
              disabled={isRetrying}
            >
              <RefreshCw className="h-4 w-4" />
              立即重试
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
