import React, { useState, useEffect } from 'react';
import '@suiet/wallet-kit/style.css';
import { useWalletWithErrorHandling } from './hooks/useWallet';
import { NFTVerification } from './components/NFTVerification';
import AdminPanel from './AdminPanel';
import MintPage from './MintPage';

// APIベースURLの設定（本番環境用）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';


function App() {
  const { account, connected } = useWalletWithErrorHandling();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<'verification' | 'admin'>('verification');
  const [copied, setCopied] = useState<boolean>(false);

  // 管理者チェック（ヘッダー表示制御用）
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        if (connected && account?.address) {
          // AdminPanel から参照できるように現在のアドレスを保存
          try {
            localStorage.setItem('currentWalletAddress', account.address);
          } catch {}
          const resp = await fetch(`${API_BASE_URL}/api/admin/check/${account.address}`);
          const data = await resp.json();
          setIsAdmin(Boolean(data?.success && data?.isAdmin));
        } else {
          setIsAdmin(false);
          // 未接続時はクリア
          try {
            localStorage.removeItem('currentWalletAddress');
          } catch {}
        }
      } catch (e) {
        setIsAdmin(false);
        try {
          localStorage.removeItem('currentWalletAddress');
        } catch {}
      }
    };
    checkAdmin();
  }, [connected, account?.address]);

  // 非管理者が管理画面を開けないように制御
  useEffect(() => {
    if (currentPage === 'admin' && !isAdmin) {
      setCurrentPage('verification');
    }
  }, [currentPage, isAdmin]);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* コンパクトヘッダー（モバイル最適化） */}
      <nav style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        padding: '0.5rem 1rem',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <a href="/" style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color: '#1a1a1a',
            margin: 0,
            textDecoration: 'none',
            cursor: 'pointer'
          }}>
            SyndicateXTokyo
          </a>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* ウォレット情報表示 */}
            {connected && account?.address && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                background: '#f3f4f6',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                fontSize: '12px'
              }}>
                <span 
                  onClick={() => {
                    navigator.clipboard.writeText(account.address);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  title={account.address}
                  style={{ 
                    cursor: 'pointer', 
                    fontFamily: 'monospace',
                    fontWeight: 500
                  }}
                >
                  📍 {account.address.slice(0, 6)}...{account.address.slice(-4)}
                </span>
                {copied && <span style={{ color: '#10b981', fontSize: '11px' }}>✓</span>}
                {isAdmin && <span style={{ color: '#2563eb', fontWeight: 600 }}>🔑</span>}
              </div>
            )}
            {isAdmin && (
              <a href="/admin" style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', color: '#374151', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600 }}>管理者ページ</a>
            )}
          </div>
        </div>
      </nav>

      {/* Content */}
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '1rem',
        minHeight: 'calc(100vh - 56px)'
      }}>
        {(() => {
          try {
            if (typeof window !== 'undefined') {
              const path = window.location.pathname;
              if (path.startsWith('/mint')) return <MintPage />;
              if (path.startsWith('/admin')) {
                if (!isAdmin) {
                  return (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '60vh',
                      color: 'white',
                      textAlign: 'center'
                    }}>
                      <div>
                        <h2>アクセス拒否</h2>
                        <p>管理者権限が必要です。ウォレットを接続してください。</p>
                      </div>
                    </div>
                  );
                }
                if (path === '/admin') return <AdminPanel mode="admin" />;
                if (path.startsWith('/admin/mints')) {
                  const AdminMintPage = React.lazy(() => import('./pages/AdminMintPage'));
                  return (
                    <React.Suspense fallback={<div>Loading...</div>}>
                      <AdminMintPage />
                    </React.Suspense>
                  );
                }
                if (path === '/mint-flow') {
                  const MintFlowPage = React.lazy(() => import('./pages/MintFlowPage'));
                  return (
                    <React.Suspense fallback={<div>Loading...</div>}>
                      <MintFlowPage />
                    </React.Suspense>
                  );
                }
                if (path.startsWith('/admin/roles')) return <AdminPanel mode="roles" />;
                if (path.startsWith('/admin/mint')) return <AdminPanel mode="mint" />;
              }
            }
            return <NFTVerification />;
          } catch (error) {
            console.error('Component rendering error:', error);
            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh',
                color: 'white',
                textAlign: 'center'
              }}>
                <div>
                  <h2>コンポーネントエラー</h2>
                  <p>ページを再読み込みしてください。</p>
                  <button 
                    onClick={() => window.location.reload()}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'white',
                      color: '#667eea',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      marginTop: '1rem'
                    }}
                  >
                    再読み込み
                  </button>
                </div>
              </div>
            );
          }
        })()}
      </div>
    </div>
  );
}

export default App;