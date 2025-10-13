import React from 'react';
import { cn } from '@/lib/utils';

interface CalendarSkeletonProps {
  className?: string;
}

/**
 * カレンダーグリッド用Skeleton
 */
export function CalendarSkeleton({ className }: CalendarSkeletonProps) {
  return (
    <div className={cn("animate-pulse space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="h-8 w-24 bg-muted/50 rounded" />
        <div className="h-8 w-32 bg-muted/50 rounded" />
        <div className="h-8 w-24 bg-muted/50 rounded" />
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2 px-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-6 bg-muted/30 rounded" />
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2 px-2">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="aspect-square bg-muted/30 rounded" />
        ))}
      </div>

      {/* Event list */}
      <div className="mt-6 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-3 bg-card/40 rounded-lg border border-border/50">
            <div className="h-4 w-1/3 bg-muted/50 rounded mb-2" />
            <div className="h-3 w-1/2 bg-muted/30 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

