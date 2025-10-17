import { useEffect, useCallback, useRef } from 'react';
import { queryClient } from '../lib/query-client';

interface PrefetchConfig {
  queryKey: string[];
  queryFn: () => Promise<any>;
  staleTime?: number;
  priority?: 'high' | 'medium' | 'low';
}

export function useAggressivePrefetch() {
  const prefetchedQueries = useRef<Set<string>>(new Set());
  const prefetchQueue = useRef<PrefetchConfig[]>([]);
  const isProcessing = useRef(false);

  // プリフェッチの実行
  const executePrefetch = useCallback(async (config: PrefetchConfig) => {
    const queryKey = config.queryKey.join('_');
    
    if (prefetchedQueries.current.has(queryKey)) {
      return;
    }

    try {
      await queryClient.prefetchQuery({
        queryKey: config.queryKey,
        queryFn: config.queryFn,
        staleTime: config.staleTime || 5 * 60 * 1000,
      });
      
      prefetchedQueries.current.add(queryKey);
    } catch (error) {
      console.warn(`Failed to prefetch ${queryKey}:`, error);
    }
  }, []);

  // キューを処理
  const processQueue = useCallback(async () => {
    if (isProcessing.current || prefetchQueue.current.length === 0) {
      return;
    }

    isProcessing.current = true;

    try {
      // 優先度でソート
      const sortedQueue = [...prefetchQueue.current].sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority || 'low'] - priorityOrder[a.priority || 'low'];
      });

      // バッチで実行（同時に3つまで）
      const batchSize = 3;
      for (let i = 0; i < sortedQueue.length; i += batchSize) {
        const batch = sortedQueue.slice(i, i + batchSize);
        await Promise.allSettled(batch.map(executePrefetch));
        
        // バッチ間で少し待機
        if (i + batchSize < sortedQueue.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      prefetchQueue.current = [];
    } finally {
      isProcessing.current = false;
    }
  }, [executePrefetch]);

  // プリフェッチの追加
  const addPrefetch = useCallback((config: PrefetchConfig) => {
    const queryKey = config.queryKey.join('_');
    
    if (prefetchedQueries.current.has(queryKey)) {
      return;
    }

    prefetchQueue.current.push(config);
    
    // アイドル時に実行
    if ('requestIdleCallback' in window) {
      requestIdleCallback(processQueue, { timeout: 2000 });
    } else {
      setTimeout(processQueue, 100);
    }
  }, [processQueue]);

  // アドミンページ用のプリフェッチ設定
  const prefetchAdminData = useCallback(() => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

    // 高優先度: 基本データ
    addPrefetch({
      queryKey: ['collections'],
      queryFn: async () => {
        const res = await fetch(`${API_BASE_URL}/api/collections`);
        const data = await res.json();
        return data.success ? data.data || [] : [];
      },
      priority: 'high',
      staleTime: 5 * 60 * 1000
    });

    addPrefetch({
      queryKey: ['events'],
      queryFn: async () => {
        const res = await fetch(`${API_BASE_URL}/api/events`);
        const data = await res.json();
        return data.success ? data.data || [] : [];
      },
      priority: 'high',
      staleTime: 5 * 60 * 1000
    });

    // 中優先度: ミント関連データ
    addPrefetch({
      queryKey: ['mint-collections'],
      queryFn: async () => {
        const res = await fetch(`${API_BASE_URL}/api/mint-collections`);
        const data = await res.json();
        return data.success ? data.data || [] : [];
      },
      priority: 'medium',
      staleTime: 10 * 60 * 1000
    });

    // 低優先度: 統計データ
    addPrefetch({
      queryKey: ['admin-stats'],
      queryFn: async () => {
        const res = await fetch(`${API_BASE_URL}/api/admin/stats`);
        const data = await res.json();
        return data.success ? data.data : null;
      },
      priority: 'low',
      staleTime: 15 * 60 * 1000
    });
  }, [addPrefetch]);

  // ページ遷移予測に基づくプリフェッチ
  const prefetchOnHover = useCallback((path: string) => {
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

    switch (path) {
      case '/admin/mint/events':
        addPrefetch({
          queryKey: ['admin-events'],
          queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/admin/events`);
            const data = await res.json();
            return data.success ? data.data || [] : [];
          },
          priority: 'high'
        });
        break;
        
      case '/admin/mint/history':
        addPrefetch({
          queryKey: ['mint-history'],
          queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/mint-history`);
            const data = await res.json();
            return data.success ? data.data || [] : [];
          },
          priority: 'medium'
        });
        break;
        
      case '/admin/roles':
        addPrefetch({
          queryKey: ['discord-roles'],
          queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/discord/roles`);
            const data = await res.json();
            return data.success ? data.data || [] : [];
          },
          priority: 'medium'
        });
        break;
    }
  }, [addPrefetch]);

  // 初期化
  useEffect(() => {
    // ページロード後に基本データをプリフェッチ
    const timer = setTimeout(prefetchAdminData, 1000);
    return () => clearTimeout(timer);
  }, [prefetchAdminData]);

  return {
    addPrefetch,
    prefetchOnHover,
    prefetchAdminData,
    getPrefetchStats: () => ({
      prefetched: prefetchedQueries.current.size,
      queued: prefetchQueue.current.length,
      processing: isProcessing.current
    })
  };
}
