import { CollectionsSection } from '../../../features/collections/CollectionsSection';
import { getResponsiveValue } from '../../../hooks/useResponsive';
import type { CollectionConfig, OwnedNFT } from '../../../hooks/useHomePageState';

interface EventItem { id: string; name: string; description?: string; startAt?: string; endAt?: string; eventDate?: string; mintedCount?: number; collectionId?: string; detailUrl?: string; imageCid?: string; imageMimeType?: string }

interface CollectionGroup {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  collectionIds: string[];
  collections: CollectionConfig[];
  events: EventItem[];
  ownedNFTs: OwnedNFT[];
}

interface AllTabProps {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: 'eventName' | 'eventDate' | 'collection';
  setSortBy: (sort: 'eventName' | 'eventDate' | 'collection') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
  collections: CollectionConfig[];
  events: EventItem[];
  onchainCounts: Map<string, number>;
  expandedCollections: Set<string>;
  setExpandedCollections: (collections: Set<string>) => void;
  allOwnedNFTs: OwnedNFT[];
  convertIpfsUrl: (url: string | undefined) => string | undefined;
  collectionLayoutGroups: CollectionGroup[];
  eventNFTGroups: CollectionGroup[];
}

export function AllTab({
  deviceType,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  collections,
  events,
  onchainCounts,
  expandedCollections,
  setExpandedCollections,
  allOwnedNFTs,
  convertIpfsUrl,
  collectionLayoutGroups,
  eventNFTGroups
}: AllTabProps) {
  const allGroups = [...(collectionLayoutGroups || []), ...(eventNFTGroups || [])];
  if (allGroups.length === 0) {
    return (
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
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: getResponsiveValue('1.25rem', '1.5rem', '1.75rem', deviceType)
    }}>
        {/* Collection Layout Section */}
        {collectionLayoutGroups && collectionLayoutGroups.length > 0 && collectionLayoutGroups.map(group => (
          <section key={group.id} style={{
            border: '1px solid rgba(79, 70, 229, 0.3)',
            borderLeft: 'none',
            borderRight: 'none',
            borderRadius: 0,
            padding: getResponsiveValue('1.25rem', '1.5rem', '1.75rem', deviceType),
            background: 'rgba(30, 27, 75, 0.4)',
            backdropFilter: 'blur(10px)',
            marginLeft: '-1rem',
            marginRight: '-1rem'
          }}>
            <header style={{ marginBottom: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType) }}>
              <h3 style={{
                margin: 0,
                fontSize: getResponsiveValue('1.05rem', '1.15rem', '1.25rem', deviceType),
                fontWeight: 700,
                color: '#e0e7ff'
              }}>
                {group.title === 'SyndicateXTokyo NFT' ? 'SyndicateXTokyo NFTs' : group.title}
              </h3>
              {group.subtitle && (
                <p style={{
                  marginTop: '0.35rem',
                  color: '#a5b4fc',
                  fontSize: getResponsiveValue('0.8rem', '0.85rem', '0.9rem', deviceType)
                }}>
                  {group.subtitle}
                </p>
              )}
            </header>

            <CollectionsSection
              deviceType={deviceType}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              collections={group.collections}
              events={group.events}
              onchainCounts={onchainCounts}
              expandedCollections={expandedCollections}
              setExpandedCollections={setExpandedCollections}
              allOwnedNFTs={group.ownedNFTs}
              convertIpfsUrl={convertIpfsUrl}
              showSearchAndSort={false}
            />
          </section>
        ))}
        
        {/* Event NFT Section */}
        {eventNFTGroups && eventNFTGroups.length > 0 && eventNFTGroups.map(group => (
          <section key={group.id} style={{
            border: '1px solid rgba(79, 70, 229, 0.3)',
            borderLeft: 'none',
            borderRight: 'none',
            borderRadius: 0,
            padding: getResponsiveValue('1.25rem', '1.5rem', '1.75rem', deviceType),
            background: 'rgba(30, 27, 75, 0.4)',
            backdropFilter: 'blur(10px)',
            marginLeft: '-1rem',
            marginRight: '-1rem'
          }}>
            <header style={{ marginBottom: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType) }}>
              <h3 style={{
                margin: 0,
                fontSize: getResponsiveValue('1.05rem', '1.15rem', '1.25rem', deviceType),
                fontWeight: 700,
                color: '#e0e7ff'
              }}>
                {group.title === 'SyndicateXTokyo NFT' ? 'SyndicateXTokyo NFTs' : group.title}
              </h3>
              {group.subtitle && (
                <p style={{
                  marginTop: '0.35rem',
                  color: '#a5b4fc',
                  fontSize: getResponsiveValue('0.8rem', '0.85rem', '0.9rem', deviceType)
                }}>
                  {group.subtitle}
                </p>
              )}
            </header>

            {/* Event NFT画像 */}
            {group.imageUrl && (
              <div style={{
                marginBottom: getResponsiveValue('1.25rem', '1.5rem', '1.75rem', deviceType),
                borderRadius: '12px',
                overflow: 'hidden',
                background: 'rgba(30, 27, 75, 0.4)'
              }}>
                <img
                  src={convertIpfsUrl(group.imageUrl)}
                  alt={group.title}
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block'
                  }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}

            <CollectionsSection
              deviceType={deviceType}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              collections={group.collections}
              events={group.events}
              onchainCounts={onchainCounts}
              expandedCollections={expandedCollections}
              setExpandedCollections={setExpandedCollections}
              allOwnedNFTs={group.ownedNFTs}
              convertIpfsUrl={convertIpfsUrl}
            />
          </section>
        ))}
    </div>
  );
}
