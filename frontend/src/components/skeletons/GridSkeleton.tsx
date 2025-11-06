import React from 'react';
import { cn } from '@/lib/utils';

interface GridSkeletonProps {
  count?: number;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  className?: string;
}

/**
 * NFTグリッド用Skeleton
 */
export function GridSkeleton({ 
  count = 6, 
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  className 
}: GridSkeletonProps) {
  return (
    <div
      className={cn(
        "grid gap-4",
        `grid-cols-${columns.mobile || 1}`,
        `sm:grid-cols-${columns.tablet || 2}`,
        `md:grid-cols-${columns.desktop || 3}`,
        className
      )}
      style={{
        gridTemplateColumns: typeof window !== 'undefined' && window.innerWidth < 640 
          ? `repeat(${columns.mobile || 1}, 1fr)`
          : typeof window !== 'undefined' && window.innerWidth < 1024
          ? `repeat(${columns.tablet || 2}, 1fr)`
          : `repeat(${columns.desktop || 3}, 1fr)`
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-lg border border-border/50 bg-card/40 overflow-hidden"
        >
          {/* Image placeholder */}
          <div className="aspect-square bg-muted/50" />
          {/* Content placeholder */}
          <div className="p-4 space-y-3">
            <div className="h-5 w-3/4 bg-muted/50 rounded" />
            <div className="h-4 w-full bg-muted/30 rounded" />
            <div className="h-4 w-5/6 bg-muted/30 rounded" />
            <div className="h-3 w-1/2 bg-muted/20 rounded mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

