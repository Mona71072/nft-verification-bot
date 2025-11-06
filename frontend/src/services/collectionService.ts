import type { NFTCollection } from '../types';

export interface CollectionService {
  fetchCollections: (apiBaseUrl: string) => Promise<NFTCollection[]>;
  createCollection: (apiBaseUrl: string, collection: Partial<NFTCollection>) => Promise<NFTCollection>;
  updateCollection: (apiBaseUrl: string, id: string, updates: Partial<NFTCollection>) => Promise<NFTCollection>;
  deleteCollection: (apiBaseUrl: string, id: string) => Promise<void>;
}

export function createCollectionService(): CollectionService {
  const fetchCollections = async (apiBaseUrl: string): Promise<NFTCollection[]> => {
    const response = await fetch(`${apiBaseUrl}/api/collections`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'コレクションの取得に失敗しました');
    }
    
    return data.data || [];
  };

  const createCollection = async (apiBaseUrl: string, collection: Partial<NFTCollection>): Promise<NFTCollection> => {
    const response = await fetch(`${apiBaseUrl}/api/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collection)
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'コレクションの作成に失敗しました');
    }
    
    return data.data;
  };

  const updateCollection = async (apiBaseUrl: string, id: string, updates: Partial<NFTCollection>): Promise<NFTCollection> => {
    const response = await fetch(`${apiBaseUrl}/api/collections/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'コレクションの更新に失敗しました');
    }
    
    return data.data;
  };

  const deleteCollection = async (apiBaseUrl: string, id: string): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/api/collections/${id}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'コレクションの削除に失敗しました');
    }
  };

  return {
    fetchCollections,
    createCollection,
    updateCollection,
    deleteCollection
  };
}
