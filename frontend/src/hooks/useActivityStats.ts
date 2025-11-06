import { useMemo } from 'react';
import { useOwnedNFTs, useOnchainCounts } from './queries/useNFTs';
import { useCollections } from './queries/useCollections';
import { useEvents } from './queries/useEvents';
import { useDisplaySettings } from './useDisplaySettings';

interface ActivityData {
  date: string;
  count: number;
  label?: string;
}

interface CollectionStats {
  id: string;
  name: string;
  totalMints: number;
  ownedCount: number;
  trend: number;
}

export interface ActivityStats {
  // 時系列データ
  dailyData: ActivityData[];
  weeklyData: ActivityData[];
  monthlyData: ActivityData[];
  
  // コレクション統計
  collectionStats: CollectionStats[];
  mostActiveCollection: CollectionStats | null;
  
  // 総合統計
  totalMints: number;
  totalOwned: number;
  dailyGrowth: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
  
  // 最近のアクティビティ
  recentActivity: {
    lastMintDate: string | null;
    mintStreak: number;
    averageMintsPerWeek: number;
  };
  
  // トレンド分析
  trends: {
    isGrowing: boolean;
    growthRate: number;
    peakActivity: string;
    lowActivity: string;
  };
}

/**
 * アクティビティ統計計算用カスタムフック
 */
