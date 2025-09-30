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
    console.log('🧪 Testing Publisher API...');
    
    const testImage = createTestImage();
    const url = `${config.WALRUS_PUBLISHER_BASE}/v1/blobs?permanent=true`;
    
    console.log(`  URL: ${url}`);
    console.log(`  Image size: ${testImage.size} bytes`);
    
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
    console.log('  Response:', JSON.stringify(result, null, 2));
    
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
    console.log('🧪 Testing Aggregator API...');
    
    const url = `${config.WALRUS_AGGREGATOR_BASE}/v1/blobs/${blobId}`;
    console.log(`  URL: ${url}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    console.log(`  Content-Type: ${contentType}`);
    console.log(`  Content-Length: ${contentLength}`);
    
    const blob = await response.blob();
    console.log(`  Downloaded size: ${blob.size} bytes`);
    
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
    console.log('🧪 Testing Proxy API...');
    
    const proxyUrl = `https://nft-verification-production.mona-syndicatextokyo.workers.dev/walrus/blobs/${blobId}`;
    console.log(`  URL: ${proxyUrl}`);
    
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const contentType = response.headers.get('content-type');
    const cacheControl = response.headers.get('cache-control');
    
    console.log(`  Content-Type: ${contentType}`);
    console.log(`  Cache-Control: ${cacheControl}`);
    
    const blob = await response.blob();
    console.log(`  Downloaded size: ${blob.size} bytes`);
    
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
  console.log('\n📋 cURL Commands for manual testing:');
  console.log('\n1. Upload (Publisher API):');
  console.log(`curl -X PUT "${config.WALRUS_PUBLISHER_BASE}/v1/blobs?permanent=true" \\`);
  console.log(`  --data-binary @test-image.png \\`);
  console.log(`  -H "Content-Type: image/png"`);
  
  console.log('\n2. Download (Aggregator API):');
  console.log(`curl "${config.WALRUS_AGGREGATOR_BASE}/v1/blobs/${blobId}" \\`);
  console.log(`  -o downloaded-image.png`);
  
  console.log('\n3. Download via Proxy:');
  console.log(`curl "https://nft-verification-production.mona-syndicatextokyo.workers.dev/walrus/blobs/${blobId}" \\`);
  console.log(`  -o downloaded-image-proxy.png`);
}

/**
 * メインテスト実行
 */
async function main() {
  console.log('🧪 Walrus.pdf API Test Suite');
  console.log('================================');
  
  try {
    // 設定の検証
    const walrusConfig = {
      WALRUS_PUBLISHER_BASE: (process as any).env.WALRUS_PUBLISHER_BASE || 'https://publisher.mainnet.walrus.space',
      WALRUS_AGGREGATOR_BASE: (process as any).env.WALRUS_AGGREGATOR_BASE || 'https://aggregator.mainnet.walrus.space'
    };
    
    console.log('📋 Configuration:');
    console.log(`  Publisher: ${walrusConfig.WALRUS_PUBLISHER_BASE}`);
    console.log(`  Aggregator: ${walrusConfig.WALRUS_AGGREGATOR_BASE}`);
    
    const results: TestResult[] = [];
    
    // 1. Publisher API テスト
    const publisherResult = await testPublisherAPI(walrusConfig);
    results.push(publisherResult);
    
    if (!publisherResult.success) {
      console.log('❌ Publisher API test failed, skipping remaining tests');
      return;
    }
    
    const blobId = publisherResult.data?.blobId;
    if (!blobId) {
      console.log('❌ No blobId returned from Publisher API');
      return;
    }
    
    console.log(`✅ Publisher API test passed, blobId: ${blobId}`);
    
    // 2. Aggregator API テスト
    const aggregatorResult = await testAggregatorAPI(walrusConfig, blobId);
    results.push(aggregatorResult);
    
    if (aggregatorResult.success) {
      console.log('✅ Aggregator API test passed');
    } else {
      console.log('❌ Aggregator API test failed');
    }
    
    // 3. プロキシAPI テスト
    const proxyResult = await testProxyAPI(walrusConfig, blobId);
    results.push(proxyResult);
    
    if (proxyResult.success) {
      console.log('✅ Proxy API test passed');
    } else {
      console.log('❌ Proxy API test failed');
    }
    
    // 結果サマリー
    console.log('\n📊 Test Results:');
    console.log('================');
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌';
      console.log(`${status} ${result.test}`);
      if (!result.success && result.error) {
        console.log(`   Error: ${result.error}`);
      }
    });
    
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`\n🎯 Summary: ${successCount}/${totalCount} tests passed`);
    
    if (successCount === totalCount) {
      console.log('🎉 All tests passed! Walrus.pdf API integration is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Please check the configuration and network connectivity.');
    }
    
    // cURL コマンドの生成
    generateCurlCommands(walrusConfig, blobId);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    (process as any).exit(1);
  }
}

// スクリプト実行
if ((require as any).main === module) {
  main().catch(console.error);
}

export { testPublisherAPI, testAggregatorAPI, testProxyAPI };
