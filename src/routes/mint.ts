/**
 * NFT ミントAPI
 * 署名検証、イベント期間チェック、重複防止、スポンサー委譲を統合
 */

import { Hono } from 'hono';
import { 
  verifySignature, 
  isEventActive, 
  validateAddress, 
  isAlreadyMinted, 
  isMintCapReached,
  delegateToSponsor,
  saveMintRecord,
  incrementMintCount
} from '../services/mint';
import { logError } from '../utils/logger';

// Cloudflare Workers環境の型定義
interface Env {
  EVENT_STORE?: KVNamespace;
  MINTED_STORE?: KVNamespace;
  MINT_SPONSOR_API_URL?: string;
  DISCORD_BOT_API_URL?: string;
  [key: string]: any;
}

const app = new Hono<{ Bindings: Env }>();

/**
 * NFT ミント実行
 * POST /api/mint
 */
app.post('/api/mint', async (c) => {
  try {
    const eventStore = c.env.EVENT_STORE as KVNamespace;
    const mintedStore = c.env.MINTED_STORE as KVNamespace;
    
    if (!eventStore) {
      return c.json({ success: false, error: 'EVENT_STORE is not available' }, 503);
    }
    if (!mintedStore) {
      return c.json({ success: false, error: 'MINTED_STORE is not available' }, 503);
    }

    const body = await c.req.json().catch(() => ({}));
    const { eventId, address, signature, bytes, publicKey, authMessage } = body || {};

    // 必須フィールドの検証
    const missing = ['eventId', 'address', 'signature', 'authMessage'].filter((k) => !(body && body[k]));
    if (missing.length) {
      return c.json({ success: false, error: `Missing: ${missing.join(', ')}` }, 400);
    }

    // アドレス形式の検証
    if (!validateAddress(address)) {
      return c.json({ success: false, error: 'Invalid address format' }, 400);
    }

    // イベント取得
    const listStr = await eventStore.get('events');
    const list = listStr ? JSON.parse(listStr) : [];
    const ev = Array.isArray(list) ? list.find((e: any) => e && e.id === eventId) : null;
    
    if (!ev) {
      return c.json({ success: false, error: 'Event not found' }, 404);
    }

    // イベント期間チェック
    if (!isEventActive(ev)) {
      return c.json({ success: false, error: 'Event is not active' }, 400);
    }

    // 重複防止チェック
    if (await isAlreadyMinted(eventId, address, mintedStore)) {
      return c.json({ success: false, error: 'Already minted for this event' }, 400);
    }

    // ミント上限チェック
    if (await isMintCapReached(ev, eventId, mintedStore)) {
      return c.json({ success: false, error: 'Mint cap reached for this event' }, 400);
    }

    // 署名検証
    const isValidSignature = await verifySignature({
      eventId,
      address,
      signature,
      bytes,
      publicKey,
      authMessage
    });

    if (!isValidSignature) {
      return c.json({ success: false, error: 'Invalid signature' }, 400);
    }

    // スポンサーAPI URL取得
    const sponsorUrl = c.env.MINT_SPONSOR_API_URL || c.env.DISCORD_BOT_API_URL;
    if (!sponsorUrl) {
      return c.json({ success: false, error: 'Sponsor API URL is not configured' }, 500);
    }

    // スポンサーAPIへ委譲
    const mintResult = await delegateToSponsor(ev, address, sponsorUrl);

    // ミント記録の保存
    await saveMintRecord(eventId, address, mintResult.txDigest, mintedStore);

    // ミント数の更新
    await incrementMintCount(eventId, mintedStore);

    // ミント詳細ログ（コレクション別）& NFTオブジェクトID取得
    let nftObjectIds: string[] = [];
    try {
      if (mintResult.txDigest && ev.collectionId) {
        nftObjectIds = await logMintDetails(mintResult.txDigest, ev, address, c.env);
      }
    } catch (e) {
      logError('Mint log enrichment failed', e);
    }

    return c.json({ 
      success: true, 
      data: { 
        txDigest: mintResult.txDigest,
        nftObjectIds: nftObjectIds
      } 
    });

  } catch (error: any) {
    logError('Mint API error', error);
    console.error('Mint API detailed error:', {
      message: error?.message,
      stack: error?.stack,
      name: error?.name
    });
    return c.json({ success: false, error: `Mint API error: ${error?.message || 'Unknown error'}` }, 500);
  }
});

