import { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Breadcrumb } from '../../components/admin/Breadcrumb';
import { PageHeader } from '../../components/admin/PageHeader';
import EventEditor from '../../components/EventEditor';
import { getImageDisplayUrl } from '../../utils/walrus';
import { useResponsive, getResponsiveValue } from '../../hooks/useResponsive';
import { useWalletWithErrorHandling } from '../../hooks/useWallet';
import type { AdminMintEvent } from '../../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

export default function EventManagement() {
  const [events, setEvents] = useState<AdminMintEvent[]>([]);
  const [mintCollections, setMintCollections] = useState<any[]>([]);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [editingEventData, setEditingEventData] = useState<AdminMintEvent | null>(null);
  const [eventSortBy, setEventSortBy] = useState<'name' | 'collection' | 'date' | 'mints'>('date');
  const [eventSortOrder, setEventSortOrder] = useState<'asc' | 'desc'>('desc');
  const [message, setMessage] = useState('');
  
  // ウォレット接続状態を取得（フックのルールに従って）
  let walletState;
  try {
    walletState = useWalletWithErrorHandling();
  } catch (error) {
    walletState = null;
  }
  
  // レスポンシブ対応
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  try {
    const responsive = useResponsive();
    deviceType = responsive.deviceType;
  } catch (error) {
  }
  
  // ウォレット接続状態をメモ化（無限ループを防ぐため）
  const isWalletConnected = useMemo(() => walletState?.connected || false, [walletState?.connected]);
  
  // 認証ヘッダーを生成する関数
  const getAuthHeaders = useCallback((): HeadersInit => {
    const addr = typeof window !== 'undefined' 
      ? localStorage.getItem('currentWalletAddress') || (window as any).currentWalletAddress 
      : undefined;
    
    return {
      'Content-Type': 'application/json',
      ...(addr ? { 'X-Admin-Address': addr } : {}),
      ...(isWalletConnected ? { 'X-Wallet-Connected': 'true' } : {})
    };
  }, [isWalletConnected]);

  // コレクション作成UI用ステート
  const [createColName, setCreateColName] = useState<string>('');
  const [createColSymbol, setCreateColSymbol] = useState<string>('');
  const [creatingCollection, setCreatingCollection] = useState<boolean>(false);
  const [createColMessage, setCreateColMessage] = useState<string>('');

  const resolveEventCollection = useCallback((event: Pick<AdminMintEvent, 'collectionId'> & { selectedCollectionId?: string }) => {
    if (event?.selectedCollectionId) {
      const byId = mintCollections.find(col => col.id === event.selectedCollectionId);
      if (byId) return byId;
    }
    const eventCollectionId = String(event?.collectionId || '').trim();
    if (!eventCollectionId) return undefined;
    return mintCollections.find(col => {
      const typePath = String(((col as any).typePath || col.packageId || '')).trim();
      return typePath === eventCollectionId || String(col.id || '').trim() === eventCollectionId;
    });
  }, [mintCollections]);

  // カウントダウン用（最適化）
  const [nowTs, setNowTs] = useState<number>(Date.now());
  useEffect(() => {
    // アクティブなイベントがある場合のみカウントダウンを実行
    const hasActiveEvents = events.some(event => {
      const start = Date.parse(event.startAt);
      const end = Date.parse(event.endAt);
      const currentTime = Date.now();
      return currentTime >= start && currentTime <= end;
    });
    
    if (!hasActiveEvents) {
      // アクティブなイベントがない場合は現在時刻を更新して終了
      setNowTs(Date.now());
      return;
    }
    
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [events]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/events`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setEvents(data.data || []);
      } else {
        console.error('Failed to fetch events:', data.error);
        setMessage(`エラー: ${data.error || 'イベントの取得に失敗しました'}`);
      }
    } catch (e: any) {
      console.error('Error fetching events:', e);
      setMessage(`エラー: ${e.message || 'イベントの取得に失敗しました'}`);
    }
  }, [getAuthHeaders]);

  const fetchMintCollections = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/mint-collections`);
      const data = await res.json();
      if (data.success) setMintCollections(data.data || []);
    } catch (e) {
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchMintCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // コレクション作成関数
  const handleCreateCollectionViaMove = async () => {
    try {
      if (creatingCollection) return;
      setCreatingCollection(true);
      setCreateColMessage('コレクション作成中...');

      // バックエンドからmove-targetsを取得（環境変数から取得）
      const mtResponse = await fetch(`${API_BASE_URL}/api/move-targets`);
      const mtData = await mtResponse.json();
      const defaultMoveTarget = mtData?.data?.defaultMoveTarget;
      
      if (!defaultMoveTarget) {
        setCreateColMessage('エラー: DEFAULT_MOVE_TARGETが設定されていません。環境変数を確認してください。');
        return;
      }

      const packageId = defaultMoveTarget.split('::')[0];
      const autoTypePath = defaultMoveTarget.replace('::mint_to', '::EventNFT');
      
      const body: any = {
        name: createColName || 'Event Collection',
        packageId: packageId,
        typePath: autoTypePath,
        description: `Symbol: ${createColSymbol || 'EVENT'}`
      };

      const res = await fetch(`${API_BASE_URL}/api/mint-collections`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!data?.success) {
        setCreateColMessage(data?.error || 'コレクション作成に失敗しました');
      } else {
        setCreateColMessage('コレクションを作成しました');
        await fetchMintCollections();
        setCreateColName('');
        setCreateColSymbol('');
      }
    } catch (e: any) {
      setCreateColMessage(e?.message || 'エラーが発生しました');
    } finally {
      setCreatingCollection(false);
    }
  };

  const handleDeleteCollection = async (collectionId: string, collectionName: string) => {
    if (!confirm(`「${collectionName}」を削除してもよろしいですか？\n\nこの操作は取り消せません。`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/mint-collections/${collectionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`「${collectionName}」を削除しました`);
        await fetchMintCollections();
      } else {
        setMessage(`削除に失敗しました: ${data.error || '不明なエラー'}`);
      }
    } catch (e: any) {
      setMessage(`削除に失敗しました: ${e?.message || 'エラーが発生しました'}`);
    } finally {
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const toISOUTC = useCallback((s: string | undefined): string | undefined => {
    if (!s || typeof s !== 'string') return s;
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toISOString();
  }, []);

  const handleSaveEvent = async (eventData: any) => {
    try {
      setMessage('イベントを保存中...');
      
      // startAt/endAt/eventDate を UTC ISO に変換（datetime-local はローカル時刻のため）
      const payload = { ...eventData, active: eventData.status === 'published' };
      if (payload.startAt) payload.startAt = toISOUTC(payload.startAt) ?? payload.startAt;
      if (payload.endAt) payload.endAt = toISOUTC(payload.endAt) ?? payload.endAt;
      if (payload.eventDate) payload.eventDate = toISOUTC(payload.eventDate) ?? payload.eventDate;
      
      // moveCall の自動設定
      if (!payload.moveCall || !payload.moveCall.target) {
        try {
          const mt = await fetch(`${API_BASE_URL}/api/move-targets`).then(r => r.json()).catch(() => null);
          const target = mt?.data?.defaultMoveTarget || '';
          if (target) {
            payload.moveCall = {
              target,
              typeArguments: [],
              argumentsTemplate: ['{recipient}', '{name}', '{description}', '{imageCid}', '{imageMimeType}', '{eventDate}'],
              gasBudget: 50_000_000
            };
          }
        } catch (moveError) {
          console.warn('Move target setup failed:', moveError);
        }
      }
      
      const url = payload.id 
        ? `${API_BASE_URL}/api/admin/events/${payload.id}`
        : `${API_BASE_URL}/api/admin/events`;
      
      const method = payload.id ? 'PUT' : 'POST';
      const headers = getAuthHeaders();
      
      console.log('🔍 Saving event:', { url, method, payload, headers });
      
      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(payload)
      });
      
      console.log('🔍 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` };
        }
        console.error('❌ Failed to save event - HTTP error:', response.status, errorData);
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('🔍 Response data:', result);
      
      if (result.success) {
        console.log('✅ Event saved successfully:', result.data);
        setMessage(payload.status === 'draft' ? 'ドラフトを保存しました' : 'イベントを公開しました');
        setIsCreatingEvent(false);
        setEditingEventData(null);
        // 保存後にイベントリストを再取得
        await fetchEvents();
      } else {
        console.error('❌ Failed to save event:', result);
        throw new Error(result.error || result.details || '保存に失敗しました');
      }
    } catch (e: any) {
      console.error('❌ Error saving event:', e);
      setMessage(`エラー: ${e.message}`);
      throw e;
    } finally {
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('このイベントを削除しますか？')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/events/${eventId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setMessage('イベントを削除しました');
        fetchEvents();
      } else {
        setMessage(data.error || '削除に失敗しました');
      }
    } catch {
      setMessage('削除に失敗しました');
    } finally {
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // ソート処理（メモ化） - Hooksは早期リターンの前に呼び出す必要がある
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      let compareValue = 0;
      
      if (eventSortBy === 'name') {
        compareValue = a.name.localeCompare(b.name);
      } else if (eventSortBy === 'collection') {
        const collA = resolveEventCollection(a)?.name || '';
        const collB = resolveEventCollection(b)?.name || '';
        compareValue = collA.localeCompare(collB);
      } else if (eventSortBy === 'date') {
        compareValue = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      } else if (eventSortBy === 'mints') {
        compareValue = (a.mintedCount || 0) - (b.mintedCount || 0);
      }
      
      return eventSortOrder === 'asc' ? compareValue : -compareValue;
    });
  }, [events, eventSortBy, eventSortOrder, resolveEventCollection]);

  // EventEditor表示時
  if (isCreatingEvent || editingEventData) {
    return (
      <AdminLayout currentPath="/admin/mint/events">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/admin' },
          { label: 'ミント管理', href: '/admin/mint/events' },
          { label: editingEventData ? 'イベント編集' : '新規イベント作成' }
        ]} />
        <PageHeader
          title={editingEventData ? 'イベント編集' : '新規イベント作成'}
          description="イベント情報を入力してミントページを作成します"
          action={
            <button
              onClick={() => {
                setIsCreatingEvent(false);
                setEditingEventData(null);
              }}
              style={{
                padding: getResponsiveValue('0.5rem 1rem', '0.5625rem 1.25rem', '0.625rem 1.5rem', deviceType),
                borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType),
                border: '1px solid #d1d5db',
                background: 'white',
                color: '#6b7280',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType)
              }}
            >
              キャンセル
            </button>
          }
        />
        <EventEditor
          event={editingEventData || undefined}
          collections={mintCollections}
          onSave={handleSaveEvent}
          onCancel={() => {
            setIsCreatingEvent(false);
            setEditingEventData(null);
          }}
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentPath="/admin/mint/events">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/admin' },
        { label: 'ミント管理' },
        { label: 'イベント管理' }
      ]} />

      <PageHeader 
        title="イベント管理"
        description="NFTミントイベントの作成・編集・管理"
        action={
          <button
            onClick={() => setIsCreatingEvent(true)}
            style={{ 
              padding: getResponsiveValue('0.625rem 1rem', '0.6875rem 1.25rem', '0.75rem 1.5rem', deviceType), 
              background: '#10b981', 
              color: 'white', 
              border: 'none', 
              borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType), 
              cursor: 'pointer',
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
              fontWeight: 600,
              boxShadow: '0 1px 3px rgba(16, 185, 129, 0.4)',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
          >
            新規イベント作成
          </button>
        }
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

      {/* コレクション作成 */}
      <div style={{
        background: 'white',
        borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
        padding: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        marginBottom: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ marginBottom: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType) }}>
          <h3 style={{ 
            margin: 0, 
            fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType), 
            fontWeight: 700, 
            color: '#111827' 
          }}>
            ミント用コレクション作成
          </h3>
          <p style={{ 
            margin: '0.25rem 0 0 0', 
            fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType), 
            color: '#6b7280' 
          }}>
            イベントで使用するNFTコレクションを作成します
          </p>
        </div>
        <div style={{ 
          display: 'grid', 
          gap: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType), 
          gridTemplateColumns: getResponsiveValue(
            'repeat(1, 1fr)', 
            'repeat(2, 1fr)', 
            'repeat(auto-fit, minmax(200px, 1fr))', 
            deviceType
          ), 
          marginBottom: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType) 
        }}>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType), 
              fontWeight: 600, 
              color: '#374151', 
              marginBottom: '0.5rem' 
            }}>
              コレクション名
            </label>
            <input
              type="text"
              value={createColName}
              onChange={(e) => setCreateColName(e.target.value)}
              placeholder="例: Event Collection"
              style={{
                width: '100%',
                padding: getResponsiveValue('0.5rem', '0.5625rem', '0.625rem', deviceType),
                border: '1px solid #d1d5db',
                borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType),
                fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
                outline: 'none'
              }}
            />
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType), 
              fontWeight: 600, 
              color: '#374151', 
              marginBottom: '0.5rem' 
            }}>
              シンボル
            </label>
            <input
              type="text"
              value={createColSymbol}
              onChange={(e) => setCreateColSymbol(e.target.value)}
              placeholder="例: EVENT"
              style={{
                width: '100%',
                padding: getResponsiveValue('0.5rem', '0.5625rem', '0.625rem', deviceType),
                border: '1px solid #d1d5db',
                borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType),
                fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
                outline: 'none'
              }}
            />
          </div>
        </div>
        <div style={{ 
          display: 'flex', 
          flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
          alignItems: getResponsiveValue('stretch', 'center', 'center', deviceType), 
          gap: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType) 
        }}>
          <button
            onClick={handleCreateCollectionViaMove}
            disabled={creatingCollection || !createColName}
            style={{
              padding: getResponsiveValue('0.5rem 1rem', '0.5625rem 1.25rem', '0.625rem 1.5rem', deviceType),
              background: creatingCollection || !createColName ? '#d1d5db' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType),
              cursor: creatingCollection || !createColName ? 'not-allowed' : 'pointer',
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
              fontWeight: 600,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            {creatingCollection ? '作成中...' : 'コレクション作成'}
          </button>
          {createColMessage && (
            <div style={{ 
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType), 
              color: '#374151' 
            }}>
              {createColMessage}
            </div>
          )}
        </div>
        {mintCollections.length > 0 && (
          <div style={{ 
            marginTop: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType), 
            padding: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType), 
            background: '#f9fafb', 
            borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType), 
            border: '1px solid #e5e7eb' 
          }}>
            <div style={{ 
              fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.75rem', deviceType), 
              fontWeight: 600, 
              color: '#6b7280', 
              marginBottom: '0.5rem' 
            }}>
              登録済みコレクション ({mintCollections.length})
            </div>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: getResponsiveValue('0.375rem', '0.4375rem', '0.5rem', deviceType) 
            }}>
              {mintCollections.map((col) => (
                <div 
                  key={col.id} 
                  style={{ 
                    display: 'flex', 
                    flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
                    justifyContent: 'space-between', 
                    alignItems: getResponsiveValue('flex-start', 'center', 'center', deviceType),
                    gap: getResponsiveValue('0.5rem', '0.25rem', '0', deviceType),
                    padding: getResponsiveValue('0.375rem', '0.4375rem', '0.5rem', deviceType),
                    background: 'white',
                    borderRadius: getResponsiveValue('4px', '5px', '6px', deviceType),
                    border: '1px solid #e5e7eb'
                  }}
                >
                  <div style={{ 
                    fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType), 
                    color: '#374151', 
                    fontWeight: 500,
                    wordBreak: 'break-all',
                    flex: 1
                  }}>
                    {col.name}
                  </div>
                  <button
                    onClick={() => handleDeleteCollection(col.id, col.name)}
                    style={{
                      padding: getResponsiveValue('0.1875rem 0.5rem', '0.21875rem 0.625rem', '0.25rem 0.75rem', deviceType),
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: getResponsiveValue('3px', '4px', '4px', deviceType),
                      cursor: 'pointer',
                      fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.75rem', deviceType),
                      fontWeight: 600,
                      transition: 'all 0.2s',
                      whiteSpace: 'nowrap',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#dc2626'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#ef4444'}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* イベント一覧 */}
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
          gap: getResponsiveValue('1rem', '0.75rem', '0', deviceType),
          marginBottom: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType)
        }}>
          <div>
            <h2 style={{ 
              margin: 0, 
              fontSize: getResponsiveValue('1rem', '1.0625rem', '1.125rem', deviceType), 
              fontWeight: 700, 
              color: '#111827' 
            }}>
              イベント一覧
            </h2>
            <p style={{ 
              margin: '0.25rem 0 0 0', 
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType), 
              color: '#6b7280' 
            }}>
              {events.length}件のイベント
            </p>
          </div>
          <div style={{ 
            display: 'flex', 
            flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
            gap: getResponsiveValue('0.5rem', '0.75rem', '0.75rem', deviceType), 
            alignItems: getResponsiveValue('stretch', 'center', 'center', deviceType),
            width: getResponsiveValue('100%', 'auto', 'auto', deviceType)
          }}>
            <div style={{ 
              display: 'flex', 
              flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
              alignItems: getResponsiveValue('stretch', 'center', 'center', deviceType), 
              gap: getResponsiveValue('0.5rem', '0.5rem', '0.5rem', deviceType),
              width: getResponsiveValue('100%', 'auto', 'auto', deviceType)
            }}>
              <label style={{ 
                fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType), 
                color: '#6b7280', 
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}>並び順:</label>
              <div style={{
                display: 'flex',
                gap: getResponsiveValue('0.5rem', '0.5rem', '0.5rem', deviceType),
                width: getResponsiveValue('100%', 'auto', 'auto', deviceType)
              }}>
                <select
                  value={eventSortBy}
                  onChange={(e) => setEventSortBy(e.target.value as any)}
                  style={{ 
                    flex: 1,
                    padding: getResponsiveValue('0.375rem 0.5rem', '0.4375rem 0.625rem', '0.5rem 0.75rem', deviceType), 
                    border: '1px solid #d1d5db', 
                    borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType), 
                    fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
                    background: 'white',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  <option value="date">開催日時</option>
                  <option value="name">イベント名</option>
                  <option value="collection">コレクション</option>
                  <option value="mints">ミント数</option>
                </select>
                <button
                  onClick={() => setEventSortOrder(eventSortOrder === 'asc' ? 'desc' : 'asc')}
                  style={{ 
                    padding: getResponsiveValue('0.375rem 0.5rem', '0.4375rem 0.625rem', '0.5rem 0.75rem', deviceType), 
                    background: 'white', 
                    border: '1px solid #d1d5db', 
                    borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType), 
                    cursor: 'pointer', 
                    fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
                    fontWeight: 600,
                    color: '#374151',
                    transition: 'all 0.2s',
                    whiteSpace: 'nowrap'
                  }}
                  title={eventSortOrder === 'asc' ? '昇順' : '降順'}
                >
                  {eventSortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>
            <button
              onClick={fetchEvents}
              style={{ 
                padding: getResponsiveValue('0.375rem 0.75rem', '0.4375rem 0.875rem', '0.5rem 1rem', deviceType), 
                background: '#3b82f6', 
                color: 'white', 
                border: 'none', 
                borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType), 
                cursor: 'pointer', 
                fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
                fontWeight: 600,
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
            >
              更新
            </button>
          </div>
        </div>

        {sortedEvents.length === 0 ? (
          <div style={{
            padding: getResponsiveValue('2rem 1rem', '3rem 1.5rem', '4rem 2rem', deviceType),
            textAlign: 'center',
            background: '#f9fafb',
            borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType),
            border: '2px dashed #e5e7eb'
          }}>
            <div style={{ 
              width: getResponsiveValue('60px', '70px', '80px', deviceType),
              height: getResponsiveValue('60px', '70px', '80px', deviceType),
              background: '#e5e7eb',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              fontSize: getResponsiveValue('1.5rem', '1.75rem', '2rem', deviceType),
              color: '#9ca3af'
            }}>
              +
            </div>
            <h3 style={{ 
              margin: 0, 
              fontSize: getResponsiveValue('1rem', '1.0625rem', '1.125rem', deviceType), 
              fontWeight: 600, 
              color: '#374151', 
              marginBottom: '0.5rem' 
            }}>
              イベントがありません
            </h3>
            <p style={{ 
              margin: 0, 
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType), 
              color: '#9ca3af', 
              marginBottom: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType) 
            }}>
              新しいイベントを作成してミントページを公開しましょう
            </p>
            <button
              onClick={() => setIsCreatingEvent(true)}
              style={{
                padding: getResponsiveValue('0.5rem 1rem', '0.625rem 1.25rem', '0.75rem 1.5rem', deviceType),
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType),
                cursor: 'pointer',
                fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              イベントを作成
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType) }}>
            {sortedEvents.map(ev => {
              const eventCollection = resolveEventCollection(ev as any);
              const collectionName = eventCollection?.name || 'コレクション未設定';
              
              const start = Date.parse(ev.startAt);
              const end = Date.parse(ev.endAt);
              const isUpcoming = nowTs < start;
              const isActive = nowTs >= start && nowTs <= end;
              const isEnded = nowTs > end;
              
              return (
                <div key={ev.id} style={{ 
                  border: '1px solid #e5e7eb', 
                  borderLeft: `3px solid ${isActive ? '#10b981' : isEnded ? '#9ca3af' : '#3b82f6'}`,
                  padding: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType), 
                  borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType), 
                  background: 'white',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                >
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
                    gap: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType), 
                    alignItems: getResponsiveValue('flex-start', 'flex-start', 'flex-start', deviceType) 
                  }}>
                    {ev.imageUrl && (
                      <div style={{
                        width: getResponsiveValue('60px', '70px', '80px', deviceType),
                        height: getResponsiveValue('60px', '70px', '80px', deviceType),
                        borderRadius: getResponsiveValue('6px', '7px', '8px', deviceType),
                        overflow: 'hidden',
                        flexShrink: 0,
                        border: '1px solid #e5e7eb',
                        alignSelf: getResponsiveValue('center', 'flex-start', 'flex-start', deviceType)
                      }}>
                        <img 
                          src={getImageDisplayUrl((ev as any).imageCid, ev.imageUrl)} 
                          alt={ev.name} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      </div>
                    )}
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
                        alignItems: getResponsiveValue('flex-start', 'center', 'center', deviceType), 
                        gap: getResponsiveValue('0.5rem', '0.75rem', '0.75rem', deviceType), 
                        marginBottom: getResponsiveValue('0.5rem', '0.5rem', '0.5rem', deviceType) 
                      }}>
                        <h3 style={{ 
                          margin: 0, 
                          fontWeight: 600, 
                          fontSize: getResponsiveValue('0.875rem', '1rem', '1.125rem', deviceType), 
                          color: '#111827',
                          wordBreak: 'break-word'
                        }}>
                          {ev.name}
                        </h3>
                        <span style={{ 
                          fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.75rem', deviceType), 
                          padding: getResponsiveValue('0.1875rem 0.5rem', '0.21875rem 0.625rem', '0.25rem 0.75rem', deviceType), 
                          background: isActive ? '#d1fae5' : isEnded ? '#f3f4f6' : '#dbeafe', 
                          color: isActive ? '#047857' : isEnded ? '#6b7280' : '#1e40af',
                          borderRadius: getResponsiveValue('4px', '5px', '6px', deviceType),
                          fontWeight: 600,
                          letterSpacing: '0.025em',
                          textTransform: 'uppercase',
                          whiteSpace: 'nowrap',
                          flexShrink: 0
                        }}>
                          {isActive ? 'Active' : isEnded ? 'Ended' : 'Upcoming'}
                        </span>
                      </div>
                      
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
                        gap: getResponsiveValue('0.375rem', '0.5rem', '0.5rem', deviceType), 
                        marginBottom: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType), 
                        flexWrap: 'wrap' 
                      }}>
                        <div style={{ 
                          fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType), 
                          color: '#6b7280', 
                          display: 'inline-block', 
                          padding: getResponsiveValue('0.1875rem 0.5rem', '0.21875rem 0.625rem', '0.25rem 0.75rem', deviceType), 
                          background: '#f9fafb', 
                          borderRadius: getResponsiveValue('4px', '5px', '6px', deviceType),
                          border: '1px solid #e5e7eb',
                          wordBreak: 'break-word'
                        }}>
                          Collection: {collectionName}
                        </div>
                        <div style={{ 
                          fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType), 
                          color: '#4b5563', 
                          display: 'inline-block', 
                          padding: getResponsiveValue('0.1875rem 0.5rem', '0.21875rem 0.625rem', '0.25rem 0.75rem', deviceType), 
                          background: '#fef3c7', 
                          borderRadius: getResponsiveValue('4px', '5px', '6px', deviceType),
                          border: '1px solid #fcd34d',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all'
                        }}>
                          ID: {ev.id}
                        </div>
                        {(() => {
                          // 画像が存在するかチェック（画像が無い場合は保存期限を表示しない）
                          const hasImage = !!(ev.imageUrl || ev.imageCid || (ev as any).imageCid);
                          if (!hasImage) return null;

                          // 画像があるが保存期限の設定がない場合は「未設定」を表示
                          if (!ev.imageStorageExpiry && !ev.imageStorageEpochs) {
                            return (
                              <div style={{
                                fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType),
                                color: '#6b7280',
                                display: 'inline-block',
                                padding: getResponsiveValue('0.1875rem 0.5rem', '0.21875rem 0.625rem', '0.25rem 0.75rem', deviceType),
                                background: '#f3f4f6',
                                borderRadius: getResponsiveValue('4px', '5px', '6px', deviceType),
                                border: '1px solid #e5e7eb',
                                fontWeight: 500
                              }}>
                                📦 画像保存期限: 未設定
                              </div>
                            );
                          }

                          // 保存期限を表示（imageStorageExpiry があればそれを使用、無ければ作成日から推定）
                          let expiryDate: Date | null = null;
                          const epochs = ev.imageStorageEpochs ?? 26;
                          let isEstimated = false;

                          if (ev.imageStorageExpiry) {
                            expiryDate = new Date(ev.imageStorageExpiry);
                          } else if (ev.createdAt) {
                            expiryDate = new Date(ev.createdAt);
                            expiryDate.setDate(expiryDate.getDate() + (epochs * 14));
                            isEstimated = true;
                          }

                          if (!expiryDate) return null;

                          const now = new Date();
                          const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                          const isExpiringSoon = daysUntilExpiry < 30;
                          const hasExpired = daysUntilExpiry < 0;

                          return (
                            <div style={{
                              fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType),
                              color: hasExpired ? '#dc2626' : isExpiringSoon ? '#f59e0b' : '#7c3aed',
                              display: 'inline-block',
                              padding: getResponsiveValue('0.1875rem 0.5rem', '0.21875rem 0.625rem', '0.25rem 0.75rem', deviceType),
                              background: hasExpired ? '#fee2e2' : isExpiringSoon ? '#fef3c7' : '#faf5ff',
                              borderRadius: getResponsiveValue('4px', '5px', '6px', deviceType),
                              border: `1px solid ${hasExpired ? '#fca5a5' : isExpiringSoon ? '#fcd34d' : '#c4b5fd'}`,
                              fontWeight: 500,
                              wordBreak: 'break-word'
                            }}>
                              📦 画像保存期限: {expiryDate.toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })} まで
                              {` (${epochs} epochs${isEstimated ? '・推定' : ''})`}
                              {hasExpired && ' ⚠️ 期限切れ'}
                              {isExpiringSoon && !hasExpired && ` 🔔 残り${daysUntilExpiry}日`}
                            </div>
                          );
                        })()}
                      </div>
                      
                      {ev.description && (
                        <p style={{ 
                          fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType), 
                          color: '#6b7280', 
                          marginBottom: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType), 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          margin: `0 0 ${getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType)} 0`
                        }}>
                          {ev.description}
                        </p>
                      )}
                      
                      <div style={{ 
                        display: 'flex', 
                        flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
                        flexWrap: 'wrap', 
                        gap: getResponsiveValue('0.75rem', '1rem', '1.5rem', deviceType), 
                        fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType), 
                        color: '#4b5563' 
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ 
                            fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.75rem', deviceType), 
                            color: '#9ca3af', 
                            fontWeight: 500, 
                            marginBottom: '0.125rem' 
                          }}>期間</span>
                          <span style={{ fontWeight: 500, wordBreak: 'break-word' }}>
                            {new Date(ev.startAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 
                            {' ~ '}
                            {new Date(ev.endAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ 
                            fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.75rem', deviceType), 
                            color: '#9ca3af', 
                            fontWeight: 500, 
                            marginBottom: '0.125rem' 
                          }}>ミント進捗</span>
                          <span style={{ fontWeight: 600, color: '#111827' }}>
                            {typeof ev.mintedCount === 'number' ? ev.mintedCount.toLocaleString() : 0}
                            <span style={{ fontWeight: 400, color: '#6b7280' }}>
                              {typeof ev.totalCap === 'number' ? ` / ${ev.totalCap.toLocaleString()}` : ' / 無制限'}
                            </span>
                          </span>
                        </div>
                        {(isActive || isUpcoming) && (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ 
                              fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.75rem', deviceType), 
                              color: '#9ca3af', 
                              fontWeight: 500, 
                              marginBottom: '0.125rem' 
                            }}>
                              {isActive ? '終了まで' : '開始まで'}
                            </span>
                            <span style={{ fontWeight: 600, color: isActive ? '#10b981' : '#3b82f6' }}>
                              {(() => {
                                const targetTime = isActive ? end : start;
                                const rem = Math.max(0, targetTime - nowTs);
                                const h = Math.floor(rem / 3600000);
                                const m = Math.floor((rem % 3600000) / 60000);
                                return `${h}時間 ${m}分`;
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: getResponsiveValue('row', 'column', 'column', deviceType),
                      gap: getResponsiveValue('0.5rem', '0.5rem', '0.5rem', deviceType), 
                      flexShrink: 0,
                      marginTop: getResponsiveValue('0.75rem', '0', '0', deviceType)
                    }}>
                      <button
                        onClick={async () => {
                          const url = `${window.location.origin}/mint/${ev.id}`;
                          try { 
                            await navigator.clipboard.writeText(url); 
                            setMessage('ミントURLをコピーしました'); 
                            setTimeout(() => setMessage(''), 3000);
                          } catch { 
                            setMessage(url); 
                          }
                        }}
                        style={{ 
                          padding: getResponsiveValue('0.375rem 0.75rem', '0.4375rem 0.875rem', '0.5rem 1rem', deviceType), 
                          background: '#10b981', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: getResponsiveValue('4px', '5px', '6px', deviceType), 
                          cursor: 'pointer', 
                          fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType), 
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s',
                          flex: getResponsiveValue('1', 'none', 'none', deviceType)
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                      >
                        URL コピー
                      </button>
                      <button 
                        onClick={() => setEditingEventData(ev)} 
                        style={{ 
                          padding: getResponsiveValue('0.375rem 0.75rem', '0.4375rem 0.875rem', '0.5rem 1rem', deviceType), 
                          background: '#3b82f6', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: getResponsiveValue('4px', '5px', '6px', deviceType), 
                          cursor: 'pointer', 
                          fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType),
                          fontWeight: 600,
                          transition: 'all 0.2s',
                          flex: getResponsiveValue('1', 'none', 'none', deviceType)
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
                      >
                        編集
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`${API_BASE_URL}/api/admin/events/${ev.id}/toggle-active`, { 
                              method: 'POST', 
                              headers: getAuthHeaders() 
                            });
                            const data = await res.json();
                            if (data.success) { 
                              setMessage('状態を切り替えました'); 
                              fetchEvents(); 
                            } else { 
                              setMessage(data.error || '切り替えに失敗しました'); 
                            }
                          } catch { 
                            setMessage('切り替えに失敗しました'); 
                          }
                          setTimeout(() => setMessage(''), 3000);
                        }}
                        style={{ 
                          padding: '0.5rem 1rem', 
                          background: ev.active ? '#f59e0b' : '#6b7280', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '6px', 
                          cursor: 'pointer', 
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = ev.active ? '#d97706' : '#4b5563'}
                        onMouseLeave={(e) => e.currentTarget.style.background = ev.active ? '#f59e0b' : '#6b7280'}
                      >
                        {ev.active ? '無効化' : '有効化'}
                      </button>
                      <button 
                        onClick={() => handleDeleteEvent(ev.id)} 
                        style={{ 
                          padding: '0.5rem 1rem', 
                          background: 'white',
                          color: '#ef4444', 
                          border: '1px solid #fecaca', 
                          borderRadius: '6px', 
                          cursor: 'pointer', 
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#ef4444';
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.color = '#ef4444';
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

