import React, { useState, useEffect } from 'react';
import '@suiet/wallet-kit/style.css';
import { ConnectButton } from '@suiet/wallet-kit';
import { useWalletWithErrorHandling } from './hooks/useWallet';
import { NFTVerification } from './components/NFTVerification';
import AdminPanel from './AdminPanel';
import MintPage from './MintPage';
import Dashboard from './pages/Dashboard';

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {connected && account?.address ? (
              <>
                <div 
                  onClick={() => {
                    navigator.clipboard.writeText(account.address);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  title={`${account.address}\nClick to copy`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 10px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 4px rgba(102, 126, 234, 0.2)'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.3)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.2)';
                  }}
                >
                  <span style={{ 
                    fontFamily: 'monospace', 
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'white',
                    letterSpacing: '0.5px'
                  }}>
                    {account.address.slice(0, 4)}...{account.address.slice(-4)}
                  </span>
                  {copied ? (
                    <span style={{ fontSize: '10px' }}>✓</span>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                  )}
                </div>
                {isAdmin && (
                  <a 
                    href="/admin" 
                    style={{ 
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 10px',
                      background: '#2563eb',
                      borderRadius: '20px',
                      color: 'white',
                      textDecoration: 'none',
                      fontSize: '11px',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#1d4ed8';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(37, 99, 235, 0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = '#2563eb';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(37, 99, 235, 0.2)';
                    }}
                  >
                    <span style={{ fontSize: '12px' }}>🔑</span>
                    <span>Admin</span>
                  </a>
                )}
              </>
            ) : (
              <ConnectButton 
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(102, 126, 234, 0.2)'
                }}
              >
                Connect
              </ConnectButton>
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
              if (path === '/Verification') return <NFTVerification />;
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
            return <Dashboard />;
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