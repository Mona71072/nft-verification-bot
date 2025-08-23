import { Hono, Context } from 'hono';
import * as ed25519 from '@noble/ed25519';
import { blake2b } from '@noble/hashes/blake2b';
import { sha512 } from '@noble/hashes/sha512';

// noble-ed25519 が内部で使用する SHA-512 を設定（Workers環境向け）
// import への代入は禁止されているため、既存プロパティに限定してセット
{
  const edAny: any = ed25519 as any;
  if (edAny && edAny.etc && typeof edAny.etc.sha512Sync !== 'function') {
    edAny.etc.sha512Sync = (msg: Uint8Array) => sha512(msg);
  }
}

// NFTコレクション型定義
interface NFTCollection {
  id: string;
  name: string;
  packageId: string;
  roleId: string;
  roleName: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

// Cloudflare Workers環境の型定義
interface Env {
  NONCE_STORE: KVNamespace;
  COLLECTION_STORE: KVNamespace;
  DM_TEMPLATE_STORE?: KVNamespace;
  NFT_COLLECTION_ID: string;
  DISCORD_BOT_API_URL: string;
  [key: string]: any;
}

// 統一ログ関数
function logInfo(message: string, data?: any): void {
  console.log(`ℹ️ ${message}`, data || '');
}

function logError(message: string, error?: any): void {
  console.error(`❌ ${message}`, error || '');
}

function logSuccess(message: string, data?: any): void {
  console.log(`✅ ${message}`, data || '');
}

function logWarning(message: string, data?: any): void {
  console.warn(`⚠️ ${message}`, data || '');
}

function logDebug(message: string, data?: any): void {
  console.log(`🔍 ${message}`, data || '');
}

const app = new Hono<{ Bindings: Env }>();

// カスタムCORSミドルウェア
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  const method = c.req.method;
  
  logInfo('CORS MIDDLEWARE');
  console.log('Origin:', origin);
  console.log('Method:', method);
  console.log('URL:', c.req.url);
  console.log('User-Agent:', c.req.header('User-Agent'));
  
  // すべてのレスポンスにCORSヘッダーを設定
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Admin-Address, X-API-Key');
  c.header('Access-Control-Max-Age', '86400');
  c.header('Vary', 'Origin');
  
  // OPTIONSリクエストの場合は即座にレスポンス
  if (method === 'OPTIONS') {
    logInfo('OPTIONS request handled by middleware');
    return new Response('', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Admin-Address, X-API-Key',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
      }
    });
  }
  
  await next();
});

// ヘルスチェック
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    message: 'NFT Verification API',
    timestamp: new Date().toISOString()
  });
});

