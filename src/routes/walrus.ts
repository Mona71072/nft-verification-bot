/**
 * Walrus.pdf 準拠の画像ストレージAPI
 * Publisher/Aggregator API を直接使用し、中継処理を最小化
 */

import { Hono } from 'hono';
import { storeBlob, fetchBlob, getWalrusConfig, validateFileSize, validateImageMimeType } from '../services/walrus';
import { logError } from '../utils/logger';
import { rateLimitMiddleware, securityCorsMiddleware, securityHeadersMiddleware, fileSizeLimitMiddleware, publicStorageWarningMiddleware } from '../middleware/security';

const app = new Hono();

// セキュリティミドルウェアの適用
app.use('/api/walrus/store', 
  rateLimitMiddleware(60), // 60 requests per minute（開発・テスト用に緩和）
  securityCorsMiddleware(),
  securityHeadersMiddleware(),
  fileSizeLimitMiddleware(),
  publicStorageWarningMiddleware()
);

/**
 * 画像をWalrusに保存
 * POST /api/walrus/store
 * Content-Type: multipart/form-data
 * Body: file (画像ファイル)
 * Query: epochs?, permanent?, deletable?
 * 
 * PDF準拠: 必ず寿命指定を明示（v1.33以降の既定がdeletableのため）
 */
app.post('/api/walrus/store', async (c) => {
  try {
    const config = getWalrusConfig(c.env);
    
    // Publisher未設定チェック（Mainnet対応）
    if (!config.publisherBase) {
      return c.json({ 
        success: false, 
        error: 'Walrus Publisher is not configured. Upload is disabled on Mainnet until a Publisher is set up.',
        code: 'PUBLISHER_NOT_CONFIGURED'
      }, 503);
    }
    
    // Content-Typeに応じてバイト列とMIMEタイプを取得
    const ct = c.req.header('content-type') || '';
    let bytes: ArrayBuffer;
    let mimeType = 'application/octet-stream';
    let fileSize = 0;
    
    if (ct.startsWith('multipart/form-data')) {
      // multipart/form-data: フロントからのForm送信
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return c.json({ success: false, error: 'No file provided' }, 400);
      }
      
      bytes = await file.arrayBuffer();
      mimeType = file.type || mimeType;
      fileSize = file.size;
      
      // ファイルサイズチェック
      if (fileSize > 1024 * 1024) {
        return c.json({ 
          success: false, 
          error: `File size too large: ${Math.round(fileSize / 1024)}KB > 1MB. Please compress the image.` 
        }, 400);
      }
      
      // MIMEタイプ検証
      if (!validateImageMimeType(mimeType)) {
        return c.json({ success: false, error: 'Invalid file type. Only images are allowed.' }, 400);
      }
    } else {
      // application/octet-stream: 直接バイナリ送信
      bytes = await c.req.arrayBuffer();
      mimeType = ct || mimeType;
      fileSize = bytes.byteLength;
      
      // ファイルサイズチェック
      if (fileSize > 1024 * 1024) {
        return c.json({ 
          success: false, 
          error: `File size too large: ${Math.round(fileSize / 1024)}KB > 1MB` 
        }, 400);
      }
    }

    // 保存オプションの取得（PDF準拠: 必ず寿命指定を明示）
    const url = new URL(c.req.url);
    const epochs = url.searchParams.get('epochs');
    const permanent = url.searchParams.get('permanent');
    const deletable = url.searchParams.get('deletable');

    const options: any = {};
    if (epochs) {
      options.epochs = epochs === 'max' ? 'max' : parseInt(epochs, 10);
    } else if (permanent === 'true') {
      options.permanent = true;
    } else if (deletable === 'true') {
      options.deletable = true;
    } else {
      // デフォルトで明示的な寿命指定（v1.33以降の既定がdeletableのため）
      options.epochs = config.defaultEpochs;
    }

    // Walrus Publisherに保存（PDF準拠: PUT + application/octet-stream）
    const result = await storeBlob(new Uint8Array(bytes), options, config);

    return c.json({
      success: true,
      data: {
        blobId: result.blobId,
        contentType: mimeType,
        size: fileSize,
        newlyCreated: result.newlyCreated
      }
    });

  } catch (error: any) {
    logError('Walrus store API error', error);
    return c.json({ 
      success: false, 
      error: error?.message || 'Failed to store image',
      errorName: error?.name,
      errorCause: error?.cause,
      details: {
        name: error?.name,
        message: error?.message,
        cause: error?.cause ? String(error.cause) : undefined
      }
    }, 500);
  }
});

/**
 * 画像をWalrusから取得（プロキシ）
 * GET /walrus/blobs/:blobId
 * 
 * PDF準拠: Aggregator API 経由の公開読み出し（表示URLの正道）
 */
