import React from 'react';
import { createPortal } from 'react-dom';
import { ToastProvider, useToast } from './ui/ToastProvider';
import WalrusImageUpload from './WalrusImageUpload';
import { getImageDisplayUrl } from '../utils/walrus';
import { ChevronDown } from 'lucide-react';
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
  if (!event) return { name: '', description: '', imageCid: '', imageMimeType: '', imageUrl: '', moveCall: {}, collectionId: '', startAt: '', endAt: '', eventDate: '', totalCap: undefined, status: 'draft' as const, detailUrl: '' };
  return {
    ...event,
    startAt: event.startAt ? isoToDatetimeLocal(event.startAt) : '',
    endAt: event.endAt ? isoToDatetimeLocal(event.endAt) : '',
    eventDate: event.eventDate ? isoToDatetimeLocal(event.eventDate) : ''
  };
}

function CollectionDropdown({
  collections,
  value,
  selectedCollectionId,
  onChange,
  onBlur,
  disabled,
  label,
  loading,
  hasError,
  inputStyle,
  labelStyle
}: {
  collections: MintCollection[];
  value: string;
  selectedCollectionId?: string;
  onChange: (typePath: string, collectionId: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  hasError?: boolean;
  inputStyle: (hasError: boolean) => React.CSSProperties;
  labelStyle: React.CSSProperties;
}) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const [dropdownRect, setDropdownRect] = React.useState<{ top: number; left: number; width: number } | null>(null);

  const selectedCollection = React.useMemo(() => {
    const v = (value || '').trim();
    if (!v && !selectedCollectionId) return null;
    if (selectedCollectionId) {
      const byId = collections.find(c => c.id === selectedCollectionId);
      if (byId) return byId;
    }
    if (v) {
      return collections.find(c => {
        const tp = ((c as any).typePath || c.packageId || '').trim();
        return tp === v;
      });
    }
    return null;
  }, [collections, value, selectedCollectionId]);

  React.useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      const portalEl = document.getElementById('collection-dropdown-portal');
      if (portalEl?.contains(target)) return;
      setOpen(false);
      onBlur?.();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, onBlur]);

  const handleSelect = (collection: MintCollection) => {
    const typePath = (collection as any).typePath || collection.packageId;
    onChange(typePath, collection.id);
    setOpen(false);
  };

  const baseInputStyle = inputStyle(!!hasError);

  return (
    <div style={{ position: 'relative' }}>
      <label style={labelStyle}>
        {label} <span style={{ color: '#ef4444' }}>*</span>
        {loading && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#6b7280' }}>読み込み中...</span>}
      </label>
      <div
        ref={triggerRef}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !disabled && !loading && setOpen(prev => !prev)}
        onBlur={onBlur}
        style={{
          ...baseInputStyle,
          backgroundColor: 'white',
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          userSelect: 'none'
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedCollection ? `${selectedCollection.name} (${((selectedCollection as any).typePath || selectedCollection.packageId || '').split('::').pop() || ''})` : 'コレクションを選択'}
        </span>
        <ChevronDown size={18} style={{ flexShrink: 0, opacity: open ? 0.7 : 0.5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>
      {open && dropdownRect && typeof document !== 'undefined' &&
        createPortal(
          <div
            id="collection-dropdown-portal"
            role="listbox"
            style={{
              position: 'fixed',
              top: dropdownRect.top,
              left: dropdownRect.left,
              width: Math.max(dropdownRect.width, 200),
              maxHeight: 280,
              overflowY: 'auto',
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 9999,
              padding: '4px 0'
            }}
          >
            {collections.map((collection) => {
              const typePath = ((collection as any).typePath || collection.packageId || '').trim();
              if (!typePath) return null;
              const valTrimmed = (value || '').trim();
              const isSelected = selectedCollectionId
                ? collection.id === selectedCollectionId
                : typePath === valTrimmed;
              return (
                <div
                  key={collection.id}
                  data-collection-option
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(collection)}
                  onMouseDown={(e) => e.preventDefault()}
                  style={{
                    padding: '0.5rem 1rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    background: isSelected ? '#eff6ff' : 'transparent',
                    color: isSelected ? '#1d4ed8' : '#374151'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#f9fafb';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {collection.name} ({typePath.split('::').pop() || typePath})
                </div>
              );
            })}
          </div>,
          document.body
        )
      }
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

  const initialEvent = React.useMemo(() => normalizeEventForForm(event) as Event, [event?.id, event?.collectionId, event?.startAt, event?.endAt, event?.eventDate]);
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

  const validateForm = React.useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!formData.name?.trim()) newErrors.name = 'イベント名は必須です';
    if (!formData.description?.trim()) newErrors.description = '説明は必須です';
    if (!formData.collectionId) newErrors.collectionId = 'コレクションを選択してください';
    if (!formData.eventDate) newErrors.eventDate = 'イベント開催日時は必須です';
    if (!formData.startAt) newErrors.startAt = '開始日時は必須です';
    if (!formData.endAt) newErrors.endAt = '終了日時は必須です';
    if (formData.startAt && formData.endAt && new Date(formData.startAt) >= new Date(formData.endAt)) {
      newErrors.endAt = '終了日時は開始日時より後に設定してください';
    }
    if (formData.totalCap && formData.totalCap < 1) newErrors.totalCap = 'ミント上限は1以上で設定してください';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const completionPercentage = React.useMemo(() => {
    const fields = ['name', 'description', 'collectionId', 'eventDate', 'startAt', 'endAt'];
    const completed = fields.filter(field => {
      const value = formData[field as keyof Event];
      return value && String(value).trim() !== '';
    }).length;
    return Math.round((completed / fields.length) * 100);
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

  // mintCollections が読み込まれた後、編集モードで collectionId のみある場合に selectedCollectionId を補完
  React.useEffect(() => {
    if (!event?.id || !event?.collectionId || mintCollections.length === 0) return;
    const col = mintCollections.find(c => {
      const tp = ((c as any).typePath || c.packageId || '').trim();
      return tp === String(event.collectionId || '').trim();
    });
    if (col) {
      setFormData(prev => {
        if (prev.selectedCollectionId) return prev;
        return {
          ...prev,
          selectedCollectionId: col.id,
          collectionId: ((col as any).typePath || col.packageId || '').trim()
        };
      });
    }
  }, [event?.id, event?.collectionId, mintCollections]);

  const findCollectionByTypePath = React.useCallback((collectionId: string | undefined): MintCollection | undefined => {
    if (!collectionId) return undefined;
    const cid = String(collectionId).trim();
    return mintCollections.find(c => {
      const tp = ((c as any).typePath || c.packageId || '').trim();
      return tp === cid;
    }) || mintCollections.find(c => c.id === cid);
  }, [mintCollections]);

  const findCollectionForDisplay = React.useCallback((
    collectionId: string | undefined,
    selectedCollectionId?: string
  ): MintCollection | undefined => {
    if (selectedCollectionId) {
      const byId = mintCollections.find(c => c.id === selectedCollectionId);
      if (byId) return byId;
    }
    return findCollectionByTypePath(collectionId);
  }, [mintCollections, findCollectionByTypePath]);

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

  const selectedCollection = findCollectionForDisplay(formData.collectionId, formData.selectedCollectionId);
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
                onBlur={validateForm} placeholder="例: RADCRAFT Tokyo 2025"
                style={inputStyle(!!errors.name)} />
              {errors.name && <p style={errorStyle}>{errors.name}</p>}
            </div>
            <div>
              <label style={labelStyle}>説明 <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea value={formData.description || ''}
                onChange={(e) => { setFormData(prev => ({ ...prev, description: e.target.value })); if (errors.description) setErrors(prev => ({ ...prev, description: '' })); }}
                onBlur={validateForm} placeholder="イベントの詳細を入力してください" rows={3}
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
            <CollectionDropdown
              collections={mintCollections}
              value={formData.collectionId || ''}
              selectedCollectionId={formData.selectedCollectionId}
              onChange={(typePath, collectionId) => {
                setFormData(prev => ({ ...prev, collectionId: typePath, selectedCollectionId: collectionId }));
                if (errors.collectionId) setErrors(prev => ({ ...prev, collectionId: '' }));
                validateForm();
              }}
              onBlur={validateForm}
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: getResponsiveValue('1rem', '1.25rem', '1.25rem', deviceType) }}>
            <div>
              <label style={labelStyle}>イベント開催日時 <span style={{ color: '#ef4444' }}>*</span></label>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.375rem 0' }}>NFTに記録される実際のイベント日時</p>
              <input type="datetime-local" step="1800" value={formData.eventDate || ''}
                onChange={(e) => { setFormData(prev => ({ ...prev, eventDate: e.target.value })); if (errors.eventDate) setErrors(prev => ({ ...prev, eventDate: '' })); }}
                onBlur={validateForm} style={inputStyle(!!errors.eventDate)} />
              {errors.eventDate && <p style={errorStyle}>{errors.eventDate}</p>}
            </div>
            <div>
              <label style={labelStyle}>ミント受付期間 <span style={{ color: '#ef4444' }}>*</span></label>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0 0 0.5rem 0' }}>NFTをミントできる期間を設定</p>
              <div style={{ display: 'grid', gridTemplateColumns: getResponsiveValue('1fr', '1fr', '1fr 1fr', deviceType), gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>開始日時</label>
                  <input type="datetime-local" step="1800" value={formData.startAt || ''}
                    onChange={(e) => { setFormData(prev => ({ ...prev, startAt: e.target.value })); if (errors.startAt) setErrors(prev => ({ ...prev, startAt: '' })); }}
                    onBlur={validateForm} style={inputStyle(!!errors.startAt)} />
                  {errors.startAt && <p style={errorStyle}>{errors.startAt}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>終了日時</label>
                  <input type="datetime-local" step="1800" value={formData.endAt || ''}
                    onChange={(e) => { setFormData(prev => ({ ...prev, endAt: e.target.value })); if (errors.endAt) setErrors(prev => ({ ...prev, endAt: '' })); }}
                    onBlur={validateForm} style={inputStyle(!!errors.endAt)} />
                  {errors.endAt && <p style={errorStyle}>{errors.endAt}</p>}
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>ミント上限（空欄 = 無制限）</label>
              <input type="number" value={formData.totalCap || ''}
                onChange={(e) => { setFormData(prev => ({ ...prev, totalCap: e.target.value ? Number(e.target.value) : undefined })); if (errors.totalCap) setErrors(prev => ({ ...prev, totalCap: '' })); }}
                onBlur={validateForm} placeholder="例: 100" min="1"
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
