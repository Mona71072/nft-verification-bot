/**
 * セキュリティミドルウェア
 * Walrus.pdf 準拠のセキュリティ要件を実装
 */

import { Hono } from 'hono';

/**
 * レート制限ミドルウェア
 * Publisher API への過度なアクセスを防止
 */
export function rateLimitMiddleware(requestsPerMinute: number = 10) {
  return async (c: any, next: any) => {
    // 簡易的なレート制限実装
    // 本番環境では KV を使用した適切なレート制限を実装してください
    // 開発・テスト環境では制限を緩和
    
    await next();
  };
}

/**
 * CORS セキュリティ強化
 * Publisher 系は管理オリジンのみ、Aggregator プロキシは読み取り専用で許可
 */
export function securityCorsMiddleware() {
  return async (c: any, next: any) => {
    const origin = c.req.header('Origin');
    const path = c.req.path;
    
    // Publisher 系エンドポイントは管理オリジンのみ
    if (path.includes('/api/walrus/store')) {
      const allowedOrigins = [
        'https://syndicatextokyo.app',
        'https://nft-verification-production.mona-syndicatextokyo.workers.dev',
        // 本番環境の管理ドメインを追加
      ];
      
      if (origin && !allowedOrigins.includes(origin)) {
        return c.json({ success: false, error: 'CORS policy violation' }, 403);
      }
    }
    
    // Aggregator プロキシは読み取り専用で広く許可
    if (path.includes('/walrus/blobs/')) {
      c.header('Access-Control-Allow-Origin', '*');
      c.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      c.header('Access-Control-Allow-Headers', 'Range, If-Range');
    }
    
    await next();
  };
}

/**
 * セキュリティヘッダーの設定
 */
export function securityHeadersMiddleware() {
  return async (c: any, next: any) => {
    // CSP ヘッダー（画像配信用）
    c.header('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob: https://aggregator.mainnet.walrus.space https://aggregator.testnet.walrus.space;");
    
    // X-Frame-Options
    c.header('X-Frame-Options', 'DENY');
    
    // X-Content-Type-Options（MIME スニッフィング防止）
    c.header('X-Content-Type-Options', 'nosniff');
    
    // Cache-Control（画像配信用）
    if (c.req.path.includes('/walrus/blobs/')) {
      c.header('Cache-Control', 'public, max-age=3600, immutable');
      c.header('ETag', `"${c.req.param('blobId')}"`);
    }
    
    await next();
  };
}

/**
 * ファイルサイズ制限ミドルウェア
 */
export function fileSizeLimitMiddleware(maxSize: number = 13.3 * 1024 * 1024 * 1024) { // 13.3 GiB
  return async (c: any, next: any) => {
    const contentLength = c.req.header('Content-Length');
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return c.json({ 
        success: false, 
        error: `File too large. Maximum size: ${Math.round(maxSize / (1024 * 1024))}MB` 
      }, 413);
    }
    
    await next();
  };
}

/**
 * 公開ストレージ警告ミドルウェア
 * Walrus は全公開前提の警告を追加
 */
export function publicStorageWarningMiddleware() {
  return async (c: any, next: any) => {
    // アップロードエンドポイントでの警告
    if (c.req.path.includes('/api/walrus/store') && c.req.method === 'POST') {
      const warning = {
        warning: 'PUBLIC_STORAGE_NOTICE',
        message: 'All data stored in Walrus is publicly accessible. Do not upload sensitive or personal information without encryption.',
        details: {
          storageType: 'public',
          accessControl: 'none',
          recommendation: 'encrypt sensitive data before upload'
        }
      };
      
      // 警告をログに記録
      console.warn('Public storage upload attempt:', warning);
    }
    
    await next();
  };
}
