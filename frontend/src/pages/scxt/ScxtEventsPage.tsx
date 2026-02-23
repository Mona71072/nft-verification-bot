import { useState } from 'react';
import { EventGrid } from '@/components/scxt/EventGrid';
import { NextEventWidget } from '@/components/scxt/NextEventWidget';
import { useScxtEvents } from '@/hooks/useScxtEvents';
import type { ScxtCategory } from '@/hooks/useScxtEvents';
import { FadeIn } from '@/components/motion/FadeIn';
import { useScxtSEO } from '@/hooks/useScxtSEO';

export function ScxtEventsPage() {
  useScxtSEO({ title: 'イベント - SCXT', description: 'DJ・英会話イベント一覧' });
  const [category, setCategory] = useState<ScxtCategory>('all');
  const { events } = useScxtEvents(category);

  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <FadeIn>
          <h1 className="text-3xl font-bold text-white mb-2">Events</h1>
          <p className="text-white/70 mb-8">DJ・英会話イベント</p>
        </FadeIn>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <EventGrid
              events={events}
              category={category}
              onCategoryChange={setCategory}
            />
          </div>
          <NextEventWidget className="lg:sticky lg:top-24 lg:self-start" />
        </div>
      </div>
    </div>
  );
}
