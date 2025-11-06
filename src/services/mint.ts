/**
 * NFT ミントサービス
 * 署名検証、イベント期間チェック、重複防止、スポンサー委譲を担当
 */

import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
import { verifySignedMessage } from '../utils/signature';
import { logError, logWarning } from '../utils/logger';

export interface MintRequest {
  eventId: string;
  address: string;
  signature: string;
  bytes: number[];
  publicKey?: string;
  authMessage: string;
}

export interface MintResult {
  txDigest: string;
  success: boolean;
  error?: string;
}

export interface EventData {
  id: string;
  name?: string;
  description?: string;
  active: boolean;
  startAt: string;
  endAt: string;
  eventDate?: string;
  totalCap?: number;
  moveCall: any;
  imageCid?: string;
  imageMimeType?: string;
  collectionId: string;
}

/**
 * 署名検証
 * @param request ミントリクエスト
 * @returns 検証成功かどうか
 */
export async function verifySignature(request: MintRequest): Promise<boolean> {
  const { signature, bytes, authMessage, address } = request;
  
  // 基本的なバリデーション
  if (!signature || !bytes || !address) {
    logWarning('Missing required fields for signature verification', {
      hasSignature: !!signature,
      hasBytes: !!bytes,
      hasAddress: !!address
    });
    return false;
  }

  // bytesをUint8Arrayに変換
  let receivedBytes: Uint8Array;
  try {
    receivedBytes = new Uint8Array(bytes);
    if (receivedBytes.length === 0) {
      logWarning('Empty bytes array');
      return false;
    }
  } catch (e: any) {
    logError('Failed to convert bytes to Uint8Array', e);
    return false;
  }
  
  // 受信メッセージを復元
  let decodedMessage = '';
  try {
    decodedMessage = new TextDecoder().decode(receivedBytes);
  } catch (e) {
    decodedMessage = typeof authMessage === 'string' ? authMessage : '';
  }

  if (!decodedMessage) {
    logWarning('Failed to decode message');
    return false;
  }

  // カノニカルメッセージを再生成
  const lines = (decodedMessage || '').split('\n');
  const kvPairs = lines.slice(1).map((l) => l.trim()).filter(Boolean);
  const kv: Record<string, string> = {};
  
  for (const pair of kvPairs) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      kv[k] = v;
    }
  }

  const msgAddress = kv['address'] || '';
  
  // アドレスが一致するか確認
  if (msgAddress.toLowerCase() !== address.toLowerCase()) {
    logWarning('Address mismatch in message', {
      messageAddress: msgAddress,
      requestAddress: address
    });
    return false;
  }

  // Sui SDKでの検証を試行（Cloudflare Workers環境では動作しない可能性があるため、フォールバックあり）
  let useSuiSDK = false;
  try {
    if (typeof signature === 'string' && signature.length > 0) {
      // verifyPersonalMessageSignatureを試行
      // Cloudflare Workers環境では動作しない可能性があるため、エラーをキャッチ
      await verifyPersonalMessageSignature(receivedBytes, signature);
      useSuiSDK = true;
      return true;
    }
  } catch (e: any) {
    // Sui SDKが使用できない場合（Cloudflare Workers環境など）は、フォールバック検証を使用
    logWarning('Sui SDK verification not available, using fallback', {
      error: e?.message,
      name: e?.name
    });
    useSuiSDK = false;
  }

  // フォールバック検証（Cloudflare Workers環境で動作する）
  try {
    // verifySignedMessageを使用（@noble/ed25519ベース）
    const signatureData = {
      signature: signature,
      bytes: receivedBytes,
      publicKey: request.publicKey
    };
    
    const isValid = await verifySignedMessage(signatureData, receivedBytes);
    if (isValid) {
      return true;
    } else {
      logWarning('Fallback signature verification failed');
      return false;
    }
  } catch (e: any) {
    logError('All signature verification methods failed', {
      error: e?.message,
      name: e?.name,
      signatureLength: signature?.length,
      bytesLength: receivedBytes.length
    });
    return false;
  }
}

/**
 * イベント期間チェック
 * @param event イベントデータ
 * @returns アクティブかどうか
 */
export function isEventActive(event: EventData): boolean {
  const now = Date.now();
  const startTime = Date.parse(event.startAt);
  const endTime = Date.parse(event.endAt);
  
  return Boolean(event.active) && now >= startTime && now <= endTime;
}

/**
 * アドレス形式検証
 * @param address Suiアドレス
 * @returns 有効かどうか
 */
export function validateAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(address);
}

/**
 * 重複ミントチェック
 * @param eventId イベントID
 * @param address ユーザーアドレス
 * @param mintedStore KVストア
 * @returns 既にミント済みかどうか
 */
export async function isAlreadyMinted(
  eventId: string, 
  address: string, 
  mintedStore: KVNamespace
): Promise<boolean> {
  const addrLower = address.toLowerCase();
  const mintedKey = `minted:${eventId}:${addrLower}`;
  const existing = await mintedStore.get(mintedKey);
  return Boolean(existing);
}

