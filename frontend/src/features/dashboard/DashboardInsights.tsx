// React import removed as it's not used
import { 
  TrendingUp, 
  Calendar, 
  Trophy, 
  Star,
  BarChart3,
  Clock
} from 'lucide-react';
import { RechartsActivityChart, RechartsTrendChart } from '../../components/charts/RechartsActivityChart';
import { useResponsive, getResponsiveValue } from '../../hooks/useResponsive';
import { useState } from 'react';

interface DashboardInsightsProps {
  dailyData: Array<{ date: string; count: number; label?: string }>;
  weeklyData: Array<{ date: string; count: number; label?: string }>;
  monthlyData: Array<{ date: string; count: number; label?: string }>;
  collectionStats: Array<{
    id: string;
    name: string;
    totalMints: number;
    ownedCount: number;
    trend: number;
  }>;
  totalMints: number; // イベント登録済みNFT数
  totalOwned: number; // イベント登録済みNFT数（totalMintsと同じ値、互換性のため保持）
  dailyGrowth: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
  recentActivity: {
    lastMintDate: string | null;
    mintStreak: number;
    averageMintsPerWeek: number;
  };
}

/**
 * ダッシュボードインサイトコンポーネント
 * - ユーザーのNFT保有パターン分析
 * - 月間ハイライト表示
 * - アクティビティ統計の可視化
 */
