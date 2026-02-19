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
  incrementMintCount,
  setMintInProgress,
  clearMintInProgress
} from '../services/mint';
import { logError, logWarning } from '../utils/logger';

// Cloudflare Workers環境の型定義
interface Env {
  EVENT_STORE?: KVNamespace;
  MINTED_STORE?: KVNamespace;
  COLLECTION_STORE?: KVNamespace;
  MINT_SPONSOR_API_URL?: string;
  DISCORD_BOT_API_URL?: string;
  ADMIN_API_KEY?: string;
  ctx?: ExecutionContext;
  [key: string]: any;
}

// ExecutionContext型定義
interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

const app = new Hono<{ Bindings: Env }>();

/**
 * ミント済みチェック
 * GET /api/mints/check
 */
app.get('/api/mints/check', async (c) => {
  try {
    const eventId = c.req.query('eventId');
    const address = c.req.query('address');
    
    if (!eventId || !address) {
      return c.json({ success: false, error: 'eventId and address are required' }, 400);
    }

    // アドレス形式の検証
    if (!validateAddress(address)) {
      return c.json({ success: false, error: 'Invalid address format' }, 400);
    }

    const mintedStore = c.env.MINTED_STORE as KVNamespace;
    if (!mintedStore) {
      return c.json({ success: false, error: 'MINTED_STORE is not available' }, 503);
    }

    // 重複ミントチェック
    const alreadyMinted = await isAlreadyMinted(eventId, address, mintedStore);

    return c.json({ 
      success: true, 
      alreadyMinted 
    });

  } catch (error: any) {
    logError('Mint check API error', error);
    return c.json({ success: false, error: `Mint check API error: ${error?.message || 'Unknown error'}` }, 500);
  }
});

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
    if (!ev.collectionName && ev.selectedCollectionId && c.env.COLLECTION_STORE) {
      const collectionStr = await c.env.COLLECTION_STORE.get('mint_collections');
      const collections = collectionStr ? JSON.parse(collectionStr) : [];
      if (Array.isArray(collections)) {
        const matched = collections.find((col: any) => String(col?.id || '').trim() === String(ev.selectedCollectionId).trim());
        if (matched?.name) {
          ev.collectionName = matched.name;
        }
      }
    }

    // 新パッケージ(0x7883f18a...)の mint_to は7引数必要。{collectionName} がないと ArityMismatch になるため正規化
    const mc = ev.moveCall || {};
    const target = String(mc.target || '').toLowerCase();
    const isNewPackage = target.includes('0x7883f18a9764824858f831615df9269dcbe6c6158a4b7e426eaba96a04cd0e89');
    const tpl = Array.isArray(mc.argumentsTemplate) ? [...mc.argumentsTemplate] : [];
    if (isNewPackage && !tpl.includes('{collectionName}')) {
      tpl.push('{collectionName}');
      ev.moveCall = { ...mc, argumentsTemplate: tpl };
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

    // スポンサー委譲前にロックを設定（並列リクエストによる重複ミント防止）
    await setMintInProgress(eventId, address, mintedStore);

    // スポンサーAPIへ委譲
    let mintResult;
    try {
      mintResult = await delegateToSponsor(ev, address, sponsorUrl);
    } catch (sponsorError: any) {
      await clearMintInProgress(eventId, address, mintedStore);
      logError('Sponsor API delegation failed', sponsorError);
      const errorMsg = sponsorError?.message || 'Unknown error';
      return c.json({ 
        success: false, 
        error: `Sponsor API error: ${errorMsg}` 
      }, 500);
    }

    // ミント記録の保存とミント数の更新を並列実行
    try {
      await Promise.all([
        saveMintRecord(eventId, address, mintResult.txDigest, mintedStore),
        incrementMintCount(eventId, mintedStore)
      ]);
    } catch (saveError: any) {
      logError('Failed to save mint record', saveError);
      // ミントは成功しているが、記録の保存に失敗した場合は警告のみ
      // トランザクションは既に完了しているため、エラーを返さない
    }

    // ミント詳細ログは非同期で実行（レスポンスをブロックしない）
    // ExecutionContextがあればwaitUntilを使用、なければバックグラウンドで実行
    if (mintResult.txDigest && ev.collectionId) {
      const logPromise = logMintDetails(mintResult.txDigest, ev, address, c.env).catch((e) => {
        logError('Mint log enrichment failed', e);
        return [];
      });
      
      // ExecutionContextへのアクセスを試行（Honoでは通常利用不可）
      // バックグラウンドで実行（エラーを無視）
      logPromise.catch(() => {});
    }

    return c.json({ 
      success: true, 
      data: { 
        txDigest: mintResult.txDigest,
        nftObjectIds: [] // 非同期実行のため空配列を返す
      } 
    });

  } catch (error: any) {
    logError('Mint API error', error);
    const errorMessage = error?.message || 'Unknown error';
    return c.json({ 
      success: false, 
      error: `Mint API error: ${errorMessage}` 
    }, 500);
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
    // Sui JSON-RPC 呼び出しで objectChanges を取得（タイムアウト付き）
    const suiNet = env.SUI_NETWORK || 'mainnet';
    const fullnode = suiNet === 'testnet'
      ? 'https://fullnode.testnet.sui.io:443'
      : suiNet === 'devnet'
        ? 'https://fullnode.devnet.sui.io:443'
        : 'https://fullnode.mainnet.sui.io:443';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒タイムアウト

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
      }),
      signal: controller.signal
    }).finally(() => {
      clearTimeout(timeoutId);
    });

    if (controller.signal.aborted) {
      throw new Error('Sui RPC request timeout');
    }

    const rpcJson: any = await rpcResp.json().catch(() => null);
    if (!rpcJson || rpcJson.error) {
      throw new Error(rpcJson?.error?.message || 'Failed to fetch transaction from Sui');
    }
    
    const changes: any[] = rpcJson?.result?.objectChanges || [];
    const created = changes.filter((ch) => ch?.type === 'created');
    
    const nftObjects = created
      .filter((ch) => typeof ch?.objectType === 'string' && ch.objectType === ev.collectionId)
      .map((ch) => ch.objectId)
      .filter(Boolean);
    
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

  } catch (e: any) {
    // タイムアウトやネットワークエラーは警告のみ（ログに記録しない）
    if (e.name === 'AbortError' || e.message?.includes('timeout')) {
      logWarning('Mint log enrichment timeout (non-critical)', e);
    } else {
      logError('Failed to log mint details', e);
    }
    return [];
  }
}

export default app;
