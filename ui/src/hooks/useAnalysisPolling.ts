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
  interval = 3000,
}: UseAnalysisPollingProps) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!analysisId) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);

    const poll = async () => {
      try {
        const data = await getAnalysisStatus(analysisId);
        setResult(data);

        if (data.status === "completed") {
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          onComplete?.(data);
        } else if (data.status === "failed") {
          setIsPolling(false);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          onError?.(new Error(data.error || "分析失败"));
        }
      } catch (error) {
        setIsPolling(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
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
      }
    };
  }, [analysisId, interval, onComplete, onError]);

  return { result, isPolling };
}
