import React, { useState, useCallback } from 'react';
import type { AdminMintEvent } from '../../../types';
import { useEvents } from '../../../hooks/useEvents';
import EventEditor from '../../EventEditor';

interface EventsTabProps {
  apiBaseUrl: string;
  mode?: 'admin' | 'roles' | 'mint';
}

export function EventsTab({ apiBaseUrl }: EventsTabProps) {
  const {
    events,
    eventSortBy,
    setEventSortBy,
    eventSortOrder,
    setEventSortOrder,
    isCreatingEvent,
    setIsCreatingEvent,
    editingEventData,
    setEditingEventData,
    newEvent,
    fetchEvents,
    addEvent,
    updateEvent,
    removeEvent,
    resetNewEvent
  } = useEvents();

  const [mintCollections, setMintCollections] = useState<any[]>([]);

  const fetchMintCollections = useCallback(async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/mint-collections`);
      const data = await res.json();
      if (data.success) setMintCollections(data.data || []);
    } catch (e) {
    }
  }, [apiBaseUrl]);

  // 初期データ読み込み
  React.useEffect(() => {
    fetchEvents(apiBaseUrl);
    fetchMintCollections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBaseUrl, fetchMintCollections]);

  const handleCreateEvent = useCallback(async () => {
    try {
      setIsCreatingEvent(true);
      resetNewEvent();
    } catch (error) {
    }
  }, [setIsCreatingEvent, resetNewEvent]);

  const handleSaveEvent = useCallback(async (eventData: AdminMintEvent) => {
    try {
      if (editingEventData) {
        updateEvent(eventData.id, eventData);
      } else {
        addEvent(eventData);
      }
      setIsCreatingEvent(false);
      setEditingEventData(null);
    } catch (error) {
    }
  }, [editingEventData, updateEvent, addEvent, setIsCreatingEvent, setEditingEventData]);

  const handleDeleteEvent = useCallback(async (id: string) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/events/${id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        removeEvent(id);
      }
    } catch (error) {
    }
  }, [apiBaseUrl, removeEvent]);

  const sortedEvents = React.useMemo(() => {
    return [...events].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (eventSortBy) {
        case 'name':
          aValue = a.name?.toLowerCase() || '';
          bValue = b.name?.toLowerCase() || '';
          break;
        case 'collection':
          aValue = a.collectionId || '';
          bValue = b.collectionId || '';
          break;
        case 'date':
          aValue = new Date(a.startAt || 0).getTime();
          bValue = new Date(b.startAt || 0).getTime();
          break;
        case 'mints':
          aValue = a.totalMints || a.mintedCount || 0;
          bValue = b.totalMints || b.mintedCount || 0;
          break;
        default:
          return 0;
      }
      
      if (eventSortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [events, eventSortBy, eventSortOrder]);

  if (isCreatingEvent || editingEventData) {
    return (
      <EventEditor
        event={editingEventData || (newEvent as AdminMintEvent)}
        collections={mintCollections}
        onSave={async (event: any) => {
          const adminEvent: AdminMintEvent = {
            ...event,
            id: event.id || '',
            active: event.active ?? true
          };
          await handleSaveEvent(adminEvent);
        }}
        onCancel={() => {
          setIsCreatingEvent(false);
          setEditingEventData(null);
        }}
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>イベント管理</h3>
        <button
          onClick={handleCreateEvent}
          style={{
            padding: '0.75rem 1rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          新しいイベントを作成
        </button>
      </div>

      {/* ソートコントロール */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <label>
          ソート:
          <select
            value={eventSortBy}
            onChange={(e) => setEventSortBy(e.target.value as any)}
            style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
          >
            <option value="date">日付</option>
            <option value="name">名前</option>
            <option value="collection">コレクション</option>
            <option value="mints">ミント数</option>
          </select>
        </label>
        <button
          onClick={() => setEventSortOrder(eventSortOrder === 'asc' ? 'desc' : 'asc')}
          style={{
            padding: '0.25rem 0.5rem',
            background: '#f8f9fa',
            border: '1px solid #ddd',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {eventSortOrder === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* イベント一覧 */}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {sortedEvents.map((event) => (
          <div
            key={event.id}
            style={{
              padding: '1rem',
              border: '1px solid #ddd',
              borderRadius: '8px',
              backgroundColor: event.active ? '#f8f9fa' : '#fff'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>{event.name}</h4>
                <p style={{ margin: '0 0 0.5rem 0', color: '#666' }}>{event.description}</p>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                  <div>開始: {new Date(event.startAt || '').toLocaleString()}</div>
                  <div>終了: {new Date(event.endAt || '').toLocaleString()}</div>
                  <div>ミント数: {event.totalMints || event.mintedCount || 0} / {event.totalCap || '無制限'}</div>
                  <div>ステータス: {event.active ? 'アクティブ' : '非アクティブ'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setEditingEventData(event)}
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
                  onClick={() => handleDeleteEvent(event.id)}
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
          </div>
        ))}
      </div>

      {sortedEvents.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
          イベントがありません
        </div>
      )}
    </div>
  );
}
