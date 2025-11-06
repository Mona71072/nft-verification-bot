import React from 'react';
import type { MintRecord, MintQuery } from '../hooks/useMints';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useKeyboardShortcut } from '../hooks/useKeyboard';

interface Props {
  records: MintRecord[];
  loading: boolean;
  error?: string | null;
  query: MintQuery;
  onQueryChange: (next: MintQuery) => void;
  onRetry: (rec: MintRecord) => void;
  onRetryBulk?: (recs: MintRecord[]) => void;
  isAdmin?: boolean;
}

export const MintTable: React.FC<Props> = ({ records, loading, error, query, onQueryChange, onRetry, onRetryBulk, isAdmin }) => {
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const allChecked = records.length > 0 && records.every((r) => checked[r.txDigest]);
  const anyChecked = records.some((r) => checked[r.txDigest]);

  // ソート状態
  const [sortKey, setSortKey] = React.useState<'at' | 'status' | undefined>('at');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

  // 詳細パネル
  const [detail, setDetail] = React.useState<MintRecord | null>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // キーボードショートカット
  useKeyboardShortcut({
    key: 'k',
    ctrl: true,
    action: () => searchInputRef.current?.focus(),
    description: '検索フォーカス'
  });

  useKeyboardShortcut({
    key: 'Escape',
    action: () => setDetail(null),
    description: '詳細パネルを閉じる'
  });

  const rows = React.useMemo(() => {
    const arr = [...records];
    if (!sortKey) return arr;
    arr.sort((a, b) => {
      if (sortKey === 'at') {
        const ta = a.at ? new Date(a.at).getTime() : 0;
        const tb = b.at ? new Date(b.at).getTime() : 0;
        return sortDir === 'asc' ? ta - tb : tb - ta;
      }
      if (sortKey === 'status') {
        const order = { success: 2, pending: 1, failed: 0 } as any;
        const sa = order[a.status || 'pending'] ?? 0;
        const sb = order[b.status || 'pending'] ?? 0;
        return sortDir === 'asc' ? sa - sb : sb - sa;
      }
      return 0;
    });
    return arr;
  }, [records, sortKey, sortDir]);

  const parentRef = React.useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 10
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          ref={searchInputRef}
          value={query.q || ''}
          onChange={(e) => onQueryChange({ ...query, q: e.target.value })}
          placeholder="tx/objectId/address/eventId (Ctrl+K)"
          aria-label="検索"
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', flex: '1 1 280px' }}
        />
        <input
          type="date"
          value={query.from || ''}
          onChange={(e) => onQueryChange({ ...query, from: e.target.value })}
          aria-label="開始日"
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <input
          type="date"
          value={query.to || ''}
          onChange={(e) => onQueryChange({ ...query, to: e.target.value })}
          aria-label="終了日"
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <select
          value={query.status || 'all'}
          onChange={(e) => onQueryChange({ ...query, status: e.target.value as any })}
          aria-label="ステータスフィルター"
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb' }}
        >
          <option value="all">すべて</option>
          <option value="success">成功</option>
          <option value="failed">失敗</option>
          <option value="pending">保留</option>
        </select>
      </div>

      {loading && <div style={{ color: '#64748b' }}>読み込み中...</div>}
      {error && <div style={{ color: '#dc2626' }}>エラー: {error}</div>}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          disabled={!anyChecked || !isAdmin}
          onClick={() => {
            if (!onRetryBulk) return;
            const target = records.filter((r) => checked[r.txDigest]);
            onRetryBulk(target);
          }}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: anyChecked && isAdmin ? '#eef2ff' : 'white', cursor: anyChecked && isAdmin ? 'pointer' : 'not-allowed' }}
        >
          🔄 選択を再試行
        </button>
        <button
          onClick={() => downloadCsv(rows)}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}
        >
          ⬇️ CSVエクスポート
        </button>
      </div>

      {/* ヘッダー（固定） */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '40px 170px 160px 220px 240px 260px 120px 120px',
        gap: 0,
        background: '#f8fafc',
        border: '1px solid #e5e7eb',
        borderBottom: 'none',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
        padding: '10px 12px'
      }}>
        <div><input type="checkbox" checked={allChecked} onChange={(e) => {
          const next: Record<string, boolean> = {};
          if (e.target.checked) rows.forEach((r) => { next[r.txDigest] = true; });
          setChecked(next);
        }} /></div>
        <div style={headCell}>
          <button style={headBtn} onClick={() => {
            if (sortKey === 'at') setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
            setSortKey('at');
          }}>
            日時 {sortKey === 'at' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
          </button>
        </div>
        <div style={headCell}>イベント</div>
        <div style={headCell}>コレクション</div>
        <div style={headCell}>アドレス</div>
        <div style={headCell}>オブジェクトID</div>
        <div style={headCell}>
          <button style={headBtn} onClick={() => {
            if (sortKey === 'status') setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
            setSortKey('status');
          }}>
            状態 {sortKey === 'status' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
          </button>
        </div>
        <div style={headCell}>操作</div>
      </div>

      {/* 本体（仮想スクロール） */}
      <div ref={parentRef} style={{ height: 600, overflow: 'auto', border: '1px solid #e5e7eb', borderTop: 'none', borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }}>
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((v) => {
            const r = rows[v.index];
            return (
              <div
                key={r.txDigest}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${v.start}px)`
                }}
              >
                <div
                  onClick={() => setDetail(r)}
                  style={{ display: 'grid', gridTemplateColumns: '40px 170px 160px 220px 240px 260px 120px 120px', padding: '10px 12px', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}
                >
                  <div><input type="checkbox" onClick={(e) => e.stopPropagation()} checked={!!checked[r.txDigest]} onChange={(e) => setChecked((prev) => ({ ...prev, [r.txDigest]: e.target.checked }))} /></div>
                  <div style={cell}>{r.at ? new Date(r.at).toLocaleString() : '-'}</div>
                  <div style={cell}>{r.eventId || '-'}</div>
                  <div style={cell}>{r.collectionType || '-'}</div>
                  <div style={cell}><code>{r.recipient || '-'}</code></div>
                  <div style={cell}>
                    {(r.objectIds || []).slice(0, 2).map((id, idx) => (
                      <div key={idx}><code>{id}</code></div>
                    ))}
                  </div>
                  <div style={cell}>{statusBadge(r.status)}</div>
                  <div style={cell}>
                    {isAdmin ? <button onClick={(e) => { e.stopPropagation(); onRetry(r); }} style={retryBtn}>🔄 再試行</button> : '-'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {detail && (
        <div style={detailWrap} role="dialog" aria-modal="true" aria-labelledby="detail-title" onClick={(e) => {
          if (e.target === e.currentTarget) setDetail(null);
        }}>
          <div style={detailPanel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div id="detail-title" style={{ fontWeight: 700 }}>詳細</div>
              <button onClick={() => setDetail(null)} style={closeBtn} aria-label="閉じる">✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', rowGap: 8, columnGap: 12 }}>
              <div style={label}>日時</div><div>{detail.at ? new Date(detail.at).toLocaleString() : '-'}</div>
              <div style={label}>イベント</div><div>{detail.eventId || '-'}</div>
              <div style={label}>コレクション</div><div>{detail.collectionType || '-'}</div>
              <div style={label}>アドレス</div><div><code>{detail.recipient || '-'}</code></div>
              <div style={label}>txDigest</div><div><code>{detail.txDigest}</code></div>
              <div style={label}>オブジェクトID</div>
              <div>
                {(detail.objectIds || []).map((id, i) => (<div key={i}><code>{id}</code></div>))}
              </div>
              <div style={label}>状態</div><div>{statusBadge(detail.status)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const headCell: React.CSSProperties = { fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' };
const cell: React.CSSProperties = { whiteSpace: 'nowrap' };
const retryBtn: React.CSSProperties = { padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' };

const headBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: '#475569', fontWeight: 600, cursor: 'pointer' };

function statusBadge(status?: 'success' | 'failed' | 'pending') {
  const base: React.CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: 'white' };
  if (status === 'success') return <span style={{ ...base, background: '#16a34a' }}>成功</span>;
  if (status === 'failed') return <span style={{ ...base, background: '#dc2626' }}>失敗</span>;
  if (status === 'pending') return <span style={{ ...base, background: '#2563eb' }}>保留</span>;
  return <span style={{ ...base, background: '#64748b' }}>-</span>;
}

function downloadCsv(rows: MintRecord[]) {
  const header = ['at', 'eventId', 'collectionType', 'recipient', 'txDigest', 'objectIds', 'status'];
  const escape = (v: any) => {
    const s = (v ?? '').toString();
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    const line = [
      r.at || '',
      r.eventId || '',
      r.collectionType || '',
      r.recipient || '',
      r.txDigest,
      (r.objectIds || []).join('|'),
      r.status || ''
    ].map(escape).join(',');
    lines.push(line);
  }
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const blob = new Blob([bom, lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mints.csv';
  a.click();
  URL.revokeObjectURL(url);
}

const detailWrap: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.35)', display: 'flex', justifyContent: 'flex-end', alignItems: 'stretch', zIndex: 10000 };
const detailPanel: React.CSSProperties = { width: 480, maxWidth: '90vw', background: 'white', padding: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.35)' };
const closeBtn: React.CSSProperties = { border: '1px solid #e5e7eb', background: 'white', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' };
const label: React.CSSProperties = { color: '#64748b', fontWeight: 500 };

// function statusCell(status?: 'success' | 'failed' | 'pending') {
//   if (status === 'success') return '✅ 成功';
//   if (status === 'failed') return '❌ 検証エラー';
//   if (status === 'pending') return '⏳ Sponsor待ち';
//   return '-';
// }


