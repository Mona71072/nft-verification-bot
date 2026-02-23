import { EventCard } from './EventCard';
import { CTASection } from './CTASection';
import { useScxtEvents } from '@/hooks/useScxtEvents';
import { useScxtNav } from '@/contexts/ScxtNavContext';
import { FadeIn } from '@/components/motion/FadeIn';
import { cn } from '@/lib/utils';

interface HeroSectionProps {
  className?: string;
}

export function HeroSection({ className }: HeroSectionProps) {
  const onNavigate = useScxtNav();
  const { nextEvent } = useScxtEvents();

  return (
    <section className={cn('py-16 md:py-24', className)}>
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <FadeIn delay={0.1}>
          <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight">
            SyndicateXTokyo
          </h1>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            東京発。音楽・英会話・Web3が交わる、新しいイベントとコミュニティ。
          </p>
        </FadeIn>
        <FadeIn delay={0.3}>
          <CTASection
            ticketUrl={nextEvent?.ticketUrl}
            showDiscord
            showWallet
          />
        </FadeIn>
      </div>

      {nextEvent && (
        <FadeIn delay={0.4} className="mt-16 max-w-md mx-auto">
          <h2 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-4 text-center">
            Next Event
          </h2>
          <EventCard event={nextEvent} onNavigate={onNavigate} />
        </FadeIn>
      )}
    </section>
  );
}
