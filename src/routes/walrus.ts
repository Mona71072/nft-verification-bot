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
  rateLimitMiddleware(10), // 10 requests per minute
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
    
    // FormDataから画像ファイルを取得
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }

    // ファイルサイズチェック
    validateFileSize(file);

    // MIMEタイプ検証
    if (!validateImageMimeType(file.type)) {
      return c.json({ success: false, error: 'Invalid file type. Only images are allowed.' }, 400);
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

    // Walrusに保存
    const result = await storeBlob(file, options, config);

    return c.json({
      success: true,
      data: {
        blobId: result.blobId,
        contentType: file.type,
        size: file.size,
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
    
    return c.json({
      success: true,
      data: {
        publisherBase: config.publisherBase,
        aggregatorBase: config.aggregatorBase,
        defaultEpochs: config.defaultEpochs,
        defaultPermanent: config.defaultPermanent,
        uploadEnabled: true
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
 * Walrus診断エンドポイント（Publisher/Aggregator疎通確認）
 * GET /api/walrus/diagnose
 * Workerから直接Publisher/Aggregatorにアクセスして疎通を確認
 */
app.get('/api/walrus/diagnose', async (c) => {
  try {
    const config = getWalrusConfig(c.env);
    const result: Record<string, any> = {
      config: {
        publisherBase: config.publisherBase,
        aggregatorBase: config.aggregatorBase,
        defaultEpochs: config.defaultEpochs
      }
    };

    // Aggregatorの疎通確認（存在しないblobIdでHEAD）
    try {
      const aggregatorUrl = `${config.aggregatorBase}/v1/blobs/does-not-exist-test`;
      const aggregatorRes = await fetch(aggregatorUrl, { method: 'HEAD' });
      result.aggregator = {
        ok: true,
        url: aggregatorUrl,
        status: aggregatorRes.status,
        statusText: aggregatorRes.statusText,
        reachable: true
      };
    } catch (e: any) {
      result.aggregator = {
        ok: false,
        error: e?.message || String(e),
        name: e?.name,
        cause: e?.cause,
        reachable: false
      };
    }

    // Publisherの疎通確認（/v1/healthまたはオプションエンドポイント）
    try {
      // まずはベースURLへのGETで到達性を確認
      const publisherUrl = `${config.publisherBase}/v1/blobs`; // OPTIONSかGETで確認
      const publisherRes = await fetch(publisherUrl, { method: 'OPTIONS' });
      result.publisher = {
        ok: true,
        url: publisherUrl,
        status: publisherRes.status,
        statusText: publisherRes.statusText,
        reachable: true
      };
    } catch (e: any) {
      result.publisher = {
        ok: false,
        error: e?.message || String(e),
        name: e?.name,
        cause: e?.cause,
        reachable: false
      };
    }

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
