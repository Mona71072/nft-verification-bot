import React from 'react';

interface AdminTabLayoutProps {
  title: string;
  description?: string;
  icon?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function AdminTabLayout({ title, description, icon, actions, children }: AdminTabLayoutProps) {
  return (
    <div style={{ padding: '24px 0' }}>
      {/* ヘッダー */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottom: '2px solid #e5e7eb'
      }}>
        <div>
          <h2 style={{
            fontSize: 28,
            fontWeight: 700,
            margin: 0,
            marginBottom: 8,
            color: '#111827',
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            {icon && <span style={{ fontSize: 32 }}>{icon}</span>}
            {title}
          </h2>
          {description && (
            <p style={{
              margin: 0,
              color: '#6b7280',
              fontSize: 14,
              lineHeight: 1.5
            }}>
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {actions}
          </div>
        )}
      </div>

      {/* コンテンツ */}
      <div>
        {children}
      </div>
    </div>
  );
}

interface CardProps {
  title?: string;
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'info';
  actions?: React.ReactNode;
}

export function Card({ title, children, variant = 'default', actions }: CardProps) {
  const variants = {
    default: { bg: '#ffffff', border: '#e5e7eb' },
    success: { bg: '#f0fdf4', border: '#bbf7d0' },
    warning: { bg: '#fef3c7', border: '#fde047' },
    info: { bg: '#eff6ff', border: '#bfdbfe' }
  };

  const colors = variants[variant];

  return (
    <div style={{
      background: colors.bg,
      border: `1px solid ${colors.border}`,
      borderRadius: 12,
      padding: 20,
      marginBottom: 16
    }}>
      {(title || actions) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: title ? 16 : 0,
          paddingBottom: title ? 12 : 0,
          borderBottom: title ? `1px solid ${colors.border}` : 'none'
        }}>
          {title && (
            <h3 style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              color: '#111827'
            }}>
              {title}
            </h3>
          )}
          {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, children, disabled, ...props }: ButtonProps) {
  const variants = {
    primary: { bg: '#2563eb', hover: '#1d4ed8', color: '#ffffff' },
    secondary: { bg: '#ffffff', hover: '#f3f4f6', color: '#374151' },
    danger: { bg: '#dc2626', hover: '#b91c1c', color: '#ffffff' },
    success: { bg: '#16a34a', hover: '#15803d', color: '#ffffff' }
  };

  const sizes = {
    sm: { padding: '6px 12px', fontSize: 13 },
    md: { padding: '10px 16px', fontSize: 14 },
    lg: { padding: '12px 24px', fontSize: 16 }
  };

  const colors = variants[variant];
  const sizeStyle = sizes[size];

  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading}
      style={{
        ...sizeStyle,
        background: disabled || loading ? '#9ca3af' : colors.bg,
        color: colors.color,
        border: variant === 'secondary' ? '1px solid #d1d5db' : 'none',
        borderRadius: 8,
        fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        position: 'relative',
        ...props.style
      }}
      onMouseOver={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.background = colors.hover;
        }
      }}
      onMouseOut={(e) => {
        if (!disabled && !loading) {
          e.currentTarget.style.background = colors.bg;
        }
      }}
      {...props}
    >
      {loading && (
        <div style={{
          width: 14,
          height: 14,
          border: '2px solid rgba(255,255,255,0.3)',
          borderTop: '2px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      )}
      {children}
    </button>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export function Input({ label, error, helper, ...props }: InputProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && (
        <label style={{
          display: 'block',
          marginBottom: 6,
          fontSize: 14,
          fontWeight: 600,
          color: '#374151'
        }}>
          {label}
        </label>
      )}
      <input
        style={{
          width: '100%',
          padding: '10px 14px',
          border: error ? '1px solid #dc2626' : '1px solid #d1d5db',
          borderRadius: 8,
          fontSize: 14,
          outline: 'none',
          transition: 'border-color 0.2s',
          ...props.style
        }}
        onFocus={(e) => {
          if (!error) e.currentTarget.style.borderColor = '#2563eb';
        }}
        onBlur={(e) => {
          if (!error) e.currentTarget.style.borderColor = '#d1d5db';
        }}
        {...props}
      />
      {error && (
        <div style={{ marginTop: 4, fontSize: 12, color: '#dc2626' }}>
          {error}
        </div>
      )}
      {helper && !error && (
        <div style={{ marginTop: 4, fontSize: 12, color: '#6b7280' }}>
          {helper}
        </div>
      )}
    </div>
  );
}