export function DashboardInsights({
  dailyData,
  weeklyData,
  monthlyData,
  collectionStats,
  totalMints,
  totalOwned,
  dailyGrowth,
  weeklyGrowth,
  monthlyGrowth,
  recentActivity
}: DashboardInsightsProps) {
  const { deviceType } = useResponsive();
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');

  // 選択された期間に応じたデータと成長率を取得
  const getCurrentData = () => {
    switch (selectedPeriod) {
      case 'daily':
        return {
          data: dailyData,
          growth: dailyGrowth,
          title: 'Daily Activity',
          subtitle: 'NFT minting activity over the past 30 days'
        };
      case 'weekly':
        return {
          data: weeklyData,
          growth: weeklyGrowth,
          title: 'Weekly Activity',
          subtitle: 'NFT minting activity over the past 12 weeks'
        };
      case 'monthly':
        return {
          data: monthlyData,
          growth: monthlyGrowth,
          title: 'Monthly Activity',
          subtitle: 'NFT minting activity over the past 12 months'
        };
      default:
        return {
          data: weeklyData,
          growth: weeklyGrowth,
          title: 'Weekly Activity',
          subtitle: 'NFT minting activity over the past 12 weeks'
        };
    }
  };

  const currentData = getCurrentData();

  // 個人の統計情報（ユーザー固有のデータ）
  // totalMintsはイベント登録済みNFT数、totalOwnedは全保有NFT数
  const personalInsights = [
    {
      title: 'My NFTs',
      value: totalOwned.toString(),
      subtitle: totalOwned === 0 ? 'Start your collection' : 'Total owned NFTs',
      icon: <Trophy size={16} />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      trend: totalOwned > 0 ? 'positive' : 'neutral'
    },
    {
      title: 'Personal Mints',
      value: totalMints.toString(),
      subtitle: totalMints === 0 ? 'Join events to mint' : 'NFTs minted from events',
      icon: <Star size={16} />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      trend: totalMints > 0 ? 'positive' : 'neutral'
    },
    {
      title: 'Collections Joined',
      value: collectionStats.filter(c => c.ownedCount > 0).length.toString(),
      subtitle: 'Unique collections',
      icon: <BarChart3 size={16} />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      trend: collectionStats.filter(c => c.ownedCount > 0).length > 1 ? 'positive' : 'neutral'
    }
  ];

  // プラットフォーム全体の統計情報
  const platformInsights = [
    {
      title: 'Total Collections',
      value: collectionStats.length.toString(),
      subtitle: 'Available collections',
      icon: <BarChart3 size={16} />,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200',
      trend: 'neutral'
    },
    {
      title: 'Last Activity',
      value: recentActivity.lastMintDate ? new Date(recentActivity.lastMintDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No activity',
      subtitle: recentActivity.lastMintDate ? 'Most recent mint' : 'Start participating',
      icon: <Clock size={16} />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      trend: recentActivity.lastMintDate ? 'positive' : 'neutral'
    }
  ];


  return (
    <div style={{
      display: 'grid',
      gap: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType),
      gridTemplateColumns: getResponsiveValue(
        '1fr',
        'repeat(2, 1fr)',
        'repeat(2, 1fr)',
        deviceType
      )
    }}>
      {/* Activity Charts */}
      <div style={{
        gridColumn: getResponsiveValue('1 / -1', '1 / -1', '1 / 3', deviceType),
        display: 'flex',
        flexDirection: 'column',
        gap: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType)
      }}>
        {/* 期間選択UI */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
          gap: getResponsiveValue('0.375rem', '0.5rem', '0.625rem', deviceType)
        }}>
          {[
            { key: 'daily', label: 'Daily', icon: <Calendar size={12} /> },
            { key: 'weekly', label: 'Weekly', icon: <BarChart3 size={12} /> },
            { key: 'monthly', label: 'Monthly', icon: <TrendingUp size={12} /> }
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setSelectedPeriod(key as 'daily' | 'weekly' | 'monthly')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: getResponsiveValue('0.375rem', '0.4375rem', '0.5rem', deviceType),
                padding: getResponsiveValue('0.5rem 0.75rem', '0.5625rem 0.875rem', '0.625rem 1rem', deviceType),
                background: selectedPeriod === key 
                  ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                  : 'rgba(30, 27, 75, 0.6)',
                backdropFilter: selectedPeriod === key ? 'none' : 'blur(10px)',
                color: selectedPeriod === key ? 'white' : '#c7d2fe',
                border: selectedPeriod === key ? 'none' : '1px solid rgba(79, 70, 229, 0.3)',
                borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
                cursor: 'pointer',
                fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType),
                fontWeight: selectedPeriod === key ? '600' : '500',
                transition: 'all 0.2s ease',
                boxShadow: selectedPeriod === key 
                  ? '0 2px 8px rgba(59, 130, 246, 0.25)' 
                  : '0 1px 2px rgba(0, 0, 0, 0.08)'
              }}
              onMouseEnter={(e) => {
                if (selectedPeriod !== key) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedPeriod !== key) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                }
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        <RechartsActivityChart
          data={currentData.data}
          title={currentData.title}
          subtitle={currentData.subtitle}
          height={getResponsiveValue(180, 200, 220, deviceType)}
        />
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: getResponsiveValue('1fr', 'repeat(2, 1fr)', 'repeat(2, 1fr)', deviceType),
          gap: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType)
        }}>
          <RechartsTrendChart
            data={monthlyData}
            title="Monthly Trend"
            height={getResponsiveValue(100, 120, 140, deviceType)}
          />
          
        <div style={{
          background: 'rgba(30, 27, 75, 0.6)',
          backdropFilter: 'blur(10px)',
          borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
          padding: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType),
          border: '1px solid rgba(79, 70, 229, 0.3)'
        }}>
          <h4 style={{
            fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.875rem', deviceType),
            fontWeight: '600',
            color: '#a5b4fc',
            marginBottom: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType)
          }}>
            Your Collection
          </h4>
          <div style={{
            fontSize: getResponsiveValue('1.125rem', '1.25rem', '1.5rem', deviceType),
            fontWeight: '700',
            color: '#667eea',
            marginBottom: getResponsiveValue('0.375rem', '0.5rem', '0.5rem', deviceType)
          }}>
            {totalMints > 0 ? `${totalMints} NFTs` : 'No NFTs'}
          </div>
          <p style={{
            fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.75rem', deviceType),
            color: '#a5b4fc'
          }}>
            {totalMints > 0 ? `${totalMints} event registered` : 'Start collecting NFTs'}
          </p>
        </div>
        </div>
      </div>

      {/* Personal Statistics Section */}
      <div style={{
        gridColumn: getResponsiveValue('1 / -1', '1 / -1', '1 / 2', deviceType),
        display: 'flex',
        flexDirection: 'column',
          gap: getResponsiveValue('0.5rem', '0.75rem', '1rem', deviceType)
        }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: getResponsiveValue('0.375rem', '0.4375rem', '0.5rem', deviceType),
          marginBottom: getResponsiveValue('0.375rem', '0.5rem', '0.5rem', deviceType)
        }}>
          <div style={{
            width: getResponsiveValue('18px', '20px', '22px', deviceType),
            height: getResponsiveValue('18px', '20px', '22px', deviceType),
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <Trophy size={10} />
          </div>
          <h3 style={{
            fontSize: getResponsiveValue('0.8125rem', '0.875rem', '1rem', deviceType),
            fontWeight: '700',
            color: '#e0e7ff',
            margin: 0
          }}>
            My Activity
          </h3>
        </div>
        {personalInsights.map((insight, index) => (
          <div
            key={index}
            style={{
              background: 'rgba(30, 27, 75, 0.6)',
              backdropFilter: 'blur(10px)',
              borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
              padding: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType),
              border: `1px solid ${insight.borderColor === 'border-yellow-200' ? '#fde68a' : 
                insight.borderColor === 'border-orange-200' ? '#fed7aa' :
                insight.borderColor === 'border-blue-200' ? '#bfdbfe' :
                insight.borderColor === 'border-green-200' ? '#bbf7d0' :
                insight.borderColor === 'border-indigo-200' ? '#c7d2fe' :
                insight.borderColor === 'border-emerald-200' ? '#a7f3d0' :
                insight.borderColor === 'border-amber-200' ? '#fde68a' :
                insight.borderColor === 'border-red-200' ? '#fecaca' : '#e5e7eb'}`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!getResponsiveValue(true, false, false, deviceType)) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (!getResponsiveValue(true, false, false, deviceType)) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
              }
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType),
              marginBottom: getResponsiveValue('0.375rem', '0.5rem', '0.5rem', deviceType)
            }}>
              <div style={{
                width: getResponsiveValue('24px', '28px', '32px', deviceType),
                height: getResponsiveValue('24px', '28px', '32px', deviceType),
                borderRadius: getResponsiveValue('6px', '8px', '8px', deviceType),
                background: insight.bgColor === 'bg-yellow-50' ? 'rgba(254, 252, 232, 0.3)' :
                  insight.bgColor === 'bg-orange-50' ? 'rgba(255, 247, 237, 0.3)' :
                  insight.bgColor === 'bg-blue-50' ? 'rgba(239, 246, 255, 0.3)' :
                  insight.bgColor === 'bg-green-50' ? 'rgba(240, 253, 244, 0.3)' :
                  insight.bgColor === 'bg-indigo-50' ? 'rgba(238, 242, 255, 0.3)' :
                  insight.bgColor === 'bg-emerald-50' ? 'rgba(236, 253, 245, 0.3)' :
                  insight.bgColor === 'bg-amber-50' ? 'rgba(255, 251, 235, 0.3)' :
                  insight.bgColor === 'bg-red-50' ? 'rgba(254, 242, 242, 0.3)' : 'rgba(30, 27, 75, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: insight.color === 'text-yellow-600' ? '#d97706' :
                  insight.color === 'text-orange-600' ? '#ea580c' :
                  insight.color === 'text-blue-600' ? '#2563eb' :
                  insight.color === 'text-green-600' ? '#16a34a' :
                  insight.color === 'text-indigo-600' ? '#4f46e5' :
                  insight.color === 'text-emerald-600' ? '#059669' :
                  insight.color === 'text-amber-600' ? '#d97706' :
                  insight.color === 'text-red-600' ? '#dc2626' : '#6b7280'
              }}>
                {insight.icon}
              </div>
              <h4 style={{
                fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType),
                fontWeight: '600',
                color: '#c7d2fe',
                margin: 0
              }}>
                {insight.title}
              </h4>
            </div>
            
            <div style={{
              fontSize: getResponsiveValue('1rem', '1.125rem', '1.25rem', deviceType),
              fontWeight: '700',
              color: '#e0e7ff',
              marginBottom: getResponsiveValue('0.25rem', '0.25rem', '0.25rem', deviceType)
            }}>
              {insight.value}
            </div>
            
            <p style={{
              fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.75rem', deviceType),
              color: '#a5b4fc',
              margin: 0
            }}>
              {insight.subtitle}
            </p>
          </div>
        ))}
      </div>

      {/* Platform Statistics Section */}
      <div style={{
        gridColumn: getResponsiveValue('1 / -1', '1 / -1', '2 / 3', deviceType),
        display: 'flex',
        flexDirection: 'column',
          gap: getResponsiveValue('0.5rem', '0.75rem', '1rem', deviceType)
        }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: getResponsiveValue('0.375rem', '0.4375rem', '0.5rem', deviceType),
          marginBottom: getResponsiveValue('0.375rem', '0.5rem', '0.5rem', deviceType)
        }}>
          <div style={{
            width: getResponsiveValue('18px', '20px', '22px', deviceType),
            height: getResponsiveValue('18px', '20px', '22px', deviceType),
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <BarChart3 size={10} />
          </div>
          <h3 style={{
            fontSize: getResponsiveValue('0.8125rem', '0.875rem', '1rem', deviceType),
            fontWeight: '700',
            color: '#e0e7ff',
            margin: 0
          }}>
            Platform Info
          </h3>
        </div>
        {platformInsights.map((insight, index) => (
          <div
            key={index}
            style={{
              background: 'rgba(30, 27, 75, 0.6)',
              backdropFilter: 'blur(10px)',
              borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
              padding: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType),
              border: `1px solid ${insight.borderColor === 'border-yellow-200' ? '#fde68a' : 
                insight.borderColor === 'border-orange-200' ? '#fed7aa' :
                insight.borderColor === 'border-blue-200' ? '#bfdbfe' :
                insight.borderColor === 'border-green-200' ? '#bbf7d0' :
                insight.borderColor === 'border-indigo-200' ? '#c7d2fe' :
                insight.borderColor === 'border-emerald-200' ? '#a7f3d0' :
                insight.borderColor === 'border-amber-200' ? '#fde68a' :
                insight.borderColor === 'border-red-200' ? '#fecaca' : '#e5e7eb'}`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!getResponsiveValue(true, false, false, deviceType)) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              if (!getResponsiveValue(true, false, false, deviceType)) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
              }
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType),
              marginBottom: getResponsiveValue('0.375rem', '0.5rem', '0.5rem', deviceType)
            }}>
              <div style={{
                width: getResponsiveValue('24px', '28px', '32px', deviceType),
                height: getResponsiveValue('24px', '28px', '32px', deviceType),
                borderRadius: getResponsiveValue('6px', '8px', '8px', deviceType),
                background: insight.bgColor === 'bg-yellow-50' ? 'rgba(254, 252, 232, 0.3)' :
                  insight.bgColor === 'bg-orange-50' ? 'rgba(255, 247, 237, 0.3)' :
                  insight.bgColor === 'bg-blue-50' ? 'rgba(239, 246, 255, 0.3)' :
                  insight.bgColor === 'bg-green-50' ? 'rgba(240, 253, 244, 0.3)' :
                  insight.bgColor === 'bg-indigo-50' ? 'rgba(238, 242, 255, 0.3)' :
                  insight.bgColor === 'bg-emerald-50' ? 'rgba(236, 253, 245, 0.3)' :
                  insight.bgColor === 'bg-amber-50' ? 'rgba(255, 251, 235, 0.3)' :
                  insight.bgColor === 'bg-red-50' ? 'rgba(254, 242, 242, 0.3)' : 'rgba(30, 27, 75, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: insight.color === 'text-yellow-600' ? '#d97706' :
                  insight.color === 'text-orange-600' ? '#ea580c' :
                  insight.color === 'text-blue-600' ? '#2563eb' :
                  insight.color === 'text-green-600' ? '#16a34a' :
                  insight.color === 'text-indigo-600' ? '#4f46e5' :
                  insight.color === 'text-emerald-600' ? '#059669' :
                  insight.color === 'text-amber-600' ? '#d97706' :
                  insight.color === 'text-red-600' ? '#dc2626' : '#6b7280'
              }}>
                {insight.icon}
              </div>
              <h4 style={{
                fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType),
                fontWeight: '600',
                color: '#c7d2fe',
                margin: 0
              }}>
                {insight.title}
              </h4>
            </div>
            
            <div style={{
              fontSize: getResponsiveValue('1rem', '1.125rem', '1.25rem', deviceType),
              fontWeight: '700',
              color: '#e0e7ff',
              marginBottom: getResponsiveValue('0.25rem', '0.25rem', '0.25rem', deviceType)
            }}>
              {insight.value}
            </div>
            
            <p style={{
              fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.75rem', deviceType),
              color: '#a5b4fc',
              margin: 0
            }}>
              {insight.subtitle}
            </p>
          </div>
        ))}
      </div>

    </div>
  );
}
