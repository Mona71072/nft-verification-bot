import React from 'react';
import { LayoutGrid, TrendingUp, Gem, Calendar as CalendarIcon, Activity as ActivityIcon } from 'lucide-react';
import { getResponsiveValue } from '../../hooks/useResponsive';
import type { HomeTabType } from '../../hooks/useHomePageState';

interface HomeTabNavigationProps {
  activeTab: HomeTabType;
  onTabChange: (tab: HomeTabType) => void;
  deviceType: 'mobile' | 'tablet' | 'desktop';
  onTabPrefetch?: (tab: HomeTabType) => void;
}

const tabConfig: Record<HomeTabType, { label: string; icon: React.ReactNode; disabled?: boolean }> = {
  all: {
    label: 'All',
    icon: <LayoutGrid size={14} />
  },
  dashboard: {
    label: 'Dashboard',
    icon: <TrendingUp size={14} />
  },
  owned: {
    label: 'Owned',
    icon: <Gem size={14} />
  },
  calendar: {
    label: 'Calendar',
    icon: <CalendarIcon size={14} />
  },
  activity: {
    label: 'Activity',
    icon: <ActivityIcon size={14} />
  }
};

const tabOrder: HomeTabType[] = ['all', 'dashboard', 'owned', 'calendar', 'activity'];

export function HomeTabNavigation({ activeTab, onTabChange, deviceType, onTabPrefetch }: HomeTabNavigationProps) {
  const getTabStyle = (tab: HomeTabType) => {
    // モバイルタッチターゲットの最適化（WCAG推奨44px以上）
    const minTouchSize = deviceType === 'mobile' ? '44px' : 'auto';
    
    return {
      flex: getResponsiveValue('0 0 auto', '1', '1', deviceType),
      minWidth: getResponsiveValue('90px', 'auto', 'auto', deviceType),
      minHeight: minTouchSize,
      padding: getResponsiveValue('0.5rem 0.75rem', '0.5625rem 0.875rem', '0.625rem 1rem', deviceType),
      background: activeTab === tab 
        ? getActiveBackground(tab)
        : 'transparent',
      color: activeTab === tab 
        ? 'white' 
        : getInactiveColor(tab),
      border: 'none',
      borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
      cursor: 'pointer',
      fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.75rem', deviceType),
      fontWeight: activeTab === tab ? '700' : '500',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      whiteSpace: 'nowrap' as const,
      boxShadow: activeTab === tab 
        ? '0 2px 8px rgba(30, 41, 59, 0.25)' 
        : 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: getResponsiveValue('0.375rem', '0.4375rem', '0.5rem', deviceType),
      opacity: 1
    };
  };

  const getActiveBackground = (tab: HomeTabType) => {
    switch (tab) {
      case 'all':
        return 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)';
      case 'owned':
        return 'linear-gradient(135deg, #1e293b 0%, #334155 100%)';
      case 'calendar':
        return 'linear-gradient(135deg, #1e293b 0%, #334155 100%)';
      case 'activity':
        return 'linear-gradient(135deg, #1e293b 0%, #334155 100%)';
      case 'dashboard':
        return 'linear-gradient(135deg, #1e293b 0%, #334155 100%)';
      default:
        return 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)';
    }
  };

  const getInactiveColor = (tab: HomeTabType) => {
    switch (tab) {
      case 'all':
        return '#a5b4fc';
      case 'owned':
        return '#64748b';
      case 'calendar':
        return '#64748b';
      case 'activity':
        return '#64748b';
      case 'dashboard':
        return '#64748b';
      default:
        return '#a5b4fc';
    }
  };

  return (
    <div 
      role="tablist"
      aria-label="Main navigation tabs"
      style={{
        display: 'flex',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        overflowY: 'hidden',
        gap: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType),
        marginBottom: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'thin',
        scrollbarColor: '#cbd5e1 transparent'
      }}
    >
      {tabOrder.map((tab) => {
        const config = tabConfig[tab];
        const isActive = activeTab === tab;
        const tabId = `${tab}-tab`;
        const panelId = `${tab}-panel`;
        
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={tabId}
            aria-selected={isActive}
            aria-controls={panelId}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab as HomeTabType)}
            onKeyDown={(e) => {
              // キーボードナビゲーションのサポート
              const tabs = tabOrder;
              const currentIndex = tabs.indexOf(tab);
              
              if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
                onTabChange(tabs[prevIndex] as HomeTabType);
              } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
                onTabChange(tabs[nextIndex] as HomeTabType);
              } else if (e.key === 'Home') {
                e.preventDefault();
                onTabChange(tabs[0] as HomeTabType);
              } else if (e.key === 'End') {
                e.preventDefault();
                onTabChange(tabs[tabs.length - 1] as HomeTabType);
              }
            }}
            onMouseEnter={() => onTabPrefetch?.(tab as HomeTabType)}
            onFocus={() => onTabPrefetch?.(tab as HomeTabType)}
            onPointerEnter={() => onTabPrefetch?.(tab as HomeTabType)}
            style={getTabStyle(tab as HomeTabType)}
          >
            {config.icon}
            <span>{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}
