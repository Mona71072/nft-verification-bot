import { ConnectButton } from '@suiet/wallet-kit';
import { useWalletWithErrorHandling } from '../hooks/useWallet';

interface WalletConnectionProps {
  showFullAddress: boolean;
  setShowFullAddress: (show: boolean) => void;
  copied: boolean;
  setCopied: (copied: boolean) => void;
}

export const WalletConnection: React.FC<WalletConnectionProps> = ({
  showFullAddress,
  setShowFullAddress,
  copied,
  setCopied
}) => {
  const { account, connected } = useWalletWithErrorHandling();

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
              ウォレット接続エラーが発生しました。ページを再読み込みしてください。
            </div>
          );
        }
      })()}
      {connected && account && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            flexWrap: 'wrap'
          }}>
            <span style={{ fontSize: '0.875rem', color: '#666' }}>接続済み:</span>
            <span
              title={account.address}
              style={{
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {showFullAddress
                ? account.address
                : `${account.address.slice(0, 6)}...${account.address.slice(-4)}`}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(account.address);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {}
                }}
                style={{
                  padding: '0.25rem 0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  background: '#fff',
                  color: '#374151',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                {copied ? 'コピー済み' : 'コピー'}
              </button>
              <button
                onClick={() => setShowFullAddress(!showFullAddress)}
                style={{
                  padding: '0.25rem 0.5rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  background: '#fff',
                  color: '#374151',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                {showFullAddress ? '省略表示' : '全表示'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

