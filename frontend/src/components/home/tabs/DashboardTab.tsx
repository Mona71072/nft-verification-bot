import { DashboardInsights } from '../../../features/dashboard/DashboardInsights';
import { getResponsiveValue } from '../../../hooks/useResponsive';

interface CollectionSummary {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  imageUrl?: string;
  detailUrl?: string;
  packageId?: string;
  roleId?: string;
  originalId?: string;
}

interface EventSummary {
  id: string;
  name: string;
  eventDate?: string | null;
  mintedCount?: number | null;
  totalCap?: number | null;
  collectionId?: string | null;
  active?: boolean | null;
}

interface DashboardTabProps {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  collections: CollectionSummary[];
  events: EventSummary[];
  onchainCounts: Map<string, number>;
}

export function DashboardTab({
  deviceType,
  collections,
  events,
  onchainCounts
}: DashboardTabProps) {
  return (
    <div>
      <h2
        style={{
          fontSize: getResponsiveValue('1rem', '1.125rem', '1.25rem', deviceType),
          fontWeight: '700',
          marginBottom: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType),
          color: '#e0e7ff',
          letterSpacing: '-0.01em'
        }}
      >
        SyndicateXTokyo Dashboard
      </h2>

      <DashboardInsights
        deviceType={deviceType}
        collections={collections}
        events={events}
        onchainCounts={onchainCounts}
      />
    </div>
  );
}
