import { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react';
import '@mysten/dapp-kit/dist/index.css';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useWalletWithErrorHandling } from './hooks/useWallet';
import { useResponsive } from './hooks/useResponsive';
import { UnifiedLoadingSpinner } from './components/ui/UnifiedLoadingSpinner';
import { AppHeader } from './components/AppHeader';

// 主要コンポーネントを遅延読み込み（コード分割）
const HomePage = lazy(() => import('./pages/HomePage'));
const NFTVerificationPage = lazy(() => import('./components/NFTVerificationPage').then(m => ({ default: m.NFTVerificationPage })));
const MintPage = lazy(() => import('./MintPage'));

// 管理者ページの遅延読み込み
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const EventManagement = lazy(() => import('./pages/admin/EventManagement'));
const MintHistory = lazy(() => import('./pages/admin/MintHistory'));
const RolesManagement = lazy(() => import('./pages/admin/RolesManagement'));
const AdminMintPage = lazy(() => import('./pages/AdminMintPage'));
const MintFlowPage = lazy(() => import('./pages/MintFlowPage'));

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
            if (!resp.ok) {
              // APIエラーの場合は管理者ではないとみなす
              setIsAdmin(false);
              return;
            }
            try {
              const data = await resp.json();
              setIsAdmin(Boolean(data?.success && data?.isAdmin));
            } catch (jsonError) {
              // JSON解析エラーの場合も管理者ではないとみなす
              setIsAdmin(false);
            }
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


  // 現在のパスを管理（isHomePageの判定に使用）
  const [currentPath, setCurrentPath] = useState<string>(
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  // ページタイトルを更新する関数
  const updatePageTitle = useCallback((path: string) => {
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
  }, []);

  // URL変更時の処理（popstateリスナーを1つに統合）
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 初期ロード時
    updatePageTitle(window.location.pathname);

    const handleUrlChange = () => {
      const path = window.location.pathname;
      setCurrentPath(path);
      setRenderKey(prev => prev + 1);
      updatePageTitle(path);
    };

    window.addEventListener('popstate', handleUrlChange);
    return () => window.removeEventListener('popstate', handleUrlChange);
  }, [updatePageTitle]);

  // renderKeyが変更された時もcurrentPathを同期（pushStateで遷移した場合）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname);
    }
  }, [renderKey]);

  const isHomePage = currentPath === '/';

  // ナビゲーション関数
  const handleNavigateHome = useCallback(() => {
                  if (typeof window !== 'undefined') {
                    window.history.pushState({}, '', '/');
                    setRenderKey(prev => prev + 1);
                  }
  }, []);

  const handleNavigateAdmin = useCallback(() => {
                  if (typeof window !== 'undefined') {
                    window.history.pushState({}, '', '/admin');
                    setRenderKey(prev => prev + 1);
                  }
  }, []);

  // ページコンテンツをレンダリングする関数（重複を排除）
  const renderPageContent = () => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '/';
    
    // ホームページ
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
    if (path.startsWith('/mint') && path !== '/mint-flow') {
                return (
                  <Suspense fallback={<UnifiedLoadingSpinner size="medium" message="Loading..." />}>
                    <MintPage />
                  </Suspense>
                );
              }
    
    // ミントフローページ
    if (path === '/mint-flow') {
      return (
        <Suspense fallback={<UnifiedLoadingSpinner size="medium" message="Loading..." />}>
          <MintFlowPage />
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
                
      const adminFallback = (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'white' }}>
          <UnifiedLoadingSpinner size="medium" message="Loading..." />
        </div>
      );
      
                if (path === '/admin') {
        return <Suspense fallback={adminFallback}><AdminDashboard /></Suspense>;
                }
                if (path.startsWith('/admin/mint/events')) {
        return <Suspense fallback={adminFallback}><EventManagement /></Suspense>;
                }
                if (path.startsWith('/admin/mint/history')) {
        return <Suspense fallback={adminFallback}><MintHistory /></Suspense>;
                }
                if (path.startsWith('/admin/roles')) {
        return <Suspense fallback={adminFallback}><RolesManagement /></Suspense>;
      }
                if (path.startsWith('/admin/mints')) {
        return <Suspense fallback={adminFallback}><AdminMintPage /></Suspense>;
      }
    }
    
    // デフォルトはHomePageを表示
            return (
      <Suspense fallback={<UnifiedLoadingSpinner size="medium" message="Loading..." />}>
                <HomePage />
              </Suspense>
            );
  };

            return (
    <>
      {/* 共通ヘッダーコンポーネント */}
      <AppHeader
        deviceType={deviceType}
        isAdmin={isAdmin}
        connected={connected}
        onNavigateHome={handleNavigateHome}
        onNavigateAdmin={handleNavigateAdmin}
      />

      {/* ページレイアウト分岐 */}
      {isHomePage ? (
        renderPageContent()
      ) : currentPath.startsWith('/admin') ? (
        <main role="main" key={renderKey} style={{ minHeight: 'calc(100vh - 56px)' }}>
          {renderPageContent()}
        </main>
      ) : (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)' }}>
          <main
            role="main"
            key={renderKey}
            style={{
              maxWidth: '1200px',
              margin: '0 auto',
              padding: '1rem',
              minHeight: 'calc(100vh - 56px)'
            }}
          >
            {renderPageContent()}
          </main>
        </div>
      )}
      
      {/* React Query DevTools (開発環境のみ) */}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </>
  );
}

export default App;