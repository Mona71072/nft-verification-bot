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

export const NFTVerificationPage: React.FC = () => {
  useWalletWithErrorHandling();
  const [discordId, setDiscordId] = useState('');
  
  // エラーハンドリング付きでuseResponsiveフックを使用
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  let isMobile = false;
  
  try {
    const responsive = useResponsive();
    deviceType = responsive.deviceType;
    isMobile = responsive.isMobile;
  } catch (error) {
    console.error('useResponsive error:', error);
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
      <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(circle at 20% 20%, rgba(102, 126, 234, 0.8) 0%, transparent 50%),
        radial-gradient(circle at 80% 80%, rgba(118, 75, 162, 0.6) 0%, transparent 50%),
        radial-gradient(circle at 40% 60%, rgba(240, 147, 251, 0.4) 0%, transparent 50%),
        linear-gradient(135deg, #0f0f23 0%, #1a1a2e 25%, #16213e 50%, #0f3460 75%, #533483 100%)
      `,
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
          background: `
            linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%),
            linear-gradient(45deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)
          `,
          backdropFilter: 'blur(30px)',
          borderRadius: '32px',
          padding: getResponsiveValue('1.5rem', '2rem', '3rem', deviceType),
          maxWidth: getResponsiveValue('100%', '90%', '600px', deviceType),
          width: '100%',
          boxShadow: `
            0 40px 80px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.2)
          `,
          border: '1px solid rgba(255, 255, 255, 0.1)',
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
            {/* Modern Header with Tech Aesthetics */}
            <div style={{
              position: 'relative',
              marginBottom: getResponsiveValue('2rem', '2.5rem', '3rem', deviceType)
            }}>
              {/* Animated Tech Grid Background */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: getResponsiveValue('200px', '250px', '300px', deviceType),
                height: getResponsiveValue('200px', '250px', '300px', deviceType),
                background: `
                  linear-gradient(45deg, transparent 48%, rgba(102, 126, 234, 0.1) 49%, rgba(102, 126, 234, 0.1) 51%, transparent 52%),
                  linear-gradient(-45deg, transparent 48%, rgba(118, 75, 162, 0.1) 49%, rgba(118, 75, 162, 0.1) 51%, transparent 52%)
                `,
                backgroundSize: '20px 20px',
                animation: 'techGrid 20s linear infinite',
                opacity: 0.6,
                zIndex: 0
              }} />
              
              {/* Central Tech Circle */}
              <div style={{
                position: 'relative',
                width: getResponsiveValue('120px', '140px', '160px', deviceType),
                height: getResponsiveValue('120px', '140px', '160px', deviceType),
                margin: '0 auto',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                borderRadius: '50%',
                border: '2px solid rgba(102, 126, 234, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
                overflow: 'hidden'
              }}>
                {/* Inner Tech Pattern */}
                <div style={{
                  width: '80%',
                  height: '80%',
                  background: 'linear-gradient(45deg, transparent 30%, rgba(102, 126, 234, 0.2) 50%, transparent 70%)',
                  borderRadius: '50%',
                  position: 'relative',
                  animation: 'techPulse 3s ease-in-out infinite'
                }}>
                  {/* Central Dot */}
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '8px',
                    height: '8px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '50%',
                    boxShadow: '0 0 20px rgba(102, 126, 234, 0.6)'
                  }} />
                </div>
              </div>
            </div>

            <h1 style={{
              fontSize: getResponsiveValue('1.75rem', '2rem', '2.5rem', deviceType),
              fontWeight: '900',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              marginBottom: '1rem',
              letterSpacing: '-0.03em',
              textShadow: '0 0 30px rgba(102, 126, 234, 0.3)',
              position: 'relative'
            }}>
              NFT Verification Portal
            </h1>
            
            <div style={{
              position: 'relative',
              marginBottom: '1rem'
            }}>
              <div style={{
                display: 'inline-block',
                padding: getResponsiveValue('0.5rem 1rem', '0.625rem 1.25rem', '0.75rem 1.5rem', deviceType),
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                border: '1px solid rgba(102, 126, 234, 0.2)',
                borderRadius: '50px',
                fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
                fontWeight: '600',
                color: '#667eea',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 4px 20px rgba(102, 126, 234, 0.1)'
              }}>
                Advanced Blockchain Technology
              </div>
            </div>
            
            <p style={{
              color: '#64748b',
              fontSize: getResponsiveValue('0.875rem', '1rem', '1.125rem', deviceType),
              lineHeight: '1.6',
              maxWidth: '500px',
              margin: '0 auto',
              fontWeight: '500'
            }}>
              Verify your NFT collection ownership and automatically receive your Discord role with cutting-edge blockchain verification technology.
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
        
        @keyframes techGrid {
          0% { transform: translate(-50%, -50%) rotate(0deg); }
          100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        
        @keyframes techPulse {
          0%, 100% { 
            transform: scale(1);
            opacity: 0.8;
          }
          50% { 
            transform: scale(1.1);
            opacity: 1;
          }
        }
        
        @keyframes techGlow {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(102, 126, 234, 0.6);
          }
          50% { 
            box-shadow: 0 0 40px rgba(102, 126, 234, 0.8), 0 0 60px rgba(118, 75, 162, 0.4);
          }
        }
      `}</style>
    </div>
  );
  } catch (error) {
    console.error('NFTVerificationPage render error:', error);
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '16px',
          backdropFilter: 'blur(10px)'
        }}>
          <h1 style={{ marginBottom: '1rem' }}>NFT Verification Portal</h1>
          <p style={{ marginBottom: '1rem' }}>Loading verification system...</p>
          <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>
            If this message persists, please refresh the page.
          </p>
        </div>
      </div>
    );
  }
};
