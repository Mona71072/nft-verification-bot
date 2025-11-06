import React from 'react';

interface UnifiedErrorDisplayProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  variant?: 'error' | 'warning' | 'info';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Unified error display component (inline style version)
 * - No Tailwind CSS dependency
 * - Accessibility compliant
 */
export function UnifiedErrorDisplay({
  title = 'An error occurred',
  message,
  onRetry,
  onDismiss,
  variant = 'error',
  className = '',
  style = {}
}: UnifiedErrorDisplayProps) {
  const variantStyles = {
    error: {
      background: 'rgba(220, 38, 38, 0.1)',
      borderColor: 'rgba(220, 38, 38, 0.5)',
      textColor: '#dc2626',
      titleColor: '#991b1b',
      icon: '⚠️'
    },
    warning: {
      background: 'rgba(245, 158, 11, 0.1)',
      borderColor: 'rgba(245, 158, 11, 0.5)',
      textColor: '#f59e0b',
      titleColor: '#92400e',
      icon: '⚠️'
    },
    info: {
      background: 'rgba(59, 130, 246, 0.1)',
      borderColor: 'rgba(59, 130, 246, 0.5)',
      textColor: '#3b82f6',
      titleColor: '#1e40af',
      icon: 'ℹ️'
    }
  };

  const styles = variantStyles[variant];

  const containerStyle: React.CSSProperties = {
    background: styles.background,
    border: `1px solid ${styles.borderColor}`,
    borderRadius: '8px',
    padding: '1rem',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.75rem',
    ...style
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    border: `1px solid ${styles.borderColor}`,
    background: 'white',
    color: styles.textColor,
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: 600,
    transition: 'all 0.2s'
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={className}
      style={containerStyle}
    >
      <div style={{ fontSize: '1.25rem', flexShrink: 0 }}>{styles.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{
          margin: '0 0 0.5rem 0',
          fontSize: '1rem',
          fontWeight: 600,
          color: styles.titleColor
        }}>
          {title}
        </h3>
        <p style={{
          margin: 0,
          fontSize: '0.875rem',
          color: styles.textColor,
          lineHeight: 1.5
        }}>
          {message}
        </p>
        {(onRetry || onDismiss) && (
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginTop: '0.75rem',
            flexWrap: 'wrap'
          }}>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                aria-label="Retry"
                style={buttonStyle}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = styles.background;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'white';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                🔄 Retry
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Close"
                style={{
                  ...buttonStyle,
                  background: 'transparent',
                  border: 'none',
                  padding: '0.25rem'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.opacity = '0.7';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

