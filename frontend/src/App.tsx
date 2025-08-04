import { ConnectButton, useWallet } from '@suiet/wallet-kit';
import '@suiet/wallet-kit/style.css';
import { useState, useEffect } from 'react';

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
            SXT NFT Verification Portal
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
      </div>
    </div>
  );
}

// AdminPageコンポーネント
function AdminPage() {
  const { account, connected } = useWallet();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminAddresses, setAdminAddresses] = useState<string[]>([]);
  const [collections, setCollections] = useState<NFTCollection[]>([]);

  // 管理者チェック
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (connected && account?.address) {
        try {
          console.log('🔄 Checking admin status...');
          const response = await fetch(`${API_BASE_URL}/api/admin/check/${account.address}`);
          const data = await response.json();
          if (data.success) {
            setIsAdmin(data.isAdmin);
            console.log(`✅ Admin status: ${data.isAdmin}`);
          }
        } catch (error) {
          console.error('❌ Failed to check admin status:', error);
        }
      }
    };
    
    checkAdminStatus();
  }, [connected, account?.address]);

  // 管理者アドレス取得
  useEffect(() => {
    const fetchAdminAddresses = async () => {
      try {
        console.log('🔄 Fetching admin addresses...');
        const response = await fetch(`${API_BASE_URL}/api/admin/addresses`);
        const data = await response.json();
        if (data.success) {
          setAdminAddresses(data.data);
          console.log(`✅ Loaded ${data.data.length} admin addresses`);
        }
      } catch (error) {
        console.error('❌ Failed to fetch admin addresses:', error);
      }
    };
    
    fetchAdminAddresses();
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

  // 管理者アドレス管理
  const handleAddAdminAddress = async (address: string) => {
    try {
      const newAddresses = [...adminAddresses, address];
      const response = await fetch(`${API_BASE_URL}/api/admin/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: newAddresses })
      });
      const data = await response.json();
      if (data.success) {
        setAdminAddresses(newAddresses);
        console.log('✅ Admin address added successfully');
      }
    } catch (error) {
      console.error('❌ Failed to add admin address:', error);
    }
  };

  const handleRemoveAdminAddress = async (address: string) => {
    try {
      const newAddresses = adminAddresses.filter(addr => addr !== address);
      const response = await fetch(`${API_BASE_URL}/api/admin/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: newAddresses })
      });
      const data = await response.json();
      if (data.success) {
        setAdminAddresses(newAddresses);
        console.log('✅ Admin address removed successfully');
      }
    } catch (error) {
      console.error('❌ Failed to remove admin address:', error);
    }
  };

  // コレクション管理関連のハンドラー
  const handleAddCollection = async (newCollection: Omit<NFTCollection, 'id' | 'isActive' | 'createdAt'>) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCollection)
      });
      const data = await response.json();
      if (data.success) {
        setCollections(prev => [...prev, data.data]);
        console.log('✅ Collection added successfully');
      } else {
        console.error('❌ Failed to add collection:', data.error);
      }
    } catch (error) {
      console.error('❌ Failed to add collection:', error);
    }
  };

  const handleEditCollection = async (collection: NFTCollection) => {
    const updatedCollection = {
      ...collection,
      name: prompt('コレクション名を変更:', collection.name) || collection.name,
      packageId: prompt('Package IDを変更:', collection.packageId) || collection.packageId,
      roleId: prompt('Discord Role IDを変更:', collection.roleId) || collection.roleId,
      roleName: prompt('Discord Role Nameを変更:', collection.roleName) || collection.roleName,
      description: prompt('説明を変更:', collection.description) || collection.description
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/collections/${collection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCollection)
      });
      const data = await response.json();
      if (data.success) {
        setCollections(prev => prev.map(col => col.id === collection.id ? data.data : col));
        console.log('✅ Collection updated successfully');
      } else {
        console.error('❌ Failed to update collection:', data.error);
      }
    } catch (error) {
      console.error('❌ Failed to update collection:', error);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm('このコレクションを削除しますか？')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/collections/${collectionId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setCollections(prev => prev.filter(col => col.id !== collectionId));
        console.log('✅ Collection deleted successfully');
      } else {
        console.error('❌ Failed to delete collection:', data.error);
      }
    } catch (error) {
      console.error('❌ Failed to delete collection:', error);
    }
  };

  if (!connected) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center'
      }}>
        <h2 style={{ color: 'white', marginBottom: '1rem' }}>管理者パネル</h2>
        <p style={{ color: 'white', marginBottom: '2rem' }}>ウォレットを接続してください</p>
        <ConnectButton />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center'
      }}>
        <h2 style={{ color: 'white', marginBottom: '1rem' }}>アクセス拒否</h2>
        <p style={{ color: 'white', marginBottom: '2rem' }}>
          このアドレスには管理者権限がありません。<br />
          管理者権限を持つアドレスでウォレットを接続してください。
        </p>
        <div style={{ 
          padding: '1rem', 
          background: 'rgba(255, 255, 255, 0.1)', 
          borderRadius: '8px',
          color: 'white',
          fontSize: '0.875rem'
        }}>
          現在のアドレス: {account?.address}
        </div>
      </div>
    );
  }

  return (
    <div style={{ color: 'white' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', textAlign: 'center' }}>
        管理者パネル
      </h1>
      
      <div style={{ 
        display: 'grid', 
        gap: '2rem', 
        gridTemplateColumns: '1fr 1fr',
        maxWidth: '1000px',
        margin: '0 auto'
      }}>
        {/* 管理者アドレス管理 */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.1)', 
          padding: '1.5rem', 
          borderRadius: '12px',
          backdropFilter: 'blur(10px)'
        }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>管理者アドレス管理</h2>
          
          <div style={{ marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="新しい管理者アドレス"
              id="newAdminAddress"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                marginBottom: '0.5rem'
              }}
            />
            <button
              onClick={() => {
                const input = document.getElementById('newAdminAddress') as HTMLInputElement;
                if (input && input.value.trim()) {
                  handleAddAdminAddress(input.value.trim());
                  input.value = '';
                }
              }}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}
            >
              追加
            </button>
          </div>
          
          <div>
            <h3 style={{ fontWeight: '500', marginBottom: '0.5rem' }}>現在の管理者</h3>
            {adminAddresses.map((address, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '8px',
                marginBottom: '0.5rem'
              }}>
                <span style={{ fontSize: '0.875rem', fontFamily: 'monospace' }}>{address}</span>
                <button
                  onClick={() => handleRemoveAdminAddress(address)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.75rem'
                  }}
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* コレクション管理 */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.1)', 
          padding: '1.5rem', 
          borderRadius: '12px',
          backdropFilter: 'blur(10px)'
        }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1rem' }}>コレクション管理</h2>
          
          {/* 新しいコレクション追加 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontWeight: '500', marginBottom: '0.5rem' }}>新しいコレクション追加</h3>
            <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr' }}>
              <input
                type="text"
                placeholder="コレクション名"
                id="collectionName"
                style={{
                  padding: '0.5rem',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white'
                }}
              />
              <input
                type="text"
                placeholder="Package ID"
                id="packageId"
                style={{
                  padding: '0.5rem',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white'
                }}
              />
              <input
                type="text"
                placeholder="Discord Role ID"
                id="roleId"
                style={{
                  padding: '0.5rem',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white'
                }}
              />
              <input
                type="text"
                placeholder="Discord Role Name"
                id="roleName"
                style={{
                  padding: '0.5rem',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white'
                }}
              />
              <input
                type="text"
                placeholder="説明"
                id="description"
                style={{
                  padding: '0.5rem',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '6px',
                  fontSize: '0.875rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  gridColumn: '1 / -1'
                }}
              />
            </div>
            <button
              onClick={() => {
                const name = (document.getElementById('collectionName') as HTMLInputElement)?.value;
                const packageId = (document.getElementById('packageId') as HTMLInputElement)?.value;
                const roleId = (document.getElementById('roleId') as HTMLInputElement)?.value;
                const roleName = (document.getElementById('roleName') as HTMLInputElement)?.value;
                const description = (document.getElementById('description') as HTMLInputElement)?.value;
                
                if (name && packageId && roleId && roleName) {
                  handleAddCollection({ name, packageId, roleId, roleName, description });
                  // 入力フィールドをクリア
                  ['collectionName', 'packageId', 'roleId', 'roleName', 'description'].forEach(id => {
                    const element = document.getElementById(id) as HTMLInputElement;
                    if (element) element.value = '';
                  });
                }
              }}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                marginTop: '0.5rem'
              }}
            >
              コレクション追加
            </button>
          </div>
          
          {/* コレクション一覧 */}
          <div>
            <h3 style={{ fontWeight: '500', marginBottom: '0.5rem' }}>コレクション一覧</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {collections.map(collection => (
                <div key={collection.id} style={{ 
                  padding: '0.75rem', 
                  background: 'rgba(255, 255, 255, 0.05)', 
                  borderRadius: '8px', 
                  marginBottom: '0.5rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h4 style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                        {collection.name}
                      </h4>
                      <p style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        Package: {collection.packageId}
                      </p>
                      <p style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        Role: {collection.roleName} (ID: {collection.roleId})
                      </p>
                      {collection.description && (
                        <p style={{ fontSize: '0.75rem' }}>
                          {collection.description}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button
                        onClick={() => handleEditCollection(collection)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem'
                        }}
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDeleteCollection(collection.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#ef4444',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.75rem'
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [currentPage, setCurrentPage] = useState<'verification' | 'admin'>('verification');

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* Navigation Bar */}
      <nav style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
        padding: '1rem 2rem',
        position: 'sticky',
        top: 0,
        zIndex: 1000
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <h1 style={{ 
              fontSize: '1.5rem', 
              fontWeight: '700', 
              color: '#1a1a1a',
              margin: 0
            }}>
              NFT Verification
            </h1>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setCurrentPage('verification')}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: currentPage === 'verification' ? '#3b82f6' : 'transparent',
                  color: currentPage === 'verification' ? 'white' : '#6b7280',
                  border: currentPage === 'verification' ? 'none' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
              >
                認証ページ
              </button>
              <button
                onClick={() => setCurrentPage('admin')}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: currentPage === 'admin' ? '#3b82f6' : 'transparent',
                  color: currentPage === 'admin' ? 'white' : '#6b7280',
                  border: currentPage === 'admin' ? 'none' : '1px solid #d1d5db',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
              >
                管理者パネル
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '2rem',
        minHeight: 'calc(100vh - 80px)'
      }}>
        {currentPage === 'verification' ? <NFTVerification /> : <AdminPage />}
      </div>
    </div>
  );
}

export default App;