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
    collection_name?: string;
  };
  owner?: unknown;
  previousTransaction?: string;
  timestamp?: number;
}

interface ActivityTabProps {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  allOwnedNFTs: OwnedNFT[];
  events: Array<{ id: string; name: string }>;
}

export function ActivityTab({
  deviceType,
  allOwnedNFTs,
  events,
}: ActivityTabProps) {
  const activities = useMemo((): Activity[] => {
    if (!allOwnedNFTs || !Array.isArray(allOwnedNFTs)) {
      return [];
    }

    const eventNameSet = new Map<string, string>();
    events.forEach(e => { eventNameSet.set(e.name, e.name); });

    return allOwnedNFTs
      .map((nft, index) => {
        const timestamp = nft.timestamp || 0;

        const nftName = nft.display?.name || 'Unnamed NFT';
        const collectionName = nft.display?.collection_name || '';
        const matchedEvent = eventNameSet.get(nftName);

        return {
          id: `activity-${nft.objectId}-${index}`,
          type: 'mint' as const,
          timestamp: (timestamp && timestamp > 0) ? timestamp : 0,
          timestampMs: (timestamp && timestamp > 0) ? timestamp : 0,
          digest: nft.previousTransaction,
          data: { count: 1, label: nftName },
          mint: {
            objectId: nft.objectId,
            name: nftName,
            image_url: nft.display?.image_url,
            collection: collectionName,
            eventName: matchedEvent || undefined,
          },
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [allOwnedNFTs, events]);

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
