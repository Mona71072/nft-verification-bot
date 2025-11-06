import { ConnectButton } from '@mysten/dapp-kit';
import { useResponsive, getResponsiveValue } from '../hooks/useResponsive';

export const WalletConnection: React.FC = () => {
  const { deviceType } = useResponsive();

  return (
    <div style={{ 
      marginBottom: 0,
      padding: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
      background: 'rgba(10, 10, 15, 0.8)',
      borderRadius: '24px',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      position: 'relative',
      overflow: 'hidden',
      backdropFilter: 'blur(20px)',
      boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 -1px 0 rgba(0, 0, 0, 0.1)'
    }}>
      {/* Subtle background pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.06) 0%, transparent 50%),
          linear-gradient(45deg, rgba(59, 130, 246, 0.02) 0%, transparent 50%)
        `,
        pointerEvents: 'none'
      }} />

      <div style={{ 
        marginBottom: '1.5rem',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '0.75rem'
        }}>
          <div style={{
            width: getResponsiveValue('28px', '30px', '32px', deviceType),
            height: getResponsiveValue('28px', '30px', '32px', deviceType),
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '0.75rem',
            boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
            position: 'relative'
          }}>
            <svg width={getResponsiveValue('14', '15', '16', deviceType)} height={getResponsiveValue('14', '15', '16', deviceType)} viewBox="0 0 24 24" fill="none" style={{ color: 'white' }}>
              <path d="M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 style={{ 
            fontWeight: '800', 
            color: '#ffffff', 
            margin: 0,
            fontSize: getResponsiveValue('1rem', '1.0625rem', '1.125rem', deviceType),
            textShadow: '0 0 20px rgba(255, 255, 255, 0.3)'
          }}>
            Connect Your Wallet
          </h3>
        </div>
        <p style={{ 
          fontSize: getResponsiveValue('0.8125rem', '0.84375rem', '0.875rem', deviceType), 
          color: '#c7d2fe',
          margin: 0,
          lineHeight: '1.5',
          fontWeight: '500',
          textShadow: '0 0 15px rgba(199, 210, 254, 0.2)'
        }}>
          Connect your Sui wallet to verify NFT ownership and receive Discord roles automatically.
        </p>
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {(() => {
          try {
            return (
              <div style={{
                display: 'flex',
                justifyContent: 'center'
              }}>
                <ConnectButton />
              </div>
            );
          } catch (error) {
            return (
              <div style={{
                padding: '1.25rem',
                background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                color: '#dc2626',
                fontSize: '0.875rem',
                textAlign: 'center',
                fontWeight: '500',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.1)'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '0.5rem'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ marginRight: '0.5rem' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2"/>
                    <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Connection Error
                </div>
                A wallet connection error occurred. Please reload the page.
              </div>
            );
          }
        })()}
      </div>
    </div>
  );
};

