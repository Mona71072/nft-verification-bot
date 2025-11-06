import React from 'react';
import { getResponsiveValue } from '../../hooks/useResponsive';
import { walrusUrlFromCid } from '../../utils/walrus';
import { Accordion, RotateIcon } from '../../components/motion/Accordion';

interface Collection { id: string; name: string; packageId?: string; typePath?: string; displayName?: string; imageUrl?: string; detailUrl?: string }
interface EventItem { id: string; name: string; description?: string; startAt?: string; endAt?: string; eventDate?: string; mintedCount?: number; collectionId?: string; detailUrl?: string; imageCid?: string; imageMimeType?: string }
interface OwnedNFT { objectId: string; type: string; display?: { name?: string; description?: string; image_url?: string; event_date?: string }; owner?: any }

interface Props {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  sortBy: 'eventName' | 'eventDate' | 'collection';
  setSortBy: (s: 'eventName' | 'eventDate' | 'collection') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (s: 'asc' | 'desc') => void;
  collections: Collection[];
  events: EventItem[];
  onchainCounts: Map<string, number>;
  expandedCollections: Set<string>;
  setExpandedCollections: (set: Set<string>) => void;
  allOwnedNFTs: OwnedNFT[];
  convertIpfsUrl: (url: string | undefined) => string | undefined;
  showSearchAndSort?: boolean; // 検索・ソートUIを表示するかどうか（デフォルト: true）
}


