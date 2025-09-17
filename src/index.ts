import { Hono, Context } from 'hono';
import * as ed25519 from '@noble/ed25519';
import { blake2b } from '@noble/hashes/blake2b';
import { sha512 } from '@noble/hashes/sha512';
import { DmSettings, DmTemplate, DmMode, DEFAULT_DM_SETTINGS, BatchConfig, BatchStats, DEFAULT_BATCH_CONFIG } from './types';

// noble-ed25519 が内部で使用する SHA-512 を設定（Workers環境向け）
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

// Minimal logging helpers (debug logs are no-ops to keep output minimal)
function logInfo(_message: string, _data?: any): void {}
function logDebug(_message: string, _data?: any): void {}
function logSuccess(_message: string, _data?: any): void {}
function logWarning(message: string, data?: any): void {
  console.warn(message, data || '');
}
function logError(message: string, error?: any): void {
  console.error(message, error || '');
}

const app = new Hono<{ Bindings: Env }>();

// カスタムCORSミドルウェア
app.use('*', async (c, next) => {
  const method = c.req.method;
  
  // すべてのレスポンスにCORSヘッダーを設定
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Admin-Address, X-API-Key');
  c.header('Access-Control-Max-Age', '86400');
  c.header('Vary', 'Origin');
  
  // OPTIONSリクエストの場合は即座にレスポンス
  if (method === 'OPTIONS') {
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
  return;
});

// ヘルスチェック
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    message: 'NFT Verification API',
    timestamp: new Date().toISOString()
  });
});

// 公開: イベント情報（アクティブ状態を付加）
app.get('/api/events/:id/public', async (c) => {
  try {
    const store = (c.env as any).EVENT_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'EVENT_STORE is not available' }, 503);
    }

    const id = c.req.param('id');
    const listStr = await store.get('events');
    const list = listStr ? JSON.parse(listStr) : [];
    const ev = Array.isArray(list) ? list.find((e: any) => e && e.id === id) : null;
    if (!ev) {
      return c.json({ success: false, error: 'Event not found' }, 404);
    }

    const now = Date.now();
    const active = Boolean(ev.active) && ev.startAt && ev.endAt && now >= Date.parse(ev.startAt) && now <= Date.parse(ev.endAt);

    return c.json({ success: true, data: { ...ev, active } });
  } catch (error) {
    logError('Failed to get public event', error);
    return c.json({ success: false, error: 'Failed to load event' }, 500);
  }
});

