import React, { useState, useEffect, useMemo } from 'react';
import { useWalletWithErrorHandling } from '../hooks/useWallet';
import { StatCard, StatCardSkeleton } from '@/features/overview/StatCard';
import { EmptyNFTs } from '@/components/empty-states/EmptyNFTs';
import { GridSkeleton } from '@/components/skeletons/GridSkeleton';
import { CalendarSkeleton } from '@/components/skeletons/CalendarSkeleton';
import { StaggerChildren, StaggerItem } from '@/components/motion/FadeIn';
import { FloatOnHover } from '@/components/motion/ScaleIn';
import { Accordion, RotateIcon } from '@/components/motion/Accordion';
import { useCollections } from '@/hooks/queries/useCollections';
import { useEvents } from '@/hooks/queries/useEvents';
import { useOwnedNFTs, useOnchainCounts } from '@/hooks/queries/useNFTs';
import { NFTDetailDrawer } from '@/features/owned/NFTDetailDrawer';
import { ActivityTimeline } from '@/features/activity/ActivityTimeline';
import { 
  LayoutGrid, 
  TrendingUp, 
  Flame, 
  Gem, 
  Calendar as CalendarIcon,
  Activity as ActivityIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown
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

const Dashboard: React.FC = () => {
  const { account, connected } = useWalletWithErrorHandling() as any;
  const [activeTab, setActiveTab] = useState<'all' | 'owned' | 'calendar' | 'activity'>('all');
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [selectedNFT, setSelectedNFT] = useState<OwnedNFT | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Responsive design: Monitor window width
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Breakpoint detection
  const isMobile = windowWidth < 640;
  const isTablet = windowWidth >= 640 && windowWidth < 1024;

  // TanStack Query hooks
  const { data: collections = [], isLoading: collectionsLoading } = useCollections();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  
  // Create collection type paths
  const collectionTypes = useMemo(() => {
    return collections.map(col => col.id).filter(Boolean);
  }, [collections]);
  
  // Get on-chain counts
  const { data: onchainCounts = new Map() } = useOnchainCounts(collectionTypes);
  
  // Get owned NFTs
  const { data: allOwnedNFTs = [], isLoading: nftLoading } = useOwnedNFTs(
    account?.address || '', 
    collectionTypes
  );
  
  // Generate activities from owned NFTs
  const activities = useMemo(() => {
    if (!connected || allOwnedNFTs.length === 0) {
      return [];
    }

    // Convert owned NFTs to mint activities
    return allOwnedNFTs.map((nft) => {
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
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [connected, allOwnedNFTs]);

  // Calculate individual mint counts for events (on-chain total)
  // Note: May be shared across all events in the same collection,
  // accurate individual counts require event-name-filtered GraphQL queries
  // Currently showing collection totals for simplicity
  const eventMintCounts = useMemo(() => {
    const counts = new Map<string, number>();
    
    events.forEach(event => {
      // Get total mints for the collection
      const collectionTotal = onchainCounts.get(event.collectionId) || 0;
      
      // If there are other events in the same collection, distribute
      const sameCollectionEvents = events.filter(e => e.collectionId === event.collectionId);
      
      if (sameCollectionEvents.length > 1) {
        // Multiple events: calculate actual count from owned NFTs
        const userMintCount = allOwnedNFTs.filter(nft => nft.display?.name === event.name).length;
        counts.set(event.name, userMintCount > 0 ? userMintCount : Math.floor(collectionTotal / sameCollectionEvents.length));
      } else {
        // Single event: use collection total
        counts.set(event.name, collectionTotal);
      }
    });
    
    return counts;
  }, [events, onchainCounts, allOwnedNFTs]);

  // Integrate loading state
  const loading = collectionsLoading || eventsLoading;

  // Calculate statistics (optimized with useMemo)
  const totalMints = useMemo(() => {
    return Array.from(onchainCounts.values()).reduce((sum, count) => sum + count, 0);
  }, [onchainCounts]);

  const activeEvents = useMemo(() => {
    return events.filter(e => e.active).length;
  }, [events]);

  // Owned NFTs: Non-EventNFT type NFTs (Collection NFTs only)
  const nonEventNFTs = useMemo(() => {
    return allOwnedNFTs.filter(nft => 
      // Show only NFTs that are not EventNFT type
      nft.type && !nft.type.includes('::sxt_nft::EventNFT')
    );
  }, [allOwnedNFTs]);

  // Event NFTs: EventNFT type and registered in events
  const eventNFTs = useMemo(() => {
    const eventNames = new Set(events.map(e => e.name));
    return allOwnedNFTs.filter(nft => 
      nft.type && nft.type.includes('::sxt_nft::EventNFT') && 
      nft.display?.name && eventNames.has(nft.display.name)
    );
  }, [allOwnedNFTs, events]);

  // For calendar: Group event NFTs by event date
  const nftsByDate = useMemo(() => {
    const map = new Map<string, OwnedNFT[]>();
    
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
      padding: isMobile ? '1rem 0.5rem' : isTablet ? '1.5rem 1rem' : '2rem 1rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        borderRadius: isMobile ? '20px' : '24px',
          padding: isMobile ? '2.5rem 1.5rem' : isTablet ? '3rem 2rem' : '3.5rem 2.5rem',
          marginBottom: isMobile ? '2rem' : '2.5rem',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {/* Glassmorphism overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(168, 85, 247, 0.1) 100%)',
            backdropFilter: 'blur(10px)'
          }} />
          
          {/* Subtle grid pattern */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
            opacity: 0.5
          }} />
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h1 style={{
              fontSize: isMobile ? '1.875rem' : isTablet ? '2.25rem' : '2.75rem',
              fontWeight: '700',
              color: 'white',
              marginBottom: '0.75rem',
              letterSpacing: '-0.025em',
              background: 'linear-gradient(135deg, #ffffff 0%, #a8a8a8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              SyndicateXTokyo
            </h1>
            <p style={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: isMobile ? '0.9375rem' : '1rem',
              fontWeight: '400',
              lineHeight: '1.6',
              letterSpacing: '0.01em'
            }}>
              Manage your NFT collections and track ownership
            </p>
          </div>
        </div>

        {/* Statistics Cards */}
        <StaggerChildren staggerDelay={0.1}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile 
              ? '1fr' 
              : isTablet
                ? 'repeat(2, 1fr)'
                : connected 
                  ? 'repeat(4, 1fr)' 
                  : 'repeat(3, 1fr)',
            gap: isMobile ? '1rem' : '1.5rem',
            marginBottom: isMobile ? '1.5rem' : '2rem'
          }}>
          {loading ? (
            <>
              <StatCardSkeleton />
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
                  />
                </FloatOnHover>
              </StaggerItem>
              <StaggerItem>
                <FloatOnHover>
                  <StatCard
                    label="Active Events"
                    value={activeEvents}
                    icon={<Flame className="w-5 h-5" />}
                    onClick={() => setActiveTab('all')}
                  />
                </FloatOnHover>
              </StaggerItem>
              {connected && (
                <StaggerItem>
                  <FloatOnHover>
                    <StatCard
                      label={activeTab === 'calendar' ? 'Event NFTs' : 'Collection NFTs'}
                      value={nftLoading ? '...' : (activeTab === 'calendar' ? eventNFTs.length : nonEventNFTs.length)}
                      icon={<Gem className="w-5 h-5" />}
                      loading={nftLoading}
                      onClick={() => setActiveTab(activeTab === 'calendar' ? 'calendar' : 'owned')}
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
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: isMobile ? '16px' : '20px',
          marginBottom: isMobile ? '1.5rem' : '2rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          overflowX: isMobile ? 'auto' : 'hidden',
          WebkitOverflowScrolling: 'touch',
          padding: '8px',
          border: '1px solid rgba(0, 0, 0, 0.05)'
        }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              flex: isMobile ? '0 0 auto' : 1,
              minWidth: isMobile ? '120px' : 'auto',
              padding: isMobile ? '0.875rem 1.25rem' : '1rem 1.5rem',
              background: activeTab === 'all' 
                ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                : 'transparent',
              color: activeTab === 'all' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '14px',
              cursor: 'pointer',
              fontSize: isMobile ? '0.875rem' : '0.9375rem',
              fontWeight: activeTab === 'all' ? '600' : '500',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              whiteSpace: 'nowrap',
              boxShadow: activeTab === 'all' 
                ? '0 4px 16px rgba(30, 41, 59, 0.3)' 
                : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>All NFTs</span>
          </button>
          <button
            onClick={() => setActiveTab('owned')}
            disabled={!connected}
            style={{
              flex: isMobile ? '0 0 auto' : 1,
              minWidth: isMobile ? '130px' : 'auto',
              padding: isMobile ? '0.875rem 1.25rem' : '1rem 1.5rem',
              background: activeTab === 'owned' 
                ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                : 'transparent',
              color: activeTab === 'owned' ? 'white' : !connected ? '#cbd5e1' : '#64748b',
              border: 'none',
              borderRadius: '14px',
              cursor: connected ? 'pointer' : 'not-allowed',
              fontSize: isMobile ? '0.875rem' : '0.9375rem',
              fontWeight: activeTab === 'owned' ? '600' : '500',
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
              flex: isMobile ? '0 0 auto' : 1,
              minWidth: isMobile ? '120px' : 'auto',
              padding: isMobile ? '0.875rem 1.25rem' : '1rem 1.5rem',
              background: activeTab === 'calendar' 
                ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                : 'transparent',
              color: activeTab === 'calendar' ? 'white' : !connected ? '#cbd5e1' : '#64748b',
              border: 'none',
              borderRadius: '14px',
              cursor: connected ? 'pointer' : 'not-allowed',
              fontSize: isMobile ? '0.875rem' : '0.9375rem',
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
              flex: isMobile ? '0 0 auto' : 1,
              minWidth: isMobile ? '120px' : 'auto',
              padding: isMobile ? '0.875rem 1.25rem' : '1rem 1.5rem',
              background: activeTab === 'activity' 
                ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                : 'transparent',
              color: activeTab === 'activity' ? 'white' : !connected ? '#cbd5e1' : '#64748b',
              border: 'none',
              borderRadius: '14px',
              cursor: connected ? 'pointer' : 'not-allowed',
              fontSize: isMobile ? '0.875rem' : '0.9375rem',
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
        </div>

        {/* Content */}
        {loading && (
          <div style={{
            background: 'white',
            borderRadius: isMobile ? '14px' : '16px',
            padding: isMobile ? '3rem 1.5rem' : '4rem',
            textAlign: 'center',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
          }}>
            <div style={{ 
              fontSize: isMobile ? '2rem' : '3rem', 
              marginBottom: '1.5rem',
              animation: 'spin 2s linear infinite',
              display: 'inline-block'
            }}>
              ⏳
            </div>
            <div style={{ 
              color: '#64748b', 
              fontSize: isMobile ? '1rem' : '1.125rem',
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
        {!loading && activeTab === 'all' && (
          <div style={{
            background: 'white',
            borderRadius: isMobile ? '14px' : '16px',
            padding: isMobile ? '1.5rem' : '2rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
          }}>
            <h2 style={{
              fontSize: isMobile ? '1.25rem' : '1.5rem',
              fontWeight: '700',
              marginBottom: '1.5rem',
              color: '#1f2937',
              letterSpacing: '-0.01em'
            }}>
              SXT-Issued NFT Collections
            </h2>

            {collections.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem 1rem',
                color: '#94a3b8'
              }}>
                No collections available yet
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gap: '1.5rem'
              }}>
                {collections.map((collection) => {
                  const collectionEvents = events.filter(e => e.collectionId === collection.id);
                  const collectionMints = onchainCounts.get(collection.id) || 0;
                  const isExpanded = expandedCollections.has(collection.id);

                  return (
                    <div
                      key={collection.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: isMobile ? '10px' : '12px',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                      }}
                      onMouseEnter={(e) => {
                        if (!isMobile) {
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                          e.currentTarget.style.transform = 'translateY(-2px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isMobile) {
                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }
                      }}
                    >
                      {/* コレクションヘッダー（常に表示・クリック可能） */}
                      <div
                        onClick={() => {
                          const newExpanded = new Set(expandedCollections);
                          if (isExpanded) {
                            newExpanded.delete(collection.id);
                          } else {
                            newExpanded.add(collection.id);
                          }
                          setExpandedCollections(newExpanded);
                        }}
            style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: isMobile ? '0.75rem 1rem' : '1rem 1.5rem',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                          minHeight: '44px'
                        }}
                        onMouseEnter={(e) => {
                          if (!isMobile) e.currentTarget.style.background = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                          if (!isMobile) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.75rem', flex: 1 }}>
                          <RotateIcon isOpen={isExpanded} icon="▶" />
                          <div>
                            <h3 style={{
                              fontSize: isMobile ? '1rem' : '1.125rem',
                              fontWeight: 'bold',
                              color: '#1a1a1a',
                              margin: 0
                            }}>
                              {collection.name}
                            </h3>
                            {collectionEvents.length > 0 && (
                              <div style={{
                                fontSize: isMobile ? '0.7rem' : '0.75rem',
                                color: '#94a3b8',
                                marginTop: '0.25rem'
                              }}>
                                {collectionEvents.length} events
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem'
                        }}>
                          <div style={{
                            textAlign: 'right'
                          }}>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              Total Mints
                            </div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: collectionMints > 0 ? '#667eea' : '#94a3b8' }}>
                              {collectionMints !== undefined ? collectionMints : '...'}
            </div>
            </div>
          </div>
        </div>

                      {/* Details (shown when expanded) */}
                      <Accordion isOpen={isExpanded} duration={0.3}>
                        <div style={{
                          padding: isMobile ? '0.75rem 1rem 1rem 1rem' : '1rem 1.5rem 1.5rem 1.5rem',
                          background: '#f9fafb'
                        }}>
                          {collectionEvents.length > 0 && (
                            <div>
                              <div style={{
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                color: '#64748b',
                                marginBottom: '0.75rem'
                              }}>
                                Mint Events
                              </div>
                              <div style={{ display: 'grid', gap: '0.5rem' }}>
                                {collectionEvents.map((event) => (
                                  <div
                                    key={event.id}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: isMobile ? 'flex-start' : 'center',
                                      flexDirection: isMobile ? 'column' : 'row',
                                      gap: isMobile ? '0.5rem' : '0',
                                      padding: isMobile ? '0.75rem 0.5rem' : '0.75rem',
                                      background: 'white',
                                      borderRadius: isMobile ? '6px' : '8px',
                                      border: '1px solid #e5e7eb',
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!isMobile) {
                                        e.currentTarget.style.background = '#f9fafb';
                                        e.currentTarget.style.transform = 'translateX(4px)';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!isMobile) {
                                        e.currentTarget.style.background = 'white';
                                        e.currentTarget.style.transform = 'translateX(0)';
                                      }
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '0.75rem', width: isMobile ? '100%' : 'auto' }}>
                                      {event.imageUrl && (
                                        <img
                                          src={event.imageUrl}
                                          alt={event.name}
                                          style={{
                                            width: isMobile ? '32px' : '40px',
                                            height: isMobile ? '32px' : '40px',
                                            borderRadius: '6px',
                                            objectFit: 'cover'
                                          }}
                                        />
                                      )}
                                      <div style={{ flex: isMobile ? 1 : 'none' }}>
                                        <div style={{
                                          fontWeight: '600',
                                          color: '#1a1a1a',
                                          fontSize: isMobile ? '0.8rem' : '0.875rem'
                                        }}>
                                          {event.name}
                                        </div>
                                        {event.description && !isMobile && (
                                          <div style={{
                                            fontSize: '0.75rem',
                                            color: '#999',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            maxWidth: '200px'
                                          }}>
                                            {event.description}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '0.5rem'
                                    }}>
                                      <span style={{
                                        fontSize: '0.875rem',
                                        fontWeight: '600',
                                        color: '#667eea'
                                      }}>
                                        {eventMintCounts.get(event.name) || 0}
                                        {event.totalCap ? ` / ${event.totalCap}` : ''} mints
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </Accordion>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Owned NFTs Tab */}
        {activeTab === 'owned' && (
          <div style={{
            background: 'white',
            borderRadius: isMobile ? '14px' : '16px',
            padding: isMobile ? '1.5rem 1rem' : isTablet ? '1.75rem' : '2rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
          }}>
            <h2 style={{
              fontSize: isMobile ? '1.25rem' : '1.5rem',
              fontWeight: '700',
              marginBottom: isMobile ? '1rem' : '1.5rem',
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
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile 
                  ? '1fr' 
                  : isTablet 
                    ? 'repeat(auto-fill, minmax(250px, 1fr))' 
                    : 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: isMobile ? '1rem' : '1.5rem'
              }}>
                {nonEventNFTs.map((nft) => {
                  const collection = collections.find(c => c.id === nft.type);
                  
                  return (
                                    <div
                                      key={nft.objectId}
                                      onClick={() => {
                                        setSelectedNFT(nft);
                                        setIsDrawerOpen(true);
                                      }}
                                      style={{
                                        border: '1px solid #e5e7eb',
                                        borderRadius: isMobile ? '10px' : '12px',
                                        overflow: 'hidden',
                                        transition: 'all 0.3s ease',
                                        cursor: 'pointer',
                                        background: 'white',
                                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!isMobile) {
                                          e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.15)';
                                          e.currentTarget.style.transform = 'translateY(-4px)';
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (!isMobile) {
                                          e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
                                          e.currentTarget.style.transform = 'translateY(0)';
                                        }
                                      }}
                                      onTouchStart={(e) => {
                                        if (isMobile) {
                                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)';
                                        }
                                      }}
                                      onTouchEnd={(e) => {
                                        if (isMobile) {
                                          setTimeout(() => {
                                            e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
                                          }, 150);
                                        }
                                      }}
                                    >
                      {nft.display?.image_url && (
                        <img
                          src={convertIpfsUrl(nft.display?.image_url)}
                          alt={nft.display?.name || 'NFT'}
                          style={{
                            width: '100%',
                            height: '200px',
                            objectFit: 'cover',
                            background: '#f3f4f6'
                          }}
                          onError={(e) => {
                            // Handle image load errors
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                                      <div style={{ padding: isMobile ? '0.75rem' : '1rem' }}>
                                        <h3 style={{
                                          fontSize: isMobile ? '0.875rem' : '1rem',
                                          fontWeight: 'bold',
                                          color: '#1a1a1a',
                                          marginBottom: '0.5rem'
                                        }}>
                                          {nft.display?.name || 'Unnamed NFT'}
                                        </h3>
                                        {nft.display?.description && (
                                          <p style={{
                                            fontSize: isMobile ? '0.8rem' : '0.875rem',
                                            color: '#666',
                                            marginBottom: '0.75rem',
                                            lineHeight: '1.5',
                                            overflow: 'hidden',
                                            display: '-webkit-box',
                                            WebkitLineClamp: isMobile ? 2 : 3,
                                            WebkitBoxOrient: 'vertical'
                                          }}>
                                            {nft.display?.description}
                                          </p>
                                        )}
                        {collection && (
                          <div style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            background: '#ede9fe',
                            color: '#5b21b6',
                            marginBottom: '0.75rem'
                          }}>
                            {collection.name}
                          </div>
                        )}
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#999',
                          wordBreak: 'break-all'
                        }}>
                          ID: {nft.objectId.slice(0, 8)}...{nft.objectId.slice(-6)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div style={{
            background: 'white',
            borderRadius: isMobile ? '14px' : '16px',
            padding: isMobile ? '1.5rem 1rem' : isTablet ? '1.75rem' : '2rem',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)'
          }}>
            <h2 style={{
              fontSize: isMobile ? '1.25rem' : '1.5rem',
              fontWeight: '700',
              marginBottom: isMobile ? '1rem' : '1.5rem',
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
              <>
                {/* Month Navigation */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '2rem' 
                }}>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                    style={{
                      padding: isMobile ? '0.5rem 0.75rem' : '0.5rem 1rem',
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: isMobile ? '10px' : '12px',
                      cursor: 'pointer',
                      fontSize: isMobile ? '0.8125rem' : '0.875rem',
                      minHeight: '44px',
                      fontWeight: '600',
                      color: '#475569',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>
                  <h3 style={{ fontSize: isMobile ? '1rem' : '1.25rem', fontWeight: '700', color: '#1f2937' }}>
                    {currentMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
                  </h3>
                  <button
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                    style={{
                      padding: isMobile ? '0.5rem 0.75rem' : '0.5rem 1rem',
                      background: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: isMobile ? '10px' : '12px',
                      cursor: 'pointer',
                      fontSize: isMobile ? '0.8125rem' : '0.875rem',
                      minHeight: '44px',
                      fontWeight: '600',
                      color: '#475569',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Calendar Grid */}
        <div style={{
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: isMobile ? '0.25rem' : '0.5rem',
                  marginBottom: isMobile ? '1.5rem' : '2rem'
                }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                    <div key={`header-${i}`} style={{ 
                      textAlign: 'center', 
                      fontWeight: '700',
                      padding: isMobile ? '0.25rem' : '0.5rem',
                      color: '#64748b',
                      fontSize: isMobile ? '0.7rem' : '0.875rem'
                    }}>
                      {isMobile ? day.charAt(0) : day}
                    </div>
                  ))}
                  
                  {calendarGrid.map((day, index) => {
                    if (day === null) {
                      return <div key={`empty-${index}`} />;
                    }
                    
                    const year = currentMonth.getFullYear();
                    const month = currentMonth.getMonth();
                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const hasEvent = nftsByDate.has(dateStr);
                    const dayNFTs = nftsByDate.get(dateStr) || [];
                    
                    return (
                      <div
                        key={day}
                        style={{
                          border: '1px solid #e5e7eb',
                          borderRadius: isMobile ? '8px' : '10px',
                          padding: isMobile ? '0.25rem' : '0.5rem',
          textAlign: 'center',
                          background: hasEvent ? '#ede9fe' : 'white',
                          cursor: hasEvent ? 'pointer' : 'default',
                          minHeight: isMobile ? '44px' : '60px',
                          position: 'relative',
                          fontSize: isMobile ? '0.875rem' : '1rem',
                          transition: 'all 0.2s ease'
                        }}
                        title={hasEvent ? `${dayNFTs.length} event participation(s)` : ''}
                        onMouseEnter={(e) => {
                          if (hasEvent && !isMobile) {
                            e.currentTarget.style.background = '#ddd6fe';
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (hasEvent && !isMobile) {
                            e.currentTarget.style.background = '#ede9fe';
                            e.currentTarget.style.transform = 'scale(1)';
                          }
                        }}
                        onTouchStart={(e) => {
                          if (hasEvent && isMobile) {
                            e.currentTarget.style.background = '#ddd6fe';
                          }
                        }}
                        onTouchEnd={(e) => {
                          if (hasEvent && isMobile) {
                            setTimeout(() => {
                              e.currentTarget.style.background = '#ede9fe';
                            }, 150);
                          }
                        }}
                      >
                        <div style={{ 
                          fontWeight: hasEvent ? 'bold' : 'normal',
                          color: '#1f2937'
                        }}>
                          {day}
                        </div>
                        {hasEvent && (
                          <div style={{
                            fontSize: isMobile ? '0.65rem' : '0.75rem',
                            color: '#7c3aed',
                            marginTop: '0.25rem',
                            fontWeight: '600'
                          }}>
                            {dayNFTs.length}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Event List */}
                <div>
                  <h4 style={{ 
                    fontSize: isMobile ? '0.8125rem' : '0.875rem', 
                    fontWeight: '600', 
                    marginBottom: isMobile ? '0.75rem' : '1rem', 
                    color: '#64748b',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Recent Events
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '0.375rem' : '0.5rem' }}>
                    {Array.from(nftsByDate.entries())
                      .sort(([a], [b]) => b.localeCompare(a))
                      .slice(0, 10)
                      .map(([date, nfts]) => {
                        const isExpanded = expandedEventDates.has(date);
                        
                      return (
                        <div key={date} style={{ 
                          background: 'white',
                          borderRadius: isMobile ? '10px' : '12px',
                          border: '1px solid #e5e7eb',
                          overflow: 'hidden',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isMobile) {
                            e.currentTarget.style.borderColor = '#cbd5e1';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.06)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isMobile) {
                            e.currentTarget.style.borderColor = '#e5e7eb';
                            e.currentTarget.style.boxShadow = 'none';
                          }
                        }}
                        >
                              {nfts.map((nft, idx) => {
                                const matchingEvent = events.find(e => e.name === nft.display?.name);
                                
                                return (
                                  <div key={nft.objectId}>
                                    <div
                                      onClick={() => {
                                        const newExpanded = new Set(expandedEventDates);
                                        if (isExpanded) {
                                          newExpanded.delete(date);
                                        } else {
                                          newExpanded.add(date);
                                        }
                                        setExpandedEventDates(newExpanded);
                                      }}
                                      style={{ 
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: isMobile ? '0.75rem 1rem' : '0.875rem 1.25rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        background: idx > 0 ? 'transparent' : 'transparent',
                                        borderTop: idx > 0 ? '1px solid #f1f5f9' : 'none'
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!isMobile) {
                                          e.currentTarget.style.background = '#f8fafc';
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        if (!isMobile) {
                                          e.currentTarget.style.background = 'transparent';
                                        }
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                                        <ChevronDown 
                                          className="w-4 h-4"
                                          style={{
                                            transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                                            transition: 'transform 0.2s ease',
                                            color: '#94a3b8',
                                            flexShrink: 0
                                          }}
                                        />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                          <div style={{ 
                                            fontSize: isMobile ? '0.875rem' : '0.9375rem', 
                                            fontWeight: '600',
                                            color: '#1e293b',
                                            marginBottom: '0.125rem'
                                          }}>
                                            {nft.display?.name}
                                          </div>
                                          <div style={{ 
                                            fontSize: isMobile ? '0.75rem' : '0.8125rem', 
                                            color: '#64748b'
                                          }}>
                                            {new Date(date).toLocaleDateString('en-US', {
                                              month: 'short',
                                              day: 'numeric',
                                              year: 'numeric'
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {isExpanded && (
                                      <div style={{
                                        padding: isMobile ? '0.75rem 1rem 1rem 3rem' : '0.875rem 1.25rem 1rem 3.25rem',
                                        background: '#f8fafc',
                                        borderTop: '1px solid #f1f5f9'
                                      }}>
                                        <div style={{ 
                                          display: 'flex', 
                                          gap: isMobile ? '0.75rem' : '1rem',
                                          alignItems: 'flex-start'
                                        }}>
                                          {nft.display?.image_url && (
                                            <div style={{
                                              width: isMobile ? '64px' : '80px',
                                              height: isMobile ? '64px' : '80px',
                                              background: '#f3f4f6',
                                              borderRadius: '8px',
                                              overflow: 'hidden',
                                              flexShrink: 0,
                                              border: '1px solid #e5e7eb'
                                            }}>
                                              <img
                                                src={convertIpfsUrl(nft.display?.image_url)}
                                                alt={nft.display?.name || 'NFT'}
                                                style={{
                                                  width: '100%',
                                                  height: '100%',
                                                  objectFit: 'cover'
                                                }}
                                                onError={(e) => {
                                                  e.currentTarget.parentElement!.style.display = 'none';
                                                }}
                                              />
                                            </div>
                                          )}
                                          <div style={{ 
                                            flex: 1,
                                            minWidth: 0
                                          }}>
                                            {matchingEvent?.description && (
                                              <p style={{
                                                fontSize: isMobile ? '0.8125rem' : '0.875rem',
                                                color: '#64748b',
                                                lineHeight: '1.5',
                                                marginBottom: '0.5rem',
                                                overflow: 'hidden',
                                                display: '-webkit-box',
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: 'vertical'
                                              }}>
                                                {matchingEvent.description}
                                              </p>
                                            )}
                                            <div style={{
                                              fontSize: '0.75rem',
                                              color: '#94a3b8',
                                              fontFamily: 'monospace'
                                            }}>
                                              {nft.objectId.slice(0, 8)}...{nft.objectId.slice(-6)}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            )}
        </div>
        )}
        
        {/* Activity Tab */}
        {connected && activeTab === 'activity' && (
          <div style={{
            background: 'white',
            borderRadius: isMobile ? '14px' : '16px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            overflow: 'hidden'
          }}>
            <ActivityTimeline
              activities={activities}
              loading={nftLoading}
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
    </div>
  );
};

export default Dashboard;

