import { useMemo } from 'react';
import { scxtEvents, type ScxtEvent } from '../data/events';

export type ScxtCategory = 'dj' | 'english' | 'all';

/**
 * SCXT イベント一覧の取得・フィルタ用フック
 * 将来 CMS 差し替え時は fetch/API 呼び出しに変更
 */
export function useScxtEvents(categoryFilter: ScxtCategory = 'all') {
  const events = useMemo(() => {
    if (categoryFilter === 'all') return scxtEvents;
    return scxtEvents.filter((e) => e.category === categoryFilter);
  }, [categoryFilter]);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()),
    [events]
  );

  const nextEvent = useMemo((): ScxtEvent | null => {
    const now = Date.now();
    const upcoming = scxtEvents
      .filter((e) => new Date(e.startAt).getTime() >= now)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
    return upcoming[0] ?? null;
  }, []);

  const getEventBySlug = (slug: string): ScxtEvent | undefined =>
    scxtEvents.find((e) => e.slug === slug);

  return {
    events: sortedEvents,
    nextEvent,
    allEvents: scxtEvents,
    getEventBySlug,
  };
}
