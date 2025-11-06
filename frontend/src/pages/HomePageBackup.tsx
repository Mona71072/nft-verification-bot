import React, { useState, useMemo } from 'react';
import { useWalletWithErrorHandling } from '../hooks/useWallet';
import { StatCard, StatCardSkeleton } from '../features/overview/StatCard';
import { EmptyNFTs } from '../components/empty-states/EmptyNFTs';
import { GridSkeleton } from '../components/skeletons/GridSkeleton';
import { CalendarSkeleton } from '../components/skeletons/CalendarSkeleton';
import { StaggerChildren, StaggerItem } from '../components/motion/FadeIn';
import { FloatOnHover } from '../components/motion/ScaleIn';
import { useCollections } from '../hooks/queries/useCollections';
import { useEvents } from '../hooks/queries/useEvents';
import { useOwnedNFTs, useOnchainCounts } from '../hooks/queries/useNFTs';
import { NFTDetailDrawer } from '../features/owned/NFTDetailDrawer';
import { ActivityTimeline } from '../features/activity/ActivityTimeline';
import { DashboardInsights } from '../features/dashboard/DashboardInsights';
import { useActivityStats } from '../hooks/useActivityStats';
import { CollectionsSection } from '../features/collections/CollectionsSection';
import { OwnedNFTsSection } from '../features/owned/OwnedNFTsSection';
import { CalendarSection } from '../features/calendar/CalendarSection';
import { useResponsive, getResponsiveValue } from '../hooks/useResponsive';
import { 
  LayoutGrid, 
  TrendingUp, 
  Gem, 
  Calendar as CalendarIcon,
  Activity as ActivityIcon
} from 'lucide-react';

