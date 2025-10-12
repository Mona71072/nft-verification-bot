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

export const NFTVerification: React.FC = () => {
  useWalletWithErrorHandling();
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [copied, setCopied] = useState(false);
  const [discordId, setDiscordId] = useState('');
  
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
