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
  enableDmNotifications: boolean;
}

interface BatchStats {
  totalUsers: number;
  processed: number;
  revoked: number;
  errors: number;
  lastRun: string;
  duration: number;
}

type DmMode = 'all' | 'new_and_revoke' | 'update_and_revoke' | 'revoke_only' | 'none';
interface DmTemplate { title: string; description: string; color?: number }
interface DmTemplates { successNew: DmTemplate; successUpdate: DmTemplate; failed: DmTemplate; revoked: DmTemplate }
interface ChannelTemplates { verificationChannel: DmTemplate; verificationStart: DmTemplate }
interface DmSettings { 
  mode: DmMode; // 通常認証時のDM通知モード
  batchMode: DmMode; // バッチ処理時のDM通知モード
  templates: DmTemplates;
  channelTemplates: ChannelTemplates;
}

interface VerifiedUser {
  discordId: string;
  address: string;
  collectionId: string;
  roleId: string;
  roleName: string;
  verifiedAt: string;
  lastChecked?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

function AdminPanel() {
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [editingCollection, setEditingCollection] = useState<NFTCollection | null>(null);
  
  // バッチ処理関連の状態
  const [batchConfig, setBatchConfig] = useState<BatchConfig | null>(null);
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'collections' | 'batch' | 'users' | 'admins' | 'dm-settings'>('collections');

  // 認証済みユーザー関連の状態
  const [verifiedUsers, setVerifiedUsers] = useState<VerifiedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // 管理者関連の状態
  const [adminAddresses, setAdminAddresses] = useState<string[]>([]);
  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  // DM通知設定
  const [dmSettings, setDmSettings] = useState<DmSettings | null>(null);
  const [dmEditing, setDmEditing] = useState(false);
  const [editingDm, setEditingDm] = useState<DmSettings | null>(null);

  const [newCollection, setNewCollection] = useState({
    name: '',
    packageId: '',
    roleId: '',
    roleName: '',
    description: ''
  });

  // メッセージを5秒後に自動で消すためのuseEffect
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        setMessage('');
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [message]);