export const CollectionsSection: React.FC<Props> = ({
  deviceType,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  collections,
  events,
  // onchainCounts,
  // expandedCollections,
  // setExpandedCollections,
  allOwnedNFTs,
  convertIpfsUrl,
  showSearchAndSort = true, // デフォルトはtrue（後方互換性のため）
}) => {
  // ステータス別タブの状態管理
  const [activeStatusTab, setActiveStatusTab] = React.useState<'all' | 'active' | 'upcoming' | 'past'>('all');
  
  // コレクション名フィルターの状態管理
  const [selectedCollectionFilter, setSelectedCollectionFilter] = React.useState<string>('');
  
  // 日付フィルターの状態管理
  const [selectedDateFilter, setSelectedDateFilter] = React.useState<string>('');
  const [selectedMonthFilter, setSelectedMonthFilter] = React.useState<string>('');
  
  // 折りたたみ状態の管理
  const [isFiltersExpanded, setIsFiltersExpanded] = React.useState<boolean>(false);
  
  // イベントカードの展開状態管理
  const [expandedEventCards, setExpandedEventCards] = React.useState<Set<string>>(new Set());

  // 検索結果なしメッセージの生成
  const getNoResultsMessage = () => {
    const hasSearchQuery = searchQuery.trim() !== '';
    const hasEvents = events.length > 0;
    
    if (hasSearchQuery) {
      return `No ${hasEvents ? 'events or collections' : 'collections'} found matching "${searchQuery}"`;
    } else {
      return hasEvents ? 'No events found' : 'No collections found';
    }
  };

  // すべてのフィルターをクリア
  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedDateFilter('');
    setSelectedMonthFilter('');
    setSelectedCollectionFilter('');
  };
  
  // アクティブフィルターの有無を判定
  const hasActiveFilters = React.useMemo(() => {
    return searchQuery.trim() !== '' ||
           selectedCollectionFilter !== '' ||
           selectedDateFilter !== '' ||
           selectedMonthFilter !== '';
  }, [searchQuery, selectedCollectionFilter, selectedDateFilter, selectedMonthFilter]);
  
  // アクティブフィルターがある場合は自動的に展開
  React.useEffect(() => {
    if (hasActiveFilters && !isFiltersExpanded) {
      setIsFiltersExpanded(true);
    }
  }, [hasActiveFilters, isFiltersExpanded]);
  
  // 月選択用のオプションを生成（useMemoをトップレベルで使用）
  const monthOptions = React.useMemo(() => {
    const uniqueMonths = new Set<string>();
    events.forEach(event => {
      const eventDate = event.eventDate || event.startAt;
      if (eventDate) {
        const date = new Date(eventDate);
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        uniqueMonths.add(yearMonth);
      }
    });
    return Array.from(uniqueMonths).sort().reverse().map(yearMonth => {
      const [year, month] = yearMonth.split('-').map(Number);
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      return (
        <option key={yearMonth} value={yearMonth}>
          {monthNames[month - 1]} {year}
        </option>
      );
    });
  }, [events]);

  // NFT画像のURLを生成する関数（Walrusストレージを使用）
  const getEventImageUrl = (event: EventItem) => {
    if (event.imageCid) {
      return walrusUrlFromCid(event.imageCid);
    }
    return null;
  };

  // イベントのステータスを判定する関数
  const getEventStatus = (event: EventItem) => {
    // ステータス判定にはミント期間（startAt/endAt）を使用
    const mintStartDate = event.startAt;
    const mintEndDate = event.endAt;
    const now = new Date();
    
    if (!mintStartDate) return 'unknown';
    
    const startDateObj = new Date(mintStartDate);
    if (startDateObj > now) {
      return 'upcoming';
    } else {
      if (mintEndDate) {
        const endDateObj = new Date(mintEndDate);
        return endDateObj >= now ? 'active' : 'past';
      } else {
        const endDateObj = new Date(startDateObj.getTime() + 24 * 60 * 60 * 1000);
        return endDateObj >= now ? 'active' : 'past';
      }
    }
  };

  // collectionsが空でも、eventsまたはallOwnedNFTsがあれば処理を続行
  if (collections.length === 0 && events.length === 0 && (!allOwnedNFTs || allOwnedNFTs.length === 0)) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#94a3b8' }}>
        No collections available yet
      </div>
    );
  }

  // イベントが存在するかどうかで処理を分岐
  const processedCollections = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    
    // collectionsが空でも、allOwnedNFTsから仮想的なコレクションエントリを作成
    if (collections.length === 0 && allOwnedNFTs && allOwnedNFTs.length > 0) {
      // allOwnedNFTsからユニークなタイプを取得
      const uniqueTypes = new Set(allOwnedNFTs.map(nft => nft.type).filter(Boolean));
      const virtualCollections: Collection[] = Array.from(uniqueTypes).map(type => ({
        id: type,
        name: type.split('::').pop() || type,
        packageId: type,
        displayName: type.split('::').pop() || type,
        imageUrl: undefined,
        detailUrl: undefined
      }));
      
      const filteredCols = virtualCollections.filter(collection => {
        if (!query) return true;
        return collection.name.toLowerCase().includes(query) ||
               collection.displayName?.toLowerCase().includes(query);
      });
      
      return filteredCols.map(collection => ({
        collection,
        event: null as EventItem | null,
        collectionTypePath: (collection as any).typePath || collection.packageId
      }));
    }
    
    // イベントがない場合: コレクションを直接処理
    if (events.length === 0) {
      const filteredCols = collections.filter(collection => {
        if (!query) return true;
        return collection.name.toLowerCase().includes(query) ||
               collection.displayName?.toLowerCase().includes(query);
      });
      
      return filteredCols.map(collection => ({
        collection,
        event: null as EventItem | null,
        collectionTypePath: (collection as any).typePath || collection.packageId || ''
      }));
    }
    
    // コレクション名フィルターが適用されている場合の処理
    let collectionFilterIds: string[] = [];
    if (sortBy === 'collection' && selectedCollectionFilter) {
      const selectedCollection = collections.find(c => {
        const collectionTypePath = (c as any).typePath || c.packageId;
        const collectionId = c.id || collectionTypePath;
        return collectionId === selectedCollectionFilter || 
               collectionTypePath === selectedCollectionFilter ||
               c.packageId === selectedCollectionFilter;
      });
      if (selectedCollection) {
        const collectionTypePath = (selectedCollection as any).typePath || selectedCollection.packageId;
        collectionFilterIds = [
          selectedCollection.id,
          collectionTypePath,
          selectedCollection.packageId,
          (selectedCollection as any).originalId,
          (selectedCollection as any).roleId
        ].filter(Boolean) as string[];
      }
    }
    
    // 日付フィルターが適用されている場合の処理
    const shouldFilterByDate = selectedDateFilter || selectedMonthFilter;
    const filterByDate = (event: EventItem) => {
      if (!shouldFilterByDate) return true;
      
      const eventDate = event.eventDate || event.startAt;
      if (!eventDate) return false;
      
      const eventDateObj = new Date(eventDate);
      
      // 特定の日付でフィルター
      if (selectedDateFilter) {
        const filterDate = new Date(selectedDateFilter);
        return eventDateObj.toDateString() === filterDate.toDateString();
      }
      
      // 月でフィルター
      if (selectedMonthFilter) {
        const [year, month] = selectedMonthFilter.split('-').map(Number);
        return eventDateObj.getFullYear() === year && eventDateObj.getMonth() === month - 1;
      }
      
      return true;
    };
    
    // イベントがある場合: イベントからコレクションを取得 + イベントに関連付けられていないコレクションも追加
    const filteredEvents = events.filter(event => {
      // コレクション名フィルターが適用されている場合
      if (sortBy === 'collection' && selectedCollectionFilter && collectionFilterIds.length > 0) {
        const eventCollectionId = event.collectionId;
        const matchesCollectionFilter = collectionFilterIds.some(id => 
          id === eventCollectionId ||
          (eventCollectionId && id && eventCollectionId.includes(id)) ||
          (eventCollectionId && id && id.includes(eventCollectionId))
        );
        if (!matchesCollectionFilter) return false;
      }
      
      // 日付フィルターが適用されている場合
      if (!filterByDate(event)) return false;
      
      if (!searchQuery.trim()) return true;
      
      // 検索は常にイベント名、説明、コレクション名のすべてを対象とする
      const matchesEventName = event.name.toLowerCase().includes(query);
      const matchesDescription = event.description?.toLowerCase().includes(query) || false;
      
      // コレクション名も検索対象に含める
      const collection = collections.find(c => {
        const collectionTypePath = (c as any).typePath || c.packageId;
        return collectionTypePath === event.collectionId;
      });
      const matchesCollection = collection && (
        collection.name.toLowerCase().includes(query) ||
        collection.displayName?.toLowerCase().includes(query) ||
        false
      );
      
      return matchesEventName || matchesDescription || matchesCollection;
    });

    // イベントからコレクション情報を取得
    const eventCollections = new Set<string>();
    const result: Array<{ collection: Collection; event: EventItem | null; collectionTypePath: string }> = filteredEvents
      .map(event => {
        // 複数の方法でコレクションをマッチング
        let collection = collections.find(c => {
          const collectionTypePath = (c as any).typePath || c.packageId;
          return collectionTypePath === event.collectionId;
        });
        
        // 直接一致しない場合、追加のマッチングを試行
        if (!collection) {
          collection = collections.find(c => 
            c.id === event.collectionId ||
            c.packageId === event.collectionId ||
            (c as any).originalId === event.collectionId ||
            (c as any).roleId === event.collectionId ||
            (event.collectionId && c.packageId && event.collectionId.includes(c.packageId)) ||
            (event.collectionId && c.packageId && c.packageId.includes(event.collectionId))
          );
        }
        
        if (collection) {
          eventCollections.add(collection.id);
        }
        
        return {
          collection: collection || { 
            id: 'unknown', 
            name: 'Unknown Collection', 
            packageId: event.collectionId || '',
            displayName: 'Unknown Collection',
            imageUrl: undefined,
            detailUrl: undefined
          } as Collection,
          event,
          collectionTypePath: event.collectionId || ''
        };
      })
      .filter(({ collection }) => collection && collection.id !== 'unknown');
    
    // イベントに関連付けられていないコレクションも追加（NFT表示のため）
    const filteredCols = collections.filter(collection => {
      // イベントに関連付けられているコレクションはスキップ
      if (eventCollections.has(collection.id)) {
        return false;
      }
      
      // コレクション名フィルターが適用されている場合
      if (sortBy === 'collection' && selectedCollectionFilter && collectionFilterIds.length > 0) {
        const collectionTypePath = (collection as any).typePath || collection.packageId;
        const collectionId = collection.id || collectionTypePath;
        const matchesCollectionFilter = collectionFilterIds.some(id => 
          id === collectionId ||
          id === collectionTypePath ||
          id === collection.packageId ||
          id === (collection as any).originalId ||
          id === (collection as any).roleId ||
          (collectionTypePath && id && collectionTypePath.includes(id)) ||
          (collectionTypePath && id && id.includes(collectionTypePath))
        );
        if (!matchesCollectionFilter) return false;
      }
      
      // 検索クエリでフィルタリング
      if (!query) return true;
      return collection.name.toLowerCase().includes(query) ||
             collection.displayName?.toLowerCase().includes(query);
    });
    
    // コレクションのみのエントリを追加
    filteredCols.forEach(collection => {
      result.push({
        collection,
        event: null as EventItem | null,
        collectionTypePath: (collection as any).typePath || collection.packageId || ''
      });
    });
    
    return result;
  }, [events, collections, searchQuery, sortBy, selectedCollectionFilter, selectedDateFilter, selectedMonthFilter, allOwnedNFTs]);

  const filteredCollections = processedCollections;

  if (filteredCollections.length === 0) {
    return (
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {/* 検索・ソート機能 */}
        {showSearchAndSort && (
        <div style={{
          background: 'rgba(30, 27, 75, 0.5)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(79, 70, 229, 0.3)',
          padding: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
          borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
          marginBottom: '1rem'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: getResponsiveValue(
              '1fr', 
              '1fr 1fr', 
              sortBy === 'collection' ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr', 
              deviceType
            ),
            gap: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
            alignItems: 'end'
          }}>
            {/* 検索ボックス */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.75rem',
                color: '#a5b4fc',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by event name, description, or collection name..."
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(79, 70, 229, 0.4)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  background: 'rgba(30, 27, 75, 0.6)',
                  color: '#e0e7ff'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* ソート選択 */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.75rem',
                color: '#a5b4fc',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as any);
                  // Collection Name以外を選択した場合は、コレクションフィルターをクリア
                  if (e.target.value !== 'collection') {
                    setSelectedCollectionFilter('');
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(79, 70, 229, 0.4)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  background: 'rgba(30, 27, 75, 0.6)',
                  color: '#e0e7ff'
                }}
              >
                {events.length > 0 && <option value="eventName">Event Name</option>}
                {events.length > 0 && <option value="eventDate">Event Date</option>}
                <option value="collection">Collection Name</option>
              </select>
            </div>
            
            {/* コレクション選択（Collection Nameソート時のみ表示） */}
            {sortBy === 'collection' && collections.length > 0 && (
              <div>
                <label style={{
                  display: 'block',
                  marginBottom: '0.5rem',
                  fontSize: '0.75rem',
                  color: '#a5b4fc',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Collection
                </label>
                <select
                  value={selectedCollectionFilter}
                  onChange={(e) => setSelectedCollectionFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.625rem 0.875rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(79, 70, 229, 0.4)',
                    fontSize: '0.875rem',
                    outline: 'none',
                    background: 'rgba(30, 27, 75, 0.6)',
                  color: '#e0e7ff'
                  }}
                >
                  <option value="">All Collections</option>
                  {collections.map(collection => {
                    const collectionTypePath = (collection as any).typePath || collection.packageId;
                    const collectionId = collection.id || collectionTypePath;
                    const displayName = collection.displayName || collection.name;
                    return (
                      <option key={collectionId} value={collectionId}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* ソート順 */}
            <div>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                fontSize: '0.75rem',
                color: '#a5b4fc',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Order
              </label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as any)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(79, 70, 229, 0.4)',
                  fontSize: '0.875rem',
                  outline: 'none',
                  background: 'rgba(30, 27, 75, 0.6)',
                  color: '#e0e7ff'
                }}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
        </div>
        )}
        
        {/* 適用中のフィルター状態表示 */}
        {(searchQuery.trim() !== '' || selectedDateFilter || selectedMonthFilter || selectedCollectionFilter) && (
          <div style={{
            background: 'rgba(102, 126, 234, 0.2)',
            border: '1px solid rgba(79, 70, 229, 0.3)',
            borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
            padding: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType),
            marginBottom: '1rem'
          }}>
            <div style={{
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#0369a1',
              marginBottom: '0.5rem'
            }}>
              Active Filters
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              {searchQuery.trim() !== '' && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.5rem',
                  background: '#dbeafe',
                  color: '#1e40af',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '500'
                }}>
                  <span>Search:</span>
                  <span>"{searchQuery}"</span>
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#1e40af',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      padding: '0',
                      marginLeft: '0.25rem'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              {selectedDateFilter && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.5rem',
                  background: '#dbeafe',
                  color: '#1e40af',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '500'
                }}>
                  <span>Date:</span>
                  <span>{new Date(selectedDateFilter).toLocaleDateString('en-US')}</span>
                  <button
                    onClick={() => setSelectedDateFilter('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#1e40af',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      padding: '0',
                      marginLeft: '0.25rem'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              {selectedMonthFilter && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.5rem',
                  background: '#dbeafe',
                  color: '#1e40af',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '500'
                }}>
                  <span>Month:</span>
                  <span>{new Date(selectedMonthFilter + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                  <button
                    onClick={() => setSelectedMonthFilter('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#1e40af',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      padding: '0',
                      marginLeft: '0.25rem'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              {selectedCollectionFilter && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.25rem 0.5rem',
                  background: '#dbeafe',
                  color: '#1e40af',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '500'
                }}>
                  <span>Collection:</span>
                  <span>{collections.find(c => {
                    const collectionTypePath = (c as any).typePath || c.packageId;
                    const collectionId = c.id || collectionTypePath;
                    return collectionId === selectedCollectionFilter;
                  })?.displayName || collections.find(c => {
                    const collectionTypePath = (c as any).typePath || c.packageId;
                    const collectionId = c.id || collectionTypePath;
                    return collectionId === selectedCollectionFilter;
                  })?.name || selectedCollectionFilter}</span>
                  <button
                    onClick={() => setSelectedCollectionFilter('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#1e40af',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      padding: '0',
                      marginLeft: '0.25rem'
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* 検索結果なしメッセージ */}
        <div style={{
          textAlign: 'center',
          padding: '3rem 1rem',
          background: 'rgba(30, 27, 75, 0.5)',
          backdropFilter: 'blur(10px)',
          borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
          border: '1px solid rgba(79, 70, 229, 0.3)',
          color: '#a5b4fc'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
          <h3 style={{
            fontSize: getResponsiveValue('1rem', '1.125rem', '1.25rem', deviceType),
            fontWeight: '600',
            color: '#e0e7ff',
            marginBottom: '0.5rem'
          }}>
            No Search Results Found
          </h3>
          <p style={{
            fontSize: '0.875rem',
            color: '#a5b4fc',
            marginBottom: '1rem'
          }}>
            {getNoResultsMessage()}
          </p>
          <button
            onClick={clearAllFilters}
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(79, 70, 229, 0.2)',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f3f4f6';
            }}
          >
            Clear All Filters
          </button>
        </div>
      </div>
    );
  }

  // イベント中心の表示に変更
  const eventItems = filteredCollections
    .filter(({ event }) => {
      // ステータス別フィルタリング
      if (activeStatusTab === 'all') return true;
      if (!event) return false;
      const eventStatus = getEventStatus(event);
      return eventStatus === activeStatusTab;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'eventName':
          if (!a.event && !b.event) {
            // 両方ともイベントがない場合はコレクション名で比較
            const nameA = a.collection.displayName || a.collection.name;
            const nameB = b.collection.displayName || b.collection.name;
            comparison = nameA.localeCompare(nameB);
          } else if (!a.event) {
            // aにイベントがない場合は後ろに
            comparison = 1;
          } else if (!b.event) {
            // bにイベントがない場合は後ろに
            comparison = -1;
          } else {
            comparison = a.event.name.localeCompare(b.event.name);
          }
          break;
        case 'eventDate': {
          // イベント開催日時を優先、なければミント開始日時
          if (!a.event && !b.event) {
            // 両方ともイベントがない場合はコレクション名で比較
            const nameA = a.collection.displayName || a.collection.name;
            const nameB = b.collection.displayName || b.collection.name;
            comparison = nameA.localeCompare(nameB);
          } else if (!a.event) {
            // aにイベントがない場合は後ろに
            comparison = 1;
          } else if (!b.event) {
            // bにイベントがない場合は後ろに
            comparison = -1;
          } else {
            const dateA = new Date(a.event.eventDate || a.event.startAt || '');
            const dateB = new Date(b.event.eventDate || b.event.startAt || '');
            comparison = dateA.getTime() - dateB.getTime();
          }
          break;
        }
        case 'collection':
          const nameA = a.collection.displayName || a.collection.name;
          const nameB = b.collection.displayName || b.collection.name;
          comparison = nameA.localeCompare(nameB);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  return (
    <div style={{ display: 'grid', gap: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType) }}>
      {/* ステータス別タブ */}
      {showSearchAndSort && (
      <div style={{
        background: 'rgba(30, 27, 75, 0.5)',
        backdropFilter: 'blur(10px)',
        borderRadius: getResponsiveValue('6px', '6px', '8px', deviceType),
        padding: getResponsiveValue('0.375rem', '0.5rem', '0.625rem', deviceType),
        border: '1px solid rgba(79, 70, 229, 0.3)',
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
        marginBottom: getResponsiveValue('0.375rem', '0.5rem', '0.625rem', deviceType)
      }}>
        <div style={{
          display: 'flex',
          gap: getResponsiveValue('0.25rem', '0.375rem', '0.5rem', deviceType),
          flexWrap: 'wrap'
        }}>
          {[
            { key: 'all', label: 'All', count: filteredCollections.length },
            { key: 'active', label: 'Active', count: filteredCollections.filter(({ event }) => event && getEventStatus(event) === 'active').length },
            { key: 'upcoming', label: 'Upcoming', count: filteredCollections.filter(({ event }) => event && getEventStatus(event) === 'upcoming').length },
            { key: 'past', label: 'Past', count: filteredCollections.filter(({ event }) => event && getEventStatus(event) === 'past').length }
          ].filter(tab => events.length > 0 || tab.key === 'all').map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveStatusTab(key as 'all' | 'active' | 'upcoming' | 'past')}
              style={{
                padding: getResponsiveValue('0.25rem 0.5rem', '0.375rem 0.625rem', '0.375rem 0.75rem', deviceType),
                borderRadius: getResponsiveValue('4px', '6px', '6px', deviceType),
                border: 'none',
                background: activeStatusTab === key ? '#667eea' : 'rgba(79, 70, 229, 0.2)',
                color: activeStatusTab === key ? 'white' : '#c7d2fe',
                fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.75rem', deviceType),
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: getResponsiveValue('0.25rem', '0.375rem', '0.375rem', deviceType)
              }}
              onMouseEnter={(e) => {
                if (activeStatusTab !== key) {
                  e.currentTarget.style.background = 'rgba(79, 70, 229, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeStatusTab !== key) {
                  e.currentTarget.style.background = 'rgba(79, 70, 229, 0.2)';
                }
              }}
            >
              {label}
              <span style={{
                padding: getResponsiveValue('0.0625rem 0.25rem', '0.125rem 0.3125rem', '0.125rem 0.3125rem', deviceType),
                borderRadius: '8px',
                fontSize: getResponsiveValue('0.5rem', '0.5625rem', '0.5625rem', deviceType),
                fontWeight: '700',
                background: activeStatusTab === key ? 'rgba(255,255,255,0.2)' : 'rgba(79, 70, 229, 0.3)',
                color: activeStatusTab === key ? 'white' : '#c7d2fe',
                lineHeight: '1.2'
              }}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>
      )}

      {/* 検索・ソート機能 */}
      {showSearchAndSort && (
      <div style={{
        background: 'rgba(30, 27, 75, 0.5)',
        backdropFilter: 'blur(10px)',
        borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
        border: '1px solid rgba(79, 70, 229, 0.3)',
        marginBottom: getResponsiveValue('0.75rem', '0.875rem', '1rem', deviceType),
        overflow: 'hidden'
      }}>
        {/* トグルボタン */}
        <button
          onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
          style={{
            width: '100%',
            padding: getResponsiveValue('0.5rem 0.75rem', '0.625rem 0.875rem', '0.625rem 1rem', deviceType),
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
            fontWeight: '600',
            color: '#e0e7ff',
            transition: 'background 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(79, 70, 229, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <span>Search & Filters</span>
          <RotateIcon isOpen={isFiltersExpanded} />
        </button>
        
        {/* 折りたたみ可能なコンテンツ */}
        <Accordion isOpen={isFiltersExpanded}>
          <div style={{
            padding: getResponsiveValue('0.5rem 0.75rem', '0.625rem 0.875rem', '0.75rem 1rem', deviceType),
            paddingTop: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType),
            borderTop: '1px solid rgba(79, 70, 229, 0.3)'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: getResponsiveValue(
                '1fr', 
                'repeat(2, minmax(0, 1fr))', 
                sortBy === 'collection' ? 'repeat(5, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', 
                deviceType
              ),
              gap: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType),
              alignItems: 'end'
            }}>
          {/* 検索ボックス */}
          <div style={{ minWidth: 0 }}>
            <label style={{
              display: 'block',
              marginBottom: getResponsiveValue('0.25rem', '0.375rem', '0.375rem', deviceType),
              fontSize: getResponsiveValue('0.5625rem', '0.625rem', '0.6875rem', deviceType),
              color: '#a5b4fc',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              Search
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={getResponsiveValue('Search...', 'Search events...', 'Search by event name, description, or collection name...', deviceType)}
              style={{
                width: '100%',
                minWidth: 0,
                padding: getResponsiveValue('0.375rem 0.5rem', '0.4375rem 0.625rem', '0.5rem 0.75rem', deviceType),
                borderRadius: '6px',
                border: '1px solid rgba(79, 70, 229, 0.4)',
                fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType),
                outline: 'none',
                transition: 'all 0.2s ease',
                background: 'rgba(30, 27, 75, 0.6)',
                color: '#e0e7ff',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(79, 70, 229, 0.4)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* ソート選択 */}
          <div style={{ minWidth: 0 }}>
            <label style={{
              display: 'block',
              marginBottom: getResponsiveValue('0.25rem', '0.375rem', '0.375rem', deviceType),
              fontSize: getResponsiveValue('0.5625rem', '0.625rem', '0.6875rem', deviceType),
              color: '#a5b4fc',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as any);
                // Collection Name以外を選択した場合は、コレクションフィルターをクリア
                if (e.target.value !== 'collection') {
                  setSelectedCollectionFilter('');
                }
              }}
              style={{
                width: '100%',
                minWidth: 0,
                padding: getResponsiveValue('0.375rem 0.5rem', '0.4375rem 0.625rem', '0.5rem 0.75rem', deviceType),
                borderRadius: '6px',
                border: '1px solid rgba(79, 70, 229, 0.4)',
                fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType),
                outline: 'none',
                background: 'rgba(30, 27, 75, 0.6)',
                color: '#e0e7ff',
                boxSizing: 'border-box',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              <option value="eventName">Event Name</option>
              <option value="eventDate">Event Date</option>
              <option value="collection">Collection Name</option>
            </select>
          </div>
          
          {/* コレクション選択（Collection Nameソート時のみ表示） */}
          {sortBy === 'collection' && collections.length > 0 && (
            <div style={{ minWidth: 0 }}>
              <label style={{
                display: 'block',
                marginBottom: getResponsiveValue('0.25rem', '0.375rem', '0.375rem', deviceType),
                fontSize: getResponsiveValue('0.5625rem', '0.625rem', '0.6875rem', deviceType),
                color: '#a5b4fc',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                Collection
              </label>
              <select
                value={selectedCollectionFilter}
                onChange={(e) => setSelectedCollectionFilter(e.target.value)}
                style={{
                  width: '100%',
                  minWidth: 0,
                  padding: getResponsiveValue('0.375rem 0.5rem', '0.4375rem 0.625rem', '0.5rem 0.75rem', deviceType),
                  borderRadius: '6px',
                  border: '1px solid rgba(79, 70, 229, 0.4)',
                  fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType),
                  outline: 'none',
                  background: 'rgba(30, 27, 75, 0.6)',
                color: '#e0e7ff',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                <option value="">All Collections</option>
                {collections.map(collection => {
                  const collectionTypePath = (collection as any).typePath || collection.packageId;
                  const collectionId = collection.id || collectionTypePath;
                  const displayName = collection.displayName || collection.name;
                  return (
                    <option key={collectionId} value={collectionId}>
                      {displayName}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* ソート順 */}
          <div style={{ minWidth: 0 }}>
            <label style={{
              display: 'block',
              marginBottom: getResponsiveValue('0.25rem', '0.375rem', '0.375rem', deviceType),
              fontSize: getResponsiveValue('0.5625rem', '0.625rem', '0.6875rem', deviceType),
              color: '#a5b4fc',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              Order
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              style={{
                width: '100%',
                minWidth: 0,
                padding: getResponsiveValue('0.375rem 0.5rem', '0.4375rem 0.625rem', '0.5rem 0.75rem', deviceType),
                borderRadius: '6px',
                border: '1px solid rgba(79, 70, 229, 0.4)',
                fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType),
                outline: 'none',
                background: 'rgba(30, 27, 75, 0.6)',
                color: '#e0e7ff',
                boxSizing: 'border-box'
              }}
            >
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
          </div>
            </div>
            
            {/* 日付フィルター（Sort ByでEvent Dateが選択されている場合のみ表示） */}
            {sortBy === 'eventDate' && events.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: getResponsiveValue('1fr', 'repeat(2, minmax(0, 1fr))', 'repeat(2, minmax(0, 1fr))', deviceType),
            gap: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType),
            marginTop: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType),
            paddingTop: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType),
            borderTop: '1px solid rgba(79, 70, 229, 0.3)',
            paddingLeft: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType),
            paddingRight: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType)
          }}>
            {/* 月選択 */}
            <div style={{ minWidth: 0 }}>
              <label style={{
                display: 'block',
                marginBottom: getResponsiveValue('0.25rem', '0.375rem', '0.375rem', deviceType),
                fontSize: getResponsiveValue('0.5625rem', '0.625rem', '0.6875rem', deviceType),
                color: '#a5b4fc',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                Filter by Month
              </label>
              <select
                value={selectedMonthFilter}
                onChange={(e) => {
                  setSelectedMonthFilter(e.target.value);
                  setSelectedDateFilter(''); // 月を選択したら日付選択をクリア
                }}
                style={{
                  width: '100%',
                  minWidth: 0,
                  padding: getResponsiveValue('0.375rem 0.5rem', '0.4375rem 0.625rem', '0.5rem 0.75rem', deviceType),
                  borderRadius: '6px',
                  border: '1px solid rgba(79, 70, 229, 0.4)',
                  fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType),
                  outline: 'none',
                  background: 'rgba(30, 27, 75, 0.6)',
                color: '#e0e7ff',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                <option value="">All Months</option>
                {monthOptions}
              </select>
            </div>
            
            {/* 日付選択 */}
            <div style={{ minWidth: 0 }}>
              <label style={{
                display: 'block',
                marginBottom: getResponsiveValue('0.25rem', '0.375rem', '0.375rem', deviceType),
                fontSize: getResponsiveValue('0.5625rem', '0.625rem', '0.6875rem', deviceType),
                color: '#a5b4fc',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                Filter by Date
              </label>
              <input
                type="date"
                value={selectedDateFilter}
                onChange={(e) => {
                  setSelectedDateFilter(e.target.value);
                  setSelectedMonthFilter(''); // 日付を選択したら月選択をクリア
                }}
                style={{
                  width: '100%',
                  minWidth: 0,
                  padding: getResponsiveValue('0.375rem 0.5rem', '0.4375rem 0.625rem', '0.5rem 0.75rem', deviceType),
                  borderRadius: '6px',
                  border: '1px solid rgba(79, 70, 229, 0.4)',
                  fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType),
                  outline: 'none',
                  background: 'rgba(30, 27, 75, 0.6)',
                color: '#e0e7ff',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db';
                  e.target.style.boxShadow = 'none';
                }}
              />
              {(selectedDateFilter || selectedMonthFilter) && (
                <button
                  onClick={() => {
                    setSelectedDateFilter('');
                    setSelectedMonthFilter('');
                  }}
                  style={{
                    marginTop: getResponsiveValue('0.375rem', '0.5rem', '0.625rem', deviceType),
                    padding: getResponsiveValue('0.25rem 0.5rem', '0.3125rem 0.625rem', '0.375rem 0.75rem', deviceType),
                    borderRadius: '4px',
                    border: '1px solid rgba(79, 70, 229, 0.4)',
                    background: 'rgba(79, 70, 229, 0.2)',
                    color: '#c7d2fe',
                    fontSize: getResponsiveValue('0.5625rem', '0.625rem', '0.6875rem', deviceType),
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#e5e7eb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#f3f4f6';
                  }}
                >
                  Clear Date Filter
                </button>
              )}
            </div>
          </div>
          )}
          </div>
        </Accordion>
      </div>
      )}
      {/* イベントカードの表示 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: getResponsiveValue('1fr', 'repeat(auto-fill, minmax(280px, 1fr))', 'repeat(auto-fill, minmax(320px, 1fr))', deviceType),
        gap: getResponsiveValue('0.75rem', '1rem', '1.25rem', deviceType)
      }}>
        {eventItems.map(({ event, collection }) => {
          // イベントがない場合はコレクションのみを表示（NFT画像付き）
          if (!event) {
            // このコレクションに関連するNFTを探す
            const collectionNFTs = allOwnedNFTs.filter(nft => {
              const collectionTypePath = (collection as any).typePath || collection.packageId || collection.id;
              return nft.type === collection.id ||
                     nft.type === collection.packageId ||
                     nft.type === collectionTypePath ||
                     (collection.packageId && nft.type?.includes(collection.packageId)) ||
                     (collection.id && nft.type?.includes(collection.id)) ||
                     (collectionTypePath && nft.type?.includes(collectionTypePath));
            });
            
            // 画像があるNFTを優先
            const nftWithImage = collectionNFTs.find(nft => nft.display?.image_url) || collectionNFTs[0];
            
            return (
              <div
                key={collection.id}
                style={{
                  background: 'rgba(30, 27, 75, 0.6)',
                color: '#e0e7ff',
                  border: '1px solid rgba(79, 70, 229, 0.3)',
                  borderRadius: getResponsiveValue('12px', '14px', '16px', deviceType),
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                }}
              >
                {/* NFT画像 */}
                {nftWithImage?.display?.image_url && (
                  <div style={{
                    width: '100%',
                    aspectRatio: '16 / 9',
                    background: 'rgba(79, 70, 229, 0.2)',
                    overflow: 'hidden'
                  }}>
                    <img
                      src={convertIpfsUrl(nftWithImage.display.image_url)}
                      alt={collection.displayName || collection.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block'
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div style={{
                  padding: getResponsiveValue('0.5rem', '0.75rem', '1rem', deviceType)
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: collectionNFTs.length > 0 ? '0.75rem' : '0'
                  }}>
                    {collection.imageUrl ? (
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        flexShrink: 0,
                        background: '#f3f4f6'
                      }}>
                        <img
                          src={convertIpfsUrl(collection.imageUrl)}
                          alt={collection.displayName || collection.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement!.style.display = 'none';
                          }}
                        />
                      </div>
                    ) : !nftWithImage?.display?.image_url && (
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        fontWeight: '700',
                        color: 'white'
                      }}>
                        {(collection.displayName || collection.name).charAt(0)}
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <h3 
                        style={{
                          fontSize: getResponsiveValue('1rem', '1.125rem', '1.25rem', deviceType),
                          fontWeight: '700',
                          color: collection.detailUrl ? '#667eea' : '#e0e7ff',
                          margin: '0',
                          cursor: collection.detailUrl ? 'pointer' : 'default',
                          textDecoration: collection.detailUrl ? 'underline' : 'none'
                        }}
                        onClick={() => {
                          if (collection.detailUrl) {
                            window.open(collection.detailUrl, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        onMouseEnter={(e) => {
                          if (collection.detailUrl) {
                            e.currentTarget.style.color = '#8b5cf6';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (collection.detailUrl) {
                            e.currentTarget.style.color = '#667eea';
                          }
                        }}
                      >
                        {collection.displayName || collection.name}
                      </h3>
                      {collectionNFTs.length > 0 && (
                        <p style={{
                          fontSize: '0.875rem',
                          color: '#a5b4fc',
                          margin: '0.25rem 0 0 0'
                        }}>
                          {collectionNFTs.length} NFT{collectionNFTs.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          
          const eventDate = event.startAt || event.eventDate;
          const eventDateObj = eventDate ? new Date(eventDate) : null;
          const now = new Date();
          
          // 正しい開催状態の判定
          let eventStatus = 'unknown';
          if (eventDateObj) {
            if (eventDateObj > now) {
              eventStatus = 'upcoming'; // 開催予定
            } else {
              // 開始日が現在時刻より前の場合
              if (event.endAt) {
                const endDateObj = new Date(event.endAt);
                if (endDateObj >= now) {
                  eventStatus = 'active'; // 開催中（終了日が現在時刻より後）
                } else {
                  eventStatus = 'past'; // 終了済み
                }
              } else {
                // 終了日がない場合は開始日から24時間後を終了日とする
                const endDateObj = new Date(eventDateObj.getTime() + 24 * 60 * 60 * 1000);
                if (endDateObj >= now) {
                  eventStatus = 'active'; // 開催中
                } else {
                  eventStatus = 'past'; // 終了済み
                }
              }
            }
          }
          
          const statusColors: Record<string, { bg: string; text: string; border: string }> = {
            active: { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
            upcoming: { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
            past: { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' },
            unknown: { bg: '#f9fafb', text: '#9ca3af', border: '#e5e7eb' }
          };
          
          const status = statusColors[eventStatus] || statusColors.unknown;
          
        return (
            <div
              key={event.id}
              style={{
                background: 'rgba(30, 27, 75, 0.6)',
                backdropFilter: 'blur(10px)',
                color: '#e0e7ff',
                border: '1px solid rgba(79, 70, 229, 0.3)',
                borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
                overflow: 'hidden',
                transition: 'all 0.3s ease',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
              }}
            >
              {/* NFT画像表示 */}
              {getEventImageUrl(event) && (
                <div style={{
                  width: '100%',
                  height: getResponsiveValue('100px', '120px', '140px', deviceType),
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <img
                    src={getEventImageUrl(event)!}
                    alt={event.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transition: 'transform 0.3s ease'
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {/* オーバーレイ */}
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.25) 100%)',
                    opacity: 0.8
                  }} />
                  {/* ステータスバッジ */}
                  <div style={{
                    position: 'absolute',
                    top: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType),
                    right: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType),
                    padding: getResponsiveValue('0.125rem 0.5rem', '0.25rem 0.625rem', '0.25rem 0.75rem', deviceType),
                    borderRadius: '12px',
                    fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.75rem', deviceType),
                    fontWeight: '600',
                    background: status.bg,
                    color: status.text,
                    border: `1px solid ${status.border}`,
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)'
                  }}>
                    {eventStatus === 'active' ? 'Active' : 
                     eventStatus === 'upcoming' ? 'Upcoming' : 
                     eventStatus === 'past' ? 'Ended' : 'Unknown'}
                  </div>
                </div>
              )}

              {/* イベントヘッダー - 基本情報のみ */}
              <div style={{
                padding: getResponsiveValue('0.5rem 0.625rem', '0.625rem 0.75rem', '0.75rem 0.875rem', deviceType),
                background: 'rgba(30, 27, 75, 0.6)',
                backdropFilter: 'blur(10px)',
                borderBottom: '1px solid rgba(79, 70, 229, 0.3)'
              }}>
                {/* イベント名 */}
                <h3 style={{
                  fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
                  fontWeight: '700',
                  color: '#e0e7ff',
                  margin: '0 0 0.375rem 0',
                  lineHeight: '1.2',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {event.name}
                </h3>
                
                {/* 日付情報 - イベント開催日時を優先表示 */}
                {(() => {
                  // イベント開催日時（eventDate）を優先、なければミント開始日時（startAt）
                  const displayDate = event.eventDate || event.startAt;
                  const displayDateObj = displayDate ? new Date(displayDate) : null;
                  
                  if (!displayDateObj) return null;
                  
                  const dateTitle = event.eventDate ? 'Event Date' : event.startAt ? 'Mint Start' : '';
                  
                  return (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: getResponsiveValue('0.125rem', '0.25rem', '0.25rem', deviceType)
                    }}>
                      <span style={{
                        fontSize: getResponsiveValue('0.5rem', '0.5625rem', '0.5625rem', deviceType),
                        fontWeight: '700',
                        color: '#a5b4fc',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        {dateTitle}
                      </span>
                      <span style={{
                        fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType),
                        fontWeight: '600',
                        color: '#e0e7ff',
                        lineHeight: '1.2'
                      }}>
                        {displayDateObj.toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          weekday: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  );
                })()}
              </div>
              
              {/* 詳細情報アコーディオン */}
              <div style={{
                borderTop: `1px solid ${status.border}`
              }}>
                <button
                  onClick={() => {
                    const newExpanded = new Set(expandedEventCards);
                    if (newExpanded.has(event.id)) {
                      newExpanded.delete(event.id);
                    } else {
                      newExpanded.add(event.id);
                    }
                    setExpandedEventCards(newExpanded);
                  }}
                  style={{
                    width: '100%',
                    padding: getResponsiveValue('0.375rem 0.625rem', '0.5rem 0.75rem', '0.5rem 0.75rem', deviceType),
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.6875rem', deviceType),
                    fontWeight: '600',
                    color: '#a5b4fc',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(79, 70, 229, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span>Details</span>
                  <RotateIcon isOpen={expandedEventCards.has(event.id)} />
                </button>
                
                <Accordion isOpen={expandedEventCards.has(event.id)}>
                  <div style={{
                    padding: getResponsiveValue('0.5rem 0.625rem', '0.625rem 0.75rem', '0.75rem 0.875rem', deviceType),
                    paddingTop: '0',
                    borderTop: '1px solid rgba(79, 70, 229, 0.3)',
                    background: 'rgba(30, 27, 75, 0.4)',
                    backdropFilter: 'blur(10px)'
                  }}>
                    {/* 説明 */}
                    {event.description && (
                      <div style={{
                        marginBottom: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType)
                      }}>
                        <span style={{
                          fontSize: getResponsiveValue('0.5rem', '0.5625rem', '0.5625rem', deviceType),
                          fontWeight: '700',
                          color: '#a5b4fc',
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em',
                          display: 'block',
                          marginBottom: getResponsiveValue('0.125rem', '0.25rem', '0.25rem', deviceType)
                        }}>
                          Description
                        </span>
                        <p style={{
                          fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType),
                          color: '#c7d2fe',
                          margin: '0',
                          lineHeight: '1.4'
                        }}>
                          {event.description}
                        </p>
                      </div>
                    )}
                    
                    {/* コレクション情報 */}
                    <div style={{
                      marginBottom: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType)
                    }}>
                      <span style={{
                        fontSize: getResponsiveValue('0.5rem', '0.5625rem', '0.5625rem', deviceType),
                        fontWeight: '700',
                        color: '#a5b4fc',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        display: 'block',
                        marginBottom: getResponsiveValue('0.125rem', '0.25rem', '0.25rem', deviceType)
                      }}>
                        Collection
                      </span>
                      <span style={{
                        fontSize: getResponsiveValue('0.6875rem', '0.75rem', '0.8125rem', deviceType),
                        fontWeight: '600',
                        color: '#e0e7ff',
                        lineHeight: '1.2'
                      }}>
                        {collection.displayName || collection.name}
                      </span>
                    </div>
                    
                    {/* Mint Count */}
                    <div>
                      <span style={{
                        fontSize: getResponsiveValue('0.5rem', '0.5625rem', '0.5625rem', deviceType),
                        fontWeight: '700',
                        color: '#a5b4fc',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        display: 'block',
                        marginBottom: getResponsiveValue('0.125rem', '0.25rem', '0.25rem', deviceType)
                      }}>
                        Mint Count
                      </span>
                      <div style={{
                        fontSize: getResponsiveValue('0.875rem', '1rem', '1.125rem', deviceType),
                        fontWeight: '700',
                        color: event.mintedCount && event.mintedCount > 0 ? '#10b981' : '#e0e7ff'
                      }}>
                        {event.mintedCount || 0}
                      </div>
                    </div>
                  </div>
                </Accordion>
              </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};

export default CollectionsSection;
