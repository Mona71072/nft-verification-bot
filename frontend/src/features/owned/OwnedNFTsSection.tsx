import React, { useMemo } from 'react';
import { EmptyNFTs } from '../../components/empty-states/EmptyNFTs';
import { GridSkeleton } from '../../components/skeletons/GridSkeleton';
import { getResponsiveValue } from '../../hooks/useResponsive';
import { resolveCollectionForNFT, getCollectionDisplayName, type CollectionLike } from '../../utils/resolveCollection';
import { IpfsImage } from '../../components/ui/IpfsImage';

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
  owner?: any;
}

interface Collection extends CollectionLike {
  detailUrl?: string;
}

interface Props {
  nftLoading: boolean;
  nfts: OwnedNFT[];
  collections: Collection[];
  deviceType: 'mobile' | 'tablet' | 'desktop';
  setSelectedNFT: (nft: OwnedNFT | null) => void;
  setIsDrawerOpen: (open: boolean) => void;
  convertIpfsUrl: (url: string | undefined) => string | undefined;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: 'name' | 'collection' | 'date';
  setSortBy: (sort: 'name' | 'collection' | 'date') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
}

function formatEventDate(dateStr: string | undefined): string | null {
  if (!dateStr || !dateStr.trim() || dateStr === '{eventDate}' || dateStr === 'null' || dateStr === 'Unknown') return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

export const OwnedNFTsSection: React.FC<Props> = ({
  nftLoading,
  nfts: nonEventNFTs,
  collections,
  deviceType,
  setSelectedNFT,
  setIsDrawerOpen,
  convertIpfsUrl,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
}) => {
  const resolve = useMemo(
    () => (nft?: OwnedNFT) => resolveCollectionForNFT(nft as any, collections),
    [collections]
  );

  // Group NFTs by collection
  const { groups, totalCollections } = useMemo(() => {
    type Group = { collection: Collection | null; name: string; nfts: OwnedNFT[] };
    const map = new Map<string, Group>();

    let filtered = [...nonEventNFTs];

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(nft => {
        const name = nft.display?.name?.toLowerCase() || '';
        const colName = (nft.display?.collection_name || resolve(nft)?.name || '').toLowerCase();
        const desc = nft.display?.description?.toLowerCase() || '';
        return name.includes(q) || colName.includes(q) || desc.includes(q);
      });
    }

    filtered.forEach(nft => {
      const col = resolve(nft);
      const key = col ? col.id : '__uncategorized__';
      if (!map.has(key)) {
        map.set(key, {
          collection: col || null,
          name: col ? getCollectionDisplayName(col) : 'Other NFTs',
          nfts: [],
        });
      }
      map.get(key)!.nfts.push(nft);
    });

    // Sort NFTs within each group
    for (const group of map.values()) {
      group.nfts.sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'name') {
          cmp = (a.display?.name || '').localeCompare(b.display?.name || '');
        } else if (sortBy === 'date') {
          const da = a.display?.event_date ? new Date(a.display.event_date).getTime() : NaN;
          const db = b.display?.event_date ? new Date(b.display.event_date).getTime() : NaN;
          const va = isNaN(da) ? 0 : da;
          const vb = isNaN(db) ? 0 : db;
          if (isNaN(da) && !isNaN(db)) cmp = 1;
          else if (!isNaN(da) && isNaN(db)) cmp = -1;
          else cmp = va - vb;
        } else if (sortBy === 'collection') {
          const ca = (a.display?.collection_name || resolve(a)?.name || '').toLowerCase();
          const cb = (b.display?.collection_name || resolve(b)?.name || '').toLowerCase();
          cmp = ca.localeCompare(cb);
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }

    const sorted = Array.from(map.values()).sort((a, b) => {
      if (a.collection && !b.collection) return -1;
      if (!a.collection && b.collection) return 1;
      return b.nfts.length - a.nfts.length;
    });

    return { groups: sorted, totalCollections: map.size - (map.has('__uncategorized__') ? 1 : 0) };
  }, [nonEventNFTs, collections, searchQuery, sortBy, sortOrder, resolve]);

  const totalNFTs = groups.reduce((sum, g) => sum + g.nfts.length, 0);

  if (nftLoading) {
    return <GridSkeleton count={6} columns={{ mobile: 1, tablet: 2, desktop: 3 }} />;
  }

  if (nonEventNFTs.length === 0) {
    return (
      <EmptyNFTs
        title="No NFTs Found"
        description="You don't own any SXT NFTs yet"
        ctaLabel="Mint NFTs"
        ctaHref="https://www.tradeport.xyz/sui/collection/0x182ebe08d5895467a750dcad6d5acedb3c1f02f8048df8d3bf369bc24f43e911?tab=mint&bottomTab=trades&mintTokenId=e944ed92-4cfe-4dbd-a824-b7199ee0b1d7"
      />
    );
  }

  const getSuiScanUrl = (objectId: string) => `https://suiscan.xyz/mainnet/object/${objectId}`;

  const handleCardClick = (
    event: React.MouseEvent<HTMLDivElement>,
    nft: OwnedNFT,
    detailUrl?: string
  ) => {
    const url = detailUrl?.trim();
    if (url) {
      event.stopPropagation();
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setSelectedNFT(nft);
    setIsDrawerOpen(true);
  };

  const handleExternalLinkClick = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const isMobile = deviceType === 'mobile';

  return (
    <div>
      {/* Summary + Search bar */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: '0.75rem',
        marginBottom: '1.25rem',
        alignItems: isMobile ? 'stretch' : 'center',
      }}>
        {/* Summary badges */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{
            padding: '0.25rem 0.75rem',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, rgba(139,92,246,0.35), rgba(79,70,229,0.35))',
            color: '#e0e7ff',
            border: '1px solid rgba(139,92,246,0.4)',
          }}>
            {totalNFTs} NFT{totalNFTs !== 1 ? 's' : ''}
          </span>
          {totalCollections > 0 && (
            <span style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(37,99,235,0.3))',
              color: '#bfdbfe',
              border: '1px solid rgba(59,130,246,0.4)',
            }}>
              {totalCollections} Collection{totalCollections !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Search + Sort */}
        <div style={{ display: 'flex', flex: 1, gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              placeholder="Search NFTs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                paddingRight: searchQuery ? '2.25rem' : undefined,
                background: 'rgba(30, 27, 75, 0.6)',
                border: '1px solid rgba(79, 70, 229, 0.3)',
                borderRadius: '10px',
                color: '#e0e7ff',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', cursor: 'pointer', color: '#a5b4fc', padding: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              padding: '0.5rem 0.75rem',
              background: 'rgba(30, 27, 75, 0.6)',
              border: '1px solid rgba(79, 70, 229, 0.3)',
              borderRadius: '10px',
              color: '#e0e7ff',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            <option value="name">Name</option>
            <option value="collection">Collection</option>
            <option value="date">Date</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            style={{
              padding: '0.5rem',
              background: 'rgba(139, 92, 246, 0.3)',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              borderRadius: '10px',
              color: '#c7d2fe',
              cursor: 'pointer',
              minWidth: '36px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* No results */}
      {totalNFTs === 0 && searchQuery.trim() && (
        <EmptyNFTs
          title="No NFTs Match Your Search"
          description={`No NFTs found matching "${searchQuery}"`}
        />
      )}

      {/* Collection groups */}
      {groups.map((group) => (
        <div key={group.collection?.id || '__uncategorized__'} style={{ marginBottom: '2rem' }}>
          {/* Collection header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.8), rgba(49, 46, 129, 0.5))',
            borderRadius: '12px',
            border: '1px solid rgba(79, 70, 229, 0.25)',
          }}>
            <div style={{
              width: '36px', height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1rem', fontWeight: 800, color: 'white',
              flexShrink: 0,
            }}>
              {group.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: isMobile ? '0.9375rem' : '1rem',
                fontWeight: 700,
                color: '#e0e7ff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {group.name}
              </div>
            </div>
            <span style={{
              padding: '0.2rem 0.625rem',
              borderRadius: '12px',
              fontSize: '0.6875rem',
              fontWeight: 700,
              background: 'rgba(139,92,246,0.25)',
              color: '#c7d2fe',
              flexShrink: 0,
            }}>
              {group.nfts.length}
            </span>
          </div>

          {/* NFT grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: getResponsiveValue(
              'repeat(auto-fill, minmax(150px, 1fr))',
              'repeat(auto-fill, minmax(220px, 1fr))',
              'repeat(auto-fill, minmax(260px, 1fr))',
              deviceType
            ),
            gap: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType),
          }}>
            {group.nfts.map((nft) => {
              const col = resolve(nft);
              const eventDate = formatEventDate(nft.display?.event_date);
              const isKiosk = Boolean(
                nft.owner?.parent?.address ||
                (typeof nft.owner?.parent === 'object' && nft.owner?.parent?.address) ||
                nft.owner?.ObjectOwner
              );

              return (
                <div
                  key={nft.objectId}
                  style={{
                    borderRadius: '14px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: 'rgba(30, 27, 75, 0.6)',
                    border: '1px solid rgba(79, 70, 229, 0.25)',
                    transition: 'all 0.25s ease',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onClick={(e) => handleCardClick(e, nft, col?.detailUrl)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(79, 70, 229, 0.2)';
                    e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.25)';
                  }}
                >
                  {/* Image */}
                  <div style={{
                    width: '100%',
                    aspectRatio: '1 / 1',
                    background: 'rgba(15, 23, 42, 0.6)',
                    overflow: 'hidden',
                    position: 'relative',
                  }}>
                    <IpfsImage
                      url={convertIpfsUrl(nft.display?.image_url)}
                      alt={nft.display?.name || 'NFT'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      fallback={(
                        <div style={{
                          width: '100%', height: '100%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'linear-gradient(135deg, rgba(79,70,229,0.3), rgba(139,92,246,0.2))',
                        }}>
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                          </svg>
                        </div>
                      )}
                    />

                    {/* Event date badge (top-right overlay) */}
                    {eventDate && (
                      <div style={{
                        position: 'absolute',
                        top: '0.5rem', right: '0.5rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '8px',
                        background: 'rgba(15, 23, 42, 0.85)',
                        backdropFilter: 'blur(4px)',
                        fontSize: '0.625rem',
                        fontWeight: 600,
                        color: '#a5b4fc',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        {eventDate}
                      </div>
                    )}

                    {/* Kiosk badge */}
                    {isKiosk && (
                      <div style={{
                        position: 'absolute',
                        top: '0.5rem', left: '0.5rem',
                        padding: '0.15rem 0.4rem',
                        borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.85)',
                        fontSize: '0.5625rem',
                        fontWeight: 700,
                        color: '#fff',
                        letterSpacing: '0.05em',
                      }}>
                        KIOSK
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{
                    padding: isMobile ? '0.625rem' : '0.875rem',
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                  }}>
                    <h3 style={{
                      fontSize: isMobile ? '0.8125rem' : '0.9375rem',
                      fontWeight: 700,
                      color: '#e0e7ff',
                      marginBottom: '0.375rem',
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {nft.display?.name || 'Unnamed NFT'}
                    </h3>

                    {nft.display?.description && (
                      <p style={{
                        fontSize: isMobile ? '0.6875rem' : '0.75rem',
                        color: '#94a3b8',
                        marginBottom: '0.5rem',
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}>
                        {nft.display.description}
                      </p>
                    )}

                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {/* Object ID */}
                      <div style={{ fontSize: '0.6875rem', color: '#64748b' }}>
                        {nft.objectId.slice(0, 8)}...{nft.objectId.slice(-6)}
                      </div>

                      {/* SuiScan link */}
                      <button
                        onClick={(e) => handleExternalLinkClick(e, getSuiScanUrl(nft.objectId))}
                        style={{
                          fontSize: '0.6875rem',
                          color: '#818cf8',
                          fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: '0.25rem',
                          background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                          transition: 'color 0.2s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = '#a5b4fc'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = '#818cf8'; }}
                      >
                        View on SuiScan
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default OwnedNFTsSection;
