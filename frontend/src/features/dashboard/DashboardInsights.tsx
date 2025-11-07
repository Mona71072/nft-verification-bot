import {
  TrendingUp,
  Calendar,
  Trophy,
  Star,
  BarChart3,
  Clock
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { RechartsActivityChart, RechartsTrendChart } from '../../components/charts/RechartsActivityChart';
import { useResponsive, getResponsiveValue } from '../../hooks/useResponsive';

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
  totalMints: number;
  totalOwned: number;
  dailyGrowth: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
  recentActivity: {
    lastMintDate: string | null;
    mintStreak: number;
    averageMintsPerWeek: number;
  };
}

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

  const joinedCollectionsCount = useMemo(
    () => collectionStats.filter((collection) => collection.ownedCount > 0).length,
    [collectionStats]
  );

  const availableCollectionsCount = useMemo(
    () => collectionStats.length,
    [collectionStats]
  );

  const formattedLastMintDate = useMemo(() => {
    if (!recentActivity.lastMintDate) return null;
    const date = new Date(recentActivity.lastMintDate);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, [recentActivity.lastMintDate]);

  const averageMintsPerWeek = useMemo(() => {
    const value = Number(recentActivity.averageMintsPerWeek ?? 0);
    if (!Number.isFinite(value)) return 0;
    return value;
  }, [recentActivity.averageMintsPerWeek]);

  const currentData = useMemo(() => {
    switch (selectedPeriod) {
      case 'daily':
        return {
          data: dailyData,
          growth: dailyGrowth,
          title: 'Daily Activity',
          subtitle: 'Mint activity over the past 30 days'
        };
      case 'weekly':
        return {
          data: weeklyData,
          growth: weeklyGrowth,
          title: 'Weekly Activity',
          subtitle: 'Mint activity over the past 12 weeks'
        };
      case 'monthly':
        return {
          data: monthlyData,
          growth: monthlyGrowth,
          title: 'Monthly Activity',
          subtitle: 'Mint activity over the past 12 months'
        };
      default:
        return {
          data: weeklyData,
          growth: weeklyGrowth,
          title: 'Weekly Activity',
          subtitle: 'Mint activity over the past 12 weeks'
        };
    }
  }, [dailyData, dailyGrowth, monthlyData, monthlyGrowth, selectedPeriod, weeklyData, weeklyGrowth]);

  const chartHeight = getResponsiveValue(180, 200, 220, deviceType);
  const isChartCompact = selectedPeriod === 'daily' && deviceType === 'mobile';

  const personalInsights = useMemo(() => [
    {
      title: 'NFTs Owned',
      value: totalOwned.toLocaleString('en-US'),
      subtitle: totalOwned === 0 ? 'Mint your first NFT to get started' : 'NFTs currently in your wallet',
      icon: <Trophy className="w-5 h-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      title: 'Event NFTs Minted',
      value: totalMints.toLocaleString('en-US'),
      subtitle: totalMints === 0 ? 'Join an event to mint your first NFT' : 'NFTs minted through event participation',
      icon: <Star className="w-5 h-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      title: 'Collections Joined',
      value: joinedCollectionsCount.toLocaleString('en-US'),
      subtitle: 'Unique collections where you own at least one NFT',
      icon: <BarChart3 className="w-5 h-5" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200'
    }
  ], [joinedCollectionsCount, totalMints, totalOwned]);

  const platformInsights = useMemo(() => [
    {
      title: 'Collections Live',
      value: availableCollectionsCount.toLocaleString('en-US'),
      subtitle: 'Collections currently accepting mints',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      borderColor: 'border-indigo-200'
    },
    {
      title: 'Average Weekly Mints',
      value: averageMintsPerWeek.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      subtitle: 'Average mint count across the last 4 weeks',
      icon: <BarChart3 className="w-5 h-5" />,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200'
    },
    {
      title: 'Current Mint Streak',
      value: recentActivity.mintStreak > 0 ? `${recentActivity.mintStreak} days` : '0 days',
      subtitle: recentActivity.mintStreak > 0 ? 'Active streak of consecutive mint days' : 'No active mint streak yet',
      icon: <Clock className="w-5 h-5" />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200'
    },
    {
      title: 'Last Mint',
      value: formattedLastMintDate ?? 'No mints yet',
      subtitle: formattedLastMintDate ? 'Most recent mint date' : 'Join an event to create your first mint record',
      icon: <Calendar className="w-5 h-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    }
  ], [availableCollectionsCount, averageMintsPerWeek, formattedLastMintDate, recentActivity.mintStreak]);

  return (
    <div style={{
      display: 'grid',
      gap: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
      gridTemplateColumns: getResponsiveValue('1fr', 'repeat(2, 1fr)', 'repeat(2, 1fr)', deviceType)
    }}>
      <div style={{
        gridColumn: getResponsiveValue('1 / -1', '1 / -1', '1 / 3', deviceType),
        display: 'flex',
        flexDirection: 'column',
        gap: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType)
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap'
        }}>
          {[
            { key: 'daily', label: 'Daily', icon: <Calendar className="w-4 h-4" /> },
            { key: 'weekly', label: 'Weekly', icon: <BarChart3 className="w-4 h-4" /> },
            { key: 'monthly', label: 'Monthly', icon: <TrendingUp className="w-4 h-4" /> }
          ].map(({ key, label, icon }) => {
            const isActive = selectedPeriod === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedPeriod(key as 'daily' | 'weekly' | 'monthly')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: getResponsiveValue('0.65rem 1rem', '0.75rem 1.25rem', '0.75rem 1.5rem', deviceType),
                  background: isActive
                    ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                    : 'white',
                  color: isActive ? 'white' : '#475569',
                  border: isActive ? 'none' : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: getResponsiveValue('0.8125rem', '0.875rem', '0.9375rem', deviceType),
                  fontWeight: isActive ? 700 : 500,
                  transition: 'all 0.2s ease',
                  boxShadow: isActive
                    ? '0 4px 12px rgba(59, 130, 246, 0.3)'
                    : '0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
                onMouseEnter={(event) => {
                  if (!isActive) {
                    event.currentTarget.style.transform = 'translateY(-1px)';
                    event.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
                  }
                }}
                onMouseLeave={(event) => {
                  if (!isActive) {
                    event.currentTarget.style.transform = 'translateY(0)';
                    event.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                  }
                }}
              >
                {icon}
                {label}
              </button>
            );
          })}
        </div>

        <RechartsActivityChart
          data={currentData.data}
          title={currentData.title}
          subtitle={currentData.subtitle}
          height={chartHeight}
          isCompact={isChartCompact}
          dotConfig={isChartCompact ? { radius: 2.5, activeRadius: 4, strokeWidth: 2 } : undefined}
        />

        <div style={{
          display: 'grid',
          gridTemplateColumns: getResponsiveValue('1fr', 'repeat(2, 1fr)', 'repeat(2, 1fr)', deviceType),
          gap: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType)
        }}>
          <RechartsTrendChart
            data={monthlyData}
            title="Monthly Trend"
            height={getResponsiveValue(120, 140, 160, deviceType)}
          />
          <div style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
            borderRadius: '12px',
            padding: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
            border: '1px solid #e2e8f0'
          }}>
            <h4 style={{
              fontSize: getResponsiveValue('0.875rem', '1rem', '1.125rem', deviceType),
              fontWeight: 600,
              color: '#1e293b',
              marginBottom: '0.75rem'
            }}>
              Wallet Highlights
            </h4>
            <div style={{
              fontSize: getResponsiveValue('1.5rem', '1.75rem', '2rem', deviceType),
              fontWeight: 700,
              color: '#3b82f6',
              marginBottom: '0.5rem'
            }}>
              {totalOwned > 0 ? `${totalOwned.toLocaleString('en-US')} NFT` : 'No NFTs yet'}
            </div>
            <p style={{
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
              color: '#64748b',
              margin: 0
            }}>
              {totalMints > 0
                ? `${totalMints.toLocaleString('en-US')} mints captured through events`
                : 'Join an event to start building your collection'}
            </p>
          </div>
        </div>
      </div>

      <div style={{
        gridColumn: getResponsiveValue('1 / -1', '1 / -1', '1 / 2', deviceType),
        display: 'flex',
        flexDirection: 'column',
        gap: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType)
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '0.5rem'
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <Trophy className="w-3 h-3" />
          </div>
          <h3 style={{
            fontSize: getResponsiveValue('1rem', '1.125rem', '1.25rem', deviceType),
            fontWeight: 700,
            color: '#1f2937',
            margin: 0
          }}>
            Account Summary
          </h3>
        </div>
        {personalInsights.map((insight) => (
          <div
            key={insight.title}
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
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
            onMouseEnter={(event) => {
              if (!getResponsiveValue(true, false, false, deviceType)) {
                event.currentTarget.style.transform = 'translateY(-2px)';
                event.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }
            }}
            onMouseLeave={(event) => {
              if (!getResponsiveValue(true, false, false, deviceType)) {
                event.currentTarget.style.transform = 'translateY(0)';
                event.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
              }
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.5rem'
            }}>
              <div style={{
                width: getResponsiveValue('32px', '36px', '40px', deviceType),
                height: getResponsiveValue('32px', '36px', '40px', deviceType),
                borderRadius: '8px',
                background: insight.bgColor === 'bg-yellow-50' ? '#fefce8' :
                  insight.bgColor === 'bg-orange-50' ? '#fff7ed' :
                  insight.bgColor === 'bg-blue-50' ? '#eff6ff' :
                  insight.bgColor === 'bg-green-50' ? '#f0fdf4' :
                  insight.bgColor === 'bg-indigo-50' ? '#eef2ff' :
                  insight.bgColor === 'bg-emerald-50' ? '#ecfdf5' :
                  insight.bgColor === 'bg-amber-50' ? '#fffbeb' :
                  insight.bgColor === 'bg-red-50' ? '#fef2f2' : '#f9fafb',
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
                fontSize: getResponsiveValue('0.8125rem', '0.875rem', '0.9375rem', deviceType),
                fontWeight: 600,
                color: '#374151',
                margin: 0
              }}>
                {insight.title}
              </h4>
            </div>

            <div style={{
              fontSize: getResponsiveValue('1.25rem', '1.5rem', '1.75rem', deviceType),
              fontWeight: 700,
              color: '#1f2937',
              marginBottom: '0.25rem'
            }}>
              {insight.value}
            </div>

            <p style={{
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
              color: '#6b7280',
              margin: 0
            }}>
              {insight.subtitle}
            </p>
          </div>
        ))}
      </div>

      <div style={{
        gridColumn: getResponsiveValue('1 / -1', '1 / -1', '2 / 3', deviceType),
        display: 'flex',
        flexDirection: 'column',
        gap: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType)
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem',
          marginBottom: '0.5rem'
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <BarChart3 className="w-3 h-3" />
          </div>
          <h3 style={{
            fontSize: getResponsiveValue('1rem', '1.125rem', '1.25rem', deviceType),
            fontWeight: 700,
            color: '#1f2937',
            margin: 0
          }}>
            Activity Overview
          </h3>
        </div>
        {platformInsights.map((insight) => (
          <div
            key={insight.title}
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
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
            onMouseEnter={(event) => {
              if (!getResponsiveValue(true, false, false, deviceType)) {
                event.currentTarget.style.transform = 'translateY(-2px)';
                event.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }
            }}
            onMouseLeave={(event) => {
              if (!getResponsiveValue(true, false, false, deviceType)) {
                event.currentTarget.style.transform = 'translateY(0)';
                event.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
              }
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '0.5rem'
            }}>
              <div style={{
                width: getResponsiveValue('32px', '36px', '40px', deviceType),
                height: getResponsiveValue('32px', '36px', '40px', deviceType),
                borderRadius: '8px',
                background: insight.bgColor === 'bg-yellow-50' ? '#fefce8' :
                  insight.bgColor === 'bg-orange-50' ? '#fff7ed' :
                  insight.bgColor === 'bg-blue-50' ? '#eff6ff' :
                  insight.bgColor === 'bg-green-50' ? '#f0fdf4' :
                  insight.bgColor === 'bg-indigo-50' ? '#eef2ff' :
                  insight.bgColor === 'bg-emerald-50' ? '#ecfdf5' :
                  insight.bgColor === 'bg-amber-50' ? '#fffbeb' :
                  insight.bgColor === 'bg-red-50' ? '#fef2f2' : '#f9fafb',
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
                fontSize: getResponsiveValue('0.8125rem', '0.875rem', '0.9375rem', deviceType),
                fontWeight: 600,
                color: '#374151',
                margin: 0
              }}>
                {insight.title}
              </h4>
            </div>

            <div style={{
              fontSize: getResponsiveValue('1.25rem', '1.5rem', '1.75rem', deviceType),
              fontWeight: 700,
              color: '#1f2937',
              marginBottom: '0.25rem'
            }}>
              {insight.value}
            </div>

            <p style={{
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
              color: '#6b7280',
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

