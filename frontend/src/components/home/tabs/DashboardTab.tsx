import { DashboardInsights } from '../../../features/dashboard/DashboardInsights';
import { getResponsiveValue } from '../../../hooks/useResponsive';

interface DashboardTabProps {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  activityStats: {
    dailyData?: Array<{ date: string; count: number; label?: string }>;
    weeklyData?: Array<{ date: string; count: number; label?: string }>;
    monthlyData?: Array<{ date: string; count: number; label?: string }>;
    collectionStats?: Array<{ id: string; name: string; totalMints: number; ownedCount: number; trend: number }>;
    totalMints?: number;
    totalOwned?: number;
    dailyGrowth?: number;
    weeklyGrowth?: number;
    monthlyGrowth?: number;
    recentActivity?: {
      lastMintDate: string | null;
      mintStreak: number;
      averageMintsPerWeek: number;
    };
    trends?: {
      isGrowing: boolean;
      growthRate: number;
      peakActivity: string;
      lowActivity: string;
    };
  };
  allOwnedNFTs: Array<{
    objectId: string;
    type: string;
    display?: {
      name?: string;
      description?: string;
      image_url?: string;
      event_date?: string;
    };
    owner?: unknown;
  }>;
}

export function DashboardTab({
  deviceType,
  activityStats,
  allOwnedNFTs
}: DashboardTabProps) {
  // activityStats.totalMintsはイベント登録済みNFT数
  const eventRegisteredNFTs = activityStats?.totalMints || 0;
  
  // allOwnedNFTsは設定されたコレクションに含まれるすべてのNFT
  const totalOwnedNFTs = allOwnedNFTs?.length || 0;

  return (
    <div>
      <h2 style={{
        fontSize: getResponsiveValue('1rem', '1.125rem', '1.25rem', deviceType),
        fontWeight: '700',
        marginBottom: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType),
        color: '#e0e7ff',
        letterSpacing: '-0.01em'
      }}>
        Dashboard Insights
      </h2>

      <DashboardInsights
        dailyData={activityStats?.dailyData || []}
        weeklyData={activityStats?.weeklyData || []}
        monthlyData={activityStats?.monthlyData || []}
        collectionStats={activityStats?.collectionStats || []}
        totalMints={eventRegisteredNFTs}
        totalOwned={totalOwnedNFTs}
        dailyGrowth={activityStats?.dailyGrowth || 0}
        weeklyGrowth={activityStats?.weeklyGrowth || 0}
        monthlyGrowth={activityStats?.monthlyGrowth || 0}
        recentActivity={activityStats?.recentActivity || {
          lastMintDate: null,
          mintStreak: 0,
          averageMintsPerWeek: 0
        }}
      />
    </div>
  );
}
