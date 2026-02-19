import { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { StatCard } from '../../components/admin/StatCard';
import { NavigationCard } from '../../components/admin/NavigationCard';
import { PageHeader } from '../../components/admin/PageHeader';
import { DisplaySettingsSection } from '../../components/admin/DisplaySettingsSection';
import { useResponsive, getResponsiveValue } from '../../hooks/useResponsive';
import { useAdminDisplaySettings, useUpdateDisplaySettings } from '../../hooks/useDisplaySettings';
import { useCollections } from '../../hooks/queries/useCollections';
import type { AdminMintEvent } from '../../types';

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
  // コレクション取得（統合済み）
  const { data: collections = [] } = useCollections();
  const [mintCollections, setMintCollections] = useState<any[]>([]);
  const [events, setEvents] = useState<AdminMintEvent[]>([]);
  const [adminAddresses, setAdminAddresses] = useState<string[]>([]);
  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showAdmins, setShowAdmins] = useState(false);
  const [showDisplaySettings, setShowDisplaySettings] = useState(false);
  
  // 表示設定（管理者用）
  const { data: displaySettings } = useAdminDisplaySettings();
  const updateDisplaySettings = useUpdateDisplaySettings();
  
  // カウントダウン用（アクティブイベントのリアルタイム更新）
  const [nowTs, setNowTs] = useState<number>(Date.now());
  
  // レスポンシブ対応
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  try {
    const responsive = useResponsive();
    deviceType = responsive.deviceType;
  } catch (error) {
  }

  const fetchMintCollections = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/mint-collections`);
      const data = await res.json();
      if (data.success) setMintCollections(data.data || []);
    } catch (e) {
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/events`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setEvents(data.data || []);
    } catch (e) {
    }
  }, []);

  const fetchAdminAddresses = useCallback(async () => {
    setAdminLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/addresses`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setAdminAddresses(data.data || []);
    } catch (e) {
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const handleAddAdminAddress = useCallback(async () => {
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
  }, [newAdminAddress, fetchAdminAddresses]);

  const handleRemoveAdminAddress = useCallback(async (address: string) => {
    if (adminAddresses.length <= 1) {
      setMessage('最低1つの管理者が必要です');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    if (!confirm(`管理者を削除しますか？\n${address}`)) return;
    setAdminLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/addresses/${encodeURIComponent(address)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
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
  }, [adminAddresses.length, fetchAdminAddresses]);

  // 統計データ（メモ化）
  const stats = useMemo(() => {
    const activeEvents = events.filter(event => {
      const start = Date.parse(event.startAt);
      const end = Date.parse(event.endAt);
      return nowTs >= start && nowTs <= end;
    }).length;
    
    return {
      totalCollections: collections.length,
      totalMintCollections: mintCollections.length,
      totalEvents: events.length,
      activeEvents: activeEvents
    };
  }, [collections.length, mintCollections.length, events.length, events, nowTs]);

  // カウントダウン用（アクティブイベントのリアルタイム更新）
  useEffect(() => {
    const hasActiveEvents = events.some(event => {
      const start = Date.parse(event.startAt);
      const end = Date.parse(event.endAt);
      const currentTime = Date.now();
      return currentTime >= start && currentTime <= end;
    });
    
    if (!hasActiveEvents) {
      setNowTs(Date.now());
      return;
    }
    
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [events]);

  // データ取得
  useEffect(() => {
    fetchMintCollections();
    fetchEvents();
    fetchAdminAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 非クリティカルな処理をアイドル時に実行
  useEffect(() => {
    const runIdleTasks = () => {
      // 統計データの詳細計算など、重い処理をアイドル時に実行
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          // 必要に応じて追加の処理をここに配置
        }, { timeout: 5000 });
      }
    };

    const timer = setTimeout(runIdleTasks, 1000);
    return () => clearTimeout(timer);
  }, []);

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
        gridTemplateColumns: getResponsiveValue(
          'repeat(1, 1fr)', 
          'repeat(2, 1fr)', 
          'repeat(auto-fit, minmax(240px, 1fr))', 
          deviceType
        ),
        gap: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
        marginBottom: getResponsiveValue('1.5rem', '1.75rem', '2rem', deviceType)
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
        gridTemplateColumns: getResponsiveValue(
          'repeat(1, 1fr)', 
          'repeat(1, 1fr)', 
          'repeat(auto-fit, minmax(320px, 1fr))', 
          deviceType
        ),
        gap: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
        marginBottom: getResponsiveValue('1.5rem', '1.75rem', '2rem', deviceType)
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
        borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
        padding: getResponsiveValue('1rem', '1.5rem', '2rem', deviceType),
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
          justifyContent: 'space-between',
          alignItems: getResponsiveValue('flex-start', 'center', 'center', deviceType),
          gap: getResponsiveValue('1rem', '0.5rem', '0', deviceType),
          marginBottom: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
          paddingBottom: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType),
          borderBottom: '2px solid #e5e7eb'
        }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: getResponsiveValue('1rem', '1.125rem', '1.25rem', deviceType), 
              fontWeight: 700, 
              color: '#111827' 
            }}>
              管理者管理
            </h2>
            <p style={{ 
              margin: '0.25rem 0 0 0', 
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType), 
              color: '#6b7280' 
            }}>
              システム管理者の追加・削除
            </p>
          </div>
          <button
            onClick={() => setShowAdmins(!showAdmins)}
            style={{
              padding: getResponsiveValue('0.375rem 0.75rem', '0.4375rem 0.875rem', '0.5rem 1rem', deviceType),
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType),
              cursor: 'pointer',
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
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
              marginBottom: getResponsiveValue('1.5rem', '1.75rem', '2rem', deviceType), 
              padding: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType), 
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType)
            }}>
              <h3 style={{ 
                margin: '0 0 1rem 0', 
                fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType), 
                fontWeight: 600, 
                color: '#111827' 
              }}>
                新しい管理者を追加
              </h3>
              <div style={{ 
                display: 'flex', 
                flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
                gap: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType), 
                alignItems: getResponsiveValue('stretch', 'flex-end', 'flex-end', deviceType)
              }}>
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontWeight: 500, 
                    fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType), 
                    color: '#374151' 
                  }}>
                    ウォレットアドレス
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={newAdminAddress}
                    onChange={(e) => setNewAdminAddress(e.target.value)}
                    style={{
                      width: '100%',
                      padding: getResponsiveValue('0.625rem 0.75rem', '0.6875rem 0.875rem', '0.75rem 1rem', deviceType),
                      border: '1px solid #d1d5db',
                      borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType),
                      fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
                      fontFamily: 'monospace',
                      outline: 'none'
                    }}
                  />
                </div>
                <button
                  onClick={handleAddAdminAddress}
                  disabled={adminLoading || !newAdminAddress.trim()}
                  style={{
                    padding: getResponsiveValue('0.625rem 1rem', '0.6875rem 1.25rem', '0.75rem 1.5rem', deviceType),
                    background: adminLoading || !newAdminAddress.trim() ? '#d1d5db' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType),
                    cursor: adminLoading || !newAdminAddress.trim() ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
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
                flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
                justifyContent: 'space-between', 
                alignItems: getResponsiveValue('flex-start', 'center', 'center', deviceType),
                gap: getResponsiveValue('0.75rem', '0.5rem', '0', deviceType),
                marginBottom: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType)
              }}>
                <h3 style={{ 
                  margin: 0, 
                  fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType), 
                  fontWeight: 600, 
                  color: '#111827' 
                }}>
                  現在の管理者一覧 ({adminAddresses.length}件)
                </h3>
                <button
                  onClick={fetchAdminAddresses}
                  disabled={adminLoading}
                  style={{
                    padding: getResponsiveValue('0.375rem 0.75rem', '0.4375rem 0.875rem', '0.5rem 1rem', deviceType),
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType),
                    cursor: adminLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
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
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType)
                }}>
                  {adminAddresses.map((address, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
                      justifyContent: 'space-between',
                      alignItems: getResponsiveValue('flex-start', 'center', 'center', deviceType),
                      gap: getResponsiveValue('0.75rem', '0.5rem', '0', deviceType),
                      padding: getResponsiveValue('0.75rem', '0.875rem', '1rem 1.25rem', deviceType),
                      background: '#f9fafb',
                      borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType),
                      border: '1px solid #e5e7eb',
                      transition: 'all 0.2s'
                    }}>
                      <div style={{ 
                        flex: 1, 
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
                        alignItems: getResponsiveValue('flex-start', 'center', 'center', deviceType),
                        gap: getResponsiveValue('0.5rem', '0.75rem', '1rem', deviceType)
                      }}>
                        <span style={{
                          fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
                          fontFamily: 'monospace',
                          color: '#374151',
                          fontWeight: 500,
                          wordBreak: 'break-all',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '100%'
                        }}>
                          {address}
                        </span>
                        {index === 0 && (
                          <span style={{
                            background: '#10b981',
                            color: 'white',
                            padding: getResponsiveValue('0.1875rem 0.5rem', '0.21875rem 0.625rem', '0.25rem 0.75rem', deviceType),
                            borderRadius: getResponsiveValue('4px', '5px', '6px', deviceType),
                            fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.75rem', deviceType),
                            marginLeft: getResponsiveValue('0', '0.5rem', '1rem', deviceType),
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            flexShrink: 0
                          }}>
                            メイン管理者
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveAdminAddress(address)}
                        disabled={adminAddresses.length <= 1}
                        style={{
                          padding: getResponsiveValue('0.375rem 0.75rem', '0.4375rem 0.875rem', '0.5rem 1rem', deviceType),
                          background: adminAddresses.length <= 1 ? '#f3f4f6' : 'white',
                          color: adminAddresses.length <= 1 ? '#9ca3af' : '#ef4444',
                          border: `1px solid ${adminAddresses.length <= 1 ? '#e5e7eb' : '#fecaca'}`,
                          borderRadius: getResponsiveValue('4px', '5px', '6px', deviceType),
                          cursor: adminAddresses.length <= 1 ? 'not-allowed' : 'pointer',
                          fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
                          fontWeight: 600,
                          transition: 'all 0.2s',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
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

      {/* 表示設定セクション */}
      <div style={{
        background: 'white',
        borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
        padding: getResponsiveValue('1rem', '1.5rem', '2rem', deviceType),
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        marginTop: getResponsiveValue('1.5rem', '1.75rem', '2rem', deviceType)
      }}>
        <div style={{
          display: 'flex',
          flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
          justifyContent: 'space-between',
          alignItems: getResponsiveValue('flex-start', 'center', 'center', deviceType),
          gap: getResponsiveValue('1rem', '0.5rem', '0', deviceType),
          marginBottom: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
          paddingBottom: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType),
          borderBottom: '2px solid #e5e7eb'
        }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: getResponsiveValue('1rem', '1.125rem', '1.25rem', deviceType), 
              fontWeight: 700, 
              color: '#111827' 
            }}>
              NFT表示設定
            </h2>
            <p style={{ 
              margin: '0.25rem 0 0 0', 
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType), 
              color: '#6b7280' 
            }}>
              ホームページに表示するNFTを選択
            </p>
          </div>
          <button
            onClick={() => setShowDisplaySettings(!showDisplaySettings)}
            style={{
              padding: getResponsiveValue('0.375rem 0.75rem', '0.4375rem 0.875rem', '0.5rem 1rem', deviceType),
              background: '#f3f4f6',
              border: '1px solid #d1d5db',
              borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType),
              cursor: 'pointer',
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
              fontWeight: 600,
              color: '#374151',
              transition: 'all 0.2s'
            }}
          >
            {showDisplaySettings ? '閉じる' : '設定'}
          </button>
        </div>

        {showDisplaySettings && (
          <DisplaySettingsSection
            deviceType={deviceType}
            collections={collections}
            mintCollections={mintCollections}
            events={events}
            displaySettings={displaySettings}
            onSave={async (settings) => {
              try {
                console.log('[AdminDashboard] Saving settings:', {
                  enabledCollections: settings.enabledCollections,
                  imageUrlsKeys: Object.keys(settings.collectionImageUrls || {}),
                  imageUrls: settings.collectionImageUrls,
                  detailUrlsKeys: Object.keys(settings.collectionDetailUrls || {}),
                  detailUrls: settings.collectionDetailUrls,
                });
                const result = await updateDisplaySettings.mutateAsync(settings);
                console.log('[AdminDashboard] Save successful, result:', {
                  imageUrlsKeys: Object.keys(result.collectionImageUrls || {}),
                  imageUrls: result.collectionImageUrls,
                  detailUrlsKeys: Object.keys(result.collectionDetailUrls || {}),
                  detailUrls: result.collectionDetailUrls,
                });
                setMessage('表示設定を保存しました');
                setTimeout(() => setMessage(''), 3000);
                // クエリを無効化して最新の設定を取得
                setTimeout(() => {
                  // displaySettingsが自動的に更新される
                }, 100);
              } catch (error: any) {
                console.error('[AdminDashboard] Save failed:', error);
                setMessage(error.message || '保存に失敗しました');
                setTimeout(() => setMessage(''), 3000);
              }
            }}
            updatePending={updateDisplaySettings.isPending}
          />
        )}
      </div>
    </AdminLayout>
  );
}
