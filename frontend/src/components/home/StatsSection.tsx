import { LayoutGrid, TrendingUp, Gem } from 'lucide-react';
import { StatCard, StatCardSkeleton } from '../../features/overview/StatCard';
import { StaggerChildren, StaggerItem } from '../motion/FadeIn';
import { FloatOnHover } from '../motion/ScaleIn';
import { getResponsiveValue } from '../../hooks/useResponsive';
import type { ActivityStats } from '../../hooks/useActivityStats';

interface Collection {
  id: string;
  name: string;
  packageId?: string;
  typePath?: string;
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

interface StatsSectionProps {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  loading: boolean;
  connected: boolean;
  collections: Collection[];
  totalMints: number;
  nftLoading: boolean;
  activityStats: ActivityStats;
  onTabChange: (tab: string) => void;
}

export function StatsSection({
  deviceType,
  loading,
  connected,
  collections,
  totalMints,
  nftLoading,
  activityStats,
  onTabChange
}: StatsSectionProps) {
  if (loading) {
    return (
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
        <StatCardSkeleton />
        <StatCardSkeleton />
        {connected && <StatCardSkeleton />}
      </div>
    );
  }

  return (
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
      <StaggerChildren>
        <StaggerItem>
          <FloatOnHover>
            <StatCard
              label="Total Collections"
              value={collections?.length || 0}
              icon={<LayoutGrid size={20} />}
              onClick={() => onTabChange('all')}
              showTrend={false}
              subtitle="Active collections"
            />
          </FloatOnHover>
        </StaggerItem>
        
        <StaggerItem>
          <FloatOnHover>
            <StatCard
              label="Total Mints"
              value={(totalMints || 0).toLocaleString()}
              icon={<TrendingUp size={20} />}
              onClick={() => onTabChange('all')}
              deltaPct={activityStats?.weeklyGrowth}
              showTrend={false}
              subtitle="All time mints"
            />
          </FloatOnHover>
        </StaggerItem>
        
        {connected && (
          <StaggerItem>
            <FloatOnHover>
              <StatCard
                label="Owned NFTs"
                value={nftLoading ? '...' : (activityStats?.totalOwned || 0)}
                icon={<Gem size={20} />}
                onClick={() => onTabChange('owned')}
                showTrend={false}
                subtitle="Your collection"
              />
            </FloatOnHover>
          </StaggerItem>
        )}
      </StaggerChildren>
    </div>
  );
}
