import { ConnectButton } from '@suiet/wallet-kit';

export const WalletConnection: React.FC = () => {

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ fontWeight: '600', color: '#1a1a1a', marginBottom: '0.5rem' }}>Connect Wallet</h3>
        <p style={{ fontSize: '0.875rem', color: '#666' }}>Connect your Sui wallet to verify NFT ownership.</p>
      </div>
      {(() => {
        try {
          return <ConnectButton />;
        } catch (error) {
          console.error('ConnectButton error:', error);
          return (
            <div style={{
              padding: '1rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#dc2626',
              fontSize: '0.875rem'
            }}>
              A wallet connection error occurred. Please reload the page.
            </div>
          );
        }
      })()}
    </div>
  );
};

