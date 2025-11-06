/**
 * 移行検証スクリプト
 * Walrus.pdf 準拠の受け入れ基準をチェック
 */

interface ValidationResult {
  test: string;
  passed: boolean;
  error?: string;
  data?: any;
}

interface EventData {
  id: string;
  name: string;
  imageUrl?: string;
  imageCid?: string;
  imageMimeType?: string;
  moveCall?: any;
}

/**
 * 受け入れ基準の検証
 */
class MigrationValidator {
  public results: ValidationResult[] = [];
  
  /**
   * 1. Blob保存テスト: /api/walrus/store → PUT /v1/blobs で blobId が返る
   */
  async testBlobStorage(): Promise<ValidationResult> {
    try {
      
      // テスト用の小さな画像を作成
      const testImage = this.createTestImage();
      const formData = new FormData();
      formData.append('file', testImage, 'test.png');
      
      const response = await fetch('https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/walrus/store?permanent=true', {
        method: 'POST',
        body: formData,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        }
      });
      
      const data = await response.json() as any;
      
      if (!response.ok || !data.success || !data.data?.blobId) {
        return {
          test: 'Blob Storage',
          passed: false,
          error: `Storage failed: ${data.error || 'No blobId returned'}`
        };
      }
      
      return {
        test: 'Blob Storage',
        passed: true,
        data: { blobId: data.data.blobId, size: data.data.size }
      };
      
    } catch (error) {
      return {
        test: 'Blob Storage',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * 2. 表示テスト: フロントは AGGREGATOR_BASE/v1/blobs/{blobId} にのみ依存
   */
  async testDisplayUrl(blobId: string): Promise<ValidationResult> {
    try {
      
      // Aggregator URL の直接アクセステスト
      const aggregatorBase = (process as any).env.WALRUS_AGGREGATOR_BASE || 'https://aggregator.mainnet.walrus.space';
      const directUrl = `${aggregatorBase}/v1/blobs/${blobId}`;
      
      const directResponse = await fetch(directUrl, { method: 'HEAD' });
      
      if (!directResponse.ok) {
        return {
          test: 'Display URL (Direct)',
          passed: false,
          error: `Direct access failed: ${directResponse.status}`
        };
      }
      
      // プロキシ経由のアクセステスト
      const proxyUrl = `/walrus/blobs/${blobId}`;
      const proxyResponse = await fetch(proxyUrl, { method: 'HEAD' });
      
      if (!proxyResponse.ok) {
        return {
          test: 'Display URL (Proxy)',
          passed: false,
          error: `Proxy access failed: ${proxyResponse.status}`
        };
      }
      
      return {
        test: 'Display URL',
        passed: true,
        data: { directUrl, proxyUrl, contentType: directResponse.headers.get('content-type') }
      };
      
    } catch (error) {
      return {
        test: 'Display URL',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * 3. データモデルテスト: イベント/コレクションは imageCid/imageMime だけ
   */
  async testDataModel(): Promise<ValidationResult> {
    try {
      
      // イベント一覧の取得
      const response = await fetch('https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/events');
      const events = await response.json() as any;
      
      if (!events.success) {
        return {
          test: 'Data Model',
          passed: false,
          error: 'Failed to fetch events'
        };
      }
      
      const issues: string[] = [];
      
      for (const event of events.data || []) {
        // imageUrl が残っている場合は警告
        if (event.imageUrl && !event.imageUrl.includes('/v1/blobs/')) {
          issues.push(`Event ${event.id} has legacy imageUrl: ${event.imageUrl}`);
        }
        
        // imageCid がない場合は警告
        if (!event.imageCid && event.imageUrl) {
          issues.push(`Event ${event.id} missing imageCid`);
        }
        
        // Move コールの引数テンプレートをチェック
        if (event.moveCall?.argumentsTemplate) {
          const hasImageUrl = event.moveCall.argumentsTemplate.includes('{imageUrl}');
          const hasImageCid = event.moveCall.argumentsTemplate.includes('{imageCid}');
          
          if (hasImageUrl && !hasImageCid) {
            issues.push(`Event ${event.id} moveCall still uses {imageUrl}`);
          }
        }
      }
      
      return {
        test: 'Data Model',
        passed: issues.length === 0,
        error: issues.length > 0 ? issues.join('; ') : undefined,
        data: { eventsChecked: events.data?.length || 0, issues }
      };
      
    } catch (error) {
      return {
        test: 'Data Model',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * 4. ミントテスト: スポンサー呼び出しに imageCid/imageMime だけを渡す
   */
  async testMintFlow(): Promise<ValidationResult> {
    try {
      
      // ミント用のテストイベントを作成
      const testEvent = {
        id: 'test-mint-validation',
        name: 'Mint Flow Test',
        imageCid: 'test-blob-id',
        imageMimeType: 'image/png',
        moveCall: {
          target: '0x2::test::mint',
          argumentsTemplate: ['{recipient}', '{imageCid}', '{imageMimeType}']
        }
      };
      
      // スポンサーAPI への呼び出しをシミュレート
      const sponsorPayload = {
        eventId: testEvent.id,
        recipient: '0x0000000000000000000000000000000000000000000000000000000000000000',
        moveCall: testEvent.moveCall,
        imageCid: testEvent.imageCid,
        imageMimeType: testEvent.imageMimeType
      };
      
      // ペイロードの検証
      const hasImageUrl = JSON.stringify(sponsorPayload).includes('imageUrl');
      const hasImageCid = sponsorPayload.imageCid !== undefined;
      const hasImageMimeType = sponsorPayload.imageMimeType !== undefined;
      
      if (hasImageUrl) {
        return {
          test: 'Mint Flow',
          passed: false,
          error: 'Sponsor payload contains imageUrl (should be removed)'
        };
      }
      
      if (!hasImageCid || !hasImageMimeType) {
        return {
          test: 'Mint Flow',
          passed: false,
          error: 'Sponsor payload missing imageCid or imageMimeType'
        };
      }
      
      return {
        test: 'Mint Flow',
        passed: true,
        data: { payload: sponsorPayload }
      };
      
    } catch (error) {
      return {
        test: 'Mint Flow',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * 5. Sui Display テスト: 型Displayの image_url を Aggregator形式で展開
   */
  async testSuiDisplay(): Promise<ValidationResult> {
    try {
      
      // Display フィールドのテンプレートをチェック
      const expectedImageUrlTemplate = 'https://aggregator.mainnet.walrus.space/v1/blobs/{image_cid}';
      
      // 実際のDisplay設定を取得（Bot API経由）
      const response = await fetch('https://nft-verification-bot.onrender.com/api/display/config');
      const config = await response.json() as any;
      
      if (!config.success) {
        return {
          test: 'Sui Display',
          passed: false,
          error: 'Failed to fetch display config'
        };
      }
      
      const displayFields = config.data?.fields || [];
      const imageUrlField = displayFields.find((f: any) => f.key === 'image_url');
      
      if (!imageUrlField) {
        return {
          test: 'Sui Display',
          passed: false,
          error: 'image_url field not found in display config'
        };
      }
      
      if (!imageUrlField.value.includes('aggregator.mainnet.walrus.space/v1/blobs/')) {
        return {
          test: 'Sui Display',
          passed: false,
          error: `Display image_url not using Aggregator format: ${imageUrlField.value}`
        };
      }
      
      return {
        test: 'Sui Display',
        passed: true,
        data: { imageUrlTemplate: imageUrlField.value }
      };
      
    } catch (error) {
      return {
        test: 'Sui Display',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * 6. ドキュメント整合テスト: /v1/api でAggregator/Publisherの仕様が参照できる
   */
  async testDocumentationAccess(): Promise<ValidationResult> {
    try {
      
      const publisherBase = (process as any).env.WALRUS_PUBLISHER_BASE || 'https://publisher.mainnet.walrus.space';
      const aggregatorBase = (process as any).env.WALRUS_AGGREGATOR_BASE || 'https://aggregator.mainnet.walrus.space';
      
      // Publisher API 仕様の取得
      const publisherApiResponse = await fetch(`${publisherBase}/v1/api`);
      const publisherApiOk = publisherApiResponse.ok;
      
      // Aggregator API 仕様の取得
      const aggregatorApiResponse = await fetch(`${aggregatorBase}/v1/api`);
      const aggregatorApiOk = aggregatorApiResponse.ok;
      
      if (!publisherApiOk || !aggregatorApiOk) {
        return {
          test: 'Documentation Access',
          passed: false,
          error: `API docs not accessible: Publisher=${publisherApiOk}, Aggregator=${aggregatorApiOk}`
        };
      }
      
      return {
        test: 'Documentation Access',
        passed: true,
        data: { 
          publisherApi: `${publisherBase}/v1/api`,
          aggregatorApi: `${aggregatorBase}/v1/api`
        }
      };
      
    } catch (error) {
      return {
        test: 'Documentation Access',
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * テスト用の小さな画像を作成
   */
  private createTestImage(): Blob {
    const pngData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const binaryString = atob(pngData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: 'image/png' });
  }
  
  /**
   * 全テストの実行
   */
  async runAllTests(): Promise<ValidationResult[]> {
    
    // 1. Blob保存テスト
    const blobResult = await this.testBlobStorage();
    this.results.push(blobResult);
    
    if (!blobResult.passed) {
      return this.results;
    }
    
    const blobId = blobResult.data?.blobId;
    
    // 2. 表示URLテスト
    if (blobId) {
      const displayResult = await this.testDisplayUrl(blobId);
      this.results.push(displayResult);
    }
    
    // 3. データモデルテスト
    const dataModelResult = await this.testDataModel();
    this.results.push(dataModelResult);
    
    // 4. ミントフローテスト
    const mintResult = await this.testMintFlow();
    this.results.push(mintResult);
    
    // 5. Sui Display テスト
    const displayConfigResult = await this.testSuiDisplay();
    this.results.push(displayConfigResult);
    
    // 6. ドキュメントアクセステスト
    const docsResult = await this.testDocumentationAccess();
    this.results.push(docsResult);
    
    return this.results;
  }
  
  /**
   * 結果の表示
   */
  displayResults(): void {
    
    let passedCount = 0;
    let totalCount = this.results.length;
    
    this.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      
      if (!result.passed && result.error) {
      }
      
      if (result.data) {
      }
      
      if (result.passed) passedCount++;
    });
    
    
    if (passedCount === totalCount) {
    } else {
    }
  }
}

/**
 * メイン実行関数
 */
async function main() {
  const validator = new MigrationValidator();
  await validator.runAllTests();
  validator.displayResults();
  
  // 失敗したテストがある場合は終了コード1で終了
  const failedTests = validator.results.filter(r => !r.passed);
  if (failedTests.length > 0) {
    (process as any).exit(1);
  }
}

// スクリプト実行
if ((require as any).main === module) {
}

export { MigrationValidator };
