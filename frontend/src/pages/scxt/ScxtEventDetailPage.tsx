import { useEffect } from 'react';
import { useScxtEvents } from '@/hooks/useScxtEvents';
import { useScxtSEO } from '@/hooks/useScxtSEO';
import { getEventStructuredData } from '@/utils/eventStructuredData';
import { EventDetailHeader } from '@/components/scxt/EventDetailHeader';
import { CTASection } from '@/components/scxt/CTASection';
import { FAQAccordion } from '@/components/scxt/FAQAccordion';
import { FadeIn } from '@/components/motion/FadeIn';

interface ScxtEventDetailPageProps {
  slug: string;
}

export function ScxtEventDetailPage({ slug }: ScxtEventDetailPageProps) {
  const { getEventBySlug } = useScxtEvents();
  const event = getEventBySlug(slug);

  useScxtSEO({
    title: event?.title ?? 'イベント詳細',
    description: event?.description?.slice(0, 160),
    image: event?.heroImage,
    ogType: 'article',
  });

  useEffect(() => {
    if (!event) return;
    const data = getEventStructuredData(event);
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    script.id = 'scxt-event-jsonld';
    const existing = document.getElementById('scxt-event-jsonld');
    if (existing) existing.remove();
    document.head.appendChild(script);
    return () => {
      document.getElementById('scxt-event-jsonld')?.remove();
    };
  }, [event]);

  if (!event) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="text-xl text-white/80">イベントが見つかりません</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <EventDetailHeader event={event} />

        <div className="mt-8">
          <CTASection ticketUrl={event.ticketUrl} />
        </div>

        <FadeIn className="mt-12">
          <h2 className="text-xl font-semibold text-white mb-4">概要</h2>
          <p className="text-white/80 whitespace-pre-wrap">{event.description}</p>
        </FadeIn>

        {event.highlights && event.highlights.length > 0 && (
          <FadeIn className="mt-8">
            <h2 className="text-xl font-semibold text-white mb-4">ハイライト</h2>
            <ul className="list-disc list-inside text-white/80 space-y-1">
              {event.highlights.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ul>
          </FadeIn>
        )}

        <FadeIn className="mt-8">
          <h2 className="text-xl font-semibold text-white mb-4">詳細</h2>
          <dl className="space-y-2 text-white/80">
            <div>
              <dt className="font-medium text-white/90">日時</dt>
              <dd>{new Date(event.startAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</dd>
            </div>
            <div>
              <dt className="font-medium text-white/90">会場</dt>
              <dd>{event.venue}</dd>
              {event.address && <dd className="text-white/70">{event.address}</dd>}
            </div>
            <div>
              <dt className="font-medium text-white/90">料金</dt>
              <dd>{event.priceText}</dd>
            </div>
            {event.capacityText && (
              <div>
                <dt className="font-medium text-white/90">定員</dt>
                <dd>{event.capacityText}</dd>
              </div>
            )}
          </dl>
        </FadeIn>

        {event.lineup && event.lineup.length > 0 && (
          <FadeIn className="mt-8">
            <h2 className="text-xl font-semibold text-white mb-4">出演者</h2>
            <ul className="space-y-2">
              {event.lineup.map((p, i) => (
                <li key={i} className="text-white/80">
                  {p.name}
                  {p.role && <span className="text-white/60 ml-2">({p.role})</span>}
                </li>
              ))}
            </ul>
          </FadeIn>
        )}

        {event.timetable && event.timetable.length > 0 && (
          <FadeIn className="mt-8">
            <h2 className="text-xl font-semibold text-white mb-4">タイムテーブル</h2>
            <ul className="space-y-2">
              {event.timetable.map((t, i) => (
                <li key={i} className="text-white/80">
                  <span className="font-medium text-white/90">{t.time}</span>
                  <span className="ml-2">{t.description}</span>
                </li>
              ))}
            </ul>
          </FadeIn>
        )}

        {event.notes && event.notes.length > 0 && (
          <FadeIn className="mt-8">
            <h2 className="text-xl font-semibold text-white mb-4">注意事項</h2>
            <ul className="list-disc list-inside text-white/80 space-y-1">
              {event.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          </FadeIn>
        )}

        {event.faq && event.faq.length > 0 && (
          <FadeIn className="mt-12">
            <FAQAccordion items={event.faq} />
          </FadeIn>
        )}

        <div className="mt-12 pt-8 border-t border-white/10">
          <CTASection ticketUrl={event.ticketUrl} />
        </div>
      </div>
    </div>
  );
}
