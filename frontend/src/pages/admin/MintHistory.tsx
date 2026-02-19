import { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Breadcrumb } from '../../components/admin/Breadcrumb';
import { PageHeader } from '../../components/admin/PageHeader';
import type { AdminMintEvent, NFTCollection } from '../../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

interface HistoryItem {
  txDigest: string;
  eventId?: string;
  recipient?: string;
  objectIds?: string[];
  at?: string;
}

export default function MintHistory() {
  const [mintCollections, setMintCollections] = useState<NFTCollection[]>([]);
  const [events, setEvents] = useState<AdminMintEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [historyCollection, setHistoryCollection] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>(''); // 選択されたイベントID
  const [historySearch, setHistorySearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [historyEventFilter, setHistoryEventFilter] = useState('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historySortBy, setHistorySortBy] = useState<'date' | 'event'>('date');
  const [historySortOrder, setHistorySortOrder] = useState<'asc' | 'desc'>('desc');
  const [historyPage, setHistoryPage] = useState(1);
  const [message, setMessage] = useState('');
  const historyPageSize = 20;
  const resolveEventTypePath = useCallback((event: AdminMintEvent | undefined): string => {
    if (!event) return '';
    if ((event as any).selectedCollectionId) {
      const selectedCollection = mintCollections.find((col: any) => String(col.id || '') === String((event as any).selectedCollectionId));
      const selectedTypePath = String((selectedCollection as any)?.typePath || selectedCollection?.packageId || '').trim();
      if (selectedTypePath) return selectedTypePath;
    }
    return String(event.collectionId || '').trim();
  }, [mintCollections]);

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
      const res = await fetch(`${API_BASE_URL}/api/events`);
      const data = await res.json();
      if (data.success) setEvents(data.data || []);
    } catch (e) {
    }
  }, []);

  useEffect(() => {
    fetchMintCollections();
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 検索のデバウンス
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(historySearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [historySearch]);

  // イベントとコレクションが読み込まれたら、まだ何も選択されていなければ全履歴を自動取得
  useEffect(() => {
    if (events.length > 0 && mintCollections.length > 0 && !historyCollection && historyItems.length === 0 && !historyLoading) {
      fetchAllEventsHistory(100);
    }
  }, [events.length, mintCollections.length]);

  const fetchCollectionHistory = async (typePath: string, eventId?: string, limit: number = 100) => {
    if (!typePath) return;
    setHistoryLoading(true);
    try {
      const encoded = encodeURIComponent(typePath);
      const eventParam = eventId ? `&eventId=${encodeURIComponent(eventId)}` : '';
      const url = `${API_BASE_URL}/api/mint-collections/${encoded}/mints?limit=${limit}${eventParam}`;
      
      // DEBUG: 開発時のみログ出力
      if (import.meta.env.DEV) {
      }
      
      const res = await fetch(url);
      const data = await res.json();
      
      // DEBUG: 開発時のみログ出力
      if (import.meta.env.DEV) {
        
        // 各アイテムのeventIdをログ出力
        if (data.data && Array.isArray(data.data)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }
      }
      
      if (data.success) {
        setHistoryItems(Array.isArray(data.data) ? data.data : []);
        const eventName = eventId ? events.find(e => e.id === eventId)?.name : null;
        const msg = eventName 
          ? `${eventName}の履歴: ${data.data?.length || 0}件`
          : `${data.data?.length || 0}件の履歴を取得しました`;
        setMessage(msg);
      } else {
        setMessage(`履歴の取得に失敗しました: ${data.error || 'unknown error'}`);
        setHistoryItems([]);
      }
    } catch (e) {
      setMessage('履歴の取得に失敗しました');
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // 全イベントの履歴を統合取得
  const fetchAllEventsHistory = async (limit: number = 100) => {
    setHistoryLoading(true);
    setMessage('全イベントの履歴を取得中...');
    try {
      // 全イベントのユニークなcollectionIdを取得
      const uniqueCollectionIds = Array.from(new Set(events.map(ev => resolveEventTypePath(ev)).filter(Boolean)));
      
      // DEBUG: 開発時のみログ出力
      if (import.meta.env.DEV) {
      }
      
      // 各collectionIdの履歴を並列取得
      const allHistories = await Promise.all(
        uniqueCollectionIds.map(async (collectionId) => {
          try {
            const encoded = encodeURIComponent(collectionId);
            const url = `${API_BASE_URL}/api/mint-collections/${encoded}/mints?limit=${limit}`;
            const res = await fetch(url);
            const data = await res.json();
            return data.success && Array.isArray(data.data) ? data.data : [];
          } catch {
            return [];
          }
        })
      );
      
      // 全ての履歴を統合
      const combined = allHistories.flat();
      
      // DEBUG: 開発時のみログ出力
      if (import.meta.env.DEV) {
      }
      
      // 日付順でソート（新しい順）
      combined.sort((a, b) => {
        const dateA = a.at ? new Date(a.at).getTime() : 0;
        const dateB = b.at ? new Date(b.at).getTime() : 0;
        return dateB - dateA;
      });
      
      setHistoryItems(combined);
      setHistoryCollection('__ALL__'); // 特殊値で全イベント表示を示す
      setMessage(`全イベントから${combined.length}件の履歴を取得しました`);
    } catch (e) {
      setMessage('履歴の取得に失敗しました');
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  // イベント名のマップを事前計算（メモ化）
  const eventNameMap = useMemo(() => {
    const map = new Map<string, string>();
    events.forEach(event => {
      map.set(event.id, event.name);
    });
    return map;
  }, [events]);



  // フィルタリング済みの履歴データ（最適化）
  const filteredHistory = useMemo(() => {
    let filtered = [...historyItems];

    // 検索フィルター（最適化・デバウンス）
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter(item => {
        const eventName = eventNameMap.get(item.eventId || '') || '';
        return (
          item.recipient?.toLowerCase().includes(searchLower) ||
          eventName.toLowerCase().includes(searchLower) ||
          item.txDigest?.toLowerCase().includes(searchLower)
        );
      });
    }

    // イベントフィルター
    if (historyEventFilter) {
      filtered = filtered.filter(item => item.eventId === historyEventFilter);
    }

    // 日付フィルター（最適化）
    if (historyDateFrom || historyDateTo) {
      const fromDate = historyDateFrom ? new Date(historyDateFrom).getTime() : 0;
      const toDate = historyDateTo ? new Date(historyDateTo).getTime() : Infinity;
      
      filtered = filtered.filter(item => {
        if (!item.at) return false;
        const itemTime = new Date(item.at).getTime();
        return itemTime >= fromDate && itemTime <= toDate;
      });
    }

    // ソート（最適化）
    filtered.sort((a, b) => {
      let compareValue = 0;
      if (historySortBy === 'date') {
        compareValue = (a.at ? new Date(a.at).getTime() : 0) - (b.at ? new Date(b.at).getTime() : 0);
      } else if (historySortBy === 'event') {
        const nameA = eventNameMap.get(a.eventId || '') || '';
        const nameB = eventNameMap.get(b.eventId || '') || '';
        compareValue = nameA.localeCompare(nameB);
      }
      return historySortOrder === 'asc' ? compareValue : -compareValue;
    });

    return filtered;
  }, [historyItems, debouncedSearch, historyEventFilter, historyDateFrom, historyDateTo, historySortBy, historySortOrder, eventNameMap]);

  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    const end = start + historyPageSize;
    return filteredHistory.slice(start, end);
  }, [filteredHistory, historyPage]);

  const totalPages = Math.ceil(filteredHistory.length / historyPageSize);

  const historyStats = useMemo(() => {
    const eventCounts = new Map<string, number>();
    filteredHistory.forEach(item => {
      if (item.eventId) {
        eventCounts.set(item.eventId, (eventCounts.get(item.eventId) || 0) + 1);
      }
    });
    return {
      total: filteredHistory.length,
      eventCounts
    };
  }, [filteredHistory]);

  const exportToCSV = () => {
    const headers = ['日時', 'イベント名', 'イベントID', '保有者アドレス', 'NFT Object ID', 'Transaction Digest'];
    const rows = filteredHistory.map(item => [
      item.at ? new Date(item.at).toLocaleString('ja-JP') : '',
      events.find(e => e.id === item.eventId)?.name || '',
      item.eventId || '',
      item.recipient || '',
      item.objectIds?.join(', ') || '',
      item.txDigest || ''
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `mint-history-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <AdminLayout currentPath="/admin/mint/history">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/admin' },
        { label: 'ミント管理' },
        { label: 'ミント履歴' }
      ]} />

      <PageHeader 
        title="ミント履歴"
        description="コレクション別のNFTミント履歴を確認・管理"
        action={
          filteredHistory.length > 0 ? (
            <button
              onClick={exportToCSV}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
            >
              CSV エクスポート
            </button>
          ) : undefined
        }
      />

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

      <div style={{ 
        background: 'white', 
        padding: '2rem', 
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
          {/* 履歴取得方法の選択 */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ 
              background: '#f0f9ff',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid #bae6fd',
              marginBottom: '1rem'
            }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#0c4a6e', lineHeight: 1.6 }}>
                <strong>💡 使い方:</strong> イベントを選択すると、そのイベントのミント履歴が自動的に表示されます。
                全イベントの履歴を見たい場合は「全イベントの履歴を取得」ボタンをクリックしてください。
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
              {/* コレクション選択 */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 600, 
                  fontSize: '0.875rem',
                  color: '#374151'
                }}>
                  コレクション選択
                </label>
                <select
                  value={historyCollection}
                  onChange={(e) => {
                    setHistoryCollection(e.target.value);
                    setHistoryItems([]);
                    setHistoryPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                >
                  <option value="">コレクションを選択</option>
                  {mintCollections.map(col => (
                    <option key={col.id} value={(col as any).typePath || col.packageId}>
                      {col.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* または、イベントから直接選択 */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 600, 
                  fontSize: '0.875rem',
                  color: '#374151'
                }}>
                  または、イベントから選択 (推奨)
                </label>
                <select
                  value={selectedEventId}
                  onChange={(e) => {
                    const eventId = e.target.value;
                    setSelectedEventId(eventId);
                    const selectedEvent = events.find(ev => ev.id === eventId);
                    if (selectedEvent) {
                      const resolvedTypePath = resolveEventTypePath(selectedEvent);
                      setHistoryCollection(resolvedTypePath);
                      setHistoryItems([]);
                      setHistoryPage(1);
                      // イベント選択時に自動的に履歴を取得
                      fetchCollectionHistory(resolvedTypePath, eventId, 100);
                    } else {
                      setHistoryCollection('');
                      setHistoryItems([]);
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    outline: 'none',
                    background: 'white'
                  }}
                >
                  <option value="">イベントを選択</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name} (ID: {ev.id}, {ev.active ? 'Active' : 'Ended'})
                    </option>
                  ))}
                </select>
                {selectedEventId && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                    選択中: {events.find(e => e.id === selectedEventId)?.name} (ID: {selectedEventId})
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  if (historyCollection) {
                    const eventIdToSend = selectedEventId && selectedEventId !== '' ? selectedEventId : undefined;
                    fetchCollectionHistory(historyCollection, eventIdToSend, 100);
                  }
                }}
                disabled={!historyCollection || historyLoading}
                style={{
                  padding: '0.75rem 2rem',
                  background: !historyCollection || historyLoading ? '#d1d5db' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: !historyCollection || historyLoading ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  whiteSpace: 'nowrap',
                  boxShadow: !historyCollection || historyLoading ? 'none' : '0 1px 3px rgba(16, 185, 129, 0.4)',
                  transition: 'all 0.2s'
                }}
              >
                {historyLoading ? '読み込み中...' : selectedEventId ? `${events.find(e => e.id === selectedEventId)?.name || 'イベント'}の履歴を取得` : 'コレクション全体の履歴を取得'}
              </button>
              <button
                onClick={() => fetchAllEventsHistory(100)}
                disabled={historyLoading || events.length === 0}
                style={{
                  padding: '0.75rem 2rem',
                  background: historyLoading || events.length === 0 ? '#d1d5db' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: historyLoading || events.length === 0 ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  whiteSpace: 'nowrap',
                  boxShadow: historyLoading || events.length === 0 ? 'none' : '0 1px 3px rgba(59, 130, 246, 0.4)',
                  transition: 'all 0.2s'
                }}
              >
                {historyLoading ? '読み込み中...' : '全イベントの履歴を取得'}
              </button>
            </div>
          </div>

        {historyItems.length > 0 && (
          <>
            {/* 統計カード */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                borderRadius: '12px',
                border: '1px solid #bfdbfe'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  総ミント数
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e3a8a' }}>
                  {historyStats.total.toLocaleString()}
                </div>
              </div>
              <div style={{
                padding: '1.5rem',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                borderRadius: '12px',
                border: '1px solid #bbf7d0'
              }}>
                <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  イベント数
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#14532d' }}>
                  {historyStats.eventCounts.size}
                </div>
              </div>
            </div>

            {/* フィルター・検索 */}
            <div style={{ 
              background: '#f9fafb',
              padding: '1.5rem',
              borderRadius: '12px',
              marginBottom: '2rem',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                フィルター・検索
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    検索
                  </label>
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => {
                      setHistorySearch(e.target.value);
                      setHistoryPage(1);
                    }}
                    placeholder="アドレス、イベント名、Tx..."
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    イベント
                  </label>
                  <select
                    value={historyEventFilter}
                    onChange={(e) => {
                      setHistoryEventFilter(e.target.value);
                      setHistoryPage(1);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.875rem',
                      outline: 'none',
                      background: 'white'
                    }}
                  >
                    <option value="">すべてのイベント</option>
                    {Array.from(historyStats.eventCounts.keys()).map(eventId => {
                      const event = events.find(e => e.id === eventId);
                      return (
                        <option key={eventId} value={eventId}>
                          {event?.name || eventId} ({historyStats.eventCounts.get(eventId)})
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    並び順
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      value={historySortBy}
                      onChange={(e) => setHistorySortBy(e.target.value as any)}
                      style={{
                        flex: 1,
                        padding: '0.625rem 0.875rem',
                        borderRadius: '8px',
                        border: '1px solid #d1d5db',
                        fontSize: '0.875rem',
                        outline: 'none',
                        background: 'white'
                      }}
                    >
                      <option value="date">日時</option>
                      <option value="event">イベント名</option>
                    </select>
                    <button
                      onClick={() => setHistorySortOrder(historySortOrder === 'asc' ? 'desc' : 'asc')}
                      style={{
                        padding: '0.625rem 0.875rem',
                        background: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: '#374151'
                      }}
                    >
                      {historySortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* 日付範囲フィルター */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    開始日
                  </label>
                  <input
                    type="date"
                    value={historyDateFrom}
                    onChange={(e) => {
                      setHistoryDateFrom(e.target.value);
                      setHistoryPage(1);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ 
                    display: 'block', 
                    marginBottom: '0.5rem', 
                    fontSize: '0.75rem',
                    color: '#6b7280',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    終了日
                  </label>
                  <input
                    type="date"
                    value={historyDateTo}
                    onChange={(e) => {
                      setHistoryDateTo(e.target.value);
                      setHistoryPage(1);
                    }}
                    style={{
                      width: '100%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: '8px',
                      border: '1px solid #d1d5db',
                      fontSize: '0.875rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* フィルタークリア */}
              {(historySearch || historyEventFilter || historyDateFrom || historyDateTo) && (
                <button
                  onClick={() => {
                    setHistorySearch('');
                    setHistoryEventFilter('');
                    setHistoryDateFrom('');
                    setHistoryDateTo('');
                    setHistoryPage(1);
                  }}
                  style={{
                    marginTop: '1rem',
                    padding: '0.5rem 1rem',
                    background: 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: '#6b7280',
                    transition: 'all 0.2s'
                  }}
                >
                  フィルターをクリア
                </button>
              )}
            </div>

            {/* 結果表示 */}
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
                {filteredHistory.length.toLocaleString()}件の結果
                {historyItems.length !== filteredHistory.length && ` (全${historyItems.length.toLocaleString()}件からフィルタリング)`}
              </p>
            </div>

            {/* テーブル */}
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ 
                      textAlign: 'left', 
                      padding: '1rem', 
                      fontWeight: 600, 
                      fontSize: '0.75rem', 
                      color: '#6b7280', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em' 
                    }}>
                      日時
                    </th>
                    <th style={{ 
                      textAlign: 'left', 
                      padding: '1rem', 
                      fontWeight: 600, 
                      fontSize: '0.75rem', 
                      color: '#6b7280', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em' 
                    }}>
                      イベント
                    </th>
                    <th style={{ 
                      textAlign: 'left', 
                      padding: '1rem', 
                      fontWeight: 600, 
                      fontSize: '0.75rem', 
                      color: '#6b7280', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em' 
                    }}>
                      保有者
                    </th>
                    <th style={{ 
                      textAlign: 'left', 
                      padding: '1rem', 
                      fontWeight: 600, 
                      fontSize: '0.75rem', 
                      color: '#6b7280', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em' 
                    }}>
                      NFT Object ID
                    </th>
                    <th style={{ 
                      textAlign: 'center', 
                      padding: '1rem', 
                      fontWeight: 600, 
                      fontSize: '0.75rem', 
                      color: '#6b7280', 
                      textTransform: 'uppercase', 
                      letterSpacing: '0.05em' 
                    }}>
                      アクション
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.map((item, idx) => {
                    const eventName = events.find(e => e.id === item.eventId)?.name || item.eventId || '-';
                    const suiExplorerTx = `https://suiscan.xyz/mainnet/tx/${item.txDigest}`;
                    
                    return (
                      <tr 
                        key={idx} 
                        style={{ 
                          background: 'white',
                          borderBottom: '1px solid #f3f4f6',
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                          <div style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>
                            {item.at ? new Date(item.at).toLocaleDateString('ja-JP', { 
                              year: 'numeric', 
                              month: 'short', 
                              day: 'numeric' 
                            }) : '-'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                            {item.at ? new Date(item.at).toLocaleTimeString('ja-JP') : ''}
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ 
                            fontSize: '0.875rem', 
                            color: '#111827', 
                            fontWeight: 600,
                            maxWidth: '200px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {eventName}
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ 
                              fontFamily: 'monospace', 
                              fontSize: '0.875rem', 
                              color: '#6b7280' 
                            }}>
                              {item.recipient ? `${item.recipient.slice(0, 8)}...${item.recipient.slice(-6)}` : '-'}
                            </span>
                            {item.recipient && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(item.recipient!);
                                  setMessage('アドレスをコピーしました');
                                  setTimeout(() => setMessage(''), 2000);
                                }}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  background: '#f3f4f6',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  color: '#6b7280',
                                  fontWeight: 500,
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                              >
                                Copy
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {item.objectIds && item.objectIds.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                              {item.objectIds.slice(0, 2).map((objId, i) => (
                                <a
                                  key={i}
                                  href={`https://suiscan.xyz/mainnet/object/${objId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontFamily: 'monospace',
                                    fontSize: '0.75rem',
                                    color: '#3b82f6',
                                    textDecoration: 'none',
                                    fontWeight: 500
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                  onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                >
                                  {objId.slice(0, 8)}...{objId.slice(-6)}
                                </a>
                              ))}
                              {item.objectIds.length > 2 && (
                                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                  +{item.objectIds.length - 2} more
                                </span>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <a
                            href={suiExplorerTx}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '0.5rem 1rem',
                              background: '#3b82f6',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '0.8125rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                              display: 'inline-block',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
                          >
                            Tx 詳細
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ページネーション */}
            {totalPages > 1 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center'
              }}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                  ページ {historyPage} / {totalPages}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => setHistoryPage(Math.max(1, historyPage - 1))}
                    disabled={historyPage === 1}
                    style={{
                      padding: '0.5rem 1rem',
                      background: historyPage === 1 ? '#f3f4f6' : 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      cursor: historyPage === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: historyPage === 1 ? '#9ca3af' : '#374151',
                      transition: 'all 0.2s'
                    }}
                  >
                    前へ
                  </button>
                  <button
                    onClick={() => setHistoryPage(Math.min(totalPages, historyPage + 1))}
                    disabled={historyPage === totalPages}
                    style={{
                      padding: '0.5rem 1rem',
                      background: historyPage === totalPages ? '#f3f4f6' : 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      cursor: historyPage === totalPages ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: historyPage === totalPages ? '#9ca3af' : '#374151',
                      transition: 'all 0.2s'
                    }}
                  >
                    次へ
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {historyItems.length === 0 && historyCollection && !historyLoading && (
          <div style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            background: '#f9fafb',
            borderRadius: '12px',
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
              —
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
              ミント履歴がありません
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af' }}>
              このコレクションでNFTをミントすると、ここに履歴が表示されます
            </p>
          </div>
        )}

        {!historyCollection && (
          <div style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            background: '#f9fafb',
            borderRadius: '12px',
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
              ↓
            </div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
              コレクションを選択してください
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af' }}>
              上のドロップダウンからコレクションを選択し、履歴取得ボタンをクリックしてください
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

