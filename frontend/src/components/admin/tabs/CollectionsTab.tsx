import React, { useState, useCallback } from 'react';
import type { NFTCollection } from '../../../types';
import { useCollections } from '../../../hooks/useCollections';

interface CollectionsTabProps {
  apiBaseUrl: string;
  mode?: 'admin' | 'roles' | 'mint';
}

export function CollectionsTab({ apiBaseUrl }: CollectionsTabProps) {
  const {
    collections,
    loading,
    message,
    fetchCollections,
    removeCollection
  } = useCollections();

  const [createColName, setCreateColName] = useState<string>('');
  const [createColSymbol, setCreateColSymbol] = useState<string>('');
  const [createColTypePath, setCreateColTypePath] = useState<string>('');
  const [creatingCollection, setCreatingCollection] = useState<boolean>(false);
  const [createColMessage, setCreateColMessage] = useState<string>('');

  // 初期データ読み込み
  React.useEffect(() => {
    fetchCollections(apiBaseUrl);
  }, [fetchCollections, apiBaseUrl]);

  const proposeSymbol = (name: string | undefined) => {
    if (!name) return '';
    const ascii = name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return ascii.slice(0, 6) || 'EVENT';
  };

  const handleCreateCollectionViaMove = useCallback(async () => {
    try {
      if (creatingCollection) return;
      setCreatingCollection(true);
      setCreateColMessage('コレクション作成中...');

      const mtResponse = await fetch(`${apiBaseUrl}/api/move-targets`);
      const mtData = await mtResponse.json();
      const defaultMoveTarget = mtData?.data?.defaultMoveTarget;

      if (!defaultMoveTarget) {
        setCreateColMessage('エラー: DEFAULT_MOVE_TARGETが設定されていません');
        return;
      }

      const packageId = defaultMoveTarget.split('::')[0];
      const autoTypePath = defaultMoveTarget.replace('::mint_to', '::EventNFT');

      const addr = localStorage.getItem('currentWalletAddress') || (window as any).currentWalletAddress;
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(addr ? { 'X-Admin-Address': addr } : {})
      };

      const body = {
        name: createColName || 'Event Collection',
        packageId,
        typePath: createColTypePath || autoTypePath,
        moveTarget: defaultMoveTarget,
        description: `Symbol: ${createColSymbol || 'EVENT'}`
      };

      const res = await fetch(`${apiBaseUrl}/api/mint-collections`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data?.success) {
        setCreateColMessage('コレクションを作成しました');
        await fetchCollections(apiBaseUrl);
        setCreateColName('');
        setCreateColSymbol('');
        setCreateColTypePath('');
      } else {
        setCreateColMessage(data?.error || 'コレクション作成に失敗しました');
      }
    } catch (error: any) {
      setCreateColMessage(error?.message || 'コレクション作成に失敗しました');
    } finally {
      setCreatingCollection(false);
    }
  }, [creatingCollection, apiBaseUrl, createColName, createColSymbol, createColTypePath, fetchCollections]);

  return (
    <div>
      <h3>コレクション管理</h3>
      
      {/* コレクション作成フォーム */}
      <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h4>新しいコレクションを作成</h4>
        <div style={{ display: 'grid', gap: '1rem', maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="コレクション名"
            value={createColName}
            onChange={(e) => {
              setCreateColName(e.target.value);
              setCreateColSymbol(proposeSymbol(e.target.value));
            }}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input
            type="text"
            placeholder="シンボル"
            value={createColSymbol}
            onChange={(e) => setCreateColSymbol(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <input
            type="text"
            placeholder="型パス"
            value={createColTypePath}
            onChange={(e) => setCreateColTypePath(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button
            onClick={handleCreateCollectionViaMove}
            disabled={creatingCollection || !createColName || !createColSymbol}
            style={{
              padding: '0.75rem',
              background: creatingCollection ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: creatingCollection ? 'not-allowed' : 'pointer'
            }}
          >
            {creatingCollection ? '作成中...' : 'コレクション作成'}
          </button>
        </div>
        {createColMessage && (
          <div style={{ marginTop: '1rem', padding: '0.5rem', background: '#f8f9fa', borderRadius: '4px' }}>
            {createColMessage}
          </div>
        )}
      </div>

      {/* コレクション一覧 */}
      <div>
        <h4>既存のコレクション</h4>
        {loading ? (
          <div>読み込み中...</div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {collections.map((collection: NFTCollection) => (
              <div
                key={collection.id}
                style={{
                  padding: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <strong>{collection.name}</strong>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>
                    {collection.symbol || 'N/A'} - {collection.typePath || 'N/A'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    編集
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`「${collection.name}」を削除しますか？`)) return;
                      try {
                        const addr = localStorage.getItem('currentWalletAddress') || (window as any).currentWalletAddress;
                        const res = await fetch(`${apiBaseUrl}/api/collections/${collection.id}`, {
                          method: 'DELETE',
                          headers: {
                            'Content-Type': 'application/json',
                            ...(addr ? { 'X-Admin-Address': addr } : {})
                          }
                        });
                        const data = await res.json();
                        if (data.success) {
                          removeCollection(collection.id);
                        }
                      } catch {
                      }
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {message && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: '#dbeafe',
          border: '1px solid #93c5fd',
          borderRadius: '8px',
          color: '#1e40af'
        }}>
          {message}
        </div>
      )}
    </div>
  );
}
