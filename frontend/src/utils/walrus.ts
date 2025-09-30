/**
 * Walrus.pdf 準拠の画像URL生成ユーティリティ
 * Aggregator API 経由の公開読み出しを提供
 */

/**
 * 画像の公開URL生成（Aggregator API 経由）
 * PDF準拠: 表示URLは Aggregator の GET /v1/blobs/{blobId} 一択
 * @param blobId 画像のBlob ID
 * @returns 公開URL、blobIdが未指定の場合はundefined
 */
export const walrusUrlFromCid = (blobId?: string): string | undefined => {
  if (!blobId) return undefined;
  
  const aggregatorBase = import.meta.env.VITE_WALRUS_AGGREGATOR_BASE || 'https://aggregator.mainnet.walrus.space';
  return `${aggregatorBase}/v1/blobs/${encodeURIComponent(blobId)}`;
};

/**
 * 画像の公開URL生成（カスタムベースURL使用）
 * @param blobId 画像のBlob ID
 * @param baseUrl カスタムベースURL
 * @returns 公開URL、blobIdが未指定の場合はundefined
 */
export const walrusUrlFromCidWithBase = (blobId?: string, baseUrl?: string): string | undefined => {
  if (!blobId) return undefined;
  
  const aggregatorBase = baseUrl || import.meta.env.VITE_WALRUS_AGGREGATOR_BASE || 'https://aggregator.mainnet.walrus.space';
  return `${aggregatorBase}/v1/blobs/${encodeURIComponent(blobId)}`;
};

/**
 * プロキシ経由の画像URL生成（自サイトのプロキシ使用）
 * @param blobId 画像のBlob ID
 * @returns プロキシURL、blobIdが未指定の場合はundefined
 */
export const walrusProxyUrlFromCid = (blobId?: string): string | undefined => {
  if (!blobId) return undefined;
  
  return `/walrus/blobs/${encodeURIComponent(blobId)}`;
};

/**
 * 画像アップロード用の設定取得
 * @returns Walrus設定情報
 */
export const getWalrusConfig = async (): Promise<{
  uploadEnabled: boolean;
  publisherBase?: string;
  aggregatorBase?: string;
  defaultEpochs?: number;
  defaultPermanent?: boolean;
}> => {
  try {
    const response = await fetch('/api/walrus/config');
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.error || 'Failed to get Walrus config');
    }
  } catch (error) {
    console.error('Failed to get Walrus config:', error);
    return { uploadEnabled: false };
  }
};

/**
 * 画像をWalrusにアップロード
 * @param file アップロードする画像ファイル
 * @param options 保存オプション
 * @returns アップロード結果
 */
export const uploadToWalrus = async (
  file: File,
  options: {
    epochs?: number;
    permanent?: boolean;
    deletable?: boolean;
  } = {}
): Promise<{
  success: boolean;
  blobId?: string;
  contentType?: string;
  size?: number;
  error?: string;
}> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    // クエリパラメータの構築
    const params = new URLSearchParams();
    if (options.epochs !== undefined) {
      params.set('epochs', String(options.epochs));
    }
    if (options.permanent) {
      params.set('permanent', 'true');
    }
    if (options.deletable) {
      params.set('deletable', 'true');
    }

    const url = `/api/walrus/store${params.toString() ? `?${params.toString()}` : ''}`;
    
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });

    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        blobId: data.data.blobId,
        contentType: data.data.contentType,
        size: data.data.size
      };
    } else {
      return {
        success: false,
        error: data.error || 'Upload failed'
      };
    }
  } catch (error) {
    console.error('Walrus upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    };
  }
};

/**
 * 画像のフォールバックURL生成（旧システムとの互換性用）
 * @param blobId 画像のBlob ID
 * @param fallbackUrl フォールバックURL
 * @returns フォールバックURL、blobIdが未指定の場合はundefined
 */
export const getFallbackImageUrl = (blobId?: string, fallbackUrl?: string): string | undefined => {
  if (!blobId) return fallbackUrl;
  
  // 新しいWalrus URLを優先
  return walrusUrlFromCid(blobId) || fallbackUrl;
};

/**
 * 画像の表示用URL生成（フロントエンド用の統一インターフェース）
 * @param blobId 画像のBlob ID
 * @param fallbackUrl フォールバックURL（オプション）
 * @param useProxy プロキシ経由を使用するかどうか
 * @returns 表示用URL
 */
export const getImageDisplayUrl = (
  blobId?: string,
  fallbackUrl?: string,
  useProxy: boolean = true
): string | undefined => {
  if (!blobId) return fallbackUrl;
  
  if (useProxy) {
    return walrusProxyUrlFromCid(blobId) || fallbackUrl;
  } else {
    return walrusUrlFromCid(blobId) || fallbackUrl;
  }
};
