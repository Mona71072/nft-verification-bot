import { useState, useMemo } from 'react';
import { CalendarSection } from '../../../features/calendar/CalendarSection';
import { getResponsiveValue } from '../../../hooks/useResponsive';

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

interface OwnedNFT {
  objectId: string;
  type: string;
  display?: {
    name?: string;
    description?: string;
    image_url?: string;
    event_date?: string;
  };
  owner?: unknown;
}

interface CalendarTabProps {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  events: Event[];
  connected: boolean;
  nftLoading: boolean;
  convertIpfsUrl: (url: string | undefined) => string | undefined;
  allOwnedNFTs: OwnedNFT[];
}

export function CalendarTab({
  deviceType,
  events,
  connected,
  nftLoading,
  convertIpfsUrl,
  allOwnedNFTs
}: CalendarTabProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [expandedEventDates, setExpandedEventDates] = useState<Set<string>>(new Set());

  // カレンダーのグリッドを生成
  const calendarGrid = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const grid: (number | null)[] = [];
    
    // 空のセルを追加
    for (let i = 0; i < firstDay; i++) {
      grid.push(null);
    }
    
    // 日付を追加
    for (let day = 1; day <= daysInMonth; day++) {
      grid.push(day);
    }
    
    return grid;
  }, [currentMonth]);

  // NFTデータを日付別にグループ化（useActivityStatsと同じ厳密なフィルタリングロジックを使用）
  const nftsByDate = useMemo(() => {
    const map = new Map<string, typeof allOwnedNFTs>();
    
    // イベント名のセットを作成
    const eventNames = new Set(events.map(e => e.name));
    
    allOwnedNFTs.forEach((nft) => {
      const eventDate = nft.display?.event_date;
      const nftName = nft.display?.name;
      
      // より厳密なフィルタリング：イベント名とNFT名の完全一致 + 有効なevent_date
      const nameMatches = nftName && eventNames.has(nftName);
      const hasValidEventDate = eventDate && 
        eventDate !== '{eventDate}' && 
        eventDate !== 'null' && 
        eventDate !== 'Unknown' &&
        !isNaN(new Date(eventDate).getTime());
      
      if (nameMatches && hasValidEventDate) {
        try {
          const date = new Date(eventDate);
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          
          if (!map.has(dateStr)) {
            map.set(dateStr, []);
          }
          map.get(dateStr)!.push(nft);
        } catch (error) {
          // 開発環境のみエラーをログ出力
          if (import.meta.env.DEV) {
            console.warn('Failed to parse event date:', eventDate, error);
          }
        }
      }
    });
    
    return map;
  }, [allOwnedNFTs, events]);

  // Upcomingイベントを日付別にグループ化（eventDateを使用）
  const upcomingEventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    const now = new Date();
    now.setHours(0, 0, 0, 0); // 時刻をリセットして日付のみで比較
    
    events.forEach((event) => {
      // eventDateを優先使用（イベント開催日）
      // eventDateが設定されていない場合は、そのイベントはカレンダーに表示しない
      const eventDateStr = event.eventDate;
      if (!eventDateStr) return;
      
      try {
        const eventDate = new Date(eventDateStr);
        eventDate.setHours(0, 0, 0, 0);
        
        // 現在時刻より後のイベントのみをupcomingとして扱う
        if (eventDate >= now) {
          const dateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
          
          if (!map.has(dateStr)) {
            map.set(dateStr, []);
          }
          map.get(dateStr)!.push(event);
        }
      } catch (error) {
        // 開発環境のみエラーをログ出力
        if (import.meta.env.DEV) {
          console.warn('Failed to parse upcoming event date:', eventDateStr, error);
        }
      }
    });
    
    return map;
  }, [events]);

  return (
    <div>
      <h2 style={{
        fontSize: getResponsiveValue('1rem', '1.125rem', '1.25rem', deviceType),
        fontWeight: '700',
        marginBottom: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType),
        color: '#e0e7ff',
        letterSpacing: '-0.01em'
      }}>
        Event Calendar
      </h2>

      <CalendarSection
        connected={connected}
        nftLoading={nftLoading}
        deviceType={deviceType}
        currentMonth={currentMonth}
        setCurrentMonth={setCurrentMonth}
        nftsByDate={nftsByDate}
        upcomingEventsByDate={upcomingEventsByDate}
        calendarGrid={calendarGrid}
        convertIpfsUrl={convertIpfsUrl}
        expandedEventDates={expandedEventDates}
        setExpandedEventDates={setExpandedEventDates}
        events={events}
      />
    </div>
  );
}
