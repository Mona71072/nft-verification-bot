import { formatEventDate } from '@/data/events';
import type { ScxtEvent } from '@/data/events';

interface EventDetailHeaderProps {
  event: ScxtEvent;
}

export function EventDetailHeader({ event }: EventDetailHeaderProps) {
  return (
    <header className="relative">
      <div className="aspect-[21/9] max-h-[400px] overflow-hidden rounded-lg">
        <img
          src={event.heroImage}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>
      <div className="mt-6 space-y-2">
        <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
          {event.category}
        </span>
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          {event.title}
        </h1>
        <p className="text-lg text-white/80">{formatEventDate(event.startAt)}</p>
        <p className="text-white/70">
          {event.venue}
          {event.address && ` · ${event.address}`}
        </p>
      </div>
    </header>
  );
}
