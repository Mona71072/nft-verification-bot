import React, { useState, useMemo } from 'react';
import { EmptyNFTs } from '../../components/empty-states/EmptyNFTs';
import { GridSkeleton } from '../../components/skeletons/GridSkeleton';
import { getResponsiveValue } from '../../hooks/useResponsive';
import { RotateIcon } from '../../components/motion/Accordion';

interface OwnedNFT {
  objectId: string;
  type: string;
  display?: {
    name?: string;
    description?: string;
    image_url?: string;
    event_date?: string;
  };
  owner?: any;
}

interface Collection { id: string; name: string; packageId?: string; typePath?: string }

interface Props {
  nftLoading: boolean;
  nonEventNFTs: OwnedNFT[];
  collections: Collection[];
  deviceType: 'mobile' | 'tablet' | 'desktop';
  setSelectedNFT: (nft: OwnedNFT | null) => void;
  setIsDrawerOpen: (open: boolean) => void;
  convertIpfsUrl: (url: string | undefined) => string | undefined;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: 'name' | 'collection' | 'date';
  setSortBy: (sort: 'name' | 'collection' | 'date') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (order: 'asc' | 'desc') => void;
}

export const OwnedNFTsSection: React.FC<Props> = ({
  nftLoading,
  nonEventNFTs,
  collections,
  deviceType,
  setSelectedNFT,
  setIsDrawerOpen,
  convertIpfsUrl,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
}) => {
  const [expandedNFTs, setExpandedNFTs] = useState<Set<string>>(new Set());
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('');
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('');

  // 月選択オプションの生成（NFTのevent_dateから）
  const monthOptions = useMemo(() => {
    const uniqueMonths = new Set<string>();
    nonEventNFTs.forEach(nft => {
      const eventDate = nft.display?.event_date;
      if (eventDate) {
        try {
          const date = new Date(eventDate);
          if (!isNaN(date.getTime())) {
            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            uniqueMonths.add(yearMonth);
          }
        } catch (e) {
          // 日付のパースに失敗した場合はスキップ
        }
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
  }, [nonEventNFTs]);

  // フィルタリングとソート
  const filteredAndSortedNFTs = useMemo(() => {
    let filtered = [...nonEventNFTs];

    // 日付フィルタリング（Dateソート選択時）
    if (sortBy === 'date' && (selectedDateFilter || selectedMonthFilter)) {
      filtered = filtered.filter(nft => {
        const eventDate = nft.display?.event_date;
        if (!eventDate) return false;
        
        try {
          const eventDateObj = new Date(eventDate);
          if (isNaN(eventDateObj.getTime())) return false;
          
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
        } catch (e) {
          return false;
        }
        
        return true;
      });
    }

    // 検索フィルタリング（sortByの選択に応じて検索対象を変更）
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(nft => {
        switch (sortBy) {
          case 'name':
            // 名前だけで検索
            const name = nft.display?.name?.toLowerCase() || '';
            return name.includes(query);
          case 'collection':
            // コレクション名だけで検索
            const collection = collections.find(c => c.id === nft.type);
            const collectionName = collection?.name?.toLowerCase() || '';
            return collectionName.includes(query);
          case 'date':
            // Dateソート選択時は日付フィルターが優先されるが、検索クエリも使用可能
            // 日付文字列に含まれるか確認
            const eventDate = nft.display?.event_date?.toLowerCase() || '';
            return eventDate.includes(query);
          default:
            // デフォルトは名前、説明、コレクション名で検索
            const defaultName = nft.display?.name?.toLowerCase() || '';
            const defaultDescription = nft.display?.description?.toLowerCase() || '';
            const defaultCollection = collections.find(c => c.id === nft.type);
            const defaultCollectionName = defaultCollection?.name?.toLowerCase() || '';
            return defaultName.includes(query) || defaultDescription.includes(query) || defaultCollectionName.includes(query);
        }
      });
    }

    // ソート
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          const nameA = a.display?.name || 'Unnamed NFT';
          const nameB = b.display?.name || 'Unnamed NFT';
          comparison = nameA.localeCompare(nameB);
          break;
        case 'collection':
          const collectionA = collections.find(c => c.id === a.type)?.name || '';
          const collectionB = collections.find(c => c.id === b.type)?.name || '';
          comparison = collectionA.localeCompare(collectionB);
          break;
        case 'date':
          // 日付でソート（日付文字列をパースして比較）
          const dateA = a.display?.event_date || '';
          const dateB = b.display?.event_date || '';
          
          // 日付文字列をDateオブジェクトに変換して比較
          if (dateA && dateB) {
            const parsedDateA = new Date(dateA).getTime();
            const parsedDateB = new Date(dateB).getTime();
            
            // 無効な日付の場合は文字列比較にフォールバック
            if (!isNaN(parsedDateA) && !isNaN(parsedDateB)) {
              comparison = parsedDateA - parsedDateB;
            } else {
              comparison = dateA.localeCompare(dateB);
            }
          } else if (dateA && !dateB) {
            comparison = -1; // dateAがある場合は前に
          } else if (!dateA && dateB) {
            comparison = 1; // dateBがある場合は後ろに
          } else {
            comparison = 0; // 両方ない場合は等しい
          }
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [nonEventNFTs, searchQuery, sortBy, sortOrder, collections, selectedDateFilter, selectedMonthFilter]);

  if (nftLoading) {
    return <GridSkeleton count={6} columns={{ mobile: 1, tablet: 2, desktop: 3 }} />;
  }

  if (nonEventNFTs.length === 0) {
    return (
      <EmptyNFTs
        title="No NFTs Found"
        description="You don't own any SXT NFTs yet"
        ctaLabel="Mint NFTs"
        ctaHref="https://www.tradeport.xyz/sui/collection/0x182ebe08d5895467a750dcad6d5acedb3c1f02f8048df8d3bf369bc24f43e911?tab=mint&bottomTab=trades&mintTokenId=e944ed92-4cfe-4dbd-a824-b7199ee0b1d7"
      />
    );
  }

  // SUI ScanのURLを生成する関数
  const getSuiScanUrl = (objectId: string) => {
    return `https://suiscan.xyz/mainnet/object/${objectId}`;
  };

  const handleCardClick = (nft: OwnedNFT) => {
    setSelectedNFT(nft);
    setIsDrawerOpen(true);
  };

  const handleExternalLinkClick = (e: React.MouseEvent, url: string) => {
    e.stopPropagation();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div>
      {/* 検索・ソートUI */}
      <div style={{
        display: 'flex',
        flexDirection: getResponsiveValue('column', 'row', 'row', deviceType),
        gap: getResponsiveValue('0.75rem', '1rem', '1rem', deviceType),
        marginBottom: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
        alignItems: getResponsiveValue('stretch', 'center', 'center', deviceType)
      }}>
        {/* 検索入力（クリアボタン付き） */}
        <div style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center'
        }}>
          <input
            type="text"
            placeholder={
              sortBy === 'name' 
                ? 'Search by name...' 
                : sortBy === 'collection' 
                ? 'Search by collection...' 
                : sortBy === 'date'
                ? 'Search by date...'
                : 'Search NFTs...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: getResponsiveValue('0.5rem 0.75rem', '0.625rem 0.875rem', '0.75rem 1rem', deviceType),
              paddingRight: searchQuery ? getResponsiveValue('2.5rem', '2.75rem', '3rem', deviceType) : getResponsiveValue('0.5rem 0.75rem', '0.625rem 0.875rem', '0.75rem 1rem', deviceType),
              background: 'rgba(30, 27, 75, 0.6)',
              border: '1px solid rgba(79, 70, 229, 0.3)',
              borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
              color: '#e0e7ff',
              fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType),
              outline: 'none',
              transition: 'border-color 0.2s ease'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.3)';
            }}
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              type="button"
              style={{
                position: 'absolute',
                right: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType),
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: getResponsiveValue('20px', '22px', '24px', deviceType),
                height: getResponsiveValue('20px', '22px', '24px', deviceType),
                borderRadius: '50%',
                color: '#a5b4fc',
                transition: 'all 0.2s ease',
                padding: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.3)';
                e.currentTarget.style.color = '#e0e7ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#a5b4fc';
              }}
              title="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* ソート選択 */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'center'
        }}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'collection' | 'date')}
            style={{
              padding: getResponsiveValue('0.5rem 0.75rem', '0.625rem 0.875rem', '0.75rem 1rem', deviceType),
              background: 'rgba(30, 27, 75, 0.6)',
              border: '1px solid rgba(79, 70, 229, 0.3)',
              borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
              color: '#e0e7ff',
              fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType),
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="name">Name</option>
            <option value="collection">Collection</option>
            <option value="date">Date</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            style={{
              padding: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType),
              background: 'rgba(139, 92, 246, 0.3)',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
              color: '#c7d2fe',
              fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType),
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: getResponsiveValue('36px', '40px', '44px', deviceType),
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(139, 92, 246, 0.3)';
            }}
            title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* 日付フィルター（Dateソート選択時のみ表示） */}
      {sortBy === 'date' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: getResponsiveValue('1fr', 'repeat(2, minmax(0, 1fr))', 'repeat(2, minmax(0, 1fr))', deviceType),
          gap: getResponsiveValue('0.75rem', '1rem', '1rem', deviceType),
          marginBottom: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
          paddingTop: getResponsiveValue('0.75rem', '1rem', '1rem', deviceType),
          borderTop: '1px solid rgba(79, 70, 229, 0.3)'
        }}>
          {/* 月選択 */}
          <div style={{ minWidth: 0 }}>
            <label style={{
              display: 'block',
              marginBottom: getResponsiveValue('0.375rem', '0.5rem', '0.5rem', deviceType),
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
              color: '#a5b4fc',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
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
                padding: getResponsiveValue('0.5rem 0.75rem', '0.625rem 0.875rem', '0.75rem 1rem', deviceType),
                borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
                border: '1px solid rgba(79, 70, 229, 0.3)',
                fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType),
                outline: 'none',
                background: 'rgba(30, 27, 75, 0.6)',
                color: '#e0e7ff',
                cursor: 'pointer'
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
              marginBottom: getResponsiveValue('0.375rem', '0.5rem', '0.5rem', deviceType),
              fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
              color: '#a5b4fc',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
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
                padding: getResponsiveValue('0.5rem 0.75rem', '0.625rem 0.875rem', '0.75rem 1rem', deviceType),
                borderRadius: getResponsiveValue('8px', '10px', '12px', deviceType),
                border: '1px solid rgba(79, 70, 229, 0.3)',
                fontSize: getResponsiveValue('0.875rem', '0.9375rem', '1rem', deviceType),
                outline: 'none',
                background: 'rgba(30, 27, 75, 0.6)',
                color: '#e0e7ff',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.6)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.3)';
              }}
            />
            {(selectedDateFilter || selectedMonthFilter) && (
              <button
                onClick={() => {
                  setSelectedDateFilter('');
                  setSelectedMonthFilter('');
                }}
                style={{
                  marginTop: getResponsiveValue('0.5rem', '0.625rem', '0.75rem', deviceType),
                  padding: getResponsiveValue('0.375rem 0.75rem', '0.5rem 1rem', '0.5rem 1rem', deviceType),
                  borderRadius: getResponsiveValue('6px', '8px', '8px', deviceType),
                  border: '1px solid rgba(79, 70, 229, 0.4)',
                  background: 'rgba(139, 92, 246, 0.3)',
                  color: '#c7d2fe',
                  fontSize: getResponsiveValue('0.75rem', '0.8125rem', '0.875rem', deviceType),
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.3)';
                }}
              >
                Clear Date Filter
              </button>
            )}
          </div>
        </div>
      )}

      {/* 検索結果が0件の場合 */}
      {filteredAndSortedNFTs.length === 0 && (searchQuery.trim() || selectedDateFilter || selectedMonthFilter) ? (
        <EmptyNFTs
          title="No NFTs Match Your Filters"
          description={
            searchQuery.trim() && (selectedDateFilter || selectedMonthFilter)
              ? `No NFTs found matching "${searchQuery}" and the selected date filter`
              : searchQuery.trim()
              ? `No NFTs found matching "${searchQuery}"`
              : selectedDateFilter || selectedMonthFilter
              ? 'No NFTs found for the selected date'
              : 'No NFTs found'
          }
        />
      ) : filteredAndSortedNFTs.length === 0 ? null : (
        /* NFTグリッド */
        <div style={{
          display: 'grid',
          gridTemplateColumns: getResponsiveValue('1fr', 'repeat(auto-fill, minmax(250px, 300px))', 'repeat(auto-fill, minmax(280px, 320px))', deviceType),
          gap: getResponsiveValue('1rem', '1.25rem', '1.5rem', deviceType),
          maxWidth: '100%'
        }}>
          {filteredAndSortedNFTs.map((nft) => {
        const collection = collections.find(c => c.id === nft.type);
        const isKioskOwned = Boolean(
          nft.owner?.parent?.address ||
          (typeof nft.owner?.parent === 'object' && nft.owner?.parent?.address) ||
          nft.owner?.ObjectOwner
        );
        return (
          <div
            key={nft.objectId}
            style={{
              border: '1px solid rgba(79, 70, 229, 0.3)',
              borderRadius: getResponsiveValue('10px', '12px', '12px', deviceType),
              overflow: 'hidden',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              background: 'rgba(30, 27, 75, 0.6)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              maxWidth: '100%',
              width: '100%'
            }}
            onClick={() => handleCardClick(nft)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.08)';
            }}
          >
              <div style={{
                width: '100%',
                aspectRatio: '1 / 1',
                background: 'rgba(30, 27, 75, 0.5)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {nft.display?.image_url && !imageErrors.has(nft.objectId) ? (
                  <img
                    src={convertIpfsUrl(nft.display?.image_url)}
                    alt={nft.display?.name || 'NFT'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block'
                    }}
                    onError={() => {
                      setImageErrors(prev => new Set(prev).add(nft.objectId));
                    }}
                  />
                ) : (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                )}
              </div>
              <div style={{ 
                padding: getResponsiveValue('0.75rem', '1rem', '1rem', deviceType),
                flex: 1,
                display: 'flex',
                flexDirection: 'column'
              }}>
                <h3 style={{
                  fontSize: getResponsiveValue('0.875rem', '1rem', '1rem', deviceType),
                  fontWeight: 'bold',
                  color: '#e0e7ff',
                  marginBottom: '0.5rem'
                }}>
                  {nft.display?.name || 'Unnamed NFT'}
                </h3>
                {nft.display?.description && (() => {
                  const description = nft.display.description;
                  const maxLength = getResponsiveValue(60, 80, 100, deviceType);
                  const isLong = description.length > maxLength;
                  const isExpanded = expandedNFTs.has(nft.objectId);
                  const showDescription = isLong ? (isExpanded ? description : description.slice(0, maxLength) + '...') : description;
                  
                  return (
                    <div style={{ marginBottom: isLong ? '0.5rem' : '0.75rem' }}>
                      <p style={{
                        fontSize: getResponsiveValue('0.8rem', '0.875rem', '0.875rem', deviceType),
                        color: '#c7d2fe',
                        marginBottom: isLong ? '0.5rem' : '0',
                        lineHeight: '1.5'
                      }}>
                        {showDescription}
                      </p>
                      {isLong && (
                        <>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const newExpanded = new Set(expandedNFTs);
                              if (isExpanded) {
                                newExpanded.delete(nft.objectId);
                              } else {
                                newExpanded.add(nft.objectId);
                              }
                              setExpandedNFTs(newExpanded);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: getResponsiveValue('0.25rem', '0.375rem', '0.375rem', deviceType),
                              padding: getResponsiveValue('0.375rem 0.625rem', '0.5rem 0.75rem', '0.5rem 0.75rem', deviceType),
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#a5b4fc',
                              fontSize: getResponsiveValue('0.625rem', '0.6875rem', '0.6875rem', deviceType),
                              fontWeight: '600',
                              transition: 'color 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#c7d2fe';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = '#a5b4fc';
                            }}
                          >
                            <span>{isExpanded ? 'Show Less' : 'Show More'}</span>
                            <RotateIcon isOpen={isExpanded} />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })()}
                <div style={{ marginTop: 'auto' }}>
                  {collection && (
                    <div style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      background: 'rgba(139, 92, 246, 0.3)',
                      color: '#c7d2fe',
                      marginBottom: '0.5rem',
                      marginRight: isKioskOwned ? '0.5rem' : 0
                    }}>
                      {collection.name}
                    </div>
                  )}
                  {isKioskOwned && (
                    <div style={{
                      display: 'inline-block',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.7rem',
                      fontWeight: '600',
                      background: 'rgba(16, 185, 129, 0.3)',
                      color: '#6ee7b7',
                      marginBottom: '0.5rem'
                    }}>
                      Kiosk
                    </div>
                  )}
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#a5b4fc',
                    wordBreak: 'break-all',
                    marginBottom: '0.5rem'
                  }}>
                    ID: {nft.objectId.slice(0, 8)}...{nft.objectId.slice(-6)}
                  </div>
                  <button
                    onClick={(e) => handleExternalLinkClick(e, getSuiScanUrl(nft.objectId))}
                    style={{
                      fontSize: '0.75rem',
                      color: '#667eea',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      textAlign: 'left',
                      transition: 'color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#818cf8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#667eea';
                    }}
                  >
                    View on SuiScan
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
};

export default OwnedNFTsSection;

