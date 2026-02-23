import { EventCard } from './EventCard';
import { CTASection } from './CTASection';
import { useScxtEvents } from '@/hooks/useScxtEvents';
import { cn } from '@/lib/utils';

interface NextEventWidgetProps {
  className?: string;
}

export function NextEventWidget({ className }: NextEventWidgetProps) {
  const { nextEvent } = useScxtEvents();

  if (!nextEvent) return null;

  return (
    <aside className={cn('p-4 rounded-lg bg-white/5 border border-white/10', className)}>
      <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">
        Next Event
      </h3>
      <EventCard event={nextEvent} />
      <div className="mt-3">
        <CTASection ticketUrl={nextEvent.ticketUrl} showWallet={false} />
      </div>
    </aside>
  );
}
