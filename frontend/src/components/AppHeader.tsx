import React from 'react';
import { ConnectButton } from '@mysten/dapp-kit';
import { getResponsiveValue } from '../hooks/useResponsive';

interface AppHeaderProps {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  isAdmin: boolean;
  connected: boolean;
  onNavigateHome: () => void;
  onNavigateAdmin: () => void;
  onNavigateScxt?: () => void;
}

/**
 * アプリケーション共通ヘッダーコンポーネント
 * ナビゲーションとウォレット接続を表示
 */
export function AppHeader({ 
  deviceType, 
  isAdmin, 
  connected, 
  onNavigateHome, 
  onNavigateAdmin,
  onNavigateScxt 
}: AppHeaderProps) {
  return (
    <nav 
      role="navigation"
      aria-label="Main navigation"
      style={{
        background: 'rgba(31, 41, 55, 0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(55, 65, 81, 0.4)',
        padding: getResponsiveValue('0.5rem 0.75rem', '0.5rem 1rem', '0.5rem 1rem', deviceType),
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}
    >
      <div style={{
        width: '100%',
        ...(deviceType === 'desktop' ? {} : { maxWidth: '1200px', margin: '0 auto' }),
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: getResponsiveValue('0.5rem', '0.75rem', '1rem', deviceType)
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType) }}>
          <button
            type="button"
            onClick={onNavigateHome}
            aria-label="Go to home page"
            style={{
              fontSize: getResponsiveValue('0.875rem', '1rem', '1.125rem', deviceType),
              fontWeight: 700,
              color: '#f9fafb',
              margin: 0,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              background: 'none',
              border: 'none',
              padding: getResponsiveValue('0.5rem', '0.5rem', '0', deviceType),
              minHeight: deviceType === 'mobile' ? '44px' : 'auto',
              minWidth: deviceType === 'mobile' ? '44px' : 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            SyndicateXTokyo
          </button>
          {onNavigateScxt && (
            <button
              type="button"
              onClick={onNavigateScxt}
              aria-label="Go to SCXT"
              style={{
                fontSize: getResponsiveValue('0.8rem', '0.9rem', '1rem', deviceType),
                fontWeight: 600,
                color: 'rgba(249, 250, 251, 0.85)',
                margin: 0,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                background: 'none',
                border: 'none',
                padding: getResponsiveValue('0.5rem', '0.5rem', '0', deviceType),
                minHeight: deviceType === 'mobile' ? '44px' : 'auto',
                minWidth: deviceType === 'mobile' ? '44px' : 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              SCXT
            </button>
          )}
        </div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: getResponsiveValue('4px', '6px', '8px', deviceType),
          flexWrap: 'nowrap'
        }}>
          {/* 公式ConnectButton（Copy/Switch/Disconnect機能を内蔵） */}
          <div style={{ 
            transform: getResponsiveValue('scale(0.6)', 'scale(0.75)', 'scale(1)', deviceType),
            transformOrigin: 'right center'
          }}>
            <ConnectButton />
          </div>
          
          {/* 管理者バッジ */}
          {isAdmin && connected && (
            <button 
              type="button"
              aria-label="Go to admin panel"
              onClick={onNavigateAdmin}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: getResponsiveValue('2px', '3px', '4px', deviceType),
                padding: getResponsiveValue('8px 12px', '5px 8px', '6px 10px', deviceType),
                minHeight: deviceType === 'mobile' ? '44px' : 'auto',
                minWidth: deviceType === 'mobile' ? '44px' : 'auto',
                background: '#374151',
                borderRadius: getResponsiveValue('16px', '18px', '20px', deviceType),
                color: '#f9fafb',
                border: '1px solid rgba(55, 65, 81, 0.4)',
                fontSize: getResponsiveValue('9px', '10px', '11px', deviceType),
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                whiteSpace: 'nowrap'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#4b5563';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#374151';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
              }}
            >
              <span style={{ fontSize: '12px' }}>🔑</span>
              <span>Admin</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}

