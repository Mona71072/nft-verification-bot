import { ConnectButton, useWallet } from '@suiet/wallet-kit';
import '@suiet/wallet-kit/style.css';
import { useState, useEffect } from 'react';
import AdminPanel from './AdminPanel';

// NFTコレクション型定義
interface NFTCollection {
  id: string;
  name: string;
  packageId: string;
  roleId: string;
  roleName: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

// APIベースURLの設定（本番環境用）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

function NFTVerification() {
  const { account, connected, signPersonalMessage } = useWallet();
  const [discordId, setDiscordId] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  
  // コレクション選択機能を追加
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [checkAllCollections, setCheckAllCollections] = useState<boolean>(true);

  // URLパラメータからDiscord IDを自動取得
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const discordIdFromUrl = urlParams.get('discord_id');
    if (discordIdFromUrl) {
      setDiscordId(discordIdFromUrl);
      console.log('Discord ID from URL:', discordIdFromUrl);
    }
  }, []);

  // コレクション取得
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        console.log('🔄 Fetching collections from API...');
        const response = await fetch(`${API_BASE_URL}/api/collections`);
        const data = await response.json();
        if (data.success) {
          setCollections(data.data);
          // デフォルトですべてのコレクションを選択
          setSelectedCollections(data.data.map((col: NFTCollection) => col.id));
          console.log(`✅ Loaded ${data.data.length} collections`);
        } else {
          console.log('⚠️ No collections found, using default');
        }
      } catch (error) {
        console.error('❌ Failed to fetch collections:', error);
        console.log('⚠️ Using default collection configuration');
      }
    };
    
    fetchCollections();
  }, []);

  // すべてのコレクション選択/解除
  const handleCheckAllCollections = (checked: boolean) => {
    setCheckAllCollections(checked);
    if (checked) {
      setSelectedCollections(collections.map(col => col.id));
    } else {
      setSelectedCollections([]);
    }
  };

  // 個別コレクション選択/解除
  const handleCollectionToggle = (collectionId: string) => {
    setSelectedCollections(prev => {
      if (prev.includes(collectionId)) {
        const newSelection = prev.filter(id => id !== collectionId);
        setCheckAllCollections(newSelection.length === collections.length);
        return newSelection;
      } else {
        const newSelection = [...prev, collectionId];
        setCheckAllCollections(newSelection.length === collections.length);
        return newSelection;
      }
    });
  };

  // URLパラメータからDiscord IDが取得されたかどうかを判定
  const isDiscordIdFromUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('discord_id') !== null;
  };

  const handleVerifyNFT = async () => {
    if (!connected || !account) {
      setVerificationResult({
        success: false,
        message: 'ウォレットが接続されていません。ウォレットを接続してください。'
      });
      return;
    }

    // 署名機能をチェック
    if (!signPersonalMessage) {
      setVerificationResult({
        success: false,
        message: 'ウォレットが署名機能をサポートしていません。対応ウォレットを使用してください。'
      });
      return;
    }

    console.log('Wallet connected:', account.address);
    console.log('SignPersonalMessage available:', !!signPersonalMessage);

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
      console.log('Requesting nonce...');
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
      console.log('Nonce received:', nonce);

      // 2. 署名メッセージの生成
      const authMessage = `Sign in to SXT NFT Verification at ${new Date().toISOString()}`;
      console.log('Auth message:', authMessage);

      // 3. メッセージを署名
      console.log('Requesting signature...');
      const signatureResult = await signPersonalMessage({
        message: new TextEncoder().encode(authMessage)
      });

      console.log('Signature result:', signatureResult);

      // 4. バックエンドに送信
      const requestBody = {
        signature: signatureResult.signature,
        address: account.address,
        discordId: discordId.trim(),
        nonce: nonce,
        authMessage: authMessage,
        walletType: 'Generic',
        collectionIds: selectedCollections // 選択されたコレクションIDを追加
      };

      console.log('Sending verification request:', requestBody);

      const response = await fetch(`${API_BASE_URL}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log('Verification response:', data);

      if (data.success) {
        setVerificationResult({
          success: true,
          message: `認証が完了しました！ロール "${data.data?.roleName || 'NFT Holder'}" がアカウントに割り当てられました。`
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

        {/* Wallet Connection */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: '600', color: '#1a1a1a', marginBottom: '0.5rem' }}>ウォレット接続</h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>Suiウォレットを接続してNFT所有権を確認</p>
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

        {/* Discord ID Input */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: '600', color: '#1a1a1a', marginBottom: '0.5rem' }}>Discord ID入力</h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              {isDiscordIdFromUrl() 
                ? 'エクスクルーシブなロールを受け取るDiscord ID（自動取得済み・変更不可）'
                : 'エクスクルーシブなロールを受け取るDiscord IDを入力'
              }
            </p>
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

        {/* Collection Selection */}
        {collections.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: '600', color: '#1a1a1a', marginBottom: '0.5rem' }}>NFTコレクション選択</h3>
              <p style={{ fontSize: '0.875rem', color: '#666' }}>
                認証したいNFTコレクションを選択してください
              </p>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', color: '#666', marginRight: '0.5rem' }}>
                すべて選択
              </label>
              <input
                type="checkbox"
                checked={checkAllCollections}
                onChange={(e) => handleCheckAllCollections(e.target.checked)}
                style={{ marginRight: '0.5rem' }}
              />
            </div>
            {collections.map(collection => (
              <div key={collection.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={selectedCollections.includes(collection.id)}
                  onChange={() => handleCollectionToggle(collection.id)}
                  style={{ marginRight: '0.5rem' }}
                />
                <label style={{ fontSize: '0.875rem', color: '#1a1a1a' }}>
                  {collection.name} - {collection.roleName}
                </label>
              </div>
            ))}
            {selectedCollections.length > 0 && (
              <div style={{
                marginTop: '0.5rem',
                padding: '0.5rem',
                background: '#f9fafb',
                borderRadius: '4px',
                fontSize: '0.75rem',
                color: '#666'
              }}>
                選択中: {selectedCollections.map(id => collections.find(c => c.id === id)?.name).join(', ')}
              </div>
            )}
          </div>
        )}

        {/* Verification */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: '600', color: '#1a1a1a', marginBottom: '0.5rem' }}>NFT所有権確認</h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>メッセージに署名してNFT所有権を安全に確認</p>
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
            <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.7 }}>
              認証結果はDiscordチャンネルに通知されました
            </p>
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
  const [currentPage, setCurrentPage] = useState<'verification' | 'admin'>('verification');

  return (
    <div>
      {/* Navigation */}
      <div style={{
        position: 'fixed',
        top: '1rem',
        right: '1rem',
        zIndex: 1000,
        display: 'flex',
        gap: '0.5rem'
      }}>
        <button
          onClick={() => setCurrentPage('verification')}
          style={{
            padding: '0.5rem 1rem',
            background: currentPage === 'verification' ? '#007bff' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          認証ページ
        </button>
        <button
          onClick={() => setCurrentPage('admin')}
          style={{
            padding: '0.5rem 1rem',
            background: currentPage === 'admin' ? '#007bff' : '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          管理者パネル
        </button>
      </div>

      {/* Content */}
      {currentPage === 'verification' ? <NFTVerification /> : <AdminPanel />}
    </div>
  );
}

export default App;