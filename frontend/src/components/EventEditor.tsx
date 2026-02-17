import React from 'react';
import { ToastProvider, useToast } from './ui/ToastProvider';
import WalrusImageUpload from './WalrusImageUpload';
import { getImageDisplayUrl } from '../utils/walrus';
import { useResponsive, getResponsiveValue } from '../hooks/useResponsive';

type EditorTab = 'basic' | 'image' | 'datetime' | 'confirm';

interface MintCollection {
  id: string;
  name: string;
  packageId: string;
  typePath?: string;
  description?: string;
  createdAt: string;
}

interface Event {
  id?: string;
  name: string;
  description?: string;
  imageCid?: string;
  imageMimeType?: string;
  imageUrl?: string;
  imageStorageEpochs?: number;
  imageStorageExpiry?: string;
  moveCall?: any;
  collectionId?: string;
  selectedCollectionId?: string;
  active?: boolean;
  startAt?: string;
  endAt?: string;
  eventDate?: string;
  totalCap?: number;
  status?: 'draft' | 'published';
  detailUrl?: string;
  mintedCount?: number;
}

interface EventEditorProps {
  event?: Event;
  collections?: MintCollection[];
  onSave: (event: Event) => Promise<void>;
  onCancel: () => void;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

function isoToDatetimeLocal(iso: string | undefined): string {
  if (!iso || typeof iso !== 'string') return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeEventForForm(event: Event | undefined): Event | Record<string, unknown> {
  if (!event) return { name: '', description: '', imageCid: '', imageMimeType: '', imageUrl: '', moveCall: {}, collectionId: '', selectedCollectionId: '', startAt: '', endAt: '', eventDate: '', totalCap: undefined, status: 'draft' as const, detailUrl: '' };
  return {
    ...event,
    startAt: event.startAt ? isoToDatetimeLocal(event.startAt) : '',
    endAt: event.endAt ? isoToDatetimeLocal(event.endAt) : '',
    eventDate: event.eventDate ? isoToDatetimeLocal(event.eventDate) : ''
  };
}

function CollectionSelect({
  collections,
  selectedCollectionId,
  onChange,
  disabled,
  label,
  loading,
  hasError,
  inputStyle,
  labelStyle
}: {
  collections: MintCollection[];
  selectedCollectionId?: string;
  onChange: (typePath: string, collectionId: string) => void;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  hasError?: boolean;
  inputStyle: (hasError: boolean) => React.CSSProperties;
  labelStyle: React.CSSProperties;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const colId = e.target.value;
    if (!colId) {
      onChange('', '');
      return;
    }
    const col = collections.find(c => c.id === colId);
    if (col) {
      const typePath = ((col as any).typePath || col.packageId || '').trim();
      onChange(typePath, col.id);
    }
  };

  const baseStyle = inputStyle(!!hasError);

  return (
    <div>
      <label style={labelStyle}>
        {label} <span style={{ color: '#ef4444' }}>*</span>
        {loading && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>読み込み中...</span>}
      </label>
      <select
        value={selectedCollectionId || ''}
        onChange={handleChange}
        disabled={disabled || loading}
        style={{
          ...baseStyle,
          backgroundColor: '#ffffff',
          color: '#111827',
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          appearance: 'auto',
        }}
      >
        <option value="">コレクションを選択</option>
        {collections.map((collection) => {
          const typePath = ((collection as any).typePath || collection.packageId || '').trim();
          const shortType = typePath ? (typePath.split('::').pop() || typePath) : '';
          return (
            <option key={collection.id} value={collection.id}>
              {collection.name}{shortType ? ` (${shortType})` : ''}
            </option>
          );
        })}
      </select>
    </div>
  );
}

// 30分刻みの時刻オプションを生成
const TIME_OPTIONS_30MIN: string[] = (() => {
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return options;
})();

// 時刻を30分刻みに丸める
function roundTo30Min(timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number);
  const rounded = m < 15 ? 0 : m < 45 ? 30 : 0;
  const adjustedH = m >= 45 ? (h + 1) % 24 : h;
  return `${String(adjustedH).padStart(2, '0')}:${String(rounded).padStart(2, '0')}`;
}

// datetime-local 値から日付部分を取得
function getDatePart(datetimeLocal: string | undefined): string {
  if (!datetimeLocal) return '';
  return datetimeLocal.split('T')[0] || '';
}

// datetime-local 値から時刻部分を取得（30分刻みに丸め）
function getTimePart(datetimeLocal: string | undefined): string {
  if (!datetimeLocal) return '00:00';
  const timePart = datetimeLocal.split('T')[1] || '00:00';
  return roundTo30Min(timePart.substring(0, 5));
}

// 日付と時刻を結合して datetime-local 形式にする
function combineDatetime(date: string, time: string): string {
  if (!date) return '';
  return `${date}T${time || '00:00'}`;
}

// 30分刻み日時ピッカーコンポーネント
function DateTimePicker30Min({
  value,
  onChange,
  onBlur,
  hasError,
  inputStyle,
  deviceType,
}: {
  value: string | undefined;
  onChange: (newValue: string) => void;
  onBlur?: () => void;
  hasError: boolean;
  inputStyle: (hasError: boolean) => React.CSSProperties;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}) {
  const datePart = getDatePart(value);
  const timePart = getTimePart(value);

  const baseStyle = inputStyle(hasError);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: getResponsiveValue('1fr', '1fr 140px', '1fr 160px', deviceType), gap: '0.5rem', alignItems: 'start' }}>
      <input
        type="date"
        value={datePart}
        onChange={(e) => {
          onChange(combineDatetime(e.target.value, timePart));
        }}
        onBlur={onBlur}
        style={baseStyle}
      />
      <select
        value={timePart}
        onChange={(e) => {
          onChange(combineDatetime(datePart, e.target.value));
        }}
        onBlur={onBlur}
        style={{
          ...baseStyle,
          cursor: 'pointer',
          appearance: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M3 5l3 3 3-3'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 0.75rem center',
          paddingRight: '2rem',
        }}
      >
        {TIME_OPTIONS_30MIN.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  );
}

