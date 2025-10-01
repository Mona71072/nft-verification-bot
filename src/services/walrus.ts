/**
 * Walrus.pdf 準拠の画像ストレージサービス
 * Publisher API での書き込み、Aggregator API での読み出しを提供
 */

import { createPublisherJWT } from '../utils/jwt';

export interface WalrusStoreOptions {
  epochs?: number | 'max';
  permanent?: boolean;
  deletable?: boolean;
  sendTo?: string; // send_object_to: BlobオブジェクトをSuiアドレスに送付
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
  publisherAuth?: string; // JWT Bearer token for authenticated Publisher (固定トークン用)
  publisherJwtSecret?: string; // JWT署名秘密鍵（都度署名用、推奨）
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
  const qs = new URLSearchParams();
  
  // 寿命指定を必須で実装（v1.33以降の既定がdeletableのため明示が必要）
  // PDF準拠: 必ず ?epochs=n or ?permanent=true / ?deletable=true を明示
  if (options.permanent) {
    qs.set('permanent', 'true');
  } else if (options.deletable) {
    qs.set('deletable', 'true');
  } else {
    // デフォルトでepochsを明示（PDF準拠）
    qs.set('epochs', String(options.epochs ?? config.defaultEpochs ?? 5));
  }

  // send_object_to オプション（Blobオブジェクトを指定Suiアドレスに送付）
  if (options.sendTo) {
    qs.set('send_object_to', options.sendTo);
  }

  const url = `${config.publisherBase}/v1/blobs?${qs.toString()}`;
  
  // PDF準拠: バイト列をそのまま送信（multipart/form-dataではない）
  let body: ArrayBuffer;
  if (input instanceof ArrayBuffer) {
    body = input;
  } else if (input instanceof Uint8Array) {
    body = input.buffer;
  } else {
    // Blobの場合はArrayBufferに変換
    body = await input.arrayBuffer();
  }
  
  // 実行関数（リトライ可能）
  const attempt = async (signal?: AbortSignal) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream'
    };
    
    // JWT認証（Mainnet認証付きPublisher対応）
    // 優先順位: 1) 都度署名（publisherJwtSecret）、2) 固定トークン（publisherAuth）
    if (config.publisherJwtSecret) {
      // 都度JWT生成（推奨方式）
      const jwt = await createPublisherJWT({
        subject: 'worker-upload',
        expiresIn: 180, // 3分
        maxSize: body.byteLength,
        maxEpochs: typeof options.epochs === 'number' ? options.epochs : config.defaultEpochs
      }, config.publisherJwtSecret);
      headers['Authorization'] = `Bearer ${jwt}`;
    } else if (config.publisherAuth) {
      // 固定トークン方式（後方互換）
      headers['Authorization'] = config.publisherAuth;
    }
    
    const response = await fetch(url, {
      method: 'PUT',
      body: body,
      headers,
      signal
    });

    const text = await response.text().catch(() => '');
    
    if (!response.ok) {
      throw new Error(`Walrus store failed: ${response.status} ${response.statusText} :: ${text.slice(0, 400)}`);
    }

    let result: any;
    try {
      result = JSON.parse(text);
    } catch {
      result = text;
    }
    
    // blobId の抽出（レスポンス形式の違いに対応）
    const blobId = result?.blobStoreResult?.newlyCreated?.blobObject?.blobId ?? 
                   result?.blobId ??
                   (typeof result === 'string' ? result : null);
    
    if (!blobId) {
      throw new Error(`Walrus PUT: blobId missing in response :: ${text.slice(0, 400)}`);
    }

    return { ...result, blobId };
  };

  // リトライロジック（5xx/ネットワークエラーのみ、最大3回）
  const maxRetries = 3;
  const timeout = 15000; // 15秒

  for (let i = 0; i < maxRetries; i++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const result = await attempt(controller.signal);
      clearTimeout(timeoutId);
      return result;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      // リトライ可能なエラーかチェック
      const errorMsg = error?.message || '';
      const isRetriable = 
        /5\d\d/.test(errorMsg) || // 5xxエラー
        /fetch failed|network|timeout|abort|ECONN|ENOTFOUND/i.test(errorMsg);
      
      // 最後の試行またはリトライ不可能なエラーの場合は即座にthrow
      if (i === maxRetries - 1 || !isRetriable) {
        throw error;
      }
      
      // 指数バックオフ (500ms, 1000ms, 2000ms)
      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, i)));
    }
  }

  throw new Error('Unreachable code');
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
  const defaultEpochs = parseInt(env.WALRUS_DEFAULT_EPOCHS || '12', 10);
  const defaultPermanent = env.WALRUS_DEFAULT_PERMANENT === 'true';
  const publisherAuth = env.WALRUS_PUBLISHER_AUTH; // JWT Bearer token（固定トークン用）
  const publisherJwtSecret = env.WALRUS_PUBLISHER_JWT_SECRET; // JWT署名秘密鍵（都度署名用、推奨）

  if (!publisherBase || !aggregatorBase) {
    throw new Error('WALRUS_PUBLISHER_BASE and WALRUS_AGGREGATOR_BASE must be configured');
  }

  return {
    publisherBase,
    aggregatorBase,
    defaultEpochs,
    defaultPermanent,
    publisherAuth,
    publisherJwtSecret
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
