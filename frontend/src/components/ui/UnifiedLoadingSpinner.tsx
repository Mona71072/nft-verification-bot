import React from 'react';

interface UnifiedLoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
  fullScreen?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const sizeMap = {
  small: '1.5rem',
  medium: '2.5rem',
  large: '3.5rem'
};

const borderSizeMap = {
  small: '2px',
  medium: '3px',
  large: '4px'
};

/**
 * Unified loading spinner component
 * - Inline style version (no Tailwind CSS dependency)
 * - Accessibility compliant
 */
export function UnifiedLoadingSpinner({ 
  size = 'medium', 
  message,
  fullScreen = false,
  className = '', 
  style = {} 
}: UnifiedLoadingSpinnerProps) {
  const spinnerSize = sizeMap[size];
  const borderSize = borderSizeMap[size];

  const spinnerStyle: React.CSSProperties = {
    width: spinnerSize,
    height: spinnerSize,
    border: `${borderSize} solid rgba(79, 70, 229, 0.2)`,
    borderTop: `${borderSize} solid rgba(79, 70, 229, 0.9)`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    display: 'inline-block',
    ...style
  };

  const containerStyle: React.CSSProperties = fullScreen ? {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999
  } : {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    padding: '2rem'
  };

  return (
    <>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div 
        role="status"
        aria-live="polite"
        aria-label={message || 'Loading'}
        className={className}
        style={containerStyle}
      >
        <div style={spinnerStyle} />
        {message && (
          <p style={{
            color: fullScreen ? '#ffffff' : '#64748b',
            fontSize: size === 'small' ? '0.875rem' : size === 'medium' ? '1rem' : '1.125rem',
            fontWeight: 500,
            margin: 0
          }}>
            {message}
          </p>
        )}
      </div>
    </>
  );
}

