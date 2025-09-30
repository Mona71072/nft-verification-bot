import { useState, useEffect } from 'react';
import type { NFTCollection } from '../types';

// コレクション管理のカスタムフック
export const useCollections = (apiBaseUrl: string) => {
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [checkAllCollections, setCheckAllCollections] = useState<boolean>(true);

  useEffect(() => {
    const fetchCollections = async () => {
      try {
        console.log('🔄 Fetching collections from API...');
        const response = await fetch(`${apiBaseUrl}/api/collections`);
        const data = await response.json();
        if (data.success && data.data && data.data.length > 0) {
          setCollections(data.data);
          // デフォルトですべてのコレクションを選択
          setSelectedCollections(data.data.map((col: NFTCollection) => col.id));
          console.log(`✅ Loaded ${data.data.length} collections`);
        } else {
          console.log('⚠️ No collections found');
          setCollections([]);
          setSelectedCollections([]);
        }
      } catch (error) {
        console.error('❌ Failed to fetch collections:', error);
        console.log('⚠️ No collections available');
        setCollections([]);
        setSelectedCollections([]);
      }
    };
    
    fetchCollections();
  }, [apiBaseUrl]);

  const handleCheckAllCollections = (checked: boolean) => {
    setCheckAllCollections(checked);
    if (checked) {
      setSelectedCollections(collections.map(col => col.id));
    } else {
      setSelectedCollections([]);
    }
  };

  const handleCollectionToggle = (collectionId: string) => {
    setSelectedCollections(prev => {
      if (prev.includes(collectionId)) {
        const newSelection = prev.filter(id => id !== collectionId);
        setCheckAllCollections(newSelection.length === collections.length);
        return newSelection;
      } else {
        const newSelection = [...prev, collectionId];
        setCheckAllCollections(newSelection.length === collections.length);
        return newSelection;
      }
    });
  };

  return {
    collections,
    selectedCollections,
    checkAllCollections,
    handleCheckAllCollections,
    handleCollectionToggle
  };
};