export function useActivityStats(
  walletAddress: string,
  collectionTypes: string[]
): ActivityStats {
  // デフォルト値を定義
  const defaultStats: ActivityStats = {
    dailyData: [],
    weeklyData: [],
    monthlyData: [],
    collectionStats: [],
    mostActiveCollection: null,
    totalMints: 0,
    totalOwned: 0,
    dailyGrowth: 0,
    weeklyGrowth: 0,
    monthlyGrowth: 0,
    recentActivity: {
      lastMintDate: null,
      mintStreak: 0,
      averageMintsPerWeek: 0
    },
    trends: {
      isGrowing: false,
      growthRate: 0,
      peakActivity: '',
      lowActivity: ''
    }
  };

  // すべてのHooksを最初に呼び出す（条件付きで呼び出すことはできない）
  // 無効なパラメータの場合は空の配列を渡す
  const isValidParams = walletAddress && collectionTypes && Array.isArray(collectionTypes) && collectionTypes.length > 0;
  
  const { data: ownedNFTs = [], error: ownedNFTsError } = useOwnedNFTs(
    isValidParams ? walletAddress : '', 
    isValidParams ? collectionTypes : []
  );
  const { data: collections = [], error: collectionsError } = useCollections();
  const { data: events = [], error: eventsError } = useEvents();
  const { data: onchainCounts = new Map(), error: onchainCountsError } = useOnchainCounts(
    isValidParams ? collectionTypes : []
  );
  const { data: displaySettings } = useDisplaySettings();

  // エラーハンドリング

  return useMemo(() => {
    // 無効なパラメータの場合はデフォルト値を返す
    if (!isValidParams) {
      return defaultStats;
    }

    // エラーがある場合でも、利用可能なデータで統計を計算

    // データの存在チェック（より緩い条件）
    const safeOwnedNFTs = ownedNFTs && Array.isArray(ownedNFTs) ? ownedNFTs : [];
    const safeCollections = collections && Array.isArray(collections) ? collections : [];
    const safeEvents = events && Array.isArray(events) ? events : [];
    const safeDisplaySettings = displaySettings &&
      Array.isArray(displaySettings.enabledCollections) &&
      Array.isArray(displaySettings.enabledEvents) &&
      Array.isArray(displaySettings.customNFTTypes)
      ? {
          ...displaySettings,
          includeKiosk: typeof displaySettings.includeKiosk === 'boolean' ? displaySettings.includeKiosk : true
        }
      : {
          enabledCollections: [],
          enabledEvents: [],
          customNFTTypes: [],
          includeKiosk: true
        };
    const includeKiosk = safeDisplaySettings.includeKiosk ?? true;
    const isKioskOwned = (owner: any): boolean => {
      if (!owner) return false;
      if (owner.ObjectOwner) return true;
      if (owner?.parent?.address) return true;
      if (owner?.parent && typeof owner.parent === 'object' && owner.parent.address) return true;
      if (owner.Parent) return true;
      return false;
    };
    
    // 表示設定に基づいてフィルタリング
    // 設定が空の場合は、デフォルト動作（イベント登録済みNFTのみ）を使用
    const hasSettings = 
      safeDisplaySettings.enabledCollections.length > 0 ||
      safeDisplaySettings.enabledEvents.length > 0 ||
      safeDisplaySettings.customNFTTypes.length > 0;
    
    let filteredNFTs: typeof safeOwnedNFTs = [];
    
    if (hasSettings) {
      // 表示設定がある場合：選択されたコレクション・イベント・独自NFTタイプに合致するNFTを表示
      const enabledCollectionSet = new Set(safeDisplaySettings.enabledCollections);
      const enabledEventSet = new Set(safeDisplaySettings.enabledEvents);
      const customNFTTypesSet = new Set(safeDisplaySettings.customNFTTypes);
      const eventNames = new Set(safeEvents.filter(e => enabledEventSet.has(e.id)).map(e => e.name));
      
      filteredNFTs = safeOwnedNFTs.filter(nft => {
        // 1. 選択されたコレクションに含まれるNFT
        if (nft.type) {
          const collectionMatch = safeCollections.some(col => {
            if (!enabledCollectionSet.has(col.id)) return false;
            // col.idはpackageIdと一致する可能性が高い（useCollectionsの処理を参照）
            // nft.typeと完全一致、または含まれる場合をチェック
            return col.id === nft.type || 
                   col.packageId === nft.type || 
                   (col.packageId && nft.type.includes(col.packageId));
          });
          if (collectionMatch) return true;
        }
        
        // 2. 選択されたイベントに登録されているNFT（イベント名とNFT名の完全一致 + 有効なevent_date）
        if (enabledEventSet.size > 0) {
          const nftName = nft.display?.name;
          const eventDate = nft.display?.event_date;
          const nameMatches = nftName && eventNames.has(nftName);
          const hasValidEventDate = eventDate && 
            eventDate !== '{eventDate}' && 
            eventDate !== 'null' && 
            !isNaN(new Date(eventDate).getTime());
          if (nameMatches && hasValidEventDate) return true;
        }
        
        if (!includeKiosk && isKioskOwned(nft.owner)) {
          return false;
        }

        // 3. 独自NFTタイプに該当するNFT
        if (nft.type && customNFTTypesSet.has(nft.type)) {
          return true;
        }
        
        return false;
      });
    } else {
      // 表示設定がない場合：デフォルト動作（イベント登録済みNFTのみ）
      const eventNames = new Set(safeEvents.map(e => e.name));
      filteredNFTs = safeOwnedNFTs.filter(nft => {
        const nftName = nft.display?.name;
        const eventDate = nft.display?.event_date;
        
        if (!includeKiosk && isKioskOwned(nft.owner)) {
          return false;
        }
        
        const nameMatches = nftName && eventNames.has(nftName);
        const hasValidEventDate = eventDate && 
          eventDate !== '{eventDate}' && 
          eventDate !== 'null' && 
          !isNaN(new Date(eventDate).getTime());
        
        return nameMatches && hasValidEventDate;
      });
    }
    

    // 日付ベースのグルーピング
    const groupByDate = (nfts: Array<{ display?: Record<string, string>; type?: string; objectId?: string }>, dateField: string = 'event_date') => {
      const groups = new Map<string, number>();
      
      if (!nfts || !Array.isArray(nfts)) {
        return groups;
      }
      
      nfts.forEach((nft) => {
        if (nft && nft.display && nft.display[dateField]) {
          try {
            const date = new Date(nft.display[dateField]);
            if (!isNaN(date.getTime())) {
              const dateKey = date.toISOString().split('T')[0];
              groups.set(dateKey, (groups.get(dateKey) || 0) + 1);
            }
          } catch (error) {
            // Invalid date handling
          }
        }
      });
      
      return groups;
    };

    // 日次データ生成（UTC日付キー直接参照でズレを回避）
    const generateDailyData = (dateGroups: Map<string, number>): ActivityData[] => {
      const now = new Date();
      const days: ActivityData[] = [];
      for (let i = 29; i >= 0; i--) {
        const day = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - i));
        const dayKey = day.toISOString().split('T')[0];
        const count = dateGroups.get(dayKey) || 0;
        days.push({
          date: dayKey,
          count,
          label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' })
        });
      }
      return days;
    };

    // 週次データ生成
    const generateWeeklyData = (dateGroups: Map<string, number>): ActivityData[] => {
      const now = new Date();
      const weeks: ActivityData[] = [];
      
      for (let i = 11; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - (i * 7 + 6));
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        let count = 0;
        for (const [date, mintCount] of dateGroups) {
          const mintDate = new Date(date);
          if (mintDate >= weekStart && mintDate <= weekEnd) {
            count += mintCount;
          }
        }
        
        weeks.push({
          date: weekStart.toISOString().split('T')[0],
          count,
          label: weekStart.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
          })
        });
      }
      
      return weeks;
    };

    // 月次データ生成
    const generateMonthlyData = (dateGroups: Map<string, number>): ActivityData[] => {
      const now = new Date();
      const months: ActivityData[] = [];
      
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
        
        let count = 0;
        for (const [date, mintCount] of dateGroups) {
          const mintDate = new Date(date);
          if (mintDate >= monthStart && mintDate <= monthEnd) {
            count += mintCount;
          }
        }
        
        months.push({
          date: monthStart.toISOString().split('T')[0],
          count,
          label: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });
      }
      
      return months;
    };

    // コレクション統計計算（個人のデータのみ）
    const calculateCollectionStats = (): CollectionStats[] => {
      return safeCollections.map(collection => {
        // イベントに登録されているNFT数のみを計算
        const eventRegisteredCount = filteredNFTs.filter(nft => 
          nft.type && nft.type.includes(collection.packageId)
        ).length;
        
        // 全保有NFT数（イベント登録に関係なく）
        const totalOwnedCount = safeOwnedNFTs.filter(nft => 
          nft.type && nft.type.includes(collection.packageId)
        ).length;
        
        // トレンドはイベント登録済みNFTの割合を表示
        const trend = totalOwnedCount > 0 ? (eventRegisteredCount / totalOwnedCount) * 100 : 0;
        
        return {
          id: collection.id,
          name: collection.name,
          totalMints: eventRegisteredCount, // イベント登録済みNFT数
          ownedCount: totalOwnedCount, // 全保有NFT数
          trend
        };
      });
    };

    // データ準備（イベントに登録されているNFTのみを使用）
    const dateGroups = groupByDate(filteredNFTs);
    const dailyData = generateDailyData(dateGroups) || [];
    const weeklyData = generateWeeklyData(dateGroups) || [];
    const monthlyData = generateMonthlyData(dateGroups) || [];
    const collectionStats = calculateCollectionStats() || [];

    // 総合統計（個人のデータのみ）
    // イベントに登録されているNFTのみをカウント
    const totalMints = filteredNFTs.length; // イベント登録済みNFT数 = ミント数
    const totalOwned = safeOwnedNFTs.length; // 全保有NFT数
    

    // 成長率計算（配列が確実に存在することを確認）
    const dailyGrowth = (dailyData && Array.isArray(dailyData) && dailyData.length >= 2)
      ? ((dailyData[dailyData.length - 1].count - dailyData[dailyData.length - 2].count) / 
         Math.max(dailyData[dailyData.length - 2].count, 1)) * 100
      : 0;

    const weeklyGrowth = (weeklyData && Array.isArray(weeklyData) && weeklyData.length >= 2)
      ? ((weeklyData[weeklyData.length - 1].count - weeklyData[weeklyData.length - 2].count) / 
         Math.max(weeklyData[weeklyData.length - 2].count, 1)) * 100
      : 0;

    const monthlyGrowth = (monthlyData && Array.isArray(monthlyData) && monthlyData.length >= 2)
      ? ((monthlyData[monthlyData.length - 1].count - monthlyData[monthlyData.length - 2].count) /
         Math.max(monthlyData[monthlyData.length - 2].count, 1)) * 100
      : 0;

    // 最もアクティブなコレクション
    const mostActiveCollection = (collectionStats && Array.isArray(collectionStats) && collectionStats.length > 0)
      ? collectionStats.reduce((max, current) => 
          current.ownedCount > max.ownedCount ? current : max, 
          collectionStats[0]
        )
      : null;

    // 最近のアクティビティ
    const sortedDates = Array.from(dateGroups.keys()).sort();
    const lastMintDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;
    
    // ミントストリーク計算（連続した週にミントがあるか）
    let mintStreak = 0;
    if (weeklyData && Array.isArray(weeklyData) && weeklyData.length > 0) {
      const recentWeeks = weeklyData.slice(-4);
      for (let i = recentWeeks.length - 1; i >= 0; i--) {
        if (recentWeeks[i].count > 0) {
          mintStreak++;
        } else {
          break;
        }
      }
    }

    const averageMintsPerWeek = (weeklyData && Array.isArray(weeklyData) && weeklyData.length > 0)
      ? weeklyData.reduce((sum, week) => sum + week.count, 0) / weeklyData.length 
      : 0;

    // トレンド分析
    const isGrowing = weeklyGrowth > 0;
    const growthRate = Math.abs(weeklyGrowth);
    
    const peakActivity = (weeklyData && Array.isArray(weeklyData) && weeklyData.length > 0)
      ? (() => {
          const peakWeek = weeklyData.reduce((max, current) => 
            current.count > max.count ? current : max, 
            weeklyData[0] || { count: 0, date: '', label: '' }
          );
          if (peakWeek.date) {
            const date = new Date(peakWeek.date);
            return date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            });
          }
          return peakWeek.label || '';
        })()
      : '';

    const lowActivity = (weeklyData && Array.isArray(weeklyData) && weeklyData.length > 0)
      ? (() => {
          const lowWeek = weeklyData.reduce((min, current) => 
            current.count < min.count ? current : min, 
            weeklyData[0] || { count: 0, date: '', label: '' }
          );
          if (lowWeek.date) {
            const date = new Date(lowWeek.date);
            return date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            });
          }
          return lowWeek.label || '';
        })()
      : '';

    return {
      dailyData,
      weeklyData,
      monthlyData,
      collectionStats,
      mostActiveCollection,
      totalMints,
      totalOwned,
      dailyGrowth,
      weeklyGrowth,
      monthlyGrowth,
      recentActivity: {
        lastMintDate,
        mintStreak,
        averageMintsPerWeek
      },
      trends: {
        isGrowing,
        growthRate,
        peakActivity,
        lowActivity
      }
    };
  }, [
    isValidParams,
    ownedNFTs, 
    collections, 
    events, 
    onchainCounts,
    displaySettings,
    ownedNFTsError, 
    collectionsError, 
    eventsError, 
    onchainCountsError,
    collectionTypes.length,
    walletAddress
  ]);
}
