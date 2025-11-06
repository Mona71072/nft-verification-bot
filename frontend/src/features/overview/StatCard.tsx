import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  deltaPct?: number;
  trend?: number[];
  icon?: React.ReactNode;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
  // 新しく追加されたプロパティ
  subtitle?: string;
  showTrend?: boolean;
  trendData?: Array<{ date: string; count: number; label?: string }>;
}

/**
 * KPI統計カードコンポーネント
 * - 数字 + トレンド + スパークライン
 * - クリックで該当セクションへスクロール
 */
export function StatCard({
  label,
  value,
  deltaPct,
  trend,
  icon,
  loading,
  onClick,
  className,
  subtitle,
  showTrend = true,
  trendData,
}: StatCardProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <button
      onClick={onClick}
      disabled={!onClick || loading}
      onMouseEnter={() => !isMobile && setIsHovered(true)}
      onMouseLeave={() => !isMobile && setIsHovered(false)}
      className={cn(
        "group relative w-full rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/10 p-6 shadow-2xl backdrop-blur-xl transition-all duration-500 ease-out",
        onClick && !loading && "cursor-pointer hover:-translate-y-2 hover:shadow-3xl hover:border-white/20 hover:scale-[1.02]",
        !onClick && "cursor-default",
        loading && "pointer-events-none opacity-70",
        className
      )}
      style={{
        minHeight: isMobile ? 'auto' : '120px',
        background: isHovered 
          ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 50%, rgba(6, 182, 212, 0.1) 100%)'
          : 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.1) 100%)',
        boxShadow: isHovered 
          ? '0 20px 40px rgba(59, 130, 246, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
          : '0 6px 24px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Top Row: Label + Delta */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {icon && (
            <div 
              className="text-2xl opacity-90 group-hover:scale-110 transition-all duration-300 group-hover:rotate-2"
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.3))'
              }}
            >
              {icon}
            </div>
          )}
          <span 
            className="text-sm font-semibold tracking-wider uppercase"
            style={{
              color: '#a5b4fc',
              textShadow: '0 0 10px rgba(165, 180, 252, 0.3)'
            }}
          >
            {label}
          </span>
        </div>
        {typeof deltaPct === 'number' && (
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full font-medium",
              deltaPct >= 0
                ? "bg-success-500/10 text-success-600 dark:text-success-400"
                : "bg-danger-500/10 text-danger-600 dark:text-danger-400"
            )}
          >
            {deltaPct >= 0 ? '↑' : '↓'} {Math.abs(deltaPct).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Value */}
      <div className="mt-2">
        {loading ? (
          <div 
            className="h-12 w-40 rounded-lg animate-pulse"
            style={{
              background: 'linear-gradient(90deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.1) 100%)'
            }}
          />
        ) : (
          <div>
            <div
              className={cn(
                "text-3xl md:text-4xl font-black tracking-tight",
                "transition-all duration-500 group-hover:scale-105"
              )}
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #e0e7ff 25%, #c7d2fe 50%, #a5b4fc 75%, #8b5cf6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: isHovered ? '0 0 30px rgba(59, 130, 246, 0.5)' : '0 0 20px rgba(59, 130, 246, 0.3)',
                filter: isHovered ? 'drop-shadow(0 0 15px rgba(59, 130, 246, 0.4))' : 'none'
              }}
            >
              {value}
            </div>
            {subtitle && (
              <div className="text-sm text-gray-400 mt-1 opacity-80">
                {subtitle}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sparkline Trend */}
      {showTrend && (trend && trend.length > 0 || trendData && trendData.length > 0) && !loading && (
        <div className="mt-3 h-10 overflow-hidden opacity-70 group-hover:opacity-100 transition-opacity">
          <svg
            className="w-full h-full"
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`gradient-${label}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* Area under line */}
            <path
              fill={`url(#gradient-${label})`}
              d={(() => {
                const data = trend || trendData?.map(d => d.count) || [];
                if (data.length === 0) return "M 0,40 L 100,40 Z";
                
                // データを正規化（0-1の範囲に）
                const maxValue = Math.max(...data);
                const minValue = Math.min(...data);
                const range = maxValue - minValue;
                const normalizedData = range > 0 ? data.map(v => (v - minValue) / range) : data.map(() => 0.5);
                
                if (data.length === 1) {
                  const y = 40 - (normalizedData[0] * 35 + 2.5); // 2.5-37.5の範囲で描画
                  return `M 0,40 L 50,${y} L 100,40 Z`;
                }
                
                return `M 0,40 ${normalizedData.map((v, i, arr) => {
                  const x = (i / (arr.length - 1)) * 100;
                  const y = 40 - (v * 35 + 2.5); // 2.5-37.5の範囲で描画
                  return `L ${x},${y}`;
                }).join(' ')} L 100,40 Z`;
              })()}
            />
            {/* Line */}
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={(() => {
                const data = trend || trendData?.map(d => d.count) || [];
                if (data.length === 0) return "0,40 100,40";
                
                // データを正規化（0-1の範囲に）
                const maxValue = Math.max(...data);
                const minValue = Math.min(...data);
                const range = maxValue - minValue;
                const normalizedData = range > 0 ? data.map(v => (v - minValue) / range) : data.map(() => 0.5);
                
                if (data.length === 1) {
                  const y = 40 - (normalizedData[0] * 35 + 2.5); // 2.5-37.5の範囲で描画
                  return `50,${y}`;
                }
                
                return normalizedData.map((v, i, arr) => {
                  const x = (i / (arr.length - 1)) * 100;
                  const y = 40 - (v * 35 + 2.5); // 2.5-37.5の範囲で描画
                  return `${x},${y}`;
                }).join(' ');
              })()}
            />
          </svg>
        </div>
      )}

      {/* Click indicator */}
      {onClick && !loading && isHovered && (
        <div 
          className="absolute bottom-4 right-4 text-lg font-bold opacity-80 animate-pulse"
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.5))'
          }}
        >
          →
        </div>
      )}
      
      {/* Subtle background pattern */}
      <div 
        className="absolute inset-0 rounded-3xl opacity-5 group-hover:opacity-10 transition-opacity duration-500"
        style={{
          background: `
            radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.2) 0%, transparent 50%),
            linear-gradient(45deg, rgba(6, 182, 212, 0.1) 0%, transparent 50%)
          `,
          pointerEvents: 'none'
        }}
      />
    </button>
  );
}

/**
 * Skeleton for StatCard loading state
 */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl border border-border/50 bg-card/40 p-5 shadow-1",
        className
      )}
    >
      <div className="h-4 w-24 bg-muted/50 rounded mb-2" />
      <div className="h-10 w-36 bg-muted/50 rounded mt-2" />
      <div className="h-10 bg-muted/30 rounded mt-4" />
    </div>
  );
}

