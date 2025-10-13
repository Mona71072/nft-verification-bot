import { QueryClient } from '@tanstack/react-query';

/**
 * TanStack Query設定
 * - staleTime: データの鮮度管理
 * - cacheTime: キャッシュ保持時間
 * - retry: リトライ設定
 * - refetchOnWindowFocus: ウィンドウフォーカス時の再フェッチ
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // データを5分間は新鮮とみなす
      staleTime: 5 * 60 * 1000, // 5 minutes
      
      // キャッシュを10分間保持
      cacheTime: 10 * 60 * 1000, // 10 minutes
      
      // 失敗時のリトライ設定
      retry: (failureCount, error: any) => {
        // 4xxエラーはリトライしない
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // その他は最大3回リトライ
        return failureCount < 3;
      },
      
      // ウィンドウフォーカス時の再フェッチを無効化（必要に応じて有効化）
      refetchOnWindowFocus: false,
      
      // ネットワーク再接続時の再フェッチ
      refetchOnReconnect: true,
    },
    mutations: {
      // ミューテーション失敗時のリトライ設定
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

/**
 * クエリキー規約
 * - 階層構造でキーを管理
 * - 型安全性を確保
 */
export const queryKeys = {
  // コレクション関連
  collections: {
    all: ['collections'] as const,
    lists: () => [...queryKeys.collections.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.collections.lists(), { filters }] as const,
    details: () => [...queryKeys.collections.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.collections.details(), id] as const,
  },
  
  // イベント関連
  events: {
    all: ['events'] as const,
    lists: () => [...queryKeys.events.all, 'list'] as const,
    list: (filters: Record<string, any>) => [...queryKeys.events.lists(), { filters }] as const,
    details: () => [...queryKeys.events.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.events.details(), id] as const,
    public: (id: string) => [...queryKeys.events.details(), id, 'public'] as const,
  },
  
  // NFT関連
  nfts: {
    all: ['nfts'] as const,
    owned: (address: string) => [...queryKeys.nfts.all, 'owned', address] as const,
    collectionCount: (collectionId: string) => [...queryKeys.nfts.all, 'count', collectionId] as const,
  },
  
  // 統計関連
  stats: {
    all: ['stats'] as const,
    mintCounts: (collectionIds: string[]) => [...queryKeys.stats.all, 'mintCounts', collectionIds] as const,
    onchainCount: (collectionId: string) => [...queryKeys.stats.all, 'onchainCount', collectionId] as const,
  },
  
  // 認証関連
  auth: {
    all: ['auth'] as const,
    nonce: (address: string, scope: string) => [...queryKeys.auth.all, 'nonce', address, scope] as const,
  },
} as const;
