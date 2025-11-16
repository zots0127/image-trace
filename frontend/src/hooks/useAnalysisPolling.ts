import { useEffect, useState, useRef } from "react";
import { getAnalysisStatus, type AnalysisResult } from "@/lib/api";

interface UseAnalysisPollingProps {
  analysisId: string | null;
  onComplete?: (result: AnalysisResult) => void;
  onError?: (error: Error) => void;
  interval?: number;
}

export function useAnalysisPolling({
  analysisId,
  onComplete,
  onError,
  interval = 2000,
}: UseAnalysisPollingProps) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!analysisId) {
      setIsPolling(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // 防止重复轮询
    if (isPolling) {
      return;
    }

    setIsPolling(true);

    const poll = async () => {
      // 检查组件是否仍然挂载和仍然有analysisId
      if (!analysisId || intervalRef.current === null) {
        return;
      }

      try {
        const data = await getAnalysisStatus(analysisId);
        setResult(data);

        if (data.status === "completed") {
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onComplete?.(data);
        } else if (data.status === "failed") {
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          onError?.(new Error(data.error_message || data.error || "分析失败"));
        }
      } catch (error) {
        console.error("轮询错误:", error);
        setIsPolling(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        onError?.(error as Error);
      }
    };

    // 立即执行一次
    poll();

    // 设置定时轮询
    intervalRef.current = setInterval(poll, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPolling(false);
    };
  }, [analysisId, interval]);

  return { result, isPolling };
}
