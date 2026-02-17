import React, { Suspense, lazy, useCallback, useEffect, useRef } from 'react';
import { NFTDetailDrawer } from '../features/owned/NFTDetailDrawer';
import { useHomePageState, type HomeTabType } from '../hooks/useHomePageState';
import { HomePageHeader } from '../components/home/HomePageHeader';
import { HomeTabNavigation } from '../components/home/HomeTabNavigation';
import { UnifiedLoadingSpinner } from '../components/ui/UnifiedLoadingSpinner';

// タブコンポーネントを遅延ロード
const loadAllTab = () => import('../components/home/tabs/AllTab').then(m => ({ default: m.AllTab }));
const loadOwnedTab = () => import('../components/home/tabs/OwnedTab').then(m => ({ default: m.OwnedTab }));
const loadCalendarTab = () => import('../components/home/tabs/CalendarTab').then(m => ({ default: m.CalendarTab }));
const loadActivityTab = () => import('../components/home/tabs/ActivityTab').then(m => ({ default: m.ActivityTab }));
const loadDashboardTab = () => import('../components/home/tabs/DashboardTab').then(m => ({ default: m.DashboardTab }));

const AllTab = lazy(loadAllTab);
const OwnedTab = lazy(loadOwnedTab);
const CalendarTab = lazy(loadCalendarTab);
const ActivityTab = lazy(loadActivityTab);
const DashboardTab = lazy(loadDashboardTab);

const TAB_LOADERS = {
  all: loadAllTab,
  owned: loadOwnedTab,
  calendar: loadCalendarTab,
  activity: loadActivityTab,
  dashboard: loadDashboardTab
} as const;

// タブローディングフォールバック
const TabFallback = () => (
  <div style={{
    background: 'rgba(30, 27, 75, 0.6)',
    backdropFilter: 'blur(10px)',
    borderRadius: '10px',
    padding: '2rem',
    border: '1px solid rgba(79, 70, 229, 0.3)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem'
  }}>
    <UnifiedLoadingSpinner size="medium" />
  </div>
);

