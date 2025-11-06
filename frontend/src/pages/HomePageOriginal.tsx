import React from 'react';
import { NFTDetailDrawer } from '../features/owned/NFTDetailDrawer';
import { useHomePageState } from '../hooks/useHomePageState';
import { HomePageHeader } from '../components/home/HomePageHeader';
import { HomeTabNavigation } from '../components/home/HomeTabNavigation';
import { StatsSection } from '../components/home/StatsSection';
import { AllTab } from '../components/home/tabs/AllTab';
import { OwnedTab } from '../components/home/tabs/OwnedTab';
import { CalendarTab } from '../components/home/tabs/CalendarTab';
import { ActivityTab } from '../components/home/tabs/ActivityTab';
import { DashboardTab } from '../components/home/tabs/DashboardTab';

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
    
    // ダッシュボード管理
    dashboardScope,
    setDashboardScope,
    
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
    events,
    allOwnedNFTs,
    eventNFTs,
    nonEventNFTs,
    onchainCounts,
    activityStats,
    
    // 状態
    loading,
    hasCriticalErrors,
    nftLoading,
    
    // 統計
    totalMints,
    collectionsTrendData,
    mintsTrendData
  } = useHomePageState();

  const renderTabContent = () => {
    if (loading || hasCriticalErrors) {
      return null;
    }

    switch (activeTab) {
      case 'all':
        return (
          <AllTab
            deviceType={deviceType}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            collections={collections}
            events={events}
            onchainCounts={onchainCounts}
            expandedCollections={expandedCollections}
            setExpandedCollections={setExpandedCollections}
            allOwnedNFTs={allOwnedNFTs}
            convertIpfsUrl={convertIpfsUrl}
          />
        );
      
      case 'owned':
        return (
          <OwnedTab
            deviceType={deviceType}
            connected={connected}
            nftLoading={nftLoading}
            allOwnedNFTs={allOwnedNFTs}
            selectedNFT={selectedNFT}
            setSelectedNFT={setSelectedNFT}
            isDrawerOpen={isDrawerOpen}
            setIsDrawerOpen={setIsDrawerOpen}
          />
        );
      
      case 'calendar':
        return (
          <CalendarTab
            deviceType={deviceType}
            connected={connected}
            events={events}
            eventNFTs={eventNFTs}
            selectedNFT={selectedNFT}
            setSelectedNFT={setSelectedNFT}
            isDrawerOpen={isDrawerOpen}
            setIsDrawerOpen={setIsDrawerOpen}
          />
        );
      
      case 'activity':
        return (
          <ActivityTab
            deviceType={deviceType}
            connected={connected}
            allOwnedNFTs={allOwnedNFTs}
          />
        );
      
      case 'dashboard':
        return (
          <DashboardTab
            deviceType={deviceType}
            connected={connected}
            dashboardScope={dashboardScope}
            setDashboardScope={setDashboardScope}
            allOwnedNFTs={allOwnedNFTs}
            collections={collections}
            events={events}
            activityStats={activityStats}
          />
        );
      
      default:
        return null;
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      padding: '1rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* ヘッダー */}
        <HomePageHeader deviceType={deviceType} />

        {/* 統計セクション */}
        <StatsSection
          deviceType={deviceType}
          loading={loading}
          connected={connected}
          collections={collections}
          totalMints={totalMints}
          eventNFTs={eventNFTs}
          nonEventNFTs={nonEventNFTs}
          nftLoading={nftLoading}
          activityStats={activityStats}
          collectionsTrendData={collectionsTrendData}
          mintsTrendData={mintsTrendData}
          onTabChange={(tab) => setActiveTab(tab as any)}
        />

        {/* タブナビゲーション */}
        <HomeTabNavigation
          activeTab={activeTab}
          onTabChange={setActiveTab}
          connected={connected}
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
