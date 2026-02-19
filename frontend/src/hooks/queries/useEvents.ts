import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

interface Event {
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
  selectedCollectionId?: string;
  collectionName?: string;
  totalCap?: number;
  mintedCount?: number;
  moveCall: {
    target: string;
    argumentsTemplate: string[] | string;
  };
}

interface EventsResponse {
  success: boolean;
  data?: Event[];
  error?: string;
}

interface EventResponse {
  success: boolean;
  data?: Event;
  error?: string;
}

/**
 * イベント一覧取得フック
 */
export function useEvents() {
  return useQuery({
    queryKey: queryKeys.events.lists(),
    queryFn: async (): Promise<Event[]> => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/events`);
        const data: EventsResponse = await response.json();
        
        if (!data.success || !data.data) {
          throw new Error(data.error || 'イベントの取得に失敗しました');
        }
        
        return data.data;
      } catch (error) {
        throw error instanceof Error ? error : new Error('イベントの取得に失敗しました');
      }
    },
    staleTime: 15 * 60 * 1000,
  });
}

/**
 * 個別イベント取得フック（公開用）
 */
export function useEventPublic(eventId: string) {
  return useQuery({
    queryKey: queryKeys.events.public(eventId),
    queryFn: async (): Promise<Event> => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/events/${eventId}/public`);
        const data: EventResponse = await response.json();
        
        if (!data.success || !data.data) {
          throw new Error(data.error || 'イベント情報の取得に失敗しました');
        }
        
        return data.data;
      } catch (error) {
        throw error instanceof Error ? error : new Error('イベント情報の取得に失敗しました');
      }
    },
    enabled: !!eventId, // eventIdがある場合のみ実行
    staleTime: 15 * 60 * 1000, // 15 minutes（リクエスト削減のため延長）
  });
}
