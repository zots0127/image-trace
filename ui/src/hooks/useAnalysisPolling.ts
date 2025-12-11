import { useEffect, useState, useRef } from "react";
import { getAnalysisStatus, type AnalysisResult, type HashType } from "@/lib/api";

interface UseAnalysisPollingProps {
  analysisId: string | null;
  onComplete?: (result: AnalysisResult) => void;
  onError?: (error: Error) => void;
  interval?: number;
  hashType?: HashType;
  threshold?: number;
}

export function useAnalysisPolling({
  analysisId,
  onComplete,
  onError,
  interval = 3000,
  hashType = "phash",
  threshold = 0.85,
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
        const data = await getAnalysisStatus(analysisId, hashType, threshold);
        setResult(data);
        setIsPolling(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        onComplete?.(data);
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
