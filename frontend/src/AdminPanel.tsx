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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

function AdminPanel() {
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editingCollection, setEditingCollection] = useState<NFTCollection | null>(null);

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
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
      setMessage('エラーが発生しました');
    }
    setLoading(false);
  };

  const handleAuth = () => {
    // 簡単な認証（実際の運用ではより安全な認証が必要）
    if (password === 'admin123') {
      setIsAuthenticated(true);
      setMessage('');
    } else {
      setMessage('パスワードが正しくありません');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchCollections();
      fetchDiscordRoles(); // 認証後にDiscordロールを取得
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
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="管理者パスワード"
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
      <h1 style={{ marginBottom: '2rem' }}>NFTコレクション管理</h1>

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