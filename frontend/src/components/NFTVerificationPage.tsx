import React, { useState, useEffect } from 'react';
import { useWalletWithErrorHandling } from '../hooks/useWallet';
import { useCollections } from '../hooks/useCollections';
import { useVerification } from '../hooks/useVerification';
import { useUrlParams } from '../hooks/useUrlParams';
import { useResponsive, getResponsiveValue } from '../hooks/useResponsive';
import { WalletConnection } from './WalletConnection';
import { CollectionSelector } from './CollectionSelector';
import { VerificationForm } from './VerificationForm';

// APIベースURLの設定（本番環境用）
const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

export const NFTVerificationPage: React.FC = () => {
  useWalletWithErrorHandling();
  const [discordId, setDiscordId] = useState('');
  
  // エラーハンドリング付きでuseResponsiveフックを使用
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  
  try {
    const responsive = useResponsive();
    deviceType = responsive.deviceType;
  } catch (error) {
    // フォールバック値を使用
  }
  
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

  // エラーハンドリング付きでコンポーネントをレンダリング
  try {
    return (
      <>
      <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #1e3a8a 100%)',
      position: 'relative',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Subtle grid pattern */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        pointerEvents: 'none'
      }} />
      
      {/* Floating particles */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        overflow: 'hidden'
      }}>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: getResponsiveValue('4px', '6px', '8px', deviceType),
              height: getResponsiveValue('4px', '6px', '8px', deviceType),
              background: `rgba(59, 130, 246, ${0.3 + i * 0.1})`,
              borderRadius: '50%',
              left: `${20 + i * 15}%`,
              top: `${30 + i * 10}%`,
              animation: `floatParticle ${8 + i * 2}s ease-in-out infinite`,
              animationDelay: `${i * 1.5}s`,
              boxShadow: `0 0 ${getResponsiveValue('10px', '15px', '20px', deviceType)} rgba(59, 130, 246, 0.4)`
            }}
          />
        ))}
      </div>
      
      {/* Animated gradient overlay */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `
          radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.08) 0%, transparent 60%),
          radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.06) 0%, transparent 60%),
          radial-gradient(circle at 40% 60%, rgba(16, 185, 129, 0.04) 0%, transparent 60%)
        `,
        pointerEvents: 'none',
        animation: 'gradientShift 30s ease-in-out infinite'
      }} />
      

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
          background: 'rgba(10, 10, 15, 0.9)',
          backdropFilter: 'blur(28px)',
          borderRadius: getResponsiveValue('20px', '24px', '28px', deviceType),
          padding: getResponsiveValue('1.5rem', '2rem', '2.5rem', deviceType),
          maxWidth: getResponsiveValue('100%', '90%', '600px', deviceType),
          width: '100%',
          boxShadow: '0 40px 80px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.2)',
          border: '1px solid rgba(59, 130, 246, 0.4)',
          position: 'relative',
          overflow: 'hidden'
        }}>

          <div style={{ textAlign: 'center', marginBottom: getResponsiveValue('1.5rem', '2rem', '2.5rem', deviceType) }}>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginBottom: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType)
            }}>
              <div style={{
                fontSize: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType),
                fontWeight: '600',
                color: '#8b5cf6',
                marginBottom: getResponsiveValue('0.25rem', '0.375rem', '0.5rem', deviceType),
                letterSpacing: '0.05em',
                textShadow: '0 0 15px rgba(139, 92, 246, 0.4)',
                opacity: 0.9
              }}>
                SyndicateXTokyo
              </div>
              <h1 style={{
                fontSize: getResponsiveValue('1.25rem', '1.5rem', '1.875rem', deviceType),
                fontWeight: '800',
                background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 25%, #e0e7ff 50%, #c7d2fe 75%, #a5b4fc 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '-0.03em',
                textShadow: '0 0 30px rgba(59, 130, 246, 0.3)',
                position: 'relative',
                margin: 0
              }}>
                NFT Verification
              </h1>
            </div>
            
            <p style={{
              color: '#c7d2fe',
              fontSize: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType),
              lineHeight: '1.5',
              maxWidth: getResponsiveValue('280px', '400px', '500px', deviceType),
              margin: '0 auto',
              fontWeight: '500',
              textShadow: '0 0 20px rgba(167, 180, 252, 0.3)'
            }}>
              Connect your wallet and verify NFT ownership to receive Discord roles.
            </p>
          </div>

          {/* Wallet Connection */}
          <div style={{ marginBottom: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType) }}>
            <WalletConnection />
          </div>

          {/* Collection Selection */}
          <div style={{ marginBottom: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType) }}>
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

    </div>
    
    {/* CSS Animations */}
    <style>{`
      @keyframes gradientShift {
        0%, 100% { 
          transform: translateX(0) translateY(0) scale(1) rotate(0deg);
          opacity: 0.6;
        }
        25% { 
          transform: translateX(20px) translateY(-15px) scale(1.05) rotate(2deg);
          opacity: 0.4;
        }
        50% { 
          transform: translateX(-15px) translateY(20px) scale(0.95) rotate(-1deg);
          opacity: 0.3;
        }
        75% { 
          transform: translateX(10px) translateY(-10px) scale(1.02) rotate(1deg);
          opacity: 0.5;
        }
      }
      
      @keyframes floatParticle {
        0%, 100% { 
          transform: translateY(0) translateX(0) scale(1);
          opacity: 0.3;
        }
        25% { 
          transform: translateY(-30px) translateX(15px) scale(1.2);
          opacity: 0.8;
        }
        50% { 
          transform: translateY(-60px) translateX(-10px) scale(0.8);
          opacity: 0.6;
        }
        75% { 
          transform: translateY(-40px) translateX(20px) scale(1.1);
          opacity: 0.9;
        }
      }
    `}</style>
      </>
    );
  } catch (error) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          background: 'rgba(31, 41, 55, 0.8)',
          borderRadius: '20px',
          border: '1px solid rgba(55, 65, 81, 0.4)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.4)'
        }}>
          <h1 style={{ marginBottom: '1rem', color: '#f9fafb', fontWeight: '700' }}>NFT Verification</h1>
          <p style={{ marginBottom: '1rem', color: '#d1d5db' }}>Loading verification system...</p>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
            If this message persists, please refresh the page.
          </p>
        </div>
      </div>
    );
  }
};
