import { useState, useMemo } from 'react';
import { useWalletWithErrorHandling } from './useWallet';
import { useCollections } from './queries/useCollections';
import { useEvents } from './queries/useEvents';
import { useOwnedNFTs, useOnchainCounts } from './queries/useNFTs';
import { useResponsive } from './useResponsive';
import { useDisplaySettings } from './useDisplaySettings';
import type { DisplaySettings } from '../types';

const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  enabledCollections: [],
  enabledEvents: [],
  customNFTTypes: [],
  includeKiosk: true,
  collectionDisplayNames: {},
  collectionImageUrls: {},
  collectionDetailUrls: {},
  collectionLayouts: []
};

export type HomeTabType = 'all' | 'owned' | 'calendar' | 'activity' | 'dashboard';

export interface OwnedNFT {
  objectId: string;
  type: string;
  display?: {
    name?: string;
    description?: string;
    image_url?: string;
    event_date?: string;
  };
  owner?: unknown;
}

export interface CollectionConfig {
  id: string;
  name: string;
  packageId: string;
  displayName: string;
  description?: string;
  isActive: boolean;
  roleId?: string;
  originalId?: string;
  imageUrl?: string;
  detailUrl?: string;
}

export interface EventConfig {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  imageCid?: string;
  imageMimeType?: string;
  active: boolean;
  startAt?: string;
  endAt?: string;
  eventDate?: string;
  collectionId: string;
  displayName?: string;
  totalCap?: number;
  mintedCount?: number;
  moveCall?: {
    target?: string;
    typeArguments?: string[];
    argumentsTemplate?: string[];
    gasBudget?: number;
  };
}

export interface DisplaySettingsState extends DisplaySettings {
  enabledCollections: string[];
  enabledEvents: string[];
  customNFTTypes: string[];
  includeKiosk: boolean;
}

