import { cn } from '@/lib/utils';
import { Package } from 'lucide-react';

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
    <div className={cn("flex flex-col items-center justify-center py-8 px-4", className)}>
      {/* Icon */}
      <div style={{
        width: '3rem',
        height: '3rem',
        marginBottom: '0.75rem',
        borderRadius: '50%',
        backgroundColor: 'rgba(30, 27, 75, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#a5b4fc'
      }}>
        <Package className="w-6 h-6" />
      </div>

      {/* Title */}
      <h3 style={{
        fontSize: '1rem',
        fontWeight: '600',
        color: '#e0e7ff',
        marginBottom: '0.375rem'
      }}>
        {title}
      </h3>

      {/* Description */}
      <p style={{
        fontSize: '0.75rem',
        color: '#a5b4fc',
        marginBottom: '1rem',
        textAlign: 'center',
        maxWidth: '28rem'
      }}>
        {description}
      </p>

      {/* CTA Button */}
      {(ctaHref || onCtaClick) && (
        <div style={{ marginBottom: '1.5rem' }}>
          {ctaHref ? (
            <a 
              href={ctaHref} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '0.5rem 1rem',
                backgroundColor: '#667eea',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '0.375rem',
                fontWeight: '600',
                fontSize: '0.8125rem',
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
                padding: '0.5rem 1rem',
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontWeight: '600',
                fontSize: '0.8125rem',
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

