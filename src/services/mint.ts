/**
 * NFT ミントサービス
 * 署名検証、イベント期間チェック、重複防止、スポンサー委譲を担当
 */

import { verifyPersonalMessageSignature } from '@mysten/sui/verify';
// import { verifySignedMessage } from '../utils/signature';
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
  const { signature, bytes, authMessage } = request;
  
  // bytesをUint8Arrayに変換
  const receivedBytes = new Uint8Array(bytes);
  
  // 受信メッセージを復元
  let decodedMessage = '';
  try {
    decodedMessage = new TextDecoder().decode(receivedBytes);
  } catch (e) {
    decodedMessage = typeof authMessage === 'string' ? authMessage : '';
  }

  // カノニカルメッセージを再生成
  const lines = (decodedMessage || '').split('\n');
  const header = lines[0] || '';
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
  const msgEventId = kv['eventId'] || '';
  const msgNonce = kv['nonce'] || '';
  const msgTimestamp = kv['timestamp'] || '';

  const canonicalHeader = 'SXT Event Mint';
  const canonicalMessage = [
    canonicalHeader,
    `address=${msgAddress}`,
    `eventId=${msgEventId}`,
    `nonce=${msgNonce}`,
    `timestamp=${msgTimestamp}`
  ].join('\n');

  const expectedBytes = new TextEncoder().encode(canonicalMessage);

  // Sui SDKでの検証を優先
  try {
    if (typeof signature === 'string') {
      await verifyPersonalMessageSignature(receivedBytes, signature);
      return true;
    }
  } catch (e) {
    logWarning('Sui signature verification failed, trying fallback', e);
  }

  // フォールバック検証（一時的に無効化）
  try {
    // return await verifySignedMessage(
    //   { signature, bytes: receivedBytes, publicKey: request.publicKey },
    //   expectedBytes
    // );
    logWarning('Fallback signature verification temporarily disabled');
    return false;
  } catch (e) {
    logError('All signature verification methods failed', e);
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
    eventDate: event.eventDate || event.startAt || new Date().toISOString()
  };

  const response = await fetch(`${sponsorUrl}/api/mint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

    const result = await response.json().catch(() => null) as any;
    
    if (!response.ok || !result?.success) {
      throw new Error(result?.error || `Sponsor mint failed (${response.status})`);
    }

    const txDigest = result.txDigest || result.data?.txDigest;
  if (!txDigest) {
    throw new Error('No transaction digest returned from sponsor');
  }

  return { txDigest, success: true };
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