/**
 * ミント上限チェック
 * @param event イベントデータ
 * @param eventId イベントID
 * @param mintedStore KVストア
 * @returns 上限に達しているかどうか
 */
export async function isMintCapReached(
  event: EventData,
  eventId: string,
  mintedStore: KVNamespace
): Promise<boolean> {
  if (typeof event.totalCap !== 'number' || event.totalCap < 0) {
    return false; // 上限なし
  }

  const mintedCountKey = `minted_count:${eventId}`;
  const mintedCountStr = await mintedStore.get(mintedCountKey);
  const mintedCount = mintedCountStr ? Number(mintedCountStr) : 0;
  
  return mintedCount >= event.totalCap;
}

/**
 * スポンサーAPIへのミント委譲
 * @param event イベントデータ
 * @param address 受信者アドレス
 * @param sponsorUrl スポンサーAPI URL
 * @returns ミント結果
 */
export async function delegateToSponsor(
  event: EventData,
  address: string,
  sponsorUrl: string
): Promise<MintResult> {
  const payload = {
    eventId: event.id,
    recipient: address,
    moveCall: event.moveCall,
    imageCid: event.imageCid,
    imageMimeType: event.imageMimeType,
    collectionId: event.collectionId,
    eventName: event.name || 'Event NFT',
    eventDescription: event.description || 'Event NFT',
    eventDate: event.eventDate || event.startAt || new Date().toISOString()
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000); // 28秒タイムアウト（Cloudflare Workersの30秒制限を考慮）

    console.log('[DELEGATE] Sending request to sponsor API', { 
      sponsorUrl, 
      eventId: payload.eventId,
      recipient: payload.recipient 
    });
    
    let response: Response;
    const startTime = Date.now();
    try {
      response = await fetch(`${sponsorUrl}/api/mint`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'NFT-Verification-Worker/1.0'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const elapsed = Date.now() - startTime;
      console.log('[DELEGATE] Sponsor API response received', { 
        status: response.status, 
        elapsed: `${elapsed}ms` 
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      console.error('[DELEGATE] Sponsor API request failed', {
        error: fetchError?.message,
        name: fetchError?.name,
        elapsed: `${elapsed}ms`,
        aborted: controller.signal.aborted
      });
      if (fetchError.name === 'AbortError' || controller.signal.aborted) {
        throw new Error(`Sponsor API request timeout after ${elapsed}ms. The sponsor service may be slow or unavailable.`);
      }
      throw new Error(`Sponsor API request failed: ${fetchError.message || 'Network error'}`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (controller.signal.aborted) {
      const elapsed = Date.now() - startTime;
      throw new Error(`Sponsor API request timeout after ${elapsed}ms`);
    }

    const result = await response.json().catch((parseError: any) => {
      console.error('[DELEGATE] Failed to parse sponsor API response', {
        status: response.status,
        statusText: response.statusText,
        parseError: parseError?.message
      });
      return null;
    }) as any;
    
    if (!response.ok) {
      console.error('[DELEGATE] Sponsor API returned error status', {
        status: response.status,
        statusText: response.statusText,
        result
      });
      throw new Error(result?.error || `Sponsor mint failed (${response.status}): ${response.statusText}`);
    }

    if (!result?.success) {
      console.error('[DELEGATE] Sponsor API returned unsuccessful result', { result });
      throw new Error(result?.error || 'Sponsor mint failed: Unknown error');
    }

    const txDigest = result.txDigest || result.data?.txDigest;
    if (!txDigest) {
      console.error('[DELEGATE] No transaction digest in sponsor API response', { result });
      throw new Error('No transaction digest returned from sponsor');
    }

    console.log('[DELEGATE] Sponsor API mint successful', { txDigest });
    return { txDigest, success: true };
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      const elapsed = error.message?.match(/\d+ms/) || ['unknown'];
      throw new Error(`Sponsor API request timeout (${elapsed[0]}). The sponsor service may be slow or unavailable. Please try again.`);
    }
    // エラーメッセージをそのまま伝播
    throw error;
  }
}

/**
 * ミント記録の保存
 * @param eventId イベントID
 * @param address ユーザーアドレス
 * @param txDigest トランザクションハッシュ
 * @param mintedStore KVストア
 */
export async function saveMintRecord(
  eventId: string,
  address: string,
  txDigest: string,
  mintedStore: KVNamespace
): Promise<void> {
  const addrLower = address.toLowerCase();
  const mintedKey = `minted:${eventId}:${addrLower}`;
  
  await mintedStore.put(
    mintedKey,
    JSON.stringify({ tx: txDigest, at: new Date().toISOString() }),
    { expirationTtl: 60 * 60 * 24 * 365 }
  );
}

/**
 * ミント数の更新
 * @param eventId イベントID
 * @param mintedStore KVストア
 */
export async function incrementMintCount(
  eventId: string,
  mintedStore: KVNamespace
): Promise<void> {
  const mintedCountKey = `minted_count:${eventId}`;
  const mintedCountStr = await mintedStore.get(mintedCountKey);
  const mintedCount = mintedCountStr ? Number(mintedCountStr) : 0;
  
  await mintedStore.put(mintedCountKey, String(mintedCount + 1));
}