app.get('/walrus/blobs/:blobId', 
  securityHeadersMiddleware(),
  async (c) => {
  try {
    const config = getWalrusConfig(c.env);
    const blobId = c.req.param('blobId');
    
    if (!blobId) {
      return c.json({ success: false, error: 'Blob ID is required' }, 400);
    }

    // Walrusから画像を取得
    const response = await fetchBlob(blobId, config);

    // レスポンスヘッダーを設定
    const headers = new Headers();
    const contentType = response.headers.get('content-type');
    if (contentType) {
      headers.set('content-type', contentType);
    }
    
    // キャッシュ設定（CDN用）
    headers.set('Cache-Control', 'public, max-age=3600'); // 1時間
    headers.set('ETag', `"${blobId}"`);

    return new Response(response.body, {
      status: 200,
      headers
    });

  } catch (error: any) {
    logError('Walrus proxy error', error);
    
    if (error?.message?.includes('404') || error?.message?.includes('Not Found')) {
      return c.json({ success: false, error: 'Image not found' }, 404);
    }
    
    return c.json({ 
      success: false, 
      error: error?.message || 'Failed to fetch image' 
    }, 500);
  }
});

/**
 * Walrus設定取得
 * GET /api/walrus/config
 */
app.get('/api/walrus/config', async (c) => {
  try {
    const config = getWalrusConfig(c.env);
    
    // Publisher設定チェック（Mainnet対応）
    const uploadEnabled = !!config.publisherBase;
    
    return c.json({
      success: true,
      data: {
        publisherBase: config.publisherBase || '(not configured)',
        aggregatorBase: config.aggregatorBase,
        defaultEpochs: config.defaultEpochs,
        defaultPermanent: config.defaultPermanent,
        uploadEnabled: uploadEnabled,
        notice: uploadEnabled ? null : 'Upload is disabled. Publisher must be configured for Mainnet.'
      }
    });

  } catch (error: any) {
    logError('Walrus config error', error);
    return c.json({ 
      success: false, 
      error: error?.message || 'Failed to get Walrus config' 
    }, 500);
  }
});

/**
 * Walrus診断エンドポイント（Publisher/Aggregator疎通確認 + DNS解決）
 * GET /api/walrus/diagnose
 * Workerから直接Publisher/Aggregatorにアクセスして疎通を確認
 * DoHでDNS解決も確認し、530/1016エラーの真因を特定
 */
app.get('/api/walrus/diagnose', async (c) => {
  try {
    const config = getWalrusConfig(c.env);
    const result: Record<string, any> = {
      config: {
        publisherBase: config.publisherBase || '(not configured)',
        aggregatorBase: config.aggregatorBase,
        defaultEpochs: config.defaultEpochs
      },
      timestamp: new Date().toISOString()
    };

    // Publisher未設定チェック
    if (!config.publisherBase) {
      result.health = {
        aggregator: 'unknown',
        publisher: 'not_configured',
        overall: 'degraded',
        canRead: true,
        canWrite: false,
        notice: 'Publisher is not configured. Upload is disabled on Mainnet.'
      };
      
      return c.json({
        success: true,
        data: result,
        message: 'Walrus診断完了（Publisher未設定）'
      });
    }

    // DoH (DNS over HTTPS) でDNSレコード確認
    const dohQuery = async (host: string) => {
      try {
        const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`;
        const res = await fetch(url, { headers: { accept: 'application/dns-json' } });
        if (!res.ok) return { ok: false, status: res.status };
        return await res.json();
      } catch (e: any) {
        return { ok: false, error: e?.message || String(e) };
      }
    };

    const publisherHost = new URL(config.publisherBase).host;
    const aggregatorHost = new URL(config.aggregatorBase).host;

    result.dns = {
      publisherA: await dohQuery(publisherHost),
      aggregatorA: await dohQuery(aggregatorHost)
    };

    // HTTP到達性確認（HEAD/GET）
    const probe = async (url: string, method: 'HEAD' | 'GET' = 'HEAD') => {
      try {
        const res = await fetch(url, { method });
        return { 
          ok: res.ok, 
          status: res.status, 
          statusText: res.statusText,
          reachable: true
        };
      } catch (e: any) {
        return { 
          ok: false, 
          error: e?.message || String(e),
          name: e?.name,
          cause: e?.cause ? String(e.cause) : undefined,
          reachable: false
        };
      }
    };

    result.probe = {
      aggregator: await probe(`${config.aggregatorBase}/v1/blobs/does-not-exist-test`, 'HEAD'),
      publisher: await probe(`${config.publisherBase}/v1/blobs`, 'GET')
    };

    // ヘルスステータスの判定
    const aggregatorHealthy = result.probe.aggregator.reachable && result.probe.aggregator.status !== 530;
    const publisherHealthy = result.probe.publisher.reachable && result.probe.publisher.status !== 530;

    result.health = {
      aggregator: aggregatorHealthy ? 'healthy' : 'unhealthy',
      publisher: publisherHealthy ? 'healthy' : 'unhealthy',
      overall: (aggregatorHealthy && publisherHealthy) ? 'healthy' : 
               (aggregatorHealthy && !publisherHealthy) ? 'degraded' : 'unhealthy',
      canRead: aggregatorHealthy,
      canWrite: publisherHealthy
    };

    return c.json({
      success: true,
      data: result,
      message: 'Walrus疎通診断完了'
    });

  } catch (error: any) {
    logError('Walrus diagnose error', error);
    return c.json({ 
      success: false, 
      error: error?.message || 'Failed to diagnose Walrus connectivity',
      name: error?.name,
      cause: error?.cause
    }, 500);
  }
});

export default app;
