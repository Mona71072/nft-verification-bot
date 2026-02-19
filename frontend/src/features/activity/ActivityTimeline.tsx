import React, { useMemo, useState } from 'react';
import { Palette, ArrowUpRight, CheckCircle, FileText, TrendingUp, Clock, Download } from 'lucide-react';

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
  // 新しく追加されたプロパティ
  showStats?: boolean;
  showFilters?: boolean;
  onExport?: () => void;
}

import { convertIpfsUrl } from '../../utils/ipfs';
import { IpfsImage } from '../../components/ui/IpfsImage';

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
const getActivityIcon = (type: Activity['type']): React.ReactElement => {
  const iconClass = "w-5 h-5";
  switch (type) {
    case 'mint':
      return <Palette className={iconClass} />;
    case 'transfer':
      return <ArrowUpRight className={iconClass} />;
    case 'verification':
      return <CheckCircle className={iconClass} />;
    default:
      return <FileText className={iconClass} />;
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

export function ActivityTimeline({ 
  activities, 
  loading, 
  onActivityClick,
  showStats = false,
  showFilters = true,
  onExport
}: ActivityTimelineProps) {
  const [filter, setFilter] = useState<Activity['type'] | 'all'>('all');
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  
  // Responsive monitoring
  React.useEffect(() => {
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
              background: 'linear-gradient(90deg, rgba(30, 27, 75, 0.6) 25%, rgba(79, 70, 229, 0.3) 50%, rgba(30, 27, 75, 0.6) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
              borderRadius: '0.25rem',
              marginBottom: '0.75rem'
            }} />
            <div style={{
              height: '5rem',
              background: 'linear-gradient(90deg, rgba(30, 27, 75, 0.6) 25%, rgba(79, 70, 229, 0.3) 50%, rgba(30, 27, 75, 0.6) 75%)',
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
        padding: isMobile ? '2rem 1rem' : '3rem 1.5rem',
        textAlign: 'center'
      }}>
        <div style={{ 
          marginBottom: isMobile ? '0.75rem' : '1rem',
          opacity: 0.4
        }}>
          <TrendingUp size={isMobile ? 48 : 56} style={{ color: '#a5b4fc' }} />
        </div>
        <h3 style={{
          fontSize: isMobile ? '1rem' : '1.125rem',
          fontWeight: '700',
          color: '#e0e7ff',
          marginBottom: isMobile ? '0.375rem' : '0.5rem'
        }}>
          No Activity Yet
        </h3>
        <p style={{
          fontSize: isMobile ? '0.6875rem' : '0.75rem',
          color: '#a5b4fc',
          maxWidth: '28rem'
        }}>
          Your NFT mint history will appear here
        </p>
      </div>
    );
  }
  
  return (
    <div style={{ padding: isMobile ? '1.25rem' : '2rem' }}>
      {/* Header */}
      <div style={{ 
        marginBottom: isMobile ? '1.5rem' : '2rem',
        paddingBottom: '1rem',
        borderBottom: '1px solid rgba(79, 70, 229, 0.3)'
      }}>
        <h2 style={{
          fontSize: isMobile ? '1.125rem' : '1.25rem',
          fontWeight: '700',
          color: '#e0e7ff',
          marginBottom: '0.375rem',
          letterSpacing: '-0.01em'
        }}>
          Activity Timeline
        </h2>
        <p style={{
          fontSize: isMobile ? '0.8125rem' : '0.875rem',
              color: '#a5b4fc'
        }}>
          {filteredActivities.length} {filteredActivities.length === 1 ? 'activity' : 'activities'}
        </p>
      </div>

      {/* Stats Summary */}
      {showStats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: isMobile ? '0.75rem' : '1rem',
          marginBottom: isMobile ? '1.25rem' : '1.5rem',
          padding: isMobile ? '1rem' : '1.25rem',
          background: 'rgba(30, 27, 75, 0.5)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(79, 70, 229, 0.3)',
          borderRadius: '12px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: '#e0e7ff' }}>
              {filteredActivities.length}
            </div>
            <div style={{ fontSize: isMobile ? '0.75rem' : '0.8125rem', color: '#a5b4fc', fontWeight: '500' }}>
              Total Activities
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: '#059669' }}>
              {filteredActivities.filter(a => a.type === 'mint').length}
            </div>
            <div style={{ fontSize: isMobile ? '0.75rem' : '0.8125rem', color: '#a5b4fc', fontWeight: '500' }}>
              Mints
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: isMobile ? '1.5rem' : '1.75rem', fontWeight: '700', color: '#dc2626' }}>
              {filteredActivities.filter(a => a.type === 'transfer').length}
            </div>
            <div style={{ fontSize: isMobile ? '0.75rem' : '0.8125rem', color: '#a5b4fc', fontWeight: '500' }}>
              Transfers
            </div>
          </div>
        </div>
      )}

      {/* Filter and Export */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: isMobile ? '0.5rem' : '1rem',
        marginBottom: isMobile ? '1.25rem' : '1.5rem',
        flexWrap: 'wrap'
      }}>
        {showFilters && (
          <div style={{
            display: 'flex',
            gap: isMobile ? '0.375rem' : '0.5rem',
            overflowX: 'auto',
            paddingBottom: '0.25rem',
            WebkitOverflowScrolling: 'touch',
            flex: 1
          }}>
            {[
              { value: 'all', label: 'All', icon: <FileText className="w-4 h-4" /> },
              { value: 'mint', label: 'Mints', icon: <Palette className="w-4 h-4" /> },
              { value: 'transfer', label: 'Transfers', icon: <ArrowUpRight className="w-4 h-4" /> },
              { value: 'verification', label: 'Verifications', icon: <CheckCircle className="w-4 h-4" /> },
            ].map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => setFilter(value as Activity['type'] | 'all')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: isMobile ? '0.625rem 1rem' : '0.625rem 1.125rem',
              borderRadius: '10px',
              fontSize: isMobile ? '0.8125rem' : '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              background: filter === value 
                ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
                : 'rgba(30, 27, 75, 0.6)',
              color: filter === value ? 'white' : '#c7d2fe',
              boxShadow: filter === value 
                ? '0 2px 8px rgba(30, 41, 59, 0.25)'
                : 'none',
              border: filter === value ? 'none' : '1px solid rgba(79, 70, 229, 0.3)'
            }}
            onMouseEnter={(e) => {
              if (filter !== value && !isMobile) {
                e.currentTarget.style.background = 'rgba(79, 70, 229, 0.3)';
                e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              if (filter !== value && !isMobile) {
                e.currentTarget.style.background = 'rgba(30, 27, 75, 0.6)';
                e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.3)';
              }
            }}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
        </div>
        )}
        
        {onExport && (
          <button
            onClick={onExport}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: isMobile ? '0.5rem 0.75rem' : '0.625rem 1rem',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: isMobile ? '0.75rem' : '0.8125rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(59, 130, 246, 0.3)'
            }}
            onMouseEnter={(e) => {
              if (!isMobile) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(59, 130, 246, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isMobile) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(59, 130, 246, 0.3)';
              }
            }}
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        )}
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
                fontSize: isMobile ? '0.75rem' : '0.8125rem',
                fontWeight: '700',
                color: '#a5b4fc',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                {date}
              </h3>
              <div style={{
                flex: 1,
                height: '1px',
                background: 'linear-gradient(90deg, rgba(79, 70, 229, 0.3) 0%, transparent 100%)'
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
                background: 'linear-gradient(180deg, rgba(79, 70, 229, 0.3) 0%, transparent 100%)'
              }} />
              
              {dateActivities.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => onActivityClick?.(activity)}
                  style={{
                    position: 'relative',
                    width: '100%',
                    textAlign: 'left',
                    padding: isMobile ? '0.875rem' : '1rem',
                    paddingLeft: isMobile ? '3.25rem' : '3.75rem',
                    borderRadius: '12px',
                    background: 'rgba(30, 27, 75, 0.6)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(79, 70, 229, 0.3)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isMobile) {
                      e.currentTarget.style.transform = 'translateX(4px)';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.5)';
                      e.currentTarget.style.background = 'rgba(79, 70, 229, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isMobile) {
                      e.currentTarget.style.transform = 'translateX(0)';
                      e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.04)';
                      e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.3)';
                      e.currentTarget.style.background = 'rgba(30, 27, 75, 0.6)';
                    }
                  }}
                >
                  {/* Timeline Dot */}
                  <div style={{
                    position: 'absolute',
                    left: isMobile ? '0.875rem' : '1.125rem',
                    top: isMobile ? '1rem' : '1.125rem',
                    width: isMobile ? '0.625rem' : '0.75rem',
                    height: isMobile ? '0.625rem' : '0.75rem',
                    borderRadius: '50%',
                    background: '#1e293b',
                    border: '2px solid rgba(79, 70, 229, 0.5)',
                    boxShadow: '0 0 0 1px rgba(79, 70, 229, 0.3)',
                    zIndex: 1
                  }} />
                  
                  <div style={{ display: 'flex', gap: isMobile ? '0.75rem' : '1rem', alignItems: 'flex-start' }}>
                    {/* Thumbnail */}
                    {(activity.mint?.image_url || activity.transfer?.image_url) && (
                      <div style={{ flexShrink: 0 }}>
                        <IpfsImage
                          url={convertIpfsUrl(activity.mint?.image_url || activity.transfer?.image_url)}
                          alt={activity.mint?.name || activity.transfer?.name || 'NFT image'}
                          style={{
                            width: isMobile ? '3.5rem' : '4rem',
                            height: isMobile ? '3.5rem' : '4rem',
                            borderRadius: '0.75rem',
                            objectFit: 'cover',
                            border: '2px solid rgba(79, 70, 229, 0.3)'
                          }}
                          fallback={(
                            <div style={{
                              width: isMobile ? '3.5rem' : '4rem',
                              height: isMobile ? '3.5rem' : '4rem',
                              borderRadius: '0.75rem',
                              background: 'linear-gradient(135deg, rgba(79,70,229,0.3), rgba(139,92,246,0.2))',
                              border: '2px solid rgba(79, 70, 229, 0.3)',
                            }} />
                          )}
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
                        <div style={{ color: '#6366f1' }}>
                          {getActivityIcon(activity.type)}
                        </div>
                        <h4 style={{
                          fontSize: isMobile ? '0.875rem' : '0.9375rem',
                          fontWeight: '600',
                          color: '#e0e7ff',
                          margin: 0
                        }}>
                          {getActivityTitle(activity)}
                        </h4>
                      </div>

                      {(() => {
                        const objectId = activity.mint?.objectId || activity.transfer?.objectId;
                        const activityName = activity.mint?.name || activity.transfer?.name || '';
                        const isUnnamed = !activityName || activityName.trim().toLowerCase() === 'unnamed nft';
                        if (!objectId) return null;
                        return (
                          <div style={{ marginBottom: '0.5rem' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '8px',
                              background: isUnnamed ? 'rgba(245, 158, 11, 0.18)' : 'rgba(99, 102, 241, 0.18)',
                              border: isUnnamed ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(99, 102, 241, 0.3)',
                              color: isUnnamed ? '#fcd34d' : '#c7d2fe',
                              fontSize: isMobile ? '0.6875rem' : '0.75rem',
                              fontWeight: 600,
                              fontFamily: 'monospace',
                            }}>
                              NFT
                              {objectId.slice(0, 8)}...{objectId.slice(-6)}
                            </span>
                          </div>
                        );
                      })()}
                      
                      {/* Timestamp */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        marginBottom: '0.375rem'
                      }}>
                        {activity.timestamp > 0 && !isNaN(new Date(activity.timestamp).getTime()) ? (
                          <>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.375rem',
                              padding: '0.25rem 0.625rem',
                              background: 'rgba(79, 70, 229, 0.2)',
                              borderRadius: '6px',
                              fontSize: isMobile ? '0.6875rem' : '0.75rem',
                              color: '#c7d2fe',
                              fontWeight: '600'
                            }}>
                              <Clock className="w-3 h-3" />
                              <span>
                                {new Date(activity.timestamp).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  timeZone: 'Asia/Tokyo'
                                })} JST
                              </span>
                            </div>
                            <span style={{
                              fontSize: isMobile ? '0.6875rem' : '0.75rem',
                              color: '#a5b4fc'
                            }}>
                              {getRelativeTime(activity.timestamp)}
                            </span>
                          </>
                        ) : (
                          <span style={{
                            fontSize: isMobile ? '0.6875rem' : '0.75rem',
                            color: '#64748b',
                            fontStyle: 'italic',
                          }}>
                            Unknown date
                          </span>
                        )}
                      </div>
                      
                      {/* Collection & Event info (for mints) */}
                      {activity.type === 'mint' && (activity.mint?.collection || activity.mint?.eventName) && (
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.375rem',
                          marginBottom: '0.5rem',
                        }}>
                          {activity.mint?.collection && (
                            <span style={{
                              display: 'inline-block',
                              padding: '0.15rem 0.5rem',
                              borderRadius: '8px',
                              fontSize: isMobile ? '0.625rem' : '0.6875rem',
                              fontWeight: 600,
                              background: 'rgba(139, 92, 246, 0.25)',
                              color: '#c7d2fe',
                            }}>
                              {activity.mint.collection}
                            </span>
                          )}
                          {activity.mint?.eventName && (
                            <span style={{
                              fontSize: isMobile ? '0.75rem' : '0.8125rem',
                              color: '#a5b4fc',
                            }}>
                              {activity.mint.eventName}
                            </span>
                          )}
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
                            background: 'rgba(102, 126, 234, 0.2)',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)';
                            e.currentTarget.style.color = '#a5b4fc';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)';
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

