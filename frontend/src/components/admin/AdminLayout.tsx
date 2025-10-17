import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import { queryClient } from '../../lib/query-client';

interface MenuItem {
  label: string;
  href: string;
  children?: MenuItem[];
}

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPath: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

function getAuthHeaders(): HeadersInit {
  const addr = typeof window !== 'undefined' 
    ? localStorage.getItem('currentWalletAddress') || (window as any).currentWalletAddress 
    : undefined;
  return {
    'Content-Type': 'application/json',
    ...(addr ? { 'X-Admin-Address': addr } : {})
  };
}

export function AdminLayout({ children, currentPath }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['roles', 'mint']));

  // 主要データの事前フェッチ
  useEffect(() => {
    const prefetchData = async () => {
      try {
        // コレクションデータの事前フェッチ
        await queryClient.prefetchQuery({
          queryKey: ['collections'],
          queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/collections`);
            const data = await res.json();
            return data.success ? data.data || [] : [];
          },
          staleTime: 5 * 60 * 1000, // 5分間キャッシュ
        });

        // イベントデータの事前フェッチ
        await queryClient.prefetchQuery({
          queryKey: ['events'],
          queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/events`);
            const data = await res.json();
            return data.success ? data.data || [] : [];
          },
          staleTime: 5 * 60 * 1000,
        });

        // ミントコレクションデータの事前フェッチ
        await queryClient.prefetchQuery({
          queryKey: ['mint-collections'],
          queryFn: async () => {
            const res = await fetch(`${API_BASE_URL}/api/mint-collections`);
            const data = await res.json();
            return data.success ? data.data || [] : [];
          },
          staleTime: 5 * 60 * 1000,
        });
      } catch (error) {
        console.warn('Failed to prefetch admin data:', error);
      }
    };

    // アイドル時に実行
    if ('requestIdleCallback' in window) {
      requestIdleCallback(prefetchData, { timeout: 2000 });
    } else {
      setTimeout(prefetchData, 100);
    }
  }, []);

  const menuItems: MenuItem[] = [
    {
      label: 'Dashboard',
      href: '/admin'
    },
    {
      label: 'ロール管理',
      href: '/admin/roles',
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
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(label)) {
      newExpanded.delete(label);
    } else {
      newExpanded.add(label);
    }
    setExpandedSections(newExpanded);
  };

  const isActive = (href: string) => {
    if (href === '/admin') {
      return currentPath === '/admin';
    }
    return currentPath.startsWith(href);
  };

  const sidebarContent = (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'white',
      borderRight: '1px solid #e5e7eb'
    }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        <nav>
          {menuItems.map((item) => (
            <div key={item.label}>
              {item.children ? (
                <div>
                  <button
                    onClick={() => toggleSection(item.label)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: '#374151',
                      transition: 'all 0.2s',
                      marginBottom: '0.25rem'
                    }}
                    onMouseEnter={(e) => !collapsed && (e.currentTarget.style.background = '#f9fafb')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {!collapsed && <span>{item.label}</span>}
                    </div>
                    {!collapsed && (
                      expandedSections.has(item.label) 
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  {expandedSections.has(item.label) && !collapsed && (
                    <div style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
                      {item.children.map((child) => (
                        <button
                          key={child.href}
                          onClick={() => navigate(child.href)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            padding: '0.625rem 0.75rem',
                            background: isActive(child.href) ? '#eff6ff' : 'transparent',
                            border: 'none',
                            borderLeft: isActive(child.href) ? '3px solid #3b82f6' : '3px solid transparent',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.8125rem',
                            fontWeight: isActive(child.href) ? 600 : 500,
                            color: isActive(child.href) ? '#1e40af' : '#6b7280',
                            transition: 'all 0.2s',
                            textAlign: 'left',
                            marginBottom: '0.125rem'
                          }}
                          onMouseEnter={(e) => !isActive(child.href) && (e.currentTarget.style.background = '#f9fafb')}
                          onMouseLeave={(e) => !isActive(child.href) && (e.currentTarget.style.background = 'transparent')}
                        >
                          {child.label}
                        </button>
                      ))}
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
                    gap: '0.75rem',
                    padding: '0.75rem',
                    background: isActive(item.href) ? '#eff6ff' : 'transparent',
                    border: 'none',
                    borderLeft: isActive(item.href) ? '3px solid #3b82f6' : '3px solid transparent',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: isActive(item.href) ? 600 : 500,
                    color: isActive(item.href) ? '#1e40af' : '#374151',
                    transition: 'all 0.2s',
                    marginBottom: '0.25rem'
                  }}
                  onMouseEnter={(e) => !isActive(item.href) && (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={(e) => !isActive(item.href) && (e.currentTarget.style.background = 'transparent')}
                >
                  {!collapsed && <span>{item.label}</span>}
                </button>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* 折りたたみボタン（デスクトップのみ） */}
      <div style={{ 
        padding: '1rem',
        borderTop: '1px solid #e5e7eb',
        display: window.innerWidth < 768 ? 'none' : 'block'
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
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#6b7280',
            transition: 'all 0.2s'
          }}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f9fafb' }}>
      {/* モバイルメニューオーバーレイ */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
            display: window.innerWidth >= 768 ? 'none' : 'block'
          }}
        />
      )}

      {/* サイドバー（デスクトップ） */}
      <aside style={{
        width: collapsed ? '80px' : '280px',
        flexShrink: 0,
        transition: 'width 0.3s ease',
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: window.innerWidth < 768 ? 'none' : 'block'
      }}>
        {sidebarContent}
      </aside>

      {/* サイドバー（モバイル） */}
      <aside style={{
        position: 'fixed',
        left: mobileMenuOpen ? 0 : '-100%',
        top: 0,
        width: '280px',
        height: '100vh',
        zIndex: 1000,
        transition: 'left 0.3s ease',
        display: window.innerWidth >= 768 ? 'none' : 'block'
      }}>
        {sidebarContent}
      </aside>

      {/* メインコンテンツ */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {/* モバイルヘッダー */}
        <div style={{
          display: window.innerWidth >= 768 ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem',
          background: 'white',
          borderBottom: '1px solid #e5e7eb',
          position: 'sticky',
          top: 0,
          zIndex: 998
        }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
            管理パネル
          </h2>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              color: '#374151'
            }}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        <div style={{ padding: '2rem' }}>
          {children}
        </div>
      </main>
    </div>
  );
}

