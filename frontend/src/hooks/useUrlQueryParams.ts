import { useState, useEffect, useMemo } from 'react';
import type { MintQuery } from './useMints';

export function useUrlQueryParams(): [MintQuery, (query: MintQuery | ((prev: MintQuery) => MintQuery)) => void] {
  // URLから初期クエリを復元
  const initialQuery = useMemo<MintQuery>(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return {
      q: searchParams.get('q') || undefined,
      status: (searchParams.get('status') as any) || 'all',
      collectionType: searchParams.get('collectionType') || '',
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      pageSize: Number(searchParams.get('pageSize') || 50)
    };
  }, []);

  const [query, setQuery] = useState<MintQuery>(initialQuery);

  // クエリ変更時にURLへ反映（共有可能に）
  useEffect(() => {
    const searchParams = new URLSearchParams();
    
    if (query.q) searchParams.set('q', query.q);
    if (query.status && query.status !== 'all') searchParams.set('status', query.status);
    if (query.collectionType) searchParams.set('collectionType', query.collectionType);
    if (query.from) searchParams.set('from', query.from);
    if (query.to) searchParams.set('to', query.to);
    if (query.pageSize) searchParams.set('pageSize', String(query.pageSize));

    const queryString = searchParams.toString();
    const newUrl = queryString 
      ? `${window.location.pathname}?${queryString}` 
      : window.location.pathname;
    
    window.history.replaceState(null, '', newUrl);
  }, [query]);

  return [query, setQuery];
}
