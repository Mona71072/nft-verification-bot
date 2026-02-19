import React, { useEffect, useState } from 'react';

interface MintCollection {
  id: string;
  name: string;
  typePath?: string;
  packageId?: string;
}

interface CollectionTypeFilterProps {
  value: string;
  onChange: (value: string) => void;
  apiBaseUrl?: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function CollectionTypeFilter({
  value,
  onChange,
  apiBaseUrl,
  placeholder = "コレクションを選択",
  className = '',
  style = {}
}: CollectionTypeFilterProps) {
  const [collections, setCollections] = useState<MintCollection[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!apiBaseUrl) return;
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${apiBaseUrl}/api/mint-collections`);
        const data = await res.json();
        if (!ignore && data.success) {
          const cols: MintCollection[] = data.data || [];
          setCollections(cols);
          if (!value && cols.length > 0) {
            onChange(cols[0].typePath || cols[0].packageId || '');
          }
        }
      } catch {
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [apiBaseUrl]);

  const selectStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    flex: '1 1 360px',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
    background: 'white',
    cursor: 'pointer',
    ...style
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginBottom: 12
  };

  return (
    <div style={containerStyle} className={className}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={selectStyle}
        aria-label={placeholder}
        disabled={loading}
      >
        {loading ? (
          <option value="">読み込み中...</option>
        ) : collections.length === 0 ? (
          <option value="">コレクションが見つかりません</option>
        ) : (
          <>
            <option value="">{placeholder}</option>
            {collections.map((col) => (
              <option key={col.id} value={col.typePath || col.packageId || ''}>
                {col.name} ({(col.typePath || col.packageId || '').split('::').pop()})
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
