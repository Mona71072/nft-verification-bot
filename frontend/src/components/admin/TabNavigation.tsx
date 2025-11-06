import React from 'react';

export type TabType = 'collections' | 'events' | 'batch' | 'users' | 'admins' | 'dm-settings' | 'history';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  allowedTabs: TabType[];
  mode?: 'admin' | 'roles' | 'mint';
}

const tabConfig: Record<TabType, { label: string; icon?: string }> = {
  collections: { label: 'コレクション', icon: '📦' },
  events: { label: 'イベント', icon: '🎉' },
  batch: { label: 'バッチ処理', icon: '⚡' },
  users: { label: 'ユーザー', icon: '👥' },
  admins: { label: '管理者', icon: '👑' },
  'dm-settings': { label: 'DM設定', icon: '💬' },
  history: { label: '履歴', icon: '📊' }
};

export function TabNavigation({ activeTab, onTabChange, allowedTabs, mode }: TabNavigationProps) {
  const getTabStyle = (tab: TabType) => ({
    padding: '0.75rem 1rem',
    background: activeTab === tab ? '#007bff' : '#f8f9fa',
    color: activeTab === tab ? 'white' : '#333',
    border: '1px solid #d1d5db',
    borderRadius: '8px 8px 0 0',
    cursor: 'pointer',
    fontWeight: '500',
    fontSize: '0.875rem',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    whiteSpace: 'nowrap' as const
  });

  return (
    <div style={{ 
      display: 'flex', 
      gap: '0.25rem', 
      marginBottom: '0',
      borderBottom: '2px solid #e5e7eb',
      overflowX: 'auto'
    }}>
      {allowedTabs.map((tab) => {
        const config = tabConfig[tab];
        return (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            style={getTabStyle(tab)}
            onMouseEnter={(e) => {
              if (activeTab !== tab) {
                e.currentTarget.style.background = '#e9ecef';
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab) {
                e.currentTarget.style.background = '#f8f9fa';
              }
            }}
          >
            {config.icon && <span>{config.icon}</span>}
            <span>{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}
