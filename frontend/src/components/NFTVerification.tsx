import { useState, useEffect } from 'react';
import { useWalletWithErrorHandling } from '../hooks/useWallet';
import { useCollections } from '../hooks/useCollections';
import { useVerification } from '../hooks/useVerification';
import { useUrlParams } from '../hooks/useUrlParams';
import { useResponsive, getResponsiveValue } from '../hooks/useResponsive';
import { WalletConnection } from './WalletConnection';
import { CollectionSelector } from './CollectionSelector';
import { VerificationForm } from './VerificationForm';

// APIベースURLの設定（本番環境用）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

export const NFTVerification: React.FC = () => {
  useWalletWithErrorHandling();
  const [discordId, setDiscordId] = useState('');
  const { deviceType, isMobile } = useResponsive();
  
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

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(120, 119, 198, 0.2) 0%, transparent 50%)
        `,
        pointerEvents: 'none'
      }} />
      
      {/* Floating Elements - Hidden on mobile for performance */}
      {!isMobile && (
        <>
          <div style={{
            position: 'absolute',
            top: '10%',
            left: '10%',
            width: '60px',
            height: '60px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            animation: 'float 6s ease-in-out infinite'
          }} />
          <div style={{
            position: 'absolute',
            top: '20%',
            right: '15%',
            width: '40px',
            height: '40px',
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '50%',
            animation: 'float 8s ease-in-out infinite reverse'
          }} />
          <div style={{
            position: 'absolute',
            bottom: '20%',
            left: '20%',
            width: '80px',
            height: '80px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '50%',
            animation: 'float 10s ease-in-out infinite'
          }} />
        </>
      )}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: getResponsiveValue('1rem', '1.5rem', '2rem', deviceType),
        minHeight: '100vh',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: getResponsiveValue('1.5rem', '2rem', '3rem', deviceType),
          maxWidth: getResponsiveValue('100%', '90%', '600px', deviceType),
          width: '100%',
          boxShadow: `
            0 32px 64px rgba(0, 0, 0, 0.12),
            0 0 0 1px rgba(255, 255, 255, 0.2)
          `,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Glass Effect Overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent)'
          }} />

          <div style={{ textAlign: 'center', marginBottom: getResponsiveValue('2rem', '2.5rem', '3rem', deviceType) }}>
            {/* Logo/Icon */}
            <div style={{
              width: getResponsiveValue('60px', '70px', '80px', deviceType),
              height: getResponsiveValue('60px', '70px', '80px', deviceType),
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '20px',
              margin: '0 auto 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)',
              position: 'relative'
            }}>
              <div style={{
                width: getResponsiveValue('30px', '35px', '40px', deviceType),
                height: getResponsiveValue('30px', '35px', '40px', deviceType),
                background: 'white',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: getResponsiveValue('1.125rem', '1.25rem', '1.5rem', deviceType),
                fontWeight: 'bold',
                color: '#667eea'
              }}>
                SXT
              </div>
            </div>

            <h1 style={{
              fontSize: getResponsiveValue('1.75rem', '2rem', '2.5rem', deviceType),
              fontWeight: '800',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '1rem',
              letterSpacing: '-0.02em'
            }}>
              NFT Verification Portal
            </h1>
            <p style={{
              color: '#64748b',
              fontSize: getResponsiveValue('0.875rem', '1rem', '1.125rem', deviceType),
              lineHeight: '1.6',
              maxWidth: '400px',
              margin: '0 auto',
              fontWeight: '500'
            }}>
              Verify your SXT NFT collection and automatically receive your Discord role with advanced verification technology.
            </p>
          </div>

          {/* Wallet Connection */}
          <div style={{ marginBottom: '2rem' }}>
            <WalletConnection />
          </div>

          {/* Collection Selection */}
          <div style={{ marginBottom: '2rem' }}>
            <CollectionSelector
              collections={collections}
              selectedCollections={selectedCollections}
              checkAllCollections={checkAllCollections}
              handleCheckAllCollections={handleCheckAllCollections}
              handleCollectionToggle={handleCollectionToggle}
            />
          </div>

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

      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(180deg); }
        }
      `}</style>
    </div>
  );
};
