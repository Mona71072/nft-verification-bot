import { useState, useCallback } from 'react';
import type { NFTCollection } from '../types';

export function useCollections() {
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editingCollection, setEditingCollection] = useState<NFTCollection | null>(null);

  const fetchCollections = useCallback(async (apiBaseUrl: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${apiBaseUrl}/api/collections`);
      const data = await res.json();
      if (data.success) {
        setCollections(data.data || []);
      } else {
        setMessage(data.error || 'コレクションの取得に失敗しました');
      }
    } catch (error) {
      setMessage('コレクションの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, []);

  const addCollection = useCallback((collection: NFTCollection) => {
    setCollections(prev => [...prev, collection]);
  }, []);

  const updateCollection = useCallback((id: string, updates: Partial<NFTCollection>) => {
    setCollections(prev => prev.map(col => 
      col.id === id ? { ...col, ...updates } : col
    ));
  }, []);

  const removeCollection = useCallback((id: string) => {
    setCollections(prev => prev.filter(col => col.id !== id));
  }, []);

  return {
    collections,
    setCollections,
    loading,
    setLoading,
    message,
    setMessage,
    editingCollection,
    setEditingCollection,
    fetchCollections,
    addCollection,
    updateCollection,
    removeCollection
  };
}