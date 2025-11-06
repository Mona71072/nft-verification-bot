import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function PageHeader({ 
  title, 
  subtitle, 
  className = '', 
  style = {} 
}: PageHeaderProps) {
  const defaultStyle: React.CSSProperties = {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 12,
    ...style
  };

  return (
    <div className={className}>
      <h2 style={defaultStyle}>{title}</h2>
      {subtitle && (
        <p style={{ 
          fontSize: 14, 
          color: '#6b7280', 
          marginTop: 4, 
          marginBottom: 0 
        }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
