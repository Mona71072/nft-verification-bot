import { useEffect, useMemo, useState } from 'react';

export type MintStatus = 'success' | 'failed' | 'pending';

export interface MintRecord {
  txDigest: string;
  objectIds?: string[];
  eventId?: string;
  collectionType?: string;
  recipient?: string;
  at?: string;
  status?: MintStatus;
}

export interface MintQuery {
  q?: string; // address / objectId / eventId
  status?: MintStatus | 'all';
  collectionType?: string;
  from?: string; // ISO date string
  to?: string;   // ISO date string
  page?: number;
  pageSize?: number;
}

export function useMints(apiBase: string, query: MintQuery) {
  const [data, setData] = useState<MintRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const u = new URLSearchParams();
    if (query.q) u.set('q', query.q);
    if (query.status && query.status !== 'all') u.set('status', query.status);
    if (query.collectionType) u.set('collectionType', query.collectionType);
    if (query.from) u.set('from', query.from);
    if (query.to) u.set('to', query.to);
    if (query.page) u.set('page', String(query.page));
    if (query.pageSize) u.set('pageSize', String(query.pageSize));
    return u.toString();
  }, [query]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // 既存エンドポイントの組み合わせ: コレクション別ミント履歴を使う
        // query.collectionType が無ければ最新の typePath をUI側で選択して渡す想定
        const typePath = query.collectionType || '';
        if (!typePath) {
          setData([]);
          setLoading(false);
          return;
        }
        const url = `${apiBase}/api/mint-collections/${encodeURIComponent(typePath)}/mints?limit=${query.pageSize || 50}`;
        const res = await fetch(url);
        const json = await res.json();
        if (!ignore) {
          if (json.success) {
            const items: MintRecord[] = (json.data || []).map((x: any) => ({
              txDigest: x.txDigest,
              objectIds: x.objectIds,
              eventId: x.eventId,
              collectionType: x.collectionType,
              recipient: x.recipient,
              at: x.at,
              status: 'success' // 既存ログは成功時記録が中心。将来的に失敗も拡張
            }));
            // 簡易検索/期間フィルタ（クライアント側）
            const filtered = items.filter((it) => {
              if (query.q) {
                const ql = query.q.toLowerCase();
                const hit = (it.txDigest?.toLowerCase().includes(ql)) ||
                  (it.objectIds || []).some((id) => String(id).toLowerCase().includes(ql)) ||
                  (it.recipient || '').toLowerCase().includes(ql) ||
                  (it.eventId || '').toLowerCase().includes(ql);
                if (!hit) return false;
              }
              if (query.from && it.at) {
                if (new Date(it.at).getTime() < new Date(query.from).getTime()) return false;
              }
              if (query.to && it.at) {
                if (new Date(it.at).getTime() > new Date(query.to).getTime()) return false;
              }
              return true;
            });
            setData(filtered);
          } else {
            setError(json.error || 'Failed to load mints');
          }
        }
      } catch (e: any) {
        if (!ignore) setError(e?.message || 'Failed to load mints');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [apiBase, params, query.collectionType, query.pageSize]);

  return { data, loading, error };
}

export async function retryMint(apiBase: string, rec: MintRecord): Promise<boolean> {
  const res = await fetch(`${apiBase}/api/mint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId: rec.eventId, address: rec.recipient })
  });
  const json = await res.json().catch(() => null);
  return Boolean(res.ok && json?.success);
}

export async function retryMints(apiBase: string, recs: MintRecord[], onProgress?: (ok: number, ng: number, total: number) => void) {
  let ok = 0, ng = 0;
  const total = recs.length;
  for (const r of recs) {
    const success = await retryMint(apiBase, r).catch(() => false);
    if (success) ok++; else ng++;
    if (onProgress) onProgress(ok, ng, total);
  }
  return { ok, ng, total };
}


