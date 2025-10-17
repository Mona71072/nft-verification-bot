import { useState, useEffect, useCallback, useRef } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  version: string;
}

interface UseAdvancedCacheOptions {
  ttl?: number; // Time to live in milliseconds
  version?: string; // Cache version for invalidation
  maxSize?: number; // Maximum cache entries
  enablePersistentCache?: boolean; // Enable localStorage persistence
}

export function useAdvancedCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseAdvancedCacheOptions = {}
) {
  const {
    ttl = 5 * 60 * 1000, // 5 minutes default
    version = '1.0.0',
    maxSize = 100,
    enablePersistentCache = true
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cacheRef = useRef<Map<string, CacheEntry<T>>>(new Map());
  const lastFetchRef = useRef<number>(0);

  // キャッシュの永続化
  const saveToStorage = useCallback((cache: Map<string, CacheEntry<T>>) => {
    if (!enablePersistentCache) return;
    
    try {
      const cacheArray = Array.from(cache.entries());
      localStorage.setItem(`cache_${key}`, JSON.stringify(cacheArray));
    } catch (e) {
      console.warn('Failed to save cache to localStorage:', e);
    }
  }, [key, enablePersistentCache]);

  // キャッシュの復元
  const loadFromStorage = useCallback(() => {
    if (!enablePersistentCache) return;
    
    try {
      const stored = localStorage.getItem(`cache_${key}`);
      if (stored) {
        const cacheArray = JSON.parse(stored);
        cacheRef.current = new Map(cacheArray);
      }
    } catch (e) {
      console.warn('Failed to load cache from localStorage:', e);
    }
  }, [key, enablePersistentCache]);

  // キャッシュのクリーンアップ
  const cleanupCache = useCallback(() => {
    const now = Date.now();
    const cache = cacheRef.current;
    
    // TTL切れのエントリを削除
    for (const [k, v] of cache.entries()) {
      if (now - v.timestamp > v.ttl) {
        cache.delete(k);
      }
    }
    
    // サイズ制限の適用
    if (cache.size > maxSize) {
      const entries = Array.from(cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toDelete = entries.slice(0, cache.size - maxSize);
      toDelete.forEach(([k]) => cache.delete(k));
    }
    
    saveToStorage(cache);
  }, [maxSize, saveToStorage]);

  // データの取得
  const fetchData = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    const cache = cacheRef.current;
    const cacheKey = `${key}_${version}`;
    
    // キャッシュから取得を試行
    if (!forceRefresh && cache.has(cacheKey)) {
      const entry = cache.get(cacheKey)!;
      if (now - entry.timestamp < entry.ttl) {
        setData(entry.data);
        return entry.data;
      }
    }
    
    // ネットワークリクエスト
    setLoading(true);
    setError(null);
    
    try {
      const result = await fetcher();
      const entry: CacheEntry<T> = {
        data: result,
        timestamp: now,
        ttl,
        version
      };
      
      cache.set(cacheKey, entry);
      setData(result);
      lastFetchRef.current = now;
      
      cleanupCache();
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [key, version, ttl, fetcher, cleanupCache]);

  // キャッシュの無効化
  const invalidate = useCallback(() => {
    cacheRef.current.clear();
    setData(null);
    lastFetchRef.current = 0;
  }, []);

  // 特定バージョンのキャッシュ無効化
  const invalidateVersion = useCallback((targetVersion: string) => {
    const cache = cacheRef.current;
    for (const [k, v] of cache.entries()) {
      if (v.version === targetVersion) {
        cache.delete(k);
      }
    }
    saveToStorage(cache);
  }, [saveToStorage]);

  // キャッシュ統計
  const getCacheStats = useCallback(() => {
    const cache = cacheRef.current;
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;
    
    for (const [, entry] of cache.entries()) {
      if (now - entry.timestamp < entry.ttl) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }
    
    return {
      totalEntries: cache.size,
      validEntries,
      expiredEntries,
      lastFetch: lastFetchRef.current
    };
  }, []);

  // 初期化
  useEffect(() => {
    loadFromStorage();
    fetchData();
  }, [loadFromStorage, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: () => fetchData(true),
    invalidate,
    invalidateVersion,
    getCacheStats,
    isStale: Date.now() - lastFetchRef.current > ttl
  };
}
