import { useWalletWithErrorHandling } from '../hooks/useWallet';
import { useResponsive, getResponsiveValue } from '../hooks/useResponsive';
import type { VerificationResult } from '../types';

interface VerificationFormProps {
  discordId: string;
  setDiscordId: (id: string) => void;
  isVerifying: boolean;
  verificationResult: VerificationResult | null;
  selectedCollections: string[];
  handleVerifyNFT: (account: any, signPersonalMessage: any, discordId: string, selectedCollections: string[]) => Promise<void>;
}

export const VerificationForm: React.FC<VerificationFormProps> = ({
  discordId,
  setDiscordId,
  isVerifying,
  verificationResult,
  selectedCollections,
  handleVerifyNFT
}) => {
  const { account, connected, signPersonalMessage } = useWalletWithErrorHandling();
  const { deviceType } = useResponsive();

  // Determine if Discord ID was retrieved from URL parameters
  const isDiscordIdFromUrl = () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const possibleParams = ['user_id', 'discord_id', 'userId', 'discordId', 'id'];
      
      for (const param of possibleParams) {
        if (urlParams.get(param) !== null) {
          return true;
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const handleVerifyClick = () => {
    if (account && signPersonalMessage) {
      handleVerifyNFT(account, signPersonalMessage, discordId, selectedCollections);
    }
  };

  return (
    <>
      {/* Discord ID Input */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ 
            fontWeight: '600', 
            color: '#1a1a1a', 
            marginBottom: '0.5rem',
            fontSize: getResponsiveValue('1rem', '1.0625rem', '1.125rem', deviceType)
          }}>
            Discord ID
          </h3>
          <p style={{ 
            fontSize: getResponsiveValue('0.8125rem', '0.84375rem', '0.875rem', deviceType), 
            color: '#666' 
          }}>
            {isDiscordIdFromUrl()
              ? 'Your Discord ID has been automatically retrieved.'
              : 'Please enter your Discord ID.'}
          </p>
        </div>
        <input
          type="text"
          value={discordId}
          onChange={(e) => setDiscordId(e.target.value)}
          placeholder={isDiscordIdFromUrl() ? 'Auto-filled from URL' : '123456789012345678'}
          style={{
            width: '100%',
            padding: getResponsiveValue('0.625rem', '0.6875rem', '0.75rem', deviceType),
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType),
            outline: 'none',
            opacity: connected ? 1 : 0.5,
            pointerEvents: connected ? 'auto' : 'none',
            backgroundColor: isDiscordIdFromUrl() ? '#f3f4f6' : 'white',
            color: isDiscordIdFromUrl() ? '#6b7280' : '#1a1a1a',
            cursor: isDiscordIdFromUrl() ? 'not-allowed' : 'text'
          }}
          disabled={!connected || isDiscordIdFromUrl()}
          readOnly={isDiscordIdFromUrl()}
        />
      </div>

      {/* Verification */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ 
            fontWeight: '600', 
            color: '#1a1a1a', 
            marginBottom: '0.5rem',
            fontSize: getResponsiveValue('1rem', '1.0625rem', '1.125rem', deviceType)
          }}>
            Verify NFT Ownership
          </h3>
          <p style={{ 
            fontSize: getResponsiveValue('0.8125rem', '0.84375rem', '0.875rem', deviceType), 
            color: '#666' 
          }}>
            Sign a message to securely confirm your NFT ownership.
            This signature does not involve any transaction or transfer of funds.
          </p>
        </div>
        <button
          onClick={handleVerifyClick}
          disabled={!connected || !discordId.trim() || isVerifying}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            padding: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType),
            borderRadius: '8px',
            fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType),
            fontWeight: '600',
            cursor: connected && discordId.trim() && !isVerifying ? 'pointer' : 'not-allowed',
            opacity: connected && discordId.trim() && !isVerifying ? 1 : 0.5,
            transition: 'all 0.2s',
            minHeight: '44px' // Touch-friendly minimum size
          }}
        >
          {isVerifying ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                marginRight: '0.5rem'
              }}></div>
              Verifying...
            </div>
          ) : (
            'Start Verification'
          )}
        </button>
      </div>

      {/* Results */}
      {verificationResult && (
        <div style={{
          padding: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType),
          borderRadius: '12px',
          border: '1px solid',
          background: verificationResult.success 
            ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' 
            : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
          borderColor: verificationResult.success ? '#bbf7d0' : '#fecaca',
          color: verificationResult.success ? '#166534' : '#dc2626',
          boxShadow: verificationResult.success 
            ? '0 4px 12px rgba(34, 197, 94, 0.1)' 
            : '0 4px 12px rgba(239, 68, 68, 0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            marginBottom: '0.5rem' 
          }}>
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              style={{ marginRight: '0.5rem' }}
            >
              {verificationResult.success ? (
                <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              ) : (
                <>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2"/>
                  <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
                </>
              )}
            </svg>
            <span style={{ 
              fontWeight: '600',
              fontSize: getResponsiveValue('0.875rem', '0.9rem', '0.875rem', deviceType)
            }}>
              {verificationResult.success ? 'Verification Successful' : 'Verification Failed'}
            </span>
          </div>
          <p style={{ 
            fontSize: getResponsiveValue('0.8125rem', '0.84375rem', '0.875rem', deviceType),
            marginBottom: '0.5rem'
          }}>
            {verificationResult.message}
          </p>
          <p style={{ 
            fontSize: getResponsiveValue('0.75rem', '0.8rem', '0.75rem', deviceType), 
            marginTop: '0.5rem', 
            opacity: 0.7 
          }}>
            The verification result has been sent to your Discord via DM.
          </p>
        </div>
      )}
    </>
  );
};
