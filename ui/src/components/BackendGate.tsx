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
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

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
    return () => clearTimer();
  }, []);

  if (status === "ready") {
    return <>{children}</>;
  }

  const isRetrying = status === "checking";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-center px-6">
        <div className="relative">
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
        </div>
        <p className="text-lg font-semibold">后端启动中，请稍候…</p>
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
      </div>
    </div>
  );
}
