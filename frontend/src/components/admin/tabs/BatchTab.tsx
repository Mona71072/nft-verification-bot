import React, { useState, useCallback } from 'react';
import { useBatchProcessing } from '../../../hooks/useBatchProcessing';
import type { BatchConfig } from '../../../types';

interface BatchTabProps {
  apiBaseUrl: string;
  mode?: 'admin' | 'roles' | 'mint';
}

export function BatchTab({ apiBaseUrl, mode }: BatchTabProps) {
  const {
    batchConfig,
    batchStats,
    batchLoading,
    startBatchProcessing,
    stopBatchProcessing,
    updateBatchStats
  } = useBatchProcessing();

  const [configForm, setConfigForm] = useState<Partial<BatchConfig>>({
    batchSize: 10,
    delayMs: 1000,
    maxRetries: 3,
    targetCollection: '',
    operation: 'verify'
  });

  const handleStartBatch = useCallback(async () => {
    if (!configForm.batchSize || !configForm.delayMs || !configForm.maxRetries) {
      alert('すべてのフィールドを入力してください');
      return;
    }

    try {
      await startBatchProcessing(configForm as BatchConfig, apiBaseUrl);
    } catch (error) {
      alert('バッチ処理の開始に失敗しました');
    }
  }, [configForm, startBatchProcessing, apiBaseUrl]);

  const handleStopBatch = useCallback(async () => {
    try {
      await stopBatchProcessing(apiBaseUrl);
    } catch (error) {
      alert('バッチ処理の停止に失敗しました');
    }
  }, [stopBatchProcessing, apiBaseUrl]);

  return (
    <div>
      <h3>バッチ処理管理</h3>
      
      {/* バッチ設定フォーム */}
      <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h4>バッチ処理設定</h4>
        <div style={{ display: 'grid', gap: '1rem', maxWidth: '400px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>
              バッチサイズ:
            </label>
            <input
              type="number"
              value={configForm.batchSize || ''}
              onChange={(e) => setConfigForm(prev => ({ ...prev, batchSize: parseInt(e.target.value) }))}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              min="1"
              max="100"
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>
              遅延時間 (ms):
            </label>
            <input
              type="number"
              value={configForm.delayMs || ''}
              onChange={(e) => setConfigForm(prev => ({ ...prev, delayMs: parseInt(e.target.value) }))}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              min="100"
              max="10000"
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>
              最大リトライ回数:
            </label>
            <input
              type="number"
              value={configForm.maxRetries || ''}
              onChange={(e) => setConfigForm(prev => ({ ...prev, maxRetries: parseInt(e.target.value) }))}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              min="0"
              max="10"
            />
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500' }}>
              操作タイプ:
            </label>
            <select
              value={configForm.operation || 'verify'}
              onChange={(e) => setConfigForm(prev => ({ ...prev, operation: e.target.value as any }))}
              style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              <option value="verify">検証</option>
              <option value="mint">ミント</option>
              <option value="update">更新</option>
            </select>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={handleStartBatch}
              disabled={batchLoading || batchConfig !== null}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: batchLoading || batchConfig ? '#ccc' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: batchLoading || batchConfig ? 'not-allowed' : 'pointer'
              }}
            >
              {batchLoading ? '開始中...' : 'バッチ処理開始'}
            </button>
            
            <button
              onClick={handleStopBatch}
              disabled={batchLoading || batchConfig === null}
              style={{
                flex: 1,
                padding: '0.75rem',
                background: batchLoading || !batchConfig ? '#ccc' : '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: batchLoading || !batchConfig ? 'not-allowed' : 'pointer'
              }}
            >
              停止
            </button>
          </div>
        </div>
      </div>

      {/* バッチ処理状況 */}
      {batchConfig && (
        <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #28a745', borderRadius: '8px', backgroundColor: '#f8fff9' }}>
          <h4>バッチ処理実行中</h4>
          <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
            <div><strong>バッチサイズ:</strong> {batchConfig.batchSize}</div>
            <div><strong>遅延時間:</strong> {batchConfig.delayMs}ms</div>
            <div><strong>最大リトライ:</strong> {batchConfig.maxRetries}</div>
            <div><strong>操作:</strong> {batchConfig.operation}</div>
          </div>
        </div>
      )}

      {/* バッチ統計 */}
      {batchStats && (
        <div style={{ padding: '1rem', border: '1px solid #007bff', borderRadius: '8px', backgroundColor: '#f0f8ff' }}>
          <h4>処理統計</h4>
          <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.875rem' }}>
            <div><strong>処理済み:</strong> {batchStats.processed}</div>
            <div><strong>成功:</strong> {batchStats.success}</div>
            <div><strong>失敗:</strong> {batchStats.failed}</div>
            <div><strong>残り:</strong> {batchStats.remaining}</div>
            <div><strong>進捗:</strong> {Math.round((batchStats.processed / (batchStats.processed + batchStats.remaining)) * 100)}%</div>
          </div>
        </div>
      )}

      {/* 注意事項 */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#fff3cd',
        border: '1px solid #ffeaa7',
        borderRadius: '8px',
        fontSize: '0.875rem'
      }}>
        <strong>注意:</strong> バッチ処理は大量のリクエストを送信するため、システムに負荷をかける可能性があります。適切な設定で実行してください。
      </div>
    </div>
  );
}
