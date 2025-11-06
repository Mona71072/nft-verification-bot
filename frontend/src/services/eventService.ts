import type { AdminMintEvent } from '../types';

export interface EventService {
  fetchEvents: (apiBaseUrl: string) => Promise<AdminMintEvent[]>;
  createEvent: (apiBaseUrl: string, event: Partial<AdminMintEvent>) => Promise<AdminMintEvent>;
  updateEvent: (apiBaseUrl: string, id: string, updates: Partial<AdminMintEvent>) => Promise<AdminMintEvent>;
  deleteEvent: (apiBaseUrl: string, id: string) => Promise<void>;
  fetchMintCollections: (apiBaseUrl: string) => Promise<any[]>;
}

export function createEventService(): EventService {
  const fetchEvents = async (apiBaseUrl: string): Promise<AdminMintEvent[]> => {
    const response = await fetch(`${apiBaseUrl}/api/admin/events`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'イベントの取得に失敗しました');
    }
    
    return data.data || [];
  };

  const createEvent = async (apiBaseUrl: string, event: Partial<AdminMintEvent>): Promise<AdminMintEvent> => {
    const response = await fetch(`${apiBaseUrl}/api/admin/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'イベントの作成に失敗しました');
    }
    
    return data.data;
  };

  const updateEvent = async (apiBaseUrl: string, id: string, updates: Partial<AdminMintEvent>): Promise<AdminMintEvent> => {
    const response = await fetch(`${apiBaseUrl}/api/admin/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'イベントの更新に失敗しました');
    }
    
    return data.data;
  };

  const deleteEvent = async (apiBaseUrl: string, id: string): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/api/admin/events/${id}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'イベントの削除に失敗しました');
    }
  };

  const fetchMintCollections = async (apiBaseUrl: string): Promise<any[]> => {
    const response = await fetch(`${apiBaseUrl}/api/mint-collections`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'ミントコレクションの取得に失敗しました');
    }
    
    return data.data || [];
  };

  return {
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    fetchMintCollections
  };
}
