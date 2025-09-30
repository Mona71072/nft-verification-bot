/**
 * Walrus.pdf 準拠への移行スクリプト
 * 既存の imageUrl から imageCid への正規化と再アップロード
 */

// import { config } from '../bot/src/config';

interface EventData {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  imageCid?: string;
  imageMimeType?: string;
  active: boolean;
  startAt?: string;
  endAt?: string;
  moveCall: any;
  collectionId?: string;
}

interface MigrationResult {
  eventId: string;
  eventName: string;
  oldImageUrl?: string;
  newImageCid?: string;
  newImageUrl?: string;
  success: boolean;
  error?: string;
}

/**
 * 画像URLからBlob IDを抽出
 * @param imageUrl 画像URL
 * @returns Blob ID（抽出できない場合はnull）
 */
function extractBlobIdFromUrl(imageUrl: string): string | null {
  if (!imageUrl) return null;
  
  // Walrus Aggregator API URL から抽出
  const aggregatorMatch = imageUrl.match(/\/v1\/blobs\/([a-zA-Z0-9_-]+)/);
  if (aggregatorMatch) {
    return aggregatorMatch[1];
  }
  
  // 旧ゲートウェイURL から抽出
  const gatewayMatch = imageUrl.match(/gateway\.mainnet\.walrus\.space\/([a-zA-Z0-9_-]+)/);
  if (gatewayMatch) {
    return gatewayMatch[1];
  }
  
  // wal.app URL から抽出
  const walAppMatch = imageUrl.match(/wal\.app\/ipfs\/([a-zA-Z0-9_-]+)/);
  if (walAppMatch) {
    return walAppMatch[1];
  }
  
  // 直接的なBlob ID（Base64URL形式）
  const directMatch = imageUrl.match(/([a-zA-Z0-9_-]{43,})/);
  if (directMatch) {
    return directMatch[1];
  }
  
  return null;
}

/**
 * 画像をWalrusに再アップロード
 * @param imageUrl 既存の画像URL
 * @param config Walrus設定
 * @returns アップロード結果
 */
