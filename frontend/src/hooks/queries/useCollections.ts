import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

interface NFTCollection {
  id: string;
  name: string;
  packageId: string;
  description?: string;
  isActive: boolean;
}

interface CollectionsResponse {
  success: boolean;
  data?: NFTCollection[];
  error?: string;
}

/**
 * コレクション一覧取得フック
 * - ロール管理とミント管理のコレクションを統合
 * - 自動再フェッチとキャッシュ管理
 */
export function useCollections() {
  return useQuery({
    queryKey: queryKeys.collections.lists(),
    queryFn: async (): Promise<NFTCollection[]> => {
      try {
        // ロール管理のコレクション一覧を取得
        const collectionsRes = await fetch(`${API_BASE_URL}/api/collections`);
        const collectionsData: CollectionsResponse = await collectionsRes.json();
        const roleCollections = collectionsData.success && collectionsData.data ? collectionsData.data : [];

        // ミント管理のコレクション一覧を取得
        const mintCollectionsRes = await fetch(`${API_BASE_URL}/api/mint-collections`);
        const mintCollectionsData: CollectionsResponse = await mintCollectionsRes.json();
        const mintCollections = mintCollectionsData.success && mintCollectionsData.data ? mintCollectionsData.data : [];

        // 統合処理
        // ロール管理のコレクションはidを数値で持っているが、packageIdにタイプパスがあるので、
        // それをidとして使用する
        const allCollections: NFTCollection[] = roleCollections.map((c: NFTCollection) => ({
          ...c,
          id: c.packageId || c.id, // packageIdを優先的に使用
        }));
        const existingCollectionIds = new Set(allCollections.map((c: NFTCollection) => c.id));

        // ミント管理のコレクションを追加
        mintCollections.forEach((mintCol: any) => {
          const typePath = mintCol.typePath || mintCol.packageId;
          if (typePath && !existingCollectionIds.has(typePath)) {
            allCollections.push({
              id: typePath,
              name: mintCol.name,
              packageId: typePath,
              description: mintCol.description || 'ミント管理から取得',
              isActive: true
            });
          }
        });

        return allCollections;
      } catch (error) {
        console.error('Failed to fetch collections:', error);
        throw new Error('コレクションの取得に失敗しました');
      }
    },
    // コレクションは頻繁に変更されないため、長めのstaleTimeを設定
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}
