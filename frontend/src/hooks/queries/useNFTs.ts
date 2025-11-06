import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

interface OwnedNFT {
  objectId: string;
  type: string;
  display?: {
    name?: string;
    description?: string;
    image_url?: string;
    event_date?: string;
  };
  owner?: unknown;
  previousTransaction?: string;
  timestamp?: number; // ブロックチェーン上のトランザクションtimestamp（ミリ秒）
}

interface OnchainCountResponse {
  success: boolean;
  count?: number;
  burned?: number;
  inKiosk?: number;
  uniqueHolders?: number;
  totalMinted?: number;
  error?: string;
}

/**
 * 保有NFT一覧取得フック
 */
export function useOwnedNFTs(address: string, collectionTypes: string[]) {
  return useQuery({
    queryKey: queryKeys.nfts.owned(address),
    queryFn: async (): Promise<OwnedNFT[]> => {
      try {
        if (!address || collectionTypes.length === 0) {
          return [];
        }

        const response = await fetch(
          `${API_BASE_URL}/api/owned-nfts/${encodeURIComponent(address)}?collectionIds=${collectionTypes.map(encodeURIComponent).join(',')}`
        );
        
        const data = await response.json();
        
        if (!data.success || !data.data) {
          return [];
        }
        
        return data.data;
      } catch (error) {
        return [];
      }
    },
    enabled: !!address && collectionTypes.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes（リクエスト削減のため延長、NFT保有状況は比較的頻繁に変わる可能性があるがキャッシュを優先）
  });
}

/**
 * コレクション別オンチェーンNFT数取得フック
 */
export function useOnchainCount(collectionId: string) {
  return useQuery({
    queryKey: queryKeys.stats.onchainCount(collectionId),
    queryFn: async (): Promise<OnchainCountResponse> => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/collection-onchain-count/${encodeURIComponent(collectionId)}`);
        const data: OnchainCountResponse = await response.json();
        
        if (!data.success) {
          throw new Error(data.error || 'NFT数の取得に失敗しました');
        }
        
        return data;
      } catch (error) {
        throw new Error('NFT数の取得に失敗しました');
      }
    },
    enabled: !!collectionId,
    staleTime: 15 * 60 * 1000, // 15 minutes（リクエスト削減のため延長）
  });
}

/**
 * 複数コレクションのオンチェーンNFT数を並列取得
 */
export function useOnchainCounts(collectionIds: string[]) {
  return useQuery({
    queryKey: queryKeys.stats.mintCounts(collectionIds),
    queryFn: async (): Promise<Map<string, number>> => {
      try {
        if (collectionIds.length === 0) {
          return new Map();
        }

        const countPromises = collectionIds.map(async (collectionId) => {
          try {
            const response = await fetch(`${API_BASE_URL}/api/collection-onchain-count/${encodeURIComponent(collectionId)}`);
            const data: OnchainCountResponse = await response.json();
            
            if (data.success) {
              const count = data.totalMinted || data.count || 0;
              return { collectionId, count };
            }
            return { collectionId, count: 0 };
          } catch (error) {
            return { collectionId, count: 0 };
          }
        });
        
        const results = await Promise.all(countPromises);
        const countMap = new Map<string, number>();
        
        results.forEach(({ collectionId, count }) => {
          countMap.set(collectionId, count);
        });
        
        return countMap;
      } catch (error) {
        return new Map();
      }
    },
    enabled: collectionIds.length > 0,
    staleTime: 15 * 60 * 1000, // 15 minutes（リクエスト削減のため延長）
  });
}
