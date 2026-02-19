import { useState, useCallback } from 'react';
import type { BatchConfig, BatchStats } from '../types';

function getAuthHeaders(): HeadersInit {
  const addr = typeof window !== 'undefined'
    ? localStorage.getItem('currentWalletAddress') || (window as any).currentWalletAddress
    : undefined;
  return {
    'Content-Type': 'application/json',
    ...(addr ? { 'X-Admin-Address': addr } : {})
  };
}

export function useBatchProcessing() {
  const [batchConfig, setBatchConfig] = useState<BatchConfig | null>(null);
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const fetchBatchConfig = useCallback(async (apiBaseUrl: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/batch-config`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success && data.data) {
        setBatchConfig(data.data);
      }
    } catch {
    }
  }, []);

  const fetchBatchStats = useCallback(async (apiBaseUrl: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/batch-stats`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success && data.data) {
        setBatchStats(data.data);
      }
    } catch {
    }
  }, []);

  const startBatchProcessing = useCallback(async (config: BatchConfig, apiBaseUrl: string) => {
    try {
      setBatchLoading(true);
      setIsRunning(true);

      const configRes = await fetch(`${apiBaseUrl}/api/admin/batch-config`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(config)
      });
      const configResult = await configRes.json();
      if (!configResult.success) {
        throw new Error(configResult.error || 'バッチ設定の保存に失敗しました');
      }
      setBatchConfig(config);

      const execRes = await fetch(`${apiBaseUrl}/api/batch-process`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(config)
      });
      const execResult = await execRes.json();

      if (execResult.success) {
        await fetchBatchStats(apiBaseUrl);
      } else {
        throw new Error(execResult.error || 'バッチ処理の実行に失敗しました');
      }
    } catch (error) {
      setIsRunning(false);
      throw error;
    } finally {
      setBatchLoading(false);
    }
  }, [fetchBatchStats]);

  const stopBatchProcessing = useCallback(async (_apiBaseUrl: string) => {
    try {
      setBatchLoading(true);
      setIsRunning(false);
    } catch {
    } finally {
      setBatchLoading(false);
    }
  }, []);

  const updateBatchStats = useCallback((stats: BatchStats) => {
    setBatchStats(stats);
  }, []);

  return {
    batchConfig,
    setBatchConfig,
    batchStats,
    setBatchStats,
    batchLoading,
    setBatchLoading,
    isRunning,
    fetchBatchConfig,
    fetchBatchStats,
    startBatchProcessing,
    stopBatchProcessing,
    updateBatchStats
  };
}
