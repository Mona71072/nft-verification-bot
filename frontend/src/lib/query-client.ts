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
      // データを15分間は新鮮とみなす（リクエスト削減のため延長）
      staleTime: 15 * 60 * 1000, // 15 minutes
      
      // キャッシュを30分間保持（リクエスト削減のため延長）
      // TanStack Query v5ではcacheTimeがgcTimeに変更
      gcTime: 30 * 60 * 1000, // 30 minutes
      
      // 失敗時のリトライ設定（リクエスト削減のため削減）
      retry: (failureCount, error: any) => {
        // 4xxエラーはリトライしない
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // その他は最大2回リトライ（3回から削減）
        return failureCount < 2;
      },
      
      // ウィンドウフォーカス時の再フェッチを無効化
      refetchOnWindowFocus: false,
      
      // ネットワーク再接続時の再フェッチを無効化（リクエスト削減のため）
      refetchOnReconnect: false,
      
      // エラー時の自動再フェッチを無効化（無限ループ防止）
      // refetchOnMount: 'always' | true の場合、エラー状態でも再フェッチされる可能性があるため、
      // エラー状態のクエリは再フェッチしないように設定（TanStack Query v5のデフォルト動作を利用）
      refetchOnMount: (query) => {
        // エラー状態のクエリは再フェッチしない（無限ループ防止）
        if (query.state.error) {
          return false;
        }
        // エラーでない場合は再フェッチ
        return true;
      },
      refetchOnError: false, // エラー時の自動再フェッチを無効化（無限ループ防止）
    },
    mutations: {
      // ミューテーション失敗時のリトライ設定（リクエスト削減のため削減）
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) {
          return false;
        }
        // 最大1回リトライ（2回から削減）
        return failureCount < 1;
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
    owned: (
      address: string,
      options: {
        network?: string;
        collectionTypes?: string[];
      } = {}
    ) =>
      [
        ...queryKeys.nfts.all,
        'owned',
        {
          address,
          network: options.network ?? 'mainnet',
          collectionTypes: Array.isArray(options.collectionTypes)
            ? [...options.collectionTypes]
            : [],
        },
      ] as const,
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
