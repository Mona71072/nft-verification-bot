import React, { useCallback } from 'react';
import { useAdminManagement } from '../../../hooks/useAdminManagement';

interface AdminsTabProps {
  apiBaseUrl: string;
  mode?: 'admin' | 'roles' | 'mint';
}

export function AdminsTab({ apiBaseUrl }: AdminsTabProps) {
  const {
    adminAddresses,
    newAdminAddress,
    setNewAdminAddress,
    adminLoading,
    fetchAdminAddresses,
    addAdminAddress,
    removeAdminAddress
  } = useAdminManagement();

  // 初期データ読み込み
  React.useEffect(() => {
    fetchAdminAddresses(apiBaseUrl);
  }, [fetchAdminAddresses, apiBaseUrl]);

  const handleAddAdmin = useCallback(async () => {
    if (!newAdminAddress.trim()) return;
    
    const result = await addAdminAddress(newAdminAddress.trim(), apiBaseUrl);
    if (!result.success) {
      alert(result.error);
    }
  }, [newAdminAddress, addAdminAddress, apiBaseUrl]);

  const handleRemoveAdmin = useCallback(async (address: string) => {
    if (!confirm(`管理者 ${address} を削除しますか？`)) return;
    
    const result = await removeAdminAddress(address, apiBaseUrl);
    if (!result.success) {
      alert(result.error);
    }
  }, [removeAdminAddress, apiBaseUrl]);

  return (
    <div>
      <h3>管理者管理</h3>
      
      {/* 新しい管理者追加 */}
      <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid #ddd', borderRadius: '8px' }}>
        <h4>新しい管理者を追加</h4>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', maxWidth: '500px' }}>
          <input
            type="text"
            placeholder="管理者アドレスを入力"
            value={newAdminAddress}
            onChange={(e) => setNewAdminAddress(e.target.value)}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #d1d5db',
              fontSize: '0.875rem'
            }}
          />
          <button
            onClick={handleAddAdmin}
            disabled={adminLoading || !newAdminAddress.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              background: adminLoading ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: adminLoading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              whiteSpace: 'nowrap'
            }}
          >
            {adminLoading ? '追加中...' : '管理者追加'}
          </button>
        </div>
      </div>

      {/* 管理者一覧 */}
      <div>
        <h4>現在の管理者 ({adminAddresses.length}人)</h4>
        {adminAddresses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            管理者が登録されていません
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {adminAddresses.map((address, index) => (
              <div
                key={address}
                style={{
                  padding: '1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  backgroundColor: '#f9fafb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                    {address}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    管理者 #{index + 1}
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveAdmin(address)}
                  disabled={adminLoading}
                  style={{
                    padding: '0.5rem 1rem',
                    background: adminLoading ? '#ccc' : '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: adminLoading ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                  }}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 注意事項 */}
      <div style={{
        marginTop: '2rem',
        padding: '1rem',
        backgroundColor: '#fef3cd',
        border: '1px solid #fecaca',
        borderRadius: '8px',
        fontSize: '0.875rem'
      }}>
        <strong>注意:</strong> 管理者権限は慎重に管理してください。管理者はシステム全体にアクセスできます。
      </div>
    </div>
  );
}