function EventEditorInner({ event, collections: externalCollections, onSave, onCancel: _onCancel }: EventEditorProps) {
  const { showToast } = useToast();
  const responsive = useResponsive();
  const deviceType = responsive.deviceType;
  const [activeTab, setActiveTab] = React.useState<EditorTab>('basic');
  const [mintCollections, setMintCollections] = React.useState<MintCollection[]>(externalCollections || []);
  const [loadingCollections, setLoadingCollections] = React.useState(false);

  const initialEvent = React.useMemo(() => normalizeEventForForm(event) as Event, [event?.id, event?.collectionId, event?.selectedCollectionId, event?.startAt, event?.endAt, event?.eventDate]);
  const [formData, setFormData] = React.useState<Event>(initialEvent);
  const [originalData] = React.useState<Event>(initialEvent);

  // event が変わったとき formData を同期
  React.useEffect(() => {
    if (!event) return;
    const normalized = normalizeEventForForm(event) as Event;
    setFormData(normalized);
  }, [event?.id]);

  const [isSaving, setIsSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const hasChanges = React.useMemo(() => {
    return JSON.stringify(formData) !== JSON.stringify(originalData);
  }, [formData, originalData]);

  const validateForm = React.useCallback((overrideData?: Partial<Event>) => {
    const data = overrideData ? { ...formData, ...overrideData } : formData;
    const newErrors: Record<string, string> = {};
    if (!data.name?.trim()) newErrors.name = 'イベント名は必須です';
    if (!data.description?.trim()) newErrors.description = '説明は必須です';
    if (!data.collectionId && !data.selectedCollectionId) newErrors.collectionId = 'コレクションを選択してください';
    if (!data.eventDate) newErrors.eventDate = 'イベント開催日時は必須です';
    if (!data.startAt) newErrors.startAt = '開始日時は必須です';
    if (!data.endAt) newErrors.endAt = '終了日時は必須です';
    if (data.startAt && data.endAt && new Date(data.startAt) >= new Date(data.endAt)) {
      newErrors.endAt = '終了日時は開始日時より後に設定してください';
    }
    if (data.totalCap && data.totalCap < 1) newErrors.totalCap = 'ミント上限は1以上で設定してください';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const completionPercentage = React.useMemo(() => {
    const checks = [
      !!formData.name?.trim(),
      !!formData.description?.trim(),
      !!(formData.collectionId || formData.selectedCollectionId),
      !!formData.eventDate,
      !!formData.startAt,
      !!formData.endAt,
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }, [formData]);

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

  React.useEffect(() => {
    if (externalCollections && externalCollections.length > 0) {
      setMintCollections(externalCollections);
      return;
    }
    const fetchMintCollections = async () => {
      setLoadingCollections(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/mint-collections`);
        const data = await response.json();
        if (data.success && data.data) {
          setMintCollections(data.data);
        } else {
          showToast('ミントコレクションの取得に失敗しました', 'error');
        }
      } catch {
        showToast('ミントコレクションの取得に失敗しました', 'error');
      } finally {
        setLoadingCollections(false);
      }
    };
    fetchMintCollections();
  }, [externalCollections, showToast]);

  // mintCollections が読み込まれた後、コレクション情報を補完する
  React.useEffect(() => {
    if (mintCollections.length === 0) return;

    setFormData(prev => {
      // 既に selectedCollectionId があり、コレクション一覧に存在する場合は何もしない
      if (prev.selectedCollectionId) {
        const exists = mintCollections.find(c => c.id === prev.selectedCollectionId);
        if (exists) return prev;
      }

      // collectionId（typePath）から selectedCollectionId を補完
      if (prev.collectionId) {
        const cid = String(prev.collectionId).trim();
        const matched = mintCollections.find(c => {
          const tp = ((c as any).typePath || c.packageId || '').trim();
          return tp === cid || c.id === cid;
        });
        if (matched) {
          return { ...prev, selectedCollectionId: matched.id, collectionId: ((matched as any).typePath || matched.packageId || '').trim() };
        }
      }

      // 新規作成で未選択の場合 → 最新のコレクションをデフォルト選択
      if (!event?.id && !prev.collectionId && !prev.selectedCollectionId) {
        const latest = mintCollections[mintCollections.length - 1];
        if (latest) {
          const tp = ((latest as any).typePath || latest.packageId || '').trim();
          return { ...prev, collectionId: tp, selectedCollectionId: latest.id };
        }
      }

      return prev;
    });
  }, [event?.id, mintCollections]);

  const resolveCollection = React.useCallback((
    selectedColId?: string,
    colId?: string
  ): MintCollection | undefined => {
    if (selectedColId) {
      const byId = mintCollections.find(c => c.id === selectedColId);
      if (byId) return byId;
    }
    if (colId) {
      const cid = String(colId).trim();
      return mintCollections.find(c => {
        const tp = ((c as any).typePath || c.packageId || '').trim();
        return tp === cid;
      }) || mintCollections.find(c => c.id === cid);
    }
    return undefined;
  }, [mintCollections]);

  const handleSave = async (status: 'draft' | 'published') => {
    setIsSaving(true);
    try {
      await onSave({ ...formData, status });
      showToast(status === 'published' ? 'イベントを公開しました' : 'ドラフトを保存しました', 'success');
    } catch (e: any) {
      showToast(`保存に失敗: ${e.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleManualDraftSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ ...formData, status: 'draft' });
      showToast('ドラフトを保存しました', 'success');
    } catch (e: any) {
      showToast(`ドラフト保存に失敗: ${e.message}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!validateForm()) {
      showToast('入力内容を確認してください', 'error');
      return;
    }
    await handleSave('published');
  };

  const selectedCollection = resolveCollection(formData.selectedCollectionId, formData.collectionId);
  const previewImageUrl = getImageDisplayUrl(formData.imageCid, formData.imageUrl);

  // Shared styles
  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: '0.5rem', fontWeight: 600,
    fontSize: getResponsiveValue('0.8125rem', '0.875rem', '0.875rem', deviceType), color: '#374151'
  };
  const inputStyle = (hasError: boolean): React.CSSProperties => ({
    width: '100%', padding: getResponsiveValue('0.625rem 0.875rem', '0.75rem 1rem', '0.75rem 1rem', deviceType),
    borderRadius: getResponsiveValue('6px', '8px', '8px', deviceType),
    border: `1px solid ${hasError ? '#ef4444' : '#d1d5db'}`,
    fontSize: getResponsiveValue('0.8125rem', '0.875rem', '0.875rem', deviceType), outline: 'none', boxSizing: 'border-box'
  });
  const errorStyle: React.CSSProperties = {
    margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#ef4444'
  };
  const cardStyle: React.CSSProperties = {
    background: 'white', borderRadius: getResponsiveValue('10px', '12px', '12px', deviceType),
    padding: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  };

  const tabs: { id: EditorTab; label: string }[] = [
    { id: 'basic', label: '基本情報' },
    { id: 'image', label: '画像' },
    { id: 'datetime', label: '日時・制限' },
    { id: 'confirm', label: '確認' }
  ];

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '100px' }}>
      {/* Progress bar */}
      <div style={{ marginBottom: getResponsiveValue('0.75rem', '1rem', '1rem', deviceType), maxWidth: '300px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.6875rem', deviceType), fontWeight: 600, color: '#6b7280' }}>入力進捗</span>
          <span style={{ fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.6875rem', deviceType), fontWeight: 600, color: completionPercentage === 100 ? '#10b981' : '#3b82f6' }}>
            {completionPercentage}%
          </span>
        </div>
        <div style={{ width: '100%', height: '4px', background: '#e5e7eb', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${completionPercentage}%`, height: '100%', background: completionPercentage === 100 ? '#10b981' : '#3b82f6', transition: 'width 0.3s ease' }} />
        </div>
      </div>

      {/* Tab navigation */}
      <div style={{
        background: 'white', borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
        marginBottom: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType),
        padding: getResponsiveValue('0.375rem', '0.5rem', '0.5rem', deviceType),
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        display: 'flex', gap: getResponsiveValue('0.25rem', '0.5rem', '0.5rem', deviceType),
        overflowX: 'auto'
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: deviceType === 'mobile' ? 0 : 1,
              padding: getResponsiveValue('0.5rem 0.75rem', '0.625rem 1rem', '0.75rem 1rem', deviceType),
              background: activeTab === tab.id ? '#3b82f6' : 'transparent',
              color: activeTab === tab.id ? 'white' : '#6b7280',
              border: 'none',
              borderRadius: getResponsiveValue('6px', '8px', '8px', deviceType),
              cursor: 'pointer',
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
              fontWeight: 600,
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Unsaved changes warning */}
      {hasChanges && (
        <div style={{
          padding: '0.75rem 1rem', background: '#fef3c7', border: '1px solid #fbbf24',
          borderRadius: '8px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span style={{ color: '#92400e', fontWeight: 500, fontSize: '0.8125rem' }}>未保存の変更があります</span>
          <button onClick={handleManualDraftSave} disabled={isSaving} style={{
            padding: '0.375rem 0.75rem', borderRadius: '6px', border: 'none', background: '#f59e0b',
            color: 'white', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '0.8125rem', fontWeight: 600
          }}>
            {isSaving ? '保存中...' : 'ドラフト保存'}
          </button>
        </div>
      )}

      {/* Tab content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {activeTab === 'basic' && (
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: getResponsiveValue('0.9375rem', '1rem', '1rem', deviceType), fontWeight: 700, color: '#111827' }}>基本情報</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: getResponsiveValue('1rem', '1.25rem', '1.25rem', deviceType) }}>
            <div>
              <label style={labelStyle}>イベント名 <span style={{ color: '#ef4444' }}>*</span></label>
              <input type="text" value={formData.name}
                onChange={(e) => { setFormData(prev => ({ ...prev, name: e.target.value })); if (errors.name) setErrors(prev => ({ ...prev, name: '' })); }}
                onBlur={() => validateForm()} placeholder="例: RADCRAFT Tokyo 2025"
                style={inputStyle(!!errors.name)} />
              {errors.name && <p style={errorStyle}>{errors.name}</p>}
            </div>
            <div>
              <label style={labelStyle}>説明 <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea value={formData.description || ''}
                onChange={(e) => { setFormData(prev => ({ ...prev, description: e.target.value })); if (errors.description) setErrors(prev => ({ ...prev, description: '' })); }}
                onBlur={() => validateForm()} placeholder="イベントの詳細を入力してください" rows={3}
                style={{ ...inputStyle(!!errors.description), resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
              {errors.description && <p style={errorStyle}>{errors.description}</p>}
            </div>
            <div>
              <label style={labelStyle}>詳細URL（オプション）</label>
              <input type="url" value={formData.detailUrl || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, detailUrl: e.target.value }))}
                placeholder="https://example.com/event-details"
                style={inputStyle(false)} />
            </div>
            <CollectionSelect
              collections={mintCollections}
              selectedCollectionId={formData.selectedCollectionId}
              onChange={(typePath, collectionId) => {
                setFormData(prev => ({ ...prev, collectionId: typePath, selectedCollectionId: collectionId }));
                setErrors(prev => ({ ...prev, collectionId: '' }));
              }}
              disabled={loadingCollections || ((event?.mintedCount ?? 0) > 0)}
              label="ミントコレクション"
              loading={loadingCollections}
              hasError={!!errors.collectionId}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
            />
            {errors.collectionId && <p style={errorStyle}>{errors.collectionId}</p>}
            {((event?.mintedCount ?? 0) > 0) && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>
                ミント済みのためコレクションは変更できません
              </p>
            )}
            {selectedCollection && (
              <div style={{
                marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: '#f0fdf4',
                border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '0.75rem', color: '#166534'
              }}>
                選択中: <strong>{selectedCollection.name}</strong>
                <span style={{ marginLeft: '0.5rem', fontFamily: 'monospace', fontSize: '0.625rem', color: '#15803d', wordBreak: 'break-all' }}>
                  {(selectedCollection as any).typePath || selectedCollection.packageId}
                </span>
              </div>
            )}
            {mintCollections.length === 0 && !loadingCollections && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#ef4444' }}>
                ミントコレクションが見つかりません。先にコレクションを作成してください。
              </p>
            )}
          </div>
        </div>
        )}

        {activeTab === 'image' && (
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: getResponsiveValue('0.9375rem', '1rem', '1rem', deviceType), fontWeight: 700, color: '#111827' }}>画像</h3>
          {previewImageUrl && (
            <div style={{ marginBottom: '1rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
              <img
                src={previewImageUrl}
                alt={formData.name || 'イベント画像'}
                style={{ width: '100%', maxHeight: '300px', objectFit: 'cover', display: 'block' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          <WalrusImageUpload
            imageCid={formData.imageCid}
            imageMimeType={formData.imageMimeType}
            onUpload={(cid, mimeType, epochs, expiry) => setFormData(prev => ({
              ...prev, imageCid: cid, imageMimeType: mimeType,
              imageStorageEpochs: epochs, imageStorageExpiry: expiry
            } as any))}
            onMessage={showToast}
          />
        </div>
        )}

        {activeTab === 'datetime' && (
        <div style={cardStyle}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: getResponsiveValue('0.9375rem', '1rem', '1rem', deviceType), fontWeight: 700, color: '#111827' }}>日時・制限設定</h3>
          <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '-0.5rem 0 1rem 0' }}>時刻は30分単位で選択できます</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: getResponsiveValue('1rem', '1.25rem', '1.25rem', deviceType) }}>
            <div>
              <label style={labelStyle}>イベント開催日時 <span style={{ color: '#ef4444' }}>*</span></label>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.375rem 0' }}>NFTに記録される実際のイベント日時</p>
              <DateTimePicker30Min
                value={formData.eventDate}
                onChange={(v) => { setFormData(prev => ({ ...prev, eventDate: v })); if (errors.eventDate) setErrors(prev => ({ ...prev, eventDate: '' })); }}
                onBlur={() => validateForm()}
                hasError={!!errors.eventDate}
                inputStyle={inputStyle}
                deviceType={deviceType}
              />
              {errors.eventDate && <p style={errorStyle}>{errors.eventDate}</p>}
            </div>
            <div>
              <label style={labelStyle}>ミント受付期間 <span style={{ color: '#ef4444' }}>*</span></label>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.5rem 0' }}>NFTをミントできる期間を設定</p>
              <div style={{ display: 'grid', gridTemplateColumns: getResponsiveValue('1fr', '1fr', '1fr 1fr', deviceType), gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>開始日時</label>
                  <DateTimePicker30Min
                    value={formData.startAt}
                    onChange={(v) => { setFormData(prev => ({ ...prev, startAt: v })); if (errors.startAt) setErrors(prev => ({ ...prev, startAt: '' })); }}
                    onBlur={() => validateForm()}
                    hasError={!!errors.startAt}
                    inputStyle={inputStyle}
                    deviceType={deviceType}
                  />
                  {errors.startAt && <p style={errorStyle}>{errors.startAt}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>終了日時</label>
                  <DateTimePicker30Min
                    value={formData.endAt}
                    onChange={(v) => { setFormData(prev => ({ ...prev, endAt: v })); if (errors.endAt) setErrors(prev => ({ ...prev, endAt: '' })); }}
                    onBlur={() => validateForm()}
                    hasError={!!errors.endAt}
                    inputStyle={inputStyle}
                    deviceType={deviceType}
                  />
                  {errors.endAt && <p style={errorStyle}>{errors.endAt}</p>}
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>ミント上限（空欄 = 無制限）</label>
              <input type="number" value={formData.totalCap || ''}
                onChange={(e) => { setFormData(prev => ({ ...prev, totalCap: e.target.value ? Number(e.target.value) : undefined })); if (errors.totalCap) setErrors(prev => ({ ...prev, totalCap: '' })); }}
                onBlur={() => validateForm()} placeholder="例: 100" min="1"
                style={inputStyle(!!errors.totalCap)} />
              {errors.totalCap && <p style={errorStyle}>{errors.totalCap}</p>}
            </div>
          </div>
        </div>
        )}

        {activeTab === 'confirm' && (
        <div style={{ ...cardStyle, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: getResponsiveValue('0.9375rem', '1rem', '1rem', deviceType), fontWeight: 700, color: '#111827' }}>確認</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            <SummaryItem label="イベント名" value={formData.name || '未入力'} missing={!formData.name} />
            <SummaryItem label="コレクション" value={selectedCollection?.name || (formData.collectionId ? formData.collectionId.split('::').pop() || '' : '未選択')} missing={!formData.collectionId} />
            <SummaryItem label="開催日時" value={formData.eventDate ? new Date(formData.eventDate).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '未設定'} missing={!formData.eventDate} />
            <SummaryItem label="ミント期間" value={formData.startAt && formData.endAt ? `${new Date(formData.startAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })} ~ ${new Date(formData.endAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}` : '未設定'} missing={!formData.startAt || !formData.endAt} />
            <SummaryItem label="ミント上限" value={typeof formData.totalCap === 'number' ? `${formData.totalCap.toLocaleString()}枚` : '無制限'} />
            <SummaryItem label="画像" value={formData.imageCid ? 'アップロード済み' : '未アップロード'} missing={!formData.imageCid} />
          </div>
        </div>
        )}
      </div>

      {/* Sticky save bar */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: getResponsiveValue('0.75rem 1rem', '1rem 1.5rem', '1rem 1.5rem', deviceType),
        background: 'white',
        borderTop: '2px solid #e5e7eb',
        boxShadow: '0 -4px 6px -1px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: getResponsiveValue('0.5rem', '0.75rem', '0.75rem', deviceType),
        zIndex: 100
      }}>
        <button onClick={handleManualDraftSave} disabled={isSaving} title="Ctrl+S / Cmd+S" style={{
          padding: getResponsiveValue('0.5rem 1rem', '0.625rem 1.25rem', '0.625rem 1.25rem', deviceType),
          borderRadius: getResponsiveValue('6px', '8px', '8px', deviceType),
          border: '1px solid #d1d5db',
          background: 'white',
          color: '#374151',
          cursor: isSaving ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.8125rem', deviceType)
        }}>
          {isSaving ? '保存中...' : 'ドラフト保存'}
        </button>
        <button onClick={handlePublish} disabled={isSaving} style={{
          padding: getResponsiveValue('0.5rem 1.25rem', '0.625rem 1.5rem', '0.625rem 1.5rem', deviceType),
          borderRadius: getResponsiveValue('6px', '8px', '8px', deviceType),
          border: 'none',
          background: isSaving ? '#d1d5db' : '#3b82f6',
          color: 'white',
          cursor: isSaving ? 'not-allowed' : 'pointer',
          fontWeight: 600,
          fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.8125rem', deviceType),
          boxShadow: isSaving ? 'none' : '0 1px 3px rgba(59, 130, 246, 0.4)'
        }}>
          {isSaving ? '公開中...' : 'イベントを公開'}
        </button>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, missing }: { label: string; value: string; missing?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: '0.6875rem', color: '#6b7280', fontWeight: 500, marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</div>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: missing ? '#ef4444' : '#111827' }}>{value}</div>
    </div>
  );
}

export default function EventEditor({ event, collections, onSave, onCancel }: EventEditorProps) {
  return (
    <ToastProvider>
      <EventEditorInner event={event} collections={collections} onSave={onSave} onCancel={onCancel} />
    </ToastProvider>
  );
}
