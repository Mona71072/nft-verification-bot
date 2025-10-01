import React from 'react';
import { MintTable } from '../components/MintTable';
import { useMints, type MintQuery, type MintRecord, retryMints } from '../hooks/useMints';
import { ToastProvider, useToast } from '../components/ui/ToastProvider';
import KeyboardShortcutsHelp from '../components/KeyboardShortcutsHelp';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

function AdminMintPageInner() {
  const { showToast } = useToast();
  // URL から初期クエリを復元
  const initialQuery = React.useMemo<MintQuery>(() => {
    const sp = new URLSearchParams(window.location.search);
    return {
      q: sp.get('q') || undefined,
      status: (sp.get('status') as any) || 'all',
      collectionType: sp.get('collectionType') || '',
      from: sp.get('from') || undefined,
      to: sp.get('to') || undefined,
      pageSize: Number(sp.get('pageSize') || 50)
    };
  }, []);

  const [query, setQuery] = React.useState<MintQuery>(initialQuery);

  // クエリ変更時にURLへ反映（共有可能に）
  React.useEffect(() => {
    const sp = new URLSearchParams();
    if (query.q) sp.set('q', query.q);
    if (query.status && query.status !== 'all') sp.set('status', query.status);
    if (query.collectionType) sp.set('collectionType', query.collectionType);
    if (query.from) sp.set('from', query.from);
    if (query.to) sp.set('to', query.to);
    if (query.pageSize) sp.set('pageSize', String(query.pageSize));
    const s = sp.toString();
    const url = s ? `${window.location.pathname}?${s}` : window.location.pathname;
    window.history.replaceState(null, '', url);
  }, [query]);

  const { data, loading, error } = useMints(API_BASE_URL, query);

  // 管理者判定（再試行ボタンの表示制御）
  const [isAdmin, setIsAdmin] = React.useState(false);
  React.useEffect(() => {
    (async () => {
      try {
        const addr = (window as any).currentWalletAddress || undefined;
        // 可能なら wallet hook から取得
        const fallback = (window as any).lastAdminAddress;
        const target = addr || fallback;
        if (!target) return;
        const r = await fetch(`${API_BASE_URL}/api/admin/check/${target}`);
        const j = await r.json().catch(() => null);
        setIsAdmin(Boolean(j?.success && j?.isAdmin));
      } catch {}
    })();
  }, []);

  const onRetry = React.useCallback(async (rec: MintRecord) => {
    try {
      showToast('再試行を開始しました…', 'info');
      const res = await fetch(`${API_BASE_URL}/api/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: rec.eventId,
          address: rec.recipient,
          // 実運用では必要な署名パラメータ等を別導線で用意
        })
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'failed');
      showToast('再試行が完了しました', 'success');
    } catch (e: any) {
      showToast(`再試行に失敗: ${e?.message || 'error'}`, 'error');
    }
  }, [showToast]);

  const onRetryBulk = React.useCallback(async (recs: MintRecord[]) => {
    const ctrl = showProgress('一括再試行を開始…', 'info');
    try {
      const result = await retryMints(API_BASE_URL, recs, (ok, ng, total) => {
        ctrl.update(`再試行中… 成功 ${ok}/${total} 失敗 ${ng}`, ng > 0 ? 'error' : 'info');
      });
      ctrl.update(`完了: 成功 ${result.ok}/${result.total} 失敗 ${result.ng}`, result.ng > 0 ? 'error' : 'success');
      setTimeout(() => ctrl.close(), 2500);
    } catch (e: any) {
      ctrl.update(`一括再試行でエラー: ${e?.message || 'error'}`, 'error');
      setTimeout(() => ctrl.close(), 2500);
    }
  }, [showProgress]);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>ミント管理</h2>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input
          placeholder="コレクション型 (typePath)"
          value={query.collectionType || ''}
          onChange={(e) => setQuery((q) => ({ ...q, collectionType: e.target.value }))}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', flex: '1 1 360px' }}
        />
      </div>

      <MintTable
        records={data}
        loading={loading}
        error={error}
        query={query}
        onQueryChange={setQuery}
        onRetry={onRetry}
        onRetryBulk={isAdmin ? onRetryBulk : undefined}
        isAdmin={isAdmin}
      />
      <KeyboardShortcutsHelp />
    </div>
  );
}

export default function AdminMintPage() {
  return (
    <ToastProvider>
      <AdminMintPageInner />
    </ToastProvider>
  );
}


