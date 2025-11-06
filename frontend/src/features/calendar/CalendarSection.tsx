import React, { useMemo, useRef } from 'react';
import { CalendarSkeleton } from '../../components/skeletons/CalendarSkeleton';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { getResponsiveValue } from '../../hooks/useResponsive';
import { getImageDisplayUrl } from '../../utils/walrus';

interface OwnedNFT { 
  objectId: string; 
  type: string;
  display?: { 
    name?: string; 
    image_url?: string;
    description?: string;
    event_date?: string;
  };
  owner?: any;
}

interface Event {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  imageCid?: string;
  imageMimeType?: string;
  active: boolean;
  startAt?: string;
  endAt?: string;
  eventDate?: string;
  detailUrl?: string;
  collectionId: string;
  totalCap?: number;
  mintedCount?: number;
  moveCall: {
    target: string;
    argumentsTemplate: string;
  };
}

interface Props {
  connected: boolean;
  nftLoading: boolean;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  currentMonth: Date;
  setCurrentMonth: (d: Date) => void;
  nftsByDate: Map<string, OwnedNFT[]>;
  upcomingEventsByDate: Map<string, Event[]>;
  calendarGrid: (number | null)[];
  convertIpfsUrl: (url: string | undefined) => string | undefined;
  expandedEventDates: Set<string>;
  setExpandedEventDates: (s: Set<string>) => void;
  events?: Event[];
}

