import { useState } from 'react';
import { OwnedNFTsSection } from '../../../features/owned/OwnedNFTsSection';
import { EmptyNFTs } from '../../empty-states/EmptyNFTs';
import { GridSkeleton } from '../../skeletons/GridSkeleton';
import { getResponsiveValue } from '../../../hooks/useResponsive';

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

interface Collection {
  id: string;
  name: string;
  packageId?: string;
  typePath?: string;
}

interface OwnedTabProps {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  nftLoading: boolean;
  allOwnedNFTs: OwnedNFT[];
  collections: Collection[];
  setSelectedNFT: (nft: OwnedNFT | null) => void;
  setIsDrawerOpen: (open: boolean) => void;
  convertIpfsUrl: (url: string | undefined) => string | undefined;
}

export function OwnedTab({
  deviceType,
  nftLoading,
  allOwnedNFTs,
  collections,
  setSelectedNFT,
  setIsDrawerOpen,
  convertIpfsUrl
}: OwnedTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'collection' | 'date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const titleStyle = {
    fontSize: getResponsiveValue('1rem', '1.125rem', '1.25rem', deviceType),
    fontWeight: '700' as const,
    marginBottom: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType),
    color: '#e0e7ff',
    letterSpacing: '-0.01em' as const
  };

  return (
    <div>
      <h2 style={titleStyle}>
        Owned NFTs
      </h2>

      {nftLoading ? (
        <GridSkeleton />
      ) : allOwnedNFTs.length === 0 ? (
        <EmptyNFTs />
      ) : (
        <OwnedNFTsSection
          nftLoading={nftLoading}
          nonEventNFTs={allOwnedNFTs}
          collections={collections}
          deviceType={deviceType}
          setSelectedNFT={(nft) => setSelectedNFT(nft)}
          setIsDrawerOpen={(open) => setIsDrawerOpen(open)}
          convertIpfsUrl={convertIpfsUrl}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          sortBy={sortBy}
          setSortBy={setSortBy}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
        />
      )}
    </div>
  );
}
