import { useMemo } from 'react';
import {
  Sparkles,
  Layers,
  CalendarRange,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ExternalLink
} from 'lucide-react';

import { RechartsActivityChart } from '../../components/charts/RechartsActivityChart';
import { useResponsive, getResponsiveValue, type DeviceType } from '../../hooks/useResponsive';

interface CollectionSummary {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  imageUrl?: string;
  detailUrl?: string;
  packageId?: string;
  roleId?: string;
  originalId?: string;
}

interface EventSummary {
  id: string;
  name: string;
  eventDate?: string | null;
  mintedCount?: number | null;
  totalCap?: number | null;
  collectionId?: string | null;
  selectedCollectionId?: string | null;
  collectionName?: string | null;
  active?: boolean | null;
}

interface latestIssuedEvent {
  id: string;
  name: string;
  mintedCount: number;
  dateLabel?: string;
  collectionName?: string;
}

interface CollectionRow {
  id: string;
  name: string;
  minted: number;
  share: number;
  eventsCount: number;
  mintedFromEvents: number;
  tradeportMinted: number;
  totalCap: number;
  latestEventDateLabel: string;
  detailUrl?: string;
}

interface EventHighlight {
  id: string;
  name: string;
  mintedCount: number;
  dateLabel: string;
  collectionName?: string;
}

interface TimelinePoint {
  date: string;
  count: number;
  label: string;
}

interface DashboardInsightsProps {
  collections?: CollectionSummary[];
  events?: EventSummary[];
  onchainCounts?: Map<string, number> | Record<string, number> | undefined;
  deviceType?: DeviceType;
}

