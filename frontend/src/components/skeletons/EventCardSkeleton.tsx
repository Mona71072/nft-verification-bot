import React from 'react';

interface EventCardSkeletonProps {
  count?: number;
}

export function EventCardSkeleton({ count = 1 }: EventCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}
        >
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
            {/* 画像スケルトン */}
            <div
              style={{
                width: '80px',
                height: '80px',
                background: '#f3f4f6',
                borderRadius: '8px',
                flexShrink: 0
              }}
            />
            
            {/* コンテンツスケルトン */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: '1.25rem',
                  background: '#e5e7eb',
                  borderRadius: '4px',
                  marginBottom: '0.5rem',
                  width: '60%'
                }}
              />
              <div
                style={{
                  height: '1rem',
                  background: '#e5e7eb',
                  borderRadius: '4px',
                  marginBottom: '0.5rem',
                  width: '40%'
                }}
              />
              <div
                style={{
                  height: '0.875rem',
                  background: '#e5e7eb',
                  borderRadius: '4px',
                  width: '30%'
                }}
              />
            </div>
          </div>
          
          {/* ボタンスケルトン */}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <div
              style={{
                height: '2rem',
                background: '#e5e7eb',
                borderRadius: '6px',
                width: '80px'
              }}
            />
            <div
              style={{
                height: '2rem',
                background: '#e5e7eb',
                borderRadius: '6px',
                width: '60px'
              }}
            />
          </div>
        </div>
      ))}
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </>
  );
}
