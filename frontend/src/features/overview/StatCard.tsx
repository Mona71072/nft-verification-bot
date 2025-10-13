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
        "group relative w-full rounded-2xl border border-border/20 bg-gradient-to-br from-card/80 to-card/40 p-6 shadow-lg backdrop-blur-sm transition-all duration-300",
        onClick && !loading && "cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:border-primary/20",
        !onClick && "cursor-default",
        loading && "pointer-events-none opacity-70",
        className
      )}
      style={{
        minHeight: isMobile ? 'auto' : '140px',
      }}
    >
      {/* Top Row: Label + Delta */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="text-2xl opacity-80 group-hover:scale-110 transition-transform duration-200">
              {icon}
            </div>
          )}
          <span className="text-sm text-muted-foreground font-medium tracking-wide">
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
      <div className="mt-1">
        {loading ? (
          <div className="h-10 w-32 bg-muted/50 rounded animate-pulse" />
        ) : (
          <div
            className={cn(
              "text-3xl md:text-4xl font-bold tracking-tight text-foreground",
              "transition-colors duration-300 group-hover:text-primary"
            )}
          >
            {value}
          </div>
        )}
      </div>

      {/* Sparkline Trend */}
      {trend && trend.length > 0 && !loading && (
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
              d={`M 0,40 ${trend.map((v, i) => {
                const x = (i / (trend.length - 1)) * 100;
                const y = 40 - (v * 40);
                return `L ${x},${y}`;
              }).join(' ')} L 100,40 Z`}
            />
            {/* Line */}
            <polyline
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={trend
                .map((v, i) => {
                  const x = (i / (trend.length - 1)) * 100;
                  const y = 40 - (v * 40);
                  return `${x},${y}`;
                })
                .join(' ')}
            />
          </svg>
        </div>
      )}

      {/* Click indicator */}
      {onClick && !loading && isHovered && (
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground opacity-50">
          ▸
        </div>
      )}
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

