import type { ScxtEvent } from '@/data/events';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://syndicatextokyo.app';

/**
 * イベント用 JSON-LD (Event schema) を生成
 */
export function getEventStructuredData(event: ScxtEvent): object {
  const startDate = new Date(event.startAt).toISOString();
  const endDate = new Date(event.endAt).toISOString();
  const imageUrl = event.heroImage.startsWith('http')
    ? event.heroImage
    : `${BASE_URL}${event.heroImage}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description,
    startDate,
    endDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: event.venue,
      address: {
        '@type': 'PostalAddress',
        streetAddress: event.address,
        addressLocality: 'Tokyo',
        addressCountry: 'JP',
      },
    },
    image: imageUrl,
    offers: event.ticketUrl
      ? {
          '@type': 'Offer',
          url: event.ticketUrl,
          price: event.priceText,
        }
      : undefined,
  };
}
