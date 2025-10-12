import { useState, useEffect } from 'react';
import { useWalletWithErrorHandling } from '../hooks/useWallet';
import { useCollections } from '../hooks/useCollections';
import { useVerification } from '../hooks/useVerification';
import { useUrlParams } from '../hooks/useUrlParams';
import { WalletConnection } from './WalletConnection';
import { CollectionSelector } from './CollectionSelector';
import { VerificationForm } from './VerificationForm';

// APIベースURLの設定（本番環境用）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';
const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || '';

export const NFTVerification: React.FC = () => {
  useWalletWithErrorHandling();
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [copied, setCopied] = useState(false);
  const [discordId, setDiscordId] = useState('');
  const [discordUsername, setDiscordUsername] = useState('');
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [oauthError, setOauthError] = useState('');
  const [redirectUrlCopied, setRedirectUrlCopied] = useState(false);
  
  // コレクション選択機能を追加
  const { collections, selectedCollections, checkAllCollections, handleCheckAllCollections, handleCollectionToggle } = useCollections(API_BASE_URL);

  const { isVerifying, verificationResult, handleVerifyNFT } = useVerification(API_BASE_URL);

  // URLパラメータからDiscord IDを自動取得
  const { discordIdFromUrl } = useUrlParams();
  
  useEffect(() => {
    if (discordIdFromUrl) {
      setDiscordId(discordIdFromUrl);
    }
  }, [discordIdFromUrl]);

  // Discord OAuthコード処理
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');

      if (error) {
        setOauthError('Discord認証がキャンセルされました');
        return;
      }

      if (code && !discordId) {
        setIsOAuthLoading(true);
        setOauthError('');

        try {
          const redirectUri = window.location.origin + '/Verification';
          const response = await fetch(`${API_BASE_URL}/api/discord/oauth/exchange`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redirectUri })
          });

          const data = await response.json();

          if (data.success && data.data) {
            setDiscordId(data.data.discordId);
            setDiscordUsername(data.data.username);
            // URLからcodeパラメータを削除
            window.history.replaceState({}, document.title, '/Verification');
          } else {
            setOauthError(data.error || 'Discord認証に失敗しました');
          }
        } catch (err) {
          setOauthError('Discord認証処理中にエラーが発生しました');
          console.error('OAuth exchange error:', err);
        } finally {
          setIsOAuthLoading(false);
        }
      }
    };

    handleOAuthCallback();
  }, [discordId]);

  const handleDiscordLogin = () => {
    if (!DISCORD_CLIENT_ID) {
      setOauthError('Discord OAuth が設定されていません');
      return;
    }

    const redirectUri = window.location.origin + '/Verification';
    const state = Math.random().toString(36).substring(7);
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify&state=${state}`;
    
    window.location.href = authUrl;
  };

  const copyRedirectUrl = () => {
    const redirectUrl = window.location.origin + '/Verification';
    navigator.clipboard.writeText(redirectUrl);
    setRedirectUrlCopied(true);
    setTimeout(() => setRedirectUrlCopied(false), 2000);
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
            SXT NFT Verification Portal
          </h1>
          <p style={{
            color: '#666',
            fontSize: '1rem',
            lineHeight: '1.5'
          }}>
            Verify your SXT NFT and automatically receive your Discord role.
          </p>
        </div>

        {/* Discord Redirect URL表示（開発者向け） */}
        <div style={{
          marginBottom: '1.5rem',
          padding: '1rem',
          background: '#f9fafb',
          border: '1px solid #e5e7eb',
          borderRadius: '8px'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem', fontWeight: 600 }}>
            Discord アプリのリダイレクトURL
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <code style={{
              flex: 1,
              padding: '0.5rem',
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              color: '#374151',
              wordBreak: 'break-all'
            }}>
              {window.location.origin}/Verification
            </code>
            <button
              onClick={copyRedirectUrl}
              style={{
                padding: '0.5rem 0.75rem',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.75rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {redirectUrlCopied ? '✓' : 'コピー'}
            </button>
          </div>
        </div>

        {/* Discord OAuth Login */}
        {!discordId && !isOAuthLoading && (
          <div style={{ marginBottom: '1.5rem' }}>
            <button
              onClick={handleDiscordLogin}
              disabled={!DISCORD_CLIENT_ID}
              style={{
                width: '100%',
                background: '#5865F2',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: DISCORD_CLIENT_ID ? 'pointer' : 'not-allowed',
                opacity: DISCORD_CLIENT_ID ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>🎮</span>
              Discordでログイン
            </button>
          </div>
        )}

        {/* OAuth Loading */}
        {isOAuthLoading && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            background: '#eff6ff',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#1e40af'
          }}>
            Discord認証中...
          </div>
        )}

        {/* OAuth Error */}
        {oauthError && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#991b1b',
            fontSize: '0.875rem'
          }}>
            {oauthError}
          </div>
        )}

        {/* Discord User Info */}
        {discordId && discordUsername && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '1rem',
            background: '#f0fdf4',
            border: '1px solid #86efac',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#15803d', fontWeight: 600 }}>
              ✓ Discord認証済み: {discordUsername}
            </div>
          </div>
        )}

        {/* Wallet Connection */}
        <WalletConnection
          showFullAddress={showFullAddress}
          setShowFullAddress={setShowFullAddress}
          copied={copied}
          setCopied={setCopied}
        />

        {/* Collection Selection */}
        <CollectionSelector
          collections={collections}
          selectedCollections={selectedCollections}
          checkAllCollections={checkAllCollections}
          handleCheckAllCollections={handleCheckAllCollections}
          handleCollectionToggle={handleCollectionToggle}
        />

        {/* Verification Form */}
        <VerificationForm
          discordId={discordId}
          setDiscordId={setDiscordId}
          isVerifying={isVerifying}
          verificationResult={verificationResult}
          selectedCollections={selectedCollections}
          handleVerifyNFT={handleVerifyNFT}
        />
      </div>
    </div>
  );
};
