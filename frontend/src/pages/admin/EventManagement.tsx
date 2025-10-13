import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Breadcrumb } from '../../components/admin/Breadcrumb';
import { PageHeader } from '../../components/admin/PageHeader';
import EventEditor from '../../components/EventEditor';
import { getImageDisplayUrl } from '../../utils/walrus';
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

export default function EventManagement() {
  const [events, setEvents] = useState<AdminMintEvent[]>([]);
  const [mintCollections, setMintCollections] = useState<any[]>([]);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [editingEventData, setEditingEventData] = useState<AdminMintEvent | null>(null);
  const [eventSortBy, setEventSortBy] = useState<'name' | 'collection' | 'date' | 'mints'>('date');
  const [eventSortOrder, setEventSortOrder] = useState<'asc' | 'desc'>('desc');
  const [message, setMessage] = useState('');

  // コレクション作成UI用ステート
  const [createColName, setCreateColName] = useState<string>('');
  const [createColSymbol, setCreateColSymbol] = useState<string>('');
  const [creatingCollection, setCreatingCollection] = useState<boolean>(false);
  const [createColMessage, setCreateColMessage] = useState<string>('');

  // カウントダウン用
  const [nowTs, setNowTs] = useState<number>(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fetchEvents();
    fetchMintCollections();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/events`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) setEvents(data.data || []);
    } catch (e) {
      console.error('Failed to fetch events', e);
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

  // コレクション作成関数
  const getDefaultTypePath = () => {
    const defaultMoveTarget = import.meta.env.VITE_DEFAULT_MOVE_TARGET || '0x3d7e20efbd6e4e2ee6369bcf1e9ec8029637c47890d975e74956b4b405cb5f3f::sxt_nft::mint_to';
    return defaultMoveTarget.replace('::mint_to', '::EventNFT');
  };

  const handleCreateCollectionViaMove = async () => {
    try {
      if (creatingCollection) return;
      setCreatingCollection(true);
      setCreateColMessage('コレクション作成中...');

      const defaultMoveTarget = import.meta.env.VITE_DEFAULT_MOVE_TARGET || '0x3d7e20efbd6e4e2ee6369bcf1e9ec8029637c47890d975e74956b4b405cb5f3f::sxt_nft::mint_to';
      const packageId = defaultMoveTarget.split('::')[0];
      const autoTypePath = getDefaultTypePath();
      
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
    }
  };

  const handleSaveEvent = async (eventData: any) => {
    try {
      setMessage('イベントを保存中...');
      
      // moveCall の自動設定
      if (!eventData.moveCall || !eventData.moveCall.target) {
        try {
          const mt = await fetch(`${API_BASE_URL}/api/move-targets`).then(r => r.json()).catch(() => null);
          const target = mt?.data?.defaultMoveTarget || '';
          if (target) {
            eventData.moveCall = {
              target,
              typeArguments: [],
              argumentsTemplate: ['{recipient}', '{name}', '{imageCid}', '{imageMimeType}', '{eventDate}'],
              gasBudget: 50_000_000
            };
          }
        } catch (moveError) {
          console.warn('Move target setup failed:', moveError);
        }
      }
      
      const url = eventData.id 
        ? `${API_BASE_URL}/api/admin/events/${eventData.id}`
        : `${API_BASE_URL}/api/admin/events`;
      
      const method = eventData.id ? 'PUT' : 'POST';
      const payload = { ...eventData, active: eventData.status === 'published' };
      
      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setMessage(eventData.status === 'draft' ? 'ドラフトを保存しました' : 'イベントを公開しました');
        setIsCreatingEvent(false);
        setEditingEventData(null);
        fetchEvents();
      } else {
        throw new Error(result.error || '保存に失敗しました');
      }
    } catch (e: any) {
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

  // EventEditor表示時
  if (isCreatingEvent || editingEventData) {
    return (
      <AdminLayout currentPath="/admin/mint/events">
        <Breadcrumb items={[
          { label: 'Dashboard', href: '/admin' },
          { label: 'ミント管理', href: '/admin/mint/events' },
          { label: editingEventData ? 'イベント編集' : '新規イベント作成' }
        ]} />
        <EventEditor
          event={editingEventData || undefined}
          onSave={handleSaveEvent}
          onCancel={() => {
            setIsCreatingEvent(false);
            setEditingEventData(null);
          }}
        />
      </AdminLayout>
    );
  }

  // ソート処理
  const sortedEvents = [...events].sort((a, b) => {
    let compareValue = 0;
    
    if (eventSortBy === 'name') {
      compareValue = a.name.localeCompare(b.name);
    } else if (eventSortBy === 'collection') {
      const collA = mintCollections.find(col => a.collectionId === col.id)?.name || '';
      const collB = mintCollections.find(col => b.collectionId === col.id)?.name || '';
      compareValue = collA.localeCompare(collB);
    } else if (eventSortBy === 'date') {
      compareValue = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
    } else if (eventSortBy === 'mints') {
      compareValue = (a.mintedCount || 0) - (b.mintedCount || 0);
    }
    
    return eventSortOrder === 'asc' ? compareValue : -compareValue;
  });

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
              padding: '0.75rem 1.5rem', 
              background: '#10b981', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              boxShadow: '0 1px 3px rgba(16, 185, 129, 0.4)',
              transition: 'all 0.2s'
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
        borderRadius: '12px',
        padding: '1.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        marginBottom: '1.5rem',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
            ミント用コレクション作成
          </h3>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            イベントで使用するNFTコレクションを作成します
          </p>
        </div>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
              コレクション名
            </label>
            <input
              type="text"
              value={createColName}
              onChange={(e) => setCreateColName(e.target.value)}
              placeholder="例: Event Collection"
              style={{
                width: '100%',
                padding: '0.625rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
              シンボル
            </label>
            <input
              type="text"
              value={createColSymbol}
              onChange={(e) => setCreateColSymbol(e.target.value)}
              placeholder="例: EVENT"
              style={{
                width: '100%',
                padding: '0.625rem',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '0.875rem',
                outline: 'none'
              }}
            />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={handleCreateCollectionViaMove}
            disabled={creatingCollection || !createColName}
            style={{
              padding: '0.625rem 1.5rem',
              background: creatingCollection || !createColName ? '#d1d5db' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: creatingCollection || !createColName ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            {creatingCollection ? '作成中...' : 'コレクション作成'}
          </button>
          {createColMessage && (
            <div style={{ fontSize: '0.875rem', color: '#374151' }}>
              {createColMessage}
            </div>
          )}
        </div>
        {mintCollections.length > 0 && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>
              登録済みコレクション ({mintCollections.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {mintCollections.map((col) => (
                <div 
                  key={col.id} 
                  style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '0.5rem',
                    background: 'white',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}
                >
                  <div style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                    {col.name}
                  </div>
                  <button
                    onClick={() => handleDeleteCollection(col.id, col.name)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      transition: 'all 0.2s'
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
        borderRadius: '12px',
        padding: '2rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '1.5rem'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
              イベント一覧
            </h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
              {events.length}件のイベント
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: 500 }}>並び順:</label>
              <select
                value={eventSortBy}
                onChange={(e) => setEventSortBy(e.target.value as any)}
                style={{ 
                  padding: '0.5rem 0.75rem', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '8px', 
                  fontSize: '0.875rem',
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
                  padding: '0.5rem 0.75rem', 
                  background: 'white', 
                  border: '1px solid #d1d5db', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#374151',
                  transition: 'all 0.2s'
                }}
                title={eventSortOrder === 'asc' ? '昇順' : '降順'}
              >
                {eventSortOrder === 'asc' ? '昇順 ↑' : '降順 ↓'}
              </button>
            </div>
            <button
              onClick={fetchEvents}
              style={{ 
                padding: '0.5rem 1rem', 
                background: '#3b82f6', 
                color: 'white', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                fontSize: '0.875rem',
                fontWeight: 600,
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s'
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
            padding: '4rem 2rem',
            textAlign: 'center',
            background: '#f9fafb',
            borderRadius: '8px',
            border: '2px dashed #e5e7eb'
          }}>
            <div style={{ 
              width: '80px',
              height: '80px',
              background: '#e5e7eb',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              fontSize: '2rem',
              color: '#9ca3af'
            }}>
              +
            </div>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
              イベントがありません
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af', marginBottom: '1.5rem' }}>
              新しいイベントを作成してミントページを公開しましょう
            </p>
            <button
              onClick={() => setIsCreatingEvent(true)}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
            >
              イベントを作成
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {sortedEvents.map(ev => {
              const eventCollection = mintCollections.find(col => {
                const typePath = (col as any).typePath || col.packageId;
                return ev.collectionId === typePath;
              });
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
                  padding: '1.25rem', 
                  borderRadius: '12px', 
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
                  <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                    {ev.imageUrl && (
                      <div style={{
                        width: 80,
                        height: 80,
                        borderRadius: 8,
                        overflow: 'hidden',
                        flexShrink: 0,
                        border: '1px solid #e5e7eb'
                      }}>
                        <img 
                          src={getImageDisplayUrl((ev as any).imageCid, ev.imageUrl)} 
                          alt={ev.name} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      </div>
                    )}
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontWeight: 600, fontSize: '1.125rem', color: '#111827' }}>
                          {ev.name}
                        </h3>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          padding: '0.25rem 0.75rem', 
                          background: isActive ? '#d1fae5' : isEnded ? '#f3f4f6' : '#dbeafe', 
                          color: isActive ? '#047857' : isEnded ? '#6b7280' : '#1e40af',
                          borderRadius: '6px',
                          fontWeight: 600,
                          letterSpacing: '0.025em',
                          textTransform: 'uppercase'
                        }}>
                          {isActive ? 'Active' : isEnded ? 'Ended' : 'Upcoming'}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{ 
                          fontSize: '0.8125rem', 
                          color: '#6b7280', 
                          display: 'inline-block', 
                          padding: '0.25rem 0.75rem', 
                          background: '#f9fafb', 
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb'
                        }}>
                          Collection: {collectionName}
                        </div>
                        <div style={{ 
                          fontSize: '0.8125rem', 
                          color: '#4b5563', 
                          display: 'inline-block', 
                          padding: '0.25rem 0.75rem', 
                          background: '#fef3c7', 
                          borderRadius: '6px',
                          border: '1px solid #fcd34d',
                          fontFamily: 'monospace'
                        }}>
                          ID: {ev.id}
                        </div>
                        {(() => {
                          // 画像が存在するかチェック
                          const hasImage = !!(ev.imageUrl || ev.imageCid || (ev as any).imageCid);
                          if (!hasImage) return null;
                          
                          // 保存期限を取得または推定
                          let expiryDate: Date | null = null;
                          let epochs = ev.imageStorageEpochs || 26; // デフォルト26 epochs
                          let isEstimated = false;
                          
                          if (ev.imageStorageExpiry) {
                            expiryDate = new Date(ev.imageStorageExpiry);
                          } else if (ev.createdAt) {
                            // 既存イベント：作成日から推定（26 epochs = 364日後）
                            expiryDate = new Date(ev.createdAt);
                            expiryDate.setDate(expiryDate.getDate() + (epochs * 14));
                            isEstimated = true;
                          }
                          
                          if (!expiryDate) return null;
                          
                          const now = new Date();
                          const daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                          const isExpiringSoon = daysUntilExpiry < 30; // 30日以内
                          const hasExpired = daysUntilExpiry < 0;
                          
                          return (
                            <div style={{ 
                              fontSize: '0.8125rem', 
                              color: hasExpired ? '#dc2626' : isExpiringSoon ? '#f59e0b' : '#7c3aed', 
                              display: 'inline-block', 
                              padding: '0.25rem 0.75rem', 
                              background: hasExpired ? '#fee2e2' : isExpiringSoon ? '#fef3c7' : '#faf5ff', 
                              borderRadius: '6px',
                              border: `1px solid ${hasExpired ? '#fca5a5' : isExpiringSoon ? '#fcd34d' : '#c4b5fd'}`,
                              fontWeight: 500
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
                          fontSize: '0.875rem', 
                          color: '#6b7280', 
                          marginBottom: '0.75rem', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis', 
                          whiteSpace: 'nowrap',
                          margin: '0 0 0.75rem 0'
                        }}>
                          {ev.description}
                        </p>
                      )}
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', fontSize: '0.8125rem', color: '#4b5563' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.125rem' }}>期間</span>
                          <span style={{ fontWeight: 500 }}>
                            {new Date(ev.startAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 
                            {' ~ '}
                            {new Date(ev.endAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.125rem' }}>ミント進捗</span>
                          <span style={{ fontWeight: 600, color: '#111827' }}>
                            {typeof ev.mintedCount === 'number' ? ev.mintedCount.toLocaleString() : 0}
                            <span style={{ fontWeight: 400, color: '#6b7280' }}>
                              {typeof ev.totalCap === 'number' ? ` / ${ev.totalCap.toLocaleString()}` : ' / 無制限'}
                            </span>
                          </span>
                        </div>
                        {(isActive || isUpcoming) && (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.125rem' }}>
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
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
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
                          padding: '0.5rem 1rem', 
                          background: '#10b981', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '6px', 
                          cursor: 'pointer', 
                          fontSize: '0.8125rem', 
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
                      >
                        URL コピー
                      </button>
                      <button 
                        onClick={() => setEditingEventData(ev)} 
                        style={{ 
                          padding: '0.5rem 1rem', 
                          background: '#3b82f6', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '6px', 
                          cursor: 'pointer', 
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          transition: 'all 0.2s'
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