export function useHomePageState() {
  // ウォレット接続を安全に取得
  let account: { address: string } | null = null;
  let connected = false;
  
  try {
    const walletState = useWalletWithErrorHandling();
    if (walletState && typeof walletState === 'object') {
      account = walletState.account as { address: string } | null;
      connected = walletState.connected || false;
    }
  } catch (error) {
    account = null;
    connected = false;
  }

  // タブ管理
  const [activeTab, setActiveTab] = useState<HomeTabType>('all');
  
  // コレクション管理
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  
  // NFT管理
  const [selectedNFT, setSelectedNFT] = useState<OwnedNFT | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // ソート機能
  const [sortBy, setSortBy] = useState<'eventName' | 'eventDate' | 'collection'>('eventName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // 検索機能
  const [searchQuery, setSearchQuery] = useState('');
  
  // レスポンシブ対応
  let deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';
  try {
    const responsive = useResponsive();
    deviceType = responsive.deviceType;
  } catch (error) {
    // Error handling without logging
  }

  // TanStack Query hooks
  const { data: rawCollections = [], isLoading: collectionsLoading, error: collectionsError } = useCollections();
  const { data: rawEvents = [], isLoading: eventsLoading, error: eventsError } = useEvents();
  const { data: displaySettings } = useDisplaySettings();

  // displaySettingsの内容ベースの比較のための文字列化
  // displaySettingsオブジェクト全体を依存関係として使用し、useMemo内でJSON.stringifyを使用
  // これにより、参照が変わるたびに再計算されるが、内容が同じ場合は同じキーが返される
  const displaySettingsKey = useMemo(() => {
    if (!displaySettings) return 'default';
    try {
      return JSON.stringify({
        enabledCollections: displaySettings.enabledCollections || [],
        enabledEvents: displaySettings.enabledEvents || [],
        customNFTTypes: displaySettings.customNFTTypes || [],
        includeKiosk: displaySettings.includeKiosk ?? true,
        collectionDisplayNames: displaySettings.collectionDisplayNames || {},
        collectionImageUrls: displaySettings.collectionImageUrls || {},
        collectionDetailUrls: displaySettings.collectionDetailUrls || {},
        collectionLayouts: displaySettings.collectionLayouts || []
      });
    } catch (e) {
      return 'default';
    }
    // displaySettingsの参照が変わるたびに再計算
    // TanStack Queryは通常、同じデータの場合は同じ参照を返すべきだが、
    // 念のため参照ベースの比較を行う
  }, [displaySettings]);

  const safeDisplaySettings = useMemo<DisplaySettings>(() => {
    if (
      displaySettings &&
      Array.isArray(displaySettings.enabledCollections) &&
      Array.isArray(displaySettings.enabledEvents) &&
      Array.isArray(displaySettings.customNFTTypes)
    ) {
      return {
        enabledCollections: displaySettings.enabledCollections,
        enabledEvents: displaySettings.enabledEvents,
        customNFTTypes: displaySettings.customNFTTypes,
        includeKiosk: typeof displaySettings.includeKiosk === 'boolean' ? displaySettings.includeKiosk : true,
        collectionDisplayNames: displaySettings.collectionDisplayNames || {},
        collectionImageUrls: displaySettings.collectionImageUrls || {},
        collectionDetailUrls: displaySettings.collectionDetailUrls || {},
        collectionLayouts: Array.isArray(displaySettings.collectionLayouts) ? displaySettings.collectionLayouts : []
      };
    }
    return DEFAULT_DISPLAY_SETTINGS;
  }, [displaySettingsKey]);

  const { normalizedEnabledCollections, normalizedCollectionNames, normalizedCollectionLayouts } = useMemo<{
    normalizedEnabledCollections: string[];
    normalizedCollectionNames: Record<string, string>;
    normalizedCollectionLayouts: Array<{ id: string; title: string; subtitle?: string; imageUrl?: string; collectionIds: string[]; originalCollectionIds: string[] }>;
  }>(() => {
    if (!rawCollections || !Array.isArray(rawCollections)) {
      return {
        normalizedEnabledCollections: safeDisplaySettings.enabledCollections,
        normalizedCollectionNames: { ...(safeDisplaySettings.collectionDisplayNames || {}) },
        normalizedCollectionLayouts: (safeDisplaySettings.collectionLayouts || []).map(layout => ({
          ...layout,
          originalCollectionIds: layout.collectionIds || []
        }))
      };
    }

    const normalized = new Set<string>();
    const names: Record<string, string> = { ...(safeDisplaySettings.collectionDisplayNames || {}) };

    safeDisplaySettings.enabledCollections.forEach(id => {
      normalized.add(id);
      const match = rawCollections.find(col => 
        col.id === id || 
        col.packageId === id || 
        (col as any).roleId === id ||
        (col as any).originalId === id
      );
      if (match) {
        normalized.add(match.id);
        if (match.packageId) normalized.add(match.packageId);
        const roleId = (match as any).roleId;
        if (roleId) normalized.add(roleId);

        const displayName = safeDisplaySettings.collectionDisplayNames?.[id];
        if (displayName) {
          names[id] = displayName;
          names[match.id] = displayName;
          if (match.packageId) names[match.packageId] = displayName;
          if (roleId) names[roleId] = displayName;
        }
      }
    });

    const layouts = (safeDisplaySettings.collectionLayouts || []).map(layout => {
      return {
        id: layout.id || `layout_${(layout.collectionIds || []).join('_')}`,
        title: layout.title || '',
        subtitle: layout.subtitle,
        imageUrl: layout.imageUrl,
        collectionIds: Array.from(new Set((layout.collectionIds || []).map(id => {
          const match = rawCollections.find(col => 
            col.id === id ||
            col.packageId === id ||
            (col as any).roleId === id ||
            (col as any).originalId === id
          );
          return match ? match.id : id;
        }))),
        originalCollectionIds: layout.collectionIds || [] // 元の値を保存
      };
    });

    const normalizedArray = Array.from(normalized);
    return {
      normalizedEnabledCollections: normalizedArray,
      normalizedCollectionNames: names,
      normalizedCollectionLayouts: layouts
    };
  }, [safeDisplaySettings.enabledCollections, safeDisplaySettings.collectionDisplayNames, safeDisplaySettings.collectionLayouts, rawCollections]);

  const hasSelectionFilters = useMemo(() => (
    normalizedEnabledCollections.length > 0 ||
    safeDisplaySettings.enabledEvents.length > 0 ||
    safeDisplaySettings.customNFTTypes.length > 0
  ), [normalizedEnabledCollections.length, safeDisplaySettings.enabledEvents.length, safeDisplaySettings.customNFTTypes.length]);

  const hasDisplaySettings = useMemo(() => (
    hasSelectionFilters || safeDisplaySettings.includeKiosk !== true
  ), [hasSelectionFilters, safeDisplaySettings.includeKiosk]);

  // enabledCollectionsからNFTタイプ（::を含む）を検出してcustomNFTTypesに追加
  const effectiveCustomNFTTypes = useMemo(() => {
    const customTypes = new Set<string>(safeDisplaySettings.customNFTTypes || []);
      // enabledCollectionsにNFTタイプ（::を含む）が含まれている場合は自動追加
      safeDisplaySettings.enabledCollections.forEach(id => {
        if (id.includes('::') && id.split('::').length >= 3) {
          // packageId::module::StructName 形式と判定
          customTypes.add(id);
        }
      });
    // collectionLayoutsのcollectionIdsからも検出
    (safeDisplaySettings.collectionLayouts || []).forEach(layout => {
      (layout.collectionIds || []).forEach(id => {
        if (id.includes('::') && id.split('::').length >= 3) {
          customTypes.add(id);
        }
      });
    });
    return Array.from(customTypes);
  }, [safeDisplaySettings.enabledCollections, safeDisplaySettings.customNFTTypes, safeDisplaySettings.collectionLayouts]);

  const enabledCollectionSet = useMemo(() => {
    const set = new Set<string>();
    normalizedEnabledCollections.forEach(id => set.add(id));
    return set;
  }, [normalizedEnabledCollections]);
  const enabledEventSet = useMemo(() => new Set(safeDisplaySettings.enabledEvents), [safeDisplaySettings.enabledEvents]);
  const customNFTTypesSet = useMemo(() => new Set(effectiveCustomNFTTypes), [effectiveCustomNFTTypes]);
  const includeKiosk = safeDisplaySettings.includeKiosk ?? true;

  const isKioskOwned = (owner: any): boolean => {
    if (!owner) return false;
    if (owner.ObjectOwner) return true;
    if (owner?.parent?.address) return true;
    if (owner?.parent && typeof owner.parent === 'object' && owner.parent.address) return true;
    if (owner.Parent) return true;
    return false;
  };

  // エラーハンドリング

  // コレクションタイプパス
  const collectionTypes = useMemo(() => {
    if (!rawCollections || !Array.isArray(rawCollections)) {
      return effectiveCustomNFTTypes;
    }
    const types = rawCollections.map(col => col?.id).filter(Boolean);
    // effectiveCustomNFTTypesも追加（collectionLayoutsに登録されているNFTタイプを含む）
    const allTypes = new Set([...types, ...effectiveCustomNFTTypes]);
    
    // 有効化されたイベントのcollectionIdも追加（ミント用コレクションのtypePathを含める）
    if (rawEvents && Array.isArray(rawEvents) && enabledEventSet.size > 0) {
      rawEvents.forEach(event => {
        if (enabledEventSet.has(event.id) && event.collectionId) {
          // collectionIdがNFTタイプ形式（::を含む）の場合のみ追加
          if (event.collectionId.includes('::') && event.collectionId.split('::').length >= 3) {
            allTypes.add(event.collectionId);
          }
        }
      });
    }
    
    return Array.from(allTypes);
  }, [rawCollections, effectiveCustomNFTTypes, rawEvents, enabledEventSet]);

  const normalizedCollectionTypesForOwned = useMemo(() => {
    if (!collectionTypes || collectionTypes.length === 0) {
      return [] as string[];
    }
    return Array.from(new Set(collectionTypes.filter(Boolean))).sort();
  }, [collectionTypes]);

  // オンチェーンカウント（ダッシュボードタブ表示時のみ取得）
  const shouldLoadOnchainCounts = activeTab === 'dashboard';
  const { data: onchainCounts = new Map() } = useOnchainCounts(normalizedCollectionTypesForOwned, {
    enabled: shouldLoadOnchainCounts
  });


  // 所有NFT
  const { data: allOwnedNFTs = [], isLoading: nftLoading, error: nftError } = useOwnedNFTs(
    account?.address || '',
    normalizedCollectionTypesForOwned
  );


  // ローディング状態
  const loading = collectionsLoading || eventsLoading || nftLoading;

  // クリティカルエラー
  const hasCriticalErrors = Boolean(collectionsError || eventsError || nftError);

  // NFT分類（表示設定に基づくフィルタリング）
  const eventNFTs = useMemo(() => {
    if (!allOwnedNFTs || !Array.isArray(allOwnedNFTs) || !rawEvents || !Array.isArray(rawEvents) || !rawCollections || !Array.isArray(rawCollections)) {
      return [];
    }
    
    if (hasSelectionFilters) {
      
      const eventNames = new Set(rawEvents.filter(e => enabledEventSet.has(e.id)).map(e => e.name));

      const filtered = allOwnedNFTs.filter(nft => {
        if (!includeKiosk && isKioskOwned(nft.owner)) {
          return false;
        }
        
        if (!nft.type) {
          return false;
        }
        
        const normalizedNftType = nft.type.trim();
        
        // 1. 選択されたコレクションに含まれるNFT（より柔軟なマッチング）
        // enabledCollectionSetに直接含まれる場合
        if (enabledCollectionSet.has(normalizedNftType)) {
          return true;
        }
        
        // normalizedEnabledCollections内のすべてのIDをチェック（packageId、canonical IDなど）
        for (const enabledId of normalizedEnabledCollections) {
          const normalizedEnabledId = enabledId.trim();
          if (normalizedNftType === normalizedEnabledId) {
            return true;
          }
          // 部分一致チェック
          if (normalizedNftType.includes(normalizedEnabledId) || normalizedEnabledId.includes(normalizedNftType)) {
            return true;
          }
        }
        
        // rawCollectionsでのマッチング（より詳細なチェック）
        // enabledCollectionSetに含まれるコレクションだけでなく、
        // normalizedEnabledCollectionsに含まれるIDに対応するコレクションもチェック
        const collectionMatch = rawCollections.some(col => {
          const colId = col.id.trim();
          const colPackageId = col.packageId?.trim();
          const roleId = (col as any).roleId?.trim();
          
          // enabledCollectionSetに含まれる場合
          if (enabledCollectionSet.has(colId)) {
            // 完全一致
            if (colId === normalizedNftType || colPackageId === normalizedNftType) {
              return true;
            }
            
            // packageIdの部分一致
            if (colPackageId && (normalizedNftType.includes(colPackageId) || colPackageId.includes(normalizedNftType))) {
              return true;
            }
            
            // roleIdのチェック（存在する場合）
            if (roleId && (normalizedNftType === roleId || normalizedNftType.includes(roleId) || roleId.includes(normalizedNftType))) {
              return true;
            }
          }
          
          // normalizedEnabledCollectionsに含まれるIDと一致するコレクションもチェック
          // （collectionLayoutsで指定されたコレクションIDなど）
          for (const enabledId of normalizedEnabledCollections) {
            const normalizedEnabledId = enabledId.trim();
            
            // コレクションIDが一致する場合
            if (colId === normalizedEnabledId || colPackageId === normalizedEnabledId || roleId === normalizedEnabledId) {
              // このコレクションのNFTタイプとマッチング
              if (colId === normalizedNftType || colPackageId === normalizedNftType) {
                return true;
              }
              if (colPackageId && (normalizedNftType.includes(colPackageId) || colPackageId.includes(normalizedNftType))) {
                return true;
              }
              if (roleId && (normalizedNftType === roleId || normalizedNftType.includes(roleId) || roleId.includes(normalizedNftType))) {
                return true;
              }
            }
          }
          
          return false;
        });
        if (collectionMatch) return true;
        
        // collectionLayoutsで指定されたコレクションIDもチェック
        // collectionLayoutsのcollectionIdsに含まれるIDと、そのIDに対応するコレクションのpackageIdなどでマッチング
        for (const layout of normalizedCollectionLayouts) {
          for (const layoutCollectionId of layout.collectionIds || []) {
            const normalizedLayoutId = layoutCollectionId.trim();
            
            // 直接一致
            if (normalizedNftType === normalizedLayoutId) {
              return true;
            }
            
            // 部分一致
            if (normalizedNftType.includes(normalizedLayoutId) || normalizedLayoutId.includes(normalizedNftType)) {
              return true;
            }
            
            // collectionLayoutsのcollectionIdに対応するコレクションを探す
            const matchingCollection = rawCollections.find(col => {
              const colId = col.id.trim();
              const colPackageId = col.packageId?.trim();
              const roleId = (col as any).roleId?.trim();
              return colId === normalizedLayoutId || 
                     colPackageId === normalizedLayoutId || 
                     roleId === normalizedLayoutId;
            });
            
            if (matchingCollection) {
              const colId = matchingCollection.id.trim();
              const colPackageId = matchingCollection.packageId?.trim();
              const roleId = (matchingCollection as any).roleId?.trim();
              
              // このコレクションの識別子でNFTをマッチング
              if (colId === normalizedNftType || colPackageId === normalizedNftType) {
                return true;
              }
              if (colPackageId && (normalizedNftType.includes(colPackageId) || colPackageId.includes(normalizedNftType))) {
                return true;
              }
              if (roleId && (normalizedNftType === roleId || normalizedNftType.includes(roleId) || roleId.includes(normalizedNftType))) {
                return true;
              }
            }
          }
        }

        // 2. 選択されたイベントに登録されているNFT
        if (enabledEventSet.size > 0) {
          const nftName = nft.display?.name;
          const eventDate = nft.display?.event_date;
          const nameMatches = nftName && eventNames.has(nftName);
          const hasValidEventDate = eventDate && 
            eventDate !== '{eventDate}' && 
            eventDate !== 'null' && 
            eventDate !== 'Unknown' &&
            !isNaN(new Date(eventDate).getTime());
          if (nameMatches && hasValidEventDate) {
            return true;
          }
        }

        // 3. 独自NFTタイプに該当するNFT
        // 完全一致をチェック
        if (customNFTTypesSet.has(normalizedNftType)) {
          return true;
        }
        
        // 部分一致をチェック（customTypeがnft.typeに含まれる、またはその逆）
        for (const customType of customNFTTypesSet) {
          const normalizedCustomType = customType.trim();
          
          if (normalizedNftType === normalizedCustomType) {
            return true;
          }
          // より柔軟なマッチング: いずれかがもう一方を含む
          if (normalizedNftType.includes(normalizedCustomType) || normalizedCustomType.includes(normalizedNftType)) {
            return true;
          }
          
          // packageId部分だけを比較（より柔軟なマッチング）
          const nftPackageId = normalizedNftType.split('::')[0];
          const customPackageId = normalizedCustomType.split('::')[0];
          if (nftPackageId && customPackageId && (nftPackageId === customPackageId || nftPackageId.includes(customPackageId) || customPackageId.includes(nftPackageId))) {
            // さらに、モジュール名と構造体名も確認
            const nftParts = normalizedNftType.split('::');
            const customParts = normalizedCustomType.split('::');
            if (nftParts.length >= 3 && customParts.length >= 3) {
              const nftModule = nftParts[1];
              const customModule = customParts[1];
              const nftStruct = nftParts[2];
              const customStruct = customParts[2];
              if (nftModule === customModule && nftStruct === customStruct) {
                return true;
              }
            }
          }
        }

        return false;
      });
      
      return filtered;
    }

    // 表示設定がない場合：デフォルト動作（イベント登録済みNFTのみ）
    const eventNames = new Set(rawEvents.map(e => e.name));
    return allOwnedNFTs.filter(nft => {
      const nftName = nft.display?.name;
      const eventDate = nft.display?.event_date;
      
      if (!includeKiosk && isKioskOwned(nft.owner)) {
        return false;
      }

      const nameMatches = nftName && eventNames.has(nftName);
      const hasValidEventDate = eventDate && 
        eventDate !== '{eventDate}' && 
        eventDate !== 'null' && 
        eventDate !== 'Unknown' &&
        !isNaN(new Date(eventDate).getTime());
      
      return nameMatches && hasValidEventDate;
    });
  }, [
    allOwnedNFTs,
    rawEvents,
    rawCollections,
    hasSelectionFilters,
    enabledCollectionSet,
    normalizedEnabledCollections,
    normalizedCollectionLayouts,
    enabledEventSet,
    customNFTTypesSet,
    includeKiosk
  ]);

  // イベント登録されていないNFT（OwnedTabで使用）
  // eventNFTsに含まれないNFTを返す
  const nonEventNFTs = useMemo(() => {
    if (!allOwnedNFTs || !Array.isArray(allOwnedNFTs)) {
      return [];
    }
    
    const eventNFTIds = new Set(eventNFTs.map(nft => nft.objectId));
    return allOwnedNFTs.filter(nft => {
      if (eventNFTIds.has(nft.objectId)) {
        return false;
      }
      if (!includeKiosk && isKioskOwned(nft.owner)) {
        return false;
      }
      return true;
    });
  }, [allOwnedNFTs, eventNFTs, includeKiosk]);

  // OWNEDタブ用のNFT一覧
  // シンプルなロジック: enabledCollectionsとenabledEventsに基づいて表示
  const ownedTabNFTs = useMemo(() => {
    if (!hasSelectionFilters) {
      return nonEventNFTs;
    }
    
    if (!allOwnedNFTs || !Array.isArray(allOwnedNFTs)) {
      return [];
    }
    
    // enabledEventsに含まれるイベントのcollectionIdと名前のペアを取得
    const enabledEventMatches: Array<{ collectionId: string; name: string }> = [];
    if (rawEvents && Array.isArray(rawEvents) && enabledEventSet.size > 0) {
      rawEvents.forEach(event => {
        if (enabledEventSet.has(event.id)) {
          if (event.collectionId && event.name) {
            enabledEventMatches.push({
              collectionId: event.collectionId.trim(),
              name: event.name
            });
          }
        }
      });
    }
    
    // フィルタリング: enabledCollections、enabledEvents、customNFTTypesに基づく
    // 注意: Kiosk所有NFTでもnft.typeは同じなので、コレクションIDのマッチングは問題なく動作する
    const filtered = allOwnedNFTs.filter(nft => {
      // Kiosk所有NFTのチェック（includeKioskがfalseの場合、Kiosk所有NFTを除外）
      // このチェックは最初に行うことで、Kiosk所有NFTを早期に除外できる
      if (!includeKiosk && isKioskOwned(nft.owner)) {
        return false;
      }
      
      if (!nft.type) {
        return false;
      }
      
      const nftType = nft.type.trim();
      
      // 1. enabledEvents: イベントのcollectionIdとNFTのtypeが一致 **かつ** NFTの名前とイベントの名前が一致
      // Kiosk所有NFTでもtypeは同じなので、このマッチングは正常に動作する
      if (enabledEventMatches.length > 0 && nft.display?.name) {
        const nftName = nft.display.name;
        for (const eventMatch of enabledEventMatches) {
          if (nftType === eventMatch.collectionId && nftName === eventMatch.name) {
            return true;
          }
        }
      }
      
      // 2. enabledCollections: コレクションIDとNFTのtypeが一致
      // Kiosk所有NFTでもtypeは同じなので、このマッチングは正常に動作する
      for (const enabledCollectionId of normalizedEnabledCollections) {
        const normalizedId = enabledCollectionId.trim();
        if (nftType === normalizedId) {
          return true;
        }
      }
      
      // 3. customNFTTypes: カスタムNFTタイプと一致
      // Kiosk所有NFTでもtypeは同じなので、このマッチングは正常に動作する
      if (customNFTTypesSet.has(nftType)) {
        return true;
      }
      // 正規化された値で再チェック（trimされた値の可能性があるため）
      for (const customType of customNFTTypesSet) {
        if (nftType === customType.trim()) {
          return true;
        }
      }
      
      return false;
    });
    
    return filtered;
  }, [hasSelectionFilters, nonEventNFTs, allOwnedNFTs, includeKiosk, enabledEventSet, rawEvents, normalizedEnabledCollections, customNFTTypesSet]);

  const filteredEvents = useMemo(() => {
    if (!rawEvents || !Array.isArray(rawEvents)) {
      return [];
    }

    if (!hasSelectionFilters) {
      return rawEvents;
    }

    return rawEvents.filter(event => {
      const collectionId = event.collectionId;

      if (enabledEventSet.has(event.id)) {
        return true;
      }

      if (collectionId && enabledCollectionSet.has(collectionId)) {
        return true;
      }

      if (collectionId) {
        if (customNFTTypesSet.has(collectionId)) {
          return true;
        }
        for (const customType of customNFTTypesSet) {
          if (collectionId.includes(customType)) {
            return true;
          }
        }
      }

      return false;
    });
  }, [
    rawEvents,
    hasSelectionFilters,
    enabledEventSet,
    enabledCollectionSet,
    customNFTTypesSet
    // eventNFTsの依存関係を削除して循環依存を解消
  ]);

  const filteredCollections = useMemo(() => {
    if (!rawCollections || !Array.isArray(rawCollections)) {
      return [] as (typeof rawCollections);
    }

    const collectionImageUrls = safeDisplaySettings.collectionImageUrls || {};
    const collectionDetailUrls = safeDisplaySettings.collectionDetailUrls || {};

    const addDisplayName = (col: any): CollectionConfig => {
      const roleId = (col as any).roleId;
      const imageUrl = collectionImageUrls[col.id] || 
                       collectionImageUrls[col.packageId] || 
                       (roleId ? collectionImageUrls[roleId] : undefined);
      const detailUrl = collectionDetailUrls[col.id] || 
                       collectionDetailUrls[col.packageId] || 
                       (roleId ? collectionDetailUrls[roleId] : undefined);
      return {
        ...col,
        displayName: normalizedCollectionNames[col.id] || col.displayName || (col.packageId ? normalizedCollectionNames[col.packageId] : undefined) || col.name,
        imageUrl: imageUrl,
        detailUrl: detailUrl
      };
    };

    if (!hasSelectionFilters) {
      return rawCollections.map(addDisplayName);
    }

    const eventCollectionIds = new Set(
      filteredEvents
        .map(event => event.collectionId)
        .filter((id): id is string => Boolean(id))
    );

    const nftCollectionTypes = new Set(
      allOwnedNFTs
        .map(nft => nft.type)
        .filter((type): type is string => Boolean(type))
    );

    const filtered = rawCollections.filter(col => {
      const colId = col.id;
      const packageId = col.packageId;

      if (enabledCollectionSet.has(colId)) {
        return true;
      }

      if (packageId && enabledCollectionSet.has(packageId)) {
        return true;
      }

      if (eventCollectionIds.has(colId) || (packageId && eventCollectionIds.has(packageId))) {
        return true;
      }

      if (packageId && customNFTTypesSet.has(packageId)) {
        return true;
      }

      for (const customType of customNFTTypesSet) {
        if (packageId && packageId.includes(customType)) {
          return true;
        }
      }

      for (const nftType of nftCollectionTypes) {
        if (nftType === colId) {
          return true;
        }
        if (packageId && (nftType === packageId || nftType.includes(packageId))) {
          return true;
        }
      }

      return false;
    });

    return filtered.map(addDisplayName);
  }, [
    rawCollections,
    hasDisplaySettings,
    hasSelectionFilters,
    enabledCollectionSet,
    customNFTTypesSet,
    filteredEvents,
    allOwnedNFTs,
    normalizedCollectionNames,
    safeDisplaySettings.collectionImageUrls
  ]);

  // Collection Layout Section用のグループ（collectionLayoutsのみ）
  const collectionLayoutGroups = useMemo(() => {
    const groups: Array<{
      id: string;
      title: string;
      subtitle?: string;
      imageUrl?: string;
      collectionIds: string[];
      collections: CollectionConfig[];
      events: EventConfig[];
      ownedNFTs: OwnedNFT[];
    }> = [];

    if (!normalizedCollectionLayouts || normalizedCollectionLayouts.length === 0) {
      return groups;
    }

    // Collection Layout Section用の共通処理
    const collectionMap = new Map<string, CollectionConfig>();
    filteredCollections.forEach(col => {
      const displayName = col.displayName || normalizedCollectionNames[col.id] || col.name;
      collectionMap.set(col.id, { ...col, displayName });
    });

    const synonymToCanonical = new Map<string, string>();
    filteredCollections.forEach(col => {
      const synonyms = [col.id, col.packageId, (col as any).originalId, (col as any).roleId].filter(Boolean) as string[];
      synonyms.forEach(value => synonymToCanonical.set(value, col.id));
    });

    const resolveCanonical = (value?: string) => {
      if (!value) return undefined;
      if (synonymToCanonical.has(value)) {
        return synonymToCanonical.get(value);
      }
      for (const [synonym, canonical] of synonymToCanonical.entries()) {
        if (value.includes(synonym)) {
          return canonical;
        }
      }
      return undefined;
    };

    const eventsByCollection = new Map<string, EventConfig[]>();

    const normalizeEvent = (event: any, canonicalId: string): EventConfig => ({
      id: event.id,
      name: event.name,
      description: event.description,
      imageUrl: event.imageUrl ?? event.image_url,
      imageCid: event.imageCid ?? event.image_cid,
      imageMimeType: event.imageMimeType ?? event.image_mimeType,
      active: typeof event.active === 'boolean' ? event.active : true,
      startAt: event.startAt,
      endAt: event.endAt,
      eventDate: event.eventDate,
      collectionId: canonicalId,
      displayName: event.displayName,
      totalCap: event.totalCap,
      mintedCount: event.mintedCount,
      moveCall: event.moveCall ? {
        target: event.moveCall.target,
        typeArguments: event.moveCall.typeArguments || [],
        argumentsTemplate: Array.isArray(event.moveCall.argumentsTemplate)
          ? event.moveCall.argumentsTemplate
          : event.moveCall.argumentsTemplate
            ? [event.moveCall.argumentsTemplate]
            : [],
        gasBudget: event.moveCall.gasBudget
      } : undefined
    });

    filteredEvents.forEach(event => {
      const canonical = resolveCanonical(event.collectionId);
      if (canonical && collectionMap.has(canonical)) {
        if (!eventsByCollection.has(canonical)) {
          eventsByCollection.set(canonical, []);
        }
        eventsByCollection.get(canonical)!.push(normalizeEvent(event, canonical));
      }
    });

    const nftsByCollection = new Map<string, OwnedNFT[]>();
    allOwnedNFTs.forEach(nft => {
      if (!nft.type) return;
      const canonical = resolveCanonical(nft.type);
      if (canonical && collectionMap.has(canonical)) {
        if (!nftsByCollection.has(canonical)) {
          nftsByCollection.set(canonical, []);
        }
        nftsByCollection.get(canonical)!.push(nft);
      }
    });

    const assigned = new Set<string>();

    const addGroup = (groupId: string, title: string, subtitle: string | undefined, collectionIds: string[], isCollectionGroup: boolean = false, originalCollectionIds?: string[], layoutEvents?: EventConfig[], imageUrl?: string) => {
      // collectionLayoutsのコレクショングループの場合、rawCollectionsのコレクションは使用しない
      // collectionIdsには元のNFTタイプが含まれているため、collectionMapから取得しない
      let canonicalIds: string[] = [];
      let groupCollections: CollectionConfig[] = [];
      
      if (isCollectionGroup && originalCollectionIds && originalCollectionIds.length > 0) {
        // collectionLayoutsのコレクショングループの場合、originalCollectionIdsから仮想的なコレクションエントリを作成
        // NFTを持っていなくても表示できるようにする
        // layoutのtitleを使用（複数のoriginalCollectionIdsがある場合は、最初のものに適用）
        const useTitleAsName = originalCollectionIds.length === 1 && title && title !== originalCollectionIds[0];
        
        const collectionImageUrls = safeDisplaySettings.collectionImageUrls || {};
        const collectionDetailUrls = safeDisplaySettings.collectionDetailUrls || {};
        
        groupCollections = originalCollectionIds.map((nftType, index) => {
          const typeParts = nftType.split('::');
          // normalizedCollectionNamesから取得、なければlayoutのtitle（1つの場合のみ）、なければ最後の部分
          const displayName = normalizedCollectionNames[nftType] || 
                             (useTitleAsName && index === 0 ? title : undefined) ||
                             typeParts[typeParts.length - 1] || 
                             nftType;
          
          // collectionImageUrlsとcollectionDetailUrlsから画像URLと詳細URLを取得
          // まず、rawCollectionsから対応するコレクションを探す
          let imageUrl: string | undefined = undefined;
          let detailUrl: string | undefined = undefined;
          if (rawCollections && Array.isArray(rawCollections)) {
            const matchedCollection = rawCollections.find(col => 
              col.id === nftType ||
              col.packageId === nftType ||
              (col as any).roleId === nftType ||
              (col as any).originalId === nftType ||
              nftType.includes(col.id) ||
              (col.packageId && nftType.includes(col.packageId))
            );
            
            if (matchedCollection) {
              // マッチしたコレクションのID、packageId、roleIdをキーとして画像URLと詳細URLを取得
              imageUrl = collectionImageUrls[matchedCollection.id] || 
                        collectionImageUrls[matchedCollection.packageId] ||
                        ((matchedCollection as any).roleId ? collectionImageUrls[(matchedCollection as any).roleId] : undefined);
              detailUrl = collectionDetailUrls[matchedCollection.id] || 
                         collectionDetailUrls[matchedCollection.packageId] ||
                         ((matchedCollection as any).roleId ? collectionDetailUrls[(matchedCollection as any).roleId] : undefined);
            }
          }
          
          // rawCollectionsで見つからない場合は、NFTタイプ自体やpackageIdをキーとして試す
          if (!imageUrl) {
            imageUrl = collectionImageUrls[nftType] || 
                      collectionImageUrls[typeParts[0] || nftType];
          }
          if (!detailUrl) {
            detailUrl = collectionDetailUrls[nftType] || 
                      collectionDetailUrls[typeParts[0] || nftType];
          }
          
          return {
            id: nftType,
            name: displayName,
            packageId: typeParts[0] || nftType,
            displayName: displayName,
            description: '',
            isActive: true,
            imageUrl: imageUrl,
            detailUrl: detailUrl,
            createdAt: new Date().toISOString()
          } as CollectionConfig;
        });
        
        // assignedには使用しない（collectionLayoutsのコレクションは除外）
      } else {
        // イベントNFTグループの場合: 既存の挙動を維持
        collectionIds.forEach(id => {
          if (collectionMap.has(id)) {
            canonicalIds.push(id);
          }
        });
        
        if (canonicalIds.length === 0) {
          return;
        }
        
        canonicalIds.forEach(id => assigned.add(id));
        groupCollections = canonicalIds
          .map(id => collectionMap.get(id))
          .filter((col): col is CollectionConfig => Boolean(col));
      }
      
      // コレクショングループの場合は、collectionIdsに該当するNFTのみを表示
      let groupNFTs: OwnedNFT[];
      if (isCollectionGroup && originalCollectionIds) {
        // コレクショングループの場合: 登録されている元のcollectionIdsのタイプと完全一致するNFTのみ
        // イベントNFTを除外するため、eventNFTsのobjectIdのSetを作成
        const eventNFTIds = new Set(eventNFTs.map(nft => nft.objectId));
        const originalIdsSet = new Set(originalCollectionIds);
        
        groupNFTs = allOwnedNFTs.filter(nft => {
          if (!nft.type) return false;
          // イベントNFTは除外
          if (eventNFTIds.has(nft.objectId)) return false;
          
          // layout.collectionIdsに登録されているタイプと一致するNFTを表示
          // 完全一致または部分一致をチェック
          let matches = originalIdsSet.has(nft.type);
          
          if (!matches) {
            // 部分一致をチェック（nft.typeがoriginalIdを含む、またはその逆）
            for (const originalId of originalCollectionIds) {
              if (nft.type.includes(originalId) || originalId.includes(nft.type)) {
                matches = true;
                break;
              }
            }
          }
          return matches;
        });
        
      } else {
        // イベントNFTグループの場合: 既存の挙動を維持
        groupNFTs = canonicalIds.flatMap(id => nftsByCollection.get(id) ?? []);
      }
      
      // collectionLayoutsの場合、layoutEventsを使用（すべてのイベントを表示）
      // イベントNFTグループの場合、既存の挙動を維持
      const groupEvents = (isCollectionGroup && layoutEvents && layoutEvents.length > 0) 
        ? layoutEvents 
        : canonicalIds.flatMap(id => eventsByCollection.get(id) ?? []);
      
      groups.push({
        id: groupId,
        title,
        subtitle,
        imageUrl,
        collectionIds: canonicalIds,
        collections: groupCollections,
        events: groupEvents,
        ownedNFTs: groupNFTs
      });
    };

    // normalizedCollectionLayoutsを使用（参照が変わる可能性があるが、内容が同じ場合は問題ない）
    normalizedCollectionLayouts.forEach(layout => {
      // originalCollectionIdsを使用（仮想コレクションを作成しない）
      if (layout.originalCollectionIds.length === 0) {
        return;
      }
      
      // collectionLayoutsのcollectionIdsからは、rawCollectionsに登録されているコレクションを使用しない
      // 常に元のNFTタイプをそのまま使用（バックエンドのコレクション登録は無視）
      // これはNFTタイプとして直接使用される
      const processedIds = layout.originalCollectionIds.map(id => {
        return id;
      });
      
      if (processedIds.length === 0) {
        return;
      }
      
      const title = layout.title || processedIds
        .map(id => id.split('::').pop() || id) // NFTタイプの最後の部分（例：Nft）を使用
        .join(', ');
      
      // Collection Layout Sectionでは、originalCollectionIdsに関連するイベントのみを表示
      const layoutEvents: EventConfig[] = [];
      const originalIdsSet = new Set(layout.originalCollectionIds);
      
      processedIds.forEach(canonicalId => {
        // 既存のイベントを取得
        const existingEvents = eventsByCollection.get(canonicalId) ?? [];
        layoutEvents.push(...existingEvents);
      });
      
      // イベントのcollectionIdがoriginalCollectionIdsに一致するもののみを追加
      filteredEvents.forEach(event => {
        if (!event.collectionId) return;
        
        // collectionIdがoriginalCollectionIdsに含まれているかチェック
        const matches = originalIdsSet.has(event.collectionId) || 
                       layout.originalCollectionIds.some(originalId => {
                         // 部分一致もチェック（collectionIdがoriginalIdを含む、またはその逆）
                         return event.collectionId.includes(originalId) || 
                                originalId.includes(event.collectionId);
                       });
        
        if (matches) {
          // 既に追加されていないかチェック
          const alreadyAdded = layoutEvents.some(e => e.id === event.id);
          if (!alreadyAdded) {
            // 最初のprocessedIdsを使用してイベントを正規化
            const canonicalId = processedIds[0] || event.collectionId;
            layoutEvents.push(normalizeEvent(event, canonicalId));
          }
        }
      });
      
      // グループを作成する前に、layoutEventsをeventsByCollectionに追加
      processedIds.forEach(canonicalId => {
        if (!eventsByCollection.has(canonicalId)) {
          eventsByCollection.set(canonicalId, []);
        }
        const existingEvents = eventsByCollection.get(canonicalId)!;
        layoutEvents.forEach(event => {
          if (!existingEvents.some(e => e.id === event.id)) {
            existingEvents.push(event);
          }
        });
      });
      
      // processedIdsをそのままcollectionIdsとして使用（rawCollectionsのコレクションは使用しない）
      // collectionLayoutsの場合、layoutEventsを渡してoriginalCollectionIdsに関連するイベントのみを表示
      addGroup(layout.id, title, layout.subtitle, processedIds, true, layout.originalCollectionIds, layoutEvents, layout.imageUrl); // コレクショングループの場合はtrue、元のcollectionIdsとlayoutEventsを渡す
    });

    return groups;
  }, [
    filteredCollections,
    filteredEvents,
    eventNFTs,
    allOwnedNFTs,
    normalizedCollectionLayouts,
    normalizedCollectionNames,
    customNFTTypesSet,
    rawCollections,
    safeDisplaySettings.collectionImageUrls,
    safeDisplaySettings.collectionDetailUrls
  ]);

  // Event NFT Section用のグループ（auto_eventsのみ）
  const eventNFTGroups = useMemo(() => {
    const groups: Array<{
      id: string;
      title: string;
      subtitle?: string;
      imageUrl?: string;
      collectionIds: string[];
      collections: CollectionConfig[];
      events: EventConfig[];
      ownedNFTs: OwnedNFT[];
    }> = [];

    if (!filteredCollections || filteredCollections.length === 0) {
      return groups;
    }

    const collectionMap = new Map<string, CollectionConfig>();
    filteredCollections.forEach(col => {
      const displayName = col.displayName || normalizedCollectionNames[col.id] || col.name;
      collectionMap.set(col.id, { ...col, displayName });
    });

    const synonymToCanonical = new Map<string, string>();
    filteredCollections.forEach(col => {
      const synonyms = [col.id, col.packageId, (col as any).originalId, (col as any).roleId].filter(Boolean) as string[];
      synonyms.forEach(value => synonymToCanonical.set(value, col.id));
    });

    const resolveCanonical = (value?: string) => {
      if (!value) return undefined;
      if (synonymToCanonical.has(value)) {
        return synonymToCanonical.get(value);
      }
      for (const [synonym, canonical] of synonymToCanonical.entries()) {
        if (value.includes(synonym)) {
          return canonical;
        }
      }
      return undefined;
    };

    const eventsByCollection = new Map<string, EventConfig[]>();

    const normalizeEvent = (event: any, canonicalId: string): EventConfig => ({
      id: event.id,
      name: event.name,
      description: event.description,
      imageUrl: event.imageUrl ?? event.image_url,
      imageCid: event.imageCid ?? event.image_cid,
      imageMimeType: event.imageMimeType ?? event.image_mimeType,
      active: typeof event.active === 'boolean' ? event.active : true,
      startAt: event.startAt,
      endAt: event.endAt,
      eventDate: event.eventDate,
      collectionId: canonicalId,
      displayName: event.displayName,
      totalCap: event.totalCap,
      mintedCount: event.mintedCount,
      moveCall: event.moveCall ? {
        target: event.moveCall.target,
        typeArguments: event.moveCall.typeArguments || [],
        argumentsTemplate: Array.isArray(event.moveCall.argumentsTemplate)
          ? event.moveCall.argumentsTemplate
          : event.moveCall.argumentsTemplate
            ? [event.moveCall.argumentsTemplate]
            : [],
        gasBudget: event.moveCall.gasBudget
      } : undefined
    });

    filteredEvents.forEach(event => {
      const canonical = resolveCanonical(event.collectionId);
      if (canonical && collectionMap.has(canonical)) {
        if (!eventsByCollection.has(canonical)) {
          eventsByCollection.set(canonical, []);
        }
        eventsByCollection.get(canonical)!.push(normalizeEvent(event, canonical));
      }
    });

    const nftsByCollection = new Map<string, OwnedNFT[]>();
    allOwnedNFTs.forEach(nft => {
      if (!nft.type) return;
      const canonical = resolveCanonical(nft.type);
      if (canonical && collectionMap.has(canonical)) {
        if (!nftsByCollection.has(canonical)) {
          nftsByCollection.set(canonical, []);
        }
        nftsByCollection.get(canonical)!.push(nft);
      }
    });

    const assigned = new Set<string>();

    const addGroup = (groupId: string, title: string, subtitle: string | undefined, collectionIds: string[]) => {
      const canonicalIds = Array.from(new Set(collectionIds)).filter(id => collectionMap.has(id));
      if (canonicalIds.length === 0) {
        return;
      }
      canonicalIds.forEach(id => assigned.add(id));
      const groupCollections = canonicalIds
        .map(id => collectionMap.get(id))
        .filter((col): col is CollectionConfig => Boolean(col));
      
      groups.push({
        id: groupId,
        title,
        subtitle,
        collectionIds: canonicalIds,
        collections: groupCollections,
        events: canonicalIds.flatMap(id => eventsByCollection.get(id) ?? []),
        ownedNFTs: canonicalIds.flatMap(id => nftsByCollection.get(id) ?? [])
      });
    };

    // collectionLayoutsで使用されているコレクションを除外
    const layoutCollectionIdsSet = new Set<string>();
    normalizedCollectionLayouts.forEach(layout => {
      layout.originalCollectionIds.forEach(id => {
        layoutCollectionIdsSet.add(id);
      });
    });

    // remainingの計算: filteredCollectionsだけでなく、collectionMapのすべてのコレクションをチェック
    // ただし、既にassignedに含まれているコレクションやcollectionLayoutsで使用されているコレクションは除外
    const allCollectionIds = Array.from(collectionMap.keys());
    
    const remaining = allCollectionIds
      .filter(id => {
        // 既にグループに含まれている場合は除外
        if (assigned.has(id)) {
          return false;
        }
        // collectionLayoutsで使用されている場合は除外
        const collection = collectionMap.get(id);
        if (collection) {
          const packageId = collection.packageId || collection.id;
          if (layoutCollectionIdsSet.has(packageId) || layoutCollectionIdsSet.has(collection.id)) {
            return false;
          }
        }
        // filteredCollectionsに含まれているコレクション、またはイベントやNFTがあるコレクションのみ
        if (!collection) {
          return false;
        }
        const inFiltered = filteredCollections.some(col => col.id === id);
        const hasEvents = (eventsByCollection.get(id)?.length ?? 0) > 0;
        const hasNFTs = (nftsByCollection.get(id)?.length ?? 0) > 0;
        return inFiltered || hasEvents || hasNFTs;
      })
      .map(id => collectionMap.get(id))
      .filter((col): col is CollectionConfig => Boolean(col));
    
    if (remaining.length > 0) {
      const eventCollections = remaining.filter(col => (eventsByCollection.get(col.id)?.length ?? 0) > 0);

      if (eventCollections.length > 0) {
        addGroup('auto_events', 'Event NFTs', undefined, eventCollections.map(col => col.id));
      }
    }

    return groups;
  }, [
    filteredCollections,
    filteredEvents,
    eventNFTs,
    allOwnedNFTs,
    normalizedCollectionLayouts,
    normalizedCollectionNames,
    customNFTTypesSet,
    rawCollections
  ]);

  return {
    // ウォレット
    account,
    connected,
    
    // タブ管理
    activeTab,
    setActiveTab,
    
    // コレクション管理
    expandedCollections,
    setExpandedCollections,
    
    // NFT管理
    selectedNFT,
    setSelectedNFT,
    isDrawerOpen,
    setIsDrawerOpen,
    
    // ソート・検索
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    searchQuery,
    setSearchQuery,
    
    // レスポンシブ
    deviceType,
    
    // データ
    collections: filteredCollections,
    events: filteredEvents,
    allOwnedNFTs,
    eventNFTs,
    nonEventNFTs,
    ownedTabNFTs,
    onchainCounts,
    displaySettings: {
      ...safeDisplaySettings,
      enabledCollections: normalizedEnabledCollections,
      collectionDisplayNames: normalizedCollectionNames,
      collectionLayouts: normalizedCollectionLayouts
    },
    hasSelectionFilters,
    hasDisplaySettings,
    includeKiosk,
    collectionLayoutGroups,
    eventNFTGroups,
    collectionLayouts: normalizedCollectionLayouts,
    collectionDisplayNames: normalizedCollectionNames,
    
    // 状態
    loading,
    hasCriticalErrors,
    collectionsLoading,
    eventsLoading,
    nftLoading
  };
}