async function reuploadImageToWalrus(
  imageUrl: string, 
  config: any
): Promise<{ blobId?: string; error?: string }> {
  try {
    // 画像をダウンロード
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return { error: `Failed to download image: ${response.status}` };
    }
    
    const blob = await response.blob();
    const file = new File([blob], 'image.jpg', { type: blob.type });
    
    // Walrusにアップロード
    const formData = new FormData();
    formData.append('file', file);
    
    const uploadResponse = await fetch(`${config.WALRUS_PUBLISHER_BASE}/v1/blobs?permanent=true`, {
      method: 'PUT',
      body: blob
    });
    
    if (!uploadResponse.ok) {
      return { error: `Walrus upload failed: ${uploadResponse.status}` };
    }
    
    const result = await uploadResponse.json() as any;
    const blobId = result?.blobStoreResult?.newlyCreated?.blobObject?.blobId ?? result?.blobId;
    
    if (!blobId) {
      return { error: 'No blobId in Walrus response' };
    }
    
    return { blobId };
    
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * イベントデータの移行
 * @param event イベントデータ
 * @param config Walrus設定
 * @returns 移行結果
 */
async function migrateEvent(
  event: EventData, 
  config: any
): Promise<MigrationResult> {
  const result: MigrationResult = {
    eventId: event.id,
    eventName: event.name,
    oldImageUrl: event.imageUrl,
    success: false
  };
  
  try {
    // 既にimageCidがある場合はスキップ
    if (event.imageCid) {
      result.newImageCid = event.imageCid;
      result.newImageUrl = `${config.WALRUS_AGGREGATOR_BASE}/v1/blobs/${event.imageCid}`;
      result.success = true;
      return result;
    }
    
    // imageUrlがない場合はスキップ
    if (!event.imageUrl) {
      result.error = 'No imageUrl to migrate';
      return result;
    }
    
    // 既存URLからBlob IDを抽出
    const existingBlobId = extractBlobIdFromUrl(event.imageUrl);
    
    if (existingBlobId) {
      // 既存のBlob IDを使用
      result.newImageCid = existingBlobId;
      result.newImageUrl = `${config.WALRUS_AGGREGATOR_BASE}/v1/blobs/${existingBlobId}`;
      result.success = true;
    } else {
      // 再アップロードが必要
      console.log(`Re-uploading image for event ${event.id}: ${event.imageUrl}`);
      const uploadResult = await reuploadImageToWalrus(event.imageUrl, config);
      
      if (uploadResult.blobId) {
        result.newImageCid = uploadResult.blobId;
        result.newImageUrl = `${config.WALRUS_AGGREGATOR_BASE}/v1/blobs/${uploadResult.blobId}`;
        result.success = true;
      } else {
        result.error = uploadResult.error || 'Re-upload failed';
      }
    }
    
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
  }
  
  return result;
}

/**
 * メイン移行処理
 */
async function main() {
  console.log('🔄 Starting Walrus.pdf migration...');
  
  try {
    // 設定の検証
    const walrusConfig = {
      WALRUS_PUBLISHER_BASE: (process as any).env.WALRUS_PUBLISHER_BASE,
      WALRUS_AGGREGATOR_BASE: (process as any).env.WALRUS_AGGREGATOR_BASE
    };
    
    if (!walrusConfig.WALRUS_PUBLISHER_BASE || !walrusConfig.WALRUS_AGGREGATOR_BASE) {
      throw new Error('WALRUS_PUBLISHER_BASE and WALRUS_AGGREGATOR_BASE must be set');
    }
    
    console.log('📋 Configuration:');
    console.log(`  Publisher: ${walrusConfig.WALRUS_PUBLISHER_BASE}`);
    console.log(`  Aggregator: ${walrusConfig.WALRUS_AGGREGATOR_BASE}`);
    
    // イベントデータの取得（実際のAPI呼び出しに置き換える）
    console.log('📥 Fetching events...');
    // 実際のAPIからイベントを取得
    const apiResponse = await fetch('https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/events');
    const apiData = await apiResponse.json() as any;
    const events: EventData[] = apiData.success ? apiData.data || [] : [];
    
    if (events.length === 0) {
      console.log('ℹ️  No events to migrate');
      return;
    }
    
    console.log(`📊 Found ${events.length} events to process`);
    
    const results: MigrationResult[] = [];
    
    // 各イベントを移行
    for (const event of events) {
      console.log(`🔄 Migrating event: ${event.name} (${event.id})`);
      
      const result = await migrateEvent(event, walrusConfig);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ Success: ${event.name}`);
        console.log(`   Old URL: ${result.oldImageUrl}`);
        console.log(`   New CID: ${result.newImageCid}`);
        console.log(`   New URL: ${result.newImageUrl}`);
      } else {
        console.log(`❌ Failed: ${event.name} - ${result.error}`);
      }
      
      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 結果サマリー
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log('\n📊 Migration Summary:');
    console.log(`  Total events: ${results.length}`);
    console.log(`  Successful: ${successCount}`);
    console.log(`  Failed: ${failureCount}`);
    
    if (failureCount > 0) {
      console.log('\n❌ Failed migrations:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.eventName} (${r.eventId}): ${r.error}`);
      });
    }
    
    // 成功した移行結果をファイルに保存
    const successResults = results.filter(r => r.success);
    if (successResults.length > 0) {
      const fs = await import('fs/promises').catch(() => null);
      if (fs) {
        await fs.writeFile(
          'migration-results.json',
          JSON.stringify(successResults, null, 2)
        );
      }
      console.log('\n💾 Migration results saved to migration-results.json');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    (process as any).exit(1);
  }
}

// スクリプト実行
if ((require as any).main === module) {
  main().catch(console.error);
}

export { migrateEvent, extractBlobIdFromUrl };
