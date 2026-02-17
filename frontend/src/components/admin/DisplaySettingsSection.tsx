import { useState, useEffect } from 'react';
import { getResponsiveValue } from '../../hooks/useResponsive';
import type { AdminMintEvent, DisplaySettings } from '../../types';

interface DisplaySettingsSectionProps {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  collections: any[];
  mintCollections: any[];
  events: AdminMintEvent[];
  displaySettings?: DisplaySettings;
  onSave: (settings: DisplaySettings) => void;
  updatePending: boolean;
}

export function DisplaySettingsSection({
  deviceType,
  collections,
  mintCollections,
  events,
  displaySettings,
  onSave,
  updatePending
}: DisplaySettingsSectionProps) {
  const [enabledCollections, setEnabledCollections] = useState<string[]>(
    displaySettings?.enabledCollections || []
  );
  const [enabledEvents, setEnabledEvents] = useState<string[]>(
    displaySettings?.enabledEvents || []
  );
  const [customNFTTypes, setCustomNFTTypes] = useState<string[]>(
    displaySettings?.customNFTTypes || []
  );
  const [newCustomNFTType, setNewCustomNFTType] = useState('');
  const [detectedCollectionName, setDetectedCollectionName] = useState<string | null>(null);
  const [includeKiosk, setIncludeKiosk] = useState<boolean>(
    displaySettings?.includeKiosk ?? true
  );
  const [collectionDisplayNames, setCollectionDisplayNames] = useState<Record<string, string>>(
    displaySettings?.collectionDisplayNames || {}
  );
  const [collectionImageUrls, setCollectionImageUrls] = useState<Record<string, string>>(
    displaySettings?.collectionImageUrls || {}
  );
  const [collectionDetailUrls, setCollectionDetailUrls] = useState<Record<string, string>>(
    displaySettings?.collectionDetailUrls || {}
  );
  const [collectionLayouts, setCollectionLayouts] = useState<Array<{ id: string; title: string; subtitle?: string; imageUrl?: string; collectionIds: string[] }>>(
    displaySettings?.collectionLayouts || []
  );
  const [expandedEventIds, setExpandedEventIds] = useState<Set<string>>(new Set());

  const normalizeCollectionId = (collectionId: string) => {
    const match = collections.find((col: any) =>
      col.id === collectionId ||
      col.packageId === collectionId ||
      (col as any).roleId === collectionId ||
      (col as any).originalId === collectionId
    );
    return match ? match.id : collectionId;
  };

  const normalizeCollectionIds = (ids: string[]) => {
    const normalized = new Set<string>();
    ids.forEach(id => {
      normalized.add(normalizeCollectionId(id));
    });
    return Array.from(normalized);
  };

  useEffect(() => {
    if (displaySettings) {
      setEnabledCollections(normalizeCollectionIds(displaySettings.enabledCollections));
      setEnabledEvents(displaySettings.enabledEvents);
      setCustomNFTTypes(displaySettings.customNFTTypes);
      setIncludeKiosk(displaySettings.includeKiosk ?? true);
      setCollectionDisplayNames(displaySettings.collectionDisplayNames || {});

      const mappedImageUrls: Record<string, string> = {};
      const mappedDetailUrls: Record<string, string> = {};

      if (displaySettings.collectionImageUrls) {
        Object.entries(displaySettings.collectionImageUrls).forEach(([canonicalKey, value]) => {
          const matchingCollection = collections.find((col: any) =>
            normalizeCollectionId(col.id) === canonicalKey ||
            normalizeCollectionId(col.packageId || '') === canonicalKey ||
            ((col as any).roleId && normalizeCollectionId((col as any).roleId) === canonicalKey)
          );
          if (matchingCollection) {
            mappedImageUrls[matchingCollection.id] = value;
          }
        });
      }

      if (displaySettings.collectionDetailUrls) {
        Object.entries(displaySettings.collectionDetailUrls).forEach(([canonicalKey, value]) => {
          const matchingCollection = collections.find((col: any) =>
            normalizeCollectionId(col.id) === canonicalKey ||
            normalizeCollectionId(col.packageId || '') === canonicalKey ||
            ((col as any).roleId && normalizeCollectionId((col as any).roleId) === canonicalKey)
          );
          if (matchingCollection) {
            mappedDetailUrls[matchingCollection.id] = value;
          }
        });
      }

      setCollectionImageUrls(mappedImageUrls);
      setCollectionDetailUrls(mappedDetailUrls);
      const normalizedLayouts = (displaySettings.collectionLayouts || []).map(layout => ({
        id: layout.id || `layout_${Date.now()}`,
        title: layout.title || '',
        subtitle: layout.subtitle,
        imageUrl: layout.imageUrl,
        collectionIds: normalizeCollectionIds(layout.collectionIds || [])
      }));
      setCollectionLayouts(normalizedLayouts);
    } else {
      setIncludeKiosk(true);
      setEnabledCollections([]);
      setEnabledEvents([]);
      setCustomNFTTypes([]);
      setCollectionDisplayNames({});
      setCollectionImageUrls({});
      setCollectionDetailUrls({});
      setCollectionLayouts([]);
    }
  }, [displaySettings, collections]);

  const handleCollectionToggle = (collectionId: string) => {
    const canonicalId = normalizeCollectionId(collectionId);
    const wasSelected = enabledCollections.includes(canonicalId);

    setEnabledCollections(prev =>
      prev.includes(canonicalId)
        ? prev.filter(id => id !== canonicalId)
        : [...prev, canonicalId]
    );

    if (wasSelected) {
      setCollectionDisplayNames(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          if (normalizeCollectionId(key) === canonicalId) delete next[key];
        });
        return next;
      });
      setCollectionImageUrls(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          if (normalizeCollectionId(key) === canonicalId) delete next[key];
        });
        return next;
      });
      setCollectionDetailUrls(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          if (normalizeCollectionId(key) === canonicalId) delete next[key];
        });
        return next;
      });
      setCollectionLayouts(prev => prev
        .map(layout => ({
          ...layout,
          collectionIds: layout.collectionIds.filter(id => normalizeCollectionId(id) !== canonicalId)
        }))
        .filter(layout => layout.collectionIds.length > 0 || (layout.title?.trim() || layout.subtitle?.trim()))
      );
    }
  };

  const handleAddLayout = () => {
    setCollectionLayouts(prev => ([
      ...prev,
      { id: `layout_${Date.now()}`, title: '', subtitle: '', imageUrl: '', collectionIds: [] }
    ]));
  };

  const handleRemoveLayout = (layoutId: string) => {
    setCollectionLayouts(prev => prev.filter(layout => layout.id !== layoutId));
  };

  const handleLayoutFieldChange = (layoutId: string, field: 'title' | 'subtitle' | 'imageUrl', value: string) => {
    setCollectionLayouts(prev => prev.map(layout =>
      layout.id === layoutId ? { ...layout, [field]: value } : layout
    ));
  };

  const handleLayoutCollectionToggle = (layoutId: string, collectionId: string) => {
    const canonicalId = normalizeCollectionId(collectionId);
    setCollectionLayouts(prev => prev.map(layout => {
      if (layout.id !== layoutId) return layout;
      const exists = layout.collectionIds.includes(canonicalId);
      const nextIds = exists
        ? layout.collectionIds.filter(id => id !== canonicalId)
        : [...layout.collectionIds, canonicalId];
      return { ...layout, collectionIds: Array.from(new Set(nextIds)) };
    }));
  };

  const handleEventToggle = (eventId: string) => {
    setEnabledEvents(prev =>
      prev.includes(eventId)
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  const detectCollectionFromType = (typeInput: string): string | null => {
    if (!typeInput || !typeInput.includes('::')) return null;
    const parts = typeInput.split('::');
    if (parts.length < 3) return null;
    const packageId = parts[0];
    const matchedCollection = collections.find((col: any) =>
      col.packageId === packageId ||
      col.id === packageId ||
      (col as any).typePath === typeInput ||
      col.id === typeInput
    );
    return matchedCollection ? (matchedCollection.displayName || matchedCollection.name) : null;
  };

  const handleCustomNFTTypeChange = (value: string) => {
    setNewCustomNFTType(value);
    setDetectedCollectionName(detectCollectionFromType(value));
  };

  const handleAddCustomNFTType = () => {
    if (newCustomNFTType.trim() && !customNFTTypes.includes(newCustomNFTType.trim())) {
      setCustomNFTTypes(prev => [...prev, newCustomNFTType.trim()]);
      setNewCustomNFTType('');
      setDetectedCollectionName(null);
    }
  };

  const handleRemoveCustomNFTType = (nftType: string) => {
    setCustomNFTTypes(prev => prev.filter(type => type !== nftType));
  };

  const handleSave = () => {
    const sanitizedDisplayNames = Object.entries(collectionDisplayNames).reduce<Record<string, string>>((acc, [key, value]) => {
      if (!value) return acc;
      const canonical = normalizeCollectionId(key);
      if (enabledCollections.includes(canonical)) acc[canonical] = value;
      return acc;
    }, {});

    const sanitizedImageUrls = Object.entries(collectionImageUrls).reduce<Record<string, string>>((acc, [key, value]) => {
      if (!value || !value.trim()) return acc;
      const canonical = normalizeCollectionId(key);
      if (enabledCollections.includes(canonical)) acc[canonical] = value.trim();
      return acc;
    }, {});

    const sanitizedDetailUrls = Object.entries(collectionDetailUrls).reduce<Record<string, string>>((acc, [key, value]) => {
      if (!value || !value.trim()) return acc;
      const canonical = normalizeCollectionId(key);
      if (enabledCollections.includes(canonical)) acc[canonical] = value.trim();
      return acc;
    }, {});

    const virtualCollectionIds = new Set<string>();
    customNFTTypes.forEach(customType => {
      virtualCollectionIds.add(`custom_${customType.replace(/[^a-zA-Z0-9]/g, '_')}`);
      virtualCollectionIds.add(customType);
    });

    const sanitizedLayouts = collectionLayouts
      .map(layout => {
        const normalizedIds = normalizeCollectionIds(layout.collectionIds);
        const ids = normalizedIds.filter(id =>
          enabledCollections.includes(id) ||
          virtualCollectionIds.has(id) ||
          customNFTTypes.includes(id) ||
          id.startsWith('custom_')
        );
        return {
          id: layout.id || `layout_${Date.now()}`,
          title: layout.title?.trim() || '',
          subtitle: layout.subtitle?.trim() || undefined,
          imageUrl: layout.imageUrl?.trim() || undefined,
          collectionIds: ids
        };
      })
      .filter(layout => layout.collectionIds.length > 0 || layout.title || layout.subtitle);

    const collectionInfo: Record<string, { packageId: string; collectionId: string; name: string; nftType: string }> = {};

    enabledCollections.forEach(enabledId => {
      const canonicalId = normalizeCollectionId(enabledId);
      const collection = collections.find((col: any) =>
        normalizeCollectionId(col.id) === canonicalId ||
        normalizeCollectionId(col.packageId || '') === canonicalId ||
        ((col as any).roleId && normalizeCollectionId((col as any).roleId) === canonicalId)
      );
      const mintCollection = mintCollections.find((mc: any) => {
        const typePath = (mc as any).typePath;
        if (!typePath) return false;
        return normalizeCollectionId(typePath) === canonicalId ||
               normalizeCollectionId(mc.id || '') === canonicalId;
      });

      let packageId = '';
      let name = '';
      let nftType = '';

      if (collection) {
        packageId = collection.packageId || '';
        name = collection.name || enabledId;
        if (packageId && !nftType) nftType = `${packageId}::sxt_nft::EventNFT`;
      }

      if (mintCollection) {
        const typePath = (mintCollection as any).typePath;
        if (typePath) {
          if (typePath.includes('::')) {
            const extractedPackageId = typePath.split('::')[0];
            if (!packageId && extractedPackageId) packageId = extractedPackageId;
          }
          nftType = typePath;
        }
        if (!name && mintCollection.name) name = mintCollection.name;
      }

      if (canonicalId && (packageId || name || nftType)) {
        collectionInfo[canonicalId] = {
          packageId: packageId || '',
          collectionId: canonicalId,
          name: name || enabledId,
          nftType: nftType || ''
        };
      }
    });

    enabledEvents.forEach(eventId => {
      const event = events.find(e => e.id === eventId);
      if (!event || !event.collectionId) return;
      const eventCollectionId = event.collectionId;
      const normalizedEventCollectionId = normalizeCollectionId(eventCollectionId);
      if (collectionInfo[normalizedEventCollectionId] || collectionInfo[eventCollectionId]) return;

      let packageId = '';
      if (event.moveCall?.target && event.moveCall.target.includes('::')) {
        packageId = event.moveCall.target.split('::')[0];
      } else if (eventCollectionId.includes('::')) {
        packageId = eventCollectionId.split('::')[0];
      }
      const nftType = eventCollectionId;
      let collectionName = '';
      const mc = mintCollections.find((mc: any) => {
        const typePath = (mc as any).typePath || '';
        return typePath === eventCollectionId ||
               normalizeCollectionId(typePath) === normalizedEventCollectionId;
      });
      if (mc) collectionName = mc.name || '';

      if (normalizedEventCollectionId && (packageId || nftType)) {
        collectionInfo[normalizedEventCollectionId] = {
          packageId: packageId || '',
          collectionId: normalizedEventCollectionId,
          name: collectionName || eventCollectionId,
          nftType
        };
      }
    });

    onSave({
      enabledCollections,
      enabledEvents,
      customNFTTypes,
      includeKiosk,
      collectionDisplayNames: sanitizedDisplayNames,
      collectionImageUrls: sanitizedImageUrls,
      collectionDetailUrls: sanitizedDetailUrls,
      collectionLayouts: sanitizedLayouts,
      collectionInfo
    });
  };

  const inputStyle = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.875rem'
  };

  const sectionTitleStyle = {
    margin: '0 0 0.75rem 0',
    fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType),
    fontWeight: 600 as const,
    color: '#111827'
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: getResponsiveValue('1.5rem', '1.75rem', '2rem', deviceType)
    }}>
      {/* Kiosk設定 */}
      <div>
        <h3 style={sectionTitleStyle}>所有形態</h3>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.8125rem', color: '#6b7280' }}>
          Kiosk経由で保有しているNFTを表示対象に含めるかどうかを選択できます。
        </p>
        <label style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer',
          padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#f9fafb'
        }}>
          <input type="checkbox" checked={includeKiosk} onChange={(e) => setIncludeKiosk(e.target.checked)}
            style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
          <div>
            <div style={{ fontWeight: 600, color: '#111827' }}>Kiosk内のNFTを表示する</div>
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              チェックを外すとウォレットで直接保有しているNFTのみを表示します。
            </div>
          </div>
        </label>
      </div>

      {/* コレクション選択 */}
      <div>
        <h3 style={{ ...sectionTitleStyle, margin: '0 0 1rem 0' }}>表示するコレクション</h3>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
          maxHeight: '200px', overflowY: 'auto', padding: '0.75rem',
          background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb'
        }}>
          {collections.length === 0 ? (
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.875rem' }}>コレクションが登録されていません</p>
          ) : (
            collections.map((collection: any) => (
              <label key={collection.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer',
                padding: '0.5rem', borderRadius: '4px', transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <input type="checkbox" checked={enabledCollections.includes(collection.id)}
                  onChange={() => handleCollectionToggle(collection.id)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, color: '#111827', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span>{collection.name}</span>
                    {enabledCollections.includes(collection.id) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <label style={{ fontSize: '0.75rem', color: '#4b5563' }}>ALLタブ表示名</label>
                        <input type="text" value={collectionDisplayNames[collection.id] || ''}
                          onChange={(e) => setCollectionDisplayNames(prev => ({ ...prev, [collection.id]: e.target.value }))}
                          placeholder="例: SCXT / イベント名" style={{ ...inputStyle, fontSize: '0.8125rem', padding: '0.4rem 0.6rem' }} />
                        <label style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '0.25rem' }}>画像URL（任意）</label>
                        <input type="text" value={collectionImageUrls[collection.id] || ''}
                          onChange={(e) => setCollectionImageUrls(prev => ({ ...prev, [collection.id]: e.target.value }))}
                          placeholder="例: ipfs://..." style={{ ...inputStyle, fontSize: '0.8125rem', padding: '0.4rem 0.6rem' }} />
                        <label style={{ fontSize: '0.75rem', color: '#4b5563', marginTop: '0.25rem' }}>詳細URL（任意）</label>
                        <input type="text" value={collectionDetailUrls[collection.id] || ''}
                          onChange={(e) => setCollectionDetailUrls(prev => ({ ...prev, [collection.id]: e.target.value }))}
                          placeholder="例: https://example.com/collection" style={{ ...inputStyle, fontSize: '0.8125rem', padding: '0.4rem 0.6rem' }} />
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{collection.packageId}</div>
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {/* ALLタブグループ設定 */}
      <div>
        <h3 style={sectionTitleStyle}>ALLタブのグループ表示</h3>
        <p style={{ margin: '0 0 1rem 0', fontSize: '0.8125rem', color: '#6b7280' }}>
          コレクションをグループ分けして、ALLタブの見出しや用途別の表示をカスタマイズできます。
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {collectionLayouts.length === 0 && (
            <div style={{ padding: '1rem', border: '1px dashed #cbd5e1', borderRadius: '8px', background: '#f8fafc', color: '#475569', fontSize: '0.875rem' }}>
              グループ設定はまだありません。「グループを追加」をクリックして作成してください。
            </div>
          )}
          {collectionLayouts.map(layout => (
            <div key={layout.id} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem', background: '#fff' }}>
              <div style={{
                display: 'flex',
                flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
                gap: '0.75rem',
                alignItems: getResponsiveValue('stretch', 'flex-end', 'flex-end', deviceType)
              }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>グループ名</label>
                  <input type="text" value={layout.title} onChange={(e) => handleLayoutFieldChange(layout.id, 'title', e.target.value)}
                    placeholder="例: イベントNFT" style={inputStyle} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>サブタイトル（任意）</label>
                  <input type="text" value={layout.subtitle || ''} onChange={(e) => handleLayoutFieldChange(layout.id, 'subtitle', e.target.value)}
                    placeholder="例: イベント関連のNFT" style={inputStyle} />
                </div>
                <button onClick={() => handleRemoveLayout(layout.id)}
                  style={{ padding: '0.5rem 0.75rem', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  削除
                </button>
              </div>
              <div style={{ marginTop: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>画像URL（任意）</label>
                <input type="text" value={layout.imageUrl || ''} onChange={(e) => handleLayoutFieldChange(layout.id, 'imageUrl', e.target.value)}
                  placeholder="https://example.com/image.png" style={inputStyle} />
              </div>
              <div style={{ marginTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                {enabledCollections.length === 0 && (
                  <div style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>表示するコレクションを選択すると設定できます。</div>
                )}
                {enabledCollections.map(enabledId => {
                  const col = collections.find((c: any) => normalizeCollectionId(c.id) === enabledId || normalizeCollectionId(c.packageId || '') === enabledId) || collections.find((c: any) => c.id === enabledId);
                  const lbl = collectionDisplayNames[enabledId] || col?.name || enabledId;
                  return (
                    <label key={`${layout.id}-${enabledId}`} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.75rem',
                      border: '1px solid #e5e7eb', borderRadius: '999px',
                      background: layout.collectionIds.includes(enabledId) ? '#eef2ff' : '#f9fafb',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}>
                      <input type="checkbox" checked={layout.collectionIds.includes(enabledId)}
                        onChange={() => handleLayoutCollectionToggle(layout.id, enabledId)} style={{ cursor: 'pointer' }} />
                      <span style={{ fontSize: '0.8125rem', color: '#1f2937' }}>{lbl}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
          <button onClick={handleAddLayout} disabled={enabledCollections.length === 0}
            style={{
              alignSelf: 'flex-start', padding: '0.6rem 1.25rem',
              background: enabledCollections.length === 0 ? '#e2e8f0' : '#2563eb',
              color: enabledCollections.length === 0 ? '#94a3b8' : '#fff',
              border: 'none', borderRadius: '6px',
              cursor: enabledCollections.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.8125rem', fontWeight: 600
            }}>
            グループを追加
          </button>
        </div>
      </div>

      {/* イベント選択 */}
      <div>
        <h3 style={{ ...sectionTitleStyle, margin: '0 0 1rem 0' }}>表示するイベント</h3>
        <div style={{
          display: 'flex', flexDirection: 'column', gap: '0.75rem',
          maxHeight: '200px', overflowY: 'auto', padding: '0.75rem',
          background: '#f9fafb', borderRadius: '6px', border: '1px solid #e5e7eb'
        }}>
          {events.length === 0 ? (
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.875rem' }}>イベントが登録されていません</p>
          ) : (
            events.map(event => {
              const eventCollectionId = event.collectionId || '';
              const eventPackageId = event.moveCall?.target ? event.moveCall.target.split('::')[0] : (eventCollectionId.includes('::') ? eventCollectionId.split('::')[0] : '');
              const eventNFTType = eventCollectionId || (event.moveCall?.target ? event.moveCall.target.replace('::mint_to', '::EventNFT') : '');
              const isExpanded = expandedEventIds.has(event.id);
              return (
                <div key={event.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e5e7eb', background: '#f9fafb' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={enabledEvents.includes(event.id)} onChange={() => handleEventToggle(event.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '18px', height: '18px', cursor: 'pointer', marginTop: '0.25rem' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, color: '#111827' }}>{event.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>{event.description || '説明なし'}</div>
                    </div>
                  </label>
                  <div style={{ marginLeft: '2rem' }}>
                    <button onClick={() => {
                      setExpandedEventIds(prev => {
                        const next = new Set(prev);
                        next.has(event.id) ? next.delete(event.id) : next.add(event.id);
                        return next;
                      });
                    }} style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem',
                      background: isExpanded ? '#e0f2fe' : '#f0f9ff', border: '1px solid #bae6fd',
                      borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                      color: '#0c4a6e', width: '100%', justifyContent: 'space-between'
                    }}>
                      <span>イベント情報・コレクション情報</span>
                      <span style={{ fontSize: '0.875rem' }}>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                    </button>
                    {isExpanded && (
                      <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '4px', fontSize: '0.7rem', color: '#0c4a6e' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div style={{ borderBottom: '1px solid #bae6fd', paddingBottom: '0.75rem' }}>
                            <div style={{ fontWeight: 600, marginBottom: '0.5rem', fontSize: '0.75rem' }}>保存されているイベント情報</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div><strong>パッケージID:</strong><div style={{ fontFamily: 'monospace', fontSize: '0.65rem', marginTop: '0.25rem', wordBreak: 'break-all' }}>{eventPackageId || '未設定'}</div></div>
                              <div><strong>コレクションID:</strong><div style={{ fontFamily: 'monospace', fontSize: '0.65rem', marginTop: '0.25rem', wordBreak: 'break-all' }}>{eventCollectionId || '未設定'}</div></div>
                              <div><strong>名前:</strong> {event.name || '未設定'}</div>
                              <div><strong>NFTタイプ:</strong><div style={{ fontFamily: 'monospace', fontSize: '0.65rem', marginTop: '0.25rem', wordBreak: 'break-all' }}>{eventNFTType || '未設定'}</div></div>
                              {event.moveCall?.target && (
                                <div><strong>Move Call Target:</strong><div style={{ fontFamily: 'monospace', fontSize: '0.65rem', marginTop: '0.25rem', wordBreak: 'break-all' }}>{event.moveCall.target}</div></div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 独自NFTタイプ */}
      <div>
        <h3 style={{ ...sectionTitleStyle, margin: '0 0 1rem 0' }}>独自NFTタイプ</h3>
        <div style={{
          display: 'flex',
          flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
          gap: '0.75rem', marginBottom: '1rem'
        }}>
          <input type="text" value={newCustomNFTType} onChange={(e) => handleCustomNFTTypeChange(e.target.value)}
            placeholder="packageId::module::StructName"
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomNFTType(); }}
            style={{ ...inputStyle, flex: 1 }} />
          <button onClick={handleAddCustomNFTType}
            style={{ padding: '0.5rem 1.25rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
            追加
          </button>
        </div>
        {detectedCollectionName && (
          <div style={{ padding: '0.5rem 0.75rem', background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '6px', fontSize: '0.8125rem', color: '#1e40af', marginBottom: '0.5rem' }}>
            検出されたコレクション: <strong>{detectedCollectionName}</strong>
          </div>
        )}
        {customNFTTypes.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {customNFTTypes.map((nftType, index) => (
              <div key={index} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: '#f3f4f6', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <span style={{ fontSize: '0.8125rem', color: '#111827', fontFamily: 'monospace' }}>{nftType}</span>
                <button onClick={() => handleRemoveCustomNFTType(nftType)}
                  style={{ padding: '0.25rem 0.75rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 保存ボタン */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
        <button onClick={handleSave} disabled={updatePending}
          style={{
            padding: '0.75rem 2rem', background: updatePending ? '#9ca3af' : '#10b981',
            color: 'white', border: 'none', borderRadius: '6px',
            cursor: updatePending ? 'not-allowed' : 'pointer',
            fontSize: '1rem', fontWeight: 600, transition: 'background 0.2s'
          }}>
          {updatePending ? '保存中...' : '設定を保存'}
        </button>
      </div>
    </div>
  );
}
