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
    staleTime = 5 * 60 * 1000, // 5分
    retryCount = 3,
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
    } catch (error) {
      if (retryAttempt < retryCount) {
        retryTimeoutRef.current = window.setTimeout(() => {
          fetchData(retryAttempt + 1);
        }, retryDelay * Math.pow(2, retryAttempt));
      } else {
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
  }, []);

  useEffect(() => {
    if (enabled && (state.data === null || isStale())) {
      fetchData();
    }
  }, [enabled, fetchData, isStale, state.data]);

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
