import { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { StatCard } from '../../components/admin/StatCard';
import { NavigationCard } from '../../components/admin/NavigationCard';
import { PageHeader } from '../../components/admin/PageHeader';
import { useResponsive, getResponsiveValue } from '../../hooks/useResponsive';
import { useAdminDisplaySettings, useUpdateDisplaySettings } from '../../hooks/useDisplaySettings';
import { useCollections } from '../../hooks/queries/useCollections';
import type { AdminMintEvent, DisplaySettings } from '../../types';

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

// 表示設定セクションコンポーネント
function DisplaySettingsSection({
  deviceType,
  collections,
  mintCollections,
  events,
  displaySettings,
  onSave,
  updatePending
}: {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  collections: any[];
  mintCollections: any[];
  events: AdminMintEvent[];
  displaySettings?: DisplaySettings;
  onSave: (settings: DisplaySettings) => void;
  updatePending: boolean;
}) {
  const [enabledCollections, setEnabledCollections] = useState<string[]>(
    displaySettings?.enabledCollections || []
  );
  const [enabledEvents, setEnabledEvents] = useState<string[]>(
    displaySettings?.enabledEvents || []
  );
  const [customNFTTypes, setCustomNFTTypes] = useState<string[]>(
    displaySettings?.customNFTTypes || []
  );
  const [newCustomNFTType, setNewCustomNFTType] = useState('');
  const [detectedCollectionName, setDetectedCollectionName] = useState<string | null>(null);
  const [includeKiosk, setIncludeKiosk] = useState<boolean>(
    displaySettings?.includeKiosk ?? true
  );
  const [collectionDisplayNames, setCollectionDisplayNames] = useState<Record<string, string>>(
    displaySettings?.collectionDisplayNames || {}
  );
  const [collectionImageUrls, setCollectionImageUrls] = useState<Record<string, string>>(
    displaySettings?.collectionImageUrls || {}
  );
  const [collectionDetailUrls, setCollectionDetailUrls] = useState<Record<string, string>>(
    displaySettings?.collectionDetailUrls || {}
  );
  const [collectionLayouts, setCollectionLayouts] = useState<Array<{ id: string; title: string; subtitle?: string; imageUrl?: string; collectionIds: string[] }>>(
    displaySettings?.collectionLayouts || []
  );
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());

  const normalizeCollectionId = (collectionId: string) => {
    const match = collections.find(col => 
      col.id === collectionId ||
      col.packageId === collectionId ||
      (col as any).roleId === collectionId ||
      (col as any).originalId === collectionId
    );
    return match ? match.id : collectionId;
  };

  const normalizeCollectionIds = (ids: string[]) => {
    const normalized = new Set<string>();
    ids.forEach(id => {
      normalized.add(normalizeCollectionId(id));
    });
    return Array.from(normalized);
  };

  useEffect(() => {
    if (displaySettings) {
      setEnabledCollections(normalizeCollectionIds(displaySettings.enabledCollections));
      setEnabledEvents(displaySettings.enabledEvents);
      setCustomNFTTypes(displaySettings.customNFTTypes);
      setIncludeKiosk(displaySettings.includeKiosk ?? true);
      setCollectionDisplayNames(displaySettings.collectionDisplayNames || {});
      
      // collectionImageUrlsとcollectionDetailUrlsのキーを元のコレクションIDにマッピング
      // KVには正規化されたキー（canonical ID）で保存されているが、UIではcollection.idを使用している
      const mappedImageUrls: Record<string, string> = {};
      const mappedDetailUrls: Record<string, string> = {};
      
      if (displaySettings.collectionImageUrls) {
        Object.entries(displaySettings.collectionImageUrls).forEach(([canonicalKey, value]) => {
          // 正規化されたキーから元のコレクションを見つける
          const matchingCollection = collections.find(col => 
            normalizeCollectionId(col.id) === canonicalKey ||
            normalizeCollectionId(col.packageId || '') === canonicalKey ||
            ((col as any).roleId && normalizeCollectionId((col as any).roleId) === canonicalKey)
          );
          if (matchingCollection) {
            // 元のコレクションIDをキーとして使用
            mappedImageUrls[matchingCollection.id] = value;
          }
        });
      }
      
      if (displaySettings.collectionDetailUrls) {
        Object.entries(displaySettings.collectionDetailUrls).forEach(([canonicalKey, value]) => {
          // 正規化されたキーから元のコレクションを見つける
          const matchingCollection = collections.find(col => 
            normalizeCollectionId(col.id) === canonicalKey ||
            normalizeCollectionId(col.packageId || '') === canonicalKey ||
            ((col as any).roleId && normalizeCollectionId((col as any).roleId) === canonicalKey)
          );
          if (matchingCollection) {
            // 元のコレクションIDをキーとして使用
            mappedDetailUrls[matchingCollection.id] = value;
          }
        });
      }
      
      setCollectionImageUrls(mappedImageUrls);
      setCollectionDetailUrls(mappedDetailUrls);
      const normalizedLayouts = (displaySettings.collectionLayouts || []).map(layout => ({
        id: layout.id || `layout_${Date.now()}`,
        title: layout.title || '',
        subtitle: layout.subtitle,
        imageUrl: layout.imageUrl,
        collectionIds: normalizeCollectionIds(layout.collectionIds || [])
      }));
      setCollectionLayouts(normalizedLayouts);
    } else {
      setIncludeKiosk(true);
      setEnabledCollections([]);
      setEnabledEvents([]);
      setCustomNFTTypes([]);
      setCollectionDisplayNames({});
      setCollectionImageUrls({});
      setCollectionDetailUrls({});
      setCollectionLayouts([]);
    }
  }, [displaySettings, collections]);

  const handleCollectionToggle = (collectionId: string) => {
    const canonicalId = normalizeCollectionId(collectionId);
    const wasSelected = enabledCollections.includes(canonicalId);

    setEnabledCollections(prev => 
      prev.includes(canonicalId)
        ? prev.filter(id => id !== canonicalId)
        : [...prev, canonicalId]
    );

    if (wasSelected) {
      setCollectionDisplayNames(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          if (normalizeCollectionId(key) === canonicalId) {
            delete next[key];
          }
        });
        return next;
      });
      setCollectionImageUrls(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          if (normalizeCollectionId(key) === canonicalId) {
            delete next[key];
          }
        });
        return next;
      });
      setCollectionDetailUrls(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          if (normalizeCollectionId(key) === canonicalId) {
            delete next[key];
          }
        });
        return next;
      });

      setCollectionLayouts(prev => prev
        .map(layout => ({
          ...layout,
          collectionIds: layout.collectionIds.filter(id => normalizeCollectionId(id) !== canonicalId)
        }))
        .filter(layout => layout.collectionIds.length > 0 || (layout.title?.trim() || layout.subtitle?.trim()))
      );
    }
  };

  const handleAddLayout = () => {
    setCollectionLayouts(prev => ([
      ...prev,
      { id: `layout_${Date.now()}`, title: '', subtitle: '', imageUrl: '', collectionIds: [] }
    ]));
  };

  const handleRemoveLayout = (layoutId: string) => {
    setCollectionLayouts(prev => prev.filter(layout => layout.id !== layoutId));
  };

  const handleLayoutFieldChange = (layoutId: string, field: 'title' | 'subtitle' | 'imageUrl', value: string) => {
    setCollectionLayouts(prev => prev.map(layout =>
      layout.id === layoutId ? { ...layout, [field]: value } : layout
    ));
  };

  const handleLayoutCollectionToggle = (layoutId: string, collectionId: string) => {
    const canonicalId = normalizeCollectionId(collectionId);
    setCollectionLayouts(prev => prev.map(layout => {
      if (layout.id !== layoutId) return layout;
      const exists = layout.collectionIds.includes(canonicalId);
      const nextIds = exists
        ? layout.collectionIds.filter(id => id !== canonicalId)
        : [...layout.collectionIds, canonicalId];
      return {
        ...layout,
        collectionIds: Array.from(new Set(nextIds))
      };
    }));
  };

  const handleEventToggle = (eventId: string) => {
    setEnabledEvents(prev => 
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  // タイプ入力からコレクション名を検出
  const detectCollectionFromType = (typeInput: string): string | null => {
    if (!typeInput || !typeInput.includes('::')) return null;
    
    // packageId::module::StructName 形式から packageId を抽出
    const parts = typeInput.split('::');
    if (parts.length < 3) return null;
    
    const packageId = parts[0];
    
    // コレクションリストから一致するものを検索
    const matchedCollection = collections.find(col => 
      col.packageId === packageId ||
      col.id === packageId ||
      (col as any).typePath === typeInput ||
      col.id === typeInput
    );
    
    return matchedCollection ? (matchedCollection.displayName || matchedCollection.name) : null;
  };

  // タイプ入力が変更されたときにコレクション名を検出
  const handleCustomNFTTypeChange = (value: string) => {
    setNewCustomNFTType(value);
    const detected = detectCollectionFromType(value);
    setDetectedCollectionName(detected);
  };

  const handleAddCustomNFTType = () => {
    if (newCustomNFTType.trim() && !customNFTTypes.includes(newCustomNFTType.trim())) {
      setCustomNFTTypes(prev => [...prev, newCustomNFTType.trim()]);
      setNewCustomNFTType('');
      setDetectedCollectionName(null);
    }
  };

  const handleRemoveCustomNFTType = (nftType: string) => {
    setCustomNFTTypes(prev => prev.filter(type => type !== nftType));
  };

  const handleSave = () => {
    const sanitizedDisplayNames = Object.entries(collectionDisplayNames).reduce<Record<string, string>>((acc, [key, value]) => {
      if (!value) return acc;
      const canonical = normalizeCollectionId(key);
      if (enabledCollections.includes(canonical)) {
        acc[canonical] = value;
      }
      return acc;
    }, {});

    // 画像URLと詳細URLは、enabledCollectionsに含まれているものだけを保存
    // キーを正規化して保存することで、異なる形式のIDでも正しく保存される
    const sanitizedImageUrls = Object.entries(collectionImageUrls).reduce<Record<string, string>>((acc, [key, value]) => {
      if (!value || !value.trim()) return acc;
      const canonical = normalizeCollectionId(key);
      // enabledCollectionsに含まれている場合のみ保存（正規化されたIDで比較）
      if (enabledCollections.includes(canonical)) {
        acc[canonical] = value.trim();
      }
      return acc;
    }, {});

    const sanitizedDetailUrls = Object.entries(collectionDetailUrls).reduce<Record<string, string>>((acc, [key, value]) => {
      if (!value || !value.trim()) return acc;
      const canonical = normalizeCollectionId(key);
      // enabledCollectionsに含まれている場合のみ保存（正規化されたIDで比較）
      if (enabledCollections.includes(canonical)) {
        acc[canonical] = value.trim();
      }
      return acc;
    }, {});

    // デバッグ用ログ（本番環境でも有効）
    console.log('[handleSave] Saving settings:', {
      enabledCollections,
      imageUrlsKeys: Object.keys(sanitizedImageUrls),
      imageUrls: sanitizedImageUrls,
      detailUrlsKeys: Object.keys(sanitizedDetailUrls),
      detailUrls: sanitizedDetailUrls,
      rawImageUrls: collectionImageUrls,
      rawDetailUrls: collectionDetailUrls,
      rawImageUrlsKeys: Object.keys(collectionImageUrls),
      rawDetailUrlsKeys: Object.keys(collectionDetailUrls),
      collectionIds: collections.map(col => ({ id: col.id, normalized: normalizeCollectionId(col.id) }))
    });

    // customNFTTypesに対応する仮想コレクションIDを生成
    const virtualCollectionIds = new Set<string>();
    customNFTTypes.forEach(customType => {
      virtualCollectionIds.add(`custom_${customType.replace(/[^a-zA-Z0-9]/g, '_')}`);
      // NFTタイプ自体も保存（後で解決できるように）
      virtualCollectionIds.add(customType);
    });

    const sanitizedLayouts = collectionLayouts
      .map(layout => {
        const normalizedIds = normalizeCollectionIds(layout.collectionIds);
        // enabledCollectionsに含まれているか、customNFTTypesに対応する仮想コレクションIDの場合は含める
        const ids = normalizedIds.filter(id => 
          enabledCollections.includes(id) || 
          virtualCollectionIds.has(id) ||
          customNFTTypes.includes(id) ||
          id.startsWith('custom_')
        );
        return {
          id: layout.id || `layout_${Date.now()}`,
          title: layout.title?.trim() || '',
          subtitle: layout.subtitle?.trim() || undefined,
          imageUrl: layout.imageUrl?.trim() || undefined,
          collectionIds: ids
        };
      })
      .filter(layout => layout.collectionIds.length > 0 || layout.title || layout.subtitle);

    // collectionInfoを収集（enabledCollectionsに含まれる各コレクションの情報）
    const collectionInfo: Record<string, { packageId: string; collectionId: string; name: string; nftType: string }> = {};
    
    // enabledCollectionsに含まれるコレクションの情報を収集
    enabledCollections.forEach(enabledId => {
      const canonicalId = normalizeCollectionId(enabledId);
      
      // collectionsからコレクションを検索
      const collection = collections.find(col => 
        normalizeCollectionId(col.id) === canonicalId ||
        normalizeCollectionId(col.packageId || '') === canonicalId ||
        ((col as any).roleId && normalizeCollectionId((col as any).roleId) === canonicalId)
      );
      
      // mintCollectionsからも検索（イベント作成時に使用されるコレクション）
      const mintCollection = mintCollections.find(mc => {
        const typePath = (mc as any).typePath;
        if (!typePath) return false;
        return normalizeCollectionId(typePath) === canonicalId || 
               normalizeCollectionId(mc.id || '') === canonicalId;
      });
      
      let packageId = '';
      let name = '';
      let nftType = '';
      
      if (collection) {
        packageId = collection.packageId || '';
        name = collection.name || enabledId;
        // packageIdからNFTタイプを推測（デフォルトパターン）
        if (packageId && !nftType) {
          nftType = `${packageId}::sxt_nft::EventNFT`;
        }
      }
      
      if (mintCollection) {
        const typePath = (mintCollection as any).typePath;
        if (!typePath) {
          console.error('MintCollection typePath is missing:', mintCollection);
        } else {
          // typePathからpackageIdを抽出
          if (typePath.includes('::')) {
            const extractedPackageId = typePath.split('::')[0];
            if (!packageId && extractedPackageId) {
              packageId = extractedPackageId;
            }
          }
          nftType = typePath;
        }
        
        if (!name && mintCollection.name) {
          name = mintCollection.name;
        }
      }
      
      // コレクション情報が見つかった場合のみ保存
      if (canonicalId && (packageId || name || nftType)) {
        collectionInfo[canonicalId] = {
          packageId: packageId || '',
          collectionId: canonicalId,
          name: name || enabledId,
          nftType: nftType || ''
        };
      }
    });
    
    // enabledEventsに含まれるイベントのコレクション情報を収集
    enabledEvents.forEach(eventId => {
      const event = events.find(e => e.id === eventId);
      if (!event || !event.collectionId) return;
      
      const eventCollectionId = event.collectionId;
      const normalizedEventCollectionId = normalizeCollectionId(eventCollectionId);
      
      // 既にcollectionInfoに存在する場合はスキップ
      if (collectionInfo[normalizedEventCollectionId] || collectionInfo[eventCollectionId]) {
        return;
      }
      
      // パッケージIDを抽出（event.moveCall.targetから、またはevent.collectionIdから）
      let packageId = '';
      if (event.moveCall?.target && event.moveCall.target.includes('::')) {
        packageId = event.moveCall.target.split('::')[0];
      } else if (eventCollectionId.includes('::')) {
        packageId = eventCollectionId.split('::')[0];
      }
      
      // NFTタイプはevent.collectionId
      const nftType = eventCollectionId;
      
      // コレクション名をmintCollectionsから検索
      let collectionName = '';
      const mintCollection = mintCollections.find(mc => {
        const typePath = (mc as any).typePath || '';
        return typePath === eventCollectionId || 
               normalizeCollectionId(typePath) === normalizedEventCollectionId;
      });
      
      if (mintCollection) {
        collectionName = mintCollection.name || '';
      }
      
      // コレクション情報を保存
      if (normalizedEventCollectionId && (packageId || nftType)) {
        collectionInfo[normalizedEventCollectionId] = {
          packageId: packageId || '',
          collectionId: normalizedEventCollectionId,
          name: collectionName || eventCollectionId,
          nftType: nftType
        };
      }
    });

    onSave({
      enabledCollections,
      enabledEvents,
      customNFTTypes,
      includeKiosk,
      collectionDisplayNames: sanitizedDisplayNames,
      collectionImageUrls: sanitizedImageUrls,
      collectionDetailUrls: sanitizedDetailUrls,
      collectionLayouts: sanitizedLayouts,
      collectionInfo
    });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: getResponsiveValue('1.5rem', '1.75rem', '2rem', deviceType)
    }}>
      {/* Kiosk設定 */}
      <div>
        <h3 style={{
          margin: '0 0 0.75rem 0',
          fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType),
          fontWeight: 600,
          color: '#111827'
        }}>
          所有形態
        </h3>
        <p style={{
          margin: '0 0 1rem 0',
          fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
          color: '#6b7280'
        }}>
          Kiosk経由で保有しているNFTを表示対象に含めるかどうかを選択できます。
        </p>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          cursor: 'pointer',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
          background: '#f9fafb'
        }}>
          <input
            type="checkbox"
            checked={includeKiosk}
            onChange={(e) => setIncludeKiosk(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
          />
          <div>
            <div style={{ fontWeight: 600, color: '#111827' }}>Kiosk内のNFTを表示する</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              チェックを外すとウォレットで直接保有しているNFTのみを表示します。
            </div>
          </div>
        </label>
      </div>

      {/* コレクション選択 */}
      <div>
        <h3 style={{
          margin: '0 0 1rem 0',
          fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType),
          fontWeight: 600,
          color: '#111827'
        }}>
          表示するコレクション
        </h3>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxHeight: '200px',
          overflowY: 'auto',
          padding: '0.75rem',
          background: '#f9fafb',
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          {collections.length === 0 ? (
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.875rem' }}>
              コレクションが登録されていません
            </p>
          ) : (
            collections.map(collection => (
              <label key={collection.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                cursor: 'pointer',
                padding: '0.5rem',
                borderRadius: '4px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <input
                  type="checkbox"
                  checked={enabledCollections.includes(collection.id)}
                  onChange={() => handleCollectionToggle(collection.id)}
                  style={{
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: '#111827', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span>{collection.name}</span>
                    {enabledCollections.includes(collection.id) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.75rem', color: '#4b5563' }}>
                          ALLタブ表示名
                        </label>
                        <input
                          type="text"
                          value={collectionDisplayNames[collection.id] || ''}
                          onChange={(e) => setCollectionDisplayNames(prev => ({
                            ...prev,
                            [collection.id]: e.target.value
                          }))}
                          placeholder="例: SCXT / イベント名"
                          style={{
                            fontSize: '0.8125rem',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db'
                          }}
                        />
                        <label style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '0.25rem' }}>
                          画像URL（任意）
                        </label>
                        <input
                          type="text"
                          value={collectionImageUrls[collection.id] || ''}
                          onChange={(e) => setCollectionImageUrls(prev => ({
                            ...prev,
                            [collection.id]: e.target.value
                          }))}
                          placeholder="例: ipfs://bafybeig73j45xcjuqgetzcvo26xyyojcfup3wuez3syq2czyhgbruzs3de"
                          style={{
                            fontSize: '0.8125rem',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db'
                          }}
                        />
                        <label style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '0.25rem' }}>
                          詳細URL（任意）
                        </label>
                        <input
                          type="text"
                          value={collectionDetailUrls[collection.id] || ''}
                          onChange={(e) => setCollectionDetailUrls(prev => ({
                            ...prev,
                            [collection.id]: e.target.value
                          }))}
                          placeholder="例: https://example.com/collection"
                          style={{
                            fontSize: '0.8125rem',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db'
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    {collection.packageId}
                  </div>
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {/* ALLタブグループ設定 */}
      <div>
        <h3 style={{
          margin: '0 0 0.75rem 0',
          fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType),
          fontWeight: 600,
          color: '#111827'
        }}>
          ALLタブのグループ表示
        </h3>
        <p style={{
          margin: '0 0 1rem 0',
          fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
          color: '#6b7280'
        }}>
          コレクションをグループ分けして、ALLタブの見出しや用途別の表示をカスタマイズできます。
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType)
        }}>
          {collectionLayouts.length === 0 && (
            <div style={{
              padding: '1rem',
              border: '1px dashed #cbd5f5',
              borderRadius: '8px',
              background: '#f8fafc',
              color: '#475569',
              fontSize: '0.875rem'
            }}>
              グループ設定はまだありません。「グループを追加」をクリックして作成してください。
            </div>
          )}

          {collectionLayouts.map(layout => (
            <div key={layout.id} style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
              background: '#fff'
            }}>
              <div style={{
                display: 'flex',
                flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
                gap: getResponsiveValue('0.75rem', '1rem', '1rem', deviceType),
                alignItems: getResponsiveValue('flex-start', 'center', 'center', deviceType)
              }}>
                <div style={{ flex: 1 }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    marginBottom: '0.25rem'
                  }}>
                    グループ名
                  </label>
                  <input
                    type="text"
                    value={layout.title}
                    onChange={(e) => handleLayoutFieldChange(layout.id, 'title', e.target.value)}
                    placeholder="例: イベントNFT"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{
                    display: 'block',
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    marginBottom: '0.25rem'
                  }}>
                    サブタイトル（任意）
                  </label>
                  <input
                    type="text"
                    value={layout.subtitle || ''}
                    onChange={(e) => handleLayoutFieldChange(layout.id, 'subtitle', e.target.value)}
                    placeholder="例: イベント関連のNFT"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '0.875rem'
                    }}
                  />
                </div>
                <button
                  onClick={() => handleRemoveLayout(layout.id)}
                  style={{
                    padding: getResponsiveValue('0.5rem 0.75rem', '0.55rem 0.9rem', '0.6rem 1rem', deviceType),
                    background: '#fee2e2',
                    color: '#b91c1c',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap'
                  }}
                >
                  削除
                </button>
              </div>

              <div style={{
                marginTop: getResponsiveValue('0.75rem', '1rem', '1rem', deviceType)
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.75rem',
                  color: '#6b7280',
                  marginBottom: '0.25rem'
                }}>
                  画像URL（任意）
                </label>
                <input
                  type="text"
                  value={layout.imageUrl || ''}
                  onChange={(e) => handleLayoutFieldChange(layout.id, 'imageUrl', e.target.value)}
                  placeholder="https://example.com/image.png"
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div style={{
                marginTop: getResponsiveValue('0.75rem', '1rem', '1rem', deviceType),
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                {enabledCollections.length === 0 && (
                  <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
                    表示するコレクションを選択すると設定できます。
                  </div>
                )}
                {enabledCollections.map(enabledId => {
                  const collection = collections.find(col => normalizeCollectionId(col.id) === enabledId || normalizeCollectionId(col.packageId || '') === enabledId) || collections.find(col => col.id === enabledId);
                  const label = collectionDisplayNames[enabledId] || collection?.name || enabledId;
                  return (
                    <label key={`${layout.id}-${enabledId}`} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.45rem 0.75rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '999px',
                      background: layout.collectionIds.includes(enabledId) ? '#eef2ff' : '#f9fafb',
                      transition: 'all 0.2s',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={layout.collectionIds.includes(enabledId)}
                        onChange={() => handleLayoutCollectionToggle(layout.id, enabledId)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.8125rem', color: '#1f2937' }}>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <button
            onClick={handleAddLayout}
            disabled={enabledCollections.length === 0}
            style={{
              alignSelf: 'flex-start',
              padding: getResponsiveValue('0.5rem 0.9rem', '0.6rem 1rem', '0.7rem 1.25rem', deviceType),
              background: enabledCollections.length === 0 ? '#e2e8f0' : '#2563eb',
              color: enabledCollections.length === 0 ? '#94a3b8' : '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: enabledCollections.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 600
            }}
          >
            グループを追加
          </button>
        </div>
      </div>

      {/* イベント選択 */}
      <div>
        <h3 style={{
          margin: '0 0 1rem 0',
          fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType),
          fontWeight: 600,
          color: '#111827'
        }}>
          表示するイベント
        </h3>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          maxHeight: '200px',
          overflowY: 'auto',
          padding: '0.75rem',
          background: '#f9fafb',
          borderRadius: '6px',
          border: '1px solid #e5e7eb'
        }}>
          {events.length === 0 ? (
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.875rem' }}>
              イベントが登録されていません
            </p>
          ) : (
            events.map(event => {
              // イベント情報から直接取得できる情報
              const eventCollectionId = event.collectionId || '';
              const eventPackageId = event.moveCall?.target ? event.moveCall.target.split('::')[0] : (eventCollectionId.includes('::') ? eventCollectionId.split('::')[0] : '');
              const eventNFTType = eventCollectionId || (event.moveCall?.target ? event.moveCall.target.replace('::mint_to', '::EventNFT') : '');
              
              const isExpanded = expandedEventIds.has(event.id);
              
              return (
                <div key={event.id} style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  border: '1px solid #e5e7eb',
                  background: '#f9fafb'
                }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                  >
                    <input
                      type="checkbox"
                      checked={enabledEvents.includes(event.id)}
                      onChange={() => handleEventToggle(event.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer',
                        marginTop: '0.25rem'
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, color: '#111827' }}>
                        {event.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        {event.description || '説明なし'}
                      </div>
                    </div>
                  </label>
                  
                  <div style={{ marginLeft: '2rem' }}>
                    <button
                      onClick={() => {
                        setExpandedEventIds(prev => {
                          const next = new Set(prev);
                          if (next.has(event.id)) {
                            next.delete(event.id);
                          } else {
                            next.add(event.id);
                          }
                          return next;
                        });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        background: isExpanded ? '#e0f2fe' : '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#0c4a6e',
                        width: '100%',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>イベント情報・コレクション情報</span>
                      <span style={{ fontSize: '0.875rem' }}>
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </button>
                    
                    {isExpanded && (
                      <div style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        background: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        color: '#0c4a6e'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {/* イベント情報セクション */}
                          <div style={{ borderBottom: '1px solid #bae6fd', paddingBottom: '0.75rem' }}>
                            <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.75rem' }}>保存されているイベント情報</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div>
                                <strong>パッケージID:</strong>
                                <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', marginTop: '0.25rem', wordBreak: 'break-all' }}>
                                  {eventPackageId || '未設定'}
                                </div>
                              </div>
                              <div>
                                <strong>コレクションID:</strong>
                                <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', marginTop: '0.25rem', wordBreak: 'break-all' }}>
                                  {eventCollectionId || '未設定'}
                                </div>
                              </div>
                              <div>
                                <strong>名前:</strong> {event.name || '未設定'}
                              </div>
                              <div>
                                <strong>NFTタイプ:</strong>
                                <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', marginTop: '0.25rem', wordBreak: 'break-all' }}>
                                  {eventNFTType || '未設定'}
                                </div>
                              </div>
                              {event.moveCall?.target && (
                                <div>
                                  <strong>Move Call Target:</strong>
                                  <div style={{ fontFamily: 'monospace', fontSize: '0.65rem', marginTop: '0.25rem', wordBreak: 'break-all' }}>
                                    {event.moveCall.target}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 独自NFTタイプ */}
      <div>
        <h3 style={{
          margin: '0 0 1rem 0',
          fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType),
          fontWeight: 600,
          color: '#111827'
        }}>
          独自NFTタイプ
        </h3>
        <div style={{
          display: 'flex',
          flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
          gap: '0.75rem',
          marginBottom: '1rem'
        }}>
          <input
            type="text"
            value={newCustomNFTType}
            onChange={(e) => handleCustomNFTTypeChange(e.target.value)}
            placeholder="packageId::module::StructName"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddCustomNFTType();
              }
            }}
            style={{
              flex: 1,
              padding: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType),
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: getResponsiveValue('0.875rem', '0.875rem', '0.875rem', deviceType)
            }}
          />
          <button
            onClick={handleAddCustomNFTType}
            style={{
              padding: getResponsiveValue('0.5rem 1rem', '0.625rem 1.25rem', '0.75rem 1.5rem', deviceType),
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
              fontWeight: 600,
              whiteSpace: 'nowrap'
            }}
          >
            追加
          </button>
        </div>
        {detectedCollectionName && (
          <div style={{
            padding: '0.5rem 0.75rem',
            background: '#dbeafe',
            border: '1px solid #93c5fd',
            borderRadius: '6px',
            fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
            color: '#1e40af',
            marginBottom: '0.5rem'
          }}>
            💡 検出されたコレクション: <strong>{detectedCollectionName}</strong>
          </div>
        )}
        {customNFTTypes.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            {customNFTTypes.map((nftType, index) => (
              <div key={index} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem',
                background: '#f3f4f6',
                borderRadius: '6px',
                border: '1px solid #e5e7eb'
              }}>
                <span style={{
                  fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
                  color: '#111827',
                  fontFamily: 'monospace'
                }}>
                  {nftType}
                </span>
                <button
                  onClick={() => handleRemoveCustomNFTType(nftType)}
                  style={{
                    padding: '0.25rem 0.75rem',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 保存ボタン */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '0.75rem',
        paddingTop: '1rem',
        borderTop: '1px solid #e5e7eb'
      }}>
        <button
          onClick={handleSave}
          disabled={updatePending}
          style={{
            padding: getResponsiveValue('0.625rem 1.25rem', '0.6875rem 1.5rem', '0.75rem 2rem', deviceType),
            background: updatePending ? '#9ca3af' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: updatePending ? 'not-allowed' : 'pointer',
            fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType),
            fontWeight: 600,
            transition: 'background 0.2s'
          }}
        >
          {updatePending ? '保存中...' : '設定を保存'}
        </button>
      </div>
    </div>
  );
}

