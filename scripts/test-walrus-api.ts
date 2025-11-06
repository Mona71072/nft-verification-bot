/**
 * Walrus.pdf API のテストスクリプト
 * Publisher/Aggregator API の動作確認
 */

// import { config } from '../bot/src/config';

interface TestResult {
  test: string;
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * テスト用の小さな画像データを生成
 */
function createTestImage(): Blob {
  // 1x1ピクセルのPNG画像（Base64）
  const pngData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const binaryString = atob(pngData);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'image/png' });
}

/**
 * Publisher API テスト
 */
async function testPublisherAPI(config: any): Promise<TestResult> {
  try {
    
    const testImage = createTestImage();
    const url = `${config.WALRUS_PUBLISHER_BASE}/v1/blobs?permanent=true`;
    
    
    const response = await fetch(url, {
      method: 'PUT',
      body: testImage,
      headers: {
        'Content-Type': 'image/png'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const result = await response.json() as any;
    
    const blobId = result?.blobStoreResult?.newlyCreated?.blobObject?.blobId ?? result?.blobId;
    
    if (!blobId) {
      throw new Error('No blobId in response');
    }
    
    return {
      test: 'Publisher API',
      success: true,
      data: { blobId, result }
    };
    
  } catch (error) {
    return {
      test: 'Publisher API',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Aggregator API テスト
 */
async function testAggregatorAPI(config: any, blobId: string): Promise<TestResult> {
  try {
    
    const url = `${config.WALRUS_AGGREGATOR_BASE}/v1/blobs/${blobId}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    
    const blob = await response.blob();
    
    return {
      test: 'Aggregator API',
      success: true,
      data: { contentType, contentLength, size: blob.size }
    };
    
  } catch (error) {
    return {
      test: 'Aggregator API',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * プロキシ経由テスト
 */
async function testProxyAPI(config: any, blobId: string): Promise<TestResult> {
  try {
    
    const proxyUrl = `https://nft-verification-production.mona-syndicatextokyo.workers.dev/walrus/blobs/${blobId}`;
    
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const contentType = response.headers.get('content-type');
    const cacheControl = response.headers.get('cache-control');
    
    
    const blob = await response.blob();
    
    return {
      test: 'Proxy API',
      success: true,
      data: { contentType, cacheControl, size: blob.size }
    };
    
  } catch (error) {
    return {
      test: 'Proxy API',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * cURL コマンドの生成
 */
function generateCurlCommands(config: any, blobId: string): void {
  
  
}

/**
 * メインテスト実行
 */
async function main() {
  
  try {
    // 設定の検証
    const walrusConfig = {
      WALRUS_PUBLISHER_BASE: (process as any).env.WALRUS_PUBLISHER_BASE || 'https://publisher.mainnet.walrus.space',
      WALRUS_AGGREGATOR_BASE: (process as any).env.WALRUS_AGGREGATOR_BASE || 'https://aggregator.mainnet.walrus.space'
    };
    
    
    const results: TestResult[] = [];
    
    // 1. Publisher API テスト
    const publisherResult = await testPublisherAPI(walrusConfig);
    results.push(publisherResult);
    
    if (!publisherResult.success) {
      return;
    }
    
    const blobId = publisherResult.data?.blobId;
    if (!blobId) {
      return;
    }
    
    
    // 2. Aggregator API テスト
    const aggregatorResult = await testAggregatorAPI(walrusConfig, blobId);
    results.push(aggregatorResult);
    
    if (aggregatorResult.success) {
    } else {
    }
    
    // 3. プロキシAPI テスト
    const proxyResult = await testProxyAPI(walrusConfig, blobId);
    results.push(proxyResult);
    
    if (proxyResult.success) {
    } else {
    }
    
    // 結果サマリー
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      if (!result.success && result.error) {
      }
    });
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    
    if (successCount === totalCount) {
    } else {
    }
    
    // cURL コマンドの生成
    generateCurlCommands(walrusConfig, blobId);
    
  } catch (error) {
    (process as any).exit(1);
  }
}

// スクリプト実行
if ((require as any).main === module) {
}

export { testPublisherAPI, testAggregatorAPI, testProxyAPI };
