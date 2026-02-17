import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

interface NFTCollection {
  id: string;
  name: string;
  packageId: string;
  description?: string;
  isActive: boolean;
  roleId?: string;
  originalId?: string;
  displayName?: string;
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
        // ロール管理とミント管理のコレクション一覧を並列取得（リクエスト時間短縮）
        const [collectionsRes, mintCollectionsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/collections`),
          fetch(`${API_BASE_URL}/api/mint-collections`)
        ]);
        
        const [collectionsData, mintCollectionsData] = await Promise.all([
          collectionsRes.json() as Promise<CollectionsResponse>,
          mintCollectionsRes.json() as Promise<CollectionsResponse>
        ]);
        
        const roleCollections = collectionsData.success && collectionsData.data ? collectionsData.data : [];
        const mintCollections = mintCollectionsData.success && mintCollectionsData.data ? mintCollectionsData.data : [];

        // 統合処理
        // ロール管理のコレクションはidを数値で持っているが、packageIdにタイプパスがあるので、
        // それをidとして使用する
        const allCollections: NFTCollection[] = roleCollections.map((c: NFTCollection) => ({
          ...c,
          originalId: c.id,
          id: c.packageId || c.id, // packageIdを優先的に使用
          displayName: c.name
        }));
        const existingCollectionIds = new Set(allCollections.map((c: NFTCollection) => c.id));

        // ミント管理のコレクションを追加
        mintCollections.forEach((mintCol: { id?: string; typePath?: string; packageId?: string; name: string; description?: string }) => {
          const typePath = mintCol.typePath || mintCol.packageId;
          if (typePath && !existingCollectionIds.has(typePath)) {
            allCollections.push({
              id: typePath,
              name: mintCol.name,
              packageId: typePath,
              description: mintCol.description || 'ミント管理から取得',
              isActive: true,
              originalId: mintCol.id,
              displayName: mintCol.name
            });
            existingCollectionIds.add(typePath);
          }
        });

        return allCollections;
      } catch (error) {
        throw error instanceof Error ? error : new Error('コレクションの取得に失敗しました');
      }
    },
    // コレクションは頻繁に変更されないため、長めのstaleTimeを設定（リクエスト削減のため延長）
    staleTime: 20 * 60 * 1000, // 20 minutes
  });
}
