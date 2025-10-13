import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { StatCard } from '../../components/admin/StatCard';
import { NavigationCard } from '../../components/admin/NavigationCard';
import { PageHeader } from '../../components/admin/PageHeader';
import type { NFTCollection, AdminMintEvent } from '../../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

function getAuthHeaders(): HeadersInit {
  const addr = typeof window !== 'undefined' 
    ? localStorage.getItem('currentWalletAddress') || (window as any).currentWalletAddress 
    : undefined;
  return {
    'Content-Type': 'application/json',
    ...(addr ? { 'X-Admin-Address': addr } : {})
  };
}

export default function AdminDashboard() {
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [mintCollections, setMintCollections] = useState<any[]>([]);
  const [events, setEvents] = useState<AdminMintEvent[]>([]);
  const [adminAddresses, setAdminAddresses] = useState<string[]>([]);
  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showAdmins, setShowAdmins] = useState(false);

  // 統計データ
  const stats = {
    totalCollections: collections.length,
    totalMintCollections: mintCollections.length,
    totalEvents: events.length,
    activeEvents: events.filter(e => e.active).length
  };

  // データ取得
  useEffect(() => {
    fetchCollections();
    fetchMintCollections();
    fetchEvents();
    fetchAdminAddresses();
  }, []);

  const fetchCollections = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/collections`);
      const data = await res.json();
      if (data.success) setCollections(data.data || []);
    } catch (e) {
      console.error('Failed to fetch collections', e);
    }
  };

  const fetchMintCollections = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/mint-collections`);
      const data = await res.json();
      if (data.success) setMintCollections(data.data || []);
    } catch (e) {
      console.error('Failed to fetch mint collections', e);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/events`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setEvents(data.data || []);
    } catch (e) {
      console.error('Failed to fetch events', e);
    }
  };

  const fetchAdminAddresses = async () => {
    setAdminLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/addresses`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setAdminAddresses(data.data || []);
    } catch (e) {
      console.error('Failed to fetch admin addresses', e);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAddAdminAddress = async () => {
    if (!newAdminAddress.trim()) return;
    setAdminLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/addresses`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ address: newAdminAddress.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setMessage('管理者を追加しました');
        setNewAdminAddress('');
        fetchAdminAddresses();
      } else {
        setMessage(data.error || '追加に失敗しました');
      }
    } catch {
      setMessage('追加に失敗しました');
    } finally {
      setAdminLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleRemoveAdminAddress = async (address: string) => {
    if (adminAddresses.length <= 1) {
      setMessage('最低1つの管理者が必要です');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    if (!confirm(`管理者を削除しますか？\n${address}`)) return;
    setAdminLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/addresses`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ address })
      });
      const data = await res.json();
      if (data.success) {
        setMessage('管理者を削除しました');
        fetchAdminAddresses();
      } else {
        setMessage(data.error || '削除に失敗しました');
      }
    } catch {
      setMessage('削除に失敗しました');
    } finally {
      setAdminLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <AdminLayout currentPath="/admin">
      <PageHeader 
        title="管理ダッシュボード"
        description="システム全体の概要と主要機能へのアクセス"
      />

      {/* メッセージ表示 */}
      {message && (
        <div style={{
          padding: '1rem',
          background: '#dbeafe',
          border: '1px solid #93c5fd',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          color: '#1e40af',
          fontSize: '0.875rem'
        }}>
          {message}
        </div>
      )}

      {/* 統計カード */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <StatCard
          label="総コレクション数"
          value={stats.totalCollections}
          gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
        />
        <StatCard
          label="ミントコレクション"
          value={stats.totalMintCollections}
          gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
        />
        <StatCard
          label="総イベント数"
          value={stats.totalEvents}
          gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
        />
        <StatCard
          label="アクティブイベント"
          value={stats.activeEvents}
          gradient="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
        />
      </div>

      {/* クイックアクション */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <NavigationCard
          title="ロール管理"
          description="NFTホルダーのDiscordロール付与を管理。コレクション設定、バッチ処理、DM通知を制御できます。"
          href="/admin/roles"
        />
        <NavigationCard
          title="イベント管理"
          description="NFTミントイベントの作成・編集・管理。ミント期間やコレクション設定を行います。"
          href="/admin/mint/events"
        />
        <NavigationCard
          title="ミント履歴"
          description="コレクション別のNFTミント履歴を確認。CSVエクスポート、検索、フィルター機能が利用可能です。"
          href="/admin/mint/history"
        />
      </div>

      {/* 管理者管理セクション */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '2px solid #e5e7eb'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
              管理者管理
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              システム管理者の追加・削除
            </p>
          </div>
          <button
            onClick={() => setShowAdmins(!showAdmins)}
            style={{
              padding: '0.5rem 1rem',
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              transition: 'all 0.2s'
            }}
          >
            {showAdmins ? '閉じる' : '表示'}
          </button>
        </div>

        {showAdmins && (
          <>
            {/* 管理者追加フォーム */}
            <div style={{ 
              marginBottom: '2rem', 
              padding: '1.5rem', 
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#111827' }}>
                新しい管理者を追加
              </h3>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.875rem', color: '#374151' }}>
                    ウォレットアドレス
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={newAdminAddress}
                    onChange={(e) => setNewAdminAddress(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem 1rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontFamily: 'monospace',
                      outline: 'none'
                    }}
                  />
                </div>
                <button
                  onClick={handleAddAdminAddress}
                  disabled={adminLoading || !newAdminAddress.trim()}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: adminLoading || !newAdminAddress.trim() ? '#d1d5db' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: adminLoading || !newAdminAddress.trim() ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s'
                  }}
                >
                  {adminLoading ? '追加中...' : '管理者追加'}
                </button>
              </div>
            </div>

            {/* 現在の管理者一覧 */}
            <div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '1rem'
              }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#111827' }}>
                  現在の管理者一覧 ({adminAddresses.length}件)
                </h3>
                <button
                  onClick={fetchAdminAddresses}
                  disabled={adminLoading}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: adminLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    transition: 'all 0.2s'
                  }}
                >
                  {adminLoading ? '更新中...' : '更新'}
                </button>
              </div>

              {adminLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                  <p>管理者一覧を読み込み中...</p>
                </div>
              ) : adminAddresses.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {adminAddresses.map((address, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem 1.25rem',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      transition: 'all 0.2s'
                    }}>
                      <div>
                        <span style={{
                          fontSize: '0.875rem',
                          fontFamily: 'monospace',
                          color: '#374151',
                          fontWeight: 500
                        }}>
                          {address}
                        </span>
                        {index === 0 && (
                          <span style={{
                            background: '#10b981',
                            color: 'white',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            marginLeft: '1rem',
                            fontWeight: 600
                          }}>
                            メイン管理者
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveAdminAddress(address)}
                        disabled={adminAddresses.length <= 1}
                        style={{
                          padding: '0.5rem 1rem',
                          background: adminAddresses.length <= 1 ? '#f3f4f6' : 'white',
                          color: adminAddresses.length <= 1 ? '#9ca3af' : '#ef4444',
                          border: `1px solid ${adminAddresses.length <= 1 ? '#e5e7eb' : '#fecaca'}`,
                          borderRadius: '6px',
                          cursor: adminAddresses.length <= 1 ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: 600,
                          transition: 'all 0.2s'
                        }}
                        title={adminAddresses.length <= 1 ? '最低1つの管理者が必要です' : '管理者を削除'}
                        onMouseEnter={(e) => {
                          if (adminAddresses.length > 1) {
                            e.currentTarget.style.background = '#ef4444';
                            e.currentTarget.style.color = 'white';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (adminAddresses.length > 1) {
                            e.currentTarget.style.background = 'white';
                            e.currentTarget.style.color = '#ef4444';
                          }
                        }}
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '3rem',
                  color: '#9ca3af',
                  background: '#f9fafb',
                  borderRadius: '8px',
                  border: '2px dashed #e5e7eb'
                }}>
                  管理者が登録されていません
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

