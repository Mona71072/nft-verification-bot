import React, { useState, useEffect } from 'react';
import '@mysten/dapp-kit/dist/index.css';
import { ConnectButton } from '@mysten/dapp-kit';
import { useWalletWithErrorHandling } from './hooks/useWallet';
import { NFTVerification } from './components/NFTVerification';
import AdminPanel from './AdminPanel';
import MintPage from './MintPage';
import Dashboard from './pages/Dashboard';

// APIベースURLの設定（本番環境用）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';


function App() {
  const { account, connected, disconnect, select } = useWalletWithErrorHandling() as any;
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<'verification' | 'admin'>('verification');
  const [copied, setCopied] = useState<boolean>(false);
  const [showWalletMenu, setShowWalletMenu] = useState<boolean>(false);
  const walletMenuRef = React.useRef<HTMLDivElement>(null);

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

  // クリックアウトでメニューを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (walletMenuRef.current && !walletMenuRef.current.contains(event.target as Node)) {
        setShowWalletMenu(false);
      }
    };

    if (showWalletMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showWalletMenu]);

  const handleDisconnect = async () => {
    try {
      if (typeof disconnect === 'function') {
        await disconnect();
      }
      setShowWalletMenu(false);
      setIsAdmin(false);
      try {
        localStorage.removeItem('currentWalletAddress');
      } catch {}
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  };

  const handleSwitchAccount = () => {
    setShowWalletMenu(false);
    // Suiet Wallet Kitのselect関数を使ってウォレット選択画面を開く
    if (typeof select === 'function') {
      select();
    }
  };

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
                <div style={{ position: 'relative' }} ref={walletMenuRef}>
                  <div 
                    onClick={() => setShowWalletMenu(!showWalletMenu)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '20px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: showWalletMenu ? '0 4px 12px rgba(102, 126, 234, 0.4)' : '0 2px 4px rgba(102, 126, 234, 0.2)'
                    }}
                    onMouseOver={(e) => {
                      if (!showWalletMenu) {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.3)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!showWalletMenu) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(102, 126, 234, 0.2)';
                      }
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
                    <svg 
                      width="10" 
                      height="10" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="white" 
                      strokeWidth="3"
                      style={{
                        transform: showWalletMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                      }}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                  
                  {showWalletMenu && (
                    <div style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      background: 'white',
                      borderRadius: '12px',
                      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
                      border: '1px solid #e5e7eb',
                      minWidth: '220px',
                      overflow: 'hidden',
                      zIndex: 1000,
                      animation: 'slideDown 0.2s ease-out'
                    }}>
                      <style>{`
                        @keyframes slideDown {
                          from {
                            opacity: 0;
                            transform: translateY(-10px);
                          }
                          to {
                            opacity: 1;
                            transform: translateY(0);
                          }
                        }
                      `}</style>
                      
                      {/* アドレス表示 */}
                      <div style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f3f4f6',
                        background: '#fafafa'
                      }}>
                        <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '4px', fontWeight: 600 }}>
                          CONNECTED WALLET
                        </div>
                        <div style={{
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          color: '#374151',
                          wordBreak: 'break-all'
                        }}>
                          {account.address}
                        </div>
                      </div>

                      {/* メニューアイテム */}
                      <div style={{ padding: '4px 0' }}>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(account.address);
                            setCopied(true);
                            setTimeout(() => {
                              setCopied(false);
                              setShowWalletMenu(false);
                            }, 1000);
                          }}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            border: 'none',
                            background: copied ? '#f0fdf4' : 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: copied ? '#16a34a' : '#374151',
                            transition: 'background 0.15s'
                          }}
                          onMouseOver={(e) => !copied && (e.currentTarget.style.background = '#f9fafb')}
                          onMouseOut={(e) => !copied && (e.currentTarget.style.background = 'transparent')}
                        >
                          {copied ? '✓' : '📋'}
                          <span>{copied ? 'Copied!' : 'Copy Address'}</span>
                        </button>

                        <button
                          onClick={handleSwitchAccount}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#374151',
                            transition: 'background 0.15s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          🔄
                          <span>Switch Account</span>
                        </button>

                        <div style={{ height: '1px', background: '#f3f4f6', margin: '4px 0' }} />

                        <button
                          onClick={handleDisconnect}
                          style={{
                            width: '100%',
                            padding: '10px 16px',
                            border: 'none',
                            background: 'transparent',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#ef4444',
                            transition: 'background 0.15s'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.background = '#fef2f2'}
                          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          🚪
                          <span>Disconnect</span>
                        </button>
                      </div>
                    </div>
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