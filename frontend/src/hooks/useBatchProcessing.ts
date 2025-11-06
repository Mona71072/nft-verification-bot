import { useState, useCallback } from 'react';
import type { BatchConfig, BatchStats } from '../types';

export function useBatchProcessing() {
  const [batchConfig, setBatchConfig] = useState<BatchConfig | null>(null);
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  const startBatchProcessing = useCallback(async (config: BatchConfig, apiBaseUrl: string) => {
    try {
      setBatchLoading(true);
      setBatchConfig(config);
      
      const response = await fetch(`${apiBaseUrl}/api/admin/batch/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setBatchStats(result.data);
      } else {
        throw new Error(result.error || 'バッチ処理の開始に失敗しました');
      }
    } catch (error) {
      throw error;
    } finally {
      setBatchLoading(false);
    }
  }, []);

  const stopBatchProcessing = useCallback(async (apiBaseUrl: string) => {
    try {
      setBatchLoading(true);
      
      const response = await fetch(`${apiBaseUrl}/api/admin/batch/stop`, {
        method: 'POST'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setBatchStats(null);
        setBatchConfig(null);
      }
    } catch (error) {
      // Error handling without logging
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
    startBatchProcessing,
    stopBatchProcessing,
    updateBatchStats
  };
}