/**
 * ミント詳細ログの記録
 * @param txDigest トランザクションハッシュ
 * @param ev イベントデータ
 * @param address ユーザーアドレス
 * @param env 環境変数
 * @returns NFTオブジェクトIDの配列
 */
async function logMintDetails(txDigest: string, ev: any, address: string, env: any): Promise<string[]> {
  try {
    // Sui JSON-RPC 呼び出しで objectChanges を取得
    const suiNet = env.SUI_NETWORK || 'mainnet';
    const fullnode = suiNet === 'testnet'
      ? 'https://fullnode.testnet.sui.io:443'
      : suiNet === 'devnet'
        ? 'https://fullnode.devnet.sui.io:443'
        : 'https://fullnode.mainnet.sui.io:443';

    const rpcResp = await fetch(fullnode, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sui_getTransactionBlock',
        params: [txDigest, { 
          showObjectChanges: true, 
          showEffects: false, 
          showInput: false, 
          showEvents: true 
        }]
      })
    });

    const rpcJson: any = await rpcResp.json().catch(() => null);
    const changes: any[] = rpcJson?.result?.objectChanges || [];
    
    console.log(`[Mint Log] Total object changes: ${changes.length}`);
    console.log(`[Mint Log] Expected collectionId: ${ev.collectionId}`);
    
    const created = changes.filter((ch) => ch?.type === 'created');
    console.log(`[Mint Log] Created objects: ${created.length}`);
    created.forEach((ch, idx) => {
      console.log(`[Mint Log] Created[${idx}]: type=${ch?.type}, objectType=${ch?.objectType}, objectId=${ch?.objectId}`);
    });
    
    const nftObjects = created
      .filter((ch) => typeof ch?.objectType === 'string' && ch.objectType === ev.collectionId)
      .map((ch) => ch.objectId)
      .filter(Boolean);
    
    console.log(`[Mint Log] Filtered NFT objects: ${nftObjects.length}`, nftObjects);

    const log = {
      txDigest,
      eventId: ev.id,
      collectionType: ev.collectionId,
      recipient: address,
      objectIds: nftObjects,
      at: new Date().toISOString()
    };

    const mintedStore = env.MINTED_STORE as KVNamespace;
    
    // 1) 取引別レコード
    await mintedStore.put(`mint_tx:${txDigest}`, JSON.stringify(log), { 
      expirationTtl: 60 * 60 * 24 * 365 
    });

    // 2) コレクション別インデックス
    const idxKeyAll = `mint_index:${ev.collectionId}`;
    const idxKeyEvt = `mint_index:${ev.collectionId}:${ev.id}`;
    const idxAllStr = await mintedStore.get(idxKeyAll);
    const idxEvtStr = await mintedStore.get(idxKeyEvt);
    const idxAll = idxAllStr ? JSON.parse(idxAllStr) : [];
    const idxEvt = idxEvtStr ? JSON.parse(idxEvtStr) : [];

    if (!idxAll.includes(txDigest)) idxAll.unshift(txDigest);
    if (!idxEvt.includes(txDigest)) idxEvt.unshift(txDigest);

    await mintedStore.put(idxKeyAll, JSON.stringify(idxAll.slice(0, 1000)), { 
      expirationTtl: 60 * 60 * 24 * 365 
    });
    await mintedStore.put(idxKeyEvt, JSON.stringify(idxEvt.slice(0, 1000)), { 
      expirationTtl: 60 * 60 * 24 * 365 
    });

    // NFTオブジェクトIDを返す
    return nftObjects;

  } catch (e) {
    logError('Failed to log mint details', e);
    return [];
  }
}

export default app;
