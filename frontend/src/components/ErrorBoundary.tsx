import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Reactエラーバウンダリコンポーネント
 * 子コンポーネントで発生したエラーをキャッチし、フォールバックUIを表示
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // エラーログはコンソールに出力（本番環境でのデバッグ用）
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // カスタムフォールバックが提供されている場合は使用
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // デフォルトのフォールバックUI
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
          padding: '2rem'
        }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
              エラーが発生しました
            </h1>
            <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>
              申し訳ありませんが、問題が発生しました。
            </p>
            <button 
              type="button"
              onClick={this.handleReload}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem'
              }}
            >
              ページを再読み込み
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

