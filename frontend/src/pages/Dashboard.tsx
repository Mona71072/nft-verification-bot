import React from 'react';
import { useWalletWithErrorHandling } from '../hooks/useWallet';

const Dashboard: React.FC = () => {
  const { account, connected } = useWalletWithErrorHandling();

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '3rem',
        maxWidth: '900px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: '#1a1a1a',
            marginBottom: '1rem'
          }}>
            SyndicateXTokyo Dashboard
          </h1>
          <p style={{
            color: '#666',
            fontSize: '1.125rem',
            lineHeight: '1.6'
          }}>
            NFTの管理と各種機能へのアクセス
          </p>
        </div>

        {/* ウォレット接続状態 */}
        {connected && account?.address ? (
          <div style={{
            background: '#f9fafb',
            border: '2px solid #e5e7eb',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{ 
              fontSize: '0.875rem', 
              color: '#6b7280', 
              marginBottom: '0.5rem',
              fontWeight: 600
            }}>
              接続済みウォレット
            </div>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '1rem',
              color: '#1a1a1a',
              wordBreak: 'break-all'
            }}>
              {account.address}
            </div>
          </div>
        ) : (
          <div style={{
            background: '#fef3c7',
            border: '2px solid #fbbf24',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem',
            textAlign: 'center'
          }}>
            <div style={{ color: '#92400e', fontSize: '1rem' }}>
              ウォレットを接続してください
            </div>
          </div>
        )}

        {/* 機能ナビゲーション */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginTop: '2rem'
        }}>
          <a
            href="/mint"
            style={{
              display: 'block',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '2rem',
              borderRadius: '12px',
              textDecoration: 'none',
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎨</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              NFT Mint
            </div>
            <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
              新しいNFTをミントする
            </div>
          </a>

          <div
            style={{
              background: '#f3f4f6',
              color: '#6b7280',
              padding: '2rem',
              borderRadius: '12px',
              border: '2px dashed #d1d5db',
              textAlign: 'center'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📊</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              My NFTs
            </div>
            <div style={{ fontSize: '0.875rem' }}>
              保有NFTの一覧（開発中）
            </div>
          </div>
        </div>

        {/* フッター情報 */}
        <div style={{
          marginTop: '3rem',
          paddingTop: '2rem',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: '0.875rem'
        }}>
          <p>SyndicateXTokyo NFT Platform</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