// Convert IPFS URLs to HTTP gateway
const convertIpfsUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('ipfs://')) {
    const hash = url.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${hash}`;
  }
  return url;
};

const HomePage: React.FC = () => {
  const {
    // ウォレット
    connected,
    
    // タブ管理
    activeTab,
    setActiveTab,
    
     // コレクション管理
     expandedCollections,
     setExpandedCollections,
     
     // NFT管理
     selectedNFT,
     setSelectedNFT,
     isDrawerOpen,
     setIsDrawerOpen,
    
    // ソート・検索
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    searchQuery,
    setSearchQuery,
    
    // レスポンシブ
    deviceType,
    
    // データ
    collections,
    events: filteredEvents,
    eventNFTs,
    nonEventNFTs,
    ownedTabNFTs,
    hasSelectionFilters,
    onchainCounts,
    collectionLayoutGroups,
    eventNFTGroups,
    
    // 状態
    loading,
    hasCriticalErrors,
    nftLoading
  } = useHomePageState();

  const prefetchedTabsRef = useRef<Set<HomeTabType>>(new Set(['all']));

  const prefetchTab = useCallback((tab: HomeTabType) => {
    if (prefetchedTabsRef.current.has(tab)) {
      return;
    }

    prefetchedTabsRef.current.add(tab);

    const loader = TAB_LOADERS[tab];
    if (loader) {
      loader().catch(() => {
        prefetchedTabsRef.current.delete(tab);
      });
    }
  }, []);

  useEffect(() => {
    prefetchTab(activeTab);
  }, [activeTab, prefetchTab]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const secondaryTabs: HomeTabType[] = ['dashboard', 'owned', 'calendar', 'activity'];

    const runPrefetch = () => {
      secondaryTabs.forEach(prefetchTab);
    };

    const win = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let idleId: number | undefined;
    let timeoutId: number | undefined;

    if (typeof win.requestIdleCallback === 'function') {
      idleId = win.requestIdleCallback(runPrefetch, { timeout: 2000 });
    } else {
      timeoutId = window.setTimeout(runPrefetch, 1200);
    }

    return () => {
      if (idleId !== undefined && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleId);
      }
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [prefetchTab]);

  const ownedNFTsForDisplay =
    ownedTabNFTs.length === 0 &&
    nonEventNFTs.length > 0 &&
    !hasSelectionFilters &&
    !nftLoading
      ? nonEventNFTs
      : ownedTabNFTs;

  const renderTabContent = () => {
    const panelId = `${activeTab}-panel`;
    const tabId = `${activeTab}-tab`;

    if (loading) {
      return (
        <div role="tabpanel" id={panelId} aria-labelledby={tabId} tabIndex={0}>
          <TabFallback />
        </div>
      );
    }

    if (hasCriticalErrors) {
      return (
        <div role="tabpanel" id={panelId} aria-labelledby={tabId} tabIndex={0}>
          <div
            style={{
              padding: '1.5rem',
              borderRadius: '12px',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              background: 'linear-gradient(135deg, rgba(248, 113, 113, 0.1) 0%, rgba(239, 68, 68, 0.15) 100%)',
              color: '#fecaca',
              textAlign: 'center',
              fontWeight: 500,
            }}
            role="alert"
          >
            データの読み込みに失敗しました。ページを再読み込みして再試行してください。
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'all':
        return (
          <div role="tabpanel" id={panelId} aria-labelledby={tabId} tabIndex={0}>
            <Suspense fallback={<TabFallback />}>
              <AllTab
                deviceType={deviceType}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortOrder={sortOrder}
                setSortOrder={setSortOrder}
                collections={collections}
                events={filteredEvents}
                onchainCounts={onchainCounts}
                expandedCollections={expandedCollections}
                setExpandedCollections={setExpandedCollections}
                allOwnedNFTs={eventNFTs}
                convertIpfsUrl={convertIpfsUrl}
                collectionLayoutGroups={collectionLayoutGroups}
                eventNFTGroups={eventNFTGroups}
              />
            </Suspense>
          </div>
        );
      
       case 'owned':
         return (
           <div role="tabpanel" id={panelId} aria-labelledby={tabId} tabIndex={0}>
             <Suspense fallback={<TabFallback />}>
               <OwnedTab
                 deviceType={deviceType}
                 nftLoading={nftLoading}
                allOwnedNFTs={ownedNFTsForDisplay}
                 collections={collections}
                 setSelectedNFT={setSelectedNFT}
                 setIsDrawerOpen={setIsDrawerOpen}
                 convertIpfsUrl={convertIpfsUrl}
               />
             </Suspense>
           </div>
         );
      
       case 'calendar':
         return (
           <div role="tabpanel" id={panelId} aria-labelledby={tabId} tabIndex={0}>
             <Suspense fallback={<TabFallback />}>
               <CalendarTab
                 deviceType={deviceType}
                 events={filteredEvents}
                 connected={connected}
                 nftLoading={nftLoading}
                 convertIpfsUrl={convertIpfsUrl}
                 allOwnedNFTs={eventNFTs}
               />
             </Suspense>
           </div>
         );
      
       case 'activity':
         return (
           <div role="tabpanel" id={panelId} aria-labelledby={tabId} tabIndex={0}>
             <Suspense fallback={<TabFallback />}>
               <ActivityTab
                 deviceType={deviceType}
                 allOwnedNFTs={ownedTabNFTs}
                 events={filteredEvents}
               />
             </Suspense>
           </div>
         );
      
       case 'dashboard':
         return (
           <div role="tabpanel" id={panelId} aria-labelledby={tabId} tabIndex={0}>
             <Suspense fallback={<TabFallback />}>
              <DashboardTab
                deviceType={deviceType}
                collections={collections}
                events={filteredEvents}
                onchainCounts={onchainCounts instanceof Map ? onchainCounts : new Map<string, number>()}
              />
             </Suspense>
           </div>
         );
      
      default:
        return null;
    }
  };

  return (
    <div style={{
      padding: '1rem',
      minHeight: 'calc(100vh - 56px)',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 25%, #1e1b4b 50%, #312e81 75%, #3730a3 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* アニメーション背景エフェクト */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at 20% 20%, rgba(79, 70, 229, 0.1) 0%, transparent 60%),
          radial-gradient(circle at 80% 80%, rgba(59, 130, 246, 0.08) 0%, transparent 60%)
        `,
        pointerEvents: 'none',
        zIndex: 0
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* ヘッダー */}
        <HomePageHeader deviceType={deviceType} />

         {/* タブナビゲーション */}
         <HomeTabNavigation
           activeTab={activeTab}
          onTabChange={(tab) => {
            prefetchTab(tab);
            setActiveTab(tab);
          }}
          onTabPrefetch={prefetchTab}
           deviceType={deviceType}
         />

        {/* タブコンテンツ */}
        {renderTabContent()}
      </div>

      {/* NFT詳細ドロワー */}
      {selectedNFT && (
        <NFTDetailDrawer
          nft={selectedNFT}
          open={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedNFT(null);
          }}
        />
      )}
    </div>
  );
};

export default HomePage;
