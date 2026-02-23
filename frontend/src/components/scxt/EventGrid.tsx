import { EventCard } from './EventCard';
import { CategoryFilter } from './CategoryFilter';
import type { ScxtEvent } from '@/data/events';
import type { ScxtCategory } from '@/hooks/useScxtEvents';
import { cn } from '@/lib/utils';

interface EventGridProps {
  events: ScxtEvent[];
  category: ScxtCategory;
  onCategoryChange: (value: ScxtCategory) => void;
  className?: string;
}

export function EventGrid({
  events,
  category,
  onCategoryChange,
  className,
}: EventGridProps) {
  return (
    <div className={cn('space-y-6', className)}>
      <CategoryFilter value={category} onChange={onCategoryChange} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {events.map((event) => (
          <EventCard key={event.slug} event={event} />
        ))}
      </div>
      {events.length === 0 && (
        <p className="text-center text-white/50 py-12">該当するイベントがありません</p>
      )}
    </div>
  );
}
