import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Calendar, BarChart3 } from 'lucide-react';

interface ActivityData {
  date: string;
  count: number;
  label?: string;
}

interface ActivityChartProps {
  data: ActivityData[];
  title: string;
  subtitle?: string;
  height?: number;
  showTrend?: boolean;
  className?: string;
}

/**
 * アクティビティチャートコンポーネント
 * - SVGベースの軽量チャート
 * - レスポンシブ対応
 * - アニメーション付き
 */
export function ActivityChart({
  data,
  title,
  subtitle,
  height = 200,
  showTrend = true,
  className = ''
}: ActivityChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return { points: '', maxValue: 0, minValue: 0 };
    
    const values = data.map(d => d.count);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;
    
    const points = data.map((item, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((item.count - minValue) / range) * 100;
      return `${x},${y}`;
    }).join(' ');
    
    return { points, maxValue, minValue, range };
  }, [data]);

  const trend = useMemo(() => {
    if (!data || data.length < 2) return { direction: 'neutral', percentage: 0 };
    
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, item) => sum + item.count, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, item) => sum + item.count, 0) / secondHalf.length;
    
    const percentage = firstAvg === 0 ? 0 : ((secondAvg - firstAvg) / firstAvg) * 100;
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
        background: '#f9fafb',
        borderRadius: '8px',
        ...(className ? {} : {})
      }}>
        <div style={{ textAlign: 'center' }}>
          <BarChart3 style={{ width: '48px', height: '48px', color: '#9ca3af', margin: '0 auto 0.5rem' }} />
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No data available</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 0.8; transform: translateY(0); }
        }
        
        @keyframes drawLine {
          from { stroke-dashoffset: 1000; }
          to { stroke-dashoffset: 0; }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
        
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <div style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        padding: '1.5rem',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        overflow: 'hidden',
        ...(className ? {} : {})
      }}>
        {/* 背景装飾 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 3s ease-in-out infinite'
        }} />
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          position: 'relative',
          zIndex: 1
        }}>
          <div>
            <h3 style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              letterSpacing: '-0.025em'
            }}>{title}</h3>
            {subtitle && (
              <p style={{
                fontSize: '0.875rem',
                color: '#64748b',
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
              padding: '0.5rem 1rem',
              background: trend.direction === 'up' 
                ? 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)'
                : trend.direction === 'down'
                ? 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)'
                : 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
              borderRadius: '12px',
              border: trend.direction === 'up'
                ? '1px solid #bbf7d0'
                : trend.direction === 'down'
                ? '1px solid #fecaca'
                : '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
            }}>
              {trend.direction === 'up' && (
                <div style={{ display: 'flex', alignItems: 'center', color: '#059669' }}>
                  <TrendingUp style={{ width: '18px', height: '18px' }} />
                  <span style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    marginLeft: '0.5rem' 
                  }}>
                    +{trend.percentage.toFixed(1)}%
                  </span>
                </div>
              )}
              {trend.direction === 'down' && (
                <div style={{ display: 'flex', alignItems: 'center', color: '#dc2626' }}>
                  <TrendingDown style={{ width: '18px', height: '18px' }} />
                  <span style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
                    marginLeft: '0.5rem' 
                  }}>
                    -{trend.percentage.toFixed(1)}%
                  </span>
                </div>
              )}
              {trend.direction === 'neutral' && (
                <div style={{ display: 'flex', alignItems: 'center', color: '#64748b' }}>
                  <Calendar style={{ width: '18px', height: '18px' }} />
                  <span style={{ 
                    fontSize: '0.875rem', 
                    fontWeight: '600', 
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
      <div style={{ position: 'relative', height: `${height}px` }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* 美しいグラデーション */}
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.05" />
            </linearGradient>
            
            {/* ライン用グラデーション */}
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
            
            {/* グロー効果 */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge> 
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            {/* ドロップシャドウ */}
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#3b82f6" floodOpacity="0.3"/>
            </filter>
          </defs>
          
          {/* グリッドライン */}
          <g opacity="0.1">
            {[0, 25, 50, 75, 100].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="#64748b"
                strokeWidth="0.5"
              />
            ))}
            {[0, 20, 40, 60, 80, 100].map((x) => (
              <line
                key={x}
                x1={x}
                y1="0"
                x2={x}
                y2="100"
                stroke="#64748b"
                strokeWidth="0.5"
              />
            ))}
          </g>
          
          {/* エリアグラデーション */}
          <path
            d={`M 0,100 L ${chartData.points} L 100,100 Z`}
            fill="url(#chartGradient)"
            style={{ 
              animation: 'fadeIn 1.5s ease-out',
              opacity: 0.8
            }}
          />
          
          {/* メインライン */}
          <polyline
            fill="none"
            stroke="url(#lineGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={chartData.points}
            filter="url(#glow)"
            style={{ 
              animation: 'drawLine 2s ease-out',
              strokeDasharray: '1000',
              strokeDashoffset: '1000',
              animationFillMode: 'forwards'
            }}
          />
          
          {/* データポイント */}
          {data.map((item, index) => {
            const x = (index / (data.length - 1)) * 100;
            const y = 100 - ((item.count - chartData.minValue) / (chartData.range || 1)) * 100;
            return (
              <g key={index}>
                {/* ポイントのグロー */}
                <circle
                  cx={x}
                  cy={y}
                  r="6"
                  fill="#3b82f6"
                  opacity="0.3"
                  style={{
                    animation: `pulse 2s ease-in-out infinite`,
                    animationDelay: `${index * 0.1}s`
                  }}
                />
                {/* メインポイント */}
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill="white"
                  stroke="url(#lineGradient)"
                  strokeWidth="2"
                  style={{
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    filter: 'url(#shadow)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.setAttribute('r', '6');
                    e.currentTarget.setAttribute('stroke-width', '3');
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.setAttribute('r', '4');
                    e.currentTarget.setAttribute('stroke-width', '2');
                  }}
                />
                {/* インナーポイント */}
                <circle
                  cx={x}
                  cy={y}
                  r="2"
                  fill="url(#lineGradient)"
                  style={{
                    transition: 'all 0.3s ease'
                  }}
                />
              </g>
            );
          })}
        </svg>
        
        {/* Y-axis labels */}
        <div style={{
          position: 'absolute',
          left: '-2rem',
          top: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          fontWeight: '600',
          color: '#64748b',
          zIndex: 1
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            fontSize: '0.875rem',
            fontWeight: '700'
          }}>{chartData.maxValue}</div>
          <div style={{
            color: '#94a3b8',
            fontSize: '0.75rem'
          }}>{Math.round((chartData.maxValue + chartData.minValue) / 2)}</div>
          <div style={{
            color: '#cbd5e1',
            fontSize: '0.75rem'
          }}>{chartData.minValue}</div>
        </div>
      </div>

        {/* X-axis labels */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '1rem',
          padding: '0.75rem 0',
          borderTop: '1px solid #f1f5f9'
        }}>
          {data.length > 0 && (
            <>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#475569',
                background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                padding: '0.25rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                {data[0].label || data[0].date}
              </div>
              {data.length > 1 && (
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#475569',
                  background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  {data[Math.floor(data.length / 2)].label || data[Math.floor(data.length / 2)].date}
                </div>
              )}
              {data.length > 2 && (
                <div style={{
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  color: '#475569',
                  background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0'
                }}>
                  {data[data.length - 1].label || data[data.length - 1].date}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * トレンドチャートコンポーネント（シンプル版）
 */
export function TrendChart({
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
      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
      borderRadius: '12px',
      padding: '1.25rem',
      border: '1px solid #e2e8f0',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
      position: 'relative',
      overflow: 'hidden',
      ...(className ? {} : {})
    }}>
      {/* 装飾的な背景 */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '60px',
        height: '60px',
        background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
        borderRadius: '0 12px 0 100%',
        opacity: 0.1
      }} />
      
      <h4 style={{
        fontSize: '0.9375rem',
        fontWeight: '600',
        background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        margin: '0 0 1rem 0',
        letterSpacing: '-0.025em'
      }}>{title}</h4>
      
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '0.75rem',
        border: '1px solid #f1f5f9',
        boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        <ActivityChart
          data={data}
          title=""
          height={height}
          showTrend={false}
          className="bg-transparent border-0 shadow-none p-0"
        />
      </div>
    </div>
  );
}
