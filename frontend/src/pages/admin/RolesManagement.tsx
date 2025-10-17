import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { Breadcrumb } from '../../components/admin/Breadcrumb';
import { PageHeader } from '../../components/admin/PageHeader';
import type { NFTCollection, DiscordRole, BatchConfig, BatchStats, VerifiedUser, DmSettings } from '../../types';
import { useWalletWithErrorHandling } from '../../hooks/useWallet';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

export default function RolesManagement() {
  const { account, connected } = useWalletWithErrorHandling() as any;
  const [activeTab, setActiveTab] = useState<'collections' | 'users' | 'batch' | 'dm-settings'>('collections');
  
  // States
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [discordRoles, setDiscordRoles] = useState<DiscordRole[]>([]);
  const [verifiedUsers, setVerifiedUsers] = useState<VerifiedUser[]>([]);
  const [batchConfig, setBatchConfig] = useState<BatchConfig | null>(null);
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);
  const [dmSettings, setDmSettings] = useState<DmSettings | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  const [editingCollection, setEditingCollection] = useState<NFTCollection | null>(null);
  const [newCollection, setNewCollection] = useState({
    name: '',
    packageId: '',
    roleId: '',
    roleName: '',
    description: ''
  });

  const [batchConfigEditing, setBatchConfigEditing] = useState(false);
  const [editingBatchConfig, setEditingBatchConfig] = useState<BatchConfig | null>(null);
  const [dmEditing, setDmEditing] = useState(false);
  const [editingDm, setEditingDm] = useState<DmSettings | null>(null);

  // データ取得関数をメモ化
  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/collections`, { 
        headers: getAuthHeaders() 
      });
      const data = await res.json();
      if (data.success) setCollections(data.data || []);
    } catch (e) {
      console.error('Failed to fetch collections', e);
    }
  }, []);

  const fetchDiscordRoles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/discord/roles`, { 
        headers: getAuthHeaders() 
      });
      const data = await res.json();
      if (data.success) setDiscordRoles(data.data || []);
    } catch (e) {
      console.error('Failed to fetch discord roles', e);
    }
  }, []);

  const fetchVerifiedUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/verified-users`, { 
        headers: getAuthHeaders() 
      });
      const data = await res.json();
      if (data.success) setVerifiedUsers(data.data || []);
    } catch (e) {
      console.error('Failed to fetch verified users', e);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const fetchBatchConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/batch-config`, { 
        headers: getAuthHeaders() 
      });
      const data = await res.json();
      if (data.success) setBatchConfig(data.data);
    } catch (e) {
      console.error('Failed to fetch batch config', e);
    }
  }, []);

  const fetchBatchStats = useCallback(async () => {
    setBatchLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/batch-stats`, { 
        headers: getAuthHeaders() 
      });
      const data = await res.json();
      if (data.success) setBatchStats(data.data);
    } catch (e) {
      console.error('Failed to fetch batch stats', e);
    } finally {
      setBatchLoading(false);
    }
  }, []);

  const fetchDmSettings = useCallback(async () => {
    try {
      console.log('Fetching DM settings...');
      const res = await fetch(`${API_BASE_URL}/api/admin/dm-settings`, { 
        headers: getAuthHeaders() 
      });
      const data = await res.json();
      console.log('DM settings response:', data);
      if (data.success) {
        setDmSettings(data.data);
        console.log('DM settings set:', data.data);
      } else {
        console.error('DM settings fetch failed:', data.error);
      }
    } catch (e) {
      console.error('Failed to fetch DM settings', e);
    }
  }, []);

  useEffect(() => {
    fetchCollections();
    fetchDiscordRoles();
    fetchVerifiedUsers();
    fetchBatchConfig();
    fetchBatchStats();
    fetchDmSettings();
  }, [fetchCollections, fetchDiscordRoles, fetchVerifiedUsers, fetchBatchConfig, fetchBatchStats, fetchDmSettings]);

  // タブ変更時にデータを取得
  useEffect(() => {
    if (activeTab === 'users') {
      fetchVerifiedUsers();
    } else if (activeTab === 'batch') {
      fetchBatchConfig();
      fetchBatchStats();
    } else if (activeTab === 'dm-settings') {
      fetchDmSettings();
    } else if (activeTab === 'collections') {
      fetchCollections();
      fetchDiscordRoles();
    }
  }, [activeTab]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const getAuthHeaders = (): HeadersInit => {
    const addr = typeof window !== 'undefined' 
      ? localStorage.getItem('currentWalletAddress') || (window as any).currentWalletAddress 
      : undefined;
    return {
      'Content-Type': 'application/json',
      ...(addr ? { 'X-Admin-Address': addr } : {})
    };
  };


  const handleRoleSelect = (roleId: string) => {
    const role = discordRoles.find(r => r.id === roleId);
    if (role) {
      setNewCollection({
        ...newCollection,
        roleId: role.id,
        roleName: role.name
      });
    }
  };

  const handleAddCollection = async () => {
    if (!newCollection.name || !newCollection.packageId || !newCollection.roleId) {
      setMessage('すべての必須項目を入力してください');
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
        setMessage('コレクションを追加しました');
        setNewCollection({ name: '', packageId: '', roleId: '', roleName: '', description: '' });
        fetchCollections();
      } else {
        setMessage(data.error || '追加に失敗しました');
      }
    } catch {
      setMessage('追加に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleEditCollection = (collection: NFTCollection) => {
    setEditingCollection(collection);
    setNewCollection({
      name: collection.name,
      packageId: collection.packageId,
      roleId: collection.roleId,
      roleName: collection.roleName,
      description: collection.description || ''
    });
  };

  const handleUpdateCollection = async () => {
    if (!editingCollection) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/collections/${editingCollection.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(newCollection)
      });
      const data = await response.json();
      if (data.success) {
        setMessage('コレクションを更新しました');
        handleCancelEdit();
        fetchCollections();
      } else {
        setMessage(data.error || '更新に失敗しました');
      }
    } catch {
      setMessage('更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingCollection(null);
    setNewCollection({ name: '', packageId: '', roleId: '', roleName: '', description: '' });
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm('このコレクションを削除しますか？')) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/collections/${collectionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (data.success) {
        setMessage('コレクションを削除しました');
        fetchCollections();
      } else {
        setMessage(data.error || '削除に失敗しました');
      }
    } catch {
      setMessage('削除に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleEditBatchConfig = () => {
    setBatchConfigEditing(true);
    setEditingBatchConfig(batchConfig);
  };

  const handleCancelBatchConfigEdit = () => {
    setBatchConfigEditing(false);
    setEditingBatchConfig(null);
  };

  const handleSaveBatchConfig = async () => {
    if (!editingBatchConfig) return;
    setBatchLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/batch-config`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editingBatchConfig)
      });
      const data = await response.json();
      if (data.success) {
        setMessage('バッチ設定を更新しました');
        setBatchConfig(data.data);
        setBatchConfigEditing(false);
        setEditingBatchConfig(null);
        fetchBatchStats();
      } else {
        setMessage(data.error || '更新に失敗しました');
      }
    } catch {
      setMessage('更新に失敗しました');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleRunBatchNow = async () => {
    if (!confirm('バッチ処理を実行しますか？')) return;
    setBatchLoading(true);
    setMessage('バッチ処理を開始しました...');
    try {
      const response = await fetch(`${API_BASE_URL}/api/batch-process`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          collectionId: collections[0]?.id || '',
          action: 'verify'
        })
      });
      const data = await response.json();
      if (data.success) {
        setMessage(`バッチ処理が完了しました。処理: ${data.data?.processed || 0}件, 失効: ${data.data?.revoked || 0}件`);
        fetchBatchStats();
      } else {
        setMessage(data.error || 'バッチ処理に失敗しました');
      }
    } catch {
      setMessage('バッチ処理に失敗しました');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleEditDmSettings = () => {
    setDmEditing(true);
    setEditingDm(dmSettings);
  };

  const handleCancelDmEdit = () => {
    setDmEditing(false);
    setEditingDm(null);
  };

  const handleSaveDmSettings = async () => {
    if (!editingDm) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/dm-settings`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(editingDm)
      });
      const data = await response.json();
      if (data.success) {
        setMessage('DM設定を更新しました');
        setDmSettings(data.data);
        setDmEditing(false);
        setEditingDm(null);
        fetchDmSettings();
      } else {
        setMessage(data.error || '更新に失敗しました');
      }
    } catch {
      setMessage('更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout currentPath="/admin/roles">
      <Breadcrumb items={[
        { label: 'Dashboard', href: '/admin' },
        { label: 'ロール管理' }
      ]} />

      <PageHeader 
        title="ロール管理"
        description="NFTホルダーへのDiscordロール付与を管理"
      />

      {message && (
        <div style={{
          padding: '1rem',
          background: '#dbeafe',
          border: '1px solid #93c5fd',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          color: '#1e40af',
          fontSize: '0.875rem'
        }}>
          {message}
        </div>
      )}

      {/* タブナビゲーション */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        marginBottom: '1.5rem',
        padding: '0.5rem',
        display: 'flex',
        gap: '0.5rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        {(['collections', 'users', 'batch', 'dm-settings'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              background: activeTab === tab ? '#3b82f6' : 'transparent',
              color: activeTab === tab ? 'white' : '#6b7280',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            {{
              collections: 'コレクション管理',
              users: 'ユーザー管理',
              batch: 'バッチ処理',
              'dm-settings': 'DM設定'
            }[tab]}
          </button>
        ))}
      </div>

      {/* Collections Tab */}
      {activeTab === 'collections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* コレクション追加フォーム */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
              {editingCollection ? 'コレクション編集' : '新しいコレクション追加'}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '600px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
                  コレクション名
                </label>
                <input 
                  type="text" 
                  placeholder="例: SXT NFT Collection" 
                  value={newCollection.name} 
                  onChange={(e) => setNewCollection({...newCollection, name: e.target.value})}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
                  Package ID
                </label>
                <input 
                  type="text" 
                  placeholder="例: 0x123...::nft::NFT" 
                  value={newCollection.packageId} 
                  onChange={(e) => setNewCollection({...newCollection, packageId: e.target.value})}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    outline: 'none'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
                  Discordロール選択
                </label>
                <select
                  value={newCollection.roleId}
                  onChange={(e) => handleRoleSelect(e.target.value)}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    outline: 'none',
                    background: 'white'
                  }}
                >
                  <option value="">ロールを選択してください</option>
                  {discordRoles.length > 0 ? (
                    discordRoles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.name} (ID: {role.id})
                      </option>
                    ))
                  ) : (
                    <option value="" disabled>
                      Discordロールを読み込み中...
                    </option>
                  )}
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
                  ロールID（手動入力）
                </label>
                <input 
                  type="text" 
                  placeholder="Discord ロールIDを手動で入力" 
                  value={newCollection.roleId} 
                  onChange={(e) => setNewCollection({...newCollection, roleId: e.target.value})}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
                  ロール名
                </label>
                <input 
                  type="text" 
                  placeholder="自動設定されます" 
                  value={newCollection.roleName} 
                  onChange={(e) => setNewCollection({...newCollection, roleName: e.target.value})}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    background: '#f9fafb',
                    outline: 'none'
                  }}
                  readOnly
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.875rem', color: '#374151' }}>
                  説明
                </label>
                <textarea 
                  placeholder="コレクションの説明を入力" 
                  value={newCollection.description} 
                  onChange={(e) => setNewCollection({...newCollection, description: e.target.value})}
                  rows={3}
                  style={{ 
                    width: '100%',
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    border: '1px solid #d1d5db',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    outline: 'none'
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                {editingCollection ? (
                  <>
                    <button 
                      onClick={handleUpdateCollection}
                      disabled={loading}
                      style={{
                        flex: 1,
                        padding: '0.75rem 1.5rem',
                        background: loading ? '#d1d5db' : '#3b82f6',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      {loading ? '更新中...' : 'コレクション更新'}
                    </button>
                    <button 
                      onClick={handleCancelEdit}
                      disabled={loading}
                      style={{
                        flex: 1,
                        padding: '0.75rem 1.5rem',
                        background: 'white',
                        color: '#6b7280',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        transition: 'all 0.2s'
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
                      padding: '0.75rem 1.5rem',
                      background: loading ? '#d1d5db' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    {loading ? '追加中...' : 'コレクション追加'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 既存コレクション一覧 */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
              既存コレクション一覧 ({collections.length}件)
            </h3>
            
            {collections.length === 0 ? (
              <div style={{
                padding: '4rem 2rem',
                textAlign: 'center',
                background: '#f9fafb',
                borderRadius: '8px',
                border: '2px dashed #e5e7eb'
              }}>
                <div style={{ 
                  width: '80px',
                  height: '80px',
                  background: '#e5e7eb',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                  fontSize: '2rem',
                  color: '#9ca3af'
                }}>
                  —
                </div>
                <h4 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                  コレクションがありません
                </h4>
                <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af' }}>
                  新しいコレクションを追加してロール管理を開始しましょう
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {collections.map(collection => (
                  <div key={collection.id} style={{
                    border: '1px solid #e5e7eb',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    background: 'white',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <h4 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>
                          {collection.name}
                        </h4>
                        <span style={{
                          padding: '0.25rem 0.75rem',
                          background: collection.isActive ? '#d1fae5' : '#f3f4f6',
                          color: collection.isActive ? '#047857' : '#6b7280',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          letterSpacing: '0.025em'
                        }}>
                          {collection.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }}>
                        <div>
                          <span style={{ color: '#9ca3af', fontWeight: 500 }}>Package ID: </span>
                          <span style={{ fontFamily: 'monospace', color: '#374151' }}>
                            {collection.packageId.length > 50 
                              ? `${collection.packageId.slice(0, 20)}...${collection.packageId.slice(-20)}`
                              : collection.packageId
                            }
                          </span>
                        </div>
                        <div>
                          <span style={{ color: '#9ca3af', fontWeight: 500 }}>Discord Role: </span>
                          <span style={{ color: '#374151', fontWeight: 600 }}>{collection.roleName}</span>
                          <span style={{ color: '#9ca3af', fontFamily: 'monospace', marginLeft: '0.5rem' }}>
                            ({collection.roleId})
                          </span>
                        </div>
                        {collection.description && (
                          <div>
                            <span style={{ color: '#9ca3af', fontWeight: 500 }}>説明: </span>
                            <span style={{ color: '#6b7280' }}>{collection.description}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                      <button
                        onClick={() => handleEditCollection(collection)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#2563eb'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#3b82f6'}
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDeleteCollection(collection.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: 'white',
                          color: '#ef4444',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#ef4444';
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'white';
                          e.currentTarget.style.color = '#ef4444';
                        }}
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '2rem',
            paddingBottom: '1rem',
            borderBottom: '2px solid #e5e7eb'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
                認証済みユーザー一覧
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                総ユーザー数: {verifiedUsers.length}人
              </p>
            </div>
            <button
              onClick={fetchVerifiedUsers}
              disabled={usersLoading}
              style={{
                padding: '0.75rem 1.5rem',
                background: usersLoading ? '#d1d5db' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: usersLoading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                transition: 'all 0.2s'
              }}
            >
              {usersLoading ? '更新中...' : '更新'}
            </button>
          </div>

          {usersLoading ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>
              <div style={{
                width: '60px',
                height: '60px',
                border: '4px solid #e5e7eb',
                borderTop: '4px solid #3b82f6',
                borderRadius: '50%',
                margin: '0 auto 1rem',
                animation: 'spin 1s linear infinite'
              }} />
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>ユーザー一覧を読み込み中...</p>
            </div>
          ) : verifiedUsers.length > 0 ? (
            <div style={{ 
              overflowX: 'auto',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#f9fafb' }}>
                  <tr>
                    <th style={{ 
                      padding: '1rem', 
                      textAlign: 'left', 
                      fontWeight: 600, 
                      fontSize: '0.75rem', 
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      Discord ID
                    </th>
                    <th style={{ 
                      padding: '1rem', 
                      textAlign: 'left', 
                      fontWeight: 600, 
                      fontSize: '0.75rem', 
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      ウォレットアドレス
                    </th>
                    <th style={{ 
                      padding: '1rem', 
                      textAlign: 'left', 
                      fontWeight: 600, 
                      fontSize: '0.75rem', 
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      ロール
                    </th>
                    <th style={{ 
                      padding: '1rem', 
                      textAlign: 'left', 
                      fontWeight: 600, 
                      fontSize: '0.75rem', 
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      認証日時
                    </th>
                    <th style={{ 
                      padding: '1rem', 
                      textAlign: 'left', 
                      fontWeight: 600, 
                      fontSize: '0.75rem', 
                      color: '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      最終チェック
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {verifiedUsers.map((user, index) => (
                    <tr 
                      key={index} 
                      style={{ 
                        borderBottom: '1px solid #f3f4f6',
                        background: 'white',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>
                        {user.discordId}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ 
                            fontFamily: 'monospace', 
                            fontSize: '0.875rem', 
                            color: '#6b7280' 
                          }}>
                            {user.address.length > 20 
                              ? `${user.address.slice(0, 8)}...${user.address.slice(-6)}` 
                              : user.address
                            }
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(user.address);
                              setMessage('アドレスをコピーしました');
                            }}
                            style={{
                              padding: '0.25rem 0.5rem',
                              background: '#f3f4f6',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              color: '#6b7280',
                              fontWeight: 500,
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                          >
                            Copy
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ 
                          background: '#eff6ff', 
                          color: '#1e40af', 
                          padding: '0.375rem 0.75rem', 
                          borderRadius: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          border: '1px solid #bfdbfe'
                        }}>
                          {user.roleName}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#374151' }}>
                        {new Date(user.verifiedAt).toLocaleDateString('ja-JP', { 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
                        {user.lastChecked 
                          ? new Date(user.lastChecked).toLocaleDateString('ja-JP', { 
                              month: 'short', 
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) 
                          : '未チェック'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '2px dashed #e5e7eb'
            }}>
              <div style={{ 
                width: '80px',
                height: '80px',
                background: '#e5e7eb',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem',
                fontSize: '2rem',
                color: '#9ca3af'
              }}>
                —
              </div>
              <h4 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                認証済みユーザーがいません
              </h4>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#9ca3af' }}>
                ユーザーがNFT認証を完了すると、ここに表示されます
              </p>
            </div>
          )}
        </div>
      )}

      {/* Batch Tab */}
      {activeTab === 'batch' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* バッチ処理設定 */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
                バッチ処理設定
              </h3>
              {!batchConfigEditing && batchConfig && (
                <button
                  onClick={handleEditBatchConfig}
                  disabled={batchLoading}
                  style={{
                    padding: '0.625rem 1.25rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: batchLoading ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    transition: 'all 0.2s'
                  }}
                >
                  設定を編集
                </button>
              )}
            </div>

            {batchConfig && (
              <>
                {/* 現在の設定表示 */}
                {!batchConfigEditing ? (
                  <div style={{ 
                    background: '#f9fafb', 
                    padding: '1.5rem', 
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#374151' }}>
                      現在の設定
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.25rem' }}>
                          バッチ処理
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 600 }}>
                          {batchConfig.enabled ? '有効' : '無効'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.25rem' }}>
                          実行間隔
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 600 }}>
                          {batchConfig.interval}分
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.25rem' }}>
                          バッチサイズ
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 600 }}>
                          {batchConfig.maxUsersPerBatch}ユーザー
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.25rem' }}>
                          リトライ回数
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 600 }}>
                          {batchConfig.retryAttempts}回
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.25rem' }}>
                          DM通知
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 600 }}>
                          {batchConfig.enableDmNotifications ? '有効' : '無効'}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.25rem' }}>
                          最終実行
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 600 }}>
                          {batchConfig.lastRun ? new Date(batchConfig.lastRun).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未実行'}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : editingBatchConfig && (
                  /* 編集フォーム */
                  <div style={{ 
                    background: '#fef3c7', 
                    padding: '1.5rem', 
                    borderRadius: '8px',
                    border: '1px solid #fbbf24'
                  }}>
                    <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 600, color: '#92400e' }}>
                      設定を編集
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={editingBatchConfig.enabled}
                            onChange={(e) => setEditingBatchConfig({
                              ...editingBatchConfig,
                              enabled: e.target.checked
                            })}
                            disabled={batchLoading}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                            バッチ処理を有効にする
                          </span>
                        </label>
                      </div>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                            実行間隔（分）
                          </label>
                          <input
                            type="number"
                            value={editingBatchConfig.interval}
                            onChange={(e) => setEditingBatchConfig({
                              ...editingBatchConfig,
                              interval: parseInt(e.target.value) || 0
                            })}
                            disabled={batchLoading}
                            min="1"
                            style={{ 
                              width: '100%',
                              padding: '0.75rem 1rem', 
                              borderRadius: '8px', 
                              border: '1px solid #d1d5db',
                              fontSize: '0.875rem',
                              outline: 'none'
                            }}
                          />
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                            バッチサイズ
                          </label>
                          <input
                            type="number"
                            value={editingBatchConfig.maxUsersPerBatch}
                            onChange={(e) => setEditingBatchConfig({
                              ...editingBatchConfig,
                              maxUsersPerBatch: parseInt(e.target.value) || 0
                            })}
                            disabled={batchLoading}
                            min="1"
                            style={{ 
                              width: '100%',
                              padding: '0.75rem 1rem', 
                              borderRadius: '8px', 
                              border: '1px solid #d1d5db',
                              fontSize: '0.875rem',
                              outline: 'none'
                            }}
                          />
                        </div>
                        
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                            リトライ回数
                          </label>
                          <input
                            type="number"
                            value={editingBatchConfig.retryAttempts}
                            onChange={(e) => setEditingBatchConfig({
                              ...editingBatchConfig,
                              retryAttempts: parseInt(e.target.value) || 0
                            })}
                            disabled={batchLoading}
                            min="0"
                            style={{ 
                              width: '100%',
                              padding: '0.75rem 1rem', 
                              borderRadius: '8px', 
                              border: '1px solid #d1d5db',
                              fontSize: '0.875rem',
                              outline: 'none'
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={editingBatchConfig.enableDmNotifications}
                            onChange={(e) => setEditingBatchConfig({
                              ...editingBatchConfig,
                              enableDmNotifications: e.target.checked
                            })}
                            disabled={batchLoading}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                            バッチ処理時のDM通知を有効にする
                          </span>
                        </label>
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <button
                          onClick={handleSaveBatchConfig}
                          disabled={batchLoading}
                          style={{
                            padding: '0.75rem 1.5rem',
                            background: batchLoading ? '#d1d5db' : '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: batchLoading ? 'not-allowed' : 'pointer',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            transition: 'all 0.2s'
                          }}
                        >
                          {batchLoading ? '保存中...' : '設定を保存'}
                        </button>
                        <button
                          onClick={handleCancelBatchConfigEdit}
                          disabled={batchLoading}
                          style={{
                            padding: '0.75rem 1.5rem',
                            background: 'white',
                            color: '#6b7280',
                            border: '1px solid #d1d5db',
                            borderRadius: '8px',
                            cursor: batchLoading ? 'not-allowed' : 'pointer',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            transition: 'all 0.2s'
                          }}
                        >
                          キャンセル
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* 手動実行 */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
              バッチ処理を実行
            </h3>
            <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.875rem', color: '#6b7280', lineHeight: 1.6 }}>
              登録されている全ユーザーのNFT保有状態を確認し、Discordロールを更新します。
            </p>
            <button
              onClick={handleRunBatchNow}
              disabled={batchLoading}
              style={{
                padding: '0.75rem 2rem',
                background: batchLoading ? '#d1d5db' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: batchLoading ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                boxShadow: batchLoading ? 'none' : '0 1px 3px rgba(16, 185, 129, 0.4)',
                transition: 'all 0.2s'
              }}
            >
              {batchLoading ? '実行中...' : 'バッチ処理を実行'}
            </button>
          </div>

          {/* バッチ処理統計 */}
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '1.5rem' 
            }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
                バッチ処理統計
              </h3>
              <button
                onClick={() => {
                  fetchBatchStats();
                  setMessage('統計を更新しました');
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: '#374151',
                  transition: 'all 0.2s'
                }}
              >
                更新
              </button>
            </div>
            
            {batchStats ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div style={{ 
                  padding: '1.5rem', 
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', 
                  borderRadius: '12px',
                  border: '1px solid #bfdbfe'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#1e40af', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    総ユーザー数
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e3a8a' }}>
                    {batchStats.totalUsers.toLocaleString()}
                  </div>
                </div>
                
                <div style={{ 
                  padding: '1.5rem', 
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', 
                  borderRadius: '12px',
                  border: '1px solid #bbf7d0'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    処理完了
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#14532d' }}>
                    {batchStats.processed.toLocaleString()}
                  </div>
                </div>
                
                <div style={{ 
                  padding: '1.5rem', 
                  background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)', 
                  borderRadius: '12px',
                  border: '1px solid #fecaca'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    ロール削除
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#7f1d1d' }}>
                    {batchStats.revoked.toLocaleString()}
                  </div>
                </div>
                
                <div style={{ 
                  padding: '1.5rem', 
                  background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', 
                  borderRadius: '12px',
                  border: '1px solid #fde68a'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    エラー数
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#78350f' }}>
                    {batchStats.errors.toLocaleString()}
                  </div>
                </div>
                
                <div style={{ 
                  padding: '1.5rem', 
                  background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)', 
                  borderRadius: '12px',
                  border: '1px solid #ddd6fe'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b21a8', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    処理時間
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 700, color: '#581c87' }}>
                    {batchStats.duration.toLocaleString()}
                    <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#9333ea', marginLeft: '0.25rem' }}>ms</span>
                  </div>
                </div>
                
                <div style={{ 
                  padding: '1.5rem', 
                  background: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)', 
                  borderRadius: '12px',
                  border: '1px solid #e5e7eb',
                  gridColumn: window.innerWidth >= 768 ? 'span 2' : 'auto'
                }}>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    最終実行
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#374151' }}>
                    {batchStats.lastRun 
                      ? new Date(batchStats.lastRun).toLocaleString('ja-JP', { 
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }) 
                      : '未実行'
                    }
                  </div>
                </div>
              </div>
            ) : (
              <div style={{
                padding: '3rem',
                textAlign: 'center',
                background: '#f9fafb',
                borderRadius: '8px',
                color: '#9ca3af'
              }}>
                統計データを読み込み中...
              </div>
            )}
          </div>
        </div>
      )}

      {/* DM Settings Tab */}
      {activeTab === 'dm-settings' && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '2rem',
            paddingBottom: '1rem',
            borderBottom: '2px solid #e5e7eb'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
                DM通知設定
              </h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                Discord DMメッセージのテンプレートと通知モードを設定
              </p>
            </div>
            {!dmEditing && dmSettings && (
              <button
                onClick={handleEditDmSettings}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  transition: 'all 0.2s'
                }}
              >
                設定を編集
              </button>
            )}
          </div>

          {console.log('DM Settings state:', dmSettings) || dmSettings ? (
            dmEditing && editingDm ? (
              /* 編集モード */
              <div>
                {/* 通知モード設定 */}
                <div style={{ 
                  background: '#fef3c7', 
                  padding: '1.5rem', 
                  borderRadius: '8px',
                  border: '1px solid #fbbf24',
                  marginBottom: '2rem'
                }}>
                  <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 600, color: '#92400e' }}>
                    通知モード
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                        通常認証時のDM通知
                      </label>
                      <select
                        value={editingDm.mode}
                        onChange={(e) => setEditingDm({ ...editingDm, mode: e.target.value as any })}
                        style={{ 
                          width: '100%',
                          padding: '0.75rem 1rem', 
                          borderRadius: '8px', 
                          border: '1px solid #d1d5db',
                          fontSize: '0.875rem',
                          outline: 'none',
                          background: 'white'
                        }}
                      >
                        <option value="all">全ての通知</option>
                        <option value="new_and_revoke">新規認証とロール削除のみ</option>
                        <option value="update_and_revoke">認証更新とロール削除のみ</option>
                        <option value="revoke_only">ロール削除のみ</option>
                        <option value="none">通知なし</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#374151' }}>
                        バッチ処理時のDM通知
                      </label>
                      <select
                        value={editingDm.batchMode}
                        onChange={(e) => setEditingDm({ ...editingDm, batchMode: e.target.value as any })}
                        style={{ 
                          width: '100%',
                          padding: '0.75rem 1rem', 
                          borderRadius: '8px', 
                          border: '1px solid #d1d5db',
                          fontSize: '0.875rem',
                          outline: 'none',
                          background: 'white'
                        }}
                      >
                        <option value="all">全ての通知</option>
                        <option value="new_and_revoke">新規認証とロール削除のみ</option>
                        <option value="update_and_revoke">認証更新とロール削除のみ</option>
                        <option value="revoke_only">ロール削除のみ</option>
                        <option value="none">通知なし</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* DMテンプレート */}
                <div style={{ marginBottom: '2rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                    DMテンプレート
                  </h4>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {/* 新規認証 */}
                    <div style={{ padding: '1.5rem', border: '1px solid #d1fae5', borderRadius: '8px', background: '#f0fdf4' }}>
                      <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', fontWeight: 600, color: '#15803d' }}>
                        新規認証成功
                      </h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                            タイトル
                          </label>
                          <input
                            type="text"
                            value={editingDm.templates.successNew.title}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                successNew: { ...editingDm.templates.successNew, title: e.target.value }
                              }
                            })}
                            style={{ 
                              width: '100%', 
                              padding: '0.625rem 0.875rem', 
                              borderRadius: '6px', 
                              border: '1px solid #bbf7d0',
                              fontSize: '0.875rem',
                              outline: 'none',
                              background: 'white'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                            メッセージ内容
                          </label>
                          <textarea
                            value={editingDm.templates.successNew.description}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                successNew: { ...editingDm.templates.successNew, description: e.target.value }
                              }
                            })}
                            rows={4}
                            style={{ 
                              width: '100%', 
                              padding: '0.625rem 0.875rem', 
                              borderRadius: '6px', 
                              border: '1px solid #bbf7d0',
                              fontSize: '0.875rem',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                              lineHeight: 1.5,
                              outline: 'none',
                              background: 'white'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 認証更新 */}
                    <div style={{ padding: '1.5rem', border: '1px solid #bfdbfe', borderRadius: '8px', background: '#eff6ff' }}>
                      <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', fontWeight: 600, color: '#1e40af' }}>
                        認証更新
                      </h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                            タイトル
                          </label>
                          <input
                            type="text"
                            value={editingDm.templates.successUpdate.title}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                successUpdate: { ...editingDm.templates.successUpdate, title: e.target.value }
                              }
                            })}
                            style={{ 
                              width: '100%', 
                              padding: '0.625rem 0.875rem', 
                              borderRadius: '6px', 
                              border: '1px solid #93c5fd',
                              fontSize: '0.875rem',
                              outline: 'none',
                              background: 'white'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                            メッセージ内容
                          </label>
                          <textarea
                            value={editingDm.templates.successUpdate.description}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                successUpdate: { ...editingDm.templates.successUpdate, description: e.target.value }
                              }
                            })}
                            rows={4}
                            style={{ 
                              width: '100%', 
                              padding: '0.625rem 0.875rem', 
                              borderRadius: '6px', 
                              border: '1px solid #93c5fd',
                              fontSize: '0.875rem',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                              lineHeight: 1.5,
                              outline: 'none',
                              background: 'white'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 認証失敗 */}
                    <div style={{ padding: '1.5rem', border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2' }}>
                      <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', fontWeight: 600, color: '#991b1b' }}>
                        認証失敗
                      </h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                            タイトル
                          </label>
                          <input
                            type="text"
                            value={editingDm.templates.failed.title}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                failed: { ...editingDm.templates.failed, title: e.target.value }
                              }
                            })}
                            style={{ 
                              width: '100%', 
                              padding: '0.625rem 0.875rem', 
                              borderRadius: '6px', 
                              border: '1px solid #fca5a5',
                              fontSize: '0.875rem',
                              outline: 'none',
                              background: 'white'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                            メッセージ内容
                          </label>
                          <textarea
                            value={editingDm.templates.failed.description}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                failed: { ...editingDm.templates.failed, description: e.target.value }
                              }
                            })}
                            rows={4}
                            style={{ 
                              width: '100%', 
                              padding: '0.625rem 0.875rem', 
                              borderRadius: '6px', 
                              border: '1px solid #fca5a5',
                              fontSize: '0.875rem',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                              lineHeight: 1.5,
                              outline: 'none',
                              background: 'white'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* ロール削除 */}
                    <div style={{ padding: '1.5rem', border: '1px solid #fed7aa', borderRadius: '8px', background: '#fff7ed' }}>
                      <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', fontWeight: 600, color: '#9a3412' }}>
                        ロール削除
                      </h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                            タイトル
                          </label>
                          <input
                            type="text"
                            value={editingDm.templates.revoked.title}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                revoked: { ...editingDm.templates.revoked, title: e.target.value }
                              }
                            })}
                            style={{ 
                              width: '100%', 
                              padding: '0.625rem 0.875rem', 
                              borderRadius: '6px', 
                              border: '1px solid #fdba74',
                              fontSize: '0.875rem',
                              outline: 'none',
                              background: 'white'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                            メッセージ内容
                          </label>
                          <textarea
                            value={editingDm.templates.revoked.description}
                            onChange={(e) => setEditingDm({
                              ...editingDm,
                              templates: {
                                ...editingDm.templates,
                                revoked: { ...editingDm.templates.revoked, description: e.target.value }
                              }
                            })}
                            rows={4}
                            style={{ 
                              width: '100%', 
                              padding: '0.625rem 0.875rem', 
                              borderRadius: '6px', 
                              border: '1px solid #fdba74',
                              fontSize: '0.875rem',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                              lineHeight: 1.5,
                              outline: 'none',
                              background: 'white'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* チャンネルテンプレート */}
                <div style={{ marginBottom: '2rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                    チャンネルテンプレート
                  </h4>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {/* 認証チャンネル */}
                    <div style={{ padding: '1.5rem', border: '1px solid #e0e7ff', borderRadius: '8px', background: '#f5f3ff' }}>
                      <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', fontWeight: 600, color: '#5b21b6' }}>
                        認証チャンネル
                      </h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                            タイトル
                          </label>
                          <input
                            type="text"
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
                            style={{ 
                              width: '100%', 
                              padding: '0.625rem 0.875rem', 
                              borderRadius: '6px', 
                              border: '1px solid #c7d2fe',
                              fontSize: '0.875rem',
                              outline: 'none',
                              background: 'white'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                            メッセージ内容
                          </label>
                          <textarea
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
                            rows={4}
                            style={{ 
                              width: '100%', 
                              padding: '0.625rem 0.875rem', 
                              borderRadius: '6px', 
                              border: '1px solid #c7d2fe',
                              fontSize: '0.875rem',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                              lineHeight: 1.5,
                              outline: 'none',
                              background: 'white'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 認証開始 */}
                    <div style={{ padding: '1.5rem', border: '1px solid #e0e7ff', borderRadius: '8px', background: '#f5f3ff' }}>
                      <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', fontWeight: 600, color: '#5b21b6' }}>
                        認証開始
                      </h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                            タイトル
                          </label>
                          <input
                            type="text"
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
                            style={{ 
                              width: '100%', 
                              padding: '0.625rem 0.875rem', 
                              borderRadius: '6px', 
                              border: '1px solid #c7d2fe',
                              fontSize: '0.875rem',
                              outline: 'none',
                              background: 'white'
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                            メッセージ内容
                          </label>
                          <textarea
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
                            rows={4}
                            style={{ 
                              width: '100%', 
                              padding: '0.625rem 0.875rem', 
                              borderRadius: '6px', 
                              border: '1px solid #c7d2fe',
                              fontSize: '0.875rem',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                              lineHeight: 1.5,
                              outline: 'none',
                              background: 'white'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 認証URL */}
                    <div style={{ padding: '1.5rem', border: '1px solid #d1d5db', borderRadius: '8px', background: '#f9fafb' }}>
                      <h5 style={{ margin: '0 0 1rem 0', fontSize: '0.9375rem', fontWeight: 600, color: '#374151' }}>
                        認証URL設定
                      </h5>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                          ベースURL
                        </label>
                        <input
                          type="text"
                          placeholder="例: https://syndicatextokyo.app"
                          value={editingDm.channelTemplates?.verificationUrl || ''}
                          onChange={(e) => setEditingDm({
                            ...editingDm,
                            channelTemplates: {
                              ...editingDm.channelTemplates,
                              verificationUrl: e.target.value
                            }
                          })}
                          style={{ 
                            width: '100%', 
                            padding: '0.625rem 0.875rem', 
                            borderRadius: '6px', 
                            border: '1px solid #d1d5db',
                            fontSize: '0.875rem',
                            outline: 'none',
                            background: 'white',
                            fontFamily: 'monospace'
                          }}
                        />
                        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5 }}>
                          実際のURLは「ベースURL?discord_id=ユーザーID」の形式で生成されます
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 保存ボタン */}
                <div style={{ 
                  display: 'flex', 
                  gap: '0.75rem', 
                  justifyContent: 'flex-end',
                  paddingTop: '1.5rem',
                  borderTop: '2px solid #e5e7eb'
                }}>
                  <button
                    onClick={handleCancelDmEdit}
                    disabled={loading}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'white',
                      color: '#6b7280',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSaveDmSettings}
                    disabled={loading}
                    style={{
                      padding: '0.75rem 2rem',
                      background: loading ? '#d1d5db' : '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      boxShadow: loading ? 'none' : '0 1px 3px rgba(16, 185, 129, 0.4)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {loading ? '保存中...' : '設定を保存'}
                  </button>
                </div>
              </div>
            ) : (
              /* 閲覧モード */
              <div>
                {/* 通知モード */}
                <div style={{ 
                  background: '#f9fafb',
                  padding: '1.5rem',
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  marginBottom: '2rem'
                }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: '#374151' }}>
                    通知モード
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        通常認証時
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 600 }}>
                        {{
                          all: '全ての通知',
                          new_and_revoke: '新規認証とロール削除のみ',
                          update_and_revoke: '認証更新とロール削除のみ',
                          revoke_only: 'ロール削除のみ',
                          none: '通知なし'
                        }[dmSettings.mode] || dmSettings.mode}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        バッチ処理時
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 600 }}>
                        {{
                          all: '全ての通知',
                          new_and_revoke: '新規認証とロール削除のみ',
                          update_and_revoke: '認証更新とロール削除のみ',
                          revoke_only: 'ロール削除のみ',
                          none: '通知なし'
                        }[dmSettings.batchMode] || dmSettings.batchMode}
                      </div>
                    </div>
                  </div>
                </div>

                {/* DMテンプレート表示 */}
                <div>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                    DMテンプレート
                  </h4>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <div style={{ padding: '1.5rem', border: '1px solid #d1fae5', borderRadius: '8px', background: '#f0fdf4' }}>
                      <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9375rem', fontWeight: 600, color: '#15803d' }}>
                        新規認証成功
                      </h5>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>タイトル: </span>
                        <span style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 600 }}>
                          {dmSettings.templates.successNew.title}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                          メッセージ:
                        </span>
                        <div style={{ 
                          whiteSpace: 'pre-wrap', 
                          fontSize: '0.875rem', 
                          color: '#374151', 
                          background: 'white',
                          padding: '0.75rem',
                          borderRadius: '6px',
                          border: '1px solid #bbf7d0',
                          lineHeight: 1.5
                        }}>
                          {(dmSettings.templates.successNew.description || '').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '1.5rem', border: '1px solid #bfdbfe', borderRadius: '8px', background: '#eff6ff' }}>
                      <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9375rem', fontWeight: 600, color: '#1e40af' }}>
                        認証更新
                      </h5>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>タイトル: </span>
                        <span style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 600 }}>
                          {dmSettings.templates.successUpdate.title}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                          メッセージ:
                        </span>
                        <div style={{ 
                          whiteSpace: 'pre-wrap', 
                          fontSize: '0.875rem', 
                          color: '#374151', 
                          background: 'white',
                          padding: '0.75rem',
                          borderRadius: '6px',
                          border: '1px solid #93c5fd',
                          lineHeight: 1.5
                        }}>
                          {(dmSettings.templates.successUpdate.description || '').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '1.5rem', border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2' }}>
                      <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9375rem', fontWeight: 600, color: '#991b1b' }}>
                        認証失敗
                      </h5>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>タイトル: </span>
                        <span style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 600 }}>
                          {dmSettings.templates.failed.title}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                          メッセージ:
                        </span>
                        <div style={{ 
                          whiteSpace: 'pre-wrap', 
                          fontSize: '0.875rem', 
                          color: '#374151', 
                          background: 'white',
                          padding: '0.75rem',
                          borderRadius: '6px',
                          border: '1px solid #fca5a5',
                          lineHeight: 1.5
                        }}>
                          {(dmSettings.templates.failed.description || '').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '1.5rem', border: '1px solid #fed7aa', borderRadius: '8px', background: '#fff7ed' }}>
                      <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9375rem', fontWeight: 600, color: '#9a3412' }}>
                        ロール削除
                      </h5>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>タイトル: </span>
                        <span style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 600 }}>
                          {dmSettings.templates.revoked.title}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                          メッセージ:
                        </span>
                        <div style={{ 
                          whiteSpace: 'pre-wrap', 
                          fontSize: '0.875rem', 
                          color: '#374151', 
                          background: 'white',
                          padding: '0.75rem',
                          borderRadius: '6px',
                          border: '1px solid #fdba74',
                          lineHeight: 1.5
                        }}>
                          {(dmSettings.templates.revoked.description || '').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* チャンネルテンプレート表示 */}
                <div style={{ marginTop: '2rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
                    チャンネルテンプレート
                  </h4>
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <div style={{ padding: '1.5rem', border: '1px solid #e0e7ff', borderRadius: '8px', background: '#f5f3ff' }}>
                      <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9375rem', fontWeight: 600, color: '#5b21b6' }}>
                        認証チャンネル
                      </h5>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>タイトル: </span>
                        <span style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 600 }}>
                          {dmSettings.channelTemplates?.verificationChannel?.title || 'Not set'}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                          メッセージ:
                        </span>
                        <div style={{ 
                          whiteSpace: 'pre-wrap', 
                          fontSize: '0.875rem', 
                          color: '#374151', 
                          background: 'white',
                          padding: '0.75rem',
                          borderRadius: '6px',
                          border: '1px solid #c7d2fe',
                          lineHeight: 1.5
                        }}>
                          {(dmSettings.channelTemplates?.verificationChannel?.description || 'Not set').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '1.5rem', border: '1px solid #e0e7ff', borderRadius: '8px', background: '#f5f3ff' }}>
                      <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9375rem', fontWeight: 600, color: '#5b21b6' }}>
                        認証開始
                      </h5>
                      <div style={{ marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>タイトル: </span>
                        <span style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 600 }}>
                          {dmSettings.channelTemplates?.verificationStart?.title || 'Not set'}
                        </span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                          メッセージ:
                        </span>
                        <div style={{ 
                          whiteSpace: 'pre-wrap', 
                          fontSize: '0.875rem', 
                          color: '#374151', 
                          background: 'white',
                          padding: '0.75rem',
                          borderRadius: '6px',
                          border: '1px solid #c7d2fe',
                          lineHeight: 1.5
                        }}>
                          {(dmSettings.channelTemplates?.verificationStart?.description || 'Not set').replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '1.5rem', border: '1px solid #d1d5db', borderRadius: '8px', background: '#f9fafb' }}>
                      <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9375rem', fontWeight: 600, color: '#374151' }}>
                        認証URL
                      </h5>
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
                          ベースURL:
                        </span>
                        <div style={{ 
                          fontSize: '0.875rem', 
                          color: '#111827', 
                          fontFamily: 'monospace',
                          background: 'white',
                          padding: '0.75rem',
                          borderRadius: '6px',
                          border: '1px solid #e5e7eb'
                        }}>
                          {dmSettings.channelTemplates?.verificationUrl || 'Not set'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              background: '#f9fafb',
              borderRadius: '8px'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                border: '4px solid #e5e7eb',
                borderTop: '4px solid #3b82f6',
                borderRadius: '50%',
                margin: '0 auto 1rem',
                animation: 'spin 1s linear infinite'
              }} />
              <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>DM設定を読み込み中...</p>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}

