/**
 * JWT署名ユーティリティ（Cloudflare Workers対応）
 * HS256（HMAC-SHA256）での署名をサポート
 */

/**
 * HS256でJWTを署名
 * @param payload JWTペイロード
 * @param secret 共有秘密鍵
 * @returns 署名されたJWT文字列
 */
export async function signHS256(payload: Record<string, any>, secret: string): Promise<string> {
  const enc = new TextEncoder();
  
  // Base64url エンコード
  const base64url = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  // JWTヘッダー
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(enc.encode(JSON.stringify(header)).buffer);
  
  // JWTペイロード
  const encodedPayload = base64url(enc.encode(JSON.stringify(payload)).buffer);
  
  // 署名対象データ
  const data = `${encodedHeader}.${encodedPayload}`;

  // HMAC-SHA256で署名
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const encodedSignature = base64url(signature);

  // 完成したJWT
  return `${data}.${encodedSignature}`;
}

/**
 * Walrus Publisher用のJWTを生成
 * @param options JWT生成オプション
 * @param secret 共有秘密鍵
 * @returns 署名されたJWT
 */
export async function createPublisherJWT(
  options: {
    subject?: string;
    expiresIn?: number; // 秒数（デフォルト180秒）
    maxSize?: number;
    maxEpochs?: number;
  },
  secret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    sub: options.subject || 'worker-upload',
    exp: now + (options.expiresIn || 180), // デフォルト3分
    jti: crypto.randomUUID(), // リプレイ防止
    iat: now,
    ...(options.maxSize && { max_size: options.maxSize }),
    ...(options.maxEpochs && { max_epochs: options.maxEpochs })
  };

  return signHS256(payload, secret);
}