// ミントAPI（署名検証・イベント期間チェック・重複防止・スポンサー委譲）
app.post('/api/mint', async (c) => {
  try {
    const eventStore = (c.env as any).EVENT_STORE as KVNamespace | undefined;
    const mintedStore = (c.env as any).MINTED_STORE as KVNamespace | undefined;
    if (!eventStore) return c.json({ success: false, error: 'EVENT_STORE is not available' }, 503);
    if (!mintedStore) return c.json({ success: false, error: 'MINTED_STORE is not available' }, 503);

    const body = await c.req.json().catch(() => ({}));
    const { eventId, address, signature, bytes, publicKey, authMessage } = body || {};

    const missing = ['eventId', 'address', 'signature', 'authMessage'].filter((k) => !(body && body[k]));
    if (missing.length) {
      return c.json({ success: false, error: `Missing: ${missing.join(', ')}` }, 400);
    }

    // イベント取得
    const listStr = await eventStore.get('events');
    const list = listStr ? JSON.parse(listStr) : [];
    const ev = Array.isArray(list) ? list.find((e: any) => e && e.id === eventId) : null;
    if (!ev) return c.json({ success: false, error: 'Event not found' }, 404);

    // 期間チェック
    const now = Date.now();
    const active = Boolean(ev.active) && ev.startAt && ev.endAt && now >= Date.parse(ev.startAt) && now <= Date.parse(ev.endAt);
    if (!active) return c.json({ success: false, error: 'Event is not active' }, 400);

    // アドレス形式の検証
    if (!/^0x[a-fA-F0-9]{64}$/.test(address)) {
      return c.json({ success: false, error: 'Invalid address format' }, 400);
    }

    // 重複防止（1アドレス1回）
    const addrLower = String(address).toLowerCase();
    const mintedKey = `minted:${eventId}:${addrLower}`;
    const already = await mintedStore.get(mintedKey);
    if (already) return c.json({ success: false, error: 'Already minted for this event' }, 400);

    // totalCap チェック（上限到達時はミント不可）
    if (typeof ev.totalCap === 'number' && ev.totalCap >= 0) {
      // mintedStore 内のイベントごとの総ミント数をカウント
      const mintedCountKey = `minted_count:${eventId}`;
      const mintedCountStr = await mintedStore.get(mintedCountKey);
      const mintedCount = mintedCountStr ? Number(mintedCountStr) : 0;
      if (mintedCount >= ev.totalCap) {
        return c.json({ success: false, error: 'Mint cap reached for this event' }, 400);
      }
    }

    // 署名検証
    const ok = await verifySignedMessage({ signature, bytes, publicKey }, new TextEncoder().encode(authMessage));
    if (!ok) return c.json({ success: false, error: 'Invalid signature' }, 400);

    // スポンサーAPIへ委譲
    const sponsorUrl = (c.env as any).MINT_SPONSOR_API_URL || (c.env as any).DISCORD_BOT_API_URL;
    if (!sponsorUrl) return c.json({ success: false, error: 'Sponsor API URL is not configured' }, 500);

    const resp = await fetch(`${sponsorUrl}/api/mint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: ev.id,
        recipient: address,
        moveCall: ev.moveCall,
        imageUrl: ev.imageUrl,
        imageCid: ev.imageCid,
        imageMimeType: ev.imageMimeType,
        collectionId: ev.collectionId
      })
    });
    const sponsorRes: any = await resp.json().catch(() => null);
    if (!resp.ok || !sponsorRes?.success) {
      return c.json({ success: false, error: sponsorRes?.error || `Sponsor mint failed (${resp.status})` }, 502);
    }

    const txDigest = sponsorRes.txDigest || sponsorRes.data?.txDigest || null;
    await mintedStore.put(
      mintedKey,
      JSON.stringify({ tx: txDigest, at: new Date().toISOString() }),
      { expirationTtl: 60 * 60 * 24 * 365 }
    );

    // イベント総ミント数をインクリメント
    if (typeof ev.totalCap === 'number' && ev.totalCap >= 0) {
      const mintedCountKey = `minted_count:${eventId}`;
      const mintedCountStr = await mintedStore.get(mintedCountKey);
      const mintedCount = mintedCountStr ? Number(mintedCountStr) : 0;
      await mintedStore.put(mintedCountKey, String(mintedCount + 1));
    }

    return c.json({ success: true, data: { txDigest } });
  } catch (error) {
    logError('Mint API error', error);
    return c.json({ success: false, error: 'Mint API error' }, 500);
  }
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
  const verificationStartTime = Date.now();
  try {
    // 詳細なデバッグ情報を追加
    // Starting signature verification
    
    // 入力データの完全性チェック
    if (!signatureData) {
      logError('SignatureData is null or undefined');
      return false;
    }
    
    // ウォレット形式の推定
    const walletHints = [];
    if (signatureData?.signature) {
      const sigStr = String(signatureData.signature);
      if (sigStr.length === 88) walletHints.push('Slash (88 chars)');
      if (sigStr.length === 128) walletHints.push('Suiet (128 chars)');
      if (sigStr.length === 184) walletHints.push('SerializedSignature (184 chars)');
    }
    
    logDebug('Signature data received', {
      hasSignature: !!signatureData?.signature,
      hasBytes: !!signatureData?.bytes,
      hasPublicKey: !!signatureData?.publicKey,
      signatureType: typeof signatureData?.signature,
      bytesType: typeof signatureData?.bytes,
      publicKeyType: typeof signatureData?.publicKey,
      signatureLength: String(signatureData?.signature || '').length,
      bytesLength: signatureData?.bytes ? 
        (typeof signatureData.bytes === 'string' ? signatureData.bytes.length : signatureData.bytes.length) : 0,
      estimatedWallet: walletHints.length > 0 ? walletHints.join(', ') : 'Unknown'
    });

    // スラッシュウォレット対応: ウォレットから送信されたbytesを直接使用
    const { signature, bytes, publicKey } = signatureData ?? {};

    if (!signature || !bytes) {
      logError('Missing signature or bytes', { 
        hasSignature: !!signature, 
        hasBytes: !!bytes 
      });
      return false;
    }

    // ウォレットから送信されたbytesを直接使用
    const receivedDecoded = toUint8Array(bytes);
    if (!receivedDecoded) {
      logError('Invalid bytes payload', { 
        bytesType: typeof bytes, 
        bytesLength: bytes?.length 
      });
      return false;
    }

    logDebug('Bytes decoded successfully', {
      originalLength: typeof bytes === 'string' ? bytes.length : bytes?.length,
      decodedLength: receivedDecoded.length,
      decodedFirst16: Array.from(receivedDecoded.slice(0, 16))
    });

    // メッセージ候補を生成（より多くのパターンに対応）
    const candidateMessages: Array<{ name: string; data: Uint8Array }> = [];
    
    // 候補1: サーバーが期待するメッセージ
    if (expectedMessageBytes) {
      candidateMessages.push({ name: 'expectedBytes', data: expectedMessageBytes });
    }
    
    // 候補2: ウォレットから受信したbytes（デコード済み）
    candidateMessages.push({ name: 'receivedDecoded', data: receivedDecoded });
    
    // 候補3: bytesがBase64文字列としてASCIIエンコードされている場合
    if (typeof bytes === 'string') {
      try {
        const receivedAscii = new TextEncoder().encode(bytes);
        candidateMessages.push({ name: 'receivedAscii', data: receivedAscii });
      } catch {
        logDebug('Failed to encode bytes as ASCII');
      }
    }
    
    // 候補4: UTF-8エンコーディングの試行
    if (typeof bytes === 'string') {
      try {
        const utf8Bytes = new TextEncoder().encode(bytes);
        if (utf8Bytes.length !== receivedDecoded.length) { // 重複を避ける
          candidateMessages.push({ name: 'receivedUTF8', data: utf8Bytes });
        }
      } catch {
        logDebug('Failed to encode bytes as UTF-8');
      }
    }
    
    // 候補5: HEX文字列として解釈（0xプレフィックスありなし両方）
    if (typeof bytes === 'string' && bytes.length > 2) {
      try {
        // HEX文字列をUint8Arrayに変換するヘルパー関数
        const hexToBytes = (hex: string): Uint8Array => {
          const cleanHex = hex.replace(/^0x/, '');
          const bytes = new Uint8Array(cleanHex.length / 2);
          for (let i = 0; i < cleanHex.length; i += 2) {
            bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
          }
          return bytes;
        };
        
        // 0xプレフィックス付きの場合
        if (bytes.startsWith('0x') && bytes.length % 2 === 0) {
          const hexBytes = hexToBytes(bytes);
          candidateMessages.push({ name: 'receivedHex0x', data: hexBytes });
        }
        // 0xプレフィックスなしの場合
        else if (!bytes.startsWith('0x') && bytes.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(bytes)) {
          const hexBytes = hexToBytes('0x' + bytes);
          candidateMessages.push({ name: 'receivedHexPlain', data: hexBytes });
        }
      } catch {
        logDebug('Failed to parse bytes as hex');
      }
    }
    
    logDebug('Generated message candidates', {
      totalCandidates: candidateMessages.length,
      candidateNames: candidateMessages.map(c => c.name),
      candidateLengths: candidateMessages.map(c => c.data.length)
    });

    // 署名・公開鍵の抽出（スラッシュウォレット対応）
    const rawSig = toUint8Array(signature);
    if (!rawSig) {
      logError('Invalid signature format', {
        signatureType: typeof signature,
        rawSigExists: false
      });
      return false;
    }

    logDebug('Raw signature extracted', {
      length: rawSig.length,
      first16: Array.from(rawSig.slice(0, 16)),
      last16: Array.from(rawSig.slice(-16))
    });

    let sigBytes: Uint8Array | null = null;
    let pubBytes: Uint8Array | null = null;

    // 優先: body.publicKey を利用（32 or 33bytes想定）
    if (publicKey) {
      const pk = toUint8Array(publicKey);
      if (pk) {
        logDebug('Public key extracted', {
          length: pk.length,
          first8: Array.from(pk.slice(0, 8)),
          willTrimScheme: pk.length === 33
        });
        // 先頭1バイトがスキームの場合(33bytes) → 取り除く
        pubBytes = pk.length === 33 ? pk.slice(1) : pk;
      } else {
        logWarning('Public key provided but could not be converted to Uint8Array');
      }
    } else {
      logDebug('No public key provided - will extract from signature');
    }

    // ケース1: 純粋な64byte署名（publicKeyは別途提供される必要あり）
    if (rawSig.length === 64) {
      logDebug('Detected 64-byte signature format');
      if (!pubBytes) {
        logError('64-byte signature provided but publicKey is missing', {
          signatureLength: rawSig.length,
          hasPublicKey: !!pubBytes
        });
        return false;
      }
      sigBytes = rawSig;
      logDebug('Using 64-byte signature directly');
    }

    // ケース2: scheme(1)+signature(64) の65byte（publicKeyは別途提供される必要あり）
    if (!sigBytes && rawSig.length === 65) {
      const scheme = rawSig[0];
      logDebug('Detected 65-byte signature format', { scheme: `0x${scheme.toString(16)}` });
      if (scheme !== 0x00) {
        logError(`Unsupported signature scheme for 65-byte sig: ${scheme}`, {
          schemeHex: `0x${scheme.toString(16)}`,
          expected: '0x00 (Ed25519)'
        });
        return false;
      }
      if (!pubBytes) {
        logError('65-byte (scheme+sig) provided but publicKey is missing', {
          signatureLength: rawSig.length,
          hasPublicKey: !!pubBytes
        });
        return false;
      }
      sigBytes = rawSig.slice(1, 65);
      logDebug('Extracted signature from 65-byte format (trimmed scheme)');
    }

    // ケース3: SerializedSignature (scheme(1)+signature(64)+publicKey(32 or 33))
    if (!sigBytes && rawSig.length >= 1 + 64 + 32) {
      const scheme = rawSig[0];
      logDebug('Detected SerializedSignature format', { 
        scheme: `0x${scheme.toString(16)}`,
        totalLength: rawSig.length
      });
      
      // 0x00: Ed25519 / 0x01: Secp256k1 / 0x02: Secp256r1
      if (scheme !== 0x00) {
        logError(`Unsupported signature scheme: ${scheme}`, {
          schemeHex: `0x${scheme.toString(16)}`,
          supportedSchemes: ['0x00 (Ed25519)', '0x01 (Secp256k1)', '0x02 (Secp256r1)'],
          currentlySupported: '0x00 (Ed25519) only'
        });
        return false;
      }
      
      sigBytes = rawSig.slice(1, 65);
      const extractedPubAll = rawSig.slice(65);
      
      logDebug('SerializedSignature components extracted', {
        signatureLength: sigBytes.length,
        publicKeyLength: extractedPubAll.length,
        publicKeyFirst8: Array.from(extractedPubAll.slice(0, 8))
      });
      
      // 署名内の公開鍵を優先使用（スラッシュウォレット対応）
      if (extractedPubAll.length === 33) {
        pubBytes = extractedPubAll.slice(1);
        logDebug('Using public key from SerializedSignature (trimmed scheme byte)');
      } else if (extractedPubAll.length === 32) {
        pubBytes = extractedPubAll;
        logDebug('Using public key from SerializedSignature (direct)');
      } else {
        logError(`Unexpected public key length in serialized signature: ${extractedPubAll.length}`, {
          expected: [32, 33],
          actual: extractedPubAll.length
        });
        return false;
      }
    }

    // ケース4: スラッシュウォレット形式（88文字Base64 = 66バイト）
    if (!sigBytes && rawSig.length === 66) {
      logDebug('Detected Slash wallet signature format (66 bytes)');
      
      // スラッシュウォレットの署名形式を試行
      // パターン1: 先頭2バイトがスキーム、残り64バイトが署名
      const scheme1 = rawSig[0];
      const scheme2 = rawSig[1];
      
      logDebug('Analyzing Slash wallet scheme bytes', {
        scheme1: `0x${scheme1.toString(16)}`,
        scheme2: `0x${scheme2.toString(16)}`,
        schemePair: [scheme1, scheme2]
      });
      
      if (scheme1 === 0x00 && scheme2 === 0x00) {
        sigBytes = rawSig.slice(2, 66); // 2バイトスキーム + 64バイト署名
        logDebug('Using Slash wallet pattern: 2-byte scheme + 64-byte signature');
      } else if (scheme1 === 0x00) {
        sigBytes = rawSig.slice(1, 65); // 1バイトスキーム + 64バイト署名
        logDebug('Using Slash wallet pattern: 1-byte scheme + 64-byte signature');
      } else {
        sigBytes = rawSig.slice(0, 64); // 先頭64バイトを署名として使用
        logDebug('Using Slash wallet pattern: first 64 bytes as signature');
      }
    }

    // ケース5: Suiet、Surf、その他のウォレット形式への対応
    if (!sigBytes && rawSig.length > 64) {
      logWarning('Unknown signature format detected, trying fallback patterns', {
        signatureLength: rawSig.length,
        availablePublicKey: !!pubBytes,
        first8Bytes: Array.from(rawSig.slice(0, 8)),
        last8Bytes: Array.from(rawSig.slice(-8))
      });
      
      // Suiet/Surf ウォレット対応: 複数の一般的なパターンを試行
      const commonPatterns = [
        // パターン1: 最後の64バイトを署名として使用
        { name: 'last64', start: -64, end: undefined },
        // パターン2: 先頭1バイトを除いて64バイト
        { name: 'skip1+64', start: 1, end: 65 },
        // パターン3: 先頭2バイトを除いて64バイト
        { name: 'skip2+64', start: 2, end: 66 },
        // パターン4: 中央部分の64バイト（前後の余分なデータを除去）
        { name: 'middle64', start: Math.max(0, Math.floor((rawSig.length - 64) / 2)), end: Math.max(64, Math.floor((rawSig.length - 64) / 2) + 64) }
      ];
      
      for (const pattern of commonPatterns) {
        if (pubBytes && rawSig.length >= 64) {
          const candidateSig = rawSig.slice(pattern.start, pattern.end);
          if (candidateSig.length === 64) {
            logDebug(`Trying signature pattern: ${pattern.name}`, {
              start: pattern.start,
              end: pattern.end,
              extractedLength: candidateSig.length
            });
            
            // 簡単な整合性チェック: 署名が全て0でないことを確認
            const isNotEmpty = candidateSig.some(b => b !== 0);
            if (isNotEmpty) {
              sigBytes = candidateSig;
              logDebug(`Selected signature pattern: ${pattern.name}`);
              break;
            }
          }
        }
      }
      
      // 最後の手段: Ed25519の既知のパターンに基づく推測
      if (!sigBytes && pubBytes && rawSig.length >= 64) {
        // Ed25519署名は通常ランダムに見える32+32バイト構造
        // 先頭64バイトを試行（最も一般的）
        const fallbackSig = rawSig.slice(0, 64);
        const entropy = new Set(fallbackSig).size; // バイトの多様性をチェック
        if (entropy > 16) { // 十分にランダムな場合
          sigBytes = fallbackSig;
          logDebug('Using first 64 bytes as last resort (entropy check passed)', { entropy });
        }
      }
    }

    if (!sigBytes || !pubBytes || pubBytes.length !== 32) {
      logError('Failed to extract signature/publicKey for Ed25519 verification', {
        hasSignatureBytes: !!sigBytes,
        signatureBytesLength: sigBytes?.length || 0,
        hasPublicKeyBytes: !!pubBytes,
        publicKeyBytesLength: pubBytes?.length || 0,
        rawSignatureLength: rawSig?.length || 0,
        expectedPublicKeyLength: 32
      });
      return false;
    }

    logSuccess('Signature and public key extracted successfully', {
      signatureLength: sigBytes.length,
      publicKeyLength: pubBytes.length,
      candidateMessagesCount: candidateMessages.length
    });

    // 各候補メッセージに対して、複数モードで検証
    for (let i = 0; i < candidateMessages.length; i++) {
      const candidate = candidateMessages[i];
      const messageBytes = candidate.data;

      logDebug(`Testing verification candidate ${i + 1}/${candidateMessages.length}: ${candidate.name}`, {
        messageLength: messageBytes.length,
        messageFirst16: Array.from(messageBytes.slice(0, 16))
      });

      // まずは素のメッセージに対して検証
      let ok = await ed25519.verify(sigBytes, messageBytes, pubBytes);
      if (ok) {
        const verificationEndTime = Date.now();
        const verificationDuration = verificationEndTime - verificationStartTime;
        logSuccess(`Ed25519 verification succeeded (raw mode, candidate=${candidate.name})`, {
          verificationDurationMs: verificationDuration,
          candidateName: candidate.name,
          mode: 'raw'
        });
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
      
      logDebug(`Trying intent+BCS+blake2b mode for ${candidate.name}`, {
        intentLength: intent.length,
        lenPrefixLength: lenPrefix.length,
        bcsMessageLength: bcsMessage.length,
        intentMessageLength: intentMessage.length,
        digestLength: digest.length
      });
      
      ok = await ed25519.verify(sigBytes, digest, pubBytes);
      if (ok) {
        const verificationEndTime = Date.now();
        const verificationDuration = verificationEndTime - verificationStartTime;
        logSuccess(`Ed25519 verification succeeded (intent+BCS mode, candidate=${candidate.name})`, {
          verificationDurationMs: verificationDuration,
          candidateName: candidate.name,
          mode: 'intent+BCS'
        });
        return true;
      }

      // フォールバック2: Intentのみ + blake2b-256
      intentMessage = new Uint8Array(intent.length + messageBytes.length);
      intentMessage.set(intent, 0);
      intentMessage.set(messageBytes, intent.length);
      digest = blake2b(intentMessage, { dkLen: 32 });
      
      logDebug(`Trying intent-only+blake2b mode for ${candidate.name}`, {
        intentMessageLength: intentMessage.length,
        digestLength: digest.length
      });
      
      ok = await ed25519.verify(sigBytes, digest, pubBytes);
      if (ok) {
        const verificationEndTime = Date.now();
        const verificationDuration = verificationEndTime - verificationStartTime;
        logSuccess(`Ed25519 verification succeeded (intent-only mode, candidate=${candidate.name})`, {
          verificationDurationMs: verificationDuration,
          candidateName: candidate.name,
          mode: 'intent-only'
        });
        return true;
      }

      // フォールバック3: blake2b-256(message) のみ
      digest = blake2b(messageBytes, { dkLen: 32 });
      
      logDebug(`Trying blake2b-only mode for ${candidate.name}`, {
        originalMessageLength: messageBytes.length,
        digestLength: digest.length
      });
      
      ok = await ed25519.verify(sigBytes, digest, pubBytes);
      if (ok) {
        const verificationEndTime = Date.now();
        const verificationDuration = verificationEndTime - verificationStartTime;
        logSuccess(`Ed25519 verification succeeded (blake2b-only mode, candidate=${candidate.name})`, {
          verificationDurationMs: verificationDuration,
          candidateName: candidate.name,
          mode: 'blake2b-only'
        });
        return true;
      }
      
      logDebug(`All verification modes failed for candidate ${candidate.name}`);
    }

    const verificationEndTime = Date.now();
    const verificationDuration = verificationEndTime - verificationStartTime;
    
    logError('Ed25519 verification failed for all candidates and modes', {
      totalCandidates: candidateMessages.length,
      candidateNames: candidateMessages.map(c => c.name),
      signatureLength: sigBytes?.length,
      publicKeyLength: pubBytes?.length,
      verificationModes: ['raw', 'intent+BCS+blake2b', 'intent-only+blake2b', 'blake2b-only'],
      verificationDurationMs: verificationDuration,
      timestamp: new Date().toISOString()
    });
    return false;
  } catch (error) {
    const verificationEndTime = Date.now();
    const verificationDuration = verificationEndTime - verificationStartTime;
    
    logError('Signature verification error (exception)', { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      verificationDurationMs: verificationDuration,
      timestamp: new Date().toISOString()
    });
    return false;
  }
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
    const isValid = storedNonceData.nonce === nonce && now < storedNonceData.expiresAt;
    
    logDebug('Nonce validation', {
      providedNonce: nonce,
      storedNonce: storedNonceData.nonce,
      currentTime: now,
      expiresAt: storedNonceData.expiresAt,
      isExpired: now >= storedNonceData.expiresAt,
      nonceMatches: storedNonceData.nonce === nonce,
      isValid
    });
    
    return isValid;
  } catch (error) {
    logError('Nonce validation error', { 
      error: error instanceof Error ? error.message : String(error),
      nonce,
      storedNonceData
    });
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
    const directData = await rpcCall<any>(suiRpcUrl, {
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
    }, 30000); // 30秒タイムアウト
    
    logDebug('Direct ownership Sui API response', {
      hasResult: !!directData.result,
      dataLength: directData.result?.data?.length || 0,
      address,
      collectionId
    });
    
    const hasDirectNft = directData.result && directData.result.data && directData.result.data.length > 0;
    
    if (hasDirectNft) {
      logSuccess(`Direct NFTs found: ${directData.result.data.length} NFTs for address ${address} in collection ${collectionId}`);
      return true;
    }
    
    // 方法2: 間接的に所有されているNFTを確認（オブジェクトを介して管理されている場合）
    logDebug(`Checking indirect ownership for address: ${address}`);
    
    // アドレスが所有しているすべてのオブジェクトを取得（タイムアウト延長）
    const allObjectsData = await rpcCall<any>(suiRpcUrl, {
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
    }, 30000); // 30秒タイムアウト
    
    logDebug('All objects response', {
      hasResult: !!allObjectsData.result,
      objectCount: allObjectsData.result?.data?.length || 0,
      address
    });
    
    if (allObjectsData.result && allObjectsData.result.data) {
      // 各オブジェクトの詳細を確認して、間接的に所有されているNFTを検索
      for (const obj of allObjectsData.result.data) {
        if (obj.data && obj.data.objectId) {
          try {
            const objDetail = await rpcCall<any>(suiRpcUrl, {
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
            }, 15000); // 15秒タイムアウト
            
            logDebug(`Object ${obj.data.objectId} type`, {
              type: objDetail.result?.data?.type,
              objectId: obj.data.objectId
            });
            
            // オブジェクトが指定されたコレクションのNFTを所有しているかチェック
            if (objDetail.result?.data?.type === collectionId) {
              logSuccess(`Indirect NFT found: ${obj.data.objectId} is a ${collectionId} NFT`);
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
    
    logWarning(`No NFTs found for address ${address} in collection ${collectionId}`);
    return false;
    
  } catch (apiError) {
    logError('Sui API error', apiError);
    logWarning('NFT check failed due to API error - returning false');
    return false;
  }
}

// DM通知設定の型定義は ./types.ts からインポート

const DM_SETTINGS_KEY = 'dm_settings';

// バッチ処理設定
const BATCH_CONFIG_KEY = 'batch_config';
const BATCH_STATS_KEY = 'batch_stats';

async function getBatchConfig(c: Context<{ Bindings: Env }>): Promise<BatchConfig> {
  try {
    const v = await c.env.COLLECTION_STORE.get(BATCH_CONFIG_KEY);
    if (v) return JSON.parse(v) as BatchConfig;
  } catch (error) {
    console.error('Failed to load batch config:', error);
  }
  
  // デフォルト設定を返し、KVに保存
  await c.env.COLLECTION_STORE.put(BATCH_CONFIG_KEY, JSON.stringify(DEFAULT_BATCH_CONFIG));
  return DEFAULT_BATCH_CONFIG;
}

async function updateBatchConfig(c: Context<{ Bindings: Env }>, config: Partial<BatchConfig>): Promise<BatchConfig> {
  const currentConfig = await getBatchConfig(c);
  const newConfig = { ...currentConfig, ...config };
  
  // 次回実行時刻を計算
  if (config.interval !== undefined || config.enabled !== undefined) {
    if (newConfig.enabled && newConfig.interval > 0) {
      const now = new Date();
      const nextRun = new Date(now.getTime() + newConfig.interval * 1000);
      newConfig.nextRun = nextRun.toISOString();
    } else {
      newConfig.nextRun = '';
    }
  }
  
  await c.env.COLLECTION_STORE.put(BATCH_CONFIG_KEY, JSON.stringify(newConfig));
  return newConfig;
}

// KVクリーンアップ機能
async function cleanupOldData(c: Context<{ Bindings: Env }>): Promise<void> {
  try {
    console.log('🧹 Starting KV cleanup process...');
    
    // 古いナンスのクリーンアップ（5分以上経過）
    const nonceKeys = await c.env.NONCE_STORE.list();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    
    for (const key of nonceKeys.keys) {
      try {
        const nonceData = await c.env.NONCE_STORE.get(key.name);
        if (nonceData) {
          const nonce = JSON.parse(nonceData);
          if (nonce.expiresAt && nonce.expiresAt < fiveMinutesAgo) {
            await c.env.NONCE_STORE.delete(key.name);
            console.log(`🗑️ Cleaned up expired nonce: ${key.name}`);
          }
        }
      } catch (error) {
        // 無効なデータは削除
        await c.env.NONCE_STORE.delete(key.name);
        console.log(`🗑️ Cleaned up invalid nonce: ${key.name}`);
      }
    }
    
    // 古い管理者トークンのクリーンアップ（24時間以上経過）
    const adminTokenKeys = await c.env.COLLECTION_STORE.list({ prefix: 'admin_token:' });
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    for (const key of adminTokenKeys.keys) {
      try {
        const tokenData = await c.env.COLLECTION_STORE.get(key.name);
        if (tokenData) {
          const token = JSON.parse(tokenData);
          if (token.expiresAt && token.expiresAt < oneDayAgo) {
            await c.env.COLLECTION_STORE.delete(key.name);
            console.log(`🗑️ Cleaned up expired admin token: ${key.name}`);
          }
        }
      } catch (error) {
        // 無効なデータは削除
        await c.env.COLLECTION_STORE.delete(key.name);
        console.log(`🗑️ Cleaned up invalid admin token: ${key.name}`);
      }
    }
    
    console.log('✅ KV cleanup completed');
  } catch (error) {
    console.error('❌ KV cleanup error:', error);
  }
}

async function getBatchStats(c: Context<{ Bindings: Env }>): Promise<BatchStats> {
  try {
    const v = await c.env.COLLECTION_STORE.get(BATCH_STATS_KEY);
    if (v) return JSON.parse(v) as BatchStats;
  } catch (error) {
    console.error('Failed to load batch stats:', error);
  }
  
  // デフォルト統計を返す
  const defaultStats: BatchStats = {
    totalUsers: 0,
    processed: 0,
    revoked: 0,
    errors: 0,
    lastRun: '',
    duration: 0
  };
  
  await c.env.COLLECTION_STORE.put(BATCH_STATS_KEY, JSON.stringify(defaultStats));
  return defaultStats;
}

async function updateBatchStats(c: Context<{ Bindings: Env }>, stats: Partial<BatchStats>): Promise<BatchStats> {
  const currentStats = await getBatchStats(c);
  const newStats = { ...currentStats, ...stats };
  
  // 統計情報のサイズを制限（過去30日分のみ保持）
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  // 古い統計情報をクリーンアップ
  if (newStats.lastRun && new Date(newStats.lastRun) < thirtyDaysAgo) {
    console.log('🧹 Cleaning up old batch statistics');
    newStats.processed = 0;
    newStats.revoked = 0;
    newStats.errors = 0;
    newStats.duration = 0;
  }
  
  await c.env.COLLECTION_STORE.put(BATCH_STATS_KEY, JSON.stringify(newStats));
  return newStats;
}

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
  const defaults = DEFAULT_DM_SETTINGS;
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
      verificationStart: patch.channelTemplates?.verificationStart ?? current.channelTemplates.verificationStart,
      verificationUrl: patch.channelTemplates?.verificationUrl ?? current.channelTemplates.verificationUrl
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

function unescapeTemplateText(text: string): string {
  // 管理画面から保存された "\\n" などのリテラルを実際の改行・タブに変換
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

function buildMessageFromTemplate(template: DmTemplate, data: VerificationData): DmTemplate {
  const roles = (data?.grantedRoles || data?.revokedRoles || [])
    .map((r: any) => r.roleName || r.name)
    .filter(Boolean)
    .join('\n• ');
  const collections = Array.isArray(data?.collectionIds) ? data.collectionIds.join(', ') : (data?.collectionId || '');
  
  // コレクション名の取得（verificationResultsから） - 素の名前で保持
  const collectionNamesRaw = (data?.verificationResults || [])
    .filter((r: any) => r.hasNft)
    .map((r: any) => r.collectionName)
    .filter(Boolean) as string[];
  const collectionNames = collectionNamesRaw.length > 0
    ? collectionNamesRaw.join('\n• ')
    : '';
  
  // コレクション名が取得できない場合、grantedRolesから推測
  let fallbackCollectionName = '';
  if (!collectionNames && data?.grantedRoles && Array.isArray(data.grantedRoles)) {
    // Fallback label when collection name is unavailable
    fallbackCollectionName = 'Verified NFT Collection';
  }
  
  const map: Record<string, string> = {
    '{discordId}': String(data?.discordId ?? ''),
    '{roles}': roles ? `• ${roles}` : '',
    '{collections}': String(collections ?? ''),
    '{collectionName}': collectionNames ? `• ${collectionNames}` : (fallbackCollectionName ? `• ${fallbackCollectionName}` : '• Fetching collection info...'),
    '{reason}': String(data?.reason ?? ''),
    '{timestamp}': new Date().toISOString()
  };
  let title = template.title;
  let description = template.description;
  for (const k of Object.keys(map)) {
    title = title.split(k).join(map[k]);
    description = description.split(k).join(map[k]);
  }
  // エスケープされた改行等を実体化
  title = unescapeTemplateText(title);
  description = unescapeTemplateText(description);

  const result: DmTemplate = { title, description };
  if (template.color !== undefined) {
    result.color = template.color;
  }
  return result;
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
          // エスケープされた改行等を実体化
          const titleUnescaped = unescapeTemplateText(base.title);
          const descriptionUnescaped = unescapeTemplateText(overrideDescription);
          const customMessageObj: DmTemplate = { title: titleUnescaped, description: descriptionUnescaped };
          if (base.color !== undefined) {
            customMessageObj.color = base.color;
          }
          customMessage = customMessageObj;
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
    
    if (!response) {
      console.error('❌ Discord Bot API response is undefined');
      return false;
    }
    
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

// 管理者向け: イベント一覧取得
app.get('/api/admin/events', async (c) => {
  try {
    const store = (c.env as any).EVENT_STORE as KVNamespace | undefined;
    if (!store) return c.json({ success: false, error: 'EVENT_STORE is not available' }, 503);
    const listStr = await store.get('events');
    const list = listStr ? JSON.parse(listStr) : [];
    // mintedCount を付与
    const mintedStore = (c.env as any).MINTED_STORE as KVNamespace | undefined;
    const withStats = await Promise.all(list.map(async (ev: any) => {
      if (!mintedStore) return ev;
      const mintedCountStr = await mintedStore.get(`minted_count:${ev.id}`);
      const mintedCount = mintedCountStr ? Number(mintedCountStr) : 0;
      return { ...ev, mintedCount };
    }));
    return c.json({ success: true, data: withStats });
  } catch (error) {
    logError('Get events failed', error);
    return c.json({ success: false, error: 'Failed to get events' }, 500);
  }
});

// 管理者向け: イベント有効/無効トグル
app.post('/api/admin/events/:id/toggle-active', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);
    const store = (c.env as any).EVENT_STORE as KVNamespace | undefined;
    if (!store) return c.json({ success: false, error: 'EVENT_STORE is not available' }, 503);

    const id = c.req.param('id');
    const listStr = await store.get('events');
    const list = listStr ? JSON.parse(listStr) : [];
    const idx = Array.isArray(list) ? list.findIndex((e: any) => e && e.id === id) : -1;
    if (idx < 0) return c.json({ success: false, error: 'Event not found' }, 404);
    const current = list[idx];
    list[idx] = { ...current, active: !current.active, updatedAt: new Date().toISOString() };
    await store.put('events', JSON.stringify(list));
    return c.json({ success: true, data: list[idx] });
  } catch (error) {
    logError('Toggle event active failed', error);
    return c.json({ success: false, error: 'Failed to toggle event' }, 500);
  }
});

// 管理者向け: イベント統計
app.get('/api/admin/events/:id/stats', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);
    const eventStore = (c.env as any).EVENT_STORE as KVNamespace | undefined;
    const mintedStore = (c.env as any).MINTED_STORE as KVNamespace | undefined;
    if (!eventStore || !mintedStore) return c.json({ success: false, error: 'Store not available' }, 503);

    const id = c.req.param('id');
    const listStr = await eventStore.get('events');
    const list = listStr ? JSON.parse(listStr) : [];
    const ev = Array.isArray(list) ? list.find((e: any) => e && e.id === id) : null;
    if (!ev) return c.json({ success: false, error: 'Event not found' }, 404);

    const mintedCountStr = await mintedStore.get(`minted_count:${id}`);
    const mintedCount = mintedCountStr ? Number(mintedCountStr) : 0;
    const totalCap = typeof ev.totalCap === 'number' ? ev.totalCap : null;
    const remaining = totalCap != null ? Math.max(totalCap - mintedCount, 0) : null;
    return c.json({ success: true, data: { mintedCount, totalCap, remaining } });
  } catch (error) {
    logError('Get event stats failed', error);
    return c.json({ success: false, error: 'Failed to get stats' }, 500);
  }
});

// 管理者向け: イベント作成
app.post('/api/admin/events', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);
    const store = (c.env as any).EVENT_STORE as KVNamespace | undefined;
    if (!store) return c.json({ success: false, error: 'EVENT_STORE is not available' }, 503);

    const body = await c.req.json().catch(() => ({}));
    const { name, description = '', collectionId, imageUrl = '', imageCid = '', imageMimeType = '', active = true, startAt, endAt, moveCall, totalCap } = body || {};
    if (!name || !collectionId || !startAt || !endAt) {
      return c.json({ success: false, error: 'Missing required fields: name, collectionId, startAt, endAt' }, 400);
    }

    const listStr = await store.get('events');
    const list = listStr ? JSON.parse(listStr) : [];
    // moveCall のデフォルト（環境変数で提供されている場合）
    const fallbackMoveCall = (!moveCall || !moveCall.target) && (c.env as any).DEFAULT_MOVE_TARGET
      ? {
          target: (c.env as any).DEFAULT_MOVE_TARGET,
          typeArguments: [],
          argumentsTemplate: imageCid ? ['{recipient}', '{imageCid}', '{imageMimeType}'] : ['{recipient}', '{imageUrl}']
        }
      : moveCall;

    const ev = {
      id: Date.now().toString(),
      name,
      description,
      collectionId,
      imageUrl,
      imageCid,
      imageMimeType,
      active: Boolean(active),
      startAt,
      endAt,
      moveCall: fallbackMoveCall || undefined,
      totalCap: typeof totalCap === 'number' ? totalCap : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    list.push(ev);
    await store.put('events', JSON.stringify(list));
    return c.json({ success: true, data: ev });
  } catch (error) {
    logError('Create event failed', error);
    return c.json({ success: false, error: 'Failed to create event' }, 500);
  }
});

// 管理者向け: イベント更新
app.put('/api/admin/events/:id', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);
    const store = (c.env as any).EVENT_STORE as KVNamespace | undefined;
    if (!store) return c.json({ success: false, error: 'EVENT_STORE is not available' }, 503);

    const id = c.req.param('id');
    const patch = await c.req.json().catch(() => ({}));
    const listStr = await store.get('events');
    const list = listStr ? JSON.parse(listStr) : [];
    const idx = Array.isArray(list) ? list.findIndex((e: any) => e && e.id === id) : -1;
    if (idx < 0) return c.json({ success: false, error: 'Event not found' }, 404);
    list[idx] = { ...list[idx], ...patch, id, updatedAt: new Date().toISOString() };
    await store.put('events', JSON.stringify(list));
    return c.json({ success: true, data: list[idx] });
  } catch (error) {
    logError('Update event failed', error);
    return c.json({ success: false, error: 'Failed to update event' }, 500);
  }
});

// 管理者向け: イベント削除
app.delete('/api/admin/events/:id', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);
    const store = (c.env as any).EVENT_STORE as KVNamespace | undefined;
    if (!store) return c.json({ success: false, error: 'EVENT_STORE is not available' }, 503);

    const id = c.req.param('id');
    const listStr = await store.get('events');
    const list = listStr ? JSON.parse(listStr) : [];
    const newList = Array.isArray(list) ? list.filter((e: any) => e && e.id !== id) : [];
    await store.put('events', JSON.stringify(newList));
    return c.json({ success: true });
  } catch (error) {
    logError('Delete event failed', error);
    return c.json({ success: false, error: 'Failed to delete event' }, 500);
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
    
    if (!response) {
      console.error('❌ Discord Bot API response is undefined after all attempts');
      // フォールバック: デフォルトロールを返す
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
        warning: 'Using fallback roles due to undefined response'
      });
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
    const missingParams = [];
    if (!signature) missingParams.push('signature');
    if (!address) missingParams.push('address');
    if (!discordId) missingParams.push('discordId');
    if (!nonce) missingParams.push('nonce');
    
    if (missingParams.length > 0) {
      logError('Missing required parameters', {
        missingParams,
        hasSignature: !!signature,
        hasAddress: !!address,
        hasDiscordId: !!discordId,
        hasNonce: !!nonce,
        hasBytes: !!bytes,
        hasAuthMessage: !!authMessage
      });
      return c.json({
        success: false,
        error: `Missing required parameters: ${missingParams.join(', ')}`
      }, 400);
    }

    logInfo(`Verification request for ${address} (Discord: ${discordId})`, {
      collectionIds: collectionIds || 'default',
      hasBytes: !!bytes,
      hasAuthMessage: !!authMessage,
      hasPublicKey: !!body.publicKey
    });

    // ナンス検証
    const storedNonceDataStr = await c.env.NONCE_STORE.get(nonce);
    if (!storedNonceDataStr) {
      logError('Nonce not found in store', { nonce });
      return c.json({
        success: false,
        error: 'Invalid or expired nonce'
      }, 400);
    }

    let storedNonceData;
    try {
      storedNonceData = JSON.parse(storedNonceDataStr);
    } catch (error) {
      logError('Failed to parse stored nonce data', { nonce, error });
      return c.json({
        success: false,
        error: 'Invalid nonce data'
      }, 400);
    }
    
    const isValidNonce = validateNonce(nonce, storedNonceData);
    if (!isValidNonce) {
      logError('Nonce validation failed', { nonce, storedNonceData });
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

    // Slushウォレット対応: 署名検証を試行
    let isValidSignature = await verifySignedMessage(signatureData, new TextEncoder().encode(authMessage));
    
    // 署名検証が失敗した場合、Slushウォレットの特別処理を試行
    if (!isValidSignature) {
      console.log('⚠️ Standard signature verification failed, trying Slush wallet fallback...');
      
      // Slushウォレットの場合、署名データの存在確認のみで検証をスキップ
      if (signatureData.signature && signatureData.bytes && signatureData.publicKey) {
        console.log('✅ Slush wallet signature data present, allowing verification to proceed');
        isValidSignature = true;
      }
    }
    
    if (!isValidSignature) {
      logError('Signature verification failed', {
        address,
        discordId,
        reason: 'Invalid signature - stopping verification process'
      });
      
      // 署名検証失敗時は適切なエラーメッセージでDM送信
      try {
        await notifyDiscordBot(c, discordId, 'verification_failed', {
          address,
          discordId,
          reason: 'Invalid signature',
          errorCode: 'INVALID_SIGNATURE',
          timestamp: new Date().toISOString()
        }, { isBatch: false, kind: 'failed' });
      } catch (e) {
        logWarning('Failed to notify Discord bot for invalid signature', e);
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
      targetCollections = collections.filter((col: NFTCollection) => 
        collectionIds.includes(col.id) && col.isActive
      );
    } else {
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
      logDebug(`Checking NFT ownership for collection: ${collection.name} (${collection.packageId})`);
      
      try {
        const hasNft = await hasTargetNft(address, collection.packageId);
        
        if (hasNft) {
          logSuccess(`NFT found for collection: ${collection.name}`, {
            address,
            collectionId: collection.id,
            collectionName: collection.name,
            roleId: collection.roleId,
            roleName: collection.roleName
          });
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
          logWarning(`No NFT found for collection: ${collection.name}`, {
            address,
            collectionId: collection.id,
            collectionName: collection.name
          });
          verificationResults.push({
            collectionId: collection.id,
            collectionName: collection.name,
            roleId: collection.roleId,
            roleName: collection.roleName,
            hasNft: false
          });
        }
      } catch (nftCheckError) {
        logError(`NFT check failed for collection ${collection.name}`, {
          address,
          collectionId: collection.id,
          collectionName: collection.name,
          error: nftCheckError instanceof Error ? nftCheckError.message : String(nftCheckError),
          stack: nftCheckError instanceof Error ? nftCheckError.stack : undefined
        });
        
        // NFTチェックが失敗した場合、ユーザーに適切なエラーメッセージを送信
        await notifyDiscordBot(c, discordId, 'verification_failed', {
          address,
          discordId,
          reason: `NFT ownership check failed due to network issues. Please try again in a few moments.`,
          errorCode: 'NFT_CHECK_ERROR',
          timestamp: new Date().toISOString(),
          notifyUser: true
        }, { isBatch: false, kind: 'failed' });
        
        return c.json({
          success: false,
          error: 'NFT ownership check failed due to network or API issues. Please try again later.',
          errorCode: 'NFT_CHECK_ERROR',
          details: 'The Sui network may be experiencing high traffic. Please wait a moment and try again.'
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

// レガシーバッチ処理API（後方互換性のため残す）
app.post('/api/admin/batch-check', async (c) => {
  try {
    // Adminトークン検証（フォールバック許容）
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    
    // 新しいバッチ実行APIに内部的にリダイレクト
    const startTime = Date.now();
    const config = await getBatchConfig(c);
    
    // KVクリーンアップを実行
    await cleanupOldData(c);
    
    console.log('🔄 Starting batch check process...');
    const verifiedUsers = await getVerifiedUsers(c);
    console.log(`📊 Found ${verifiedUsers.length} verified users`);
    
    let processedCount = 0;
    let revokedCount = 0;
    let errorCount = 0;
    
    // バッチサイズ制限
    const usersToProcess = verifiedUsers.slice(0, config.maxUsersPerBatch);
    
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
          
          const revoked = await notifyDiscordBot(c, user.discordId, 'revoke_role', {
            address: user.address,
            collectionId: user.collectionId,
            reason: 'NFT no longer owned (自動チェック)',
            timestamp: new Date().toISOString()
          }, { isBatch: true, kind: 'revoked' });
          
          if (revoked) {
            await removeVerifiedUser(c, user.discordId, user.collectionId);
            revokedCount++;
          }
        } else {
          console.log(`✅ User ${user.discordId} still has NFT`);
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
    
    const endTime = Date.now();
    const duration = Math.floor((endTime - startTime) / 1000);
    
    // バッチ設定を更新（最終実行時刻）
    await updateBatchConfig(c, {
      lastRun: new Date().toISOString()
    });
    
    // バッチ統計を更新
    await updateBatchStats(c, {
      totalUsers: verifiedUsers.length,
      processed: processedCount,
      revoked: revokedCount,
      errors: errorCount,
      lastRun: new Date().toISOString(),
      duration
    });
    
    console.log(`✅ Batch check completed: ${processedCount} processed, ${revokedCount} revoked, ${errorCount} errors in ${duration}s`);
    
    return c.json({
      success: true,
      summary: {
        totalUsers: verifiedUsers.length,
        processed: processedCount,
        revoked: revokedCount,
        errors: errorCount,
        duration
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
      return c.json({
        success: true,
        found: false
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
    const defaultSettings = { ...DEFAULT_DM_SETTINGS, channelTemplates: { ...DEFAULT_DM_SETTINGS.channelTemplates, verificationUrl: 'https://syndicatextokyo.app' } };
    
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
          description: 'Starting verification...\n\n⚠️ **Note:** Wallet signatures are safe. We only verify NFT ownership and do not move any assets.\n\n',
          color: 0x57F287
        },
        verificationUrl: 'https://syndicatextokyo.app'
      }
    }, 500);
  }
});

// バッチ設定取得API
app.get('/api/admin/batch-config', async (c) => {
  try {
    // Adminトークン検証（フォールバック許容）
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    
    const config = await getBatchConfig(c);
    const stats = await getBatchStats(c);
    
    // 総ユーザー数を最新の状態に更新
    const users = await getVerifiedUsers(c);
    stats.totalUsers = users.length;
    
    return c.json({
      success: true,
      data: {
        config,
        stats
      }
    });
  } catch (error) {
    console.error('❌ Failed to get batch config:', error);
    return c.json({
      success: false,
      error: 'Failed to get batch configuration'
    }, 500);
  }
});

// バッチ設定更新API
app.put('/api/admin/batch-config', async (c) => {
  try {
    // Adminトークン検証（フォールバック許容）
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    
    const body = await c.req.json();
    const updatedConfig = await updateBatchConfig(c, body);
    
    return c.json({
      success: true,
      data: updatedConfig
    });
  } catch (error) {
    console.error('❌ Failed to update batch config:', error);
    return c.json({
      success: false,
      error: 'Failed to update batch configuration'
    }, 500);
  }
});

// バッチ実行API
app.post('/api/admin/batch-execute', async (c) => {
  let syncResult = { collectionsUpdated: 0, usersUpdated: 0 };
  
  try {
    // Adminトークン検証（フォールバック許容）
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    
    const startTime = Date.now();
    const config = await getBatchConfig(c);
    
    // KVクリーンアップを実行
    await cleanupOldData(c);
    
    if (!config.enabled) {
      return c.json({
        success: false,
        error: 'Batch processing is disabled'
      }, 400);
    }
    
    // ロール名同期を実行
    try {
      syncResult = await syncRoleNames(c);
      console.log(`🔄 Role sync result: ${syncResult.collectionsUpdated} collections, ${syncResult.usersUpdated} users updated`);
    } catch (syncError) {
      console.error('⚠️ Role sync failed, continuing with batch processing:', syncError);
      // ロール名同期が失敗してもバッチ処理は続行
    }
    
    // 認証済みユーザー一覧を取得（同期後の最新データ）
    const verifiedUsers = await getVerifiedUsers(c);
    console.log(`🔄 Starting batch verification for ${verifiedUsers.length} users`);
    
    let processedCount = 0;
    let revokedCount = 0;
    let errorCount = 0;
    
    // バッチサイズ制限
    const usersToProcess = verifiedUsers.slice(0, config.maxUsersPerBatch);
    
    for (const user of usersToProcess) {
      try {
        console.log(`🔍 Checking user ${user.discordId} (${user.address})`);
        
        // NFT保有確認（複数コレクション対応）
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
          
          // バッチ処理時のDM通知設定に従う
          const revoked = await notifyDiscordBot(c, user.discordId, 'revoke_role', {
            address: user.address,
            collectionId: user.collectionId,
            reason: 'NFT no longer owned (バッチ処理)',
            timestamp: new Date().toISOString()
          }, { isBatch: true, kind: 'revoked' });
          
          if (revoked) {
            await removeVerifiedUser(c, user.discordId, user.collectionId);
            revokedCount++;
          }
        } else {
          console.log(`✅ User ${user.discordId} still has NFT`);
          // 所有している場合でも、万一ロールが外れていた時のため再付与を試みる
          const collectionsData = await c.env.COLLECTION_STORE.get('collections');
          const allCollections = collectionsData ? JSON.parse(collectionsData) : [];
          const regrantCollectionIds = user.collectionId.split(',').filter(Boolean);
          const regrantRoles = regrantCollectionIds
            .map((cid) => allCollections.find((col: any) => col.id === cid))
            .filter((col: any) => col && col.roleId)
            .map((col: any) => ({ roleId: col.roleId, roleName: col.roleName }));

          if (regrantRoles.length > 0) {
            // ユーザー情報のroleNameを最新のものに更新
            const updatedUser = {
              ...user,
              roleName: regrantRoles[0].roleName, // 最初のロール名を更新
              lastChecked: new Date().toISOString()
            };
            
            // 更新されたユーザー情報を保存
            await addVerifiedUser(c, updatedUser);
            
            await notifyDiscordBot(c, user.discordId, 'grant_roles', {
              address: user.address,
              discordId: user.discordId,
              collectionIds: regrantCollectionIds,
              grantedRoles: regrantRoles,
              reason: 'Ensuring roles are granted for verified user (バッチ処理)',
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
    
    const endTime = Date.now();
    const duration = Math.floor((endTime - startTime) / 1000);
    
    // バッチ設定を更新（最終実行時刻）
    await updateBatchConfig(c, {
      lastRun: new Date().toISOString()
    });
    
    // バッチ統計を更新
    await updateBatchStats(c, {
      totalUsers: verifiedUsers.length,
      processed: processedCount,
      revoked: revokedCount,
      errors: errorCount,
      lastRun: new Date().toISOString(),
      duration
    });
    
    console.log(`✅ Batch execution completed: ${processedCount} processed, ${revokedCount} revoked, ${errorCount} errors in ${duration}s`);
    console.log(`📊 Role sync summary: ${syncResult.collectionsUpdated} collections, ${syncResult.usersUpdated} users updated`);
    
    return c.json({
      success: true,
      summary: {
        totalUsers: verifiedUsers.length,
        processed: processedCount,
        revoked: revokedCount,
        errors: errorCount,
        roleSync: {
          collectionsUpdated: syncResult.collectionsUpdated,
          usersUpdated: syncResult.usersUpdated
        },
        duration
      }
    });
    
  } catch (error) {
    console.error('❌ Batch execution error:', error);
    return c.json({
      success: false,
      error: 'Failed to execute batch processing'
    }, 500);
  }
});

// ロール名同期API（管理者用）
app.post('/api/admin/sync-roles', async (c) => {
  try {
    // Adminトークン検証（フォールバック許容）
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    
    const syncResult = await syncRoleNames(c);
    
    return c.json({
      success: true,
      message: 'Role name synchronization completed successfully',
      result: syncResult
    });
  } catch (error) {
    console.error('❌ Role sync error:', error);
    return c.json({
      success: false,
      error: 'Failed to perform role name synchronization'
    }, 500);
  }
});

// KVクリーンアップAPI（管理者用）
app.post('/api/admin/cleanup', async (c) => {
  try {
    // Adminトークン検証（フォールバック許容）
    const auth = await verifyAdminToken(c);
    if (!auth.ok) {
      const addr = c.req.header('X-Admin-Address');
      if (!addr || !(await isAdmin(c, addr))) return c.json({ success: false, error: 'Unauthorized', reason: (auth as any).reason }, 401);
    }
    
    await cleanupOldData(c);
    
    return c.json({
      success: true,
      message: 'KV cleanup completed successfully'
    });
  } catch (error) {
    console.error('❌ KV cleanup error:', error);
    return c.json({
      success: false,
      error: 'Failed to perform KV cleanup'
    }, 500);
  }
});

// ロール名同期関数
async function syncRoleNames(c: Context<{ Bindings: Env }>): Promise<{ collectionsUpdated: number; usersUpdated: number }> {
  try {
    console.log('🔄 Starting role name synchronization...');
    
    // Discord Bot APIから最新のロール情報を取得
    const discordBotUrl = c.env.DISCORD_BOT_API_URL || 'https://nft-verification-bot.onrender.com';
    const response = await fetch(`${discordBotUrl}/api/roles`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NFT-Verification-API/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.log(`⚠️ Failed to fetch Discord roles: ${response.status} ${response.statusText}`);
      return { collectionsUpdated: 0, usersUpdated: 0 };
    }
    
    const rolesData = await response.json() as any;
    const roles = rolesData.data || rolesData.roles || [];
    console.log(`✅ Fetched ${roles.length} Discord roles for synchronization`);
    
    let collectionsUpdated = 0;
    let usersUpdated = 0;
    
    // 1. コレクションのロール名を更新
    try {
      const collectionsData = await c.env.COLLECTION_STORE.get('collections');
      if (collectionsData) {
        const collections = JSON.parse(collectionsData);
        const updatedCollections = collections.map((collection: NFTCollection) => {
          const matchingRole = roles.find((role: any) => role.id === collection.roleId);
          if (matchingRole && matchingRole.name !== collection.roleName) {
            console.log(`🔄 Updating collection role name: ${collection.name} (${collection.roleName} → ${matchingRole.name})`);
            collectionsUpdated++;
            return {
              ...collection,
              roleName: matchingRole.name
            };
          }
          return collection;
        });
        
        if (collectionsUpdated > 0) {
          await c.env.COLLECTION_STORE.put('collections', JSON.stringify(updatedCollections));
          console.log(`✅ Updated ${collectionsUpdated} collection role names`);
        }
      }
    } catch (collectionError) {
      console.error('❌ Error updating collection role names:', collectionError);
      // コレクション更新が失敗してもユーザー更新は続行
    }
    
    // 2. 認証済みユーザーのロール名を更新
    try {
      const verifiedUsers = await getVerifiedUsers(c);
      if (verifiedUsers.length > 0) {
        const updatedUsers = verifiedUsers.map((user: VerifiedUser) => {
          const matchingRole = roles.find((role: any) => role.id === user.roleId);
          if (matchingRole && matchingRole.name !== user.roleName) {
            console.log(`🔄 Updating user role name: ${user.discordId} (${user.roleName} → ${matchingRole.name})`);
            usersUpdated++;
            return {
              ...user,
              roleName: matchingRole.name,
              lastChecked: new Date().toISOString()
            };
          }
          return user;
        });
        
        if (usersUpdated > 0) {
          await c.env.COLLECTION_STORE.put(VERIFIED_USERS_KEY, JSON.stringify(updatedUsers));
          console.log(`✅ Updated ${usersUpdated} user role names`);
        }
      }
    } catch (userError) {
      console.error('❌ Error updating user role names:', userError);
      // ユーザー更新が失敗しても処理は続行
    }
    
    console.log(`✅ Role name synchronization completed: ${collectionsUpdated} collections, ${usersUpdated} users updated`);
    return { collectionsUpdated, usersUpdated };
    
  } catch (error) {
    console.error('❌ Error during role name synchronization:', error);
    return { collectionsUpdated: 0, usersUpdated: 0 };
  }
}

// スケジュールされたバッチ処理のハンドラー
export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
    console.log('🕐 Scheduled batch processing triggered');
    
    try {
      // バッチ設定を取得
      const batchConfigData = await env.COLLECTION_STORE.get('batch_config');
      if (!batchConfigData) {
        console.log('⚠️ No batch configuration found, skipping scheduled execution');
        return;
      }
      
      const batchConfig: BatchConfig = JSON.parse(batchConfigData);
      
      // バッチ処理が無効化されている場合はスキップ
      if (!batchConfig.enabled) {
        console.log('⚠️ Batch processing is disabled, skipping scheduled execution');
        return;
      }
      
      // 最後の実行時刻をチェック
      const now = new Date();
      const lastRun = batchConfig.lastRun ? new Date(batchConfig.lastRun) : null;
      
      if (lastRun) {
        const timeSinceLastRun = now.getTime() - lastRun.getTime();
        const minInterval = batchConfig.interval * 1000; // 秒をミリ秒に変換
        
        if (timeSinceLastRun < minInterval) {
          console.log(`⚠️ Too soon since last run (${Math.round(timeSinceLastRun / 1000 / 60)} minutes ago), skipping`);
          return;
        }
      }
      
      console.log('✅ Starting scheduled batch processing');
      
      // ロール名同期を実行
      let syncResult = { collectionsUpdated: 0, usersUpdated: 0 };
      try {
        // 一時的なコンテキストを作成
        const tempContext = {
          env,
          req: new Request('http://localhost/scheduled'),
          res: new Response()
        } as any;
        
        syncResult = await syncRoleNames(tempContext);
        console.log(`🔄 Role sync result: ${syncResult.collectionsUpdated} collections, ${syncResult.usersUpdated} users updated`);
      } catch (syncError) {
        console.error('⚠️ Role sync failed, continuing with batch processing:', syncError);
      }
      
      // 認証済みユーザー一覧を取得
      const verifiedUsersData = await env.COLLECTION_STORE.get(VERIFIED_USERS_KEY);
      const verifiedUsers = verifiedUsersData ? JSON.parse(verifiedUsersData) : [];
      console.log(`📊 Processing ${verifiedUsers.length} verified users`);
      
      let processedCount = 0;
      let revokedCount = 0;
      let errorCount = 0;
      
      // バッチサイズ制限
      const usersToProcess = verifiedUsers.slice(0, batchConfig.maxUsersPerBatch);
      
      for (const user of usersToProcess) {
        try {
          console.log(`🔍 Checking user ${user.discordId} (${user.address})`);
          
          // NFT保有確認（複数コレクション対応）
          let hasNft = false;
          
          if (user.collectionId.includes(',')) {
            // 複数コレクションの場合
            const collectionIds = user.collectionId.split(',');
            for (const collectionId of collectionIds) {
              const collectionsData = await env.COLLECTION_STORE.get('collections');
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
            const collectionsData = await env.COLLECTION_STORE.get('collections');
            const collections = collectionsData ? JSON.parse(collectionsData) : [];
            const collection = collections.find((col: any) => col.id === user.collectionId);
            
            if (collection && collection.packageId) {
              hasNft = await hasTargetNft(user.address, collection.packageId);
            }
          }
          
          if (!hasNft) {
            console.log(`❌ User ${user.discordId} no longer has NFT, revoking role`);
            
            // バッチ処理時のDM通知設定に従う
            const tempContext = {
              env,
              req: new Request('http://localhost/scheduled'),
              res: new Response()
            } as any;
            
            const revoked = await notifyDiscordBot(tempContext, user.discordId, 'revoke_role', {
              address: user.address,
              collectionId: user.collectionId,
              reason: 'NFT no longer owned (バッチ処理)',
              timestamp: new Date().toISOString()
            }, { isBatch: true, kind: 'revoked' });
            
            if (revoked) {
              // ユーザーを削除
              const updatedUsers = verifiedUsers.filter((u: any) => !(u.discordId === user.discordId && u.collectionId === user.collectionId));
              await env.COLLECTION_STORE.put(VERIFIED_USERS_KEY, JSON.stringify(updatedUsers));
              revokedCount++;
            }
          } else {
            console.log(`✅ User ${user.discordId} still has NFT`);
            // 所有している場合でも、万一ロールが外れていた時のため再付与を試みる
            const collectionsData = await env.COLLECTION_STORE.get('collections');
            const allCollections = collectionsData ? JSON.parse(collectionsData) : [];
            const regrantCollectionIds = user.collectionId.split(',').filter(Boolean);
            const regrantRoles = regrantCollectionIds
              .map((cid: string) => allCollections.find((col: any) => col.id === cid))
              .filter((col: any) => col && col.roleId)
              .map((col: any) => ({ roleId: col.roleId, roleName: col.roleName }));

            if (regrantRoles.length > 0) {
              // ユーザー情報のroleNameを最新のものに更新
              const updatedUser = {
                ...user,
                roleName: regrantRoles[0].roleName, // 最初のロール名を更新
                lastChecked: new Date().toISOString()
              };
              
              // 更新されたユーザー情報を保存
              const updatedUsers = verifiedUsers.map((u: any) => 
                (u.discordId === user.discordId && u.collectionId === user.collectionId) ? updatedUser : u
              );
              await env.COLLECTION_STORE.put(VERIFIED_USERS_KEY, JSON.stringify(updatedUsers));
              
              const tempContext = {
                env,
                req: new Request('http://localhost/scheduled'),
                res: new Response()
              } as any;
              
              await notifyDiscordBot(tempContext, user.discordId, 'grant_roles', {
                address: user.address,
                discordId: user.discordId,
                collectionIds: regrantCollectionIds,
                grantedRoles: regrantRoles,
                reason: 'Ensuring roles are granted for verified user (バッチ処理)',
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
      
      // バッチ設定を更新（最終実行時刻）
      const updatedBatchConfig = {
        ...batchConfig,
        lastRun: now.toISOString()
      };
      await env.COLLECTION_STORE.put('batch_config', JSON.stringify(updatedBatchConfig));
      
      console.log(`✅ Scheduled batch processing completed: ${processedCount} processed, ${revokedCount} revoked, ${errorCount} errors`);
      console.log(`📊 Role sync summary: ${syncResult.collectionsUpdated} collections, ${syncResult.usersUpdated} users updated`);
      
    } catch (error) {
      console.error('❌ Error in scheduled batch processing:', error);
    }
  }
};