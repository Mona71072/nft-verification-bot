import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import '@mysten/dapp-kit/dist/index.css';
import { ConnectButton } from '@mysten/dapp-kit';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useWalletWithErrorHandling } from './hooks/useWallet';
import { useResponsive, getResponsiveValue } from './hooks/useResponsive';
import { UnifiedLoadingSpinner } from './components/ui/UnifiedLoadingSpinner';

// 主要コンポーネントを遅延読み込み（コード分割）
const HomePage = lazy(() => import('./pages/HomePage'));
const NFTVerificationPage = lazy(() => import('./components/NFTVerificationPage').then(m => ({ default: m.NFTVerificationPage })));
const MintPage = lazy(() => import('./MintPage'));

// APIベースURLの設定（本番環境用）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';


function App() {
  // ウォレット接続を安全に取得（プロバイダーが存在しない場合はデフォルト値を使用）
  let account: { address: string } | null = null;
  let connected = false;
  
  try {
    const walletState = useWalletWithErrorHandling();
    account = (walletState?.account as { address: string } | null) || null;
    connected = walletState?.connected || false;
  } catch (error) {
    // Error handling without logging
  }
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [renderKey, setRenderKey] = useState<number>(0);
  
  // レスポンシブ対応
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  try {
    const responsive = useResponsive();
    deviceType = responsive.deviceType;
  } catch (error) {
    // Error handling without logging
  }

  // 管理者チェック（ヘッダー表示制御用、エラー時の連続リクエストを防止）
  const lastCheckRef = useRef<{ time: number; address: string | null }>({ time: 0, address: null });
  const checkInterval = 60 * 1000; // 1分間は同じアドレスで再チェックしない（無限ループ防止）
  
  useEffect(() => {
    let ignore = false;
    
    const checkAdmin = async () => {
      try {
        if (connected && account?.address) {
          const now = Date.now();
          // 同じアドレスで短期間に再チェックしない（無限ループ防止）
          if (lastCheckRef.current.address === account.address && now - lastCheckRef.current.time < checkInterval) {
            return;
          }
          
          lastCheckRef.current.time = now;
          lastCheckRef.current.address = account.address;
          
          // AdminPanel から参照できるように現在のアドレスを保存
          try {
            localStorage.setItem('currentWalletAddress', account.address);
          } catch (storageError) {
            // Error handling without logging
          }
          
          const resp = await fetch(`${API_BASE_URL}/api/admin/check/${account.address}`);
          if (!ignore) {
            const data = await resp.json();
            setIsAdmin(Boolean(data?.success && data?.isAdmin));
          }
        } else {
          setIsAdmin(false);
          lastCheckRef.current.address = null;
          // 未接続時はクリア
          try {
            localStorage.removeItem('currentWalletAddress');
          } catch (storageError) {
            // Error handling without logging
          }
        }
      } catch (error) {
        if (!ignore) {
          setIsAdmin(false);
          lastCheckRef.current.address = null;
          try {
            localStorage.removeItem('currentWalletAddress');
          } catch (storageError) {
            // Error handling without logging
          }
        }
      }
    };
    
    checkAdmin();
    return () => { ignore = true; };
  }, [connected, account?.address]);


  // URL変更時の再レンダリングとタイトル更新
  useEffect(() => {
    const handleUrlChange = () => {
      setRenderKey(prev => prev + 1);
      updatePageTitle();
    };

    const updatePageTitle = () => {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        let title = 'SyndicateXTokyo Portal';
        
        if (path === '/') {
          title = 'SyndicateXTokyo Portal';
        } else if (path === '/Verification' || path === '/verification') {
          title = 'NFT Verification - SyndicateXTokyo Portal';
        } else if (path.startsWith('/mint')) {
          title = 'Mint NFT - SyndicateXTokyo Portal';
        } else if (path.startsWith('/admin')) {
          title = 'Admin Panel - SyndicateXTokyo Portal';
        }
        
        document.title = title;
      }
    };

    // 初期ロード時
    updatePageTitle();

    // ブラウザの戻る/進むボタン
    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, []);

  // 現在のパスを取得して、HomePageかどうかを判定
  const [currentPath, setCurrentPath] = useState<string>('/');
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname);
      const handlePathChange = () => {
        setCurrentPath(window.location.pathname);
      };
      window.addEventListener('popstate', handlePathChange);
      return () => window.removeEventListener('popstate', handlePathChange);
    }
  }, [renderKey]);

  const isHomePage = currentPath === '/';

  return (
    <>
      {!isHomePage ? (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)' }}>
          {/* レスポンシブヘッダー */}
          <nav 
            role="navigation"
            aria-label="Main navigation"
            style={{
              background: 'rgba(31, 41, 55, 0.95)',
              backdropFilter: 'blur(8px)',
              borderBottom: '1px solid rgba(55, 65, 81, 0.4)',
              padding: getResponsiveValue('0.5rem 0.75rem', '0.5rem 1rem', '0.5rem 1rem', deviceType),
              position: 'sticky',
              top: 0,
              zIndex: 1000
            }}
          >
            <div style={{
              width: '100%',
              ...(deviceType === 'desktop' ? {} : { maxWidth: '1200px', margin: '0 auto' }),
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: getResponsiveValue('0.5rem', '0.75rem', '1rem', deviceType)
            }}>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.history.pushState({}, '', '/');
                    setRenderKey(prev => prev + 1);
                  }
                }}
                aria-label="Go to home page"
                style={{
                  fontSize: getResponsiveValue('0.875rem', '1rem', '1.125rem', deviceType),
                  fontWeight: 700,
                  color: '#f9fafb',
                  margin: 0,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  background: 'none',
                  border: 'none',
                  padding: getResponsiveValue('0.5rem', '0.5rem', '0', deviceType),
                  minHeight: deviceType === 'mobile' ? '44px' : 'auto',
                  minWidth: deviceType === 'mobile' ? '44px' : 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                SyndicateXTokyo
              </button>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: getResponsiveValue('4px', '6px', '8px', deviceType),
            flexWrap: 'nowrap'
          }}>
            {/* 公式ConnectButton（Copy/Switch/Disconnect機能を内蔵） */}
            <div style={{ 
              transform: getResponsiveValue('scale(0.6)', 'scale(0.75)', 'scale(1)', deviceType),
              transformOrigin: 'right center'
            }}>
              <ConnectButton />
            </div>
            
            {/* 管理者バッジ */}
            {isAdmin && connected && (
              <button 
                type="button"
                aria-label="Go to admin panel"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.history.pushState({}, '', '/admin');
                    setRenderKey(prev => prev + 1);
                  }
                }}
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: getResponsiveValue('2px', '3px', '4px', deviceType),
                  padding: getResponsiveValue('8px 12px', '5px 8px', '6px 10px', deviceType),
                  minHeight: deviceType === 'mobile' ? '44px' : 'auto',
                  minWidth: deviceType === 'mobile' ? '44px' : 'auto',
                  background: '#374151',
                  borderRadius: getResponsiveValue('16px', '18px', '20px', deviceType),
                  color: '#f9fafb',
                  border: '1px solid rgba(55, 65, 81, 0.4)',
                  fontSize: getResponsiveValue('9px', '10px', '11px', deviceType),
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                  whiteSpace: 'nowrap'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#4b5563';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#374151';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
                }}
              >
                <span style={{ fontSize: '12px' }}>🔑</span>
                <span>Admin</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main 
        role="main"
        key={renderKey}
        style={{ 
          ...(isHomePage ? {} : { maxWidth: '1200px', margin: '0 auto' }),
          padding: '1rem',
          minHeight: 'calc(100vh - 56px)'
        }}
      >
        {(() => {
          try {
            if (typeof window !== 'undefined') {
              const path = window.location.pathname;
              
              // ルートパス
              if (path === '/') {
                return (
                  <Suspense fallback={<UnifiedLoadingSpinner size="medium" message="Loading..." />}>
                    <HomePage />
                  </Suspense>
                );
              }
              
              // 認証ページ
              if (path === '/Verification' || path === '/verification') {
                return (
                  <Suspense fallback={<UnifiedLoadingSpinner size="medium" message="Loading..." />}>
                    <NFTVerificationPage />
                  </Suspense>
                );
              }
              
              // ミントページ
              if (path.startsWith('/mint')) {
                return (
                  <Suspense fallback={<UnifiedLoadingSpinner size="medium" message="Loading..." />}>
                    <MintPage />
                  </Suspense>
                );
              }
              
              // 管理者ページ
              if (path.startsWith('/admin')) {
                if (!isAdmin) {
                  return (
                    <section 
                      role="alert"
                      aria-live="polite"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '60vh',
                        color: 'white',
                        textAlign: 'center'
                      }}
                    >
                      <div>
                        <h2>アクセス拒否</h2>
                        <p>管理者権限が必要です。ウォレットを接続してください。</p>
                      </div>
                    </section>
                  );
                }
                
                // 新しいページ構造
                if (path === '/admin') {
                  const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
                  return (
                    <React.Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}><UnifiedLoadingSpinner size="medium" message="Loading..." /></div>}>
                      <AdminDashboard />
                    </React.Suspense>
                  );
                }
                if (path.startsWith('/admin/mint/events')) {
                  const EventManagement = React.lazy(() => import('./pages/admin/EventManagement'));
                  return (
                    <React.Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}><UnifiedLoadingSpinner size="medium" message="Loading..." /></div>}>
                      <EventManagement />
                    </React.Suspense>
                  );
                }
                if (path.startsWith('/admin/mint/history')) {
                  const MintHistory = React.lazy(() => import('./pages/admin/MintHistory'));
                  return (
                    <React.Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}><UnifiedLoadingSpinner size="medium" message="Loading..." /></div>}>
                      <MintHistory />
                    </React.Suspense>
                  );
                }
                if (path.startsWith('/admin/roles')) {
                  const RolesManagement = React.lazy(() => import('./pages/admin/RolesManagement'));
                  return (
                    <React.Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}><UnifiedLoadingSpinner size="medium" message="Loading..." /></div>}>
                      <RolesManagement />
                    </React.Suspense>
                  );
                }
                
                // レガシー: AdminMintPage
                if (path.startsWith('/admin/mints')) {
                  const AdminMintPage = React.lazy(() => import('./pages/AdminMintPage'));
                  return (
                    <React.Suspense fallback={<UnifiedLoadingSpinner size="medium" message="Loading..." />}>
                      <AdminMintPage />
                    </React.Suspense>
                  );
                }
                if (path === '/mint-flow') {
                  const MintFlowPage = React.lazy(() => import('./pages/MintFlowPage'));
                  return (
                    <React.Suspense fallback={<UnifiedLoadingSpinner size="medium" message="Loading..." />}>
                      <MintFlowPage />
                    </React.Suspense>
                  );
                }
              }
            }
            // デフォルトはHomePageを表示（コード分割）
            return (
              <Suspense fallback={
                <div style={{
                  minHeight: '100vh',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '1rem'
                }}>
                  <div style={{
                    background: 'white',
                    borderRadius: '12px',
                    padding: '2rem',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                    textAlign: 'center',
                    color: '#64748b'
                  }}>
                    <UnifiedLoadingSpinner size="medium" message="Loading page..." />
                  </div>
                </div>
              }>
                <HomePage />
              </Suspense>
            );
          } catch (error) {
            return (
              <section 
                role="alert"
                aria-live="assertive"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '60vh',
                  color: 'white',
                  textAlign: 'center'
                }}
              >
                <div>
                  <h2>コンポーネントエラー</h2>
                  <p>ページを再読み込みしてください。</p>
                  <button 
                    type="button"
                    aria-label="ページを再読み込み"
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
              </section>
            );
          }
        })()}
      </main>
        </div>
      ) : (
        <>
          {/* レスポンシブヘッダー */}
          <nav 
            role="navigation"
            aria-label="Main navigation"
            style={{
              background: 'rgba(31, 41, 55, 0.95)',
              backdropFilter: 'blur(8px)',
              borderBottom: '1px solid rgba(55, 65, 81, 0.4)',
              padding: getResponsiveValue('0.5rem 0.75rem', '0.5rem 1rem', '0.5rem 1rem', deviceType),
              position: 'sticky',
              top: 0,
              zIndex: 1000
            }}
          >
            <div style={{
              width: '100%',
              ...(deviceType === 'desktop' ? {} : { maxWidth: '1200px', margin: '0 auto' }),
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: getResponsiveValue('0.5rem', '0.75rem', '1rem', deviceType)
            }}>
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.history.pushState({}, '', '/');
                    setRenderKey(prev => prev + 1);
                  }
                }}
                aria-label="Go to home page"
                style={{
                  fontSize: getResponsiveValue('0.875rem', '1rem', '1.125rem', deviceType),
                  fontWeight: 700,
                  color: '#f9fafb',
                  margin: 0,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  background: 'none',
                  border: 'none',
                  padding: getResponsiveValue('0.5rem', '0.5rem', '0', deviceType),
                  minHeight: deviceType === 'mobile' ? '44px' : 'auto',
                  minWidth: deviceType === 'mobile' ? '44px' : 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                SyndicateXTokyo
              </button>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: getResponsiveValue('4px', '6px', '8px', deviceType),
                flexWrap: 'nowrap'
              }}>
                {/* 公式ConnectButton（Copy/Switch/Disconnect機能を内蔵） */}
                <div style={{ 
                  transform: getResponsiveValue('scale(0.6)', 'scale(0.75)', 'scale(1)', deviceType),
                  transformOrigin: 'right center'
                }}>
                  <ConnectButton />
                </div>
                
                {/* 管理者バッジ */}
                {isAdmin && connected && (
                  <button 
                    type="button"
                    aria-label="Go to admin panel"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.history.pushState({}, '', '/admin');
                        setRenderKey(prev => prev + 1);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: getResponsiveValue('2px', '3px', '4px', deviceType),
                      padding: getResponsiveValue('8px 12px', '5px 8px', '6px 10px', deviceType),
                      minHeight: deviceType === 'mobile' ? '44px' : 'auto',
                      minWidth: deviceType === 'mobile' ? '44px' : 'auto',
                      background: '#374151',
                      borderRadius: getResponsiveValue('16px', '18px', '20px', deviceType),
                      color: '#f9fafb',
                      border: '1px solid rgba(55, 65, 81, 0.4)',
                      fontSize: getResponsiveValue('9px', '10px', '11px', deviceType),
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                      whiteSpace: 'nowrap'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = '#4b5563';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = '#374151';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
                    }}
                  >
                    <span style={{ fontSize: '12px' }}>🔑</span>
                    <span>Admin</span>
                  </button>
                )}
              </div>
            </div>
          </nav>

          {/* HomePageは直接表示（独自の背景とレイアウトを持つ、maxWidth制約なし） */}
          {(() => {
            try {
              if (typeof window !== 'undefined') {
                const path = window.location.pathname;
                
                // ルートパス
                if (path === '/') {
                  return (
                    <Suspense fallback={<UnifiedLoadingSpinner size="medium" message="Loading..." />}>
                      <HomePage />
                    </Suspense>
                  );
                }
              }
              // デフォルトはHomePageを表示（コード分割）
              return (
                <Suspense fallback={
                  <div style={{
                    minHeight: '100vh',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                  }}>
                    <div style={{
                      background: 'white',
                      borderRadius: '12px',
                      padding: '2rem',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                      textAlign: 'center',
                      color: '#64748b'
                    }}>
                      <UnifiedLoadingSpinner size="medium" message="Loading page..." />
                    </div>
                  </div>
                }>
                  <HomePage />
                </Suspense>
              );
            } catch (error) {
              return (
                <section 
                  role="alert"
                  aria-live="assertive"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '60vh',
                    color: '#1f2937',
                    textAlign: 'center'
                  }}
                >
                  <div>
                    <h2>コンポーネントエラー</h2>
                    <p>ページを再読み込みしてください。</p>
                    <button 
                      type="button"
                      aria-label="ページを再読み込み"
                      onClick={() => window.location.reload()}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: '#667eea',
                        color: 'white',
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
                </section>
              );
            }
          })()}
        </>
      )}
      
      {/* React Query DevTools (開発環境のみ) */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </>
  );
}

export default App;