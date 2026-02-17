import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, LayoutDashboard, Shield, Sparkles, Menu, X } from 'lucide-react';
import { queryClient } from '../../lib/query-client';
import { useResponsive, getResponsiveValue } from '../../hooks/useResponsive';

interface MenuItem {
  label: string;
  href: string;
  icon?: React.ReactNode;
  children?: MenuItem[];
}

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPath: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

export function AdminLayout({ children, currentPath }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['ロール管理', 'ミント管理']));

  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  try {
    const responsive = useResponsive();
    deviceType = responsive.deviceType;
  } catch {
    // fallback
  }

  const isMobile = deviceType === 'mobile';
  const isTabletOrMobile = deviceType === 'mobile' || deviceType === 'tablet';

  useEffect(() => {
    const prefetchData = async () => {
      try {
        if (!queryClient.getQueryData(['collections'])) {
          await queryClient.prefetchQuery({
            queryKey: ['collections'],
            queryFn: async () => {
              const res = await fetch(`${API_BASE_URL}/api/collections`);
              const data = await res.json();
              return data.success ? data.data || [] : [];
            },
            staleTime: 15 * 60 * 1000,
          });
        }
        if (!queryClient.getQueryData(['events'])) {
          await queryClient.prefetchQuery({
            queryKey: ['events'],
            queryFn: async () => {
              const res = await fetch(`${API_BASE_URL}/api/events`);
              const data = await res.json();
              return data.success ? data.data || [] : [];
            },
            staleTime: 15 * 60 * 1000,
          });
        }
        if (!queryClient.getQueryData(['mint-collections'])) {
          await queryClient.prefetchQuery({
            queryKey: ['mint-collections'],
            queryFn: async () => {
              const res = await fetch(`${API_BASE_URL}/api/mint-collections`);
              const data = await res.json();
              return data.success ? data.data || [] : [];
            },
            staleTime: 20 * 60 * 1000,
          });
        }
      } catch {
        // silent
      }
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(prefetchData, { timeout: 5000 });
    } else {
      setTimeout(prefetchData, 2000);
    }
  }, []);

  const menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      href: '/admin',
      icon: <LayoutDashboard size={18} />
    },
    {
      label: 'ロール管理',
      href: '/admin/roles',
      icon: <Shield size={18} />,
      children: [
        { label: 'コレクション管理', href: '/admin/roles?tab=collections' },
        { label: 'ユーザー管理', href: '/admin/roles?tab=users' },
        { label: 'バッチ処理', href: '/admin/roles?tab=batch' },
        { label: 'DM設定', href: '/admin/roles?tab=dm-settings' }
      ]
    },
    {
      label: 'ミント管理',
      href: '/admin/mint/events',
      icon: <Sparkles size={18} />,
      children: [
        { label: 'イベント管理', href: '/admin/mint/events' },
        { label: 'ミント履歴', href: '/admin/mint/history' }
      ]
    }
  ];

  const navigate = (href: string) => {
    window.history.pushState({}, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
    setMobileMenuOpen(false);
  };

  const toggleSection = (label: string) => {
    const next = new Set(expandedSections);
    if (next.has(label)) {
      next.delete(label);
    } else {
      next.add(label);
    }
    setExpandedSections(next);
  };

  const isActive = (href: string) => {
    if (href === '/admin') return currentPath === '/admin';
    return currentPath.startsWith(href.split('?')[0]);
  };

  const sidebarWidth = collapsed ? '72px' : '260px';

  const sidebarContent = (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#ffffff',
      borderRight: '1px solid #e5e7eb'
    }}>
      {/* Sidebar header */}
      <div style={{
        padding: collapsed ? '1rem 0.5rem' : '1.25rem 1rem',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        minHeight: '56px'
      }}>
        {!collapsed && (
          <span style={{
            fontSize: '0.9375rem',
            fontWeight: 700,
            color: '#111827',
            letterSpacing: '-0.01em'
          }}>
            Admin Panel
          </span>
        )}
        {isTabletOrMobile && (
          <button
            onClick={() => setMobileMenuOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: collapsed ? '0.5rem' : '0.75rem'
      }}>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
          {menuItems.map((item) => (
            <div key={item.label}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => {
                      if (collapsed) {
                        navigate(item.href);
                      } else {
                        toggleSection(item.label);
                      }
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: collapsed ? 'center' : 'space-between',
                      padding: collapsed ? '0.625rem' : '0.625rem 0.75rem',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#374151',
                      transition: 'background 0.15s ease',
                      marginBottom: '0.125rem'
                    }}
                    title={collapsed ? item.label : undefined}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      {item.icon && (
                        <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          {item.icon}
                        </span>
                      )}
                      {!collapsed && <span>{item.label}</span>}
                    </div>
                    {!collapsed && (
                      expandedSections.has(item.label)
                        ? <ChevronDown size={16} style={{ color: '#9ca3af' }} />
                        : <ChevronRight size={16} style={{ color: '#9ca3af' }} />
                    )}
                  </button>
                  {expandedSections.has(item.label) && !collapsed && (
                    <div style={{
                      marginLeft: '1rem',
                      marginBottom: '0.25rem',
                      borderLeft: '2px solid #e5e7eb',
                      paddingLeft: '0.5rem'
                    }}>
                      {item.children.map((child) => {
                        const active = isActive(child.href);
                        return (
                          <button
                            key={child.href}
                            onClick={() => navigate(child.href)}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '0.5rem 0.75rem',
                              background: active ? '#eff6ff' : 'transparent',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '0.8125rem',
                              fontWeight: active ? 600 : 400,
                              color: active ? '#1d4ed8' : '#6b7280',
                              transition: 'all 0.15s ease',
                              textAlign: 'left',
                              marginBottom: '0.125rem'
                            }}
                            onMouseEnter={(e) => {
                              if (!active) e.currentTarget.style.background = '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                              if (!active) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            {child.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => navigate(item.href)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    gap: '0.625rem',
                    padding: collapsed ? '0.625rem' : '0.625rem 0.75rem',
                    background: isActive(item.href) ? '#eff6ff' : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    fontWeight: isActive(item.href) ? 600 : 500,
                    color: isActive(item.href) ? '#1d4ed8' : '#374151',
                    transition: 'all 0.15s ease',
                    marginBottom: '0.125rem'
                  }}
                  title={collapsed ? item.label : undefined}
                  onMouseEnter={(e) => {
                    if (!isActive(item.href)) e.currentTarget.style.background = '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive(item.href)) e.currentTarget.style.background = isActive(item.href) ? '#eff6ff' : 'transparent';
                  }}
                >
                  {item.icon && (
                    <span style={{
                      color: isActive(item.href) ? '#1d4ed8' : '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      flexShrink: 0
                    }}>
                      {item.icon}
                    </span>
                  )}
                  {!collapsed && <span>{item.label}</span>}
                </button>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Collapse toggle - desktop only */}
      {!isTabletOrMobile && (
        <div style={{
          padding: '0.75rem',
          borderTop: '1px solid #e5e7eb'
        }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={{
              width: '100%',
              padding: '0.5rem',
              background: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 500,
              color: '#6b7280',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
          >
            {collapsed ? (
              <ChevronRight size={16} />
            ) : (
              <>
                <ChevronLeft size={16} />
                <span>折りたたむ</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      {/* Mobile overlay */}
      {mobileMenuOpen && isTabletOrMobile && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            zIndex: 40,
            transition: 'opacity 0.3s ease'
          }}
        />
      )}

      {/* Desktop sidebar */}
      {!isTabletOrMobile && (
        <aside style={{
          width: sidebarWidth,
          flexShrink: 0,
          transition: 'width 0.2s ease',
          height: '100vh',
          position: 'sticky',
          top: 0
        }}>
          {sidebarContent}
        </aside>
      )}

      {/* Mobile sidebar */}
      {isTabletOrMobile && (
        <aside style={{
          position: 'fixed',
          left: mobileMenuOpen ? 0 : '-280px',
          top: 0,
          width: '260px',
          height: '100vh',
          zIndex: 50,
          transition: 'left 0.25s ease',
          boxShadow: mobileMenuOpen ? '4px 0 12px rgba(0, 0, 0, 0.1)' : 'none'
        }}>
          {sidebarContent}
        </aside>
      )}

      {/* Main content */}
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {/* Mobile header */}
        {isTabletOrMobile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isMobile ? '0.75rem 1rem' : '0.875rem 1.25rem',
            background: 'white',
            borderBottom: '1px solid #e5e7eb',
            position: 'sticky',
            top: 0,
            zIndex: 30
          }}>
            <h2 style={{
              margin: 0,
              fontSize: isMobile ? '1rem' : '1.0625rem',
              fontWeight: 700,
              color: '#111827'
            }}>
              管理パネル
            </h2>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'メニューを閉じる' : 'メニューを開く'}
              aria-expanded={mobileMenuOpen}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '0.5rem',
                color: '#374151',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        )}

        <div style={{
          padding: getResponsiveValue('1rem', '1.5rem', '2rem', deviceType),
          maxWidth: '1400px'
        }}>
          {children}
        </div>
      </main>
    </div>
  );
}
