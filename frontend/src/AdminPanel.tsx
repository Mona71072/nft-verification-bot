import { useState, useEffect } from 'react';

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

interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string[];
  mentionable: boolean;
  hoist: boolean;
}

interface BatchConfig {
  enabled: boolean;
  interval: number;
  lastRun: string;
  nextRun: string;
  maxUsersPerBatch: number;
  retryAttempts: number;
}

interface BatchStats {
  totalUsers: number;
  processed: number;
  revoked: number;
  errors: number;
  lastRun: string;
  duration: number;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

function AdminPanel() {
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editingCollection, setEditingCollection] = useState<NFTCollection | null>(null);
  
  // バッチ処理関連の状態
  const [batchConfig, setBatchConfig] = useState<BatchConfig | null>(null);
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'collections' | 'batch'>('collections');

  const [newCollection, setNewCollection] = useState({
    name: '',
    packageId: '',
    roleId: '',
    roleName: '',
    description: ''
  });

  const fetchCollections = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/collections`);
      const data = await response.json();
      if (data.success) {
        setCollections(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    }
  };

  // Discordロール取得
  const fetchDiscordRoles = async () => {
    try {
      console.log('🔄 Fetching Discord roles...');
      const response = await fetch(`${API_BASE_URL}/api/discord/roles`);
      const data = await response.json();
      if (data.success) {
        setDiscordRoles(data.data);
        console.log(`✅ Loaded ${data.data.length} Discord roles`);
      } else {
        console.error('❌ Failed to fetch Discord roles:', data.error);
      }
    } catch (error) {
      console.error('❌ Error fetching Discord roles:', error);
    }
  };

  // ロール選択時の処理
  const handleRoleSelect = (roleId: string) => {
    const selectedRole = discordRoles.find(role => role.id === roleId);
    if (selectedRole) {
      setNewCollection({
        ...newCollection,
        roleId: selectedRole.id,
        roleName: selectedRole.name
      });
    } else {
      setNewCollection({
        ...newCollection,
        roleId: '',
        roleName: ''
      });
    }
  };

  const handleAddCollection = async () => {
    if (!newCollection.name || !newCollection.packageId || !newCollection.roleId || !newCollection.roleName) {
      setMessage('すべての必須フィールドを入力してください');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCollection)
      });

      const data = await response.json();
      if (data.success) {
        setMessage('コレクションが正常に追加されました');
        setNewCollection({ name: '', packageId: '', roleId: '', roleName: '', description: '' });
        fetchCollections();
      } else {
        setMessage('コレクションの追加に失敗しました');
      }
    } catch {
      setMessage('エラーが発生しました');
    }
    setLoading(false);
  };

  const handleDeleteCollection = async (id: string) => {
    if (!confirm('このコレクションを削除しますか？')) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/collections/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        setMessage('コレクションが正常に削除されました');
        fetchCollections();
      } else {
        setMessage('コレクションの削除に失敗しました');
      }
    } catch {
      setMessage('エラーが発生しました');
    }
    setLoading(false);
  };

  // コレクション編集開始
  const handleEditCollection = (collection: NFTCollection) => {
    setEditingCollection(collection);
    setNewCollection({
      name: collection.name,
      packageId: collection.packageId,
      roleId: collection.roleId,
      roleName: collection.roleName,
      description: collection.description
    });
  };

  // コレクション編集キャンセル
  const handleCancelEdit = () => {
    setEditingCollection(null);
    setNewCollection({ name: '', packageId: '', roleId: '', roleName: '', description: '' });
  };

  // コレクション更新
  const handleUpdateCollection = async () => {
    if (!editingCollection || !newCollection.name || !newCollection.packageId || !newCollection.roleId || !newCollection.roleName) {
      setMessage('すべての必須フィールドを入力してください');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/collections/${editingCollection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCollection)
      });

      const data = await response.json();
      if (data.success) {
        setMessage('コレクションが正常に更新されました');
        setEditingCollection(null);
        setNewCollection({ name: '', packageId: '', roleId: '', roleName: '', description: '' });
        fetchCollections();
      } else {
        setMessage('コレクションの更新に失敗しました');
      }
    } catch {
      setMessage('エラーが発生しました');
    }
    setLoading(false);
  };

  // バッチ処理設定取得
  const fetchBatchConfig = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/batch-config`);
      const data = await response.json();
      if (data.success) {
        setBatchConfig(data.data.config);
        setBatchStats(data.data.stats);
      }
    } catch {
      console.error('Failed to fetch batch config');
    }
  };

  // バッチ処理実行
  const executeBatchProcess = async () => {
    if (!confirm('バッチ処理を実行しますか？')) return;

    setBatchLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/batch-execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();
      if (data.success) {
        setMessage('バッチ処理が正常に実行されました');
        fetchBatchConfig(); // 統計を更新
      } else {
        setMessage('バッチ処理の実行に失敗しました');
      }
    } catch {
      setMessage('エラーが発生しました');
    }
    setBatchLoading(false);
  };

  // バッチ処理設定更新
  const updateBatchConfig = async (config: Partial<BatchConfig>) => {
    setBatchLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/batch-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const data = await response.json();
      if (data.success) {
        setMessage('バッチ処理設定が正常に更新されました');
        setBatchConfig(data.data);
      } else {
        setMessage('バッチ処理設定の更新に失敗しました');
      }
    } catch {
      setMessage('エラーが発生しました');
    }
    setBatchLoading(false);
  };

  // 署名式ログイン
  const handleAuth = async () => {
    try {
      setLoading(true);
      setMessage('');
      // ウォレット接続中のApp側で行う想定だが、ここではアドレスを入力式に
      if (!address) {
        setMessage('管理者ウォレットアドレスを入力してください');
        setLoading(false);
        return;
      }
      // 1) ナンス取得
      const nonceResp = await fetch(`${API_BASE_URL}/api/admin/login-nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      const nonceData = await nonceResp.json();
      if (!nonceData.success) {
        setMessage(nonceData.error || 'ナンス取得に失敗しました');
        setLoading(false);
        return;
      }
      const nonce = nonceData.data.nonce;
      const timestamp = new Date().toISOString();
      const authMessage = `SXT Admin Login\naddress=${address}\nnonce=${nonce}\ntimestamp=${timestamp}`;
      // 2) ここで本来はウォレット署名を行い signature/bytes/publicKey を得る
      // デモ用にbytes=authMessage, signature/ publicKey をダミー（本運用ではApp.tsxから引き回し）
      const bytes = new TextEncoder().encode(authMessage);
      const signature = btoa('dummy');
      // 3) 検証要求
      const verifyResp = await fetch(`${API_BASE_URL}/api/admin/login-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, signature, bytes, authMessage, nonce })
      });
      const verifyData = await verifyResp.json();
      if (!verifyData.success) {
        setMessage(verifyData.error || 'ログイン検証に失敗しました');
        setLoading(false);
        return;
      }
      // トークンはApp側の実装を使用（ここでは保存しない）
      setIsAuthenticated(true);
    } catch (e) {
      setMessage('認証処理でエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCollections();
      fetchDiscordRoles();
      fetchBatchConfig(); // バッチ処理設定も取得
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div style={{ 
        padding: '2rem', 
        textAlign: 'center',
        maxWidth: '400px',
        margin: '0 auto'
      }}>
        <h2 style={{ marginBottom: '1rem' }}>管理者認証</h2>
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="管理者ウォレットアドレス"
          style={{ 
            padding: '0.5rem', 
            margin: '1rem',
            width: '100%',
            borderRadius: '4px',
            border: '1px solid #ccc'
          }}
        />
        <button 
          onClick={handleAuth}
          style={{
            padding: '0.5rem 1rem',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          認証
        </button>
        {message && (
          <p style={{ color: 'red', marginTop: '1rem' }}>{message}</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>NFT Verification 管理パネル</h1>

      {/* タブナビゲーション */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '2rem',
        borderBottom: '1px solid #ccc',
        paddingBottom: '1rem'
      }}>
        <button
          onClick={() => setActiveTab('collections')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'collections' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'collections' ? 'white' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          コレクション管理
        </button>
        <button
          onClick={() => setActiveTab('batch')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'batch' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'batch' ? 'white' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          バッチ処理管理
        </button>
      </div>

      {activeTab === 'collections' && (
        <>
          {/* New Collection Add Form */}
          <div style={{ 
            marginBottom: '2rem', 
            padding: '1rem', 
            border: '1px solid #ccc',
            borderRadius: '8px'
          }}>
            <h3>{editingCollection ? 'コレクション編集' : '新しいコレクション追加'}</h3>
            <div style={{ display: 'grid', gap: '0.5rem', maxWidth: '600px' }}>
              <input 
                type="text" 
                placeholder="コレクション名" 
                value={newCollection.name} 
                onChange={(e) => setNewCollection({...newCollection, name: e.target.value})}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <input 
                type="text" 
                placeholder="Package ID (例: 0x123...::nft::NFT)" 
                value={newCollection.packageId} 
                onChange={(e) => setNewCollection({...newCollection, packageId: e.target.value})}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <select
                value={newCollection.roleId}
                onChange={(e) => handleRoleSelect(e.target.value)}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="">ロールを選択してください</option>
                {discordRoles.map(role => (
                  <option key={role.id} value={role.id}>
                    {role.name} (ID: {role.id})
                  </option>
                ))}
              </select>
              <input 
                type="text" 
                placeholder="ロール名（自動設定）" 
                value={newCollection.roleName} 
                onChange={(e) => setNewCollection({...newCollection, roleName: e.target.value})}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                readOnly
              />
              <textarea 
                placeholder="説明" 
                value={newCollection.description} 
                onChange={(e) => setNewCollection({...newCollection, description: e.target.value})}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '80px' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {editingCollection ? (
                  <>
                    <button 
                      onClick={handleUpdateCollection}
                      disabled={loading}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        flex: 1
                      }}
                    >
                      {loading ? '更新中...' : 'コレクション更新'}
                    </button>
                    <button 
                      onClick={handleCancelEdit}
                      disabled={loading}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        flex: 1
                      }}
                    >
                      キャンセル
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={handleAddCollection}
                    disabled={loading}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1
                    }}
                  >
                    {loading ? '追加中...' : 'コレクション追加'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Existing Collections List */}
          <div>
            <h3>既存コレクション一覧</h3>
            {collections.map(collection => (
              <div key={collection.id} style={{
                border: '1px solid #ccc',
                padding: '1rem',
                margin: '0.5rem 0',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0' }}>{collection.name}</h4>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                    <strong>Package ID:</strong> {collection.packageId}
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                    <strong>Role:</strong> {collection.roleName} ({collection.roleId})
                  </p>
                  <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                    <strong>Status:</strong> {collection.isActive ? 'Active' : 'Inactive'}
                  </p>
                  {collection.description && (
                    <p style={{ margin: '0.25rem 0', fontSize: '0.9rem', color: '#666' }}>
                      {collection.description}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => handleEditCollection(collection)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDeleteCollection(collection.id)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
            {collections.length === 0 && (
              <p style={{ color: '#666', fontStyle: 'italic' }}>コレクションがありません</p>
            )}
          </div>
        </>
      )}

      {activeTab === 'batch' && (
        <div>
          <h3>バッチ処理管理</h3>
          
          {/* バッチ処理設定 */}
          <div style={{ 
            marginBottom: '2rem', 
            padding: '1rem', 
            border: '1px solid #ccc',
            borderRadius: '8px'
          }}>
            <h4>バッチ処理設定</h4>
            {batchConfig && (
              <div style={{ display: 'grid', gap: '1rem', maxWidth: '600px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={batchConfig.enabled}
                      onChange={(e) => updateBatchConfig({ enabled: e.target.checked })}
                      disabled={batchLoading}
                    />
                    バッチ処理を有効にする
                  </label>
                </div>
                
                <div>
                  <label>実行間隔（分）:</label>
                  <input
                    type="number"
                    value={batchConfig.interval}
                    onChange={(e) => updateBatchConfig({ interval: parseInt(e.target.value) })}
                    disabled={batchLoading}
                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', marginLeft: '1rem' }}
                  />
                </div>
                
                <div>
                  <label>バッチサイズ（最大ユーザー数）:</label>
                  <input
                    type="number"
                    value={batchConfig.maxUsersPerBatch}
                    onChange={(e) => updateBatchConfig({ maxUsersPerBatch: parseInt(e.target.value) })}
                    disabled={batchLoading}
                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', marginLeft: '1rem' }}
                  />
                </div>
                
                <div>
                  <label>リトライ回数:</label>
                  <input
                    type="number"
                    value={batchConfig.retryAttempts}
                    onChange={(e) => updateBatchConfig({ retryAttempts: parseInt(e.target.value) })}
                    disabled={batchLoading}
                    style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', marginLeft: '1rem' }}
                  />
                </div>
                
                <div>
                  <p><strong>最終実行:</strong> {batchConfig.lastRun ? new Date(batchConfig.lastRun).toLocaleString('ja-JP') : '未実行'}</p>
                  <p><strong>次回実行予定:</strong> {batchConfig.nextRun ? new Date(batchConfig.nextRun).toLocaleString('ja-JP') : '未設定'}</p>
                </div>
              </div>
            )}
          </div>

          {/* バッチ処理実行 */}
          <div style={{ 
            marginBottom: '2rem', 
            padding: '1rem', 
            border: '1px solid #ccc',
            borderRadius: '8px'
          }}>
            <h4>手動実行</h4>
            <button
              onClick={executeBatchProcess}
              disabled={batchLoading}
              style={{
                padding: '0.5rem 1rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: batchLoading ? 'not-allowed' : 'pointer',
                opacity: batchLoading ? 0.6 : 1
              }}
            >
              {batchLoading ? '実行中...' : 'バッチ処理を実行'}
            </button>
          </div>

          {/* バッチ処理統計 */}
          <div style={{ 
            padding: '1rem', 
            border: '1px solid #ccc',
            borderRadius: '8px'
          }}>
            <h4>バッチ処理統計</h4>
            {batchStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
                  <h5>総ユーザー数</h5>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{batchStats.totalUsers}</p>
                </div>
                <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
                  <h5>処理完了</h5>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{batchStats.processed}</p>
                </div>
                <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
                  <h5>ロール削除</h5>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#dc3545' }}>{batchStats.revoked}</p>
                </div>
                <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
                  <h5>エラー数</h5>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0, color: '#ffc107' }}>{batchStats.errors}</p>
                </div>
                <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
                  <h5>処理時間</h5>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{batchStats.duration}ms</p>
                </div>
                <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
                  <h5>最終実行</h5>
                  <p style={{ fontSize: '1rem', margin: 0 }}>{batchStats.lastRun ? new Date(batchStats.lastRun).toLocaleString('ja-JP') : '未実行'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {message && (
        <div style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          padding: '1rem',
          background: message.includes('成功') ? '#d4edda' : '#f8d7da',
          color: message.includes('成功') ? '#155724' : '#721c24',
          border: '1px solid',
          borderColor: message.includes('成功') ? '#c3e6cb' : '#f5c6cb',
          borderRadius: '4px',
          zIndex: 1000
        }}>
          {message}
        </div>
      )}
    </div>
  );
}

export default AdminPanel; 