const parseEventDate = (value?: string | null): Date | null => {
  if (!value || value === 'null' || value === '{eventDate}') {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function DashboardInsights({
  collections,
  events,
  onchainCounts,
  deviceType: deviceTypeOverride
}: DashboardInsightsProps) {
  const responsive = useResponsive();
  const deviceType = deviceTypeOverride ?? responsive.deviceType;

  const {
    totalIssued,
    activeCollections,
    totalCollections,
    totalEvents,
    mintedLast30Days,
    monthlyGrowth,
    issuanceTimeline,
    latestIssuedEvent,
    topCollections,
    eventHighlights
  } = useMemo(() => {
    const safeCollections = Array.isArray(collections) ? collections : [];
    const safeEvents = Array.isArray(events) ? events : [];

    const collectionMap = new Map<string, CollectionSummary>();
    safeCollections.forEach((collection) => {
      collectionMap.set(collection.id, collection);
    });

    const synonymCount = new Map<string, number>();
    safeCollections.forEach((collection) => {
      const candidates = [collection.id, collection.packageId, collection.roleId, collection.originalId]
        .filter((value): value is string => Boolean(value));
      candidates.forEach((value) => {
        synonymCount.set(value, (synonymCount.get(value) || 0) + 1);
      });
    });

    const synonyms = new Map<string, string>();
    safeCollections.forEach((collection) => {
      const candidates = [collection.id, collection.packageId, collection.roleId, collection.originalId]
        .filter((value): value is string => Boolean(value));
      candidates.forEach((value) => {
        if ((synonymCount.get(value) || 0) === 1) {
          synonyms.set(value, collection.id);
        }
      });
    });

    const resolveCanonical = (value?: string | null): string | undefined => {
      if (!value) return undefined;
      if (synonyms.has(value)) return synonyms.get(value);
      for (const [synonym, canonical] of synonyms.entries()) {
        if (value.includes(synonym) || synonym.includes(value)) {
          return canonical;
        }
      }
      return collectionMap.has(value) ? value : undefined;
    };
    const resolveCanonicalByCollectionName = (name?: string | null): string | undefined => {
      if (!name) return undefined;
      const trimmed = name.trim();
      if (!trimmed) return undefined;
      const matched = safeCollections.find((collection) => {
        const displayName = collection.displayName || collection.name;
        return collection.name === trimmed || displayName === trimmed;
      });
      return matched?.id;
    };

    const onchainMap = onchainCounts instanceof Map
      ? onchainCounts
      : onchainCounts && typeof onchainCounts === 'object'
        ? new Map<string, number>(
            Object.entries(onchainCounts).map(([key, value]) => [key, Number.isFinite(value as number) ? Number(value) : Number(value) || 0])
          )
        : new Map<string, number>();

    const mintedByCollection = new Map<string, number>();
    onchainMap.forEach((count, key) => {
      const numericCount = Number.isFinite(count) ? Number(count) : Number(count) || 0;
      const canonical = resolveCanonical(key) ?? key;
      const existing = mintedByCollection.get(canonical) ?? 0;
      mintedByCollection.set(canonical, existing + Math.max(0, numericCount));
    });

    const fallbackMinted = new Map<string, number>();
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    let mintedLast30Days = 0;
    const monthBuckets = new Map<string, number>();

    const addToMonthBucket = (date: Date, amount: number) => {
      const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      monthBuckets.set(monthKey, (monthBuckets.get(monthKey) ?? 0) + amount);
      if (date >= thirtyDaysAgo) {
        mintedLast30Days += amount;
      }
    };

    const eventsWithMetadata = safeEvents.map((event) => {
      const mintedCount = Number.isFinite(event.mintedCount) ? Number(event.mintedCount) : Number(event.mintedCount) || 0;
      const parsedDate = parseEventDate(event.eventDate);
      const canonicalCollectionId = event.selectedCollectionId
        || resolveCanonicalByCollectionName(event.collectionName)
        || resolveCanonical(event.collectionId)
        || event.collectionId
        || null;

      if (mintedCount > 0 && canonicalCollectionId) {
        const current = fallbackMinted.get(canonicalCollectionId) ?? 0;
        fallbackMinted.set(canonicalCollectionId, current + mintedCount);
      }

      if (mintedCount > 0 && parsedDate) {
        addToMonthBucket(parsedDate, mintedCount);
      }

        return {
        event,
        mintedCount,
        parsedDate,
        canonicalCollectionId
      };
    });

    const eventsCountByCollection = new Map<string, number>();
    eventsWithMetadata.forEach((item) => {
      if (item.canonicalCollectionId) {
        eventsCountByCollection.set(
          item.canonicalCollectionId,
          (eventsCountByCollection.get(item.canonicalCollectionId) ?? 0) + 1
        );
      }
    });

    safeCollections.forEach((collection) => {
      if (!mintedByCollection.has(collection.id)) {
        const fallbackCount = fallbackMinted.get(collection.id) ?? 0;
        mintedByCollection.set(collection.id, fallbackCount);
      }
    });

    safeCollections.forEach((collection) => {
      const totalOnchain = mintedByCollection.get(collection.id) ?? 0;
      const totalEventMinted = eventsWithMetadata
        .filter((item) => item.canonicalCollectionId === collection.id)
        .reduce((sum, item) => sum + item.mintedCount, 0);

      const additionalMinted = Math.max(0, totalOnchain - totalEventMinted);
      const hasEvents = (eventsCountByCollection.get(collection.id) ?? 0) > 0;

      if (!hasEvents && additionalMinted > 0) {
        const fallbackDate = eventsWithMetadata
          .filter((item) => item.canonicalCollectionId === collection.id && item.parsedDate)
          .map((item) => item.parsedDate as Date)
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? now;

        addToMonthBucket(fallbackDate, additionalMinted);
      }
    });

    const totalIssued = Array.from(mintedByCollection.values()).reduce((sum, value) => {
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const activeCollections = Array.from(mintedByCollection.values()).filter((value) => value > 0).length;
    const totalCollections = safeCollections.length;
    const totalEvents = safeEvents.length;

    const issuanceTimeline: TimelinePoint[] = [];
    for (let i = 11; i >= 0; i -= 1) {
      const monthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const monthKey = `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}`;
      issuanceTimeline.push({
        date: `${monthKey}-01`,
        count: monthBuckets.get(monthKey) ?? 0,
        label: `${monthDate.getUTCFullYear()}/${String(monthDate.getUTCMonth() + 1).padStart(2, '0')}`
      });
    }

    let finalTimeline = issuanceTimeline;
    if (!issuanceTimeline.some((point) => point.count > 0) && totalIssued > 0) {
      finalTimeline = [{
        date: `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`,
        count: totalIssued,
        label: `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`
      }];
    }

    let monthlyGrowth = 0;
    if (finalTimeline.length >= 2) {
      const current = finalTimeline[finalTimeline.length - 1].count;
      const previous = finalTimeline[finalTimeline.length - 2].count;
      if (previous === 0) {
        monthlyGrowth = current > 0 ? 100 : 0;
      } else {
        monthlyGrowth = ((current - previous) / previous) * 100;
      }
    }

    const latestIssuedEventSource = eventsWithMetadata
      .filter((item) => item.parsedDate)
      .sort((a, b) => (b.parsedDate?.getTime() ?? 0) - (a.parsedDate?.getTime() ?? 0))
      .find((item) => item.mintedCount > 0) || null;

    const topCollections: CollectionRow[] = safeCollections
      .map((collection) => {
        const minted = mintedByCollection.get(collection.id) ?? 0;
        const relatedEvents = eventsWithMetadata.filter((item) => item.canonicalCollectionId === collection.id);
        const totalCap = relatedEvents.reduce((sum, item) => {
          const cap = Number.isFinite(item.event.totalCap) ? Number(item.event.totalCap) : Number(item.event.totalCap) || 0;
          return sum + cap;
        }, 0);
        const mintedFromEvents = relatedEvents.reduce((sum, item) => sum + (Number.isFinite(item.mintedCount) ? item.mintedCount : 0), 0);
        const hasEvents = (eventsCountByCollection.get(collection.id) ?? 0) > 0;
        const tradeportMinted = hasEvents ? 0 : Math.max(0, minted - mintedFromEvents);
        const latestEventDateLabel = relatedEvents
          .filter((item) => item.parsedDate)
          .sort((a, b) => (b.parsedDate?.getTime() ?? 0) - (a.parsedDate?.getTime() ?? 0))
          .map((item) => item.parsedDate!.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }))[0] ?? '-';

        return {
          id: collection.id,
          name: collection.displayName || collection.name,
          minted,
          share: totalIssued > 0 ? (minted / totalIssued) * 100 : 0,
          eventsCount: relatedEvents.length,
          mintedFromEvents,
          tradeportMinted,
          totalCap,
          latestEventDateLabel,
          detailUrl: collection.detailUrl
        };
      })
      .sort((a, b) => b.minted - a.minted);

    const eventHighlights: EventHighlight[] = eventsWithMetadata
      .filter((item) => item.mintedCount > 0)
      .sort((a, b) => b.mintedCount - a.mintedCount)
      .slice(0, 6)
      .map((item) => ({
        id: item.event.id,
        name: item.event.name,
        mintedCount: item.mintedCount,
        dateLabel: item.parsedDate
          ? item.parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
          : 'No date',
        collectionName: item.canonicalCollectionId && collectionMap.has(item.canonicalCollectionId)
          ? (collectionMap.get(item.canonicalCollectionId)?.displayName || collectionMap.get(item.canonicalCollectionId)?.name)
          : undefined
      }));

    const latestIssuedEvent: latestIssuedEvent | null = latestIssuedEventSource
      ? {
          id: latestIssuedEventSource.event.id,
          name: latestIssuedEventSource.event.name,
          mintedCount: latestIssuedEventSource.mintedCount,
          dateLabel: latestIssuedEventSource.parsedDate
            ? latestIssuedEventSource.parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            : undefined,
          collectionName: latestIssuedEventSource.canonicalCollectionId && collectionMap.has(latestIssuedEventSource.canonicalCollectionId)
            ? (collectionMap.get(latestIssuedEventSource.canonicalCollectionId)?.displayName || collectionMap.get(latestIssuedEventSource.canonicalCollectionId)?.name)
            : undefined
        }
      : null;

        return {
      totalIssued,
      activeCollections,
      totalCollections,
      totalEvents,
      mintedLast30Days,
      monthlyGrowth,
      issuanceTimeline: finalTimeline,
      latestIssuedEvent,
      topCollections,
      eventHighlights
    };
  }, [collections, events, onchainCounts]);

  const summaryCards = useMemo(() => [
    {
      title: 'Total Minted NFTs',
      value: totalIssued.toLocaleString('en-US'),
      subtitle: 'Across the SyndicateXTokyo ecosystem',
      icon: <Sparkles size={20} />
    },
    {
      title: 'Minted Last 30 Days',
      value: mintedLast30Days.toLocaleString('en-US'),
      subtitle: `Month-over-month growth ${monthlyGrowth >= 0 ? '+' : ''}${monthlyGrowth.toFixed(1)}%`,
      icon: <TrendingUp size={20} />
    },
    {
      title: 'Active Collections',
      value: activeCollections.toLocaleString('en-US'),
      subtitle: `Total ${totalCollections.toLocaleString('en-US')} collections`,
      icon: <Layers size={20} />
    },
    {
      title: 'Registered Events',
      value: totalEvents.toLocaleString('en-US'),
      subtitle: 'Historical and live events combined',
      icon: <CalendarRange size={20} />
    }
  ], [activeCollections, totalCollections, totalEvents, totalIssued, mintedLast30Days, monthlyGrowth]);

  return (
    <div
      style={{
      display: 'grid',
        gap: getResponsiveValue('1.25rem', '1.5rem', '1.75rem', deviceType),
        gridTemplateColumns: getResponsiveValue('1fr', '1fr', '2fr 1fr', deviceType)
      }}
    >
      <div
        style={{
        display: 'flex',
        flexDirection: 'column',
        gap: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType)
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: getResponsiveValue('1fr', 'repeat(2, 1fr)', 'repeat(4, 1fr)', deviceType),
            gap: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType)
          }}
        >
          {summaryCards.map((card) => (
            <div
              key={card.title}
              style={{
                background: 'rgba(30, 27, 75, 0.65)',
                border: '1px solid rgba(79, 70, 229, 0.35)',
                borderRadius: '16px',
                padding: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
                boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#a5b4fc', fontSize: '0.85rem', fontWeight: 600 }}>{card.title}</span>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '12px',
                    background: 'rgba(129, 140, 248, 0.18)',
          display: 'flex',
                    alignItems: 'center',
          justifyContent: 'center',
                    color: '#c7d2fe'
                  }}
                >
                  {card.icon}
                </div>
              </div>
              <strong
                style={{
                  fontSize: getResponsiveValue('1.5rem', '1.75rem', '2rem', deviceType),
                  color: '#f8fafc',
                  letterSpacing: '-0.02em'
                }}
              >
                {card.value}
              </strong>
              <span style={{ color: '#c7d2fe', fontSize: '0.8rem' }}>{card.subtitle}</span>
            </div>
          ))}
        </div>

        <RechartsActivityChart
          data={issuanceTimeline}
          title="NFT Mint Activity"
          subtitle="Monthly summary across events and TradePort mints"
          height={getResponsiveValue(220, 240, 260, deviceType)}
          showTrend
          dotConfig={deviceType === 'mobile' ? { radius: 3, activeRadius: 5, strokeWidth: 2 } : undefined}
        />

        <div
          style={{
            background: 'rgba(30, 27, 75, 0.65)',
            border: '1px solid rgba(79, 70, 229, 0.35)',
            borderRadius: '18px',
            padding: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.22)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType)
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  color: '#f8fafc',
                  fontSize: getResponsiveValue('1.1rem', '1.2rem', '1.3rem', deviceType),
                  letterSpacing: '-0.02em'
                }}
              >
                Top Collections
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', color: '#a5b4fc', fontSize: '0.8rem' }}>
                Ranked by total issued NFTs
              </p>
            </div>
            <Layers size={24} color="#c7d2fe" />
          </div>

          {topCollections.length === 0 ? (
            <p style={{ color: '#c7d2fe', fontSize: '0.85rem', margin: 0 }}>No collections to display.</p>
          ) : (
            <div
              style={{
                display: 'grid',
                gap: getResponsiveValue('0.65rem', '0.75rem', '0.85rem', deviceType)
              }}
            >
              {topCollections.slice(0, getResponsiveValue(4, 5, 6, deviceType)).map((collection) => (
                <div
                  key={collection.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: getResponsiveValue('1fr auto', '1fr auto auto', '1.5fr auto auto auto', deviceType),
                    alignItems: 'center',
                    gap: getResponsiveValue('0.4rem', '0.6rem', '0.75rem', deviceType),
                    background: 'rgba(15, 23, 42, 0.35)',
                    borderRadius: '12px',
                    padding: getResponsiveValue('0.65rem', '0.75rem', '0.85rem', deviceType),
                    border: '1px solid rgba(79, 70, 229, 0.25)'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ color: '#f8fafc', fontWeight: 600, fontSize: '0.95rem' }}>{collection.name}</span>
                    {collection.eventsCount > 0 && collection.mintedFromEvents > 0 && (
                      <span style={{ color: '#c7d2fe', fontSize: '0.75rem' }}>
                        Events: {collection.eventsCount.toLocaleString('en-US')}
                        {collection.latestEventDateLabel !== '-' ? ` / Latest ${collection.latestEventDateLabel}` : ''}
                      </span>
                    )}
                    {collection.tradeportMinted > 0 && (
                      <span style={{ color: '#c7d2fe', fontSize: '0.75rem' }}>
                        TradePort minted: {collection.tradeportMinted.toLocaleString('en-US')} NFT
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ color: '#f8fafc', fontWeight: 700 }}>
                      {collection.minted.toLocaleString('en-US')} NFT
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', color: '#c7d2fe', fontSize: '0.75rem' }}>
                    Share {collection.share.toFixed(1)}%
                  </div>
                  {collection.detailUrl && (
                    <a
                      href={collection.detailUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: '#c7d2fe',
                        fontSize: '0.75rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        textDecoration: 'none'
                      }}
                    >
                      Details <ExternalLink size={14} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType)
        }}
      >
        <div
          style={{
            background: 'rgba(30, 27, 75, 0.65)',
            border: '1px solid rgba(79, 70, 229, 0.35)',
            borderRadius: '18px',
            padding: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.22)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3
                style={{
                  margin: 0,
                  color: '#f8fafc',
                  fontSize: getResponsiveValue('1.05rem', '1.15rem', '1.25rem', deviceType)
                }}
              >
                Latest Mint Event
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', color: '#c7d2fe', fontSize: '0.8rem' }}>
                SyndicateXTokyo ecosystem highlights
              </p>
            </div>
            <Clock size={24} color="#c7d2fe" />
          </div>

          {latestIssuedEvent ? (
            <div
            style={{
                marginTop: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType),
                background: 'rgba(15, 23, 42, 0.35)',
                borderRadius: '14px',
                padding: getResponsiveValue('0.9rem', '1rem', '1.1rem', deviceType),
                border: '1px solid rgba(79, 70, 229, 0.25)'
              }}
            >
              <span style={{ color: '#a5b4fc', fontSize: '0.75rem' }}>{latestIssuedEvent.dateLabel ?? 'No date'}</span>
              <h4 style={{ margin: '0.35rem 0 0.5rem 0', color: '#f8fafc', fontSize: '1rem' }}>
                {latestIssuedEvent.name}
              </h4>
              {latestIssuedEvent.collectionName && (
                <p style={{ margin: 0, color: '#c7d2fe', fontSize: '0.8rem' }}>
                  Collection: {latestIssuedEvent.collectionName}
                </p>
              )}
              <div
                style={{
                  marginTop: '0.75rem',
              display: 'flex',
              alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <strong style={{ color: '#f8fafc', fontSize: '1.25rem' }}>
                  {latestIssuedEvent.mintedCount.toLocaleString('en-US')} NFT
                </strong>
                <span
                  style={{
                    display: 'inline-flex',
                alignItems: 'center',
                    gap: '0.35rem',
                    color: '#34d399',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  Growth in progress <ArrowUpRight size={18} />
                </span>
              </div>
            </div>
          ) : (
            <p style={{ color: '#c7d2fe', fontSize: '0.85rem', marginTop: '1rem' }}>
              No mint events yet.
            </p>
          )}
        </div>

          <div
            style={{
            background: 'rgba(30, 27, 75, 0.65)',
            border: '1px solid rgba(79, 70, 229, 0.35)',
            borderRadius: '18px',
              padding: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
            boxShadow: '0 16px 40px rgba(15, 23, 42, 0.22)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3
                style={{
                  margin: 0,
                  color: '#f8fafc',
                  fontSize: getResponsiveValue('1.05rem', '1.15rem', '1.25rem', deviceType)
                }}
              >
                Featured Events
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', color: '#c7d2fe', fontSize: '0.8rem' }}>
                Events with the highest mint counts
              </p>
            </div>
            </div>

          {eventHighlights.length === 0 ? (
            <p style={{ color: '#c7d2fe', fontSize: '0.85rem', marginTop: '1rem' }}>
              No events to display.
            </p>
          ) : (
            <div
              style={{
                marginTop: getResponsiveValue('0.75rem', '1rem', '1.1rem', deviceType),
                display: 'flex',
                flexDirection: 'column',
                gap: getResponsiveValue('0.6rem', '0.75rem', '0.85rem', deviceType)
              }}
            >
              {eventHighlights.map((highlight) => (
                <div
                  key={highlight.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    background: 'rgba(15, 23, 42, 0.35)',
                    borderRadius: '14px',
                    padding: getResponsiveValue('0.65rem', '0.75rem', '0.85rem', deviceType),
                    border: '1px solid rgba(79, 70, 229, 0.25)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: '#f8fafc', fontWeight: 600 }}>{highlight.name}</span>
                    <span style={{ color: '#a5b4fc', fontSize: '0.75rem' }}>{highlight.dateLabel}</span>
                  </div>
                  {highlight.collectionName && (
                    <span style={{ color: '#c7d2fe', fontSize: '0.75rem' }}>
                      Collection: {highlight.collectionName}
                    </span>
                  )}
                  <span style={{ color: '#f8fafc', fontWeight: 700 }}>
                    {highlight.mintedCount.toLocaleString('en-US')} NFT
                  </span>
          </div>
        ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