export const CalendarSection: React.FC<Props> = ({
  connected,
  nftLoading,
  deviceType,
  currentMonth,
  setCurrentMonth,
  nftsByDate,
  upcomingEventsByDate,
  calendarGrid,
  convertIpfsUrl,
  expandedEventDates,
  setExpandedEventDates,
  events = [],
}) => {
  if (!connected) {
    return (
      <div style={{ textAlign: 'center', padding: getResponsiveValue('2rem 1rem', '2.5rem 1.5rem', '3rem 2rem', deviceType), color: '#a5b4fc' }}>
        <div style={{ fontSize: getResponsiveValue('2rem', '2.5rem', '3rem', deviceType), marginBottom: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType) }}>🔗</div>
        <div style={{ fontSize: getResponsiveValue('0.875rem', '1rem', '1.125rem', deviceType), fontWeight: '600', marginBottom: getResponsiveValue('0.375rem', '0.5rem', '0.5rem', deviceType), color: '#e0e7ff' }}>Connect Your Wallet</div>
        <div style={{ fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.875rem', deviceType) }}>Connect your wallet to view your event participation calendar</div>
      </div>
    );
  }

  if (nftLoading) return <CalendarSkeleton />;

  // 現在の月のイベントのみをフィルタリング（参加履歴）
  const currentMonthEvents = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const filtered = new Map<string, OwnedNFT[]>();
    
    nftsByDate.forEach((nfts, dateStr) => {
      // 文字列を直接解析（YYYY-MM-DD形式）
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const dateYear = parseInt(parts[0], 10);
        const dateMonth = parseInt(parts[1], 10) - 1; // 月は0ベース
        if (dateYear === year && dateMonth === month) {
          filtered.set(dateStr, nfts);
        }
      }
    });
    
    return filtered;
  }, [nftsByDate, currentMonth]);

  // 現在の月のupcomingイベントをフィルタリング
  const currentMonthUpcomingEvents = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const filtered = new Map<string, Event[]>();
    
    upcomingEventsByDate.forEach((events, dateStr) => {
      // 文字列を直接解析（YYYY-MM-DD形式）
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const dateYear = parseInt(parts[0], 10);
        const dateMonth = parseInt(parts[1], 10) - 1; // 月は0ベース
        if (dateYear === year && dateMonth === month) {
          filtered.set(dateStr, events);
        }
      }
    });
    
    return filtered;
  }, [upcomingEventsByDate, currentMonth]);

  // 月間のイベント統計
  const monthlyStats = useMemo(() => {
    let totalEvents = 0;
    let totalNFTs = 0;
    let totalUpcoming = 0;
    
    currentMonthEvents.forEach((nfts) => {
      totalEvents += 1;
      totalNFTs += nfts.length;
    });
    
    currentMonthUpcomingEvents.forEach((events) => {
      totalUpcoming += events.length;
    });
    
    return { totalEvents, totalNFTs, totalUpcoming };
  }, [currentMonthEvents, currentMonthUpcomingEvents]);

  // 今日の日付を取得
  const today = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  // イベントリストへの参照
  const eventListRef = useRef<HTMLDivElement>(null);

  if (nftsByDate.size === 0) {
    return (
      <div 
        role="status" 
        aria-live="polite"
        style={{ textAlign: 'center', padding: getResponsiveValue('2rem 1rem', '2.5rem 1.5rem', '3rem 2rem', deviceType), color: '#a5b4fc' }}
      >
        <div style={{ fontSize: getResponsiveValue('2rem', '2.5rem', '3rem', deviceType), marginBottom: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType) }}>📅</div>
        <div style={{ fontSize: getResponsiveValue('0.875rem', '1rem', '1.125rem', deviceType), fontWeight: '600', color: '#e0e7ff' }}>No Event Participation History</div>
      </div>
    );
  }

  return (
    <>
      {/* Month Navigation */}
      <div 
        role="toolbar" 
        aria-label="カレンダーの月ナビゲーション"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}
      >
        <button
          type="button"
          aria-label="前の月"
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
            }
          }}
          style={{
            padding: getResponsiveValue('0.5rem 0.75rem', '0.5rem 1rem', '0.5rem 1rem', deviceType),
            background: 'rgba(30, 27, 75, 0.6)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(79, 70, 229, 0.3)',
            color: '#c7d2fe',
            borderRadius: getResponsiveValue('10px', '12px', '12px', deviceType),
            cursor: 'pointer',
            fontSize: getResponsiveValue('0.8125rem', '0.875rem', '0.875rem', deviceType),
            minHeight: '44px',
            fontWeight: '600',
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          <span>Previous</span>
        </button>
        <h3 
          id="current-month-title"
          style={{ fontSize: getResponsiveValue('1rem', '1.25rem', '1.25rem', deviceType), fontWeight: '700', color: '#e0e7ff' }}
        >
          {currentMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
        </h3>
        <button
          type="button"
          aria-label="次の月"
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
            }
          }}
          style={{
            padding: getResponsiveValue('0.5rem 0.75rem', '0.5rem 1rem', '0.5rem 1rem', deviceType),
            background: 'rgba(30, 27, 75, 0.6)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(79, 70, 229, 0.3)',
            color: '#c7d2fe',
            borderRadius: getResponsiveValue('10px', '12px', '12px', deviceType),
            cursor: 'pointer',
            fontSize: getResponsiveValue('0.8125rem', '0.875rem', '0.875rem', deviceType),
            minHeight: '44px',
            fontWeight: '600',
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: '0.5rem'
          }}
        >
          <span>Next</span>
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Monthly Statistics */}
      {(monthlyStats.totalEvents > 0 || monthlyStats.totalUpcoming > 0) && (
        <div 
          role="status" 
          aria-live="polite"
          style={{ 
            marginBottom: getResponsiveValue('1rem', '1.5rem', '1.5rem', deviceType),
            padding: getResponsiveValue('0.75rem 1rem', '0.875rem 1.25rem', '0.875rem 1.25rem', deviceType),
            background: 'rgba(30, 27, 75, 0.6)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(79, 70, 229, 0.3)',
            borderRadius: getResponsiveValue('10px', '12px', '12px', deviceType),
            fontSize: getResponsiveValue('0.8125rem', '0.875rem', '0.875rem', deviceType),
            color: '#c7d2fe',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}
        >
          {monthlyStats.totalEvents > 0 && (
            <span style={{ fontWeight: '600', color: '#e0e7ff' }}>
              参加済み: {monthlyStats.totalEvents}件のイベント日 ({monthlyStats.totalNFTs}個のNFT)
            </span>
          )}
          {monthlyStats.totalUpcoming > 0 && (
            <span style={{ fontWeight: '600', color: '#34d399' }}>
              開催予定: {monthlyStats.totalUpcoming}件のイベント
            </span>
          )}
        </div>
      )}

      {/* Calendar Grid */}
      <div 
        role="grid" 
        aria-labelledby="current-month-title"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: getResponsiveValue('0.25rem', '0.5rem', '0.5rem', deviceType), marginBottom: getResponsiveValue('1.5rem', '2rem', '2rem', deviceType) }}
      >
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
          <div 
            key={`header-${i}`} 
            role="columnheader"
            aria-label={day}
            style={{ textAlign: 'center', fontWeight: '700', padding: getResponsiveValue('0.25rem', '0.5rem', '0.5rem', deviceType), color: '#a5b4fc', fontSize: getResponsiveValue('0.7rem', '0.875rem', '0.875rem', deviceType) }}
          >
            {getResponsiveValue(day.charAt(0), day, day, deviceType)}
          </div>
        ))}
        {calendarGrid.map((day, index) => {
          if (day === null) return <div key={`empty-${index}`} role="gridcell" aria-hidden="true" />;
          const year = currentMonth.getFullYear();
          const month = currentMonth.getMonth();
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const hasEvent = currentMonthEvents.has(dateStr);
          const dayNFTs = currentMonthEvents.get(dateStr) || [];
          const hasUpcoming = currentMonthUpcomingEvents.has(dateStr);
          const dayUpcomingEvents = currentMonthUpcomingEvents.get(dateStr) || [];
          const isToday = dateStr === today;
          const hasAnyEvent = hasEvent || hasUpcoming;
          
          const handleDateClick = () => {
            if (hasAnyEvent && eventListRef.current) {
              const next = new Set(expandedEventDates);
              if (!expandedEventDates.has(dateStr)) {
                next.add(dateStr);
                setExpandedEventDates(next);
              }
              // イベントリストまでスクロール
              setTimeout(() => {
                eventListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 100);
            }
          };

          return (
            <button
              key={day}
              type="button"
              role="gridcell"
              aria-label={`${year}年${month + 1}月${day}日${hasEvent ? `、${dayNFTs.length}件の参加済みイベント` : ''}${hasUpcoming ? `、${dayUpcomingEvents.length}件の開催予定イベント` : ''}`}
              aria-pressed={expandedEventDates.has(dateStr) ? 'true' : 'false'}
              onClick={handleDateClick}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && hasAnyEvent) {
                  e.preventDefault();
                  handleDateClick();
                }
              }}
              disabled={!hasAnyEvent}
              style={{
              borderRadius: getResponsiveValue('8px', '10px', '10px', deviceType),
              padding: getResponsiveValue('0.25rem', '0.5rem', '0.5rem', deviceType),
              textAlign: 'center',
                background: isToday 
                  ? 'rgba(59, 130, 246, 0.4)' 
                  : hasUpcoming
                    ? 'rgba(52, 211, 153, 0.3)'
                    : hasEvent 
                      ? 'rgba(139, 92, 246, 0.3)' 
                      : 'rgba(30, 27, 75, 0.5)',
              backdropFilter: 'blur(10px)',
                border: isToday 
                  ? '2px solid rgba(59, 130, 246, 0.6)' 
                  : hasUpcoming
                    ? '1px solid rgba(52, 211, 153, 0.5)'
                    : '1px solid rgba(79, 70, 229, 0.3)',
                cursor: hasAnyEvent ? 'pointer' : 'default',
              minHeight: getResponsiveValue('44px', '60px', '60px', deviceType),
              position: 'relative',
              fontSize: getResponsiveValue('0.875rem', '1rem', '1rem', deviceType),
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem'
              }}
              onMouseEnter={(e) => {
                if (hasAnyEvent && !isToday) {
                  if (hasUpcoming) {
                    e.currentTarget.style.background = 'rgba(52, 211, 153, 0.5)';
                  } else {
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.5)';
                  }
                  e.currentTarget.style.transform = 'scale(1.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (hasAnyEvent && !isToday) {
                  if (hasUpcoming) {
                    e.currentTarget.style.background = 'rgba(52, 211, 153, 0.3)';
                  } else {
                    e.currentTarget.style.background = 'rgba(139, 92, 246, 0.3)';
                  }
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              <div style={{ fontWeight: hasAnyEvent || isToday ? 'bold' : 'normal', color: '#e0e7ff' }}>{day}</div>
              {(hasEvent || hasUpcoming) && (
                <div style={{ display: 'flex', gap: '0.125rem', alignItems: 'center', justifyContent: 'center' }}>
              {hasEvent && (
                    <div 
                      role="status"
                      aria-label={`${dayNFTs.length}件の参加済みイベント`}
                      style={{ 
                        fontSize: getResponsiveValue('0.6rem', '0.7rem', '0.7rem', deviceType), 
                        color: '#c7d2fe', 
                        fontWeight: '600',
                        background: 'rgba(139, 92, 246, 0.5)',
                        borderRadius: '4px',
                        padding: '0.125rem 0.25rem',
                        minWidth: '1.25rem'
                      }}
                    >
                      {dayNFTs.length}
                    </div>
                  )}
                  {hasUpcoming && (
                    <div 
                      role="status"
                      aria-label={`${dayUpcomingEvents.length}件の開催予定イベント`}
                      style={{ 
                        fontSize: getResponsiveValue('0.6rem', '0.7rem', '0.7rem', deviceType), 
                        color: '#065f46', 
                        fontWeight: '600',
                        background: 'rgba(52, 211, 153, 0.5)',
                        borderRadius: '4px',
                        padding: '0.125rem 0.25rem',
                        minWidth: '1.25rem'
                      }}
                    >
                      {dayUpcomingEvents.length}
                    </div>
                  )}
                </div>
              )}
              {isToday && (
                <div 
                  aria-label="今日"
                  style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#3b82f6',
                    border: '1px solid rgba(255, 255, 255, 0.3)'
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Event List */}
      <div ref={eventListRef}>
        <h4 
          id="event-list-title"
          style={{ fontSize: getResponsiveValue('0.8125rem', '0.875rem', '0.875rem', deviceType), fontWeight: '600', marginBottom: getResponsiveValue('0.75rem', '1rem', '1rem', deviceType), color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          {currentMonthEvents.size > 0 ? `${currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}のイベント` : '今月のイベント'}
        </h4>
        {currentMonthEvents.size === 0 && currentMonthUpcomingEvents.size === 0 ? (
          <div 
            role="status"
            aria-live="polite"
            style={{ 
              textAlign: 'center', 
              padding: getResponsiveValue('2rem 1rem', '2.5rem 1.5rem', '3rem 2rem', deviceType), 
              color: '#a5b4fc',
              background: 'rgba(30, 27, 75, 0.6)',
              backdropFilter: 'blur(10px)',
              borderRadius: getResponsiveValue('10px', '12px', '12px', deviceType),
              border: '1px solid rgba(79, 70, 229, 0.3)'
            }}
          >
            <div style={{ fontSize: getResponsiveValue('1.5rem', '2rem', '2rem', deviceType), marginBottom: '0.5rem' }}>📅</div>
            <div style={{ fontSize: getResponsiveValue('0.875rem', '1rem', '1rem', deviceType), fontWeight: '600', color: '#e0e7ff' }}>
              今月はイベントがありません
            </div>
          </div>
        ) : (
          <div 
            role="list"
            aria-labelledby="event-list-title"
            style={{ display: 'flex', flexDirection: 'column', gap: getResponsiveValue('0.375rem', '0.5rem', '0.5rem', deviceType) }}
          >
            {/* Upcoming Events */}
            {Array.from(currentMonthUpcomingEvents.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([date, upcomingEvents]) => {
                const isExpanded = expandedEventDates.has(date);
                const dateObj = new Date(date + 'T00:00:00');
                
                return (
                  <div 
                    key={`upcoming-${date}`} 
                    role="listitem"
                    style={{ 
                      background: 'rgba(52, 211, 153, 0.1)', 
                      backdropFilter: 'blur(10px)', 
                      borderRadius: getResponsiveValue('10px', '12px', '12px', deviceType), 
                      border: '1px solid rgba(52, 211, 153, 0.3)', 
                      overflow: 'hidden', 
                      transition: 'all 0.2s ease' 
                    }}
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`upcoming-event-details-${date}`}
                      aria-label={`${dateObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}の開催予定イベント（${upcomingEvents.length}件）を${isExpanded ? '折りたたむ' : '展開する'}`}
                      onClick={() => {
                        const next = new Set(expandedEventDates);
                        if (isExpanded) next.delete(date); else next.add(date);
                        setExpandedEventDates(next);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          const next = new Set(expandedEventDates);
                          if (isExpanded) next.delete(date); else next.add(date);
                          setExpandedEventDates(next);
                        }
                      }}
                      style={{ 
                        width: '100%',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: getResponsiveValue('0.75rem 1rem', '0.875rem 1.25rem', '0.875rem 1.25rem', deviceType), 
                        cursor: 'pointer', 
                        transition: 'all 0.2s ease',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                        <div 
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#34d399',
                            flexShrink: 0,
                            boxShadow: '0 0 8px rgba(52, 211, 153, 0.5)'
                          }}
                          aria-label="開催予定"
                        />
                        <ChevronDown 
                          className="w-4 h-4" 
                          aria-hidden="true"
                          style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s ease', color: '#34d399', flexShrink: 0 }} 
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: getResponsiveValue('0.875rem', '0.9375rem', '0.9375rem', deviceType), fontWeight: '600', color: '#34d399', marginBottom: '0.125rem' }}>
                            {dateObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })} - 開催予定
                          </div>
                          <div style={{ fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.8125rem', deviceType), color: '#a5b4fc' }}>
                            {upcomingEvents.length}件のイベント予定
                          </div>
                        </div>
                      </div>
                    </button>
                    {isExpanded && (
                      <div 
                        id={`upcoming-event-details-${date}`}
                        role="region"
                        aria-label={`${dateObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}の開催予定イベント詳細`}
                        style={{ padding: getResponsiveValue('0.75rem 1rem 1rem 3rem', '0.875rem 1.25rem 1rem 3.25rem', '0.875rem 1.25rem 1rem 3.25rem', deviceType), background: 'rgba(52, 211, 153, 0.05)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(52, 211, 153, 0.3)' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: getResponsiveValue('0.75rem', '1rem', '1rem', deviceType) }}>
                          {upcomingEvents.map((event) => {
                            const imageUrl = getImageDisplayUrl(event.imageCid, event.imageUrl);
                            const hasDetailUrl = !!event.detailUrl;
                            
                            return (
                              <div 
                                key={`upcoming-${date}-${event.id}`} 
                                role="listitem"
                                onClick={() => {
                                  if (event.detailUrl) {
                                    window.open(event.detailUrl, '_blank', 'noopener,noreferrer');
                                  }
                                }}
                                style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '0.75rem',
                                  padding: getResponsiveValue('0.75rem', '1rem', '1rem', deviceType),
                                  background: 'rgba(30, 27, 75, 0.4)',
                                  borderRadius: '8px',
                                  border: '1px solid rgba(52, 211, 153, 0.2)',
                                  cursor: hasDetailUrl ? 'pointer' : 'default',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  if (hasDetailUrl) {
                                    e.currentTarget.style.background = 'rgba(52, 211, 153, 0.2)';
                                    e.currentTarget.style.borderColor = 'rgba(52, 211, 153, 0.4)';
                                    e.currentTarget.style.transform = 'translateX(4px)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (hasDetailUrl) {
                                    e.currentTarget.style.background = 'rgba(30, 27, 75, 0.4)';
                                    e.currentTarget.style.borderColor = 'rgba(52, 211, 153, 0.2)';
                                    e.currentTarget.style.transform = 'translateX(0)';
                                  }
                                }}
                              >
                                {imageUrl && (
                                  <div style={{ width: getResponsiveValue('56px', '64px', '64px', deviceType), height: getResponsiveValue('56px', '64px', '64px', deviceType), borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(52, 211, 153, 0.3)', background: 'rgba(30, 27, 75, 0.5)', flexShrink: 0 }}>
                                    <img
                                      src={convertIpfsUrl(imageUrl)}
                                      alt={event.name || 'Event'}
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  </div>
                                )}
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ 
                                    fontSize: getResponsiveValue('0.875rem', '0.9375rem', '0.9375rem', deviceType), 
                                    fontWeight: 600, 
                                    color: hasDetailUrl ? '#34d399' : '#34d399', 
                                    marginBottom: '0.25rem',
                                    textDecoration: hasDetailUrl ? 'underline' : 'none',
                                    textUnderlineOffset: '2px'
                                  }}>
                                    {event.name || 'Unnamed Event'}
                                    {hasDetailUrl && (
                                      <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', opacity: 0.7 }}>🔗</span>
                                    )}
                                  </div>
                                  {event.description && (
                                    <div style={{ fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.8125rem', deviceType), color: '#a5b4fc', marginBottom: '0.25rem' }}>
                                      {event.description}
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#a5b4fc' }}>
                                    {event.eventDate && (
                                      <span>開催日: {new Date(event.eventDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</span>
                                    )}
                                    {event.startAt && event.endAt && (
                                      <span style={{ color: '#9ca3af' }}>ミント期間: {new Date(event.startAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} ～ {new Date(event.endAt).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            
            {/* Past Events (Participated) */}
            {Array.from(currentMonthEvents.entries())
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, nfts]) => {
              const isExpanded = expandedEventDates.has(date);
                const dateObj = new Date(date);
              return (
                  <div 
                    key={date} 
                    role="listitem"
                    style={{ background: 'rgba(30, 27, 75, 0.6)', backdropFilter: 'blur(10px)', borderRadius: getResponsiveValue('10px', '12px', '12px', deviceType), border: '1px solid rgba(79, 70, 229, 0.3)', overflow: 'hidden', transition: 'all 0.2s ease' }}
                  >
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={`event-details-${date}`}
                      aria-label={`${dateObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}のイベント（${nfts.length}件）を${isExpanded ? '折りたたむ' : '展開する'}`}
                      onClick={() => {
                        const next = new Set(expandedEventDates);
                        if (isExpanded) next.delete(date); else next.add(date);
                        setExpandedEventDates(next);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          const next = new Set(expandedEventDates);
                          if (isExpanded) next.delete(date); else next.add(date);
                          setExpandedEventDates(next);
                        }
                      }}
                      style={{ 
                        width: '100%',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        padding: getResponsiveValue('0.75rem 1rem', '0.875rem 1.25rem', '0.875rem 1.25rem', deviceType), 
                        cursor: 'pointer', 
                        transition: 'all 0.2s ease',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                        <ChevronDown 
                          className="w-4 h-4" 
                          aria-hidden="true"
                          style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s ease', color: '#a5b4fc', flexShrink: 0 }} 
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: getResponsiveValue('0.875rem', '0.9375rem', '0.9375rem', deviceType), fontWeight: '600', color: '#e0e7ff', marginBottom: '0.125rem' }}>
                            {dateObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                          </div>
                          <div style={{ fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.8125rem', deviceType), color: '#a5b4fc' }}>
                            {nfts.length}件のイベント参加
                          </div>
                        </div>
                      </div>
                    </button>
                  {isExpanded && (
                      <div 
                        id={`event-details-${date}`}
                        role="region"
                        aria-label={`${dateObj.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}のイベント詳細`}
                        style={{ padding: getResponsiveValue('0.75rem 1rem 1rem 3rem', '0.875rem 1.25rem 1rem 3.25rem', '0.875rem 1.25rem 1rem 3.25rem', deviceType), background: 'rgba(30, 27, 75, 0.4)', backdropFilter: 'blur(10px)', borderTop: '1px solid rgba(79, 70, 229, 0.3)' }}
                      >
                      <div style={{ display: 'grid', gridTemplateColumns: getResponsiveValue('1fr', 'repeat(2, 1fr)', 'repeat(2, 1fr)', deviceType), gap: getResponsiveValue('0.75rem', '1rem', '1rem', deviceType) }}>
                        {nfts.map((nft) => {
                          // NFT名からイベント情報を取得
                          const nftName = nft.display?.name;
                          const event = events?.find((e: Event) => e.name === nftName);
                          const eventDate = nft.display?.event_date;
                          const hasDetailUrl = !!event?.detailUrl;
                          
                          // 画像URLを取得（イベントの画像を優先、なければNFTの画像）
                          const eventImageUrl = event ? getImageDisplayUrl(event.imageCid, event.imageUrl) : undefined;
                          const nftImageUrl = nft.display?.image_url;
                          const imageUrl = eventImageUrl || nftImageUrl;
                          
                          return (
                            <div 
                              key={`${date}-${nft.objectId}`} 
                              role="listitem"
                              onClick={() => {
                                if (event?.detailUrl) {
                                  window.open(event.detailUrl, '_blank', 'noopener,noreferrer');
                                }
                              }}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.75rem',
                                padding: getResponsiveValue('0.75rem', '1rem', '1rem', deviceType),
                                background: 'rgba(30, 27, 75, 0.4)',
                                borderRadius: '8px',
                                border: '1px solid rgba(79, 70, 229, 0.3)',
                                cursor: hasDetailUrl ? 'pointer' : 'default',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                if (hasDetailUrl) {
                                  e.currentTarget.style.background = 'rgba(79, 70, 229, 0.3)';
                                  e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.5)';
                                  e.currentTarget.style.transform = 'translateX(4px)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (hasDetailUrl) {
                                  e.currentTarget.style.background = 'rgba(30, 27, 75, 0.4)';
                                  e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.3)';
                                  e.currentTarget.style.transform = 'translateX(0)';
                                }
                              }}
                            >
                            {imageUrl && (
                              <div style={{ width: getResponsiveValue('56px', '64px', '64px', deviceType), height: getResponsiveValue('56px', '64px', '64px', deviceType), borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(79, 70, 229, 0.3)', background: 'rgba(30, 27, 75, 0.5)', flexShrink: 0 }}>
                                <img
                                  src={convertIpfsUrl(imageUrl)}
                                  alt={event?.name || nft.display?.name || 'Event'}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                />
                              </div>
                            )}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ 
                                fontSize: getResponsiveValue('0.875rem', '0.9375rem', '0.9375rem', deviceType), 
                                fontWeight: 600, 
                                color: hasDetailUrl ? '#667eea' : '#e0e7ff', 
                                marginBottom: '0.25rem',
                                textDecoration: hasDetailUrl ? 'underline' : 'none',
                                textUnderlineOffset: '2px'
                              }}>
                                {event?.name || nft.display?.name || 'Unnamed NFT'}
                                {hasDetailUrl && (
                                  <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', opacity: 0.7 }}>🔗</span>
                                )}
                              </div>
                              {eventDate && (
                                <div style={{ fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.8125rem', deviceType), color: '#34d399', fontWeight: '600', marginBottom: '0.25rem' }}>
                                  参加日: {new Date(eventDate).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
                                </div>
                              )}
                              <div style={{ fontSize: '0.75rem', color: '#a5b4fc', marginBottom: '0.25rem' }}>
                                ID: {nft.objectId.slice(0, 6)}...{nft.objectId.slice(-4)}
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
        )}
      </div>
    </>
  );
};

export default CalendarSection;
