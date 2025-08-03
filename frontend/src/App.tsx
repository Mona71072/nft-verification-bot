import { WalletProvider, ConnectButton, useWallet } from '@suiet/wallet-kit';
import '@suiet/wallet-kit/style.css';
import { useState, useEffect } from 'react';

// APIベースURLの設定（本番環境用）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

function NFTVerification() {
  const { account, connected, signMessage } = useWallet();
  const [discordId, setDiscordId] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // URLパラメータからDiscord IDを自動取得
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const discordIdFromUrl = urlParams.get('discord_id');
    if (discordIdFromUrl) {
      setDiscordId(discordIdFromUrl);
      console.log('Discord ID from URL:', discordIdFromUrl);
    }
  }, []);

  // URLパラメータからDiscord IDが取得されたかどうかを判定
  const isDiscordIdFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('discord_id') !== null;
  };

  const handleVerifyNFT = async () => {
    if (!connected || !account) {
      setVerificationResult({
        success: false,
        message: 'ウォレットが接続されていません。'
      });
      return;
    }

    if (!discordId.trim()) {
      setVerificationResult({
        success: false,
        message: 'Discord IDを入力してください。'
      });
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      // 1. ナンス生成
      const nonceResponse = await fetch(`${API_BASE_URL}/api/nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: discordId.trim(),
          address: account.address
        })
      });

      const nonceData = await nonceResponse.json();
      if (!nonceData.success) {
        throw new Error(nonceData.error || 'ナンス生成に失敗しました。');
      }

      const nonce = nonceData.data.nonce;

      // 2. 署名メッセージの生成
      const message = `Verify NFT ownership for Discord role assignment.

Discord ID: ${discordId}
Wallet Address: ${account.address}
Nonce: ${nonce}
Timestamp: ${new Date().toISOString()}

By signing this message, you confirm that you own the specified NFT and authorize the role assignment.`;

      // 3. メッセージを署名
      const signature = await signMessage({
        message: new TextEncoder().encode(message)
      });

      // 4. バックエンドに送信
      const requestBody = {
        signature: signature,
        address: account.address,
        discordId: discordId.trim(),
        nonce: nonce,
        message: message,
        walletType: 'Suiet Wallet'
      };

      const response = await fetch(`${API_BASE_URL}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data.success) {
        setVerificationResult({
          success: true,
          message: `認証が完了しました！ロール "${data.data.roleName}" がアカウントに割り当てられました。`
        });
      } else {
        setVerificationResult({
          success: false,
          message: data.error || '認証に失敗しました。'
        });
      }
    } catch (error) {
      console.error('Verification error:', error);
      setVerificationResult({
        success: false,
        message: `エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '2rem',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#1a1a1a',
            marginBottom: '0.5rem'
          }}>
            🎯 SXT NFT Verification Portal
          </h1>
          <p style={{
            color: '#666',
            fontSize: '1rem',
            lineHeight: '1.5'
          }}>
            Join the exclusive NFT community by verifying your Sui wallet ownership
          </p>
        </div>

        {/* Step 1: Wallet Connection */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: connected ? '#10b981' : '#e5e7eb',
              color: connected ? 'white' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              fontWeight: '600',
              marginRight: '0.75rem'
            }}>
              1
            </div>
            <div>
              <h3 style={{ fontWeight: '600', color: '#1a1a1a' }}>ウォレット接続</h3>
              <p style={{ fontSize: '0.875rem', color: '#666' }}>Suiウォレットを接続してNFT所有権を確認</p>
            </div>
          </div>
          <ConnectButton />
          {connected && account && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <p style={{ fontSize: '0.875rem', color: '#666' }}>
                接続済み: <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{account.address}</span>
              </p>
            </div>
          )}
        </div>

        {/* Step 2: Discord ID Input */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#e5e7eb',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              fontWeight: '600',
              marginRight: '0.75rem'
            }}>
              2
            </div>
            <div>
              <h3 style={{ fontWeight: '600', color: '#1a1a1a' }}>Discord ID入力</h3>
              <p style={{ fontSize: '0.875rem', color: '#666' }}>
                {isDiscordIdFromUrl() 
                  ? 'エクスクルーシブなロールを受け取るDiscord ID（自動取得済み・変更不可）'
                  : 'エクスクルーシブなロールを受け取るDiscord IDを入力'
                }
              </p>
            </div>
          </div>
          <input
            type="text"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder={isDiscordIdFromUrl() ? "Discord ID (自動取得済み)" : "123456789012345678"}
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

        {/* Step 3: Verification */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#e5e7eb',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.875rem',
              fontWeight: '600',
              marginRight: '0.75rem'
            }}>
              3
            </div>
            <div>
              <h3 style={{ fontWeight: '600', color: '#1a1a1a' }}>NFT所有権確認</h3>
              <p style={{ fontSize: '0.875rem', color: '#666' }}>メッセージに署名してNFT所有権を安全に確認</p>
            </div>
          </div>
          <button
            onClick={handleVerifyNFT}
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
                確認中...
              </div>
            ) : (
              '認証開始'
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
          </div>
        )}

        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

function App() {
  return (
    <WalletProvider>
      <NFTVerification />
    </WalletProvider>
  );
}

export default App;
