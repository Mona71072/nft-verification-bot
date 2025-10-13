import { cn } from '@/lib/utils';

interface EmptyNFTsProps {
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  upcomingEvents?: Array<{
    name: string;
    date: string;
    href?: string;
  }>;
  className?: string;
}

/**
 * Empty NFT state component
 * - Message + CTA
 * - Upcoming events list (optional)
 */
export function EmptyNFTs({
  title = 'No NFTs Found',
  description = "You don't own any SXT NFTs yet",
  ctaLabel = 'Join Your First Event',
  ctaHref,
  onCtaClick,
  upcomingEvents,
  className,
}: EmptyNFTsProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4", className)}>
      {/* Icon */}
      <div style={{
        width: '4rem',
        height: '4rem',
        marginBottom: '1rem',
        borderRadius: '50%',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.875rem'
      }}>
        📭
      </div>

      {/* Title */}
      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: '0.5rem'
      }}>
        {title}
      </h3>

      {/* Description */}
      <p style={{
        fontSize: '0.875rem',
        color: '#6b7280',
        marginBottom: '1.5rem',
        textAlign: 'center',
        maxWidth: '28rem'
      }}>
        {description}
      </p>

      {/* CTA Button */}
      {(ctaHref || onCtaClick) && (
        <div style={{ marginBottom: '2rem' }}>
          {ctaHref ? (
            <a 
              href={ctaHref} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#667eea',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '0.5rem',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5a67d8'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#667eea'}
            >
              {ctaLabel}
            </a>
          ) : (
            <button
              onClick={onCtaClick}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: '600',
                fontSize: '1rem',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5a67d8'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#667eea'}
            >
              {ctaLabel}
            </button>
          )}
        </div>
      )}

      {/* Upcoming Events */}
      {upcomingEvents && upcomingEvents.length > 0 && (
        <div className="w-full max-w-md mt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">
            Upcoming Events
          </h4>
          <div className="space-y-2">
            {upcomingEvents.map((event, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg bg-card/40 border border-border/50 hover:bg-card/60 transition-colors"
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{event.name}</div>
                  <div className="text-xs text-muted-foreground">{event.date}</div>
                </div>
                {event.href && (
                  <a
                    href={event.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    Details →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