  // 管理者認証ヘッダーを生成
  const getAuthHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const addr = localStorage.getItem('currentWalletAddress');
      if (addr) headers['X-Admin-Address'] = addr;
    } catch {}
    return headers;
  };

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

  // DM通知設定の取得
  const fetchDmSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/dm-settings`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.success) {
        setDmSettings(data.data);
        // テンプレートが空の場合は初期化を試行
        if (!data.data.templates || 
            !data.data.templates.successNew?.title || 
            !data.data.templates.successUpdate?.title || 
            !data.data.templates.failed?.title || 
            !data.data.templates.revoked?.title ||
            !data.data.channelTemplates ||
            !data.data.channelTemplates.verificationChannel?.title ||
            !data.data.channelTemplates.verificationStart?.title) {
          console.log('⚠️ DM templates or channel templates are empty, attempting to initialize...');
          await initializeDmSettings();
        }
      }
    } catch (e) {
      console.error('❌ Failed to fetch DM settings', e);
    }
  };

  // DM通知設定の初期化
  const initializeDmSettings = async () => {
    try {
      console.log('🔄 Initializing DM settings...');
      const res = await fetch(`${API_BASE_URL}/api/admin/dm-settings/initialize`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setDmSettings(data.data);
        console.log('✅ DM settings initialized successfully');
      } else {
        console.error('❌ Failed to initialize DM settings:', data.error);
      }
    } catch (e) {
      console.error('❌ Failed to initialize DM settings', e);
    }
  };

  // DM通知設定の保存
  const saveDmSettings = async () => {
    if (!editingDm) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/dm-settings`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editingDm)
      });
      const data = await res.json();
      if (data.success) {
        setDmSettings(data.data);
        setDmEditing(false);
        setEditingDm(null);
        setMessage('DM通知設定を保存しました');
      } else {
        setMessage('DM通知設定の保存に失敗しました');
      }
    } catch (e) {
      console.error('❌ Failed to save DM settings', e);
      setMessage('DM通知設定の保存に失敗しました');
    }
  };

  // 認証済みユーザー一覧取得
  const fetchVerifiedUsers = async () => {
    setUsersLoading(true);
    try {
      console.log('🔄 Fetching verified users...');
      const response = await fetch(`${API_BASE_URL}/api/admin/verified-users`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setVerifiedUsers(data.data);
        console.log(`✅ Loaded ${data.data.length} verified users`);
      } else {
        console.error('❌ Failed to fetch verified users:', data.error);
        setMessage('認証済みユーザーの取得に失敗しました');
      }
    } catch (error) {
      console.error('❌ Error fetching verified users:', error);
      setMessage('認証済みユーザーの取得中にエラーが発生しました');
    }
    setUsersLoading(false);
  };

  // 管理者アドレス一覧取得
  const fetchAdminAddresses = async () => {
    setAdminLoading(true);
    try {
      console.log('🔄 Fetching admin addresses...');
      const response = await fetch(`${API_BASE_URL}/api/admin/addresses`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setAdminAddresses(data.data);
        console.log(`✅ Loaded ${data.data.length} admin addresses`);
      } else {
        console.error('❌ Failed to fetch admin addresses:', data.error);
        setMessage('管理者アドレスの取得に失敗しました');
      }
    } catch (error) {
      console.error('❌ Error fetching admin addresses:', error);
      setMessage('管理者アドレスの取得中にエラーが発生しました');
    }
    setAdminLoading(false);
  };

  // 管理者アドレス追加
  const handleAddAdminAddress = async () => {
    if (!newAdminAddress || !newAdminAddress.trim()) {
      setMessage('有効なアドレスを入力してください');
      return;
    }

    // 既に存在するかチェック
    if (adminAddresses.some(addr => addr.toLowerCase() === newAdminAddress.toLowerCase())) {
      setMessage('このアドレスは既に管理者として登録されています');
      return;
    }

    setAdminLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/addresses`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ address: newAdminAddress.trim() })
      });
      const data = await response.json();
      if (data.success) {
        setAdminAddresses(data.data);
        setNewAdminAddress('');
        setMessage('管理者アドレスが正常に追加されました');
        console.log('✅ Admin address added successfully');
      } else {
        console.error('❌ Failed to add admin address:', data.error);
        setMessage(`管理者アドレスの追加に失敗しました: ${data.error}`);
      }
    } catch (error) {
      console.error('❌ Failed to add admin address:', error);
      setMessage('管理者アドレスの追加に失敗しました');
    }
    setAdminLoading(false);
  };

  // 管理者アドレス削除
  const handleRemoveAdminAddress = async (address: string) => {
    if (adminAddresses.length <= 1) {
      setMessage('管理者アドレスを全て削除することはできません。最低1つの管理者アドレスが必要です');
      return;
    }

    if (!confirm(`管理者アドレス "${address}" を削除しますか？`)) {
      return;
    }

    setAdminLoading(true);
    try {
      console.log(`🗑️ Removing admin address: ${address}`);
      const response = await fetch(`${API_BASE_URL}/api/admin/addresses/${encodeURIComponent(address)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setAdminAddresses(data.data);
        setMessage('管理者アドレスが正常に削除されました');
        console.log('✅ Admin address removed successfully');
      } else {
        console.error('❌ Failed to remove admin address:', data.error);
        setMessage(`管理者アドレスの削除に失敗しました: ${data.error}`);
      }
    } catch (error) {
      console.error('❌ Failed to remove admin address:', error);
      setMessage('管理者アドレスの削除に失敗しました');
    }
    setAdminLoading(false);
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
        headers: getAuthHeaders(),
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
        method: 'DELETE',
        headers: getAuthHeaders()
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
        headers: getAuthHeaders(),
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
      const response = await fetch(`${API_BASE_URL}/api/admin/batch-config`, {
        headers: getAuthHeaders()
      });
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
        headers: getAuthHeaders()
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

  // バッチ処理設定の編集用状態
  const [editingBatchConfig, setEditingBatchConfig] = useState<BatchConfig | null>(null);
  const [batchConfigEditing, setBatchConfigEditing] = useState(false);

  // バッチ処理設定更新
  const updateBatchConfig = async (config: Partial<BatchConfig>) => {
    setBatchLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/batch-config`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(config)
      });

      const data = await response.json();
      if (data.success) {
        setMessage('バッチ処理設定が正常に更新されました');
        setBatchConfig(data.data);
        setBatchConfigEditing(false);
        setEditingBatchConfig(null);
      } else {
        setMessage('バッチ処理設定の更新に失敗しました');
      }
    } catch {
      setMessage('エラーが発生しました');
    }
    setBatchLoading(false);
  };

  // バッチ処理設定編集開始
  const handleEditBatchConfig = () => {
    if (batchConfig) {
      setEditingBatchConfig({ ...batchConfig });
      setBatchConfigEditing(true);
    }
  };

  // バッチ処理設定編集キャンセル
  const handleCancelBatchConfigEdit = () => {
    setBatchConfigEditing(false);
    setEditingBatchConfig(null);
  };

  // バッチ処理設定保存
  const handleSaveBatchConfig = () => {
    if (editingBatchConfig) {
      updateBatchConfig(editingBatchConfig);
    }
  };

  // 総ユーザー数クリック時の処理
  const handleTotalUsersClick = () => {
    setActiveTab('users');
    fetchVerifiedUsers();
  };

  // コンポーネントマウント時にデータを取得
  useEffect(() => {
    fetchCollections();
    fetchDiscordRoles();
    fetchBatchConfig();
    fetchDmSettings();
  }, []);

  // タブ変更時にデータを取得
  useEffect(() => {
    if (activeTab === 'users') {
      fetchVerifiedUsers();
    } else if (activeTab === 'admins') {
      fetchAdminAddresses();
    } else if (activeTab === 'dm-settings') {
      fetchDmSettings();
    }
  }, [activeTab]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem' }}>NFT Verification 管理パネル</h1>

      {/* タブナビゲーション */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '2rem',
        borderBottom: '1px solid #ccc',
        paddingBottom: '1rem',
        flexWrap: 'wrap'
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
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'users' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'users' ? 'white' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          認証済みユーザー
        </button>
        <button
          onClick={() => setActiveTab('admins')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'admins' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'admins' ? 'white' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          管理者管理
        </button>
        <button
          onClick={() => setActiveTab('dm-settings')}
          style={{
            padding: '0.5rem 1rem',
            background: activeTab === 'dm-settings' ? '#007bff' : '#f8f9fa',
            color: activeTab === 'dm-settings' ? 'white' : '#333',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          DM通知設定
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
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h4>バッチ処理設定</h4>
              {!batchConfigEditing && (
                <button
                  onClick={handleEditBatchConfig}
                  disabled={batchLoading || !batchConfig}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: batchLoading || !batchConfig ? 'not-allowed' : 'pointer',
                    opacity: batchLoading || !batchConfig ? 0.6 : 1,
                    fontSize: '0.9rem'
                  }}
                >
                  設定を編集
                </button>
              )}
            </div>

            {batchConfig && (
              <div style={{ display: 'grid', gap: '1rem', maxWidth: '600px' }}>
                {/* 現在の設定表示 */}
                {!batchConfigEditing && (
                  <div style={{ 
                    background: '#f8f9fa', 
                    padding: '1rem', 
                    borderRadius: '8px',
                    marginBottom: '1rem'
                  }}>
                    <h5 style={{ margin: '0 0 1rem 0', color: '#495057' }}>現在の設定</h5>
                                         <div style={{ display: 'grid', gap: '0.5rem' }}>
                       <div>
                         <strong>バッチ処理:</strong> {batchConfig.enabled ? '有効' : '無効'}
                       </div>
                       <div>
                         <strong>実行間隔:</strong> {batchConfig.interval}分
                       </div>
                       <div>
                         <strong>バッチサイズ:</strong> {batchConfig.maxUsersPerBatch}ユーザー
                       </div>
                       <div>
                         <strong>リトライ回数:</strong> {batchConfig.retryAttempts}回
                       </div>
                       <div>
                         <strong>DM通知:</strong> {batchConfig.enableDmNotifications ? '有効' : '無効'}
                       </div>
                       <div>
                         <strong>最終実行:</strong> {batchConfig.lastRun ? new Date(batchConfig.lastRun).toLocaleString('ja-JP') : '未実行'}
                       </div>
                       <div>
                         <strong>次回実行予定:</strong> {batchConfig.nextRun ? new Date(batchConfig.nextRun).toLocaleString('ja-JP') : '未設定'}
                       </div>
                     </div>
                  </div>
                )}

                {/* 編集フォーム */}
                {batchConfigEditing && editingBatchConfig && (
                  <div style={{ 
                    background: '#fff3cd', 
                    padding: '1rem', 
                    borderRadius: '8px',
                    border: '1px solid #ffeaa7',
                    marginBottom: '1rem'
                  }}>
                    <h5 style={{ margin: '0 0 1rem 0', color: '#856404' }}>設定を編集</h5>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <label>
                          <input
                            type="checkbox"
                            checked={editingBatchConfig.enabled}
                            onChange={(e) => setEditingBatchConfig({
                              ...editingBatchConfig,
                              enabled: e.target.checked
                            })}
                            disabled={batchLoading}
                          />
                          バッチ処理を有効にする
                        </label>
                      </div>
                      
                      <div>
                        <label>実行間隔（分）:</label>
                        <input
                          type="number"
                          value={editingBatchConfig.interval}
                          onChange={(e) => setEditingBatchConfig({
                            ...editingBatchConfig,
                            interval: parseInt(e.target.value) || 0
                          })}
                          disabled={batchLoading}
                          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', marginLeft: '1rem', width: '100px' }}
                        />
                      </div>
                      
                      <div>
                        <label>バッチサイズ（最大ユーザー数）:</label>
                        <input
                          type="number"
                          value={editingBatchConfig.maxUsersPerBatch}
                          onChange={(e) => setEditingBatchConfig({
                            ...editingBatchConfig,
                            maxUsersPerBatch: parseInt(e.target.value) || 0
                          })}
                          disabled={batchLoading}
                          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', marginLeft: '1rem', width: '100px' }}
                        />
                      </div>
                      
                                             <div>
                         <label>リトライ回数:</label>
                         <input
                           type="number"
                           value={editingBatchConfig.retryAttempts}
                           onChange={(e) => setEditingBatchConfig({
                             ...editingBatchConfig,
                             retryAttempts: parseInt(e.target.value) || 0
                           })}
                           disabled={batchLoading}
                           style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', marginLeft: '1rem', width: '100px' }}
                         />
                       </div>

                       <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                         <label>
                           <input
                             type="checkbox"
                             checked={editingBatchConfig.enableDmNotifications}
                             onChange={(e) => setEditingBatchConfig({
                               ...editingBatchConfig,
                               enableDmNotifications: e.target.checked
                             })}
                             disabled={batchLoading}
                           />
                           バッチ処理時のDM通知を有効にする
                         </label>
                       </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                        <button
                          onClick={handleSaveBatchConfig}
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
                          {batchLoading ? '保存中...' : '設定を保存'}
                        </button>
                        <button
                          onClick={handleCancelBatchConfigEdit}
                          disabled={batchLoading}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: batchLoading ? 'not-allowed' : 'pointer',
                            opacity: batchLoading ? 0.6 : 1
                          }}
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
                <div 
                  style={{ 
                    padding: '1rem', 
                    background: '#f8f9fa', 
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e9ecef'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                  onClick={handleTotalUsersClick}
                >
                  <h5>総ユーザー数</h5>
                  <p style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>{batchStats.totalUsers}</p>
                  <small style={{ color: '#6c757d' }}>クリックして詳細を表示</small>
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

      {activeTab === 'users' && (
        <div>
          <h3>認証済みユーザー一覧</h3>
          
          <div style={{ 
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <p>総ユーザー数: {verifiedUsers.length}人</p>
            <button
              onClick={fetchVerifiedUsers}
              disabled={usersLoading}
              style={{
                padding: '0.5rem 1rem',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: usersLoading ? 'not-allowed' : 'pointer',
                opacity: usersLoading ? 0.6 : 1
              }}
            >
              {usersLoading ? '更新中...' : '更新'}
            </button>
          </div>

          {usersLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>ユーザー一覧を読み込み中...</p>
            </div>
          ) : verifiedUsers.length > 0 ? (
            <div style={{ 
              maxHeight: '600px', 
              overflowY: 'auto',
              border: '1px solid #ccc',
              borderRadius: '8px'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa' }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ccc' }}>Discord ID</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ccc' }}>ウォレットアドレス</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ccc' }}>ロール名</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ccc' }}>認証日時</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #ccc' }}>最終チェック</th>
                  </tr>
                </thead>
                <tbody>
                  {verifiedUsers.map((user, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '0.75rem' }}>{user.discordId}</td>
                      <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>
                        {user.address.length > 20 ? `${user.address.slice(0, 10)}...${user.address.slice(-8)}` : user.address}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ 
                          background: '#007bff', 
                          color: 'white', 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}>
                          {user.roleName}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
                        {new Date(user.verifiedAt).toLocaleString('ja-JP')}
                      </td>
                      <td style={{ padding: '0.75rem', fontSize: '0.9rem' }}>
                        {user.lastChecked ? new Date(user.lastChecked).toLocaleString('ja-JP') : '未チェック'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '2rem',
              color: '#666',
              fontStyle: 'italic'
            }}>
              <p>認証済みユーザーがいません</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'admins' && (
        <div>
          <h3>管理者管理</h3>
          
          {/* 管理者追加フォーム */}
          <div style={{ 
            marginBottom: '2rem', 
            padding: '1rem', 
            border: '1px solid #ccc',
            borderRadius: '8px'
          }}>
            <h4>新しい管理者を追加</h4>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', maxWidth: '600px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  ウォレットアドレス
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={newAdminAddress}
                  onChange={(e) => setNewAdminAddress(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    fontFamily: 'monospace'
                  }}
                />
              </div>
              <button
                onClick={handleAddAdminAddress}
                disabled={adminLoading || !newAdminAddress.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: adminLoading || !newAdminAddress.trim() ? 'not-allowed' : 'pointer',
                  opacity: adminLoading || !newAdminAddress.trim() ? 0.6 : 1,
                  fontWeight: '500'
                }}
              >
                {adminLoading ? '追加中...' : '管理者追加'}
              </button>
            </div>
          </div>

          {/* 現在の管理者一覧 */}
          <div style={{ 
            padding: '1rem', 
            border: '1px solid #ccc',
            borderRadius: '8px'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h4>現在の管理者一覧</h4>
              <button
                onClick={fetchAdminAddresses}
                disabled={adminLoading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: adminLoading ? 'not-allowed' : 'pointer',
                  opacity: adminLoading ? 0.6 : 1,
                  fontSize: '0.9rem'
                }}
              >
                {adminLoading ? '更新中...' : '更新'}
              </button>
            </div>

            {adminLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <p>管理者一覧を読み込み中...</p>
              </div>
            ) : adminAddresses.length > 0 ? (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {adminAddresses.map((address, index) => (
                  <div key={index} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    background: '#f8f9fa',
                    borderRadius: '8px',
                    marginBottom: '0.75rem',
                    border: '1px solid #e9ecef'
                  }}>
                    <div>
                      <span style={{
                        fontSize: '0.9rem',
                        fontFamily: 'monospace',
                        color: '#495057',
                        wordBreak: 'break-all'
                      }}>
                        {address}
                      </span>
                      {index === 0 && (
                        <span style={{
                          background: '#28a745',
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          marginLeft: '0.5rem'
                        }}>
                          メイン管理者
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveAdminAddress(address)}
                      disabled={adminAddresses.length <= 1}
                      style={{
                        padding: '0.5rem 1rem',
                        background: adminAddresses.length <= 1 ? '#6c757d' : '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: adminAddresses.length <= 1 ? 'not-allowed' : 'pointer',
                        opacity: adminAddresses.length <= 1 ? 0.6 : 1,
                        fontSize: '0.8rem'
                      }}
                      title={adminAddresses.length <= 1 ? '最低1つの管理者が必要です' : '管理者を削除'}
                    >
                      削除
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem',
                color: '#666',
                fontStyle: 'italic'
              }}>
                <p>管理者が登録されていません</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'dm-settings' && (
        <div>
          <h3>DM通知設定</h3>
          
          {dmSettings ? (
            <div>
              {/* 現在の設定表示 */}
              {!dmEditing ? (
                <div style={{ 
                  marginBottom: '2rem', 
                  padding: '1rem', 
                  border: '1px solid #ccc',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4>現在の設定</h4>
                    <button
                      onClick={() => {
                        setEditingDm({ ...dmSettings });
                        setDmEditing(true);
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      編集
                    </button>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <strong>通常認証時のDM通知モード:</strong> {
                        dmSettings.mode === 'all' ? '全ての通知' :
                        dmSettings.mode === 'new_and_revoke' ? '新規認証とロール削除のみ' :
                        dmSettings.mode === 'update_and_revoke' ? '認証更新とロール削除のみ' :
                        dmSettings.mode === 'revoke_only' ? 'ロール削除のみ' :
                        '通知なし'
                      }
                    </div>
                    <div>
                      <strong>バッチ処理時のDM通知モード:</strong> {
                        dmSettings.batchMode === 'all' ? '全ての通知' :
                        dmSettings.batchMode === 'new_and_revoke' ? '新規認証とロール削除のみ' :
                        dmSettings.batchMode === 'update_and_revoke' ? '認証更新とロール削除のみ' :
                        dmSettings.batchMode === 'revoke_only' ? 'ロール削除のみ' :
                        '通知なし'
                      }
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <h4 style={{ marginBottom: '0.5rem' }}>📱 DMテンプレート</h4>
                    <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                      <h5>🎉 新規認証</h5>
                      <div><strong>タイトル:</strong> {dmSettings.templates.successNew.title}</div>
                      <div><strong>内容:</strong> {dmSettings.templates.successNew.description}</div>
                    </div>
                    <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                      <h5>🔄 認証更新</h5>
                      <div><strong>タイトル:</strong> {dmSettings.templates.successUpdate.title}</div>
                      <div><strong>内容:</strong> {dmSettings.templates.successUpdate.description}</div>
                    </div>
                    <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                      <h5>❌ 認証失敗</h5>
                      <div><strong>タイトル:</strong> {dmSettings.templates.failed.title}</div>
                      <div><strong>内容:</strong> {dmSettings.templates.failed.description}</div>
                    </div>
                    <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                      <h5>🚫 ロール削除</h5>
                      <div><strong>タイトル:</strong> {dmSettings.templates.revoked.title}</div>
                      <div><strong>内容:</strong> {dmSettings.templates.revoked.description}</div>
                    </div>
                    
                    <h4 style={{ marginBottom: '0.5rem', marginTop: '1rem' }}>📺 チャンネルテンプレート</h4>
                    <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                      <h5>🎫 認証チャンネル</h5>
                      <div><strong>タイトル:</strong> {dmSettings.channelTemplates?.verificationChannel?.title || 'Not set'}</div>
                      <div><strong>内容:</strong> {dmSettings.channelTemplates?.verificationChannel?.description || 'Not set'}</div>
                    </div>
                    <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                      <h5>▶️ 認証開始</h5>
                      <div><strong>タイトル:</strong> {dmSettings.channelTemplates?.verificationStart?.title || 'Not set'}</div>
                      <div><strong>内容:</strong> {dmSettings.channelTemplates?.verificationStart?.description || 'Not set'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                /* 編集モード */
                <div style={{ 
                  marginBottom: '2rem', 
                  padding: '1rem', 
                  border: '1px solid #ccc',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h4>設定を編集</h4>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={saveDmSettings}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#28a745',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        保存
                      </button>
                      <button
                        onClick={() => {
                          setDmEditing(false);
                          setEditingDm(null);
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#6c757d',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                  
                  {editingDm && (
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                            通常認証時のDM通知モード
                          </label>
                          <select
                            value={editingDm.mode}
                            onChange={(e) => setEditingDm({ ...editingDm, mode: e.target.value as DmMode })}
                            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
                          >
                            <option value="all">全ての通知</option>
                            <option value="new_and_revoke">新規認証とロール削除のみ</option>
                            <option value="update_and_revoke">認証更新とロール削除のみ</option>
                            <option value="revoke_only">ロール削除のみ</option>
                            <option value="none">通知なし</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                            バッチ処理時のDM通知モード
                          </label>
                          <select
                            value={editingDm.batchMode}
                            onChange={(e) => setEditingDm({ ...editingDm, batchMode: e.target.value as DmMode })}
                            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
                          >
                            <option value="all">全ての通知</option>
                            <option value="new_and_revoke">新規認証とロール削除のみ</option>
                            <option value="update_and_revoke">認証更新とロール削除のみ</option>
                            <option value="revoke_only">ロール削除のみ</option>
                            <option value="none">通知なし</option>
                          </select>
                        </div>
                      </div>
                      
                      <div style={{ display: 'grid', gap: '1rem' }}>
                        <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                          <h5>🎉 新規認証</h5>
                          <input
                            type="text"
                            placeholder="タイトル"
                            value={editingDm.templates.successNew.title}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                successNew: { ...editingDm.templates.successNew, title: e.target.value }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                          <textarea
                            placeholder="内容"
                            value={editingDm.templates.successNew.description}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                successNew: { ...editingDm.templates.successNew, description: e.target.value }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
                          />
                        </div>
                        
                        <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                          <h5>🔄 認証更新</h5>
                          <input
                            type="text"
                            placeholder="タイトル"
                            value={editingDm.templates.successUpdate.title}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                successUpdate: { ...editingDm.templates.successUpdate, title: e.target.value }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                          <textarea
                            placeholder="内容"
                            value={editingDm.templates.successUpdate.description}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                successUpdate: { ...editingDm.templates.successUpdate, description: e.target.value }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
                          />
                        </div>
                        
                        <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                          <h5>❌ 認証失敗</h5>
                          <input
                            type="text"
                            placeholder="タイトル"
                            value={editingDm.templates.failed.title}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                failed: { ...editingDm.templates.failed, title: e.target.value }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                          <textarea
                            placeholder="内容"
                            value={editingDm.templates.failed.description}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                failed: { ...editingDm.templates.failed, description: e.target.value }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
                          />
                        </div>
                        
                        <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                          <h5>🚫 ロール削除</h5>
                          <input
                            type="text"
                            placeholder="タイトル"
                            value={editingDm.templates.revoked.title}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                revoked: { ...editingDm.templates.revoked, title: e.target.value }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                          <textarea
                            placeholder="内容"
                            value={editingDm.templates.revoked.description}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                revoked: { ...editingDm.templates.revoked, description: e.target.value }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
                          />
                        </div>
                        
                        <h4 style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>📺 チャンネルテンプレート</h4>
                        
                        <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                          <h5>🎫 認証チャンネル</h5>
                          <input
                            type="text"
                            placeholder="タイトル"
                            value={editingDm.channelTemplates?.verificationChannel?.title || ''}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              channelTemplates: {
                                ...editingDm.channelTemplates,
                                verificationChannel: { 
                                  ...editingDm.channelTemplates?.verificationChannel, 
                                  title: e.target.value 
                                }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                          <textarea
                            placeholder="内容"
                            value={editingDm.channelTemplates?.verificationChannel?.description || ''}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              channelTemplates: {
                                ...editingDm.channelTemplates,
                                verificationChannel: { 
                                  ...editingDm.channelTemplates?.verificationChannel, 
                                  description: e.target.value 
                                }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
                          />
                        </div>
                        
                        <div style={{ padding: '1rem', border: '1px solid #e9ecef', borderRadius: '4px' }}>
                          <h5>▶️ 認証開始</h5>
                          <input
                            type="text"
                            placeholder="タイトル"
                            value={editingDm.channelTemplates?.verificationStart?.title || ''}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              channelTemplates: {
                                ...editingDm.channelTemplates,
                                verificationStart: { 
                                  ...editingDm.channelTemplates?.verificationStart, 
                                  title: e.target.value 
                                }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                          />
                          <textarea
                            placeholder="内容"
                            value={editingDm.channelTemplates?.verificationStart?.description || ''}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              channelTemplates: {
                                ...editingDm.channelTemplates,
                                verificationStart: { 
                                  ...editingDm.channelTemplates?.verificationStart, 
                                  description: e.target.value 
                                }
                              }
                            })}
                            style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', minHeight: '100px' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>DM設定を読み込み中...</p>
            </div>
          )}
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