interface OwnedNFT {
  objectId: string;
  type: string;
  display?: {
    name?: string;
    description?: string;
    image_url?: string;
    event_date?: string;
  };
  owner?: any;
}

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
  const { account, connected } = useWalletWithErrorHandling();
  const [activeTab, setActiveTab] = useState<'all' | 'owned' | 'calendar' | 'activity' | 'dashboard'>('all');
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [dashboardScope, setDashboardScope] = useState<'personal' | 'global'>('personal');
  // Removed in refactor: expandedEvents handled inside CollectionsSection
  const [selectedNFT, setSelectedNFT] = useState<OwnedNFT | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // ソート機能の状態
  const [sortBy, setSortBy] = useState<'eventName' | 'eventDate' | 'collection'>('eventName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // 検索機能の状態
  const [searchQuery, setSearchQuery] = useState('');

  // レスポンシブ対応
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  try {
    const responsive = useResponsive();
    deviceType = responsive.deviceType;
  } catch (error) {
    console.error('useResponsive error:', error);
  }

  // TanStack Query hooks (with error handling)
  const { data: collections = [], isLoading: collectionsLoading, error: collectionsError } = useCollections();
  const { data: events = [], isLoading: eventsLoading, error: eventsError } = useEvents();

  // Log collection and events errors
  if (collectionsError) {
    console.error('useCollections error:', collectionsError);
  }
  if (eventsError) {
    console.error('useEvents error:', eventsError);
  }
  
  // Create collection type paths (with safety check)
  const collectionTypes = useMemo(() => {
    if (!collections || !Array.isArray(collections)) {
      return [];
    }
    return collections.map(col => col.id).filter(Boolean);
  }, [collections]);
  
  // Get on-chain counts (with error handling)
  const { data: onchainCounts = new Map(), error: onchainCountsError } = useOnchainCounts(collectionTypes);

  // Log onchain counts errors
  if (onchainCountsError) {
    console.error('useOnchainCounts error:', onchainCountsError);
  }
  
  // Get owned NFTs (with error handling)
  const { data: allOwnedNFTs = [], isLoading: nftLoading, error: nftError } = useOwnedNFTs(
    account?.address || '', 
    collectionTypes
  );

  // Log NFT loading errors
  if (nftError) {
    console.error('useOwnedNFTs error:', nftError);
  }

  // Get activity stats for dashboard (with error handling)
  // Hooksは常にトップレベルで呼び出す必要があります
  const activityStats = useActivityStats(
    account?.address || '', 
    collectionTypes
  );

  // 全体統計（イベント登録コレクションベース、オンチェーン総数）
  const globalStats = useMemo(() => {
    const safeCollections = collections && Array.isArray(collections) ? collections : [];
    const safeEvents = events && Array.isArray(events) ? events : [];

    // 日付別の合計ミント数（イベントのstartAt/eventDateとmintedCountを使用）
    const dateGroups = new Map<string, number>();
    for (const ev of safeEvents) {
      const dateStr = (ev as any)?.startAt || (ev as any)?.eventDate;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) continue;
      const key = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())).toISOString().split('T')[0];
      const inc = typeof (ev as any)?.mintedCount === 'number' ? (ev as any).mintedCount : 0;
      dateGroups.set(key, (dateGroups.get(key) || 0) + inc);
    }

    const generateDaily = () => {
      const now = new Date();
      const out: Array<{ date: string; count: number; label: string }> = [];
      for (let i = 29; i >= 0; i--) {
        const day = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - i));
        const key = day.toISOString().split('T')[0];
        const count = dateGroups.get(key) || 0;
        out.push({
          date: key,
          count,
          label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
        });
      }
      return out;
    };

    const generateWeekly = () => {
      const now = new Date();
      const out: Array<{ date: string; count: number; label: string }> = [];
      for (let i = 11; i >= 0; i--) {
        const start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - (i * 7 + 6)));
        const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 6));
        let sum = 0;
        for (const [key, cnt] of dateGroups) {
          const d = new Date(key + 'T00:00:00Z');
          if (d >= start && d <= end) sum += cnt;
        }
        out.push({
          date: start.toISOString().split('T')[0],
          count: sum,
          label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });
      }
      return out;
    };

    const generateMonthly = () => {
      const now = new Date();
      const out: Array<{ date: string; count: number; label: string }> = [];
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
        const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
        let sum = 0;
        for (const [key, cnt] of dateGroups) {
          const d = new Date(key + 'T00:00:00Z');
          if (d >= monthStart && d <= monthEnd) sum += cnt;
        }
        out.push({
          date: monthStart.toISOString().split('T')[0],
          count: sum,
          label: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });
      }
      return out;
    };

    const collectionStats = safeCollections.map((collection: any) => {
      const totalMinted = onchainCounts.get(collection.id) || 0;
      return {
        id: collection.id,
        name: collection.name,
        totalMints: totalMinted,
        ownedCount: 0,
        trend: 0
      };
    });
    const totalMints = collectionStats.reduce((sum: number, c: any) => sum + (c.totalMints || 0), 0);
    return {
      dailyData: generateDaily(),
      weeklyData: generateWeekly(),
      monthlyData: generateMonthly(),
      collectionStats,
      mostActiveCollection: collectionStats.length > 0 ? collectionStats.reduce((max: any, cur: any) => (cur.totalMints > max.totalMints ? cur : max), collectionStats[0]) : null,
      totalMints,
      totalOwned: 0,
      dailyGrowth: 0,
      weeklyGrowth: 0,
      monthlyGrowth: 0,
      recentActivity: { lastMintDate: null, mintStreak: 0, averageMintsPerWeek: 0 },
      trends: { isGrowing: false, growthRate: 0, peakActivity: '', lowActivity: '' }
    };
  }, [collections, events, onchainCounts]);
  
  // Generate activities from owned NFTs
  const activities = useMemo(() => {
    if (!connected || !allOwnedNFTs || allOwnedNFTs.length === 0 || !events || events.length === 0) {
      return [];
    }

    // KVに登録されているイベント名のセットを作成
    const eventNames = new Set(events.map(e => e.name));

    // Convert owned NFTs to mint activities (KVに登録されているイベントのみ)
    return allOwnedNFTs
      .filter((nft) => {
        // NFTの名前がKVに登録されているイベントと一致するかチェック
        const nftName = nft.display?.name;
        if (!nftName || !eventNames.has(nftName)) {
          return false;
        }
        
        // event_dateが有効な日付かチェック
        if (nft.display?.event_date) {
          const date = new Date(nft.display.event_date);
          // 無効な日付を除外
          if (isNaN(date.getTime())) {
            return false;
          }
        }
        
        return true;
      })
      .map((nft) => {
        // Use event_date or current time as timestamp
        const timestamp = nft.display?.event_date 
          ? new Date(nft.display.event_date).getTime()
          : Date.now();

        return {
          id: `mint-${nft.objectId}`,
          type: 'mint' as const,
          timestamp: timestamp,
          timestampMs: timestamp,
          digest: undefined,
          mint: {
            objectId: nft.objectId,
            name: nft.display?.name || 'Unnamed NFT',
            image_url: nft.display?.image_url,
            collection: nft.type,
            eventName: nft.display?.name
          }
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [connected, allOwnedNFTs, events]);


  // Integrate loading state
  const loading = collectionsLoading || eventsLoading;

  // Check for critical errors that should prevent rendering
  // より緩い条件：致命的なエラーのみでレンダリングを阻止
  const hasCriticalErrors = false; // 一時的に無効化してデバッグ

  // Calculate statistics (optimized with useMemo)
  // 登録されているコレクションのミント数のみを合計
  const totalMints = useMemo(() => {
    let total = 0;
    
    if (!collections || !Array.isArray(collections) || !events || !Array.isArray(events)) {
      return total;
    }
    
    collections.forEach(collection => {
      const collectionTypePath = (collection as any).typePath || collection.packageId;
      const collectionEvents = events.filter(e => e.collectionId === collectionTypePath);
      
      if (collectionEvents.length > 0) {
        // イベントが紐付いている場合: KVのイベントミント数を合計
        total += collectionEvents.reduce((sum, event) => {
          return sum + (typeof event.mintedCount === 'number' ? event.mintedCount : 0);
        }, 0);
      } else {
        // イベントが紐付いていない場合: オンチェーンのNFT総数
        total += onchainCounts.get(collection.id) || 0;
      }
    });
    
    return total;
  }, [collections, events, onchainCounts]);

  // コレクション数のトレンドデータを生成
  const collectionsTrendData = useMemo(() => {
    const now = new Date();
    const data = [];
    
    // 過去7日間のデータを生成（コレクション数は基本的に一定）
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - i));
      data.push({
        date: date.toISOString().split('T')[0],
        count: collections.length, // コレクション数は一定
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }
    
    return data;
  }, [collections.length]);

  // ミント数のトレンドデータを生成
  const mintsTrendData = useMemo(() => {
    const now = new Date();
    const data = [];
    
    // 過去7日間のデータを生成
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - i));
      const dateStr = date.toISOString().split('T')[0];
      
      // その日のミント数を計算
      let dailyMints = 0;
      if (events && Array.isArray(events)) {
        events.forEach(event => {
          const eventDate = (event as any)?.startAt || (event as any)?.eventDate;
          if (eventDate) {
            const eventDateStr = new Date(eventDate).toISOString().split('T')[0];
            if (eventDateStr === dateStr) {
              dailyMints += typeof event.mintedCount === 'number' ? event.mintedCount : 0;
            }
          }
        });
      }
      
      data.push({
        date: dateStr,
        count: dailyMints,
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }
    
    return data;
  }, [events]);

  // Owned NFTs: Only NFTs from registered events
  const nonEventNFTs = useMemo(() => {
    if (!allOwnedNFTs || !Array.isArray(allOwnedNFTs) || !events || !Array.isArray(events)) {
      return [];
    }
    
    // Get registered event names
    const eventNames = new Set(events.map(e => e.name));
    
    // Filter NFTs to only show those from registered events
    return allOwnedNFTs.filter(nft => {
      if (!nft.display?.name) return false;
      return eventNames.has(nft.display.name);
    });
  }, [allOwnedNFTs, events]);

  // Event NFTs: EventNFT type and registered in events
  const eventNFTs = useMemo(() => {
    if (!allOwnedNFTs || !Array.isArray(allOwnedNFTs) || !events || !Array.isArray(events)) {
      return [];
    }
    const eventNames = new Set(events.map(e => e.name));
    return allOwnedNFTs.filter(nft => 
      nft.type && nft.type.includes('::sxt_nft::EventNFT') && 
      nft.display?.name && eventNames.has(nft.display.name)
    );
  }, [allOwnedNFTs, events]);

  // For calendar: Group event NFTs by event date
  const nftsByDate = useMemo(() => {
    const map = new Map<string, OwnedNFT[]>();
    
    if (!eventNFTs || !Array.isArray(eventNFTs)) {
      return map;
    }
    
    eventNFTs.forEach(nft => {
      if (nft.display?.event_date) {
        const date = new Date(nft.display.event_date).toISOString().split('T')[0];
        if (!map.has(date)) {
          map.set(date, []);
        }
        map.get(date)?.push(nft);
      }
    });
    return map;
  }, [eventNFTs]);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [expandedEventDates, setExpandedEventDates] = useState<Set<string>>(new Set());

  // Generate calendar grid
  const calendarGrid = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const calendar: (number | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      calendar.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      calendar.push(day);
    }
    return calendar;
  }, [currentMonth]);

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      padding: getResponsiveValue('1rem 0.5rem', '1.5rem 1rem', '2rem 1rem', deviceType),
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #1e3a8a 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Animated background elements */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.1) 0%, transparent 60%),
          radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.08) 0%, transparent 60%),
          radial-gradient(circle at 40% 60%, rgba(16, 185, 129, 0.06) 0%, transparent 60%)
        `,
        animation: 'gradientShift 20s ease-in-out infinite',
        pointerEvents: 'none'
      }} />
      
      {/* Floating particles */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        overflow: 'hidden'
      }}>
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: getResponsiveValue('4px', '6px', '8px', deviceType),
              height: getResponsiveValue('4px', '6px', '8px', deviceType),
              background: `rgba(59, 130, 246, ${0.2 + i * 0.1})`,
              borderRadius: '50%',
              left: `${15 + i * 12}%`,
              top: `${20 + i * 8}%`,
              animation: `floatParticle ${10 + i * 2}s ease-in-out infinite`,
              animationDelay: `${i * 1.2}s`,
              boxShadow: `0 0 ${getResponsiveValue('8px', '12px', '16px', deviceType)} rgba(59, 130, 246, 0.3)`
            }}
          />
        ))}
      </div>
      
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header */}
        <div style={{
          background: 'rgba(10, 10, 15, 0.9)',
          backdropFilter: 'blur(20px)',
          borderRadius: getResponsiveValue('20px', '24px', '28px', deviceType),
          padding: getResponsiveValue('2rem 1.5rem', '2.5rem 2rem', '3rem 2.5rem', deviceType),
          marginBottom: getResponsiveValue('1.5rem', '2rem', '2.5rem', deviceType),
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(59, 130, 246, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Subtle grid pattern */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `
              linear-gradient(rgba(59, 130, 246, 0.05) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.05) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            pointerEvents: 'none'
          }} />
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              marginBottom: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType)
            }}>
              <div>
                <h1 style={{
                  fontSize: getResponsiveValue('1.5rem', '1.875rem', '2.25rem', deviceType),
                  fontWeight: '800',
                  color: 'white',
                  margin: 0,
                  letterSpacing: '-0.025em',
                  background: 'linear-gradient(135deg, #ffffff 0%, #e0e7ff 25%, #c7d2fe 50%, #a5b4fc 75%, #8b5cf6 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: '0 0 30px rgba(59, 130, 246, 0.3)'
                }}>
                  SyndicateXTokyo Portal
                </h1>
                <p style={{
                  color: '#c7d2fe',
                  fontSize: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType),
                  fontWeight: '500',
                  margin: '0.25rem 0 0 0',
                  textShadow: '0 0 20px rgba(167, 180, 252, 0.3)'
                }}>
                  Manage your NFT collections and track ownership
                </p>
              </div>
            </div>
            
          </div>
        </div>

        {/* Statistics Cards */}
        <StaggerChildren staggerDelay={0.1}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: getResponsiveValue(
              '1fr', 
              'repeat(2, 1fr)', 
              connected ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', 
              deviceType
            ),
            gap: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
            marginBottom: getResponsiveValue('1.5rem', '2rem', '2.5rem', deviceType)
          }}>
          {loading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              {connected && <StatCardSkeleton />}
            </>
          ) : (
            <>
              <StaggerItem>
                <FloatOnHover>
                  <StatCard
                    label="Total Collections"
                    value={collections.length}
                    icon={<LayoutGrid className="w-5 h-5" />}
                    onClick={() => setActiveTab('all')}
                    trendData={collectionsTrendData}
                    subtitle="Active collections"
                  />
                </FloatOnHover>
              </StaggerItem>
              <StaggerItem>
                <FloatOnHover>
                  <StatCard
                    label="Total Mints"
                    value={totalMints.toLocaleString()}
                    icon={<TrendingUp className="w-5 h-5" />}
                    onClick={() => setActiveTab('all')}
                    deltaPct={activityStats.weeklyGrowth}
                    trendData={mintsTrendData}
                    subtitle="All time mints"
                  />
                </FloatOnHover>
              </StaggerItem>
              {connected && (
                <StaggerItem>
                  <FloatOnHover>
                    <StatCard
                      label={activeTab === 'calendar' ? 'Event NFTs' : 'Owned NFTs'}
                      value={nftLoading ? '...' : (activeTab === 'calendar' ? eventNFTs.length : nonEventNFTs.length)}
                      icon={<Gem className="w-5 h-5" />}
                      loading={nftLoading}
                      onClick={() => setActiveTab(activeTab === 'calendar' ? 'calendar' : 'owned')}
                      trendData={activityStats.monthlyData}
                      subtitle="Your collection"
                    />
                  </FloatOnHover>
                </StaggerItem>
              )}
            </>
          )}
          </div>
        </StaggerChildren>

        {/* Tab Navigation */}
        <div style={{
          background: 'rgba(10, 10, 15, 0.8)',
          backdropFilter: 'blur(20px)',
          borderRadius: getResponsiveValue('16px', '18px', '20px', deviceType),
          marginBottom: getResponsiveValue('1.5rem', '2rem', '2.5rem', deviceType),
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(59, 130, 246, 0.2)',
          display: 'flex',
          overflowX: getResponsiveValue('auto', 'hidden', 'hidden', deviceType),
          WebkitOverflowScrolling: 'touch',
          padding: getResponsiveValue('6px', '8px', '10px', deviceType),
          border: '1px solid rgba(59, 130, 246, 0.3)',
          position: 'relative'
        }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              flex: getResponsiveValue('0 0 auto', '1', '1', deviceType),
              minWidth: getResponsiveValue('120px', 'auto', 'auto', deviceType),
              padding: getResponsiveValue('0.75rem 1rem', '0.875rem 1.25rem', '1rem 1.5rem', deviceType),
              background: activeTab === 'all' 
                ? 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)'
                : 'transparent',
              color: activeTab === 'all' ? 'white' : '#a5b4fc',
              border: 'none',
              borderRadius: getResponsiveValue('12px', '14px', '16px', deviceType),
              cursor: 'pointer',
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
              fontWeight: activeTab === 'all' ? '700' : '500',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              whiteSpace: 'nowrap',
              boxShadow: activeTab === 'all' 
                ? '0 8px 25px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)' 
                : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: getResponsiveValue('0.375rem', '0.5rem', '0.5rem', deviceType),
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>All NFTs</span>
          </button>
          <button
            onClick={() => setActiveTab('owned')}
            disabled={!connected}
            style={{
              flex: getResponsiveValue('0 0 auto', '1', '1', deviceType),
              minWidth: getResponsiveValue('130px', 'auto', 'auto', deviceType),
              padding: getResponsiveValue('0.75rem 1rem', '0.875rem 1.25rem', '1rem 1.5rem', deviceType),
              background: activeTab === 'owned' 
                ? 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)'
                : 'transparent',
              color: activeTab === 'owned' ? 'white' : !connected ? '#6b7280' : '#a5b4fc',
              border: 'none',
              borderRadius: getResponsiveValue('12px', '14px', '16px', deviceType),
              cursor: connected ? 'pointer' : 'not-allowed',
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
              fontWeight: activeTab === 'owned' ? '700' : '500',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              whiteSpace: 'nowrap',
              boxShadow: activeTab === 'owned' 
                ? '0 4px 16px rgba(30, 41, 59, 0.3)' 
                : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <Gem className="w-4 h-4" />
            <span>Owned</span>
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            disabled={!connected}
            style={{
              flex: getResponsiveValue('0 0 auto', '1', '1', deviceType),
              minWidth: getResponsiveValue('120px', 'auto', 'auto', deviceType),
              padding: getResponsiveValue('0.75rem 1rem', '0.875rem 1.25rem', '1rem 1.5rem', deviceType),
              background: activeTab === 'calendar' 
                ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                : 'transparent',
              color: activeTab === 'calendar' ? 'white' : !connected ? '#cbd5e1' : '#64748b',
              border: 'none',
              borderRadius: '14px',
              cursor: connected ? 'pointer' : 'not-allowed',
              fontSize: getResponsiveValue('true', 'false', 'false', deviceType) ? '0.875rem' : '0.9375rem',
              fontWeight: activeTab === 'calendar' ? '600' : '500',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              whiteSpace: 'nowrap',
              boxShadow: activeTab === 'calendar' 
                ? '0 4px 16px rgba(30, 41, 59, 0.3)' 
                : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Calendar</span>
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            disabled={!connected}
            style={{
              flex: getResponsiveValue('true', 'false', 'false', deviceType) ? '0 0 auto' : 1,
              minWidth: getResponsiveValue('true', 'false', 'false', deviceType) ? '120px' : 'auto',
              padding: getResponsiveValue('true', 'false', 'false', deviceType) ? '0.875rem 1.25rem' : '1rem 1.5rem',
              background: activeTab === 'activity' 
                ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                : 'transparent',
              color: activeTab === 'activity' ? 'white' : !connected ? '#cbd5e1' : '#64748b',
              border: 'none',
              borderRadius: '14px',
              cursor: connected ? 'pointer' : 'not-allowed',
              fontSize: getResponsiveValue('true', 'false', 'false', deviceType) ? '0.875rem' : '0.9375rem',
              fontWeight: activeTab === 'activity' ? '600' : '500',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              whiteSpace: 'nowrap',
              boxShadow: activeTab === 'activity' 
                ? '0 4px 16px rgba(30, 41, 59, 0.3)' 
                : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <ActivityIcon className="w-4 h-4" />
            <span>Activity</span>
          </button>
          {connected && (
            <button
              onClick={() => setActiveTab('dashboard')}
              style={{
                flex: getResponsiveValue('true', 'false', 'false', deviceType) ? '0 0 auto' : 1,
                minWidth: getResponsiveValue('true', 'false', 'false', deviceType) ? '120px' : 'auto',
                padding: getResponsiveValue('true', 'false', 'false', deviceType) ? '0.875rem 1.25rem' : '1rem 1.5rem',
                background: activeTab === 'dashboard' 
                  ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                  : 'transparent',
                color: activeTab === 'dashboard' ? 'white' : '#64748b',
                border: 'none',
                borderRadius: '14px',
                cursor: 'pointer',
                fontSize: getResponsiveValue('true', 'false', 'false', deviceType) ? '0.875rem' : '0.9375rem',
                fontWeight: activeTab === 'dashboard' ? '600' : '500',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                whiteSpace: 'nowrap',
                boxShadow: activeTab === 'dashboard' 
                  ? '0 4px 16px rgba(59, 130, 246, 0.3)' 
                  : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Dashboard</span>
            </button>
          )}
        </div>

        {/* Error State */}
        {hasCriticalErrors && (
          <div style={{
            background: 'white',
            borderRadius: getResponsiveValue('14px', '16px', '18px', deviceType),
            padding: getResponsiveValue('1.5rem', '2rem', '2.5rem', deviceType),
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            textAlign: 'center',
            border: '1px solid #fecaca'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <h2 style={{
              fontSize: getResponsiveValue('1.25rem', '1.5rem', '1.75rem', deviceType),
              fontWeight: '700',
              color: '#dc2626',
              marginBottom: '0.5rem'
            }}>
              Data Loading Error
            </h2>
            <p style={{
              color: '#6b7280',
              marginBottom: '1rem',
              fontSize: getResponsiveValue('0.875rem', '1rem', '1.125rem', deviceType)
            }}>
              Unable to load collections or events data. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.75rem 1.5rem',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.875rem'
              }}
            >
              Refresh Page
            </button>
          </div>
        )}

        {/* Content */}
        {loading && !hasCriticalErrors && (
          <div style={{
            background: 'white',
            borderRadius: getResponsiveValue('true', 'false', 'false', deviceType) ? '14px' : '16px',
            padding: getResponsiveValue('true', 'false', 'false', deviceType) ? '3rem 1.5rem' : '4rem',
            textAlign: 'center',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
          }}>
            <div style={{ 
              fontSize: getResponsiveValue('true', 'false', 'false', deviceType) ? '2rem' : '3rem', 
              marginBottom: '1.5rem',
              animation: 'spin 2s linear infinite',
              display: 'inline-block'
            }}>
              ⏳
            </div>
            <div style={{ 
              color: '#64748b', 
              fontSize: getResponsiveValue('true', 'false', 'false', deviceType) ? '1rem' : '1.125rem',
              fontWeight: '500' 
            }}>
              Loading...
            </div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}

        {/* All NFTs Tab */}
        {!loading && !hasCriticalErrors && activeTab === 'all' && (
          <div style={{
            background: 'white',
            borderRadius: getResponsiveValue('true', 'false', 'false', deviceType) ? '14px' : '16px',
            padding: getResponsiveValue('true', 'false', 'false', deviceType) ? '1.5rem' : '2rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
          }}>
            <CollectionsSection
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
          </div>
        )}

        {/* Owned NFTs Tab */}
        {!hasCriticalErrors && (activeTab as string) === 'owned' && (
          <div style={{
            background: 'white',
            borderRadius: getResponsiveValue('true', 'false', 'false', deviceType) ? '14px' : '16px',
            padding: getResponsiveValue('true', 'false', 'false', deviceType) ? '1.5rem 1rem' : getResponsiveValue('false', 'true', 'false', deviceType) ? '1.75rem' : '2rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
          }}>
            <h2 style={{
              fontSize: getResponsiveValue('true', 'false', 'false', deviceType) ? '1.25rem' : '1.5rem',
              fontWeight: '700',
              marginBottom: getResponsiveValue('true', 'false', 'false', deviceType) ? '1rem' : '1.5rem',
              color: '#1f2937',
              letterSpacing: '-0.01em'
            }}>
              Owned NFTs
            </h2>

            {!connected ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: '#1f2937' }}>
                  Connect Your Wallet
                </div>
                <div style={{ fontSize: '0.875rem' }}>
                  Connect your wallet to view your owned NFTs
                </div>
              </div>
            ) : nftLoading ? (
              <GridSkeleton count={6} columns={{ mobile: 1, tablet: 2, desktop: 3 }} />
            ) : nonEventNFTs.length === 0 ? (
              <EmptyNFTs
                title="No NFTs Found"
                description="You don't own any SXT NFTs yet"
                ctaLabel="Mint NFTs"
                ctaHref="https://www.tradeport.xyz/sui/collection/0x182ebe08d5895467a750dcad6d5acedb3c1f02f8048df8d3bf369bc24f43e911?tab=mint&bottomTab=trades&mintTokenId=e944ed92-4cfe-4dbd-a824-b7199ee0b1d7"
              />
            ) : (
              <OwnedNFTsSection
                connected={connected}
                nftLoading={nftLoading}
                nonEventNFTs={nonEventNFTs}
                collections={collections}
                deviceType={deviceType}
                setSelectedNFT={setSelectedNFT}
                setIsDrawerOpen={setIsDrawerOpen}
                convertIpfsUrl={convertIpfsUrl}
              />
            )}
          </div>
        )}

        {/* Calendar Tab */}
        {!hasCriticalErrors && (activeTab as string) === 'calendar' && (
          <div style={{
            background: 'white',
            borderRadius: getResponsiveValue('true', 'false', 'false', deviceType) ? '14px' : '16px',
            padding: getResponsiveValue('true', 'false', 'false', deviceType) ? '1.5rem 1rem' : getResponsiveValue('false', 'true', 'false', deviceType) ? '1.75rem' : '2rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
          }}>
            <h2 style={{
              fontSize: getResponsiveValue('true', 'false', 'false', deviceType) ? '1.25rem' : '1.5rem',
              fontWeight: '700',
              marginBottom: getResponsiveValue('true', 'false', 'false', deviceType) ? '1rem' : '1.5rem',
              color: '#1f2937',
              letterSpacing: '-0.01em'
            }}>
              Event Participation Calendar
            </h2>

            {!connected ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                  🔗
                </div>
                <div style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem', color: '#1f2937' }}>
                  Connect Your Wallet
                </div>
                <div style={{ fontSize: '0.875rem' }}>
                  Connect your wallet to view your event participation calendar
                </div>
              </div>
            ) : nftLoading ? (
              <CalendarSkeleton />
            ) : nftsByDate.size === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem',
                color: '#64748b'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                  📅
                </div>
                <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>
                  No Event Participation History
                </div>
              </div>
            ) : (
            <CalendarSection
                connected={connected}
                nftLoading={nftLoading}
                deviceType={deviceType}
                currentMonth={currentMonth}
                setCurrentMonth={setCurrentMonth}
                nftsByDate={nftsByDate}
                calendarGrid={calendarGrid}
              convertIpfsUrl={convertIpfsUrl}
                expandedEventDates={expandedEventDates}
                setExpandedEventDates={setExpandedEventDates}
                events={events}
              />
            )}
        </div>
        )}
        
        {/* Activity Tab */}
        {!hasCriticalErrors && connected && (activeTab as string) === 'activity' && (
          <div style={{
            background: 'white',
            borderRadius: getResponsiveValue('true', 'false', 'false', deviceType) ? '14px' : '16px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            overflow: 'hidden'
          }}>
            <ActivityTimeline
              activities={activities}
              loading={nftLoading}
              showStats={true}
              showFilters={true}
              onExport={() => {
                // CSV export functionality
                const csvData = activities.map(activity => ({
                  type: activity.type,
                  timestamp: new Date(activity.timestamp).toISOString(),
                  name: activity.mint?.name || (activity as any).transfer?.name || 'Unknown',
                  collection: activity.mint?.collection || 'N/A'
                }));
                
                const csvContent = [
                  'Type,Timestamp,Name,Collection',
                  ...csvData.map(row => `${row.type},${row.timestamp},${row.name},${row.collection}`)
                ].join('\n');
                
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `activity-export-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                window.URL.revokeObjectURL(url);
              }}
              onActivityClick={(activity) => {
                // Show NFT details for mint or transfer activities
                if (activity.type === 'mint' && activity.mint) {
                  const nft: OwnedNFT = {
                    objectId: activity.mint.objectId,
                    type: activity.mint.collection,
                    display: {
                      name: activity.mint.name,
                      image_url: activity.mint.image_url,
                    },
                  };
                  setSelectedNFT(nft);
                  setIsDrawerOpen(true);
                } else if (activity.type === 'transfer' && activity.transfer) {
                  const nft: OwnedNFT = {
                    objectId: activity.transfer.objectId,
                    type: '',
                    display: {
                      name: activity.transfer.name,
                      image_url: activity.transfer.image_url,
                    },
                  };
                  setSelectedNFT(nft);
                  setIsDrawerOpen(true);
                }
              }}
            />
          </div>
        )}

        {/* Dashboard Tab */}
        {!hasCriticalErrors && (activeTab as string) === 'dashboard' && (
          <div style={{
            background: 'white',
            borderRadius: getResponsiveValue('true', 'false', 'false', deviceType) ? '14px' : '16px',
            padding: getResponsiveValue('1.5rem', '2rem', '2.5rem', deviceType),
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem', gap: '0.5rem' }}>
              {(['personal','global'] as const).map((scope) => (
                <button
                  key={scope}
                  onClick={() => setDashboardScope(scope)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    border: dashboardScope === scope ? 'none' : '1px solid #e5e7eb',
                    borderRadius: '10px',
                    background: dashboardScope === scope ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'white',
                    color: dashboardScope === scope ? 'white' : '#64748b',
                    fontWeight: dashboardScope === scope ? 700 : 500,
                    cursor: 'pointer'
                  }}
                >
                  {scope === 'personal' ? 'Personal' : 'Global'}
                </button>
              ))}
            </div>
            <DashboardInsights
              dailyData={dashboardScope === 'personal' ? activityStats.dailyData : globalStats.dailyData}
              weeklyData={dashboardScope === 'personal' ? activityStats.weeklyData : globalStats.weeklyData}
              monthlyData={dashboardScope === 'personal' ? activityStats.monthlyData : globalStats.monthlyData}
              collectionStats={dashboardScope === 'personal' ? activityStats.collectionStats : globalStats.collectionStats}
              totalMints={dashboardScope === 'personal' ? activityStats.totalMints : globalStats.totalMints}
              totalOwned={dashboardScope === 'personal' ? activityStats.totalOwned : globalStats.totalOwned}
              dailyGrowth={dashboardScope === 'personal' ? activityStats.dailyGrowth : globalStats.dailyGrowth}
              weeklyGrowth={dashboardScope === 'personal' ? activityStats.weeklyGrowth : globalStats.weeklyGrowth}
              monthlyGrowth={dashboardScope === 'personal' ? activityStats.monthlyGrowth : globalStats.monthlyGrowth}
              recentActivity={dashboardScope === 'personal' ? activityStats.recentActivity : globalStats.recentActivity}
            />
          </div>
        )}
      </div>

      {/* NFT Detail Drawer */}
      <NFTDetailDrawer
        nft={selectedNFT}
        open={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedNFT(null);
        }}
      />
      
      {/* CSS Animations */}
      <style>{`
        @keyframes gradientShift {
          0%, 100% { 
            transform: translateX(0) translateY(0) scale(1) rotate(0deg);
            opacity: 0.6;
          }
          25% { 
            transform: translateX(20px) translateY(-15px) scale(1.05) rotate(2deg);
            opacity: 0.4;
          }
          50% { 
            transform: translateX(-15px) translateY(20px) scale(0.95) rotate(-1deg);
            opacity: 0.3;
          }
          75% { 
            transform: translateX(10px) translateY(-10px) scale(1.02) rotate(1deg);
            opacity: 0.5;
          }
        }
        
        @keyframes floatParticle {
          0%, 100% { 
            transform: translateY(0) translateX(0) scale(1);
            opacity: 0.3;
          }
          25% { 
            transform: translateY(-30px) translateX(15px) scale(1.2);
            opacity: 0.8;
          }
          50% { 
            transform: translateY(-60px) translateX(-10px) scale(0.8);
            opacity: 0.6;
          }
          75% { 
            transform: translateY(-40px) translateX(20px) scale(1.1);
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  );
};

export default HomePage;

