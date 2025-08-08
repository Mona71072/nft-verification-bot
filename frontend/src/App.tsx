import { ConnectButton, useWallet } from '@suiet/wallet-kit';
import '@suiet/wallet-kit/style.css';
import { useState, useEffect } from 'react';

// ウォレットエラーハンドリング用のカスタムフック
const useWalletWithErrorHandling = () => {
  try {
    return useWallet();
  } catch (error) {
    console.error('Wallet hook error:', error);
    return {
      account: null,
      connected: false,
      signPersonalMessage: null,
      connecting: false,
      select: () => {},
      disconnect: () => {},
      wallets: []
    };
  }
};

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

interface VerifiedUser {
  discordId: string;
  address: string;
  collectionId: string;
  roleId: string;
  roleName: string;
  verifiedAt: string;
  lastChecked: string;
}

// APIベースURLの設定（本番環境用）
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

function NFTVerification() {
  const { account, connected, signPersonalMessage } = useWalletWithErrorHandling();
  const [showFullAddress, setShowFullAddress] = useState(false);
  const [copied, setCopied] = useState(false);
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

  // 認証済みユーザーかどうかをチェックする関数
  const checkIfUserIsVerified = async (discordId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/verified-users`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return data.data.some((user: VerifiedUser) => user.discordId === discordId);
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking verified user status:', error);
      return false;
    }
  };

  // URLパラメータからDiscord IDを自動取得
  useEffect(() => {
    try {
      console.log('🔍 Checking URL for Discord ID parameter...');
      console.log('🔍 Current URL:', window.location.href);
      console.log('🔍 Search params:', window.location.search);
      
      const urlParams = new URLSearchParams(window.location.search);
      
      // 複数の可能なパラメータ名を試す（user_idを優先）
      const possibleParams = ['user_id', 'discord_id', 'userId', 'discordId', 'id'];
      let discordIdFromUrl = null;
      let paramUsed = null;
      
      for (const param of possibleParams) {
        const value = urlParams.get(param);
        if (value) {
          discordIdFromUrl = value;
          paramUsed = param;
          break;
        }
      }
      
      console.log('🔍 All URL params:', Object.fromEntries(urlParams.entries()));
      console.log('🔍 Discord ID from URL:', discordIdFromUrl);
      console.log('🔍 Parameter used:', paramUsed);
      
      if (discordIdFromUrl) {
        setDiscordId(discordIdFromUrl);
        console.log('✅ Discord ID set from URL:', discordIdFromUrl, 'via parameter:', paramUsed);
      } else {
        console.log('⚠️ No Discord ID parameter found in URL');
        console.log('⚠️ Checked parameters:', possibleParams);
      }
    } catch (error) {
      console.error('Error parsing URL parameters:', error);
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

      // 2. 署名メッセージの生成（サーバー側と合致する安全なフォーマット）
      const timestamp = new Date().toISOString();
      const authMessage = `SXT NFT Verification\naddress=${account.address}\ndiscordId=${discordId.trim()}\nnonce=${nonce}\ntimestamp=${timestamp}`;
      console.log('Auth message:', authMessage);

      // 3. メッセージを署名
      console.log('Requesting signature...');
      if (!signPersonalMessage) {
        throw new Error('署名機能が利用できません。ウォレットが署名をサポートしているか確認してください。');
      }
      
      const messageBytes = new TextEncoder().encode(authMessage);
      const signatureResult = await signPersonalMessage({
        message: messageBytes
      }).catch(error => {
        console.error('Signature error:', error);
        throw new Error('署名に失敗しました。ウォレットで署名を承認してください。');
      });

      console.log('Signature result:', signatureResult);

      // 4. バックエンドに送信
      const requestBody = {
        signature: signatureResult.signature,
        bytes: signatureResult.bytes || messageBytes, // Suietが返すbytesを優先
        publicKey: (signatureResult as any)?.publicKey ?? (account as any)?.publicKey, // Ed25519 検証用（存在すれば送信）
        address: account.address,
        discordId: discordId.trim(),
        nonce: nonce,
        authMessage: authMessage,
        walletType: 'Generic',
        collectionIds: selectedCollections
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
        // 認証済みユーザーかどうかをチェック
        const isAlreadyVerified = await checkIfUserIsVerified(discordId);
        
        if (isAlreadyVerified) {
          setVerificationResult({
            success: true,
            message: `認証の更新が完了しました！ロール "${data.data?.roleName || 'NFT Holder'}" が更新されました。`
          });
        } else {
          setVerificationResult({
            success: true,
            message: `認証が完了しました！ロール "${data.data?.roleName || 'NFT Holder'}" がアカウントに割り当てられました。`
          });
        }
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
          {(() => {
            try {
              return <ConnectButton />;
            } catch (error) {
              console.error('ConnectButton error:', error);
              return (
                <div style={{
                  padding: '1rem',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#dc2626',
                  fontSize: '0.875rem'
                }}>
                  ウォレット接続エラーが発生しました。ページを再読み込みしてください。
                </div>
              );
            }
          })()}
          {connected && account && (
            <div style={{
              marginTop: '1rem',
              padding: '0.75rem',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: '0.875rem', color: '#666' }}>接続済み:</span>
                <span
                  title={account.address}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {showFullAddress
                    ? account.address
                    : `${account.address.slice(0, 6)}...${account.address.slice(-4)}`}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(account.address);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      } catch {}
                    }}
                    style={{
                      padding: '0.25rem 0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      background: '#fff',
                      color: '#374151',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    {copied ? 'コピー済み' : 'コピー'}
                  </button>
                  <button
                    onClick={() => setShowFullAddress(v => !v)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      background: '#fff',
                      color: '#374151',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    {showFullAddress ? '省略表示' : '全表示'}
                  </button>
                </div>
              </div>
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
  const { account, connected, signPersonalMessage } = useWalletWithErrorHandling();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    try { return localStorage.getItem('SXT_ADMIN_TOKEN'); } catch { return null; }
  });
  const [needsAdminAuth, setNeedsAdminAuth] = useState<boolean>(false);
  const [adminAddresses, setAdminAddresses] = useState<string[]>([]);
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [verifiedUsers, setVerifiedUsers] = useState<VerifiedUser[]>([]);
  const [batchProcessing, setBatchProcessing] = useState<boolean>(false);
  const [discordRoles, setDiscordRoles] = useState<Array<{id: string, name: string}>>([]);
  const [loadingRoles, setLoadingRoles] = useState<boolean>(false);

  // discordRolesの状態をログ出力（デバッグ用）
  useEffect(() => {
    console.log('🔍 Discord roles state updated:', discordRoles);
    console.log('🔍 Loading roles state:', loadingRoles);
  }, [discordRoles, loadingRoles]);

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

  // 管理者ログイン（署名）
  const handleAdminLogin = async () => {
    try {
      if (!connected || !account?.address || !signPersonalMessage) {
        alert('ウォレット接続と署名が必要です。');
        return;
      }
      // 1) ナンス取得
      const nonceResp = await fetch(`${API_BASE_URL}/api/admin/login-nonce`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: account.address })
      });
      const nonceJson = await nonceResp.json();
      if (!nonceJson.success) { alert(nonceJson.error || 'ナンス取得に失敗しました'); return; }
      const nonce = nonceJson.data.nonce;
      const timestamp = new Date().toISOString();
      const authMessage = `SXT Admin Login\naddress=${account.address}\nnonce=${nonce}\ntimestamp=${timestamp}`;
      const bytes = new TextEncoder().encode(authMessage);
      // 2) 署名
      const sig = await signPersonalMessage({ message: bytes });
      // 3) 検証 → トークン
      const verifyResp = await fetch(`${API_BASE_URL}/api/admin/login-verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: account.address,
          signature: sig.signature,
          bytes: sig.bytes || bytes,
          publicKey: (sig as any)?.publicKey,
          authMessage,
          nonce
        })
      });
      const verifyJson = await verifyResp.json();
      if (!verifyJson.success) { alert(verifyJson.error || '管理者ログインに失敗しました'); return; }
      setAdminToken(verifyJson.data.token);
      try { localStorage.setItem('SXT_ADMIN_TOKEN', verifyJson.data.token); } catch {}
      alert('管理者としてログインしました。');
      setNeedsAdminAuth(false);
      // 直後に認証済みユーザーをフェッチ
      try {
        const usersResponse = await fetch(`${API_BASE_URL}/api/admin/verified-users`, {
          headers: { 'Authorization': `Bearer ${verifyJson.data.token}` }
        });
        if (usersResponse.ok) {
          const usersData = await usersResponse.json();
          if (usersData.success) setVerifiedUsers(usersData.data);
        }
      } catch {}
    } catch (e) {
      alert('管理者ログイン中にエラーが発生しました。');
    }
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    try { localStorage.removeItem('SXT_ADMIN_TOKEN'); } catch {}
  };

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

  // Discordロール取得
  useEffect(() => {
    const fetchDiscordRoles = async () => {
      try {
        setLoadingRoles(true);
        console.log('🔄 Fetching Discord roles...');
        console.log('🔗 API URL:', `${API_BASE_URL}/api/discord/roles`);
        
        const response = await fetch(`${API_BASE_URL}/api/discord/roles`);
        console.log('📥 Discord roles API response status:', response.status);
        
        const data = await response.json();
        console.log('📥 Discord roles API response data:', data);
        
        if (data.success) {
          setDiscordRoles(data.data || []);
          console.log(`✅ Loaded ${(data.data || []).length} Discord roles:`, data.data);
          
          if (data.warning) {
            console.log('⚠️ API Warning:', data.warning);
          }
        } else {
          console.log('⚠️ Discord roles API returned success: false');
          console.log('⚠️ Error:', data.error);
          setDiscordRoles([]);
        }
      } catch (error) {
        console.error('❌ Failed to fetch Discord roles:', error);
        setDiscordRoles([]);
      } finally {
        setLoadingRoles(false);
      }
    };
    
    fetchDiscordRoles();
  }, []);

  // 認証済みユーザー取得
  useEffect(() => {
    const fetchVerifiedUsers = async () => {
      try {
        console.log('🔄 Fetching verified users...');
        const response = await fetch(`${API_BASE_URL}/api/admin/verified-users`, {
          headers: adminToken ? { 'Authorization': `Bearer ${adminToken}` } : undefined
        });
        if (response.status === 401) {
          setNeedsAdminAuth(true);
          setVerifiedUsers([]);
          return;
        }
        const data = await response.json();
        if (data.success) {
          setVerifiedUsers(data.data);
          console.log(`✅ Loaded ${data.data.length} verified users`);
        }
      } catch (error) {
        console.error('❌ Failed to fetch verified users:', error);
      }
    };
    
    if (isAdmin) {
      fetchVerifiedUsers();
    }
  }, [isAdmin]);

  // 管理者アドレス管理
  const handleAddAdminAddress = async (address: string) => {
    try {
      if (!address || !address.trim()) {
        alert('有効なアドレスを入力してください。');
        return;
      }
      
      // 既に存在するかチェック
      if (adminAddresses.some(addr => addr.toLowerCase() === address.toLowerCase())) {
        alert('このアドレスは既に管理者として登録されています。');
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/admin/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: address.trim() })
      });
      const data = await response.json();
      if (data.success) {
        setAdminAddresses(data.data);
        console.log('✅ Admin address added successfully');
      } else {
        console.error('❌ Failed to add admin address:', data.error);
        alert(`管理者アドレスの追加に失敗しました: ${data.error}`);
      }
    } catch (error) {
      console.error('❌ Failed to add admin address:', error);
      alert('管理者アドレスの追加に失敗しました。');
    }
  };

  const handleRemoveAdminAddress = async (address: string) => {
    try {
      console.log(`🗑️ Removing admin address: ${address}`);
      
      if (adminAddresses.length <= 1) {
        alert('管理者アドレスを全て削除することはできません。最低1つの管理者アドレスが必要です。');
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/admin/addresses/${encodeURIComponent(address)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        setAdminAddresses(data.data);
        console.log('✅ Admin address removed successfully');
      } else {
        console.error('❌ Failed to remove admin address:', data.error);
        alert(`管理者アドレスの削除に失敗しました: ${data.error}`);
      }
    } catch (error) {
      console.error('❌ Failed to remove admin address:', error);
      alert('管理者アドレスの削除に失敗しました。');
    }
  };

  // コレクション管理関連のハンドラー
  const [showAddCollectionForm, setShowAddCollectionForm] = useState<boolean>(false);
  const [newCollection, setNewCollection] = useState({
    name: '',
    packageId: '',
    roleId: '',
    roleName: '',
    description: ''
  });

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

  const [editingCollection, setEditingCollection] = useState<NFTCollection | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    packageId: '',
    roleId: '',
    roleName: '',
    description: ''
  });

  const handleEditCollection = async (collection: NFTCollection) => {
    setEditingCollection(collection);
    setEditForm({
      name: collection.name,
      packageId: collection.packageId,
      roleId: collection.roleId,
      roleName: collection.roleName,
      description: collection.description
    });
  };

  const handleSaveEdit = async () => {
    if (!editingCollection) return;

    const updatedCollection = {
      ...editingCollection,
      name: editForm.name,
      packageId: editForm.packageId,
      roleId: editForm.roleId,
      roleName: editForm.roleName,
      description: editForm.description
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/collections/${editingCollection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCollection)
      });
      const data = await response.json();
      if (data.success) {
        setCollections(prev => prev.map(col => col.id === editingCollection.id ? data.data : col));
        console.log('✅ Collection updated successfully');
        setEditingCollection(null);
        setEditForm({ name: '', packageId: '', roleId: '', roleName: '', description: '' });
      } else {
        console.error('❌ Failed to update collection:', data.error);
        alert('コレクションの更新に失敗しました。');
      }
    } catch (error) {
      console.error('❌ Failed to update collection:', error);
      alert('コレクションの更新に失敗しました。');
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

  // バッチ処理実行
  const handleBatchCheck = async () => {
    if (!adminToken) {
      alert('バッチ実行には管理者ログインが必要です。先に「管理者ログイン」を実行してください。');
      setNeedsAdminAuth(true);
      return;
    }
    if (!confirm('バッチ処理を実行しますか？\n\nこの処理は時間がかかる場合があります。')) {
      return;
    }
    
    setBatchProcessing(true);
    try {
      console.log('🔄 Starting batch check...');
      const response = await fetch(`${API_BASE_URL}/api/admin/batch-check`, {
        method: 'POST',
        headers: adminToken ? { 'Authorization': `Bearer ${adminToken}` } : undefined
      });
      const data = await response.json();
      
      if (data.success) {
        const summary = data.summary;
        alert(`バッチ処理が完了しました！\n\n処理結果:\n• 総ユーザー数: ${summary.totalUsers}\n• 処理済み: ${summary.processed}\n• ロール剥奪: ${summary.revoked}\n• エラー: ${summary.errors}`);
        
        // 認証済みユーザー一覧を更新
        const usersResponse = await fetch(`${API_BASE_URL}/api/admin/verified-users`, {
          headers: adminToken ? { 'Authorization': `Bearer ${adminToken}` } : undefined
        });
        const usersData = await usersResponse.json();
        if (usersData.success) {
          setVerifiedUsers(usersData.data);
        }
      } else {
        alert('バッチ処理でエラーが発生しました: ' + data.error);
      }
    } catch (error) {
      console.error('❌ Batch check error:', error);
      alert('バッチ処理でエラーが発生しました');
    } finally {
      setBatchProcessing(false);
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
        {(() => {
          try {
            return <ConnectButton />;
          } catch (error) {
            console.error('ConnectButton error:', error);
            return (
              <div style={{
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: 'white',
                fontSize: '0.875rem'
              }}>
                ウォレット接続エラーが発生しました。ページを再読み込みしてください。
              </div>
            );
          }
        })()}
        <button
          onClick={handleAdminLogin}
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer'
          }}
        >
          管理者ログイン
        </button>
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
      {needsAdminAuth && (
        <div style={{
          background: '#FEF3C7',
          border: '1px solid #F59E0B',
          color: '#92400E',
          padding: '0.75rem',
          borderRadius: 8,
          margin: '0 0 1rem 0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>管理者の再ログインが必要です。トークンの有効期限が切れた可能性があります。</span>
          <button onClick={handleAdminLogin} style={{
            padding: '0.5rem 0.75rem',
            background: '#3B82F6',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer'
          }}>再ログイン</button>
        </div>
      )}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem', textAlign: 'center' }}>
        管理者パネル
      </h1>
      
      <div style={{ 
        display: 'grid', 
        gap: '2rem', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* 管理者アドレス管理 */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.1)', 
          padding: '2rem', 
          borderRadius: '16px',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          height: 'fit-content'
        }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1.5rem', fontSize: '1.25rem' }}>管理者アドレス管理</h2>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <input
              type="text"
              placeholder="新しい管理者アドレス"
              id="newAdminAddress"
              style={{
                width: '100%',
                padding: '1rem',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '12px',
                fontSize: '0.875rem',
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                marginBottom: '1rem',
                outline: 'none',
                transition: 'all 0.2s ease'
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
                padding: '0.875rem 1.5rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                width: '100%'
              }}
            >
              管理者を追加
            </button>
          </div>
          
          <div>
            <h3 style={{ fontWeight: '500', marginBottom: '1rem', fontSize: '1rem' }}>現在の管理者</h3>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {adminAddresses.map((address, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  marginBottom: '0.75rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  transition: 'all 0.2s ease'
                }}>
                  <span style={{ 
                    fontSize: '0.875rem', 
                    fontFamily: 'monospace',
                    color: 'rgba(255, 255, 255, 0.9)',
                    wordBreak: 'break-all'
                  }}>
                    {address}
                  </span>
                  <button
                    onClick={() => handleRemoveAdminAddress(address)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      transition: 'all 0.2s ease',
                      marginLeft: '1rem',
                      flexShrink: 0
                    }}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* コレクション管理 */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.1)', 
          padding: '2rem', 
          borderRadius: '16px',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          height: 'fit-content',
          gridColumn: 'span 2'
        }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1.5rem', fontSize: '1.25rem' }}>コレクション管理</h2>
          
          <div style={{ marginBottom: '1.5rem' }}>
            {!showAddCollectionForm ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontWeight: '500', marginBottom: '0.5rem', fontSize: '1rem' }}>新しいコレクションを追加</h3>
                  <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                    NFT認証に使用するコレクションを追加できます
                  </p>
                </div>
                <button
                  onClick={() => setShowAddCollectionForm(true)}
                  style={{
                    padding: '0.875rem 1.5rem',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.02)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  ➕ コレクションを追加
                </button>
              </div>
            ) : (
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontWeight: '600', fontSize: '1rem', color: 'white' }}>新しいコレクションを追加</h3>
                  <button
                    onClick={() => {
                      setShowAddCollectionForm(false);
                      setNewCollection({ name: '', packageId: '', roleId: '', roleName: '', description: '' });
                    }}
                    style={{
                      padding: '0.5rem',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      fontWeight: '600',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    ✕
                  </button>
                </div>
                
                <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr 1fr' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                      コレクション名 *
                    </label>
                    <input
                      type="text"
                      value={newCollection.name}
                      onChange={(e) => setNewCollection(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="例: Popkins NFT"
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '10px',
                        fontSize: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.target.style.border = '1px solid rgba(59, 130, 246, 0.5)';
                        e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                      Package ID *
                    </label>
                    <input
                      type="text"
                      value={newCollection.packageId}
                      onChange={(e) => setNewCollection(prev => ({ ...prev, packageId: e.target.value }))}
                      placeholder="例: 0xb908f3c6fea6865d32e2048c520cdfe3b5c5bbcebb658117c41bad70f52b7ccc::popkins_nft::Popkins"
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '10px',
                        fontSize: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.target.style.border = '1px solid rgba(59, 130, 246, 0.5)';
                        e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                      Discordロール *
                    </label>
                    <div style={{ position: 'relative' }}>
                      {loadingRoles ? (
                        <div style={{
                          width: '100%',
                          padding: '0.875rem',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                          borderRadius: '10px',
                          fontSize: '0.875rem',
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: 'rgba(255, 255, 255, 0.6)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255, 255, 255, 0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                          ロールを読み込み中...
                        </div>
                      ) : (
                        <select
                          value={newCollection.roleId}
                          onChange={(e) => {
                            console.log('🔄 Discord role selected:', e.target.value);
                            console.log('🔍 Available discord roles:', discordRoles);
                            const selectedRole = discordRoles.find(role => role.id === e.target.value);
                            console.log('🔍 Selected role object:', selectedRole);
                            setNewCollection(prev => ({
                              ...prev,
                              roleId: e.target.value,
                              roleName: selectedRole?.name || ''
                            }));
                          }}
                          style={{
                            width: '100%',
                            padding: '0.875rem',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '10px',
                            fontSize: '0.875rem',
                            background: 'rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            outline: 'none',
                            transition: 'all 0.2s ease',
                            boxSizing: 'border-box',
                            cursor: 'pointer'
                          }}
                          onFocus={(e) => {
                            e.target.style.border = '1px solid rgba(59, 130, 246, 0.5)';
                            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                          }}
                          onBlur={(e) => {
                            e.target.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                            e.target.style.boxShadow = 'none';
                          }}
                        >
                          <option value="">
                            {discordRoles.length === 0 
                              ? "Discordロールを取得中..." 
                              : "Discordロールを選択してください"}
                          </option>
                          {discordRoles.length === 0 && !loadingRoles && (
                            <option value="" disabled style={{ background: '#1f2937', color: '#ef4444' }}>
                              ロールが取得できませんでした
                            </option>
                          )}
                          {discordRoles.map((role) => (
                            <option key={role.id} value={role.id} style={{ background: '#1f2937', color: 'white' }}>
                              {role.name} (ID: {role.id})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                      説明（オプション）
                    </label>
                    <textarea
                      value={newCollection.description}
                      onChange={(e) => setNewCollection(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="コレクションの説明を入力してください"
                      rows={3}
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: '10px',
                        fontSize: '0.875rem',
                        background: 'rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        boxSizing: 'border-box'
                      }}
                      onFocus={(e) => {
                        e.target.style.border = '1px solid rgba(59, 130, 246, 0.5)';
                        e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                      }}
                      onBlur={(e) => {
                        e.target.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button
                    onClick={() => {
                      if (newCollection.name && newCollection.packageId && newCollection.roleId && newCollection.roleName) {
                        handleAddCollection(newCollection);
                        setShowAddCollectionForm(false);
                        setNewCollection({ name: '', packageId: '', roleId: '', roleName: '', description: '' });
                      } else {
                        alert('必須項目（コレクション名、Package ID、Discord Role ID、Discord Role Name）を入力してください。');
                      }
                    }}
                    style={{
                      padding: '0.875rem 1.5rem',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.02)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    ✅ コレクションを追加
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowAddCollectionForm(false);
                      setNewCollection({ name: '', packageId: '', roleId: '', roleName: '', description: '' });
                    }}
                    style={{
                      padding: '0.875rem 1.5rem',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            )}
          </div>
          
          <div>
            <h3 style={{ fontWeight: '500', marginBottom: '1rem', fontSize: '1rem' }}>現在のコレクション ({collections.length})</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {collections.length === 0 ? (
                <div style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '0.875rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  コレクションが登録されていません。<br />
                  上記の「コレクションを追加」ボタンから新しいコレクションを追加してください。
                </div>
              ) : (
                collections.map((collection) => (
                  <div key={collection.id} style={{
                    padding: '1.5rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    marginBottom: '1rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (editingCollection?.id !== collection.id) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (editingCollection?.id !== collection.id) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                  >
                    {editingCollection?.id === collection.id ? (
                      // 編集フォーム
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <h4 style={{ color: 'white', fontWeight: '600', fontSize: '1rem' }}>コレクションを編集</h4>
                          <button
                            onClick={() => {
                              setEditingCollection(null);
                              setEditForm({ name: '', packageId: '', roleId: '', roleName: '', description: '' });
                            }}
                            style={{
                              padding: '0.5rem',
                              background: 'rgba(255, 255, 255, 0.1)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '1.2rem',
                              fontWeight: '600',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            ✕
                          </button>
                        </div>
                        
                        <div style={{ display: 'grid', gap: '1.5rem', gridTemplateColumns: '1fr 1fr' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                              コレクション名 *
                            </label>
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                              style={{
                                width: '100%',
                                padding: '0.875rem',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                borderRadius: '10px',
                                fontSize: '0.875rem',
                                background: 'rgba(255, 255, 255, 0.1)',
                                color: 'white',
                                outline: 'none',
                                transition: 'all 0.2s ease',
                                boxSizing: 'border-box'
                              }}
                              onFocus={(e) => {
                                e.target.style.border = '1px solid rgba(59, 130, 246, 0.5)';
                                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                              }}
                              onBlur={(e) => {
                                e.target.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                                e.target.style.boxShadow = 'none';
                              }}
                            />
                          </div>
                          
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                              Package ID *
                            </label>
                            <input
                              type="text"
                              value={editForm.packageId}
                              onChange={(e) => setEditForm(prev => ({ ...prev, packageId: e.target.value }))}
                              style={{
                                width: '100%',
                                padding: '0.875rem',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                borderRadius: '10px',
                                fontSize: '0.875rem',
                                background: 'rgba(255, 255, 255, 0.1)',
                                color: 'white',
                                outline: 'none',
                                transition: 'all 0.2s ease',
                                boxSizing: 'border-box'
                              }}
                              onFocus={(e) => {
                                e.target.style.border = '1px solid rgba(59, 130, 246, 0.5)';
                                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                              }}
                              onBlur={(e) => {
                                e.target.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                                e.target.style.boxShadow = 'none';
                              }}
                            />
                          </div>
                          
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                              Discordロール *
                            </label>
                            <div style={{ position: 'relative' }}>
                              {loadingRoles ? (
                                <div style={{
                                  width: '100%',
                                  padding: '0.875rem',
                                  border: '1px solid rgba(255, 255, 255, 0.3)',
                                  borderRadius: '10px',
                                  fontSize: '0.875rem',
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  color: 'rgba(255, 255, 255, 0.6)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem'
                                }}>
                                  <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255, 255, 255, 0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                  ロールを読み込み中...
                                </div>
                              ) : (
                                <select
                                  value={editForm.roleId}
                                  onChange={(e) => {
                                    console.log('🔄 Edit form Discord role selected:', e.target.value);
                                    console.log('🔍 Available discord roles:', discordRoles);
                                    const selectedRole = discordRoles.find(role => role.id === e.target.value);
                                    console.log('🔍 Selected role object:', selectedRole);
                                    setEditForm(prev => ({
                                      ...prev,
                                      roleId: e.target.value,
                                      roleName: selectedRole?.name || ''
                                    }));
                                  }}
                                  style={{
                                    width: '100%',
                                    padding: '0.875rem',
                                    border: '1px solid rgba(255, 255, 255, 0.3)',
                                    borderRadius: '10px',
                                    fontSize: '0.875rem',
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    color: 'white',
                                    outline: 'none',
                                    transition: 'all 0.2s ease',
                                    boxSizing: 'border-box',
                                    cursor: 'pointer'
                                  }}
                                  onFocus={(e) => {
                                    e.target.style.border = '1px solid rgba(59, 130, 246, 0.5)';
                                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                                  }}
                                  onBlur={(e) => {
                                    e.target.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                                    e.target.style.boxShadow = 'none';
                                  }}
                                >
                                  <option value="">
                                    {discordRoles.length === 0 
                                      ? "Discordロールを取得中..." 
                                      : "Discordロールを選択してください"}
                                  </option>
                                  {discordRoles.length === 0 && !loadingRoles && (
                                    <option value="" disabled style={{ background: '#1f2937', color: '#ef4444' }}>
                                      ロールが取得できませんでした
                                    </option>
                                  )}
                                  {discordRoles.map((role) => (
                                    <option key={role.id} value={role.id} style={{ background: '#1f2937', color: 'white' }}>
                                      {role.name} (ID: {role.id})
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          </div>
                          
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.9)', fontWeight: '500' }}>
                              説明（オプション）
                            </label>
                            <textarea
                              value={editForm.description}
                              onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                              rows={3}
                              style={{
                                width: '100%',
                                padding: '0.875rem',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                                borderRadius: '10px',
                                fontSize: '0.875rem',
                                background: 'rgba(255, 255, 255, 0.1)',
                                color: 'white',
                                outline: 'none',
                                transition: 'all 0.2s ease',
                                resize: 'vertical',
                                fontFamily: 'inherit',
                                boxSizing: 'border-box'
                              }}
                              onFocus={(e) => {
                                e.target.style.border = '1px solid rgba(59, 130, 246, 0.5)';
                                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                              }}
                              onBlur={(e) => {
                                e.target.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                                e.target.style.boxShadow = 'none';
                              }}
                            />
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                          <button
                            onClick={handleSaveEdit}
                            style={{
                              padding: '0.875rem 1.5rem',
                              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.02)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                          >
                            ✅ 保存
                          </button>
                          
                          <button
                            onClick={() => {
                              setEditingCollection(null);
                              setEditForm({ name: '', packageId: '', roleId: '', roleName: '', description: '' });
                            }}
                            style={{
                              padding: '0.875rem 1.5rem',
                              background: 'rgba(255, 255, 255, 0.1)',
                              color: 'white',
                              border: '1px solid rgba(255, 255, 255, 0.3)',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              fontWeight: '600',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      // 通常の表示
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ color: 'white', fontWeight: '600', fontSize: '1rem', marginBottom: '0.5rem' }}>
                            {collection.name}
                          </h4>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.4' }}>
                            <div style={{ marginBottom: '0.25rem' }}>
                              <strong>Package ID:</strong> {collection.packageId}
                            </div>
                            <div style={{ marginBottom: '0.25rem' }}>
                              <strong>Role ID:</strong> {collection.roleId}
                            </div>
                            <div style={{ marginBottom: '0.25rem' }}>
                              <strong>Role Name:</strong> {collection.roleName}
                            </div>
                            {collection.description && (
                              <div style={{ marginBottom: '0.25rem' }}>
                                <strong>説明:</strong> {collection.description}
                              </div>
                            )}
                            <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                              作成日: {new Date(collection.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                          <button
                            onClick={() => handleEditCollection(collection)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteCollection(collection.id)}
                            style={{
                              padding: '0.5rem 1rem',
                              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.05)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                            }}
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* バッチ処理とユーザー管理 */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.1)', 
          padding: '2rem', 
          borderRadius: '16px',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          height: 'fit-content'
        }}>
          <h2 style={{ fontWeight: '600', marginBottom: '1.5rem', fontSize: '1.25rem' }}>バッチ処理とユーザー管理</h2>
          
          {/* バッチ処理 */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontWeight: '500', marginBottom: '1rem', fontSize: '1rem' }}>自動ロール剥奪</h3>
            <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '1rem' }}>
              NFTを保有していないユーザーのロールを自動で剥奪します。
            </p>
            <button
              onClick={handleBatchCheck}
              disabled={batchProcessing}
              style={{
                padding: '1rem 1.5rem',
                background: batchProcessing 
                  ? 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)'
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: batchProcessing ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                width: '100%'
              }}
            >
              {batchProcessing ? '処理中...' : 'バッチ処理を実行'}
            </button>
          </div>
          
          {/* 認証済みユーザー一覧 */}
          <div>
            <h3 style={{ fontWeight: '500', marginBottom: '1rem', fontSize: '1rem' }}>認証済みユーザー ({verifiedUsers.length})</h3>
            <div style={{ 
              maxHeight: '400px', 
              overflowY: 'auto',
              paddingRight: '0.5rem'
            }}>
              {verifiedUsers.length === 0 ? (
                <div style={{
                  padding: '2rem',
                  textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '0.875rem'
                }}>
                  認証済みユーザーがいません
                </div>
              ) : (
                verifiedUsers.map((user, index) => (
                  <div key={index} style={{ 
                    padding: '1rem', 
                    background: 'rgba(255, 255, 255, 0.05)', 
                    borderRadius: '12px', 
                    marginBottom: '0.75rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    transition: 'all 0.2s ease'
                  }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: 'rgba(255, 255, 255, 0.95)' }}>
                        Discord ID: {user.discordId}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)', marginTop: '0.25rem' }}>
                        アドレス: {user.address}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                        ロール: {user.roleName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                        認証日時: {new Date(user.verifiedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const { account, connected } = useWalletWithErrorHandling();
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<'verification' | 'admin'>('verification');

  // 管理者チェック（ヘッダー表示制御用）
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        if (connected && account?.address) {
          const resp = await fetch(`${API_BASE_URL}/api/admin/check/${account.address}`);
          const data = await resp.json();
          setIsAdmin(Boolean(data?.success && data?.isAdmin));
        } else {
          setIsAdmin(false);
        }
      } catch (e) {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [connected, account?.address]);

  // 非管理者が管理画面を開けないように制御
  useEffect(() => {
    if (currentPage === 'admin' && !isAdmin) {
      setCurrentPage('verification');
    }
  }, [currentPage, isAdmin]);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      {/* コンパクトヘッダー（モバイル最適化） */}
      <nav style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
        padding: '0.5rem 1rem',
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
          <h1 style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            color: '#1a1a1a',
            margin: 0
          }}>
            NFT Verification
          </h1>
          {isAdmin && (
            <button
              onClick={() => setCurrentPage(currentPage === 'admin' ? 'verification' : 'admin')}
              style={{
                padding: '0.5rem 0.75rem',
                background: currentPage === 'admin' ? '#3b82f6' : 'transparent',
                color: currentPage === 'admin' ? 'white' : '#374151',
                border: currentPage === 'admin' ? 'none' : '1px solid #d1d5db',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: 600
              }}
            >
              {currentPage === 'admin' ? '認証ページへ' : '管理者パネル'}
            </button>
          )}
        </div>
      </nav>

      {/* Content */}
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '1rem',
        minHeight: 'calc(100vh - 56px)'
      }}>
        {(() => {
          try {
            return currentPage === 'verification' ? <NFTVerification /> : <AdminPage />;
          } catch (error) {
            console.error('Component rendering error:', error);
            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh',
                color: 'white',
                textAlign: 'center'
              }}>
                <div>
                  <h2>コンポーネントエラー</h2>
                  <p>ページを再読み込みしてください。</p>
                  <button 
                    onClick={() => window.location.reload()}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'white',
                      color: '#667eea',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      marginTop: '1rem'
                    }}
                  >
                    再読み込み
                  </button>
                </div>
              </div>
            );
          }
        })()}
      </div>
    </div>
  );
}

export default App;