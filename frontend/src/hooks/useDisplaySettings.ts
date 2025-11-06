import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DisplaySettings } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

function getAuthHeaders(): HeadersInit {
  const addr = typeof window !== 'undefined' 
    ? localStorage.getItem('currentWalletAddress') || (window as any).currentWalletAddress 
    : undefined;
  return {
    'Content-Type': 'application/json',
    ...(addr ? { 'X-Admin-Address': addr } : {})
  };
}

interface DisplaySettingsResponse {
  success: boolean;
  data?: DisplaySettings;
  error?: string;
}

// デフォルト値を定数として定義（参照の安定性を確保）
const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  enabledCollections: [],
  enabledEvents: [],
  customNFTTypes: [],
  includeKiosk: true,
  collectionDisplayNames: {},
  collectionImageUrls: {},
  collectionDetailUrls: {},
  collectionLayouts: [],
  collectionInfo: {}
};

/**
 * 表示設定取得フック（一般ユーザー用、パブリックAPI）
 */
export function useDisplaySettings() {
  return useQuery({
    queryKey: ['displaySettings'],
    queryFn: async (): Promise<DisplaySettings> => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/display-settings`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch display settings');
        }
        
        const data: DisplaySettingsResponse = await response.json();
        
        if (!data.success || !data.data) {
          // デフォルト値を返す（定数を使用して参照の安定性を確保）
          return DEFAULT_DISPLAY_SETTINGS;
        }
        
        // データを正規化して返す（構造的共有を有効にする）
        return {
          enabledCollections: Array.isArray(data.data.enabledCollections) ? data.data.enabledCollections : [],
          enabledEvents: Array.isArray(data.data.enabledEvents) ? data.data.enabledEvents : [],
          customNFTTypes: Array.isArray(data.data.customNFTTypes) ? data.data.customNFTTypes : [],
          includeKiosk: typeof data.data.includeKiosk === 'boolean' ? data.data.includeKiosk : true,
          collectionDisplayNames: data.data.collectionDisplayNames && typeof data.data.collectionDisplayNames === 'object' ? data.data.collectionDisplayNames : {},
          collectionImageUrls: data.data.collectionImageUrls && typeof data.data.collectionImageUrls === 'object' ? data.data.collectionImageUrls : {},
          collectionDetailUrls: data.data.collectionDetailUrls && typeof data.data.collectionDetailUrls === 'object' ? data.data.collectionDetailUrls : {},
          collectionLayouts: Array.isArray(data.data.collectionLayouts) ? data.data.collectionLayouts : []
        };
      } catch (error) {
        // エラー時もデフォルト値を返す（定数を使用して参照の安定性を確保）
        return DEFAULT_DISPLAY_SETTINGS;
      }
    },
    staleTime: 15 * 60 * 1000, // 15 minutes（リクエスト削減のため延長）
    retry: 1, // 1回リトライ
    structuralSharing: true, // 構造的共有を有効にして、同じ内容の場合は同じ参照を返す
  });
}

/**
 * 表示設定取得フック（管理者用）
 */
export function useAdminDisplaySettings() {
  return useQuery({
    queryKey: ['adminDisplaySettings'],
    queryFn: async (): Promise<DisplaySettings> => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/display-settings`, {
          headers: getAuthHeaders()
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch display settings');
        }
        
        const data: DisplaySettingsResponse = await response.json();
        
        if (!data.success || !data.data) {
          // デフォルト値を返す
          return {
            enabledCollections: [],
            enabledEvents: [],
            customNFTTypes: [],
            includeKiosk: true,
            collectionDisplayNames: {},
            collectionImageUrls: {},
            collectionDetailUrls: {},
            collectionLayouts: []
          };
        }
        
        return {
          ...data.data,
          includeKiosk: typeof data.data.includeKiosk === 'boolean' ? data.data.includeKiosk : true,
          collectionDisplayNames: data.data.collectionDisplayNames || {},
          collectionImageUrls: data.data.collectionImageUrls || {},
          collectionDetailUrls: data.data.collectionDetailUrls || {},
          collectionLayouts: Array.isArray(data.data.collectionLayouts) ? data.data.collectionLayouts : []
        };
      } catch (error) {
        // エラー時もデフォルト値を返す
        return {
          enabledCollections: [],
          enabledEvents: [],
          customNFTTypes: [],
          includeKiosk: true,
          collectionDisplayNames: {},
          collectionImageUrls: {},
          collectionDetailUrls: {},
          collectionLayouts: []
        };
      }
    },
    staleTime: 15 * 60 * 1000, // 15 minutes（リクエスト削減のため延長）
    retry: false, // 管理者でない場合は失敗するのでリトライしない
  });
}

/**
 * 表示設定保存フック
 */
export function useUpdateDisplaySettings() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (settings: DisplaySettings): Promise<DisplaySettings> => {
      console.log('[useUpdateDisplaySettings] Sending request:', {
        imageUrlsKeys: Object.keys(settings.collectionImageUrls || {}),
        imageUrls: settings.collectionImageUrls,
        detailUrlsKeys: Object.keys(settings.collectionDetailUrls || {}),
        detailUrls: settings.collectionDetailUrls,
      });
      
      const response = await fetch(`${API_BASE_URL}/api/admin/display-settings`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(settings)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[useUpdateDisplaySettings] Request failed:', errorData);
        throw new Error(errorData.error || 'Failed to save display settings');
      }
      
      const data: DisplaySettingsResponse = await response.json();
      
      console.log('[useUpdateDisplaySettings] Response received:', {
        success: data.success,
        imageUrlsKeys: data.data ? Object.keys(data.data.collectionImageUrls || {}) : 'no data',
        imageUrls: data.data?.collectionImageUrls,
        detailUrlsKeys: data.data ? Object.keys(data.data.collectionDetailUrls || {}) : 'no data',
        detailUrls: data.data?.collectionDetailUrls,
      });
      
      if (!data.success || !data.data) {
        console.error('[useUpdateDisplaySettings] Invalid response:', data);
        throw new Error(data.error || 'Failed to save display settings');
      }
      
      return {
        ...data.data,
        includeKiosk: typeof data.data.includeKiosk === 'boolean' ? data.data.includeKiosk : true,
        collectionDisplayNames: data.data.collectionDisplayNames || {},
        collectionImageUrls: data.data.collectionImageUrls || {},
        collectionDetailUrls: data.data.collectionDetailUrls || {},
        collectionLayouts: Array.isArray(data.data.collectionLayouts) ? data.data.collectionLayouts : [],
        customNFTTypes: Array.isArray(data.data.customNFTTypes) ? data.data.customNFTTypes : []
      };
    },
    onSuccess: () => {
      // キャッシュを無効化して再フェッチ
      queryClient.invalidateQueries({ queryKey: ['displaySettings'] });
      queryClient.invalidateQueries({ queryKey: ['adminDisplaySettings'] });
      // 他の関連クエリも無効化（NFT一覧など）
      queryClient.invalidateQueries({ queryKey: ['nfts'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    }
  });
}

