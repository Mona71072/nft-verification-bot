import type { MintRecord } from '../hooks/useMints';
import { retryMints } from '../hooks/useMints';

export interface MintRetryService {
  retrySingle: (record: MintRecord) => Promise<void>;
  retryBulk: (records: MintRecord[]) => Promise<{ ok: number; ng: number; total: number }>;
}

export function createMintRetryService(
  apiBaseUrl: string,
  showToast: (message: string, type: 'success' | 'error' | 'info') => void,
  showProgress: (message: string, type: 'success' | 'error' | 'info') => {
    update: (message: string, type: 'success' | 'error' | 'info') => void;
    close: () => void;
  }
): MintRetryService {
  const retrySingle = async (record: MintRecord): Promise<void> => {
    try {
      showToast('再試行を開始しました…', 'info');
      
      const response = await fetch(`${apiBaseUrl}/api/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: record.eventId,
          address: record.recipient,
          // 実運用では必要な署名パラメータ等を別導線で用意
        })
      });

      const result = await response.json();
      
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || '再試行に失敗しました');
      }

      showToast('再試行が完了しました', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : '再試行に失敗しました';
      showToast(`再試行に失敗: ${message}`, 'error');
      throw error;
    }
  };

  const retryBulk = async (records: MintRecord[]): Promise<{ ok: number; ng: number; total: number }> => {
    const progressController = showProgress('一括再試行を開始…', 'info');
    
    try {
      const result = await retryMints(apiBaseUrl, records, (ok, ng, total) => {
        progressController.update(
          `再試行中… 成功 ${ok}/${total} 失敗 ${ng}`, 
          ng > 0 ? 'error' : 'info'
        );
      });

      progressController.update(
        `完了: 成功 ${result.ok}/${result.total} 失敗 ${result.ng}`, 
        result.ng > 0 ? 'error' : 'success'
      );
      
      setTimeout(() => progressController.close(), 2500);
      
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : '一括再試行でエラーが発生しました';
      progressController.update(`一括再試行でエラー: ${message}`, 'error');
      setTimeout(() => progressController.close(), 2500);
      throw error;
    }
  };

  return { retrySingle, retryBulk };
}
