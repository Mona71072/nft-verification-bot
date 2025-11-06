import React from 'react';

interface CollectionTypeFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function CollectionTypeFilter({
  value,
  onChange,
  placeholder = "コレクション型 (typePath)",
  className = '',
  style = {}
}: CollectionTypeFilterProps) {
  const defaultStyle: React.CSSProperties = {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #e5e7eb',
    flex: '1 1 360px',
    fontSize: 14,
    outline: 'none',
    transition: 'border-color 0.2s',
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
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={defaultStyle}
        onFocus={(e) => {
          e.target.style.borderColor = '#3b82f6';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#e5e7eb';
        }}
      />
    </div>
  );
}
