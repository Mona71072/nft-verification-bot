import { useMemo } from 'react';
import { ActivityTimeline } from '../../../features/activity/ActivityTimeline';
import { getResponsiveValue } from '../../../hooks/useResponsive';

interface Activity {
  id: string;
  type: 'mint' | 'transfer' | 'verification';
  timestamp: number;
  timestampMs: number;
  digest?: string;
  mint?: {
    objectId: string;
    name: string;
    image_url?: string;
    collection: string;
    eventName?: string;
  };
  transfer?: {
    objectId: string;
    name: string;
    image_url?: string;
    from: string;
    to: string;
    direction: 'received' | 'sent';
  };
  verification?: {
    role: string;
    status: 'success' | 'failed';
    method: 'discord' | 'manual';
  };
  data?: { count: number; label: string };
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
  previousTransaction?: string;
  timestamp?: number; // ブロックチェーン上のトランザクションtimestamp（ミリ秒）
}

interface ActivityTabProps {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  allOwnedNFTs: OwnedNFT[];
  events: Array<{ id: string; name: string }>;
}

export function ActivityTab({
  deviceType,
  allOwnedNFTs,
  events: _events
}: ActivityTabProps) {
  // NFTデータからアクティビティを生成
  // ownedTabNFTsには既にNFT表示設定でフィルタリングされたNFTが含まれているため、
  // 追加のフィルタリングは行わず、すべてのNFTをアクティビティとして表示
  const activities = useMemo((): Activity[] => {
    if (!allOwnedNFTs || !Array.isArray(allOwnedNFTs)) {
      return [];
    }
    
    // ownedTabNFTsには既にフィルタリングされたNFTが含まれているので、
    // すべてのNFTをアクティビティとして表示
    return allOwnedNFTs
      .map((nft, index) => {
        // ブロックチェーン上のtimestampを優先的に使用
        // timestampがなければevent_dateを使用し、それもなければ現在時刻
        let timestamp = nft.timestamp || Date.now();
        
        if (!nft.timestamp) {
          const eventDate = nft.display?.event_date;
          try {
            if (eventDate && 
                eventDate !== '{eventDate}' && 
                eventDate !== 'null' && 
                eventDate !== 'Unknown' &&
                !isNaN(new Date(eventDate).getTime())) {
              timestamp = new Date(eventDate).getTime();
            }
          } catch (error) {
            // エラー時は現在時刻を使用
          }
        }

        return {
          id: `activity-${nft.objectId}-${index}`,
          type: 'mint' as const,
          timestamp,
          timestampMs: timestamp,
          data: { count: 1, label: nft.display?.name || 'NFT' },
          mint: {
            objectId: nft.objectId,
            name: nft.display?.name || 'Unnamed NFT',
            image_url: nft.display?.image_url,
            collection: nft.type,
            eventName: nft.display?.description
          }
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [allOwnedNFTs]);

  return (
    <div>
      <h2 style={{
        fontSize: getResponsiveValue('1rem', '1.125rem', '1.25rem', deviceType),
        fontWeight: '700',
        marginBottom: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType),
        color: '#e0e7ff',
        letterSpacing: '-0.01em'
      }}>
        Activity Timeline
      </h2>

      <ActivityTimeline
        activities={activities}
        loading={false}
        showStats={true}
        showFilters={true}
      />
    </div>
  );
}
