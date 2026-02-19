import { useState, useCallback } from 'react';
import type { AdminMintEvent } from '../types';

export function useEvents() {
  const [events, setEvents] = useState<AdminMintEvent[]>([]);
  const [eventSortBy, setEventSortBy] = useState<'name' | 'collection' | 'date' | 'mints'>('date');
  const [eventSortOrder, setEventSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [editingEventData, setEditingEventData] = useState<AdminMintEvent | null>(null);

  const newEventTemplate: Partial<AdminMintEvent> = {
    name: '',
    description: '',
    collectionId: '',
    imageUrl: '',
    active: true,
    startAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    endAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    moveCall: { 
      target: '', 
      typeArguments: [], 
      argumentsTemplate: ['{recipient}', '{name}', '{imageCid}', '{imageMimeType}', '{eventDate}'], 
      gasBudget: 20000000 
    },
    totalCap: undefined
  };

  const [newEvent, setNewEvent] = useState<Partial<AdminMintEvent>>(newEventTemplate);

  const fetchEvents = useCallback(async (apiBaseUrl: string) => {
    try {
      const addr = typeof window !== 'undefined'
        ? localStorage.getItem('currentWalletAddress') || (window as any).currentWalletAddress
        : undefined;
      const headers: HeadersInit = {
        ...(addr ? { 'X-Admin-Address': addr } : {})
      };
      const res = await fetch(`${apiBaseUrl}/api/admin/events`, { headers });
      const data = await res.json();
      if (data.success) {
        setEvents(data.data || []);
      }
    } catch (error) {
    }
  }, []);

  const addEvent = useCallback((event: AdminMintEvent) => {
    setEvents(prev => [...prev, event]);
  }, []);

  const updateEvent = useCallback((id: string, updates: Partial<AdminMintEvent>) => {
    setEvents(prev => prev.map(event => 
      event.id === id ? { ...event, ...updates } : event
    ));
  }, []);

  const removeEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(event => event.id !== id));
  }, []);

  const resetNewEvent = useCallback(() => {
    setNewEvent(newEventTemplate);
  }, []);

  return {
    events,
    setEvents,
    eventSortBy,
    setEventSortBy,
    eventSortOrder,
    setEventSortOrder,
    isCreatingEvent,
    setIsCreatingEvent,
    editingEventData,
    setEditingEventData,
    newEvent,
    setNewEvent,
    fetchEvents,
    addEvent,
    updateEvent,
    removeEvent,
    resetNewEvent
  };
}
