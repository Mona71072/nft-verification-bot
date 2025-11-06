import React from 'react';

interface AdminPageLayoutProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function AdminPageLayout({ 
  children, 
  className = '', 
  style = {} 
}: AdminPageLayoutProps) {
  const defaultStyle: React.CSSProperties = {
    padding: 16,
    minHeight: '100vh',
    backgroundColor: '#f9fafb',
    ...style
  };

  return (
    <div style={defaultStyle} className={className}>
      {children}
    </div>
  );
}
