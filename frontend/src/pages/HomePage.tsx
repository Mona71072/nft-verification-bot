import React, { Suspense, lazy } from 'react';
import { NFTDetailDrawer } from '../features/owned/NFTDetailDrawer';
import { useHomePageState } from '../hooks/useHomePageState';
import { HomePageHeader } from '../components/home/HomePageHeader';
import { HomeTabNavigation } from '../components/home/HomeTabNavigation';
import { UnifiedLoadingSpinner } from '../components/ui/UnifiedLoadingSpinner';

// タブコンポーネントを遅延ロード
const AllTab = lazy(() => import('../components/home/tabs/AllTab').then(m => ({ default: m.AllTab })));
const OwnedTab = lazy(() => import('../components/home/tabs/OwnedTab').then(m => ({ default: m.OwnedTab })));
const CalendarTab = lazy(() => import('../components/home/tabs/CalendarTab').then(m => ({ default: m.CalendarTab })));
const ActivityTab = lazy(() => import('../components/home/tabs/ActivityTab').then(m => ({ default: m.ActivityTab })));
const DashboardTab = lazy(() => import('../components/home/tabs/DashboardTab').then(m => ({ default: m.DashboardTab })));

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
    ownedTabNFTs,
    onchainCounts,
    activityStats,
    collectionLayoutGroups,
    eventNFTGroups,
    
    // 状態
    loading,
    hasCriticalErrors,
    nftLoading
  } = useHomePageState();

  const renderTabContent = () => {
    if (loading || hasCriticalErrors) {
      return null;
    }

    const panelId = `${activeTab}-panel`;
    const tabId = `${activeTab}-tab`;

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
                 allOwnedNFTs={ownedTabNFTs}
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
                 activityStats={activityStats}
                 allOwnedNFTs={ownedTabNFTs}
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
           onTabChange={setActiveTab}
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
