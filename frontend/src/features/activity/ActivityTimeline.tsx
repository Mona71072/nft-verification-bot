import { useMemo, useState } from 'react';

interface Activity {
  id: string;
  type: 'mint' | 'transfer' | 'verification';
  timestamp: number;
  timestampMs: number;
  digest?: string;
  mint?: {
    objectId: string;
    name: string;
    image_url?: string;
    collection: string;
    eventName?: string;
  };
  transfer?: {
    objectId: string;
    name: string;
    image_url?: string;
    from: string;
    to: string;
    direction: 'received' | 'sent';
  };
  verification?: {
    role: string;
    status: 'success' | 'failed';
    method: 'discord' | 'manual';
  };
}

interface ActivityTimelineProps {
  activities: Activity[];
  loading?: boolean;
  onActivityClick?: (activity: Activity) => void;
}

// Convert IPFS URLs to HTTP gateway
const convertIpfsUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  if (url.startsWith('ipfs://')) {
    const hash = url.replace('ipfs://', '');
    return `https://ipfs.io/ipfs/${hash}`;
  }
  return url;
};

// Display relative time
const getRelativeTime = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'now';
};

// Group by date
const groupByDate = (activities: Activity[]): Map<string, Activity[]> => {
  const groups = new Map<string, Activity[]>();
  
  activities.forEach(activity => {
    const date = new Date(activity.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let key: string;
    if (date.toDateString() === today.toDateString()) {
      key = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      key = 'Yesterday';
    } else {
      key = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(activity);
  });
  
  return groups;
};

// Activity icon
const getActivityIcon = (type: Activity['type']): string => {
  switch (type) {
    case 'mint':
      return '🎨';
    case 'transfer':
      return '🔄';
    case 'verification':
      return '✅';
    default:
      return '📝';
  }
};

// Activity title
const getActivityTitle = (activity: Activity): string => {
  switch (activity.type) {
    case 'mint':
      return `Minted ${activity.mint?.name || 'NFT'}`;
    case 'transfer':
      return activity.transfer?.direction === 'received'
        ? `Received ${activity.transfer?.name || 'NFT'}`
        : `Sent ${activity.transfer?.name || 'NFT'}`;
    case 'verification':
      return 'Discord Verification Completed';
    default:
      return 'Activity';
  }
};

export function ActivityTimeline({ activities, loading, onActivityClick }: ActivityTimelineProps) {
  const [filter, setFilter] = useState<Activity['type'] | 'all'>('all');
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  
  // Responsive monitoring
  useMemo(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const isMobile = windowWidth < 640;
  
  // Apply filter
  const filteredActivities = useMemo(() => {
    if (filter === 'all') return activities;
    return activities.filter(a => a.type === filter);
  }, [activities, filter]);
  
  // Group by date
  const groupedActivities = useMemo(() => {
    return groupByDate(filteredActivities);
  }, [filteredActivities]);
  
  if (loading) {
    return (
      <div style={{ padding: isMobile ? '1rem' : '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i}>
            <div style={{ 
              height: '1rem', 
              width: '6rem', 
              background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              borderRadius: '0.25rem',
              marginBottom: '0.75rem'
            }} />
            <div style={{
              height: '5rem',
              background: 'linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              borderRadius: '0.75rem'
            }} />
          </div>
        ))}
        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    );
  }
  
  if (activities.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '3rem 1rem' : '5rem 2rem',
        textAlign: 'center'
      }}>
        <div style={{ 
          fontSize: isMobile ? '3rem' : '4rem',
          marginBottom: isMobile ? '1rem' : '1.5rem',
          opacity: 0.6
        }}>
          📊
        </div>
        <h3 style={{
          fontSize: isMobile ? '1.25rem' : '1.5rem',
          fontWeight: '700',
          color: '#1f2937',
          marginBottom: '0.5rem'
        }}>
          No Activity Yet
        </h3>
        <p style={{
          fontSize: isMobile ? '0.875rem' : '1rem',
          color: '#6b7280',
          maxWidth: '28rem'
        }}>
          Your NFT mint history will appear here
        </p>
      </div>
    );
  }
  
  return (
    <div style={{ padding: isMobile ? '1rem' : '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: isMobile ? '1.5rem' : '2rem' }}>
        <h2 style={{
          fontSize: isMobile ? '1.25rem' : '1.5rem',
          fontWeight: '700',
          color: '#111827',
          marginBottom: '0.5rem'
        }}>
          Activity
        </h2>
        <p style={{
          fontSize: isMobile ? '0.875rem' : '0.9375rem',
          color: '#6b7280'
        }}>
          {filteredActivities.length} {filteredActivities.length === 1 ? 'activity' : 'activities'}
        </p>
      </div>

      {/* Filter */}
      <div style={{
        display: 'flex',
        gap: isMobile ? '0.5rem' : '0.75rem',
        overflowX: 'auto',
        paddingBottom: '0.5rem',
        marginBottom: isMobile ? '1.5rem' : '2rem',
        WebkitOverflowScrolling: 'touch'
      }}>
        {[
          { value: 'all', label: 'All', icon: '📋' },
          { value: 'mint', label: 'Mints', icon: '🎨' },
        ].map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => setFilter(value as Activity['type'] | 'all')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: isMobile ? '0.625rem 1rem' : '0.75rem 1.25rem',
              borderRadius: '0.75rem',
              fontSize: isMobile ? '0.875rem' : '0.9375rem',
              fontWeight: '600',
              border: 'none',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
              background: filter === value 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : '#f3f4f6',
              color: filter === value ? 'white' : '#6b7280',
              boxShadow: filter === value 
                ? '0 4px 12px rgba(102, 126, 234, 0.4)'
                : 'none',
              transform: filter === value ? 'translateY(-1px)' : 'translateY(0)'
            }}
            onMouseEnter={(e) => {
              if (filter !== value && !isMobile) {
                e.currentTarget.style.background = '#e5e7eb';
              }
            }}
            onMouseLeave={(e) => {
              if (filter !== value && !isMobile) {
                e.currentTarget.style.background = '#f3f4f6';
              }
            }}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>
      
      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '2rem' : '2.5rem' }}>
        {Array.from(groupedActivities.entries()).map(([date, dateActivities]) => (
          <div key={date}>
            {/* Date Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: isMobile ? '1rem' : '1.25rem'
            }}>
              <h3 style={{
                fontSize: isMobile ? '0.8125rem' : '0.875rem',
                fontWeight: '700',
                color: '#667eea',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {date}
              </h3>
              <div style={{
                flex: 1,
                height: '2px',
                background: 'linear-gradient(90deg, #667eea 0%, transparent 100%)'
              }} />
            </div>
            
            {/* Activity List */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? '0.75rem' : '1rem',
              position: 'relative'
            }}>
              {/* Vertical Line */}
              <div style={{
                position: 'absolute',
                left: isMobile ? '1.25rem' : '1.5rem',
                top: 0,
                bottom: 0,
                width: '2px',
                background: 'linear-gradient(180deg, #e5e7eb 0%, transparent 100%)'
              }} />
              
              {dateActivities.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => onActivityClick?.(activity)}
                  style={{
                    position: 'relative',
                    width: '100%',
                    textAlign: 'left',
                    padding: isMobile ? '1rem' : '1.25rem',
                    paddingLeft: isMobile ? '3.5rem' : '4rem',
                    borderRadius: '1rem',
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isMobile) {
                      e.currentTarget.style.transform = 'translateY(-2px) translateX(4px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.15)';
                      e.currentTarget.style.borderColor = '#667eea';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isMobile) {
                      e.currentTarget.style.transform = 'translateY(0) translateX(0)';
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
                      e.currentTarget.style.borderColor = '#e5e7eb';
                    }
                  }}
                >
                  {/* Timeline Dot */}
                  <div style={{
                    position: 'absolute',
                    left: isMobile ? '0.75rem' : '1rem',
                    top: isMobile ? '1.25rem' : '1.5rem',
                    width: isMobile ? '0.875rem' : '1rem',
                    height: isMobile ? '0.875rem' : '1rem',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: '3px solid white',
                    boxShadow: '0 0 0 1px #e5e7eb',
                    zIndex: 1
                  }} />
                  
                  <div style={{ display: 'flex', gap: isMobile ? '0.75rem' : '1rem', alignItems: 'flex-start' }}>
                    {/* Thumbnail */}
                    {(activity.mint?.image_url || activity.transfer?.image_url) && (
                      <div style={{ flexShrink: 0 }}>
                        <img
                          src={convertIpfsUrl(activity.mint?.image_url || activity.transfer?.image_url)}
                          alt=""
                          style={{
                            width: isMobile ? '3.5rem' : '4rem',
                            height: isMobile ? '3.5rem' : '4rem',
                            borderRadius: '0.75rem',
                            objectFit: 'cover',
                            border: '2px solid #f3f4f6'
                          }}
                          loading="lazy"
                        />
                      </div>
                    )}
                    
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title and Icon */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.375rem'
                      }}>
                        <span style={{ fontSize: isMobile ? '1.125rem' : '1.25rem' }}>
                          {getActivityIcon(activity.type)}
                        </span>
                        <h4 style={{
                          fontSize: isMobile ? '0.9375rem' : '1rem',
                          fontWeight: '700',
                          color: '#111827',
                          margin: 0
                        }}>
                          {getActivityTitle(activity)}
                        </h4>
                      </div>
                      
                      {/* Timestamp */}
                      <div style={{
                        fontSize: isMobile ? '0.75rem' : '0.8125rem',
                        color: '#9ca3af',
                        marginBottom: '0.5rem'
                      }}>
                        {new Date(activity.timestamp).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })} · {getRelativeTime(activity.timestamp)}
                      </div>
                      
                      {/* Event Name (for mints) */}
                      {activity.type === 'mint' && activity.mint?.eventName && (
                        <div style={{
                          fontSize: isMobile ? '0.8125rem' : '0.875rem',
                          color: '#6b7280',
                          marginBottom: '0.5rem'
                        }}>
                          {activity.mint.eventName}
                        </div>
                      )}
                      
                      {/* Transaction Link */}
                      {activity.digest && (
                        <a
                          href={`https://suiscan.xyz/mainnet/tx/${activity.digest}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.75rem',
                            color: '#667eea',
                            fontWeight: '600',
                            textDecoration: 'none',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '0.375rem',
                            background: '#f0f4ff',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#e0e7ff';
                            e.currentTarget.style.color = '#5a67d8';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f0f4ff';
                            e.currentTarget.style.color = '#667eea';
                          }}
                        >
                          <span>Tx</span>
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

