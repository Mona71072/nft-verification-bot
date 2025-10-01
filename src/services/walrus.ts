/**
 * Walrus.pdf 準拠の画像ストレージサービス
 * Publisher API での書き込み、Aggregator API での読み出しを提供
 */

export interface WalrusStoreOptions {
  epochs?: number | 'max';
  permanent?: boolean;
  deletable?: boolean;
}

export interface WalrusStoreResult {
  blobId: string;
  newlyCreated?: boolean;
  blobStoreResult?: {
    newlyCreated?: {
      blobObject?: {
        blobId: string;
      };
    };
  };
}

export interface WalrusConfig {
  publisherBase: string;
  aggregatorBase: string;
  defaultEpochs: number;
  defaultPermanent: boolean;
}

/**
 * Walrus Publisher API への画像保存
 * @param input 画像データ（Blob、ArrayBuffer、Uint8Array）
 * @param options 保存オプション（epochs/permanent/deletable）
 * @param config Walrus設定
 * @returns 保存結果（blobId等）
 */
export async function storeBlob(
  input: Blob | ArrayBuffer | Uint8Array,
  options: WalrusStoreOptions,
  config: WalrusConfig
): Promise<WalrusStoreResult> {
  console.log('🔄 Walrus storeBlob開始:', {
    inputType: input.constructor.name,
    inputSize: 'size' in input ? input.size : 'unknown',
    options,
    config: {
      publisherBase: config.publisherBase,
      defaultEpochs: config.defaultEpochs
    }
  });

  const qs = new URLSearchParams();
  
  // 寿命指定を必須で実装（v1.33以降の既定がdeletableのため明示が必要）
  // PDF準拠: 必ず ?epochs=n or ?permanent=true / ?deletable=true を明示
  if (options.epochs) {
    qs.set('epochs', String(options.epochs));
  } else if (options.permanent) {
    qs.set('permanent', 'true');
  } else if (options.deletable) {
    qs.set('deletable', 'true');
  } else {
    // デフォルト値を使用（明示的な寿命指定）
    qs.set('epochs', String(config.defaultEpochs));
  }

  const url = `${config.publisherBase}/v1/blobs?${qs.toString()}`;
  console.log('📤 Walrus Publisher URL:', url);
  
  const response = await fetch(url, {
    method: 'PUT',
    body: input as BodyInit,
    headers: {
      'Content-Type': 'application/octet-stream'
    }
  });

  console.log('📥 Walrus Publisher レスポンス:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries())
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    console.error('❌ Walrus Publisher エラー:', errorText);
    throw new Error(`Walrus store failed: ${response.status} ${errorText}`);
  }

  const result = await response.json() as WalrusStoreResult;
  console.log('📄 Walrus Publisher レスポンスデータ:', result);
  
  // blobId の抽出（レスポンス形式の違いに対応）
  const blobId = result?.blobStoreResult?.newlyCreated?.blobObject?.blobId ?? 
                 result?.blobId;
  
  if (!blobId) {
    console.error('❌ Walrus レスポンスにblobIdがありません:', result);
    throw new Error('Walrus response missing blobId');
  }

  console.log('✅ Walrus storeBlob成功:', { blobId });
  return { ...result, blobId };
}

/**
 * Walrus Aggregator API から画像を取得
 * @param blobId 画像のBlob ID
 * @param config Walrus設定
 * @returns 画像レスポンス
 */
export async function fetchBlob(
  blobId: string,
  config: WalrusConfig
): Promise<Response> {
  const url = `${config.aggregatorBase}/v1/blobs/${encodeURIComponent(blobId)}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Walrus fetch failed: ${response.status}`);
  }
  
  return response;
}

/**
 * 画像の公開URL生成（Aggregator API 経由）
 * @param blobId 画像のBlob ID
 * @param config Walrus設定
 * @returns 公開URL
 */
export function getBlobUrl(blobId: string, config: WalrusConfig): string {
  return `${config.aggregatorBase}/v1/blobs/${encodeURIComponent(blobId)}`;
}

/**
 * 環境変数からWalrus設定を取得
 * @param env 環境変数オブジェクト
 * @returns Walrus設定
 */
export function getWalrusConfig(env: any): WalrusConfig {
  const publisherBase = env.WALRUS_PUBLISHER_BASE;
  const aggregatorBase = env.WALRUS_AGGREGATOR_BASE;
  const defaultEpochs = parseInt(env.WALRUS_DEFAULT_EPOCHS || '5', 10);
  const defaultPermanent = env.WALRUS_DEFAULT_PERMANENT === 'true';

  if (!publisherBase || !aggregatorBase) {
    throw new Error('WALRUS_PUBLISHER_BASE and WALRUS_AGGREGATOR_BASE must be configured');
  }

  return {
    publisherBase,
    aggregatorBase,
    defaultEpochs,
    defaultPermanent
  };
}

/**
 * ファイルサイズチェック（1MB制限）
 * @param file ファイルオブジェクト
 */
export function validateFileSize(file: File): void {
  const maxSize = 1024 * 1024; // 1MB
  if (file.size > maxSize) {
    throw new Error(`File size too large: ${Math.round(file.size / 1024)}KB > 1MB. Please compress the image.`);
  }
}

/**
 * MIMEタイプの検証
 * @param mimeType MIMEタイプ
 * @returns 有効な画像MIMEタイプかどうか
 */
export function validateImageMimeType(mimeType: string): boolean {
  const validTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ];
  return validTypes.includes(mimeType.toLowerCase());
}
