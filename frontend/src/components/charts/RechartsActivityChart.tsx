import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react';

interface ActivityData {
  date: string;
  count: number;
  label?: string;
}

interface DotConfig {
  radius?: number;
  activeRadius?: number;
  strokeWidth?: number;
}

interface RechartsActivityChartProps {
  data: ActivityData[];
  title: string;
  subtitle?: string;
  height?: number;
  showTrend?: boolean;
  className?: string;
  isCompact?: boolean;
  dotConfig?: DotConfig;
}

export function RechartsActivityChart({
  data,
  title,
  subtitle,
  height = 200,
  showTrend = true,
  className = '',
  isCompact = false,
  dotConfig
}: RechartsActivityChartProps) {
// Trend calculation
  const trend = React.useMemo(() => {
    if (!data || data.length < 2) return { direction: 'neutral', percentage: 0 };
    
    const firstValue = data[0].count;
    const lastValue = data[data.length - 1].count;
    const percentage = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
    const direction = percentage > 5 ? 'up' : percentage < -5 ? 'down' : 'neutral';
    
    return { direction, percentage: Math.abs(percentage) };
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: 'rgba(30, 27, 75, 0.6)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        border: '1px solid rgba(79, 70, 229, 0.3)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            borderRadius: '50%',
            margin: '0 auto 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '1.5rem'
          }}>📊</div>
          <p style={{ color: '#a5b4fc', fontSize: '0.875rem', margin: 0 }}>No data available</p>
        </div>
      </div>
    );
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'rgba(30, 27, 75, 0.95)',
          border: '1px solid rgba(79, 70, 229, 0.3)',
          borderRadius: '12px',
          padding: '1rem',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          backdropFilter: 'blur(8px)'
        }}>
          <p style={{
            margin: '0 0 0.5rem 0',
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#c7d2fe'
          }}>
            {label}
          </p>
          <p style={{
            margin: 0,
            fontSize: '1.125rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            {payload[0].value} mints
          </p>
        </div>
      );
    }
    return null;
  };

  const denseThreshold = isCompact ? 14 : 20;
  const isDenseDataset = data.length > denseThreshold;
  const resolvedStrokeWidth = dotConfig?.strokeWidth ?? (isDenseDataset ? 2 : 3);
  const resolvedDotRadius = dotConfig?.radius ?? (isDenseDataset ? (isCompact ? 2.5 : 3.5) : 5.5);
  const resolvedActiveDotRadius = dotConfig?.activeRadius ?? (isDenseDataset ? resolvedDotRadius + 1.5 : resolvedDotRadius + 2);
  const resolvedXAxisFontSize = isCompact ? 10 : 12;
  const resolvedYAxisFontSize = isCompact ? 10 : 12;
  const chartMargin = isCompact
    ? { top: 12, right: 18, left: 12, bottom: 12 }
    : { top: 20, right: 30, left: 20, bottom: 20 };

  return (
    <div style={{
      background: 'rgba(30, 27, 75, 0.6)',
      backdropFilter: 'blur(10px)',
      borderRadius: '20px',
      border: '1px solid rgba(79, 70, 229, 0.3)',
      padding: '2rem',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
      position: 'relative',
      overflow: 'hidden',
      ...(className ? {} : {})
    }}>
      {/* Decorative accent */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4, #10b981)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 3s ease-in-out infinite'
      }} />
      
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '2rem',
        position: 'relative',
        zIndex: 1
      }}>
        <div>
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: '800',
            background: 'linear-gradient(135deg, #ffffff 0%, #e0e7ff 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: 0,
            letterSpacing: '-0.025em'
          }}>{title}</h3>
          {subtitle && (
            <p style={{
              fontSize: '0.875rem',
              color: '#a5b4fc',
              margin: '0.5rem 0 0 0',
              fontWeight: '500'
            }}>{subtitle}</p>
          )}
        </div>
        
        {showTrend && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.75rem 1.25rem',
            background: trend.direction === 'up' 
              ? 'rgba(16, 185, 129, 0.2)'
              : trend.direction === 'down'
              ? 'rgba(220, 38, 38, 0.2)'
              : 'rgba(30, 27, 75, 0.5)',
            borderRadius: '16px',
            border: trend.direction === 'up'
              ? '1px solid rgba(16, 185, 129, 0.3)'
              : trend.direction === 'down'
              ? '1px solid rgba(220, 38, 38, 0.3)'
              : '1px solid rgba(79, 70, 229, 0.3)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
          }}>
            {trend.direction === 'up' && (
              <div style={{ display: 'flex', alignItems: 'center', color: '#10b981' }}>
                <TrendingUp style={{ width: '20px', height: '20px' }} />
                <span style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '700', 
                  marginLeft: '0.5rem' 
                }}>
                  +{trend.percentage.toFixed(1)}%
                </span>
              </div>
            )}
            {trend.direction === 'down' && (
              <div style={{ display: 'flex', alignItems: 'center', color: '#ef4444' }}>
                <TrendingDown style={{ width: '20px', height: '20px' }} />
                <span style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '700', 
                  marginLeft: '0.5rem' 
                }}>
                  -{trend.percentage.toFixed(1)}%
                </span>
              </div>
            )}
            {trend.direction === 'neutral' && (
              <div style={{ display: 'flex', alignItems: 'center', color: '#a5b4fc' }}>
                <Calendar style={{ width: '20px', height: '20px' }} />
                <span style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '700', 
                  marginLeft: '0.5rem' 
                }}>
                  Stable
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div style={{ height: `${height}px`, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={chartMargin}>
            <defs>
              <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05}/>
              </linearGradient>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3b82f6"/>
                <stop offset="50%" stopColor="#8b5cf6"/>
                <stop offset="100%" stopColor="#06b6d4"/>
              </linearGradient>
            </defs>
            
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="rgba(79, 70, 229, 0.3)" 
              opacity={0.3}
            />
            
            <XAxis 
              dataKey="label" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: resolvedXAxisFontSize, fill: '#a5b4fc', fontWeight: 500 }}
              tickMargin={isCompact ? 6 : 10}
            />
            
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: resolvedYAxisFontSize, fill: '#a5b4fc', fontWeight: 500 }}
              tickMargin={isCompact ? 6 : 10}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            <Area
              type="monotone"
              dataKey="count"
              stroke="url(#lineGradient)"
              strokeWidth={resolvedStrokeWidth}
              fill="url(#colorGradient)"
              dot={{
                fill: '#ffffff',
                stroke: '#3b82f6',
                strokeWidth: resolvedStrokeWidth,
                r: resolvedDotRadius,
                strokeDasharray: '0'
              }}
              activeDot={{
                r: resolvedActiveDotRadius,
                stroke: '#3b82f6',
                strokeWidth: resolvedStrokeWidth,
                fill: '#ffffff',
                filter: 'drop-shadow(0 4px 8px rgba(59, 130, 246, 0.3))'
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}

/**
 * Trend chart component (Recharts)
 */
export function RechartsTrendChart({
  data,
  title,
  height = 120,
  className = ''
}: {
  data: ActivityData[];
  title: string;
  height?: number;
  className?: string;
}) {
  return (
    <div style={{
      background: 'rgba(30, 27, 75, 0.6)',
      backdropFilter: 'blur(10px)',
      borderRadius: '16px',
      padding: '1.5rem',
      border: '1px solid rgba(79, 70, 229, 0.3)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
      position: 'relative',
      overflow: 'hidden',
      ...(className ? {} : {})
    }}>
      {/* Decorative background */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '80px',
        height: '80px',
        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
        borderRadius: '0 16px 0 100%',
        opacity: 0.08
      }} />
      
      <h4 style={{
        fontSize: '1rem',
        fontWeight: '700',
        color: '#e0e7ff',
        margin: '0 0 1.5rem 0',
        letterSpacing: '-0.025em'
      }}>{title}</h4>
      
      <div style={{
        background: 'rgba(30, 27, 75, 0.4)',
        backdropFilter: 'blur(10px)',
        borderRadius: '12px',
        padding: '1rem',
        border: '1px solid rgba(79, 70, 229, 0.3)',
        boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data}>
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#3b82f6"/>
                <stop offset="100%" stopColor="#8b5cf6"/>
              </linearGradient>
            </defs>
            
            <XAxis 
              dataKey="label" 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#a5b4fc' }}
            />
            
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: '#a5b4fc' }}
            />
            
            <Line
              type="monotone"
              dataKey="count"
              stroke="url(#trendGradient)"
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                stroke: '#3b82f6',
                strokeWidth: 2,
                fill: '#ffffff'
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
