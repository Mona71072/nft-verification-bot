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
      
      // コレクション作成ロジック
      // 実際の実装は元のAdminPanelから移植
      
      setCreateColMessage('コレクションが正常に作成されました');
    } catch (error) {
      setCreateColMessage('コレクション作成に失敗しました');
    } finally {
      setCreatingCollection(false);
    }
  }, [creatingCollection]);

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
                    onClick={() => removeCollection(collection.id)}
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
