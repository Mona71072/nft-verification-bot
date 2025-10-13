import React from 'react';
import { ToastProvider, useToast } from './ui/ToastProvider';
import WalrusImageUpload from './WalrusImageUpload';

interface MintCollection {
  id: string;
  name: string;
  packageId: string;
  description?: string;
  createdAt: string;
}

interface Event {
  id?: string;
  name: string;
  description?: string;
  imageCid?: string;
  imageMimeType?: string;
  moveCall?: any;
  collectionId?: string;
  startAt?: string;
  endAt?: string;
  eventDate?: string;
  totalCap?: number;
  status?: 'draft' | 'published';
}

interface EventEditorProps {
  event?: Event;
  onSave: (event: Event) => Promise<void>;
  onCancel: () => void;
}

function EventEditorInner({ event, onSave, onCancel }: EventEditorProps) {
  const { showToast } = useToast();
  const [mintCollections, setMintCollections] = React.useState<MintCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = React.useState(false);
  
  const [formData, setFormData] = React.useState<Event>(event || {
    name: '',
    description: '',
    imageCid: '',
    imageMimeType: '',
    moveCall: {},
    collectionId: '',
    startAt: '',
    endAt: '',
    eventDate: '',
    totalCap: undefined,
    status: 'draft'
  });

  const [originalData] = React.useState<Event>(event || {
    name: '',
    description: '',
    imageCid: '',
    imageMimeType: '',
    moveCall: {},
    collectionId: '',
    startAt: '',
    endAt: '',
    eventDate: '',
    totalCap: undefined,
    status: 'draft'
  });

  const [isSaving, setIsSaving] = React.useState(false);
  const [previewMode, setPreviewMode] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // 差分検出
  const hasChanges = React.useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  }, [formData, originalData]);

  // バリデーション
  const validateForm = React.useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'イベント名は必須です';
    }
    if (!formData.description?.trim()) {
      newErrors.description = '説明は必須です';
    }
    if (!formData.collectionId) {
      newErrors.collectionId = 'コレクションを選択してください';
    }
    if (!formData.eventDate) {
      newErrors.eventDate = 'イベント開催日時は必須です';
    }
    if (!formData.startAt) {
      newErrors.startAt = '開始日時は必須です';
    }
    if (!formData.endAt) {
      newErrors.endAt = '終了日時は必須です';
    }
    if (formData.startAt && formData.endAt && new Date(formData.startAt) >= new Date(formData.endAt)) {
      newErrors.endAt = '終了日時は開始日時より後に設定してください';
    }
    if (formData.totalCap && formData.totalCap < 1) {
      newErrors.totalCap = 'ミント上限は1以上で設定してください';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // 入力進捗の計算
  const completionPercentage = React.useMemo(() => {
    const fields = ['name', 'description', 'collectionId', 'eventDate', 'startAt', 'endAt'];
    const completed = fields.filter(field => {
      const value = formData[field as keyof Event];
      return value && String(value).trim() !== '';
    }).length;
    return Math.round((completed / fields.length) * 100);
  }, [formData]);

  // キーボードショートカット
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualDraftSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData]);

  // ミントコレクション一覧を取得
  React.useEffect(() => {
    const fetchMintCollections = async () => {
      setLoadingCollections(true);
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';
        const response = await fetch(`${apiBase}/api/mint-collections`);
        const data = await response.json();
        
        if (data.success && data.data) {
          setMintCollections(data.data);
          showToast(`ミントコレクション ${data.data.length}件を取得しました`);
        } else {
          showToast('ミントコレクションの取得に失敗しました', 'error');
        }
      } catch (error) {
        console.error('Failed to fetch mint collections:', error);
        showToast('ミントコレクションの取得に失敗しました', 'error');
      } finally {
        setLoadingCollections(false);
      }
    };

    fetchMintCollections();
  }, [showToast]);

  // 自動ドラフト保存機能は削除（手動保存のみ）

  const handleSave = async (status: 'draft' | 'published') => {
    setIsSaving(true);
    try {
      const saveData = { ...formData, status };
      await onSave(saveData);
      showToast(status === 'published' ? 'イベントを公開しました' : 'ドラフトを保存しました', 'success');
    } catch (e: any) {
      showToast(`保存に失敗: ${e.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 手動ドラフト保存
  const handleManualDraftSave = async () => {
    setIsSaving(true);
    try {
      const saveData = { ...formData, status: 'draft' as const };
      await onSave(saveData);
      showToast('ドラフトを保存しました', 'success');
    } catch (e: any) {
      showToast(`ドラフト保存に失敗: ${e.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 公開時のバリデーション付き保存
  const handlePublish = async () => {
    if (!validateForm()) {
      showToast('入力内容を確認してください', 'error');
      return;
    }
    await handleSave('published');
  };


  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', background: '#f9fafb', minHeight: '100vh' }}>
      {/* ヘッダー */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '2px solid #e5e7eb'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.875rem', fontWeight: 700, color: '#111827' }}>
            {event?.id ? 'イベント編集' : '新規イベント作成'}
          </h2>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            イベント情報を入力してミントページを作成します
          </p>
          {/* 入力進捗インジケーター */}
          <div style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>入力進捗</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: completionPercentage === 100 ? '#10b981' : '#3b82f6' }}>
                {completionPercentage}%
              </span>
            </div>
            <div style={{ 
              width: '100%', 
              height: '6px', 
              background: '#e5e7eb', 
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${completionPercentage}%`,
                height: '100%',
                background: completionPercentage === 100 ? '#10b981' : '#3b82f6',
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            style={{
              padding: '0.625rem 1.25rem', 
              borderRadius: '8px', 
              border: '1px solid #d1d5db',
              background: previewMode ? '#3b82f6' : 'white', 
              color: previewMode ? 'white' : '#374151',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              transition: 'all 0.2s'
            }}
          >
            {previewMode ? '編集モード' : 'プレビュー'}
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '0.625rem 1.25rem', 
              borderRadius: '8px', 
              border: '1px solid #d1d5db',
              background: 'white', 
              color: '#6b7280', 
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
              transition: 'all 0.2s'
            }}
          >
            キャンセル
          </button>
        </div>
      </div>

      {/* 差分警告 */}
      {hasChanges && (
        <div style={{
          padding: '1rem 1.25rem', 
          background: '#fef3c7', 
          border: '1px solid #fbbf24', 
          borderRadius: '8px',
          marginBottom: '1.5rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⚠️</span>
            <span style={{ color: '#92400e', fontWeight: 500 }}>未保存の変更があります</span>
          </div>
          <button
            onClick={handleManualDraftSave}
            disabled={isSaving}
            style={{
              padding: '0.5rem 1rem', 
              borderRadius: '6px', 
              border: 'none',
              background: '#f59e0b', 
              color: 'white', 
              cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            {isSaving ? '保存中...' : 'ドラフト保存'}
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* 左側: 編集フォーム */}
        <div style={{ display: previewMode ? 'none' : 'block' }}>
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
              基本情報
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* イベント名 */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 600, 
                  fontSize: '0.875rem',
                  color: '#374151'
                }}>
                  イベント名 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, name: e.target.value }));
                    if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                  }}
                  onBlur={validateForm}
                  placeholder="例: RADCRAFT Tokyo 2025"
                  style={{
                    width: '100%', 
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    border: `1px solid ${errors.name ? '#ef4444' : '#d1d5db'}`,
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                />
                {errors.name && (
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                    {errors.name}
                  </p>
                )}
              </div>

              {/* 説明 */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 600, 
                  fontSize: '0.875rem',
                  color: '#374151'
                }}>
                  説明 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, description: e.target.value }));
                    if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
                  }}
                  onBlur={validateForm}
                  placeholder="イベントの詳細を入力してください"
                  rows={4}
                  style={{
                    width: '100%', 
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    border: `1px solid ${errors.description ? '#ef4444' : '#d1d5db'}`,
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: 'inherit',
                    lineHeight: 1.5
                  }}
                />
                {errors.description && (
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                    {errors.description}
                  </p>
                )}
              </div>

              {/* 画像アップロード */}
              <WalrusImageUpload
                imageCid={formData.imageCid}
                imageMimeType={formData.imageMimeType}
                onUpload={(cid, mimeType, epochs, expiry) => setFormData(prev => ({ 
                  ...prev, 
                  imageCid: cid, 
                  imageMimeType: mimeType,
                  imageStorageEpochs: epochs,
                  imageStorageExpiry: expiry
                }))}
                onMessage={showToast}
              />

              {/* ミントコレクション選択 */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 600, 
                  fontSize: '0.875rem',
                  color: '#374151'
                }}>
                  ミントコレクション <span style={{ color: '#ef4444' }}>*</span>
                  {loadingCollections && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>読み込み中...</span>}
                </label>
                <select
                  value={formData.collectionId || ''}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, collectionId: e.target.value }));
                    if (errors.collectionId) setErrors(prev => ({ ...prev, collectionId: '' }));
                  }}
                  onBlur={validateForm}
                  style={{
                    width: '100%', 
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    border: `1px solid ${errors.collectionId ? '#ef4444' : '#d1d5db'}`,
                    backgroundColor: 'white', 
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                  disabled={loadingCollections}
                >
                  <option value="">コレクションを選択</option>
                  {mintCollections.map((collection) => {
                    const defaultMoveTarget = import.meta.env.VITE_DEFAULT_MOVE_TARGET || '0x3d7e20efbd6e4e2ee6369bcf1e9ec8029637c47890d975e74956b4b405cb5f3f::sxt_nft::mint_to';
                    const autoTypePath = defaultMoveTarget.replace('::mint_to', '::EventNFT');
                    const typePath = (collection as any).typePath || autoTypePath;
                    
                    return (
                      <option key={collection.id} value={typePath}>
                        {collection.name}
                      </option>
                    );
                  })}
                </select>
                {errors.collectionId && (
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                    {errors.collectionId}
                  </p>
                )}
                {mintCollections.length === 0 && !loadingCollections && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#ef4444' }}>
                    ミントコレクションが見つかりません。先にコレクションを作成してください。
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 日時・制限設定 */}
          <div style={{ 
            background: 'white', 
            borderRadius: '12px', 
            padding: '2rem',
            marginTop: '1.5rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
              日時・制限設定
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* イベント開催日時 */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 600, 
                  fontSize: '0.875rem',
                  color: '#374151'
                }}>
                  イベント開催日時 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.5rem 0' }}>
                  NFTに記録される実際のイベント日時
                </p>
                <input
                  type="datetime-local"
                  value={formData.eventDate || ''}
                  onChange={(e) => {
                    setFormData(prev => ({ ...prev, eventDate: e.target.value }));
                    if (errors.eventDate) setErrors(prev => ({ ...prev, eventDate: '' }));
                  }}
                  onBlur={validateForm}
                  style={{
                    width: '100%', 
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    border: `1px solid ${errors.eventDate ? '#ef4444' : '#d1d5db'}`,
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                />
                {errors.eventDate && (
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                    {errors.eventDate}
                  </p>
                )}
              </div>

              {/* ミント受付期間 */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 600, 
                  fontSize: '0.875rem',
                  color: '#374151'
                }}>
                  ミント受付期間 <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.75rem 0' }}>
                  NFTをミントできる期間を設定
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>
                      開始日時
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.startAt || ''}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, startAt: e.target.value }));
                        if (errors.startAt) setErrors(prev => ({ ...prev, startAt: '' }));
                      }}
                      onBlur={validateForm}
                      style={{
                        width: '100%', 
                        padding: '0.75rem 1rem', 
                        borderRadius: '8px', 
                        border: `1px solid ${errors.startAt ? '#ef4444' : '#d1d5db'}`,
                        fontSize: '0.875rem',
                        outline: 'none'
                      }}
                    />
                    {errors.startAt && (
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                        {errors.startAt}
                      </p>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>
                      終了日時
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.endAt || ''}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, endAt: e.target.value }));
                        if (errors.endAt) setErrors(prev => ({ ...prev, endAt: '' }));
                      }}
                      onBlur={validateForm}
                      style={{
                        width: '100%', 
                        padding: '0.75rem 1rem', 
                        borderRadius: '8px', 
                        border: `1px solid ${errors.endAt ? '#ef4444' : '#d1d5db'}`,
                        fontSize: '0.875rem',
                        outline: 'none'
                      }}
                    />
                    {errors.endAt && (
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                        {errors.endAt}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ミント上限 */}
              <div>
                <label style={{ 
                  display: 'block', 
                  marginBottom: '0.5rem', 
                  fontWeight: 600, 
                  fontSize: '0.875rem',
                  color: '#374151'
                }}>
                  ミント上限
                </label>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.5rem 0' }}>
                  空欄の場合は無制限
                </p>
                <input
                  type="number"
                  value={formData.totalCap || ''}
                  onChange={(e) => {
                    setFormData(prev => ({ 
                      ...prev, 
                      totalCap: e.target.value ? Number(e.target.value) : undefined 
                    }));
                    if (errors.totalCap) setErrors(prev => ({ ...prev, totalCap: '' }));
                  }}
                  onBlur={validateForm}
                  placeholder="例: 100"
                  min="1"
                  style={{
                    width: '100%', 
                    padding: '0.75rem 1rem', 
                    borderRadius: '8px', 
                    border: `1px solid ${errors.totalCap ? '#ef4444' : '#d1d5db'}`,
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                />
                {errors.totalCap && (
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444' }}>
                    {errors.totalCap}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 右側: プレビュー */}
        <div style={{ display: previewMode ? 'block' : 'none' }}>
          <div style={{
            background: 'white', 
            borderRadius: '12px', 
            padding: '2rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            position: 'sticky',
            top: '2rem'
          }}>
            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
              プレビュー
            </h3>
            
            {formData.imageCid && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                  width: '100%', 
                  height: '200px', 
                  background: '#f3f4f6', 
                  borderRadius: '8px',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  border: '1px solid #e5e7eb'
                }}>
                  <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>画像プレビュー</span>
                </div>
              </div>
            )}

            <h4 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 700, 
              marginBottom: '1rem',
              color: '#111827'
            }}>
              {formData.name || 'イベント名'}
            </h4>
            
            <div style={{ 
              marginBottom: '1.5rem', 
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.25rem' }}>
                  イベント開催日時
                </div>
                {formData.eventDate ? (
                  <div style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>
                    {new Date(formData.eventDate).toLocaleString('ja-JP', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.875rem', color: '#ef4444' }}>未設定</div>
                )}
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.25rem' }}>
                  ミント受付期間
                </div>
                {formData.startAt && formData.endAt ? (
                  <div style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>
                    {new Date(formData.startAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {' ~ '}
                    {new Date(formData.endAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.875rem', color: '#ef4444' }}>未設定</div>
                )}
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.25rem' }}>
                  ミント上限
                </div>
                <div style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 600 }}>
                  {typeof formData.totalCap === 'number' ? `${formData.totalCap.toLocaleString()}枚` : '無制限'}
                </div>
              </div>

              {formData.collectionId && (
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.25rem' }}>
                    コレクション
                  </div>
                  <div style={{ 
                    fontSize: '0.875rem', 
                    color: '#374151',
                    padding: '0.5rem 0.75rem',
                    background: '#f9fafb',
                    borderRadius: '6px',
                    border: '1px solid #e5e7eb'
                  }}>
                    {mintCollections.find(c => c.id === formData.collectionId)?.name || formData.collectionId}
                  </div>
                </div>
              )}
            </div>

            {formData.description && (
              <div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500, marginBottom: '0.5rem' }}>
                  説明
                </div>
                <div style={{ 
                  whiteSpace: 'pre-wrap', 
                  lineHeight: 1.6,
                  background: '#f9fafb', 
                  padding: '1rem', 
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  color: '#4b5563',
                  border: '1px solid #e5e7eb'
                }}>
                  {formData.description}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 保存ボタン */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        gap: '0.75rem', 
        marginTop: '2rem', 
        paddingTop: '2rem',
        borderTop: '2px solid #e5e7eb'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleManualDraftSave}
              disabled={isSaving}
              style={{
                padding: '0.75rem 1.5rem', 
                borderRadius: '8px', 
                border: '1px solid #d1d5db',
                background: 'white', 
                color: '#374151', 
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                transition: 'all 0.2s'
              }}
              title="Ctrl+S / ⌘+S"
            >
              {isSaving ? '保存中...' : 'ドラフト保存'}
            </button>
            <button
              onClick={handlePublish}
              disabled={isSaving}
              style={{
                padding: '0.75rem 2rem', 
                borderRadius: '8px', 
                border: 'none',
                background: isSaving ? '#d1d5db' : '#3b82f6',
                color: 'white', 
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontWeight: 600,
                fontSize: '0.875rem',
                boxShadow: isSaving ? 'none' : '0 1px 3px rgba(59, 130, 246, 0.4)',
                transition: 'all 0.2s'
              }}
            >
              {isSaving ? '公開中...' : 'イベントを公開'}
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>
            Ctrl+S / ⌘+S でドラフト保存
          </p>
        </div>
      </div>
    </div>
  );
}

export default function EventEditor({ event, onSave, onCancel }: EventEditorProps) {
  return (
    <ToastProvider>
      <EventEditorInner event={event} onSave={onSave} onCancel={onCancel} />
    </ToastProvider>
  );
}
