/**
 * Discord Bot 用 Walrus ユーティリティ
 * Worker と共通の Walrus URL 生成ロジック
 */

export interface WalrusConfig {
  publisherBase: string;
  aggregatorBase: string;
  defaultEpochs: number;
  defaultPermanent: boolean;
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
 * 画像の公開URL生成（Aggregator API 経由）
 * @param blobId 画像のBlob ID
 * @param config Walrus設定
 * @returns 公開URL
 */
export function getBlobUrl(blobId: string, config: WalrusConfig): string {
  return `${config.aggregatorBase}/v1/blobs/${encodeURIComponent(blobId)}`;
}

/**
 * 画像の公開URL生成（環境変数から自動取得）
 * @param blobId 画像のBlob ID
 * @param env 環境変数オブジェクト
 * @returns 公開URL
 */
export function getBlobUrlFromEnv(blobId: string, env: any): string {
  const config = getWalrusConfig(env);
  return getBlobUrl(blobId, config);
}

/**
 * Display 用の画像URL生成（Sui Display フィールド用）
 * @param blobId 画像のBlob ID
 * @param env 環境変数オブジェクト
 * @returns Display用URL
 */
export function getDisplayImageUrl(blobId: string, env: any): string {
  const config = getWalrusConfig(env);
  return `${config.aggregatorBase}/v1/blobs/{image_cid}`.replace('{image_cid}', blobId);
}
