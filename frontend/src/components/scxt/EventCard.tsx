import { formatEventDateShort } from '@/data/events';
import type { ScxtEvent } from '@/data/events';
import { useScxtNav } from '@/contexts/ScxtNavContext';
import { cn } from '@/lib/utils';

interface EventCardProps {
  event: ScxtEvent;
  onNavigate?: (path: string) => void;
  className?: string;
}

export function EventCard({ event, onNavigate, className }: EventCardProps) {
  const nav = useScxtNav();
  const navigate = onNavigate ?? nav;

  const handleClick = () => {
    navigate?.(`/scxt/events/${event.slug}`);
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className={cn(
        'group block text-left rounded-lg overflow-hidden bg-white/5 border border-white/10',
        'hover:bg-white/8 hover:border-white/20 transition-all duration-200 cursor-pointer',
        className
      )}
    >
      <div className="aspect-[16/10] bg-white/5 overflow-hidden">
        <img
          src={event.heroImage}
          alt=""
          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
        />
      </div>
      <div className="p-4">
        <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
          {event.category}
        </span>
        <span className="text-white/40 mx-2">·</span>
        <span className="text-xs text-white/60">
          {formatEventDateShort(event.startAt)}
        </span>
        <h3 className="mt-2 text-lg font-semibold text-white line-clamp-2">
          {event.title}
        </h3>
        <p className="mt-1 text-sm text-white/70">{event.venue}</p>
      </div>
    </article>
  );
}
