import { useWalletWithErrorHandling } from '../hooks/useWallet';
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
      console.error('Error checking Discord ID from URL:', error);
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
          <h3 style={{ fontWeight: '600', color: '#1a1a1a', marginBottom: '0.5rem' }}>Discord ID</h3>
          <p style={{ fontSize: '0.875rem', color: '#666' }}>
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
            padding: '0.75rem',
            border: '2px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '1rem',
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
          <h3 style={{ fontWeight: '600', color: '#1a1a1a', marginBottom: '0.5rem' }}>Verify NFT Ownership</h3>
          <p style={{ fontSize: '0.875rem', color: '#666' }}>Sign a message to securely confirm your NFT ownership.
          This signature does not involve any transaction or transfer of funds.</p>
        </div>
        <button
          onClick={handleVerifyClick}
          disabled={!connected || !discordId.trim() || isVerifying}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: connected && discordId.trim() && !isVerifying ? 'pointer' : 'not-allowed',
            opacity: connected && discordId.trim() && !isVerifying ? 1 : 0.5,
            transition: 'all 0.2s'
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
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid',
          background: verificationResult.success ? '#f0fdf4' : '#fef2f2',
          borderColor: verificationResult.success ? '#bbf7d0' : '#fecaca',
          color: verificationResult.success ? '#166534' : '#dc2626'
        }}>
          <p style={{ fontSize: '0.875rem' }}>{verificationResult.message}</p>
          <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.7 }}>
            The verification result has been sent to your Discord via DM.
          </p>
        </div>
      )}
    </>
  );
};