// ================
// 署名検証ヘルパー
// ================
// Suietの signPersonalMessage の返値フォーマット例:
// {
//   signature: Base64 or Uint8Array,
//   bytes: Uint8Array (署名対象),
//   publicKey?: Base64 or Uint8Array
// }
function fromBase64(base64: string): Uint8Array {
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function toUint8Array(input: any): Uint8Array | null {
  try {
    if (!input) return null;
    if (input instanceof Uint8Array) return input;
    if (Array.isArray(input)) return new Uint8Array(input);
    if (typeof input === 'string') return fromBase64(input);
    if (typeof input === 'object') {
      // 数値キーを昇順で取り出してUint8Arrayへ（JSON化されたTypedArray対策）
      const keys = Object.keys(input).filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
      if (keys.length > 0) {
        const values = keys.map(k => input[k] as number);
        return new Uint8Array(values);
      }
    }
    return null;
  } catch {
    return null;
  }
}

// BCS: ULEB128 で長さをエンコード（vector<u8> のプレフィックス用）
function encodeUleb128(value: number): Uint8Array {
  const out: number[] = [];
  let v = value >>> 0; // ensure unsigned
  do {
    let byte = v & 0x7f;
    v >>>= 7;
    if (v !== 0) byte |= 0x80;
    out.push(byte);
  } while (v !== 0);
  return new Uint8Array(out);
}

interface SignatureData {
  signature: string | Uint8Array;
  bytes: string | Uint8Array;
  publicKey?: string | Uint8Array;
}

async function verifySignedMessage(signatureData: SignatureData, expectedMessageBytes: Uint8Array | null): Promise<boolean> {
  try {
    // スラッシュウォレット対応: ウォレットから送信されたbytesを直接使用
    const { signature, bytes, publicKey } = signatureData ?? {};

    if (!signature || !bytes) {
      logError('Missing signature or bytes');
      return false;
    }

    // ウォレットから送信されたbytesを直接使用
    const receivedDecoded = toUint8Array(bytes);
    if (!receivedDecoded) {
      logError('Invalid bytes payload');
      return false;
    }

    // 追加候補: bytesがBase64文字列そのもののASCIIとして署名されている可能性
    let receivedAscii: Uint8Array | null = null;
    if (typeof bytes === 'string') {
      try {
        receivedAscii = new TextEncoder().encode(bytes);
      } catch {}
    }

    // 署名検証で試すメッセージ候補（優先順）
    const candidateMessages: Array<{ name: string; data: Uint8Array }> = [];
    if (expectedMessageBytes) candidateMessages.push({ name: 'expectedBytes', data: expectedMessageBytes });
    candidateMessages.push({ name: 'receivedDecoded', data: receivedDecoded });
    if (receivedAscii) candidateMessages.push({ name: 'receivedAscii', data: receivedAscii });

    // 署名・公開鍵の抽出（スラッシュウォレット対応）
    const rawSig = toUint8Array(signature);
    if (!rawSig || !(rawSig instanceof Uint8Array)) {
      logError('Invalid signature format');
      return false;
    }

    console.log(`Raw signature (first 16): ${Array.from(rawSig.slice(0, 16))}`);

    let sigBytes: Uint8Array | null = null;
    let pubBytes: Uint8Array | null = null;

    // 優先: body.publicKey を利用（32 or 33bytes想定）
    if (publicKey) {
      const pk = toUint8Array(publicKey);
      if (pk) {
        console.log(`Public key length: ${pk.length}`);
        // 先頭1バイトがスキームの場合(33bytes) → 取り除く
        pubBytes = pk.length === 33 ? pk.slice(1) : pk;
      }
    }

    // ケース1: 純粋な64byte署名（publicKeyは別途提供される必要あり）
    if (rawSig.length === 64) {
      if (!pubBytes) {
        console.error('64-byte signature provided but publicKey is missing');
        return false;
      }
      sigBytes = rawSig;
    }

    // ケース2: scheme(1)+signature(64) の65byte（publicKeyは別途提供される必要あり）
    if (!sigBytes && rawSig.length === 65) {
      const scheme = rawSig[0];
      if (scheme !== 0x00) {
        console.error(`Unsupported signature scheme for 65-byte sig: ${scheme}`);
        return false;
      }
      if (!pubBytes) {
        console.error('65-byte (scheme+sig) provided but publicKey is missing');
        return false;
      }
      sigBytes = rawSig.slice(1, 65);
    }

    // ケース3: SerializedSignature (scheme(1)+signature(64)+publicKey(32 or 33))
    if (!sigBytes && rawSig.length >= 1 + 64 + 32) {
      const scheme = rawSig[0];
      console.log(`SerializedSignature scheme: ${scheme} (0x${scheme.toString(16)})`);
      
      // 0x00: Ed25519 / 0x01: Secp256k1 / 0x02: Secp256r1
      if (scheme !== 0x00) {
        console.error(`Unsupported signature scheme: ${scheme}`);
        return false;
      }
      sigBytes = rawSig.slice(1, 65);
      const extractedPubAll = rawSig.slice(65);
      console.log(`Extracted signature length: ${sigBytes.length}`);
      console.log(`Extracted public key length: ${extractedPubAll.length}`);
      
      // 署名内の公開鍵を優先使用（スラッシュウォレット対応）
      if (extractedPubAll.length === 33) {
        pubBytes = extractedPubAll.slice(1);
      } else if (extractedPubAll.length === 32) {
        pubBytes = extractedPubAll;
      } else {
        console.error(`Unexpected public key length in serialized signature: ${extractedPubAll.length}`);
        return false;
      }
    }

    // ケース4: スラッシュウォレット形式（88文字Base64 = 66バイト）
    if (!sigBytes && rawSig.length === 66) {
      console.log('Detected Slash wallet signature format (66 bytes)');
      
      // スラッシュウォレットの署名形式を試行
      // パターン1: 先頭2バイトがスキーム、残り64バイトが署名
      const scheme1 = rawSig[0];
      const scheme2 = rawSig[1];
      console.log(`Scheme bytes: [${scheme1}, ${scheme2}]`);
      
      if (scheme1 === 0x00 && scheme2 === 0x00) {
        sigBytes = rawSig.slice(2, 66); // 2バイトスキーム + 64バイト署名
      } else if (scheme1 === 0x00) {
        sigBytes = rawSig.slice(1, 65); // 1バイトスキーム + 64バイト署名
      } else {
        sigBytes = rawSig.slice(0, 64); // 先頭64バイトを署名として使用
      }
    }

    if (!sigBytes || !pubBytes || pubBytes.length !== 32) {
      console.error(`Failed to extract signature/publicKey for Ed25519 verification (sigBytes? ${!!sigBytes}, pubBytesLen=${pubBytes?.length || 0}, rawSigLen=${rawSig?.length || 0})`);
      return false;
    }

    // 各候補メッセージに対して、複数モードで検証
    for (const candidate of candidateMessages) {
      const messageBytes = candidate.data;

      // まずは素のメッセージに対して検証
      let ok = await ed25519.verify(sigBytes, messageBytes, pubBytes);
      if (ok) {
        console.log(`Ed25519 verification succeeded (raw mode, candidate=${candidate.name})`);
        return true;
      }

      // フォールバック1: Intent + BCS + blake2b-256
      const intent = new Uint8Array([0, 0, 0]);
      const lenPrefix = encodeUleb128(messageBytes.length);
      const bcsMessage = new Uint8Array(lenPrefix.length + messageBytes.length);
      bcsMessage.set(lenPrefix, 0);
      bcsMessage.set(messageBytes, lenPrefix.length);
      let intentMessage = new Uint8Array(intent.length + bcsMessage.length);
      intentMessage.set(intent, 0);
      intentMessage.set(bcsMessage, intent.length);
      let digest = blake2b(intentMessage, { dkLen: 32 });
      ok = await ed25519.verify(sigBytes, digest, pubBytes);
      if (ok) {
        console.log(`Ed25519 verification succeeded (intent+BCS mode, candidate=${candidate.name})`);
        return true;
      }

      // フォールバック2: Intentのみ + blake2b-256
      intentMessage = new Uint8Array(intent.length + messageBytes.length);
      intentMessage.set(intent, 0);
      intentMessage.set(messageBytes, intent.length);
      digest = blake2b(intentMessage, { dkLen: 32 });
      ok = await ed25519.verify(sigBytes, digest, pubBytes);
      if (ok) {
        console.log(`Ed25519 verification succeeded (intent-only mode, candidate=${candidate.name})`);
        return true;
      }

      // フォールバック3: blake2b-256(message) のみ
      digest = blake2b(messageBytes, { dkLen: 32 });
      ok = await ed25519.verify(sigBytes, digest, pubBytes);
      if (ok) {
        console.log(`Ed25519 verification succeeded (blake2b-only mode, candidate=${candidate.name})`);
        return true;
      }
    }

    console.error('Ed25519 verification failed for all candidates and modes');
    return false;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// ランダムトークン生成（英数字）
function generateRandomToken(length = 48): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Admin用Bearerトークン検証
type AdminTokenStatus =
  | { ok: true; address: string }
  | { ok: false; reason: 'missing_header' | 'bad_format' | 'missing_token' | 'not_found' | 'expired' | 'not_admin' | 'invalid_payload' | 'fallback_header_missing' | 'fallback_not_admin' };

async function verifyAdminToken(c: Context<{ Bindings: Env }>): Promise<AdminTokenStatus> {
  try {
    const auth = c.req.header('Authorization') || '';
    if (!auth) {
      // フォールバック: X-Admin-Address ヘッダーが管理者なら通す（暫定）
      const fallbackAddr = c.req.header('X-Admin-Address');
      if (!fallbackAddr) return { ok: false, reason: 'fallback_header_missing' };
      const isAdminUser = await isAdmin(c, fallbackAddr);
      if (!isAdminUser) return { ok: false, reason: 'fallback_not_admin' };
      return { ok: true, address: fallbackAddr };
    }
    if (!auth.startsWith('Bearer ')) return { ok: false, reason: 'bad_format' };
    const token = auth.slice('Bearer '.length).trim();
    if (!token) return { ok: false, reason: 'missing_token' };
    const stored = await c.env.COLLECTION_STORE.get(ADMIN_TOKEN_PREFIX + token);
    if (!stored) return { ok: false, reason: 'not_found' };
    let payload: any;
    try { payload = JSON.parse(stored); } catch { return { ok: false, reason: 'invalid_payload' }; }
    const { address, expiresAt } = payload || {};
    if (!address) return { ok: false, reason: 'invalid_payload' };
    if (expiresAt && Date.now() > expiresAt) return { ok: false, reason: 'expired' };
    const isAdminUser = await isAdmin(c, address);
    if (!isAdminUser) return { ok: false, reason: 'not_admin' };
    return { ok: true, address };
  } catch {
    return { ok: false, reason: 'invalid_payload' };
  }
}

// ナンス検証関数
function validateNonce(nonce: string, storedNonceData: any): boolean {
  try {
    const now = Date.now();
    return storedNonceData.nonce === nonce && now < storedNonceData.expiresAt;
  } catch (error) {
    console.error('Nonce validation error:', error);
    return false;
  }
}

// ================
// Sui RPC ヘルパー
// ================
async function rpcCall<T = any>(rpcUrl: string, body: any, timeoutMs = 30000): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    return await res.json() as T;
  } finally {
    clearTimeout(id);
  }
}

// NFT保有確認関数
async function hasTargetNft(address: string, collectionId: string): Promise<boolean> {
  try {
    const suiRpcUrl = 'https://fullnode.mainnet.sui.io:443';
    
    console.log(`Checking NFT ownership for address: ${address}, collection: ${collectionId}`);
    
    // 先に軽量な直接所有チェック（ページネーション + タイムアウト + 早期終了）
    try {
      let directCursor: any = null;
      for (let page = 0; page < 5; page++) {
        const directData = await rpcCall<any>(suiRpcUrl, {
          jsonrpc: '2.0',
          id: 100,
          method: 'suix_getOwnedObjects',
          params: [
            address,
            { filter: { StructType: collectionId }, options: { showType: true } },
            directCursor,
            50
          ]
        }, 30000); // タイムアウトを30秒に延長
        const dataArr = directData.result?.data ?? [];
        if (dataArr.length > 0) {
          console.log(`✅ Direct NFTs found (fast path): ${dataArr.length} for ${address} in ${collectionId}`);
          return true;
        }
        directCursor = directData.result?.nextCursor ?? null;
        if (!directCursor) break;
      }
    } catch (fastErr) {
      console.log('Fast direct ownership check failed, falling back:', fastErr);
    }
    
    // 方法1: 直接所有されているNFTを確認（タイムアウト延長）
    const directResponse = await fetch(`${suiRpcUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'suix_getOwnedObjects',
        params: [
          address,
          {
            filter: {
              StructType: collectionId
            }
          },
          null,
          null,
          true
        ]
      })
    });
    
    if (!directResponse.ok) {
      throw new Error(`Sui API request failed: ${directResponse.status} ${directResponse.statusText}`);
    }
    
    const directData = await directResponse.json() as any;
    console.log(`📥 Direct ownership Sui API response:`, JSON.stringify(directData, null, 2));
    
    const hasDirectNft = directData.result && directData.result.data && directData.result.data.length > 0;
    
    if (hasDirectNft) {
      console.log(`✅ Direct NFTs found: ${directData.result.data.length} NFTs for address ${address} in collection ${collectionId}`);
      return true;
    }
    
    // 方法2: 間接的に所有されているNFTを確認（オブジェクトを介して管理されている場合）
    console.log(`🔍 Checking indirect ownership for address: ${address}`);
    
    // アドレスが所有しているすべてのオブジェクトを取得（タイムアウト延長）
    const allObjectsResponse = await fetch(`${suiRpcUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'suix_getOwnedObjects',
        params: [
          address,
          null,
          null,
          null,
          true
        ]
      })
    });
    
    if (!allObjectsResponse.ok) {
      throw new Error(`Sui API request failed: ${allObjectsResponse.status} ${allObjectsResponse.statusText}`);
    }
    
    const allObjectsData = await allObjectsResponse.json() as any;
    console.log(`📥 All objects response:`, JSON.stringify(allObjectsData, null, 2));
    
    if (allObjectsData.result && allObjectsData.result.data) {
      // 各オブジェクトの詳細を確認して、間接的に所有されているNFTを検索
      for (const obj of allObjectsData.result.data) {
        if (obj.data && obj.data.objectId) {
          try {
            const objDetailResponse = await fetch(`${suiRpcUrl}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 3,
                method: 'sui_getObject',
                params: [
                  obj.data.objectId,
                  {
                    showType: true,
                    showContent: true,
                    showOwner: true
                  }
                ]
              })
            });
            
            if (!objDetailResponse.ok) {
              console.log(`⚠️ Failed to fetch object ${obj.data.objectId}: ${objDetailResponse.status}`);
              continue;
            }
            
            const objDetail = await objDetailResponse.json() as any;
            console.log(`🔍 Object ${obj.data.objectId} type:`, objDetail.result?.data?.type);
            
            // オブジェクトが指定されたコレクションのNFTを所有しているかチェック
            if (objDetail.result?.data?.type === collectionId) {
              console.log(`✅ Indirect NFT found: ${obj.data.objectId} is a ${collectionId} NFT`);
              return true;
            }
            
            // PersonalKioskCapオブジェクトの場合、そのKioskが所有するNFTをチェック
            if (objDetail.result?.data?.type === '0x0cb4bcc0560340eb1a1b929cabe56b33fc6449820ec8c1980d69bb98b649b802::personal_kiosk::PersonalKioskCap') {
              console.log(`🔍 Found PersonalKioskCap: ${obj.data.objectId}, checking for Kiosk...`);
              
              try {
                // PersonalKioskCapの内容を確認
                const capContent = objDetail.result?.data?.content?.fields;
                console.log(`📋 PersonalKioskCap content:`, JSON.stringify(capContent, null, 2));
                
                // PersonalKioskCapからKioskのIDを直接取得
                const kioskId = capContent.cap.fields.for;
                console.log(`🔍 Kiosk ID from PersonalKioskCap: ${kioskId}`);
                
                // Kiosk内のアイテムを検索（タイムアウト延長）
                const kioskItemsResponse = await fetch(`${suiRpcUrl}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 6,
                    method: 'suix_getDynamicFields',
                    params: [
                      kioskId,
                      null,
                      null,
                      null
                    ]
                  })
                });
                
                const kioskItemsData = await kioskItemsResponse.json() as any;
                console.log(`📥 Kiosk items response:`, JSON.stringify(kioskItemsData, null, 2));
                
                if (kioskItemsData.result && kioskItemsData.result.data) {
                  // Kiosk内のアイテムをチェック
                  for (const item of kioskItemsData.result.data) {
                    try {
                      // アイテムの詳細を取得
                      const itemDetailResponse = await fetch(`${suiRpcUrl}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          jsonrpc: '2.0',
                          id: 7,
                          method: 'sui_getObject',
                          params: [
                            item.objectId,
                            {
                              showType: true,
                              showContent: true,
                              showOwner: true
                            }
                          ]
                        })
                      });
                      
                      const itemDetail = await itemDetailResponse.json() as any;
                      console.log(`🔍 Kiosk item ${item.objectId} type:`, itemDetail.result?.data?.type);
                      
                      if (itemDetail.result?.data?.type === collectionId) {
                        console.log(`✅ Found NFT in Kiosk: ${item.objectId} is a ${collectionId} NFT`);
                        return true;
                      }
                    } catch (itemError) {
                      console.log(`⚠️ Error checking Kiosk item ${item.objectId}:`, itemError);
                      continue;
                    }
                  }
                }
              } catch (capError) {
                console.log(`⚠️ Error checking PersonalKioskCap:`, capError);
              }
            }
          } catch (objError) {
            console.log(`⚠️ Error checking object ${obj.data.objectId}:`, objError);
            continue;
          }
        }
      }
    }
    
    console.log(`❌ No NFTs found for address ${address} in collection ${collectionId}`);
    return false;
    
  } catch (apiError) {
    console.error('❌ Sui API error:', apiError);
    console.log('🔄 NFT check failed due to API error - returning false');
    return false;
  }
}

// DM通知設定
type DmMode = 'all' | 'new_and_revoke' | 'update_and_revoke' | 'revoke_only' | 'none';
interface DmTemplate {
  title: string;
  description: string;
  color?: number;
}

interface DmTemplates {
  successNew: DmTemplate;
  successUpdate: DmTemplate;
  failed: DmTemplate;
  revoked: DmTemplate;
}

interface ChannelTemplates {
  verificationChannel: DmTemplate;
  verificationStart: DmTemplate;
}

interface DmSettings {
  mode: DmMode; // 通常認証時のDM通知モード
  batchMode: DmMode; // バッチ処理時のDM通知モード
  templates: DmTemplates;
  channelTemplates: ChannelTemplates;
}

const DM_SETTINGS_KEY = 'dm_settings';

async function getDmSettings(c: Context<{ Bindings: Env }>): Promise<DmSettings> {
  const dmStore = (c.env.DM_TEMPLATE_STORE || c.env.COLLECTION_STORE) as KVNamespace;
  // 1) 新KVから読み取り
  try {
    const v = await dmStore.get(DM_SETTINGS_KEY);
    if (v) return JSON.parse(v) as DmSettings;
  } catch (e) {
    console.log('⚠️ getDmSettings read error (primary store), will try migrate:', e);
  }

  // 2) 旧KVからの移行を試行
  try {
    if (c.env.DM_TEMPLATE_STORE) {
      const legacy = await c.env.COLLECTION_STORE.get(DM_SETTINGS_KEY);
      if (legacy) {
        await (c.env.DM_TEMPLATE_STORE as KVNamespace).put(DM_SETTINGS_KEY, legacy);
        await c.env.COLLECTION_STORE.delete(DM_SETTINGS_KEY);
        console.log('✅ Migrated DM settings from COLLECTION_STORE to DM_TEMPLATE_STORE');
        return JSON.parse(legacy) as DmSettings;
      }
    }
  } catch (migrateErr) {
    console.log('⚠️ DM settings migration failed (non-fatal):', migrateErr);
  }

  // 3) どこにも無ければデフォルト初期化（可能なら新KVに）
  const defaults: DmSettings = {
    mode: 'all',
    batchMode: 'new_and_revoke',
    templates: {
      successNew: {
        title: '🎉 Verification Completed',
        description: '**Your NFT verification is complete!**\\n\\n**Verified NFT Collection:**\\n• {collectionName}\\n\\n**Granted Roles:**\\n• {roles}\\n\\nIt may take a moment for roles to appear in the server.\\n\\nThank you for verifying!',
        color: 0x00ff00
      },
      successUpdate: {
        title: '🔄 Verification Updated',
        description: '**Your NFT verification has been updated!**\\n\\n**Verified NFT Collection:**\\n• {collectionName}\\n\\n**Updated Roles:**\\n• {roles}\\n\\nIt may take a moment for roles to appear in the server.\\n\\nThank you!',
        color: 0x0099ff
      },
      failed: {
        title: '❌ Verification Failed',
        description: '**Verification failed.**\\n\\nPlease check the following and try again:\\n• You hold the target collection NFT\\n• You are connected with the correct wallet\\n• Your network connection is stable\\n\\nIf the issue persists, please contact an administrator.',
        color: 0xff0000
      },
      revoked: {
        title: '⚠️ Role Revoked',
        description: '**Your role has been revoked because your NFT ownership could not be confirmed.**\\n\\n**Revoked Roles:**\\n• {roles}\\n\\n**How to restore:**\\n• If you reacquire the NFT, please re-verify from the verification channel\\n• If you changed wallets, please verify with the new wallet\\n\\nIf you have any questions, please contact an administrator.',
        color: 0xff6600
      }
    },
    channelTemplates: {
      verificationChannel: {
        title: '🎫 NFT Verification System',
        description: 'This system grants roles to users who hold NFTs on the Sui network.\\n\\nClick the button below to start verification.',
        color: 0x57F287
      },
      verificationStart: {
        title: '🎫 NFT Verification',
        description: 'Starting verification...\\n\\n⚠️ **Note:** Wallet signatures are safe. We only verify NFT ownership and do not move any assets.',
        color: 0x57F287
      }
    }
  };
  try {
    await dmStore.put(DM_SETTINGS_KEY, JSON.stringify(defaults));
    console.log('✅ DM settings initialized with defaults (primary store)');
  } catch {
    // 最後のフォールバック
    await c.env.COLLECTION_STORE.put(DM_SETTINGS_KEY, JSON.stringify(defaults));
    console.log('✅ DM settings initialized with defaults (legacy store)');
  }
  return defaults;
}

async function updateDmSettings(c: Context<{ Bindings: Env }>, patch: Partial<DmSettings>): Promise<DmSettings> {
  const current = await getDmSettings(c);
  const next: DmSettings = {
    mode: patch.mode ?? current.mode,
    batchMode: patch.batchMode ?? current.batchMode,
    templates: {
      successNew: patch.templates?.successNew ?? current.templates.successNew,
      successUpdate: patch.templates?.successUpdate ?? current.templates.successUpdate,
      failed: patch.templates?.failed ?? current.templates.failed,
      revoked: patch.templates?.revoked ?? current.templates.revoked
    },
    channelTemplates: {
      verificationChannel: patch.channelTemplates?.verificationChannel ?? current.channelTemplates.verificationChannel,
      verificationStart: patch.channelTemplates?.verificationStart ?? current.channelTemplates.verificationStart
    }
  };
  const dmStore = (c.env.DM_TEMPLATE_STORE || c.env.COLLECTION_STORE) as KVNamespace;
  await dmStore.put(DM_SETTINGS_KEY, JSON.stringify(next));
  // 旧ストアに存在していれば掃除
  if (c.env.DM_TEMPLATE_STORE) {
    try { await c.env.COLLECTION_STORE.delete(DM_SETTINGS_KEY); } catch {}
  }
  return next;
}

type NotifyKind = 'success_new' | 'success_update' | 'failed' | 'revoked';

interface VerificationData {
  grantedRoles?: Array<{ roleId: string; roleName: string }>;
  revokedRoles?: Array<{ roleId: string; roleName: string }>;
  verificationResults?: Array<{ hasNft: boolean; collectionName: string }>;
  collectionIds?: string[] | string;
  discordId?: string;
  reason?: string;
  [key: string]: any;
}

function buildMessageFromTemplate(template: DmTemplate, data: VerificationData): DmTemplate {
  const roles = (data?.grantedRoles || data?.revokedRoles || [])
    .map((r: any) => `• ${r.roleName || r.name}`)
    .filter(Boolean)
    .join('\n');
  const collections = Array.isArray(data?.collectionIds) ? data.collectionIds.join(', ') : (data?.collectionId || '');
  
  // コレクション名の取得（verificationResultsから） - 素の名前で保持
  const collectionNamesRaw = (data?.verificationResults || [])
    .filter((r: any) => r.hasNft)
    .map((r: any) => r.collectionName)
    .filter(Boolean) as string[];
  const collectionNames = collectionNamesRaw.length > 0
    ? collectionNamesRaw.map(n => `• ${n}`).join('\n')
    : '';
  
  // コレクション名が取得できない場合、grantedRolesから推測
  let fallbackCollectionName = '';
  if (!collectionNames && data?.grantedRoles && Array.isArray(data.grantedRoles)) {
    // Fallback label when collection name is unavailable
    fallbackCollectionName = 'Verified NFT Collection';
  }
  
  const map: Record<string, string> = {
    '{discordId}': String(data?.discordId ?? ''),
    '{roles}': roles,
    '{collections}': String(collections ?? ''),
    '{collectionName}': collectionNames || (fallbackCollectionName ? `• ${fallbackCollectionName}` : '• Fetching collection info...'),
    '{reason}': String(data?.reason ?? ''),
    '{timestamp}': new Date().toISOString()
  };
  let title = template.title;
  let description = template.description;
  for (const k of Object.keys(map)) {
    title = title.split(k).join(map[k]);
    description = description.split(k).join(map[k]);
  }
  return { title, description, color: template.color };
}

function shouldSendDm(mode: DmMode, kind: NotifyKind): boolean {
  switch (mode) {
    case 'all':
      return true;
    case 'new_and_revoke':
      return kind === 'success_new' || kind === 'revoked';
    case 'update_and_revoke':
      return kind === 'success_update' || kind === 'revoked';
    case 'revoke_only':
      return kind === 'revoked';
    case 'none':
      return false;
    default:
      return false;
  }
}

// Discord Bot API（認証結果通知）
async function notifyDiscordBot(
  c: Context<{ Bindings: Env }>,
  discordId: string,
  action: string,
  verificationData?: any,
  options?: { isBatch?: boolean; kind?: NotifyKind }
): Promise<boolean> {
  try {
    const isBatchProcess = !!options?.isBatch;
    console.log(`🔄 Discord Bot API: ${action} for user ${discordId} (batch: ${isBatchProcess})`);
    console.log('📋 Verification data:', verificationData);
    
    // 短時間の重複送信防止（同一ユーザー×同一アクション×概略理由を抑止）
    try {
      const reasonRaw = String((verificationData as any)?.reason || '').toLowerCase();
      const reasonBucket = reasonRaw.includes('no nfts')
        ? 'no_nfts'
        : reasonRaw.includes('invalid signature')
          ? 'invalid_signature'
          : 'other';
      const dedupeKey = `notify_dedupe:${action}:${discordId}:${reasonBucket}`;
      const existed = await c.env.COLLECTION_STORE.get(dedupeKey);
      if (existed) {
        console.log(`⏭️ Skip duplicated notification: ${dedupeKey}`);
        return true; // 既に直近で送信済みとみなす
      }
      // 60秒のTTLでマーク
      await c.env.COLLECTION_STORE.put(dedupeKey, '1', { expirationTtl: 60 });
    } catch (dedupeErr) {
      console.log('⚠️ Dedupe marking failed (non-fatal):', dedupeErr);
    }

    // Discord Bot API URL（環境変数優先、なければ既定値）
    const DISCORD_BOT_API_URL = c.env.DISCORD_BOT_API_URL || 'https://nft-verification-bot.onrender.com';
    console.log('🔗 Discord Bot API URL:', DISCORD_BOT_API_URL);
    
    if (!DISCORD_BOT_API_URL) {
      console.log('⚠️ Discord Bot API URL not configured, using mock');
      return true; // モックモード
    }
    
    // DM設定を読み込み、送信可否とテンプレートを適用
    const dmSettings = await getDmSettings(c);
    const kind: NotifyKind | undefined = options?.kind;

    console.log('🔍 DM Settings:', JSON.stringify(dmSettings, null, 2));
    console.log('🔍 Notification kind:', kind);
    console.log('🔍 Is batch process:', isBatchProcess);

    let notifyUser = true;
    let customMessage: DmTemplate | undefined;
    if (kind) {
      // バッチ処理時と通常認証時で異なるDM通知モードを使用
      const dmMode = isBatchProcess ? dmSettings.batchMode : dmSettings.mode;
      notifyUser = shouldSendDm(dmMode, kind);
      console.log('🔍 DM Mode:', dmMode, 'Should send DM:', notifyUser);
      if (notifyUser) {
        const tpl =
          kind === 'success_new' ? dmSettings.templates.successNew :
          kind === 'success_update' ? dmSettings.templates.successUpdate :
          kind === 'failed' ? dmSettings.templates.failed :
          dmSettings.templates.revoked;
        customMessage = buildMessageFromTemplate(tpl, verificationData);

        // Respect admin-panel template on failure: keep title/color, override description only
        if (kind === 'failed') {
          const reasonText = String((verificationData as any)?.reason ?? '').toLowerCase();
          const errorCode = String((verificationData as any)?.errorCode ?? '').toUpperCase();
          const base = dmSettings.templates.failed;
          let overrideDescription = '';
          if (errorCode === 'NO_NFTS' || reasonText.includes('no nfts')) {
            overrideDescription = 'No NFTs from the target collection were found. Please check your wallet holdings and try verifying again after you own the NFT.';
          } else if (errorCode === 'INVALID_SIGNATURE' || reasonText.includes('invalid signature')) {
            overrideDescription = 'Signature validation failed. Please try another wallet (e.g., Suiet/Surf) or a different browser. If the issue persists, contact an administrator.';
          } else if (errorCode === 'NFT_CHECK_ERROR' || reasonText.includes('nft check failed')) {
            overrideDescription = 'An error occurred while checking NFT ownership. Please check your network connection and try again later.';
          } else {
            overrideDescription = base.description;
          }
          customMessage = { title: base.title, description: overrideDescription, color: base.color };
        }

        // Structured summary log for observability
        try {
          console.log('🔔 DM notify summary:', JSON.stringify({
            dmMode,
            kind,
            isBatchProcess,
            title: customMessage?.title,
            preview: (customMessage?.description || '').slice(0, 80)
          }));
        } catch {}
      }
    }

    // リクエストボディの構築
    const requestBody = {
      discord_id: discordId,
      action: action,
      verification_data: { ...(verificationData || {}), notifyUser, custom_message: customMessage },
      timestamp: new Date().toISOString(),
      // 常にチャンネル投稿を無効化（DMのみ）
      disable_channel_post: true
    };
    
    console.log('🔍 Final request body:', JSON.stringify(requestBody, null, 2));
    
    console.log('📤 Sending request to Discord Bot API:', requestBody);
    
    // レンダーのDiscord Bot APIにリクエスト送信
    const response = await fetch(`${DISCORD_BOT_API_URL}/api/discord-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log(`📥 Discord Bot API response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json() as any;
      console.log(`✅ Discord Bot API response:`, result);
      return result.success || false;
    } else {
      const errorText = await response.text();
      console.error(`❌ Discord Bot API error: ${response.status} ${response.statusText}`);
      console.error(`❌ Error response body:`, errorText);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error with Discord Bot API:', error);
    console.error('❌ Error details:', (error as Error).message);
    console.error('❌ Error stack:', (error as Error).stack);
    return false;
  }
}

// 認証済みユーザー管理
const VERIFIED_USERS_KEY = 'verified_users';
// 管理者ログイン用KVキー接頭辞
const ADMIN_LOGIN_NONCE_PREFIX = 'admin_login_nonce:'; // TTL 5分
const ADMIN_TOKEN_PREFIX = 'admin_token:'; // TTL 24時間

interface VerifiedUser {
  discordId: string;
  address: string;
  collectionId: string;
  roleId: string;
  roleName: string;
  verifiedAt: string;
  lastChecked: string;
}

// 認証済みユーザー一覧を取得
async function getVerifiedUsers(c: Context<{ Bindings: Env }>): Promise<VerifiedUser[]> {
  try {
    const usersData = await c.env.COLLECTION_STORE.get(VERIFIED_USERS_KEY);
    return usersData ? JSON.parse(usersData) : [];
  } catch (error) {
    console.error('Error getting verified users:', error);
    return [];
  }
}

// 認証済みユーザーを追加
async function addVerifiedUser(c: Context<{ Bindings: Env }>, user: VerifiedUser): Promise<boolean> {
  try {
    const users = await getVerifiedUsers(c);
    const existingIndex = users.findIndex(u => u.discordId === user.discordId && u.collectionId === user.collectionId);
    
    if (existingIndex >= 0) {
      // 既存ユーザーを更新
      users[existingIndex] = { ...users[existingIndex], ...user, lastChecked: new Date().toISOString() };
    } else {
      // 新規ユーザーを追加
      users.push({ ...user, lastChecked: new Date().toISOString() });
    }
    
    await c.env.COLLECTION_STORE.put(VERIFIED_USERS_KEY, JSON.stringify(users));
    return true;
  } catch (error) {
    console.error('Error adding verified user:', error);
    return false;
  }
}

// 認証済みユーザーを削除
async function removeVerifiedUser(c: Context<{ Bindings: Env }>, discordId: string, collectionId: string): Promise<boolean> {
  try {
    const users = await getVerifiedUsers(c);
    const filteredUsers = users.filter(u => !(u.discordId === discordId && u.collectionId === collectionId));
    await c.env.COLLECTION_STORE.put(VERIFIED_USERS_KEY, JSON.stringify(filteredUsers));
    return true;
  } catch (error) {
    console.error('Error removing verified user:', error);
    return false;
  }
}

// 認証済みユーザーの最終チェック日時を更新
async function updateVerifiedUserLastChecked(c: Context<{ Bindings: Env }>, discordId: string, collectionId: string): Promise<boolean> {
  try {
    console.log(`🔄 Updating lastChecked for user ${discordId} in collection ${collectionId}`);
    const users = await getVerifiedUsers(c);
    const userIndex = users.findIndex(u => u.discordId === discordId && u.collectionId === collectionId);
    
    console.log(`📊 Found ${users.length} total users, user index: ${userIndex}`);
    
    if (userIndex >= 0) {
      const oldLastChecked = users[userIndex].lastChecked;
      const newLastChecked = new Date().toISOString();
      
      // 最終チェック日時を更新
      users[userIndex] = { ...users[userIndex], lastChecked: newLastChecked };
      
      console.log(`📝 Updating lastChecked from ${oldLastChecked} to ${newLastChecked}`);
      
      await c.env.COLLECTION_STORE.put(VERIFIED_USERS_KEY, JSON.stringify(users));
      
      // 更新後の確認
      const updatedUsers = await getVerifiedUsers(c);
      const updatedUser = updatedUsers.find(u => u.discordId === discordId && u.collectionId === collectionId);
      
      if (updatedUser && updatedUser.lastChecked === newLastChecked) {
        console.log(`✅ Successfully updated lastChecked for user ${discordId} in collection ${collectionId}`);
        return true;
      } else {
        console.error(`❌ Failed to verify lastChecked update for user ${discordId}`);
        return false;
      }
    } else {
      console.log(`⚠️ User ${discordId} not found in collection ${collectionId} for lastChecked update`);
      console.log(`🔍 Available users: ${users.map(u => `${u.discordId}:${u.collectionId}`).join(', ')}`);
      return false;
    }
  } catch (error) {
    console.error('Error updating verified user lastChecked:', error);
    return false;
  }
}

// 管理者アドレス管理
const ADMIN_ADDRESSES_KEY = 'admin_addresses';

// 管理者アドレス一覧を取得
async function getAdminAddresses(c: Context<{ Bindings: Env }>): Promise<string[]> {
  try {
    const adminData = await c.env.COLLECTION_STORE.get(ADMIN_ADDRESSES_KEY);
    if (adminData) {
      const addresses = JSON.parse(adminData);
      console.log(`📋 Retrieved admin addresses from KV: ${addresses.join(', ')}`);
      
      // 重複を除去（大文字小文字を区別せずに重複除去、元の大文字小文字は保持）
      const uniqueAddresses = addresses.filter((addr: string, index: number) => {
        const firstIndex = addresses.findIndex((a: string) => a.toLowerCase() === addr.toLowerCase());
        return firstIndex === index;
      });
      
      if (uniqueAddresses.length !== addresses.length) {
        console.log(`🔧 Deduplicating admin addresses: ${uniqueAddresses.join(', ')}`);
        // 重複が見つかった場合は更新
        await updateAdminAddresses(c, uniqueAddresses);
      }
      
      return uniqueAddresses;
    }
    
    // 初期設定の管理者アドレス（重複を防ぐため1つのみ）
    const defaultAdmins = [
      '0x645a45e619b62f8179e217bed972bc65281fddee193fc0505566490c7743aa9d'
    ];
    
    console.log(`📝 Setting default admin addresses: ${defaultAdmins.join(', ')}`);
    
    try {
      await c.env.COLLECTION_STORE.put(ADMIN_ADDRESSES_KEY, JSON.stringify(defaultAdmins));
      console.log('✅ Successfully saved default admin addresses to KV');
    } catch (kvError) {
      console.error('❌ Failed to save admin addresses to KV:', kvError);
      // KVストアに保存できなくても、デフォルトアドレスを返す
    }
    
    return defaultAdmins;
  } catch (error) {
    console.error('Error getting admin addresses:', error);
    // エラーが発生した場合でも、デフォルトの管理者アドレスを返す
    return [
      '0x645a45e619b62f8179e217bed972bc65281fddee193fc0505566490c7743aa9d'
    ];
  }
}

// 管理者アドレスを更新
async function updateAdminAddresses(c: Context<{ Bindings: Env }>, addresses: string[]): Promise<boolean> {
  try {
    console.log(`📝 Updating admin addresses: ${addresses.join(', ')}`);
    
    // 重複を除去（大文字小文字を区別せずに重複除去、元の大文字小文字は保持）
    const uniqueAddresses = addresses
      .filter(addr => addr && addr.trim())
      .filter((addr, index, arr) => {
        const firstIndex = arr.findIndex(a => a.toLowerCase() === addr.toLowerCase());
        return firstIndex === index;
      });
    
    console.log(`📝 Unique addresses: ${uniqueAddresses.join(', ')}`);
    
    // KVストアに保存する前に検証
    if (uniqueAddresses.length === 0) {
      console.error('❌ Cannot save empty admin addresses');
      return false;
    }
    
    // JSON文字列に変換して保存
    const jsonData = JSON.stringify(uniqueAddresses);
    console.log(`📝 Saving to KV: ${jsonData}`);
    
    await c.env.COLLECTION_STORE.put(ADMIN_ADDRESSES_KEY, jsonData);
    
    // 保存後に確認
    const savedData = await c.env.COLLECTION_STORE.get(ADMIN_ADDRESSES_KEY);
    if (savedData) {
      const savedAddresses = JSON.parse(savedData);
      console.log(`✅ Successfully saved admin addresses: ${savedAddresses.join(', ')}`);
      return true;
    } else {
      console.error('❌ Failed to verify saved data');
      return false;
    }
  } catch (error) {
    console.error('❌ Error updating admin addresses:', error);
    console.error('❌ Error details:', error);
    return false;
  }
}

// 管理者チェック
async function isAdmin(c: Context<{ Bindings: Env }>, address: string): Promise<boolean> {
  try {
    const adminAddresses = await getAdminAddresses(c);
    const normalizedAddress = address.toLowerCase();
    console.log(`🔍 Checking admin status for address: ${address}`);
    console.log(`🔍 Normalized address: ${normalizedAddress}`);
    console.log(`🔍 Available admin addresses: ${adminAddresses.join(', ')}`);
    const isAdminUser = adminAddresses.some((a: string) => a.toLowerCase() === normalizedAddress);
    console.log(`🔍 Is admin: ${isAdminUser}`);
    return isAdminUser;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

// コレクション取得API
app.get('/api/collections', async (c) => {
  try {
    console.log('=== COLLECTIONS API CALLED ===');
    
    // KVストアの存在確認とフォールバック処理
    let collections = [];
    if (c.env.COLLECTION_STORE) {
      try {
    const collectionsData = await c.env.COLLECTION_STORE.get('collections');
        collections = collectionsData ? JSON.parse(collectionsData) : [];
        console.log(`📋 Retrieved ${collections.length} collections from KV store`);
      } catch (kvError) {
        console.error('❌ Error accessing KV store:', kvError);
        collections = [];
      }
    } else {
      console.warn('⚠️ COLLECTION_STORE is not available, using fallback');
    }
    
    console.log(`Found ${collections.length} collections`);
    
    // コレクションが空の場合はデフォルトコレクションを追加
    if (collections.length === 0) {
      const defaultCollection: NFTCollection = {
        id: 'default',
        name: 'Popkins NFT',
        packageId: c.env.NFT_COLLECTION_ID as string,
        roleId: '1400485848008491059', // デフォルトロールID
        roleName: 'NFT Holder',
        description: 'Default NFT collection for verification',
        isActive: true,
        createdAt: new Date().toISOString()
      };
      
      collections.push(defaultCollection);
      console.log('✅ Added default collection');
    }
    
    // Discordロール情報を取得して、コレクションのroleNameを更新
    try {
      console.log('🔄 Fetching Discord roles to update collection role names...');
      const discordBotUrl = c.env.DISCORD_BOT_API_URL || 'https://nft-verification-bot.onrender.com';
      console.log(`🔗 Discord Bot URL: ${discordBotUrl}`);
      console.log(`🔗 Environment DISCORD_BOT_API_URL: ${c.env.DISCORD_BOT_API_URL}`);
      
      const response = await fetch(`${discordBotUrl}/api/roles`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'NFT-Verification-API/1.0',
          'Accept': 'application/json'
        }
      });
      
      console.log(`📡 Response status: ${response.status} ${response.statusText}`);
      if (response.ok) {
        const rolesData = await response.json() as any;
        const roles = rolesData.data || rolesData.roles || [];
        console.log(`✅ Fetched ${roles.length} Discord roles`);
        console.log(`📋 Roles data:`, JSON.stringify(roles.slice(0, 3))); // 最初の3つのロールのみ表示
        
        // コレクションのroleNameを実際のDiscordロール名で更新
        const updatedCollections = collections.map((collection: NFTCollection) => {
          const matchingRole = roles.find((role: any) => role.id === collection.roleId);
          if (matchingRole) {
            console.log(`🔄 Updating role name for collection ${collection.name}: ${collection.roleName} → ${matchingRole.name}`);
            return {
              ...collection,
              roleName: matchingRole.name
            };
          }
          return collection;
        });
        
        return c.json({
          success: true,
          data: updatedCollections
        });
      } else {
        console.log(`⚠️ Failed to fetch Discord roles: ${response.status} ${response.statusText}`);
        // Discord APIが失敗した場合は元のコレクションを返す
    return c.json({
      success: true,
      data: collections
    });
      }
    } catch (discordError) {
      console.error('❌ Error fetching Discord roles:', discordError);
      // Discord APIが失敗した場合は元のコレクションを返す
      return c.json({
        success: true,
        data: collections
      });
    }
  } catch (error) {
    console.error('Collections fetch error:', error);
    
    // エラーが発生した場合もデフォルトコレクションを返す
    const defaultCollection: NFTCollection = {
      id: 'default',
      name: 'Popkins NFT',
      packageId: c.env.NFT_COLLECTION_ID,
      roleId: '1400485848008491059',
      roleName: 'NFT Holder',
      description: 'Default NFT collection for verification',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    return c.json({
      success: true,
      data: [defaultCollection]
    });
  }
});

// コレクション追加API（管理者用）
app.post('/api/collections', async (c) => {
  try {
    console.log('=== ADD COLLECTION API CALLED ===');
    
    const body = await c.req.json();
    const { name, packageId, roleId, roleName, description } = body;
    
    console.log('Request body:', body);
    
    // バリデーション
    if (!name || !packageId || !roleId || !roleName) {
      console.log('Missing required fields:', { name, packageId, roleId, roleName });
      return c.json({
        success: false,
        error: 'Missing required fields: name, packageId, roleId, roleName'
      }, 400);
    }
    
    // KVストアの存在確認とフォールバック処理
    if (!c.env.COLLECTION_STORE) {
      console.error('❌ COLLECTION_STORE is not available');
      return c.json({
        success: false,
        error: 'Storage service is not available'
      }, 503);
    }
    
    const newCollection: NFTCollection = {
      id: Date.now().toString(),
      name,
      packageId,
      roleId,
      roleName,
      description: description || '',
      isActive: true,
      createdAt: new Date().toISOString()
    };
    
    // 既存コレクションを取得
    let collections = [];
    try {
    const existingData = await c.env.COLLECTION_STORE.get('collections');
      collections = existingData ? JSON.parse(existingData) : [];
      console.log(`📋 Retrieved ${collections.length} collections from KV store`);
    } catch (kvError) {
      console.error('❌ Error accessing KV store:', kvError);
      return c.json({
        success: false,
        error: 'Failed to access storage'
      }, 503);
    }
    
    // 新しいコレクションを追加
    collections.push(newCollection);
    
    // KVに保存
    await c.env.COLLECTION_STORE.put('collections', JSON.stringify(collections));
    
    console.log(`✅ Added new collection: ${name} (ID: ${newCollection.id})`);
    
    return c.json({
      success: true,
      data: newCollection
    });
  } catch (error) {
    console.error('Add collection error:', error);
    return c.json({
      success: false,
      error: 'Failed to add collection'
    }, 500);
  }
});

// コレクション更新API
app.put('/api/collections/:id', async (c) => {
  try {
    const collectionId = c.req.param('id');
    const body = await c.req.json();
    
    console.log(`=== UPDATE COLLECTION API CALLED ===`);
    console.log(`Collection ID: ${collectionId}`);
    console.log('Request body:', body);
    
    // KVストアの存在確認とフォールバック処理
    console.log('🔍 Checking KV store availability...');
    console.log('🔍 c.env keys:', Object.keys(c.env));
    console.log('🔍 c.env.COLLECTION_STORE:', typeof c.env.COLLECTION_STORE);
    
    if (!c.env.COLLECTION_STORE) {
      console.error('❌ COLLECTION_STORE is not available');
      return c.json({
        success: false,
        error: 'Storage service is not available'
      }, 503);
    }
    
    let collections = [];
    try {
    const existingData = await c.env.COLLECTION_STORE.get('collections');
      collections = existingData ? JSON.parse(existingData) : [];
      console.log(`📋 Retrieved ${collections.length} collections from KV store`);
    } catch (kvError) {
      console.error('❌ Error accessing KV store:', kvError);
      return c.json({
        success: false,
        error: 'Failed to access storage'
      }, 503);
    }
    
    const collectionIndex = collections.findIndex((c: NFTCollection) => c.id === collectionId);
    if (collectionIndex === -1) {
      return c.json({
        success: false,
        error: 'Collection not found'
      }, 404);
    }
    
    // コレクションを更新
    collections[collectionIndex] = {
      ...collections[collectionIndex],
      ...body,
      updatedAt: new Date().toISOString()
    };
    
    await c.env.COLLECTION_STORE.put('collections', JSON.stringify(collections));
    
    console.log(`✅ Updated collection: ${collections[collectionIndex].name}`);
    
    return c.json({
      success: true,
      data: collections[collectionIndex]
    });
  } catch (error) {
    console.error('Update collection error:', error);
    return c.json({
      success: false,
      error: 'Failed to update collection'
    }, 500);
  }
});

// コレクション削除API
app.delete('/api/collections/:id', async (c) => {
  try {
    const collectionId = c.req.param('id');
    
    console.log(`=== DELETE COLLECTION API CALLED ===`);
    console.log(`Collection ID: ${collectionId}`);
    
    const existingData = await c.env.COLLECTION_STORE.get('collections');
    const collections = existingData ? JSON.parse(existingData) : [];
    
    const collectionIndex = collections.findIndex((c: NFTCollection) => c.id === collectionId);
    if (collectionIndex === -1) {
      return c.json({
        success: false,
        error: 'Collection not found'
      }, 404);
    }
    
    const deletedCollection = collections[collectionIndex];
    collections.splice(collectionIndex, 1);
    
    await c.env.COLLECTION_STORE.put('collections', JSON.stringify(collections));
    
    console.log(`✅ Deleted collection: ${deletedCollection.name}`);
    
    return c.json({
      success: true,
      data: deletedCollection
    });
  } catch (error) {
    console.error('Delete collection error:', error);
    return c.json({
      success: false,
      error: 'Failed to delete collection'
    }, 500);
  }
});

// 管理者チェックAPI
app.get('/api/admin/check/:address', async (c) => {
  try {
    const address = c.req.param('address');
    const isAdminUser = await isAdmin(c, address);
    
    return c.json({
      success: true,
      isAdmin: isAdminUser
    });
  } catch (error) {
    console.error('Admin check error:', error);
    return c.json({
      success: false,
      error: 'Failed to check admin status'
    }, 500);
  }
});

// 管理者アドレス一覧取得API
app.get('/api/admin/addresses', async (c) => {
  try {
    const addresses = await getAdminAddresses(c);
    
    return c.json({
      success: true,
      data: addresses
    });
  } catch (error) {
    console.error('Get admin addresses error:', error);
    return c.json({
      success: false,
      error: 'Failed to get admin addresses'
    }, 500);
  }
});

// 管理者アドレス更新API
app.post('/api/admin/addresses', async (c) => {
  try {
    const body = await c.req.json();
    const { addresses, address } = body;
    
    let targetAddresses: string[];
    
    if (address) {
      // 単一アドレスを追加する場合
      const currentAddresses = await getAdminAddresses(c);
      targetAddresses = [...currentAddresses, address];
    } else if (Array.isArray(addresses)) {
      // 複数アドレスを設定する場合
      targetAddresses = addresses;
    } else {
      return c.json({
        success: false,
        error: 'Either "address" or "addresses" array is required'
      }, 400);
    }
    
    console.log(`📝 Target addresses: ${targetAddresses.join(', ')}`);
    
    const success = await updateAdminAddresses(c, targetAddresses);
    
    if (success) {
      const updatedAddresses = await getAdminAddresses(c);
      return c.json({
        success: true,
        message: 'Admin addresses updated successfully',
        data: updatedAddresses
      });
    } else {
      return c.json({
        success: false,
        error: 'Failed to update admin addresses'
      }, 500);
    }
  } catch (error) {
    console.error('Update admin addresses error:', error);
    return c.json({
      success: false,
      error: 'Failed to update admin addresses'
    }, 500);
  }
});

// 管理者アドレスリセットAPI
app.post('/api/admin/reset-addresses', async (c) => {
  try {
    console.log('🔄 Resetting admin addresses...');
    
    const body = await c.req.json().catch(() => ({}));
    const { addresses } = body;
    
    let adminAddresses: string[];
    
    if (addresses && Array.isArray(addresses) && addresses.length > 0) {
      // 新しい管理者アドレスが指定された場合
      adminAddresses = addresses;
      console.log(`📝 Setting new admin addresses: ${adminAddresses.join(', ')}`);
    } else {
      // デフォルトの管理者アドレスを設定
      adminAddresses = [
        '0x645a45e619b62f8179e217bed972bc65281fddee193fc0505566490c7743aa9d'
      ];
      console.log(`📝 Setting default admin addresses: ${adminAddresses.join(', ')}`);
    }
    
    const success = await updateAdminAddresses(c, adminAddresses);
    
    if (success) {
      console.log('✅ Admin addresses reset successfully');
      return c.json({
        success: true,
        message: 'Admin addresses reset successfully',
        data: adminAddresses
      });
    } else {
      console.log('❌ Failed to reset admin addresses');
      return c.json({
        success: false,
        error: 'Failed to reset admin addresses'
      }, 500);
    }
  } catch (error) {
    console.error('Reset admin addresses error:', error);
    return c.json({
      success: false,
      error: 'Failed to reset admin addresses'
    }, 500);
  }
});



// 管理者アドレス削除API
app.delete('/api/admin/addresses/:address', async (c) => {
  try {
    const addressToRemove = c.req.param('address');
    console.log(`🗑️ Removing admin address: ${addressToRemove}`);
    
    const currentAddresses = await getAdminAddresses(c);
    console.log(`📋 Current addresses: ${currentAddresses.join(', ')}`);
    
    // 重複を除去してから削除処理を行う（大文字小文字を区別せずに重複除去）
    const uniqueCurrentAddresses = currentAddresses.filter((addr, index) => {
      const firstIndex = currentAddresses.findIndex(a => a.toLowerCase() === addr.toLowerCase());
      return firstIndex === index;
    });
    
    console.log(`📋 Unique current addresses: ${uniqueCurrentAddresses.join(', ')}`);
    
    // 大文字小文字を区別せずに削除
    const newAddresses = uniqueCurrentAddresses.filter(addr => 
      addr.toLowerCase() !== addressToRemove.toLowerCase()
    );
    
    console.log(`📋 New addresses after removal: ${newAddresses.join(', ')}`);
    
    // 最低1つの管理者アドレスが残るようにする
    if (newAddresses.length === 0) {
      console.log('⚠️ Cannot remove all admin addresses, keeping at least one');
      return c.json({
        success: false,
        error: 'Cannot remove all admin addresses. At least one admin address must remain.',
        message: '管理者アドレスを全て削除することはできません。最低1つの管理者アドレスが必要です。'
      }, 400);
    }
    
    // 削除対象が実際に存在するかチェック
    const wasRemoved = uniqueCurrentAddresses.length !== newAddresses.length;
    if (!wasRemoved) {
      console.log('⚠️ Address not found in admin list');
      return c.json({
        success: false,
        error: 'Address not found in admin list',
        message: '指定されたアドレスは管理者リストに存在しません。'
      }, 404);
    }
    
    const success = await updateAdminAddresses(c, newAddresses);
    
    if (success) {
      console.log('✅ Admin address removed successfully');
      return c.json({
        success: true,
        message: 'Admin address removed successfully',
        data: newAddresses
      });
    } else {
      console.log('❌ Failed to remove admin address');
      return c.json({
        success: false,
        error: 'Failed to remove admin address'
      }, 500);
    }
  } catch (error) {
    console.error('Remove admin address error:', error);
    return c.json({
      success: false,
      error: 'Failed to remove admin address'
    }, 500);
  }
});

// Discordロール取得エンドポイント
app.get('/api/discord/roles', async (c) => {
  try {
    console.log('=== DISCORD ROLES API CALLED ===');
    
    // Discord Bot API URLを環境変数から取得、フォールバックを追加
    const DISCORD_BOT_API_URL = c.env.DISCORD_BOT_API_URL || 'https://nft-verification-bot.onrender.com';
    console.log('🔗 Discord Bot API URL:', DISCORD_BOT_API_URL);
    
    if (!DISCORD_BOT_API_URL) {
      console.log('⚠️ Discord Bot API URL not configured');
      return c.json({
        success: true,
        data: []
      });
    }
    
    // Discord Bot APIからロール一覧を取得（タイムアウトと再試行を追加）
    let response;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        attempts++;
        console.log(`🔄 Attempt ${attempts}/${maxAttempts} to fetch Discord roles`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒タイムアウト
        
        response = await fetch(`${DISCORD_BOT_API_URL}/api/roles`, {
      method: 'GET',
      headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'NFT-Verification-Worker/1.0',
            'Accept': 'application/json'
          },
          signal: controller.signal
        }).finally(() => {
          clearTimeout(timeoutId);
        });
        
        if (response.ok) {
          break; // 成功した場合はループを抜ける
        } else {
          console.log(`⚠️ Attempt ${attempts} failed with status: ${response.status}`);
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機
          }
        }
      } catch (error) {
        console.log(`⚠️ Attempt ${attempts} failed with error:`, error);
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機
        } else {
          throw error; // 最後の試行でもエラーの場合は例外を投げる
        }
      }
    }
    
    console.log(`📥 Discord Bot API response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json() as any;
      console.log(`✅ Discord roles fetched:`, result);
      
      // データの形式を統一
      const roles = result.data || result.roles || [];
      console.log(`🔍 Processed ${roles.length} roles`);
      
      return c.json({
        success: true,
        data: roles
      });
    } else {
      const errorText = await response.text();
      console.error(`❌ Discord Bot API error: ${response.status} ${response.statusText}`);
      console.error(`❌ Error response body:`, errorText);
      
      // フォールバック: デフォルトロールを返す（実際のDiscordロールを含む）
      const defaultRoles = [
        { id: '1400485848008491059', name: 'NFT Holder' },
        { id: '1319606850863431712', name: 'Verified Member' },
        { id: '1319623024826036246', name: 'Member' },
        { id: '1319623098964783155', name: 'Moderator' },
        { id: '1319623144682225797', name: 'Admin' },
        { id: '1319623192304140421', name: 'VIP' },
        { id: '1319623241784881152', name: 'Premium' }
      ];
      
      return c.json({
        success: true,
        data: defaultRoles,
        warning: 'Using fallback roles due to API error'
      });
    }
    
  } catch (error) {
    console.error('❌ Error fetching Discord roles:', error);
    
    // フォールバック: デフォルトロールを返す（実際のDiscordロールを含む）
    const defaultRoles = [
      { id: '1400485848008491059', name: 'NFT Holder' },
      { id: '1319606850863431712', name: 'Verified Member' },
      { id: '1319623024826036246', name: 'Member' },
      { id: '1319623098964783155', name: 'Moderator' },
      { id: '1319623144682225797', name: 'Admin' },
      { id: '1319623192304140421', name: 'VIP' },
      { id: '1319623241784881152', name: 'Premium' }
    ];
    
    return c.json({
      success: true,
      data: defaultRoles,
      warning: 'Using fallback roles due to network error'
    });
  }
});

// ナンス生成エンドポイント
app.post('/api/nonce', async (c) => {
  try {
    const body = await c.req.json();
    const { discordId, address } = body;

    if (!discordId || !address) {
      return c.json({
        success: false,
        error: 'discordId and address are required'
      }, 400);
    }

    // ナンス生成
    const nonce = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分後

    // Cloudflare KVに保存
    const nonceData = {
      nonce,
      discordId,
      address,
      expiresAt
    };

    await (c.env.NONCE_STORE as any).put(nonce, JSON.stringify(nonceData), {
      expirationTtl: 300 // 5分後に自動削除
    });

    return c.json({
      success: true,
      data: {
        nonce,
        expiresAt
      }
    });

  } catch (error) {
    console.error('Nonce generation error:', error);
    return c.json({
      success: false,
      error: `Failed to generate nonce: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, 500);
  }
});

// 認証エンドポイント
app.post('/api/verify', async (c) => {
  try {
    const body = await c.req.json();
    const { signature, address, discordId, nonce, authMessage, bytes, collectionIds } = body;

    // 必須パラメータチェック
    if (!signature || !address || !discordId || !nonce) {
      return c.json({
        success: false,
        error: 'Missing required parameters'
      }, 400);
    }

    console.log(`Verification request for ${address} (Discord: ${discordId})`);
    console.log(`Collection IDs: ${collectionIds || 'default'}`);

    // ナンス検証
    const storedNonceDataStr = await c.env.NONCE_STORE.get(nonce);
    if (!storedNonceDataStr) {
      return c.json({
        success: false,
        error: 'Invalid or expired nonce'
      }, 400);
    }

    const storedNonceData = JSON.parse(storedNonceDataStr);
    const isValidNonce = validateNonce(nonce, storedNonceData);
    if (!isValidNonce) {
      return c.json({
        success: false,
        error: 'Invalid or expired nonce'
      }, 400);
    }

    // 既存認証ユーザーの先行救済（KVベースで即時ロール再付与）
    try {
      const existingUsers = await getVerifiedUsers(c);
      const existing = existingUsers.find((u) =>
        u.discordId === discordId && (u.address || '').toLowerCase() === (address || '').toLowerCase()
      );

      if (existing) {
        const collectionsData = await c.env.COLLECTION_STORE.get('collections');
        const allCollections: NFTCollection[] = collectionsData ? JSON.parse(collectionsData) : [];
        const savedCollectionIds = (existing.collectionId || '').split(',').filter(Boolean);
        const regrantRoles = savedCollectionIds
          .map((cid) => allCollections.find((col) => col.id === cid))
          .filter((col): col is NFTCollection => Boolean(col))
          .map((col) => ({ roleId: col.roleId, roleName: col.roleName }));

        // 既存再付与フローでもコレクション名をDMに渡すための結果を構築
        const regrantVerificationResults = savedCollectionIds
          .map((cid) => allCollections.find((col) => col.id === cid))
          .filter((col): col is NFTCollection => Boolean(col))
          .map((col) => ({
            collectionId: col.id,
            collectionName: col.name,
            roleId: col.roleId,
            roleName: col.roleName,
            hasNft: true
          }));

        if (regrantRoles.length > 0) {
          const regrantData = {
            address,
            discordId,
            collectionIds: savedCollectionIds,
            grantedRoles: regrantRoles,
            verificationResults: regrantVerificationResults,
            notifyUser: false,
            reason: '既存の認証者としてロールを再付与しました。',
            timestamp: new Date().toISOString()
          };

          await notifyDiscordBot(c, discordId, 'grant_roles', regrantData, { isBatch: false, kind: 'success_update' });

          // lastChecked の更新
          await addVerifiedUser(c, {
            discordId,
            address,
            collectionId: existing.collectionId,
            roleId: regrantRoles[0].roleId,
            roleName: regrantRoles[0].roleName,
            verifiedAt: existing.verifiedAt,
            lastChecked: new Date().toISOString()
          });

          // 使用済みナンスを削除
          await c.env.NONCE_STORE.delete(nonce);

          return c.json({
            success: true,
            data: {
              grantedRoles: regrantRoles,
              verificationResults: regrantVerificationResults,
              message: '既存の認証を検出しました。ロールを再付与しました。'
            }
          });
        }
      }
    } catch (e) {
      console.log('⚠️ Early regrant check failed:', e);
    }

    // 署名検証（@suiet/wallet-kit形式 + メッセージ整合性）
    console.log('=== SIGNATURE VERIFICATION ===');
    console.log('Request body:', body);

    // サーバーで期待するメッセージを再構築
    // authMessage には address/discordId/nonce/timestamp を含める前提（フロントも同様に修正）
    if (!authMessage || typeof authMessage !== 'string') {
      return c.json({ success: false, error: 'Invalid authMessage' }, 400);
    }

    // 最低限、必要キーの含有をチェック
    const mustIncludes = [address, discordId, nonce].every(v => authMessage.includes(String(v)));
    if (!mustIncludes) {
      return c.json({ success: false, error: 'authMessage mismatch' }, 400);
    }

    // ウォレットから送信されたbytesを直接使用（スラッシュウォレット対応）
    const signatureData = { signature, bytes, publicKey: body.publicKey };
    const isValidSignature = await verifySignedMessage(signatureData, null); // bytesを直接使用
    if (!isValidSignature) {
      try {
        // 署名不正でもユーザーにDMで通知
        await notifyDiscordBot(c, discordId, 'verification_failed', {
          address,
          discordId,
          reason: 'Invalid signature',
          errorCode: 'INVALID_SIGNATURE',
          timestamp: new Date().toISOString()
        }, { isBatch: false, kind: 'failed' });
      } catch (e) {
        console.log('⚠️ Failed to notify Discord bot for invalid signature:', e);
      }
      return c.json({
        success: false,
        error: 'Invalid signature',
        errorCode: 'INVALID_SIGNATURE'
      }, 400);
    }

    // コレクション一覧を取得
    const collectionsData = await c.env.COLLECTION_STORE.get('collections');
    const collections = collectionsData ? JSON.parse(collectionsData) : [];
    
    // 検証対象のコレクションを決定
    let targetCollections: NFTCollection[] = [];
    
    if (collectionIds && Array.isArray(collectionIds) && collectionIds.length > 0) {
      // 指定されたコレクションIDに対応するコレクションを取得
      targetCollections = collections.filter((col: NFTCollection) => 
        collectionIds.includes(col.id) && col.isActive
      );
    } else {
      // デフォルトコレクションを使用
      const defaultCollection: NFTCollection = {
        id: 'default',
        name: 'Popkins NFT',
        packageId: c.env.NFT_COLLECTION_ID as string,
        roleId: '1400485848008491059',
        roleName: 'NFT Holder',
        description: 'Default NFT collection for verification',
        isActive: true,
        createdAt: new Date().toISOString()
      };
      targetCollections = [defaultCollection];
    }

    console.log(`✅ Target collections: ${targetCollections.length}`);

    // 各コレクションのNFT保有をチェック
    const verificationResults = [];
    const grantedRoles = [];

    for (const collection of targetCollections) {
      console.log(`🔍 Checking NFT ownership for collection: ${collection.name} (${collection.packageId})`);
      
      try {
        const hasNft = await hasTargetNft(address, collection.packageId);
        
        if (hasNft) {
          console.log(`✅ NFT found for collection: ${collection.name}`);
          verificationResults.push({
            collectionId: collection.id,
            collectionName: collection.name,
            roleId: collection.roleId,
            roleName: collection.roleName,
            hasNft: true
          });
          grantedRoles.push({
            roleId: collection.roleId,
            roleName: collection.roleName
          });
        } else {
          console.log(`❌ No NFT found for collection: ${collection.name}`);
          verificationResults.push({
            collectionId: collection.id,
            collectionName: collection.name,
            roleId: collection.roleId,
            roleName: collection.roleName,
            hasNft: false
          });
        }
      } catch (nftCheckError) {
        console.error(`❌ NFT check failed for collection ${collection.name}:`, nftCheckError);
        
        // NFTチェックが失敗した場合、ユーザーに適切なエラーメッセージを送信
        await notifyDiscordBot(c, discordId, 'verification_failed', {
          address,
          discordId,
          reason: `NFT check failed: ${nftCheckError.message}`,
          errorCode: 'NFT_CHECK_ERROR',
          timestamp: new Date().toISOString()
        }, { isBatch: false, kind: 'failed' });
        
        return c.json({
          success: false,
          error: 'NFT check failed due to network or API issues. Please try again later.',
          errorCode: 'NFT_CHECK_ERROR'
        }, 500);
      }
    }

    // 認証結果の通知データ
    const notificationData = {
      address: address,
      discordId: discordId,
      collectionIds: collectionIds,
      verificationResults: verificationResults,
      grantedRoles: grantedRoles,
      timestamp: new Date().toISOString()
    };

    // NFTが見つからない場合
    if (grantedRoles.length === 0) {
      // 既存認証ユーザーかを確認し、該当する場合はロール再付与を試みる
      try {
        const existingUsers = await getVerifiedUsers(c);
        const existingForThisAddress = existingUsers.find((u) =>
          u.discordId === discordId && (u.address || '').toLowerCase() === (address || '').toLowerCase()
        );

        if (existingForThisAddress) {
          // KVに保存されているコレクションIDを基準に、現在のコレクション一覧からロールを復元
          const savedCollectionIds = (existingForThisAddress.collectionId || '')
            .split(',')
            .filter((cid) => cid && cid.trim().length > 0);

          const collectionsData = await c.env.COLLECTION_STORE.get('collections');
          const allCollections: NFTCollection[] = collectionsData ? JSON.parse(collectionsData) : [];

          const regrantRoles = savedCollectionIds
            .map((cid) => allCollections.find((col) => col.id === cid))
            .filter((col): col is NFTCollection => Boolean(col))
            .map((col) => ({ roleId: col.roleId, roleName: col.roleName }));

          if (regrantRoles.length > 0) {
            const regrantData = {
              address,
              discordId,
              collectionIds: savedCollectionIds,
              verificationResults,
              grantedRoles: regrantRoles,
              notifyUser: false,
              reason: '既存の認証を検出しました。ロールを再付与します。',
              timestamp: new Date().toISOString()
            };

            await notifyDiscordBot(c, discordId, 'grant_roles', regrantData, { isBatch: false, kind: 'success_update' });

            // lastChecked の更新（verifiedAtは維持）
            await addVerifiedUser(c, {
              discordId,
              address,
              collectionId: existingForThisAddress.collectionId,
              roleId: regrantRoles[0].roleId,
              roleName: regrantRoles[0].roleName,
              verifiedAt: existingForThisAddress.verifiedAt,
              lastChecked: new Date().toISOString()
            });

            return c.json({
              success: true,
              data: {
                grantedRoles: regrantRoles,
                verificationResults,
                message: '既存の認証を検出しました。ロールを再付与しました。'
              }
            });
          }
        }
      } catch (e) {
        console.log('⚠️ Already-verified fallback handling failed:', e);
      }

      // 通常の失敗通知
      await notifyDiscordBot(c, discordId, 'verification_failed', {
        ...notificationData,
        reason: 'No NFTs found in any selected collections',
        errorCode: 'NO_NFTS'
      }, { isBatch: false, kind: 'failed' });
      
      return c.json({
        success: false,
        error: 'No NFTs found in selected collections',
        errorCode: 'NO_NFTS'
      }, 400);
    }

    // 認証済みユーザーとして保存（先に保存）
    await addVerifiedUser(c, {
      discordId: discordId,
      address: address,
      collectionId: Array.isArray(collectionIds) ? collectionIds.join(',') : 'default',
      roleId: grantedRoles[0].roleId, // 最初に付与されたロールIDを保存
      roleName: grantedRoles[0].roleName, // 最初に付与されたロール名を保存
      verifiedAt: new Date().toISOString(),
      lastChecked: new Date().toISOString()
    });

    // 使用済みナンスを削除
    await c.env.NONCE_STORE.delete(nonce);

    // Discordロール付与（保存後に通知）
    const roleGranted = await notifyDiscordBot(c, discordId, 'grant_roles', notificationData, { isBatch: false, kind: 'success_new' });
    if (!roleGranted) {
      console.log('⚠️ Discord notification failed, but verification succeeded');
    }

    console.log(`✅ Verification successful for ${address} (Discord: ${discordId})`);
    console.log(`✅ Granted roles: ${grantedRoles.map(r => r.roleName).join(', ')}`);

    return c.json({
      success: true,
      data: {
        grantedRoles: grantedRoles,
        verificationResults: verificationResults,
        message: `Verification completed successfully. ${grantedRoles.length} role(s) granted.`
      }
    });

  } catch (error) {
    console.error('Verification error:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// バッチ処理API
app.post('/api/admin/batch-check', async (c) => {
  try {
    // Adminトークン検証（フォールバック許容）
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    console.log('🔄 Starting batch check process...');
    
    const verifiedUsers = await getVerifiedUsers(c);
    console.log(`📊 Found ${verifiedUsers.length} verified users`);
    
    let processedCount = 0;
    let revokedCount = 0;
    let errorCount = 0;
    
    for (const user of verifiedUsers) {
      try {
        console.log(`🔍 Checking user ${user.discordId} for collection ${user.collectionId}`);
        
        // NFT保有状況をチェック
        // user.collectionIdはコレクションIDの配列なので、実際のpackageIdを取得する必要がある
        let hasNft = false;
        
        if (user.collectionId.includes(',')) {
          // 複数コレクションの場合
          const collectionIds = user.collectionId.split(',');
          for (const collectionId of collectionIds) {
            // コレクションIDからpackageIdを取得
            const collectionsData = await c.env.COLLECTION_STORE.get('collections');
            const collections = collectionsData ? JSON.parse(collectionsData) : [];
            const collection = collections.find((col: any) => col.id === collectionId);
            
            if (collection && collection.packageId) {
              const hasNftInCollection = await hasTargetNft(user.address, collection.packageId);
              if (hasNftInCollection) {
                hasNft = true;
                break;
              }
            }
          }
        } else {
          // 単一コレクションの場合
          const collectionsData = await c.env.COLLECTION_STORE.get('collections');
          const collections = collectionsData ? JSON.parse(collectionsData) : [];
          const collection = collections.find((col: any) => col.id === user.collectionId);
          
          if (collection && collection.packageId) {
            hasNft = await hasTargetNft(user.address, collection.packageId);
          }
        }
        
        if (!hasNft) {
          console.log(`❌ User ${user.discordId} no longer has NFT, revoking role`);
          
          // バッチ処理時はロール削除のみDM通知（チャンネル投稿は無効化）
          const revoked = await notifyDiscordBot(c, user.discordId, 'revoke_role', {
            address: user.address,
            collectionId: user.collectionId,
            reason: 'NFT no longer owned (自動チェック)',
            timestamp: new Date().toISOString()
          }, { isBatch: true, kind: 'revoked' });
          
          if (revoked) {
            // 認証済みユーザーリストから削除
            await removeVerifiedUser(c, user.discordId, user.collectionId);
            revokedCount++;
          }
        } else {
          console.log(`✅ User ${user.discordId} still has NFT`);
          // 所有している場合でも、万一ロールが外れていた時のため再付与を試みる
          // バッチ処理時はチャンネル投稿を無効化
          const collectionsData = await c.env.COLLECTION_STORE.get('collections');
          const allCollections = collectionsData ? JSON.parse(collectionsData) : [];
          const regrantCollectionIds = user.collectionId.split(',').filter(Boolean);
          const regrantRoles = regrantCollectionIds
            .map((cid) => allCollections.find((col: any) => col.id === cid))
            .filter((col: any) => col && col.roleId)
            .map((col: any) => ({ roleId: col.roleId, roleName: col.roleName }));

          if (regrantRoles.length > 0) {
            await notifyDiscordBot(c, user.discordId, 'grant_roles', {
              address: user.address,
              discordId: user.discordId,
              collectionIds: regrantCollectionIds,
              grantedRoles: regrantRoles,
              reason: 'Ensuring roles are granted for verified user (自動チェック)',
              timestamp: new Date().toISOString()
            }, { isBatch: true, kind: 'success_update' });
          }
        }
        
        processedCount++;
      } catch (error) {
        console.error(`❌ Error processing user ${user.discordId}:`, error);
        errorCount++;
      }
    }
    
    console.log(`✅ Batch check completed: ${processedCount} processed, ${revokedCount} revoked, ${errorCount} errors`);
    
    return c.json({
      success: true,
      summary: {
        totalUsers: verifiedUsers.length,
        processed: processedCount,
        revoked: revokedCount,
        errors: errorCount
      }
    });
    
  } catch (error) {
    console.error('❌ Batch check error:', error);
    return c.json({
      success: false,
      error: 'Failed to execute batch check'
    }, 500);
  }
});

// 認証済みユーザー一覧取得API
app.get('/api/admin/verified-users', async (c) => {
  try {
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    const users = await getVerifiedUsers(c);
    
    return c.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error getting verified users:', error);
    return c.json({
      success: false,
      error: 'Failed to get verified users'
    }, 500);
  }
});

// 認証不要の公開ビュー（匿名化）
app.get('/api/verified-users-public', async (c) => {
  try {
    const users = await getVerifiedUsers(c);
    const mask = (s: string) => s && s.length > 10 ? `${s.slice(0, 6)}...${s.slice(-4)}` : s;
    const data = users.map((u) => ({
      discordId: mask(String(u.discordId)),
      address: mask(String(u.address)),
      roleName: u.roleName,
      verifiedAt: u.verifiedAt
    }));
    return c.json({ success: true, data, count: data.length });
  } catch (e) {
    return c.json({ success: false, error: 'Failed to get public verified users' }, 500);
  }
});

// デバッグ用: 認証済みユーザー一覧を詳細表示
app.get('/api/admin/debug/verified-users', async (c) => {
  try {
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    const users = await getVerifiedUsers(c);
    
    console.log('🔍 Debug: Verified users in KV store:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. Discord ID: ${user.discordId}`);
      console.log(`   Address: ${user.address}`);
      console.log(`   Collection ID: ${user.collectionId}`);
      console.log(`   Role: ${user.roleName} (${user.roleId})`);
      console.log(`   Verified At: ${user.verifiedAt}`);
      console.log(`   Last Checked: ${user.lastChecked}`);
      console.log('---');
    });
    
    return c.json({
      success: true,
      data: users,
      count: users.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting verified users for debug:', error);
    return c.json({
      success: false,
      error: 'Failed to get verified users for debug'
    }, 500);
  }
});

// デバッグ用: 特定のDiscord IDでユーザーを検索
app.get('/api/admin/debug/user/:discordId', async (c) => {
  try {
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    const discordId = c.req.param('discordId');
    const users = await getVerifiedUsers(c);
    
    const user = users.find(u => u.discordId === discordId);
    
    if (user) {
      console.log(`🔍 Debug: Found user for Discord ID ${discordId}:`);
      console.log(`   Address: ${user.address}`);
      console.log(`   Collection ID: ${user.collectionId}`);
      console.log(`   Role: ${user.roleName} (${user.roleId})`);
      console.log(`   Verified At: ${user.verifiedAt}`);
      console.log(`   Last Checked: ${user.lastChecked}`);
      
      return c.json({
        success: true,
        found: true,
        data: user
      });
    } else {
      console.log(`🔍 Debug: User not found for Discord ID ${discordId}`);
      return c.json({
        success: true,
        found: false,
        message: `User with Discord ID ${discordId} not found in verified users`
      });
    }
  } catch (error) {
    console.error('Error searching for user:', error);
    return c.json({
      success: false,
      error: 'Failed to search for user'
    }, 500);
  }
});

// バッチ処理の設定
interface BatchConfig {
  enabled: boolean;
  interval: number; // 分単位
  lastRun: string;
  nextRun: string;
  maxUsersPerBatch: number;
  retryAttempts: number;
  enableDmNotifications: boolean; // DM通知の有効/無効
}

// バッチ処理の統計
interface BatchStats {
  totalUsers: number;
  processed: number;
  revoked: number;
  errors: number;
  lastRun: string;
  duration: number; // ミリ秒
}

// バッチ処理設定の取得
async function getBatchConfig(c: Context<{ Bindings: Env }>): Promise<BatchConfig> {
  try {
    const configData = await c.env.COLLECTION_STORE.get('batch_config');
    if (configData) {
      return JSON.parse(configData as string);
    }
    // デフォルト設定
    const defaultConfig: BatchConfig = {
      enabled: true,
      interval: 60, // 60分間隔
      lastRun: new Date(0).toISOString(),
      nextRun: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      maxUsersPerBatch: 50,
      retryAttempts: 3,
      enableDmNotifications: false // デフォルトでDM通知は無効
    };
    await c.env.COLLECTION_STORE.put('batch_config', JSON.stringify(defaultConfig));
    return defaultConfig;
  } catch (error) {
    console.error('Error getting batch config:', error);
    return {
      enabled: true,
      interval: 60,
      lastRun: new Date(0).toISOString(),
      nextRun: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      maxUsersPerBatch: 50,
      retryAttempts: 3,
      enableDmNotifications: false
    };
  }
}

// バッチ処理設定の更新
async function updateBatchConfig(c: Context<{ Bindings: Env }>, config: Partial<BatchConfig>): Promise<boolean> {
  try {
    const currentConfig = await getBatchConfig(c);
    const updatedConfig = { ...currentConfig, ...config };
    
    // nextRunを再計算
    if (config.interval) {
      updatedConfig.nextRun = new Date(Date.now() + config.interval * 60 * 1000).toISOString();
    }
    
    await c.env.COLLECTION_STORE.put('batch_config', JSON.stringify(updatedConfig));
    return true;
  } catch (error) {
    console.error('Error updating batch config:', error);
    return false;
  }
}

// バッチ処理統計の取得
async function getBatchStats(c: Context<{ Bindings: Env }>): Promise<BatchStats> {
  try {
    const statsData = await c.env.COLLECTION_STORE.get('batch_stats');
    return statsData ? JSON.parse(statsData as string) : {
      totalUsers: 0,
      processed: 0,
      revoked: 0,
      errors: 0,
      lastRun: new Date(0).toISOString(),
      duration: 0
    };
  } catch (error) {
    console.error('Error getting batch stats:', error);
    return {
      totalUsers: 0,
      processed: 0,
      revoked: 0,
      errors: 0,
      lastRun: new Date(0).toISOString(),
      duration: 0
    };
  }
}

// バッチ処理統計の更新
async function updateBatchStats(c: Context<{ Bindings: Env }>, stats: Partial<BatchStats>): Promise<boolean> {
  try {
    const currentStats = await getBatchStats(c);
    const updatedStats = { ...currentStats, ...stats };
    await c.env.COLLECTION_STORE.put('batch_stats', JSON.stringify(updatedStats));
    return true;
  } catch (error) {
    console.error('Error updating batch stats:', error);
    return false;
  }
}

// バッチ処理実行関数
async function executeBatchCheck(c: Context<{ Bindings: Env }>): Promise<BatchStats> {
  const startTime = Date.now();
  console.log('🔄 Starting batch check process...');
  
  try {
    const verifiedUsers = await getVerifiedUsers(c);
    const batchConfig = await getBatchConfig(c);
    
    console.log(`📊 Found ${verifiedUsers.length} verified users`);
    console.log(`⚙️ Batch config: ${JSON.stringify(batchConfig)}`);
    
    let processedCount = 0;
    let revokedCount = 0;
    let errorCount = 0;
    
    // バッチサイズを制限
    const usersToProcess = verifiedUsers.slice(0, batchConfig.maxUsersPerBatch);
    
    for (const user of usersToProcess) {
      try {
        console.log(`🔍 Checking user ${user.discordId} for collection ${user.collectionId}`);
        
        // NFT保有状況をチェック
        // user.collectionIdはコレクションIDの配列なので、実際のpackageIdを取得する必要がある
        let hasNft = false;
        
        if (user.collectionId.includes(',')) {
          // 複数コレクションの場合
          const collectionIds = user.collectionId.split(',');
          for (const collectionId of collectionIds) {
            // コレクションIDからpackageIdを取得
            const collectionsData = await c.env.COLLECTION_STORE.get('collections');
            const collections = collectionsData ? JSON.parse(collectionsData) : [];
            const collection = collections.find((col: any) => col.id === collectionId);
            
            if (collection && collection.packageId) {
              const hasNftInCollection = await hasTargetNft(user.address, collection.packageId);
              if (hasNftInCollection) {
                hasNft = true;
                break;
              }
            }
          }
        } else {
          // 単一コレクションの場合
          const collectionsData = await c.env.COLLECTION_STORE.get('collections');
          const collections = collectionsData ? JSON.parse(collectionsData) : [];
          const collection = collections.find((col: any) => col.id === user.collectionId);
          
          if (collection && collection.packageId) {
            hasNft = await hasTargetNft(user.address, collection.packageId);
          }
        }
        
        if (!hasNft) {
          console.log(`❌ User ${user.discordId} no longer has NFT, revoking role`);
          
          // バッチ処理時はロール削除のみDM通知（チャンネル投稿は無効化）
          const revoked = await notifyDiscordBot(c, user.discordId, 'revoke_role', {
            address: user.address,
            collectionId: user.collectionId,
            reason: 'NFT no longer owned (自動チェック)',
            timestamp: new Date().toISOString()
          }, { isBatch: true, kind: 'revoked' });
          
          if (revoked) {
            // 認証済みユーザーリストから削除
            await removeVerifiedUser(c, user.discordId, user.collectionId);
            revokedCount++;
          }
        } else {
          console.log(`✅ User ${user.discordId} still has NFT`);
          
          // 最終チェック日時を更新
          console.log(`🔄 Starting lastChecked update for user ${user.discordId} (auto)`);
          const updateResult = await updateVerifiedUserLastChecked(c, user.discordId, user.collectionId);
          console.log(`📊 lastChecked update result (auto): ${updateResult}`);
          
          // 所有している場合でも、万一ロールが外れていた時のため再付与を試みる
          // バッチ処理時はチャンネル投稿を無効化
          const collectionsData = await c.env.COLLECTION_STORE.get('collections');
          const allCollections = collectionsData ? JSON.parse(collectionsData) : [];
          const regrantCollectionIds = user.collectionId.split(',').filter(Boolean);
          const regrantRoles = regrantCollectionIds
            .map((cid) => allCollections.find((col: any) => col.id === cid))
            .filter((col: any) => col && col.roleId)
            .map((col: any) => ({ roleId: col.roleId, roleName: col.roleName }));

          if (regrantRoles.length > 0) {
            // バッチ処理設定に基づいてDM通知を制御
            if (batchConfig.enableDmNotifications) {
              await notifyDiscordBot(c, user.discordId, 'grant_roles', {
                address: user.address,
                discordId: user.discordId,
                collectionIds: regrantCollectionIds,
                grantedRoles: regrantRoles,
                reason: 'Ensuring roles are granted for verified user (自動チェック)',
                timestamp: new Date().toISOString()
              }, { isBatch: true, kind: 'success_update' });
            } else {
              console.log(`📧 DM通知が無効のため、ロール再付与通知をスキップ`);
            }
          }
        }
        
        processedCount++;
      } catch (error) {
        console.error(`❌ Error processing user ${user.discordId}:`, error);
        errorCount++;
      }
    }
    
    const duration = Date.now() - startTime;
    const stats: BatchStats = {
      totalUsers: verifiedUsers.length,
      processed: processedCount,
      revoked: revokedCount,
      errors: errorCount,
      lastRun: new Date().toISOString(),
      duration
    };
    
    // 統計を更新
    await updateBatchStats(c, stats);
    
    // 設定を更新（次回実行時刻を設定）
    await updateBatchConfig(c, {
      lastRun: new Date().toISOString(),
      nextRun: new Date(Date.now() + batchConfig.interval * 60 * 1000).toISOString()
    });
    
    console.log(`✅ Batch check completed: ${processedCount} processed, ${revokedCount} revoked, ${errorCount} errors`);
    console.log(`⏱️ Duration: ${duration}ms`);
    
    return stats;
    
  } catch (error) {
    console.error('❌ Batch check error:', error);
    const duration = Date.now() - startTime;
    const stats: BatchStats = {
      totalUsers: 0,
      processed: 0,
      revoked: 0,
      errors: 1,
      lastRun: new Date().toISOString(),
      duration
    };
    await updateBatchStats(c, stats);
    return stats;
  }
}

// バッチ処理実行API（手動実行用）
app.post('/api/admin/batch-execute', async (c) => {
  try {
    console.log('🔄 Manual batch execution requested...');
    // セキュリティ緩和: Authorization が無い場合でも、X-Admin-Address が管理者なら許可
    const tokenCheck = await verifyAdminToken(c);
    if (!tokenCheck.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) {
        return c.json({ success: false, error: 'Unauthorized', reason: (tokenCheck as any).reason || 'no_token_and_not_admin_header' }, 401);
      }
    }

    const stats = await executeBatchCheck(c);
    
    return c.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Manual batch execution error:', error);
    return c.json({
      success: false,
      error: 'Failed to execute batch check'
    }, 500);
  }
});

// バッチ処理設定取得API
app.get('/api/admin/batch-config', async (c) => {
  try {
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    const config = await getBatchConfig(c);
    const stats = await getBatchStats(c);
    
    return c.json({
      success: true,
      data: {
        config,
        stats
      }
    });
  } catch (error) {
    console.error('Error getting batch config:', error);
    return c.json({
      success: false,
      error: 'Failed to get batch configuration'
    }, 500);
  }
});

// バッチ処理設定更新API
app.put('/api/admin/batch-config', async (c) => {
  try {
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    const body = await c.req.json();
    const { enabled, interval, maxUsersPerBatch, retryAttempts } = body;
    
    const success = await updateBatchConfig(c, {
      enabled,
      interval,
      maxUsersPerBatch,
      retryAttempts
    });
    
    if (success) {
      const updatedConfig = await getBatchConfig(c);
      return c.json({
        success: true,
        data: updatedConfig
      });
    } else {
      return c.json({
        success: false,
        error: 'Failed to update batch configuration'
      }, 500);
    }
  } catch (error) {
    console.error('Error updating batch config:', error);
    return c.json({
      success: false,
      error: 'Failed to update batch configuration'
    }, 500);
  }
});

// DM通知設定 取得API
app.get('/api/admin/dm-settings', async (c) => {
  try {
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    const settings = await getDmSettings(c);
    return c.json({ success: true, data: settings });
  } catch (e) {
    return c.json({ success: false, error: 'Failed to get DM settings' }, 500);
  }
});

// DM通知設定 更新API
app.put('/api/admin/dm-settings', async (c) => {
  try {
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    const body = await c.req.json();
    const updated = await updateDmSettings(c, body);
    return c.json({ success: true, data: updated });
  } catch (e) {
    return c.json({ success: false, error: 'Failed to update DM settings' }, 500);
  }
});

// DM設定初期化API
app.post('/api/admin/dm-settings/initialize', async (c) => {
  try {
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    
    // デフォルト設定で初期化
    const defaultSettings: DmSettings = {
      mode: 'all', // 通常認証時は全ての通知
      batchMode: 'new_and_revoke', // バッチ処理時は新規とロール削除のみ
      templates: {
        successNew: {
          title: '🎉 Verification Completed',
          description: '**Your NFT verification is complete!**\n\n**Verified NFT Collection:**\n• {collectionName}\n\n**Granted Roles:**\n• {roles}\n\nIt may take a moment for roles to appear in the server.\n\nThank you for verifying!',
          color: 0x00ff00
        },
        successUpdate: {
          title: '🔄 Verification Updated',
          description: '**Your NFT verification has been updated!**\n\n**Verified NFT Collection:**\n• {collectionName}\n\n**Updated Roles:**\n• {roles}\n\nIt may take a moment for roles to appear in the server.\n\nThank you!',
          color: 0x0099ff
        },
        failed: {
          title: '❌ Verification Failed',
          description: '**Verification failed.**\n\nPlease check the following and try again:\n• You hold the target collection NFT\n• You are connected with the correct wallet\n• Your network connection is stable\n\nIf the issue persists, please contact an administrator.',
          color: 0xff0000
        },
        revoked: {
          title: '⚠️ Role Revoked',
          description: '**Your role has been revoked because your NFT ownership could not be confirmed.**\n\n**Revoked Roles:**\n• {roles}\n\n**How to restore:**\n• If you reacquire the NFT, please re-verify from the verification channel\n• If you changed wallets, please verify with the new wallet\n\nIf you have any questions, please contact an administrator.',
          color: 0xff6600
        }
      },
      channelTemplates: {
        verificationChannel: {
          title: '🎫 NFT Verification System',
          description: 'This system grants roles to users who hold NFTs on the Sui network.\n\nClick the button below to start verification.',
          color: 0x57F287
        },
        verificationStart: {
          title: '🎫 NFT Verification',
          description: 'Starting verification...\n\n⚠️ **Note:** Wallet signatures are safe. We only verify NFT ownership and do not move any assets.',
          color: 0x57F287
        }
      }
    };
    
    const dmStore = (c.env.DM_TEMPLATE_STORE || c.env.COLLECTION_STORE) as KVNamespace;
    await dmStore.put('dm_settings', JSON.stringify(defaultSettings));
    // 旧ストアをクリーンアップ
    if (c.env.DM_TEMPLATE_STORE) {
      try { await c.env.COLLECTION_STORE.delete('dm_settings'); } catch {}
    }
    
    return c.json({
      success: true,
      data: defaultSettings
    });
  } catch (error) {
    console.error('Error initializing DM settings:', error);
    return c.json({
      success: false,
      error: 'Failed to initialize DM settings'
    }, 500);
  }
});

// チャンネルテンプレート取得API（Bot用）
app.get('/api/channel-templates', async (c) => {
  try {
    const dmSettings = await getDmSettings(c);
    return c.json({ 
      success: true, 
      data: dmSettings.channelTemplates 
    });
  } catch (e) {
    return c.json({ 
      success: false, 
      error: 'Failed to get channel templates',
      fallback: {
        verificationChannel: {
          title: '🎫 NFT Verification System',
          description: 'This system grants roles to users who hold NFTs on the Sui network.\n\nClick the button below to start verification.',
          color: 0x57F287
        },
        verificationStart: {
          title: '🎫 NFT Verification',
          description: 'Starting verification...\n\n⚠️ **Note:** Wallet signatures are safe. We only verify NFT ownership and do not move any assets.',
          color: 0x57F287
        }
      }
    }, 500);
  }
});

// バッチ処理統計取得API
app.get('/api/admin/batch-stats', async (c) => {
  try {
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    const stats = await getBatchStats(c);
    
    return c.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting batch stats:', error);
    return c.json({
      success: false,
      error: 'Failed to get batch statistics'
    }, 500);
  }
});

// バッチ処理実行スケジュール確認API
app.get('/api/admin/batch-schedule', async (c) => {
  try {
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    const config = await getBatchConfig(c);
    const now = new Date();
    const nextRun = new Date(config.nextRun);
    const isOverdue = now > nextRun;
    
    return c.json({
      success: true,
      data: {
        config,
        schedule: {
          isEnabled: config.enabled,
          isOverdue,
          nextRun: config.nextRun,
          lastRun: config.lastRun,
          intervalMinutes: config.interval
        }
      }
    });
  } catch (error) {
    console.error('Error getting batch schedule:', error);
    return c.json({
      success: false,
      error: 'Failed to get batch schedule'
    }, 500);
  }
});

// 手動実行用のバッチ処理関数（チャンネル投稿有効）
async function executeBatchCheckManual(c: Context<{ Bindings: Env }>): Promise<BatchStats> {
  const startTime = Date.now();
  console.log('🔄 Starting manual batch check process...');
  
  try {
    const verifiedUsers = await getVerifiedUsers(c);
    const batchConfig = await getBatchConfig(c);
    
    console.log(`📊 Found ${verifiedUsers.length} verified users`);
    console.log(`⚙️ Batch config: ${JSON.stringify(batchConfig)}`);
    
    let processedCount = 0;
    let revokedCount = 0;
    let errorCount = 0;
    
    // バッチサイズを制限
    const usersToProcess = verifiedUsers.slice(0, batchConfig.maxUsersPerBatch);
    
    for (const user of usersToProcess) {
      try {
        console.log(`🔍 Checking user ${user.discordId} for collection ${user.collectionId}`);
        
        // NFT保有状況をチェック
        let hasNft = false;
        
        if (user.collectionId.includes(',')) {
          // 複数コレクションの場合
          const collectionIds = user.collectionId.split(',');
          for (const collectionId of collectionIds) {
            const collectionsData = await c.env.COLLECTION_STORE.get('collections');
            const collections = collectionsData ? JSON.parse(collectionsData) : [];
            const collection = collections.find((col: any) => col.id === collectionId);
            
            if (collection && collection.packageId) {
              const hasNftInCollection = await hasTargetNft(user.address, collection.packageId);
              if (hasNftInCollection) {
                hasNft = true;
                break;
              }
            }
          }
        } else {
          // 単一コレクションの場合
          const collectionsData = await c.env.COLLECTION_STORE.get('collections');
          const collections = collectionsData ? JSON.parse(collectionsData) : [];
          const collection = collections.find((col: any) => col.id === user.collectionId);
          
          if (collection && collection.packageId) {
            hasNft = await hasTargetNft(user.address, collection.packageId);
          }
        }
        
        if (!hasNft) {
          console.log(`❌ User ${user.discordId} no longer has NFT, revoking role`);
          
          // 手動実行時は通常の通知（チャンネル投稿有効）
          const revoked = await notifyDiscordBot(c, user.discordId, 'revoke_role', {
            address: user.address,
            collectionId: user.collectionId,
            reason: 'NFT no longer owned (手動チェック)',
            timestamp: new Date().toISOString()
          }, { isBatch: false, kind: 'revoked' });
          
          if (revoked) {
            await removeVerifiedUser(c, user.discordId, user.collectionId);
            revokedCount++;
          }
        } else {
          console.log(`✅ User ${user.discordId} still has NFT`);
          
          // 最終チェック日時を更新
          console.log(`🔄 Starting lastChecked update for user ${user.discordId} (manual)`);
          const updateResult = await updateVerifiedUserLastChecked(c, user.discordId, user.collectionId);
          console.log(`📊 lastChecked update result (manual): ${updateResult}`);
          
          // 所有している場合でも、万一ロールが外れていた時のため再付与を試みる
          const collectionsData = await c.env.COLLECTION_STORE.get('collections');
          const allCollections = collectionsData ? JSON.parse(collectionsData) : [];
          const regrantCollectionIds = user.collectionId.split(',').filter(Boolean);
          const regrantRoles = regrantCollectionIds
            .map((cid) => allCollections.find((col: any) => col.id === cid))
            .filter((col: any) => col && col.roleId)
            .map((col: any) => ({ roleId: col.roleId, roleName: col.roleName }));

          if (regrantRoles.length > 0) {
            await notifyDiscordBot(c, user.discordId, 'grant_roles', {
              address: user.address,
              discordId: user.discordId,
              collectionIds: regrantCollectionIds,
              grantedRoles: regrantRoles,
              reason: 'Ensuring roles are granted for verified user (手動チェック)',
              timestamp: new Date().toISOString()
            }, { isBatch: false, kind: 'success_update' });
          }
        }
        
        processedCount++;
      } catch (error) {
        console.error(`❌ Error processing user ${user.discordId}:`, error);
        errorCount++;
      }
    }
    
    const duration = Date.now() - startTime;
    const stats: BatchStats = {
      totalUsers: verifiedUsers.length,
      processed: processedCount,
      revoked: revokedCount,
      errors: errorCount,
      lastRun: new Date().toISOString(),
      duration
    };
    
    // 統計を更新
    await updateBatchStats(c, stats);
    
    // 設定を更新（次回実行時刻を設定）
    await updateBatchConfig(c, {
      lastRun: new Date().toISOString(),
      nextRun: new Date(Date.now() + batchConfig.interval * 60 * 1000).toISOString()
    });
    
    console.log(`✅ Manual batch check completed: ${processedCount} processed, ${revokedCount} revoked, ${errorCount} errors`);
    console.log(`⏱️ Duration: ${duration}ms`);
    
    return stats;
    
  } catch (error) {
    console.error('❌ Manual batch check error:', error);
    const duration = Date.now() - startTime;
    const stats: BatchStats = {
      totalUsers: 0,
      processed: 0,
      revoked: 0,
      errors: 1,
      lastRun: new Date().toISOString(),
      duration
    };
    await updateBatchStats(c, stats);
    return stats;
  }
}

// バッチ処理実行API（手動実行用）
app.post('/api/admin/batch-execute', async (c) => {
  try {
    console.log('🔄 Manual batch execution requested...');
    // セキュリティ緩和: Authorization が無い場合でも、X-Admin-Address が管理者なら許可
    const tokenCheck = await verifyAdminToken(c);
    if (!tokenCheck.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) {
        return c.json({ success: false, error: 'Unauthorized', reason: (tokenCheck as any).reason || 'no_token_and_not_admin_header' }, 401);
      }
    }

    // 手動実行時は通常の通知（チャンネル投稿有効）
    const stats = await executeBatchCheckManual(c);
    
    return c.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('❌ Manual batch execution error:', error);
    return c.json({
      success: false,
      error: 'Failed to execute batch check'
    }, 500);
  }
});

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    try {
      const c = { env } as unknown as Context<{ Bindings: Env }>;
      const stats = await executeBatchCheck(c);
      console.log('✅ Scheduled batch executed:', stats);
    } catch (e) {
      console.error('❌ Scheduled handler error:', e);
    }
  }
};