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
    status: 'draft'
  });

  const [isSaving, setIsSaving] = React.useState(false);
  const [previewMode, setPreviewMode] = React.useState(false);

  // 差分検出
  const hasChanges = React.useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  }, [formData, originalData]);

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
    console.log('🔄 手動ドラフト保存開始:', formData);
    setIsSaving(true);
    try {
      const saveData = { ...formData, status: 'draft' as const };
      await onSave(saveData);
      showToast('ドラフトを保存しました', 'success');
      console.log('✅ 手動ドラフト保存完了');
    } catch (e: any) {
      console.error('❌ 手動ドラフト保存失敗:', e);
      showToast(`ドラフト保存に失敗: ${e.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700 }}>
          {event?.id ? 'イベント編集' : '新規イベント作成'}
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setPreviewMode(!previewMode)}
            style={{
              padding: '8px 16px', borderRadius: 6, border: '1px solid #e5e7eb',
              background: previewMode ? '#2563eb' : 'white', color: previewMode ? 'white' : '#374151',
              cursor: 'pointer'
            }}
          >
            {previewMode ? '編集' : 'プレビュー'}
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', borderRadius: 6, border: '1px solid #e5e7eb',
              background: 'white', color: '#374151', cursor: 'pointer'
            }}
          >
            キャンセル
          </button>
        </div>
      </div>

      {/* 差分警告 */}
      {hasChanges && (
        <div style={{
          padding: 12, background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8,
          marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ color: '#92400e' }}>⚠️ 未保存の変更があります</span>
          <button
            onClick={handleManualDraftSave}
            disabled={isSaving}
            style={{
              padding: '4px 8px', borderRadius: 4, border: '1px solid #f59e0b',
              background: 'white', color: '#92400e', cursor: isSaving ? 'not-allowed' : 'pointer',
              fontSize: 12
            }}
          >
            {isSaving ? '保存中...' : 'ドラフト保存'}
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* 左側: 編集フォーム */}
        <div style={{ display: previewMode ? 'none' : 'block' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 基本情報 */}
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>イベント名 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="イベント名を入力"
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #e5e7eb',
                  fontSize: 16
                }}
              />
            </div>

            {/* 説明（WYSIWYG風） */}
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>説明 *</label>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                {/* 簡易ツールバー */}
                <div style={{
                  padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb',
                  display: 'flex', gap: 8
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      const textarea = document.getElementById('description') as HTMLTextAreaElement;
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const selectedText = (formData.description || '').substring(start, end);
                      const newText = `**${selectedText}**`;
                      setFormData(prev => ({
                        ...prev,
                        description: (prev.description || '').substring(0, start) + newText + (prev.description || '').substring(end)
                      }));
                    }}
                    style={{
                      padding: '4px 8px', borderRadius: 4, border: '1px solid #e5e7eb',
                      background: 'white', cursor: 'pointer', fontSize: 12
                    }}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const textarea = document.getElementById('description') as HTMLTextAreaElement;
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const selectedText = (formData.description || '').substring(start, end);
                      const newText = `*${selectedText}*`;
                      setFormData(prev => ({
                        ...prev,
                        description: (prev.description || '').substring(0, start) + newText + (prev.description || '').substring(end)
                      }));
                    }}
                    style={{
                      padding: '4px 8px', borderRadius: 4, border: '1px solid #e5e7eb',
                      background: 'white', cursor: 'pointer', fontSize: 12
                    }}
                  >
                    I
                  </button>
                </div>
                <textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="イベントの説明を入力（Markdown形式対応）"
                  style={{
                    width: '100%', minHeight: 120, padding: '12px 16px', border: 'none', resize: 'vertical',
                    fontSize: 14, fontFamily: 'monospace'
                  }}
                />
              </div>
            </div>

            {/* 画像アップロード */}
            <WalrusImageUpload
              imageCid={formData.imageCid}
              imageMimeType={formData.imageMimeType}
              onUpload={(cid, mimeType) => setFormData(prev => ({ ...prev, imageCid: cid, imageMimeType: mimeType }))}
              onMessage={showToast}
            />

            {/* 期間設定 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>開始日時</label>
                <input
                  type="datetime-local"
                  value={formData.startAt || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, startAt: e.target.value }))}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #e5e7eb'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>終了日時</label>
                <input
                  type="datetime-local"
                  value={formData.endAt || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, endAt: e.target.value }))}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #e5e7eb'
                  }}
                />
              </div>
            </div>

            {/* ミントコレクション選択 */}
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
                ミントコレクション
                {loadingCollections && <span style={{ marginLeft: 8, fontSize: 12, color: '#6b7280' }}>読み込み中...</span>}
              </label>
              <select
                value={formData.collectionId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, collectionId: e.target.value }))}
                style={{
                  width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #e5e7eb',
                  backgroundColor: '#fff', fontSize: 14
                }}
                disabled={loadingCollections}
              >
                <option value="">コレクションを選択してください</option>
                {mintCollections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name} ({collection.packageId})
                  </option>
                ))}
              </select>
              {mintCollections.length === 0 && !loadingCollections && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#ef4444' }}>
                  ミントコレクションが見つかりません。先にコレクションを作成してください。
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右側: プレビュー */}
        <div style={{ display: previewMode ? 'block' : 'none' }}>
          <div style={{
            border: '1px solid #e5e7eb', borderRadius: 12, padding: 24, background: 'white'
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>プレビュー</h3>
            
            {formData.imageCid && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  width: '100%', height: 200, background: '#f3f4f6', borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <span style={{ color: '#64748b' }}>画像プレビュー</span>
                </div>
              </div>
            )}

            <h4 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>{formData.name || 'イベント名'}</h4>
            
            <div style={{ marginBottom: 16, color: '#64748b' }}>
              {formData.startAt && formData.endAt ? (
                <div>
                  {new Date(formData.startAt).toLocaleString()} ～ {new Date(formData.endAt).toLocaleString()}
                </div>
              ) : (
                <div>期間未設定</div>
              )}
            </div>

            <div style={{ 
              whiteSpace: 'pre-wrap', lineHeight: 1.6,
              background: '#f8fafc', padding: 16, borderRadius: 8
            }}>
              {formData.description || '説明が入力されていません'}
            </div>

            {formData.collectionId && (
              <div style={{ marginTop: 16, fontSize: 12, color: '#64748b' }}>
                コレクション: {mintCollections.find(c => c.id === formData.collectionId)?.name || formData.collectionId}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 保存ボタン */}
      <div style={{ 
        display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 24,
        borderTop: '1px solid #e5e7eb'
      }}>
        <button
          onClick={handleManualDraftSave}
          disabled={isSaving}
          style={{
            padding: '12px 24px', borderRadius: 8, border: '1px solid #e5e7eb',
            background: 'white', color: '#374151', cursor: isSaving ? 'not-allowed' : 'pointer'
          }}
        >
          {isSaving ? '保存中...' : 'ドラフト保存'}
        </button>
        <button
          onClick={() => handleSave('published')}
          disabled={isSaving || !formData.name || !formData.description}
          style={{
            padding: '12px 24px', borderRadius: 8, border: 'none',
            background: !formData.name || !formData.description ? '#e5e7eb' : '#2563eb',
            color: 'white', cursor: !formData.name || !formData.description ? 'not-allowed' : 'pointer'
          }}
        >
          {isSaving ? '公開中...' : '公開'}
        </button>
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
