import { useState, useEffect, useCallback, useRef } from 'react';

interface UseOptimizedAPIOptions {
  staleTime?: number;
  retryCount?: number;
  retryDelay?: number;
  enabled?: boolean;
}

interface APIState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  lastFetch: number;
}

export function useOptimizedAPI<T>(
  apiCall: () => Promise<T>,
  options: UseOptimizedAPIOptions = {}
) {
  const {
    staleTime = 15 * 60 * 1000, // 15分（リクエスト削減のため延長）
    retryCount = 2, // リクエスト削減のため削減（3→2）
    retryDelay = 1000,
    enabled = true
  } = options;

  const [state, setState] = useState<APIState<T>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: 0
  });

  const retryTimeoutRef = useRef<number | undefined>(undefined);
  const isStaleRef = useRef(false);
  const lastErrorRef = useRef<number>(0); // 最後にエラーが発生した時刻を記録
  const errorRetryDelay = 30 * 1000; // エラー後は30秒間は再試行しない（無限ループ防止）

  const isStale = useCallback(() => {
    return Date.now() - state.lastFetch > staleTime;
  }, [state.lastFetch, staleTime]);

  const fetchData = useCallback(async (retryAttempt = 0) => {
    if (!enabled) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const data = await apiCall();
      setState({
        data,
        loading: false,
        error: null,
        lastFetch: Date.now()
      });
      isStaleRef.current = false;
      lastErrorRef.current = 0; // 成功時はエラー時刻をリセット
    } catch (error) {
      if (retryAttempt < retryCount) {
        retryTimeoutRef.current = window.setTimeout(() => {
          fetchData(retryAttempt + 1);
        }, retryDelay * Math.pow(2, retryAttempt));
      } else {
        const now = Date.now();
        lastErrorRef.current = now; // エラー時刻を記録
        setState(prev => ({
          ...prev,
          loading: false,
          error: error as Error
        }));
      }
    }
  }, [apiCall, enabled, retryCount, retryDelay]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const invalidate = useCallback(() => {
    setState(prev => ({ ...prev, lastFetch: 0 }));
    isStaleRef.current = true;
    lastErrorRef.current = 0; // 無効化時はエラー時刻もリセット
  }, []);

  useEffect(() => {
    if (!enabled) return;
    
    // エラー後の短期間は再試行しない（無限ループ防止）
    const now = Date.now();
    const timeSinceLastError = now - lastErrorRef.current;
    if (lastErrorRef.current > 0 && timeSinceLastError < errorRetryDelay) {
      return; // エラー後30秒以内は再試行しない
    }
    
    // データが存在しないか、古くなっている場合のみ実行
    // エラー状態の場合は再試行しない（無限ループ防止）
    if (state.data === null || (isStale() && !state.error)) {
      fetchData();
    }
  }, [enabled, fetchData, isStale, state.data, state.error]);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  return {
    ...state,
    refetch,
    invalidate,
    isStale: isStale()
  };
}
