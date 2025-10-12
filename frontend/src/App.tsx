import React, { useState, useEffect } from 'react';
import '@mysten/dapp-kit/dist/index.css';
import { ConnectButton, ConnectModal } from '@mysten/dapp-kit';
import { useWalletWithErrorHandling } from './hooks/useWallet';
import { NFTVerification } from './components/NFTVerification';
import AdminPanel from './AdminPanel';
import MintPage from './MintPage';
import Dashboard from './pages/Dashboard';

// APIベースURLの設定（本番環境用）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';


function App() {
  const { account, connected } = useWalletWithErrorHandling() as any;
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<'verification' | 'admin'>('verification');
  const [renderKey, setRenderKey] = useState<number>(0);

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

  // URLとcurrentPageの同期（ブラウザの戻る/進むボタン対応）
  useEffect(() => {
    const syncPageFromUrl = () => {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path.startsWith('/admin')) {
          setCurrentPage('admin');
        } else {
          setCurrentPage('verification');
        }
        // 強制的に再レンダリング
        setRenderKey(prev => prev + 1);
      }
    };

    // 初期ロード時
    syncPageFromUrl();

    // ブラウザの戻る/進むボタン
    window.addEventListener('popstate', syncPageFromUrl);
    return () => window.removeEventListener('popstate', syncPageFromUrl);
  }, []);

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
          <div 
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', '/');
                setCurrentPage('verification');
              }
            }}
            style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: '#1a1a1a',
              margin: 0,
              cursor: 'pointer'
            }}
          >
            SyndicateXTokyo
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* 公式ConnectButton（Copy/Switch/Disconnect機能を内蔵） */}
            <ConnectButton />
            
            {/* 管理者バッジ */}
            {isAdmin && connected && (
              <button 
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.history.pushState({}, '', '/admin');
                    setCurrentPage('admin');
                  }
                }}
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  background: '#2563eb',
                  borderRadius: '20px',
                  color: 'white',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
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
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* 公式のマルチウォレット選択モーダル */}
      <ConnectModal />

      {/* Content */}
      <div 
        key={renderKey}
        style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '1rem',
          minHeight: 'calc(100vh - 56px)'
        }}
      >
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