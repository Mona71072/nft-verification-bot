import { useState, useEffect } from 'react';
// import { useWalletWithErrorHandling } from './hooks/useWallet';
import { TabNavigation, type TabType } from './components/admin/TabNavigation';
import { MessageDisplay } from './components/ui/MessageDisplay';
import { CollectionsTab } from './components/admin/tabs/CollectionsTab';
import { EventsTab } from './components/admin/tabs/EventsTab';
import { BatchTab } from './components/admin/tabs/BatchTab';
import { AdminsTab } from './components/admin/tabs/AdminsTab';

type AdminMode = 'admin' | 'roles' | 'mint' | undefined;

interface AdminPanelProps {
  mode?: AdminMode;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

export function AdminPanel({ mode }: AdminPanelProps) {
  // ウォレット接続状態（将来の拡張用）
  // const { connected } = useWalletWithErrorHandling() as any;
  
  // スピンアニメーション用のCSS
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [activeTab, setActiveTab] = useState<TabType>(
    mode === 'mint' ? 'events' : mode === 'admin' ? 'admins' : 'collections'
  );
  const [message, setMessage] = useState('');
  // const [messageType, setMessageType] = useState<'success' | 'error' | 'warning' | 'info'>('info');

  // 表示タブをmodeで制限
  const allowedTabs: TabType[] =
    mode === 'mint'
      ? ['events', 'history']
      : mode === 'roles'
      ? ['collections', 'batch', 'users', 'dm-settings']
      : ['collections', 'events', 'batch', 'users', 'admins', 'dm-settings', 'history'];

  // メッセージ表示機能（将来の拡張用）
  // const showMessage = (text: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
  //   setMessage(text);
  //   setMessageType(type);
  //   setTimeout(() => setMessage(''), 5000);
  // };

  const getPageTitle = () => {
    switch (mode) {
      case 'admin': return '管理者ページ';
      case 'mint': return 'ミント管理';
      case 'roles': return 'ロール管理';
      default: return 'NFT Verification 管理パネル';
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'collections':
        return <CollectionsTab apiBaseUrl={API_BASE_URL} mode={mode} />;
      case 'events':
        return <EventsTab apiBaseUrl={API_BASE_URL} mode={mode} />;
      case 'batch':
        return <BatchTab apiBaseUrl={API_BASE_URL} mode={mode} />;
      case 'admins':
        return <AdminsTab apiBaseUrl={API_BASE_URL} mode={mode} />;
      case 'users':
        return <div>ユーザー管理機能（実装予定）</div>;
      case 'dm-settings':
        return <div>DM設定機能（実装予定）</div>;
      case 'history':
        return <div>履歴機能（実装予定）</div>;
      default:
        return <div>タブが選択されていません</div>;
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '1rem' }}>
        {getPageTitle()}
      </h1>

      {mode === 'admin' && (
        <div style={{ marginBottom: '2rem', display: 'grid', gap: '0.75rem', maxWidth: '400px' }}>
          <button 
            onClick={() => {
              window.history.pushState({}, '', '/admin/roles');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }} 
            style={{ 
              padding: '0.75rem 1rem', 
              background: '#f8f9fa', 
              borderRadius: 8, 
              fontWeight: 600, 
              color: '#1f2937', 
              textAlign: 'center', 
              border: '1px solid #d1d5db', 
              cursor: 'pointer', 
              width: '100%' 
            }}
          >
            ロール管理へ
          </button>
          <button 
            onClick={() => {
              window.history.pushState({}, '', '/admin/mint');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
          style={{
              padding: '0.75rem 1rem', 
                    background: '#f8f9fa', 
                          borderRadius: 8,
                            fontWeight: 600,
              color: '#1f2937', 
              textAlign: 'center', 
              border: '1px solid #d1d5db', 
                            cursor: 'pointer', 
              width: '100%' 
            }}
          >
            ミント管理へ
                        </button>
        </div>
      )}

      {message && (
        <MessageDisplay 
          message={message} 
          type="info" 
          onClose={() => setMessage('')} 
        />
      )}

      <TabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        allowedTabs={allowedTabs}
        mode={mode}
      />

          <div style={{ 
        padding: '2rem', 
                    border: '1px solid #e5e7eb',
        borderTop: 'none', 
        borderRadius: '0 0 8px 8px',
        backgroundColor: '#fff'
                  }}>
        {renderTabContent()}
                      </div>
    </div>
  );
}

export default AdminPanel; 
