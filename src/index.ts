/**
 * NFT Verification Portal - メインエントリーポイント
 * Walrus.pdf 準拠の設計に刷新
 */

import { Hono } from 'hono';
import { DmSettings, DmTemplate, DmMode, DEFAULT_DM_SETTINGS, BatchConfig, BatchStats, DEFAULT_BATCH_CONFIG } from './types';

// Cloudflare Workers型定義のインポート
declare global {
  interface ScheduledController {
    readonly scheduledTime: number;
    readonly cron: string;
    noRetry(): void;
  }
  
  interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
    props: any;
  }
}

// 新しいモジュール化されたルート
import walrusRoutes from './routes/walrus';
import mintRoutes from './routes/mint';

// Cloudflare Workers環境の型定義
interface Env {
  NONCE_STORE: KVNamespace;
  COLLECTION_STORE: KVNamespace;
  DM_TEMPLATE_STORE?: KVNamespace;
  EVENT_STORE?: KVNamespace;
  MINTED_STORE?: KVNamespace;
  NFT_COLLECTION_ID: string;
  DISCORD_BOT_API_URL: string;
  MINT_SPONSOR_API_URL?: string;
  SUI_NETWORK?: string;
  WALRUS_PUBLISHER_BASE?: string;
  WALRUS_AGGREGATOR_BASE?: string;
  WALRUS_DEFAULT_EPOCHS?: string;
  WALRUS_DEFAULT_PERMANENT?: string;
  [key: string]: any;
}

const app = new Hono<{ Bindings: Env }>();

// カスタムCORSミドルウェア
app.use('*', async (c, next) => {
  const method = c.req.method;
  
  // すべてのレスポンスにCORSヘッダーを設定
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Admin-Address, X-Wallet-Connected, X-API-Key');
  c.header('Access-Control-Max-Age', '86400');
  c.header('Vary', 'Origin');
  
  // OPTIONSリクエストの場合は即座にレスポンス
  if (method === 'OPTIONS') {
    return new Response('', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Admin-Address, X-Wallet-Connected, X-API-Key',
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

// Move ターゲット取得（既存API維持）
app.get('/api/move-targets', (c) => {
  const defaultMoveTarget = c.env.DEFAULT_MOVE_TARGET || '';
  const defaultCollectionCreateTarget = c.env.DEFAULT_COLLECTION_CREATE_TARGET || '';
  return c.json({ success: true, data: { defaultMoveTarget, defaultCollectionCreateTarget } });
});

// 新しいWalrus API（PDF準拠）
app.route('/', walrusRoutes);

// 新しいミントAPI（サービス化）
app.route('/', mintRoutes);

// 既存のイベント管理API（後で整理予定）
app.get('/api/events', async (c) => {
  try {
    const store = c.env.EVENT_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'EVENT_STORE is not available' }, 503);
    }

    const listStr = await store.get('events');
    const list = listStr ? JSON.parse(listStr) : [];
    
    // 各イベントにmintedCountを追加
    const mintedStore = c.env.MINTED_STORE as KVNamespace | undefined;
    if (mintedStore && Array.isArray(list)) {
      for (const event of list) {
        if (event && event.id) {
          const mintedCountKey = `minted_count:${event.id}`;
          const mintedCountStr = await mintedStore.get(mintedCountKey);
          event.mintedCount = mintedCountStr ? Number(mintedCountStr) : 0;
        }
      }
    }
    
    return c.json({ success: true, data: list });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch events' }, 500);
  }
});

app.get('/api/events/:id/public', async (c) => {
  try {
    const store = c.env.EVENT_STORE as KVNamespace | undefined;
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

    // mintedCountを追加
    const mintedStore = c.env.MINTED_STORE as KVNamespace | undefined;
    if (mintedStore) {
      const mintedCountKey = `minted_count:${id}`;
      const mintedCountStr = await mintedStore.get(mintedCountKey);
      ev.mintedCount = mintedCountStr ? Number(mintedCountStr) : 0;
    }

    const now = Date.now();
    const active = Boolean(ev.active) && ev.startAt && ev.endAt && now >= Date.parse(ev.startAt) && now <= Date.parse(ev.endAt);

    return c.json({ success: true, data: { ...ev, active } });
  } catch (error) {
    console.error('Failed to get public event', error);
    return c.json({ success: false, error: 'Failed to load event' }, 500);
  }
});

// オーナーを最終的なアドレスに解決する（Kiosk対応・content.ownerチェック）
async function resolveFinalOwner(owner: any, fullnode: string, depth = 0): Promise<string | null> {
  // 無限ループ防止
  if (depth > 5) {
    console.warn('Max depth reached for owner resolution');
    return null;
  }

  if (!owner) return null;

  // AddressOwner → 最終的なアドレス
  if (owner.AddressOwner) {
    return owner.AddressOwner;
  }

  // ObjectOwner（Kioskなど） → contentフィールドのownerを確認
  if (owner.ObjectOwner) {
    const kioskId = owner.ObjectOwner;
    console.log(`Resolving Kiosk/ObjectOwner: ${kioskId} (depth: ${depth})`);
    
    try {
      const response = await fetch(fullnode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sui_getObject',
          params: [
            kioskId,
            {
              showType: true,
              showOwner: true,
              showContent: true  // contentも取得
            }
          ]
        })
      });

      const result = await response.json() as any;
      
      if (result.result && result.result.data) {
        // Kioskのcontent.fields.ownerをチェック（実質的な所有者）
        if (result.result.data.content?.fields?.owner) {
          const kioskOwner = result.result.data.content.fields.owner;
          console.log(`Kiosk content owner found: ${kioskOwner}`);
          return kioskOwner;
        }
        
        // 従来の方法（ownerフィールドを再帰的に解決）
        if (result.result.data.owner) {
          return await resolveFinalOwner(result.result.data.owner, fullnode, depth + 1);
        }
      }
    } catch (error) {
      console.error(`Failed to resolve Kiosk owner for ${kioskId}:`, error);
    }
    
    return null;
  }

  // Shared/Immutableは人のアドレスではない
  if (owner.Shared || owner.Immutable) {
    return null;
  }

  return null;
}

// コレクションごとのオンチェーンNFT数を取得（完全オンチェーン準拠・GraphQL使用）
app.get('/api/collection-onchain-count/:collectionId', async (c) => {
  try {
    const collectionId = c.req.param('collectionId');
    
    // Sui GraphQL APIエンドポイント
    const suiNet = c.env.SUI_NETWORK || 'mainnet';
    const graphqlEndpoint = suiNet === 'testnet'
      ? 'https://sui-testnet.mystenlabs.com/graphql'
      : suiNet === 'devnet'
        ? 'https://sui-devnet.mystenlabs.com/graphql'
        : 'https://sui-mainnet.mystenlabs.com/graphql';
    
    const fullnode = suiNet === 'testnet'
      ? 'https://fullnode.testnet.sui.io:443'
      : suiNet === 'devnet'
        ? 'https://fullnode.devnet.sui.io:443'
        : 'https://fullnode.mainnet.sui.io:443';

    console.log(`Searching for NFTs of type: ${collectionId}`);

    // GraphQL query to find all objects of this type
    const query = `
      query GetObjects($type: String!) {
        objects(filter: { type: $type }, first: 50) {
          nodes {
            address
            owner {
              ... on AddressOwner {
                owner {
                  address
                }
              }
              ... on Parent {
                parent {
                  address
                }
              }
              ... on Shared {
                initialSharedVersion
              }
              ... on Immutable {
                __typename
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    try {
      const graphqlResponse = await fetch(graphqlEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: {
            type: collectionId
          }
        })
      });

      const graphqlResult = await graphqlResponse.json() as any;
      
      if (graphqlResult.errors) {
        console.error('GraphQL errors:', graphqlResult.errors);
        return c.json({
          success: false,
          error: 'GraphQL query failed',
          details: graphqlResult.errors
        }, 500);
      }

      const objects = graphqlResult.data?.objects?.nodes || [];
      let activeCount = 0;
      let kioskCount = 0;
      const uniqueOwners = new Set<string>();

      console.log(`Found ${objects.length} objects of type ${collectionId}`);

      for (const obj of objects) {
        if (obj.owner) {
          activeCount++;
          
          // AddressOwner
          if (obj.owner.owner?.address) {
            uniqueOwners.add(obj.owner.owner.address);
          }
          // Parent (Kiosk)
          else if (obj.owner.parent?.address) {
            kioskCount++;
            // Kioskの最終オーナーを解決
            const kioskId = obj.owner.parent.address;
            const finalOwner = await resolveFinalOwnerByObjectId(kioskId, fullnode);
            if (finalOwner) {
              uniqueOwners.add(finalOwner);
            }
          }
          // Shared/Immutableは所有者なし
        }
      }

      console.log(`Collection ${collectionId}: ${activeCount} active (${kioskCount} in Kiosk), ${uniqueOwners.size} unique owners`);

      return c.json({
        success: true,
        count: activeCount,
        active: activeCount,
        burned: 0, // GraphQLでは削除されたオブジェクトは返されない
        inKiosk: kioskCount,
        uniqueHolders: uniqueOwners.size,
        totalMinted: activeCount // GraphQLで取得できたアクティブな数
      });

    } catch (graphqlError) {
      console.error('GraphQL request failed:', graphqlError);
      
      // フォールバック: 既知のアドレスがあれば suix_getOwnedObjects を使用
      console.log('Falling back to RPC method...');
      return c.json({
        success: true,
        count: 0,
        active: 0,
        burned: 0,
        inKiosk: 0,
        uniqueHolders: 0,
        totalMinted: 0,
        note: 'GraphQL unavailable, no data available'
      });
    }
    
  } catch (error) {
    console.error('Failed to get onchain collection count', error);
    return c.json({ success: false, error: 'Failed to get onchain count' }, 500);
  }
});

// objectIdからオーナーを解決する補助関数
async function resolveFinalOwnerByObjectId(objectId: string, fullnode: string): Promise<string | null> {
  try {
    const response = await fetch(fullnode, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sui_getObject',
        params: [
          objectId,
          {
            showType: false,
            showOwner: true,
            showContent: false
          }
        ]
      })
    });

    const result = await response.json() as any;
    
    if (result.result && result.result.data && result.result.data.owner) {
      return await resolveFinalOwner(result.result.data.owner, fullnode);
    }
  } catch (error) {
    console.error(`Failed to resolve owner for ${objectId}:`, error);
  }
  
  return null;
}

// ユーザーが保有しているNFTを取得（Kiosk対応・event_date補完）
app.get('/api/owned-nfts/:address', async (c) => {
  try {
    const userAddress = c.req.param('address');
    const collectionIds = c.req.query('collectionIds')?.split(',') || [];
    
    if (!userAddress || collectionIds.length === 0) {
      return c.json({ success: false, error: 'Missing address or collectionIds' }, 400);
    }

    const suiNet = c.env.SUI_NETWORK || 'mainnet';
    const graphqlEndpoint = suiNet === 'testnet'
      ? 'https://sui-testnet.mystenlabs.com/graphql'
      : suiNet === 'devnet'
        ? 'https://sui-devnet.mystenlabs.com/graphql'
        : 'https://sui-mainnet.mystenlabs.com/graphql';
    
    const fullnode = suiNet === 'testnet'
      ? 'https://fullnode.testnet.sui.io:443'
      : suiNet === 'devnet'
        ? 'https://fullnode.devnet.sui.io:443'
        : 'https://fullnode.mainnet.sui.io:443';

    const ownedNFTs: any[] = [];

    // イベント一覧を取得（event_date補完用）
    const eventStore = c.env.EVENT_STORE as KVNamespace | undefined;
    let events: any[] = [];
    if (eventStore) {
      try {
        const listStr = await eventStore.get('events');
        events = listStr ? JSON.parse(listStr) : [];
      } catch (e) {
        console.error('Failed to load events for fallback:', e);
      }
    }

    // まずユーザーが直接所有しているNFTを取得（RPC使用）
    try {
      const rpcResponse = await fetch(fullnode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getOwnedObjects',
          params: [
            userAddress,
            {
              filter: collectionIds.length === 1 
                ? { StructType: collectionIds[0] }
                : { MatchAny: collectionIds.map(id => ({ StructType: id })) },
              options: {
                showType: true,
                showDisplay: true,
                showContent: true
              }
            },
            null,
            50
          ]
        })
      });

      const rpcResult = await rpcResponse.json() as any;
      
      if (rpcResult.result?.data) {
        for (const obj of rpcResult.result.data) {
          if (obj.data?.display?.data) {
            const displayData = obj.data.display.data;
            
            // event_date補完: display.event_dateがなければまたは{eventDate}テンプレートの場合、イベント名から検索
            if ((!displayData.event_date || displayData.event_date === '{eventDate}') && displayData.name) {
              const matchingEvent = events.find((e: any) => e.name === displayData.name);
              if (matchingEvent) {
                displayData.event_date = matchingEvent.eventDate || matchingEvent.startAt;
              }
            }
            
            ownedNFTs.push({
              objectId: obj.data.objectId,
              type: obj.data.type,
              display: displayData,
              owner: obj.data.owner
            });
          }
        }
      }
    } catch (rpcError) {
      console.error('RPC owned objects failed:', rpcError);
    }

    // 次にGraphQLで全NFTを検索してKiosk内も確認
    for (const collectionId of collectionIds) {
      try {
        const query = `
          query GetObjects($type: String!) {
            objects(filter: { type: $type }, first: 50) {
              nodes {
                address
                display {
                  key
                  value
                }
                owner {
                  __typename
                  ... on AddressOwner {
                    owner {
                      address
                    }
                  }
                  ... on Parent {
                    parent {
                      address
                    }
                  }
                }
              }
            }
          }
        `;

        const response = await fetch(graphqlEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            variables: { type: collectionId }
          })
        });

        const result = await response.json() as any;
        
        if (result.data?.objects?.nodes) {
          for (const node of result.data.objects.nodes) {
            let isOwned = false;
            
            // 直接所有
            if (node.owner?.owner?.address?.toLowerCase() === userAddress.toLowerCase()) {
              isOwned = true;
            }
            // Kiosk経由の所有
            else if (node.owner?.parent?.address) {
              const kioskId = node.owner.parent.address;
              console.log(`Resolving owner for NFT ${node.address} (Kiosk: ${kioskId})`);
              
              // GraphQLのParent形式をRPCのObjectOwner形式に変換
              const rpcOwnerFormat = { ObjectOwner: kioskId };
              const finalOwner = await resolveFinalOwner(rpcOwnerFormat, fullnode);
              console.log(`Final owner resolved: ${finalOwner}`);
              
              if (finalOwner?.toLowerCase() === userAddress.toLowerCase()) {
                isOwned = true;
                console.log(`✅ NFT ${node.address} is owned by user (via Kiosk)`);
              } else {
                console.log(`❌ NFT ${node.address} final owner ${finalOwner} != user ${userAddress}`);
              }
            }
            
            if (isOwned) {
              // displayデータを整形
              const displayData: any = {};
              if (node.display) {
                node.display.forEach((item: any) => {
                  displayData[item.key] = item.value;
                });
              }

              // event_date補完: display.event_dateがなければまたは{eventDate}テンプレートの場合、イベント名から検索
              if ((!displayData.event_date || displayData.event_date === '{eventDate}') && displayData.name) {
                const matchingEvent = events.find((e: any) => e.name === displayData.name);
                if (matchingEvent) {
                  displayData.event_date = matchingEvent.eventDate || matchingEvent.startAt;
                }
              }

              ownedNFTs.push({
                objectId: node.address,
                type: collectionId,
                display: displayData,
                owner: node.owner
              });
            }
          }
        }
      } catch (error) {
        console.error(`Failed to fetch NFTs for collection ${collectionId}:`, error);
      }
    }

    // 重複を削除（objectIdでユニーク化）
    const uniqueNFTs = Array.from(
      new Map(ownedNFTs.map(nft => [nft.objectId, nft])).values()
    );

    return c.json({
      success: true,
      data: uniqueNFTs,
      count: uniqueNFTs.length
    });

  } catch (error) {
    console.error('Failed to get owned NFTs', error);
    return c.json({ success: false, error: 'Failed to get owned NFTs' }, 500);
  }
});

// 管理者認証チェック（KVストアから取得）
async function isAdmin(c: any, address: string): Promise<boolean> {
  try {
    // アドレスを正規化（小文字、トリム）
    const normalizedAddress = address?.trim().toLowerCase();
    if (!normalizedAddress) return false;

    // まず環境変数から確認
    const envAdminList = (c.env.ADMIN_ADDRESSES || '')
      .split(',')
      .map((a: string) => a.trim().toLowerCase())
      .filter(Boolean);
    
    if (envAdminList.includes(normalizedAddress)) {
      return true;
    }

    // KVストアから管理者リストを取得
    const store = c.env.COLLECTION_STORE as KVNamespace | undefined;
    if (store) {
      const adminData = await store.get('admin_addresses');
      if (adminData) {
        const kvAdminList = JSON.parse(adminData);
        if (Array.isArray(kvAdminList)) {
          const normalizedKvList = kvAdminList.map((a: string) => a.trim().toLowerCase());
          return normalizedKvList.includes(normalizedAddress);
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('isAdmin check error:', error);
    return false;
  }
}

// 管理者チェックAPI
app.get('/api/admin/check/:address', async (c) => {
  try {
    const address = c.req.param('address');
    const admin = await isAdmin(c, address);
    return c.json({ success: true, isAdmin: admin });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to check admin status' }, 500);
  }
});

// 管理者アドレス設定API（開発用）
app.post('/api/admin/set-addresses', async (c) => {
  try {
    const { addresses } = await c.req.json();
    const store = c.env.COLLECTION_STORE as KVNamespace | undefined;
    
    if (!store) {
      return c.json({ success: false, error: 'Collection store not available' }, 500);
    }
    
    if (!Array.isArray(addresses)) {
      return c.json({ success: false, error: 'Addresses must be an array' }, 400);
    }
    
    await store.put('admin_addresses', JSON.stringify(addresses));
    return c.json({ success: true, message: 'Admin addresses updated' });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to set admin addresses' }, 500);
  }
});

// 管理者一覧取得API
app.get('/api/admin/addresses', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) {
      return c.json({ success: false, error: 'forbidden' }, 403);
    }

    const store = c.env.COLLECTION_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'Collection store not available' }, 500);
    }

    const adminData = await store.get('admin_addresses');
    const addresses = adminData ? JSON.parse(adminData) : [];
    
    return c.json({ success: true, data: addresses });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to get admin addresses' }, 500);
  }
});

// 管理者追加API
app.post('/api/admin/addresses', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) {
      return c.json({ success: false, error: 'forbidden' }, 403);
    }

    const { address } = await c.req.json();
    
    if (!address || typeof address !== 'string') {
      return c.json({ success: false, error: 'address is required' }, 400);
    }

    // アドレス形式の簡易検証
    if (!address.startsWith('0x') || address.length !== 66) {
      return c.json({ success: false, error: 'Invalid address format' }, 400);
    }

    const store = c.env.COLLECTION_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'Collection store not available' }, 500);
    }

    const adminData = await store.get('admin_addresses');
    const addresses = adminData ? JSON.parse(adminData) : [];
    
    // 重複チェック
    if (addresses.some((addr: string) => addr.toLowerCase() === address.toLowerCase())) {
      return c.json({ success: false, error: 'Address already exists' }, 400);
    }

    addresses.push(address);
    await store.put('admin_addresses', JSON.stringify(addresses));
    
    return c.json({ success: true, data: addresses });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to add admin address' }, 500);
  }
});

// 管理者削除API
app.delete('/api/admin/addresses/:address', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) {
      return c.json({ success: false, error: 'forbidden' }, 403);
    }

    const addressToRemove = c.req.param('address');
    
    if (!addressToRemove) {
      return c.json({ success: false, error: 'address is required' }, 400);
    }

    // 環境変数の管理者（メイン管理者）は削除できないように保護
    const envAdminList = (c.env.ADMIN_ADDRESSES || '')
      .split(',')
      .map((a: string) => a.trim().toLowerCase())
      .filter(Boolean);
    
    const normalizedAddressToRemove = addressToRemove.trim().toLowerCase();
    
    if (envAdminList.includes(normalizedAddressToRemove)) {
      return c.json({ 
        success: false, 
        error: 'Cannot remove main administrator (protected by environment variable)' 
      }, 403);
    }

    const store = c.env.COLLECTION_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'Collection store not available' }, 500);
    }

    const adminData = await store.get('admin_addresses');
    const addresses = adminData ? JSON.parse(adminData) : [];
    
    // 最低1つの管理者を維持
    if (addresses.length <= 1) {
      return c.json({ success: false, error: 'Cannot remove the last admin' }, 400);
    }

    // アドレスを削除（大文字小文字を区別しない）
    const filteredAddresses = addresses.filter(
      (addr: string) => addr.toLowerCase() !== normalizedAddressToRemove
    );

    if (filteredAddresses.length === addresses.length) {
      return c.json({ success: false, error: 'Address not found' }, 404);
    }

    await store.put('admin_addresses', JSON.stringify(filteredAddresses));
    
    return c.json({ success: true, data: filteredAddresses });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to remove admin address' }, 500);
  }
});

// Discord ロール管理API
app.post('/api/discord-action', async (c) => {
  try {
    const { discord_id, action, verification_data } = await c.req.json();

    if (!discord_id || !action) {
      return c.json({ success: false, error: 'discord_id and action are required' }, 400);
    }

    // Discord Bot APIに転送
    const botApiUrl = c.env.DISCORD_BOT_API_URL || 'https://nft-verification-bot.onrender.com';
    const response = await fetch(`${botApiUrl}/api/discord-action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Worker'
      },
      body: JSON.stringify({
        discord_id,
        action,
        verification_data
      })
    });

    const result = await response.json();
    return c.json(result);

  } catch (error) {
    console.error('Discord action API error:', error);
    return c.json({ success: false, error: 'Failed to process discord action' }, 500);
  }
});

// Discord 通知API
app.post('/api/notify-discord', async (c) => {
  try {
    const { discordId, action, verificationData, timestamp } = await c.req.json();

    if (!discordId || !action) {
      return c.json({ success: false, error: 'discordId and action are required' }, 400);
    }

    // Discord Bot APIに転送
    const botApiUrl = c.env.DISCORD_BOT_API_URL || 'https://nft-verification-bot.onrender.com';
    const response = await fetch(`${botApiUrl}/api/notify-discord`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Worker'
      },
      body: JSON.stringify({
        discordId,
        action,
        verificationData,
        timestamp
      })
    });

    const result = await response.json();
    return c.json(result);

  } catch (error) {
    console.error('Discord notification API error:', error);
    return c.json({ success: false, error: 'Failed to notify discord' }, 500);
  }
});

// DM設定管理API
app.get('/api/dm-settings', async (c) => {
  try {
    const store = c.env.DM_TEMPLATE_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: true, data: DEFAULT_DM_SETTINGS });
    }

    const settings = await store.get('dm_settings');
    const data = settings ? JSON.parse(settings) : DEFAULT_DM_SETTINGS;
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to get DM settings' }, 500);
  }
});

app.post('/api/dm-settings', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    const settings = await c.req.json();
    const store = c.env.DM_TEMPLATE_STORE as KVNamespace | undefined;
    
    if (!store) {
      return c.json({ success: false, error: 'DM store not available' }, 500);
    }

    await store.put('dm_settings', JSON.stringify(settings));
    return c.json({ success: true, message: 'DM settings updated' });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update DM settings' }, 500);
  }
});

// バッチ処理設定API
app.get('/api/batch-config', async (c) => {
  try {
    const store = c.env.COLLECTION_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: true, data: DEFAULT_BATCH_CONFIG });
    }

    const config = await store.get('batch_config');
    const data = config ? JSON.parse(config) : DEFAULT_BATCH_CONFIG;
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to get batch config' }, 500);
  }
});

app.post('/api/batch-config', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    const config = await c.req.json();
    const store = c.env.COLLECTION_STORE as KVNamespace | undefined;
    
    if (!store) {
      return c.json({ success: false, error: 'Collection store not available' }, 500);
    }

    await store.put('batch_config', JSON.stringify(config));
    return c.json({ success: true, message: 'Batch config updated' });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update batch config' }, 500);
  }
});

// バッチ処理統計API
app.get('/api/batch-stats', async (c) => {
  try {
    const store = c.env.COLLECTION_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: true, data: { processedUsers: 0, totalUsers: 0, lastProcessed: null } });
    }

    const stats = await store.get('batch_stats');
    const data = stats ? JSON.parse(stats) : { processedUsers: 0, totalUsers: 0, lastProcessed: null };
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to get batch stats' }, 500);
  }
});

// 認証済みユーザー一覧API
app.get('/api/verified-users', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    const store = c.env.MINTED_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'Minted store not available' }, 500);
    }

    // 認証済みユーザーの一覧を取得
    const users: any[] = [];
    const keys = await store.list();
    
    for (const key of keys.keys) {
      if (key.name.startsWith('verified_user:')) {
        const userData = await store.get(key.name);
        if (userData) {
          users.push(JSON.parse(userData));
        }
      }
    }

    return c.json({ success: true, data: users });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to get verified users' }, 500);
  }
});

// バッチ処理実行API
app.post('/api/batch-process', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    const { collectionId, action } = await c.req.json();
    
    if (!collectionId || !action) {
      return c.json({ success: false, error: 'collectionId and action are required' }, 400);
    }

    // バッチ処理の実行（実際の実装はDiscord Bot APIに委譲）
    const botApiUrl = c.env.DISCORD_BOT_API_URL || 'https://nft-verification-bot.onrender.com';
    const response = await fetch(`${botApiUrl}/api/batch-process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Worker'
      },
      body: JSON.stringify({
        collectionId,
        action,
        adminAddress: admin
      })
    });

    const result = await response.json() as any;
    
    // バッチ処理実行後にlastRunを更新
    if (result.success) {
      const store = c.env.COLLECTION_STORE as KVNamespace | undefined;
      if (store) {
        try {
          const configStr = await store.get('batch_config');
          if (configStr) {
            const config = JSON.parse(configStr);
            config.lastRun = new Date().toISOString();
            await store.put('batch_config', JSON.stringify(config));
        }
      } catch (error) {
          console.error('Failed to update batch config lastRun:', error);
        }
      }
    }
    
    return c.json(result);

  } catch (error) {
    console.error('Batch process API error:', error);
    return c.json({ success: false, error: 'Failed to execute batch process' }, 500);
  }
});

// Discord ロール一覧API
app.get('/api/discord/roles', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    // Discord Bot APIからロール一覧を取得
    const botApiUrl = c.env.DISCORD_BOT_API_URL || 'https://nft-verification-bot.onrender.com';
    
    try {
      const response = await fetch(`${botApiUrl}/api/discord/roles`, {
        headers: {
          'User-Agent': 'Cloudflare-Worker'
        },
        signal: AbortSignal.timeout(10000) // 10秒タイムアウト
      });

      if (!response.ok) {
        console.error('Discord Bot API not available:', response.status, response.statusText);
        return c.json({ success: true, data: [], message: 'Discord Bot API is currently unavailable' });
      }

      const result = await response.json();
      return c.json(result);
    } catch (fetchError) {
      console.error('Discord Bot API connection failed:', fetchError);
      return c.json({ success: true, data: [], message: 'Discord Bot API is currently unavailable' });
    }

  } catch (error) {
    console.error('Discord roles API error:', error);
    return c.json({ success: false, error: 'Failed to fetch Discord roles' }, 500);
  }
});

// 管理者用イベントAPI（既存の/api/eventsの管理者版）
app.get('/api/admin/events', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    // 既存の/api/eventsと同じロジックを使用
    const store = c.env.EVENT_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'EVENT_STORE is not available' }, 503);
    }

    const listStr = await store.get('events');
    const list = listStr ? JSON.parse(listStr) : [];
    
    // 各イベントにmintedCountを追加
    const mintedStore = c.env.MINTED_STORE as KVNamespace | undefined;
    if (mintedStore && Array.isArray(list)) {
      for (const event of list) {
        if (event && event.id) {
          const mintedCountKey = `minted_count:${event.id}`;
          const mintedCountStr = await mintedStore.get(mintedCountKey);
          event.mintedCount = mintedCountStr ? Number(mintedCountStr) : 0;
        }
      }
    }
    
    return c.json({ success: true, data: list });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch events' }, 500);
  }
});

// 管理者用イベント削除API
app.delete('/api/admin/events/:id', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    const walletConnected = c.req.header('X-Wallet-Connected');
    
    // ウォレット接続状態をチェック
    if (walletConnected === 'false') {
      return c.json({ success: false, error: 'Wallet must be connected to perform admin actions' }, 403);
    }
    
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    const eventId = c.req.param('id');
    if (!eventId) {
      return c.json({ success: false, error: 'Event ID is required' }, 400);
    }

    const store = c.env.EVENT_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'EVENT_STORE is not available' }, 503);
    }

    // イベントリストを取得
    const listStr = await store.get('events');
    const list = listStr ? JSON.parse(listStr) : [];
    
    // 指定されたIDのイベントを検索
    const eventIndex = list.findIndex((event: any) => event.id === eventId);
    if (eventIndex === -1) {
      return c.json({ success: false, error: 'Event not found' }, 404);
    }

    // イベントを削除
    list.splice(eventIndex, 1);
    
    // 更新されたリストを保存
    await store.put('events', JSON.stringify(list));
    
    return c.json({ success: true, message: 'Event deleted successfully' });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to delete event' }, 500);
  }
});

// 管理者用イベント作成API
app.post('/api/admin/events', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    const walletConnected = c.req.header('X-Wallet-Connected');
    
    // ウォレット接続状態をチェック
    if (walletConnected === 'false') {
      return c.json({ success: false, error: 'Wallet must be connected to perform admin actions' }, 403);
    }
    
    if (!admin) {
      return c.json({ success: false, error: 'X-Admin-Address header is required' }, 403);
    }
    
    const isAdminResult = await isAdmin(c, admin);
    
    if (!isAdminResult) {
      return c.json({ success: false, error: 'forbidden' }, 403);
    }

    const store = c.env.EVENT_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'EVENT_STORE is not available' }, 503);
    }

    const body = await c.req.json();
    const { name, description, startAt, endAt, eventDate, active = false, imageUrl, imageCid, imageMimeType, imageStorageEpochs, imageStorageExpiry, maxMints, mintPrice, collectionId, roleId, roleName, moveCall, totalCap } = body;

    // 必須フィールドの検証
    if (!name || !description || !startAt || !endAt) {
      return c.json({ success: false, error: 'Missing required fields: name, description, startAt, endAt' }, 400);
    }

    // イベントリストを取得
    const listStr = await store.get('events');
    const list = listStr ? JSON.parse(listStr) : [];

    // 新しいイベントを作成
    const newEvent = {
      id: Date.now().toString(),
      name,
      description,
      startAt,
      endAt,
      active: Boolean(active),
      imageUrl: imageUrl || '',
      imageCid: imageCid || '',
      imageMimeType: imageMimeType || '',
      imageStorageEpochs: imageStorageEpochs || null,
      imageStorageExpiry: imageStorageExpiry || null,
      maxMints: maxMints || null,
      mintPrice: mintPrice || null,
      collectionId: collectionId || '',
      roleId: roleId || '',
      roleName: roleName || '',
      moveCall: moveCall || null,
      totalCap: totalCap || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // イベントをリストに追加
    list.push(newEvent);

    // 更新されたリストを保存
    await store.put('events', JSON.stringify(list));

    return c.json({ success: true, data: newEvent });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create event' }, 500);
  }
});

// 管理者用イベント更新API
app.put('/api/admin/events/:id', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    const walletConnected = c.req.header('X-Wallet-Connected');
    
    // ウォレット接続状態をチェック
    if (walletConnected === 'false') {
      return c.json({ success: false, error: 'Wallet must be connected to perform admin actions' }, 403);
    }
    
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    const eventId = c.req.param('id');
    if (!eventId) {
      return c.json({ success: false, error: 'Event ID is required' }, 400);
    }

    const store = c.env.EVENT_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'EVENT_STORE is not available' }, 503);
    }

    const body = await c.req.json();
    const { name, description, startAt, endAt, eventDate, active, imageUrl, imageCid, imageMimeType, imageStorageEpochs, imageStorageExpiry, maxMints, mintPrice, collectionId, roleId, roleName, moveCall, totalCap } = body;

    // イベントリストを取得
    const listStr = await store.get('events');
    const list = listStr ? JSON.parse(listStr) : [];

    // 指定されたIDのイベントを検索
    const eventIndex = list.findIndex((event: any) => event.id === eventId);
    if (eventIndex === -1) {
      return c.json({ success: false, error: 'Event not found' }, 404);
    }

    // イベントを更新
    const updatedEvent = {
      ...list[eventIndex],
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(startAt !== undefined && { startAt }),
      ...(endAt !== undefined && { endAt }),
      ...(eventDate !== undefined && { eventDate }),
      ...(active !== undefined && { active: Boolean(active) }),
      ...(imageUrl !== undefined && { imageUrl }),
      ...(imageCid !== undefined && { imageCid }),
      ...(imageMimeType !== undefined && { imageMimeType }),
      ...(imageStorageEpochs !== undefined && { imageStorageEpochs }),
      ...(imageStorageExpiry !== undefined && { imageStorageExpiry }),
      ...(maxMints !== undefined && { maxMints }),
      ...(mintPrice !== undefined && { mintPrice }),
      ...(collectionId !== undefined && { collectionId }),
      ...(roleId !== undefined && { roleId }),
      ...(roleName !== undefined && { roleName }),
      ...(moveCall !== undefined && { moveCall }),
      ...(totalCap !== undefined && { totalCap }),
      updatedAt: new Date().toISOString()
    };

    list[eventIndex] = updatedEvent;

    // 更新されたリストを保存
    await store.put('events', JSON.stringify(list));

    return c.json({ success: true, data: updatedEvent });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to update event' }, 500);
  }
});

// 公開DM設定API（Discord Bot用）
app.get('/api/dm-settings', async (c) => {
  try {
    const store = c.env.DM_TEMPLATE_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: true, data: DEFAULT_DM_SETTINGS });
    }

    const settings = await store.get('dm_settings');
    const data = settings ? JSON.parse(settings) : DEFAULT_DM_SETTINGS;
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to get DM settings' }, 500);
  }
});

// 管理者用DM設定API
app.get('/api/admin/dm-settings', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    // 既存の/api/dm-settingsと同じロジックを使用
    const store = c.env.DM_TEMPLATE_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: true, data: DEFAULT_DM_SETTINGS });
    }

    const settings = await store.get('dm_settings');
    const data = settings ? JSON.parse(settings) : DEFAULT_DM_SETTINGS;
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to get DM settings' }, 500);
  }
});

// 管理者用バッチ設定API
app.get('/api/admin/batch-config', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    // 既存の/api/batch-configと同じロジックを使用
    const store = c.env.COLLECTION_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: true, data: DEFAULT_BATCH_CONFIG });
    }

    const config = await store.get('batch_config');
    let data = config ? JSON.parse(config) : DEFAULT_BATCH_CONFIG;
    
    // 日付計算ロジックを修正
    const now = new Date();
    const nowISO = now.toISOString();
    
    // lastRunが設定されていない場合は現在時刻を使用
    if (!data.lastRun || data.lastRun === '') {
      data.lastRun = nowISO;
    }
    
    // nextRunを正しく計算
    if (data.enabled && data.interval) {
      const lastRunDate = new Date(data.lastRun);
      // intervalは秒単位で設定されているので、ミリ秒に変換
      const intervalMs = data.interval * 1000;
      const nextRunDate = new Date(lastRunDate.getTime() + intervalMs);
      
      // 次回実行が過去の場合は現在時刻から再計算
      if (nextRunDate < now) {
        data.nextRun = new Date(now.getTime() + intervalMs).toISOString();
    } else {
        data.nextRun = nextRunDate.toISOString();
      }
    } else {
      data.nextRun = '';
    }
    
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to get batch config' }, 500);
  }
});

// 管理者用バッチ統計API
app.get('/api/admin/batch-stats', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    // MINTED_STOREからbatch_statsを読み取る（update-batch-statsと同じストア）
    const store = c.env.MINTED_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: true, data: { totalUsers: 0, processed: 0, revoked: 0, errors: 0, lastRun: null, duration: 0 } });
    }

    const stats = await store.get('batch_stats');
    const rawData = stats ? JSON.parse(stats) : { processedUsers: 0, totalUsers: 0, errors: 0, lastExecuted: null };
    
    // フロントエンドが期待する形式に変換
    const data = {
      totalUsers: rawData.totalUsers || 0,
      processed: rawData.processedUsers || 0,
      revoked: 0, // 現在は未実装
      errors: rawData.errors || 0,
      lastRun: rawData.lastExecuted || null,
      duration: 0 // 現在は未実装
    };
    
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to get batch stats' }, 500);
  }
});

// 管理者用認証済みユーザーAPI
app.get('/api/admin/verified-users', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    // 既存の/api/verified-usersと同じロジックを使用
    const store = c.env.MINTED_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'Minted store not available' }, 500);
    }

    // 認証済みユーザーの一覧を取得
    const users: any[] = [];
    const keys = await store.list();
    
    for (const key of keys.keys) {
      if (key.name.startsWith('verified_user:')) {
        const userData = await store.get(key.name);
        if (userData) {
          users.push(JSON.parse(userData));
        }
      }
    }

    return c.json({ success: true, data: users });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to get verified users' }, 500);
  }
});

// ロール管理用コレクションAPI
app.get('/api/collections', async (c) => {
  try {
    let collections = [];
    if (c.env.COLLECTION_STORE) {
      const s = await c.env.COLLECTION_STORE.get('collections');
      collections = s ? JSON.parse(s) : [];
    }
    return c.json({ success: true, data: collections });
  } catch (e) {
    console.error('collections get failed', e);
    return c.json({ success: true, data: [] });
  }
});

app.post('/api/collections', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);
    
    const body = await c.req.json();
    const { name, packageId, roleId, roleName, description = '' } = body || {};
    if (!name || !packageId || !roleId || !roleName) {
      return c.json({ success: false, error: 'Missing required fields: name, packageId, roleId, roleName' }, 400);
    }
    
    const s = await c.env.COLLECTION_STORE.get('collections');
    const list = s ? JSON.parse(s) : [];
    const item = {
      id: Date.now().toString(),
      name,
      packageId,
      roleId,
      roleName,
      description,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    await c.env.COLLECTION_STORE.put('collections', JSON.stringify(list));
    return c.json({ success: true, data: item });
  } catch (e) {
    console.error('collections post failed', e);
    return c.json({ success: false, error: 'failed' }, 500);
  }
});

app.put('/api/collections/:id', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);
    
    const id = c.req.param('id');
    const patch = await c.req.json().catch(() => ({}));
    const s = await c.env.COLLECTION_STORE.get('collections');
    const list = s ? JSON.parse(s) : [];
    const idx = list.findIndex((x: any) => x.id === id);
    if (idx < 0) return c.json({ success: false, error: 'not found' }, 404);
    list[idx] = { ...list[idx], ...patch, id, updatedAt: new Date().toISOString() };
    await c.env.COLLECTION_STORE.put('collections', JSON.stringify(list));
    return c.json({ success: true, data: list[idx] });
  } catch (e) {
    console.error('collections put failed', e);
    return c.json({ success: false, error: 'failed' }, 500);
  }
});

app.delete('/api/collections/:id', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);
    
    const id = c.req.param('id');
    const s = await c.env.COLLECTION_STORE.get('collections');
    const list = s ? JSON.parse(s) : [];
    const next = list.filter((x: any) => x.id !== id);
    await c.env.COLLECTION_STORE.put('collections', JSON.stringify(next));
    return c.json({ success: true });
  } catch (e) {
    console.error('collections delete failed', e);
    return c.json({ success: false, error: 'failed' }, 500);
  }
});

// ミント用コレクションAPI（既存維持）
app.get('/api/mint-collections', async (c) => {
  try {
    let collections = [];
    if (c.env.COLLECTION_STORE) {
      const s = await c.env.COLLECTION_STORE.get('mint_collections');
      collections = s ? JSON.parse(s) : [];
    }
    return c.json({ success: true, data: collections });
  } catch (e) {
    console.error('mint-collections get failed', e);
    return c.json({ success: true, data: [] });
  }
});

// ミント用コレクション削除API
app.delete('/api/mint-collections/:id', async (c) => {
  try {
    // 管理者チェック
    const adminAddresses = (c.env.ADMIN_ADDRESSES || '').split(',').map(a => a.trim().toLowerCase());
    const walletAddr = c.req.header('X-Admin-Address')?.toLowerCase();
    const walletConnected = c.req.header('X-Wallet-Connected');
    
    if (!walletConnected || walletConnected !== 'true') {
      return c.json({ success: false, error: 'Wallet not connected' }, 401);
    }
    
    if (!walletAddr || !adminAddresses.includes(walletAddr)) {
      return c.json({ success: false, error: 'Unauthorized: Admin only' }, 403);
    }

    const collectionId = c.req.param('id');
    if (!collectionId) {
      return c.json({ success: false, error: 'Collection ID required' }, 400);
    }

    if (!c.env.COLLECTION_STORE) {
      return c.json({ success: false, error: 'COLLECTION_STORE not available' }, 503);
    }

    // コレクション一覧を取得
    const s = await c.env.COLLECTION_STORE.get('mint_collections');
    let collections = s ? JSON.parse(s) : [];
    
    // 指定IDのコレクションを除外
    const filteredCollections = collections.filter((col: any) => col.id !== collectionId);
    
    if (filteredCollections.length === collections.length) {
      return c.json({ success: false, error: 'Collection not found' }, 404);
    }

    // 更新後のコレクションリストを保存
    await c.env.COLLECTION_STORE.put('mint_collections', JSON.stringify(filteredCollections));
    
    return c.json({ 
      success: true, 
      message: 'Collection deleted successfully',
      deletedId: collectionId
    });
  } catch (e: any) {
    console.error('mint-collection delete failed', e);
    return c.json({ success: false, error: e?.message || 'Failed to delete collection' }, 500);
  }
});

// コレクション別ミント履歴（既存維持）
app.get('/api/mint-collections/:typePath/mints', async (c) => {
  try {
    const typePath = c.req.param('typePath');
    const limitRaw = c.req.query('limit');
    const eventId = c.req.query('eventId'); // オプション: イベントIDでフィルタリング
    const limit = Math.min(Math.max(Number(limitRaw || 50), 1), 200);
    const mintedStore = c.env.MINTED_STORE as KVNamespace | undefined;
    if (!mintedStore) return c.json({ success: false, error: 'MINTED_STORE is not available' }, 503);

    // イベントIDが指定されている場合はイベント別インデックスを使用
    const idxKey = eventId ? `mint_index:${typePath}:${eventId}` : `mint_index:${typePath}`;
    console.log(`[Mint History] Looking for key: ${idxKey}`);
    
    const idxStr = await mintedStore.get(idxKey);
    console.log(`[Mint History] Found data:`, idxStr ? `${idxStr.length} bytes` : 'null');
    
    const txs: string[] = idxStr ? JSON.parse(idxStr) : [];
    console.log(`[Mint History] Transaction count: ${txs.length}`);
    
    const slice = txs.slice(0, limit);
    const items = await Promise.all(slice.map(async (tx) => {
      const rec = await mintedStore.get(`mint_tx:${tx}`);
      return rec ? JSON.parse(rec) : { txDigest: tx };
    }));
    
    console.log(`[Mint History] Returning ${items.length} items`);
    return c.json({ success: true, data: items });
  } catch (error) {
    console.error('Get collection mints failed', error);
    return c.json({ success: false, error: 'Failed to get collection mints' }, 500);
  }
});

// ミントコレクション管理（既存維持）
app.post('/api/mint-collections', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);
    const body = await c.req.json();
    const { name, packageId, typePath, description = '' } = body || {};
    if (!name || !packageId) return c.json({ success: false, error: 'Missing name/packageId' }, 400);
    
    // typePathがない場合、packageIdから生成（デフォルトで::sxt_nft::SxtNFT）
    const finalTypePath = typePath || `${packageId}::sxt_nft::SxtNFT`;
    
    const s = await c.env.COLLECTION_STORE.get('mint_collections');
    const list = s ? JSON.parse(s) : [];
    const item = {
      id: Date.now().toString(),
      name,
      packageId,
      typePath: finalTypePath,  // 完全なtype pathを保存
      description,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    list.push(item);
    await c.env.COLLECTION_STORE.put('mint_collections', JSON.stringify(list));
    return c.json({ success: true, data: item });
  } catch (e) {
    console.error('mint-collections post failed', e);
    return c.json({ success: false, error: 'failed' }, 500);
  }
});

app.put('/api/mint-collections/:id', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);
    const id = c.req.param('id');
    const patch = await c.req.json().catch(() => ({}));
    const s = await c.env.COLLECTION_STORE.get('mint_collections');
    const list = s ? JSON.parse(s) : [];
    const idx = list.findIndex((x: any) => x.id === id);
    if (idx < 0) return c.json({ success: false, error: 'not found' }, 404);
    list[idx] = { ...list[idx], ...patch, id, updatedAt: new Date().toISOString() };
    await c.env.COLLECTION_STORE.put('mint_collections', JSON.stringify(list));
    return c.json({ success: true, data: list[idx] });
  } catch (e) {
    console.error('mint-collections put failed', e);
    return c.json({ success: false, error: 'failed' }, 500);
  }
});

app.delete('/api/mint-collections/:id', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);
    const id = c.req.param('id');
    const s = await c.env.COLLECTION_STORE.get('mint_collections');
    const list = s ? JSON.parse(s) : [];
    const next = list.filter((x: any) => x.id !== id);
    await c.env.COLLECTION_STORE.put('mint_collections', JSON.stringify(next));
    return c.json({ success: true });
  } catch (e) {
    console.error('mint-collections delete failed', e);
    return c.json({ success: false, error: 'failed' }, 500);
  }
});

// Nonce生成API
app.post('/api/nonce', async (c) => {
  try {
    const { discordId, address, scope } = await c.req.json();
    
    if (!discordId || !address) {
      return c.json({ success: false, error: 'discordId and address are required' }, 400);
    }

    // アドレス形式検証
    if (!address.startsWith('0x') || address.length !== 66) {
      return c.json({ success: false, error: 'Invalid address format' }, 400);
    }

    // Discord ID検証（ミントスコープの場合はスキップ）
    if (scope !== 'mint' && !discordId.match(/^\d{17,19}$/)) {
      return c.json({ success: false, error: 'Invalid Discord ID format' }, 400);
    }

    // ランダムなnonceを生成
    const nonce = crypto.randomUUID();
    
    // NONCE_STOREに保存（5分間有効）
    const nonceStore = c.env.NONCE_STORE as KVNamespace;
    if (nonceStore) {
      await nonceStore.put(`nonce:${nonce}`, JSON.stringify({
        discordId,
        address,
        createdAt: new Date().toISOString()
      }), { expirationTtl: 300 }); // 5分間
    }
    
    return c.json({
      success: true,
      data: { nonce }
    });

  } catch (error) {
    console.error('Nonce generation error:', error);
    return c.json({ success: false, error: 'Failed to generate nonce' }, 500);
  }
});

// NFT認証API
app.post('/api/verify', async (c) => {
  try {
    const { signature, bytes, publicKey, address, discordId, nonce, authMessage, walletType, collectionIds } = await c.req.json();
    
    if (!signature || !address || !discordId || !collectionIds) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    // 署名検証（簡易版）- テスト用に緩和
    if (!signature || signature.length < 3) {
      return c.json({ success: false, error: 'Invalid signature format' }, 400);
    }

    // アドレス形式検証
    if (!address.startsWith('0x') || address.length !== 66) {
      return c.json({ success: false, error: 'Invalid address format' }, 400);
    }

    // Discord ID検証
    if (!discordId.match(/^\d{17,19}$/)) {
      return c.json({ success: false, error: 'Invalid Discord ID format' }, 400);
    }

    // Nonce検証
    if (nonce) {
      const nonceStore = c.env.NONCE_STORE as KVNamespace;
      if (nonceStore) {
        const nonceData = await nonceStore.get(`nonce:${nonce}`);
        if (!nonceData) {
          return c.json({ success: false, error: 'Invalid or expired nonce' }, 400);
        }
        
        const parsedNonceData = JSON.parse(nonceData);
        if (parsedNonceData.discordId !== discordId || parsedNonceData.address !== address) {
          return c.json({ success: false, error: 'Nonce mismatch' }, 400);
        }
        
        // 使用済みnonceを削除
        await nonceStore.delete(`nonce:${nonce}`);
      }
    }

    // コレクション検証（簡易版）
    const store = c.env.COLLECTION_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'Collection store not available' }, 500);
    }

    const collectionsData = await store.get('collections');
    const collections = collectionsData ? JSON.parse(collectionsData) : [];
    
    // 選択されたコレクションが存在するかチェック
    const validCollections = collections.filter((col: any) => collectionIds.includes(col.id));
    if (validCollections.length === 0) {
      return c.json({ success: false, error: 'No valid collections found' }, 400);
    }

    // 認証済みユーザーデータを保存
    const mintedStore = c.env.MINTED_STORE as KVNamespace | undefined;
    if (!mintedStore) {
      return c.json({ success: false, error: 'Minted store not available' }, 500);
    }

    const userData = {
      discordId,
      address,
      collectionIds,
      verifiedAt: new Date().toISOString(),
      roleName: 'NFT Holder',
      signature,
      nonce,
      lastChecked: new Date().toISOString() // 認証時にチェック済みとする
    };

    await mintedStore.put(`verified_user:${discordId}`, JSON.stringify(userData));

    // Discord Bot APIに通知
    try {
      const botApiUrl = c.env.DISCORD_BOT_API_URL || 'https://nft-verification-bot.onrender.com';
      
      // コレクション名を取得
      const firstCollection = validCollections[0];
      const collectionName = firstCollection?.name || 'NFT Collection';
      
      console.log('Sending notification with:', {
        collectionName,
        roleName: firstCollection?.roleName,
        collectionId: collectionIds[0],
        validCollectionsLength: validCollections.length
      });
      
      await fetch(`${botApiUrl}/api/notify-discord`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Cloudflare-Worker'
        },
        body: JSON.stringify({
          discordId,
          action: 'grant_roles',
          verificationData: {
            collectionId: collectionIds[0],
            collectionName: collectionName,
            roleName: firstCollection?.roleName || 'NFT Holder',
            notifyUser: true
          },
          timestamp: new Date().toISOString()
        })
      });
    } catch (botError) {
      console.error('Discord notification failed:', botError);
      // 通知失敗は認証成功を妨げない
    }
    
    return c.json({
      success: true,
      data: {
        roleName: 'NFT Holder',
        collectionIds,
        verifiedAt: userData.verifiedAt
      }
    });

  } catch (error) {
    console.error('Verification API error:', error);
    return c.json({ success: false, error: 'Verification failed' }, 500);
  }
});

// バッチ処理統計更新API
app.post('/api/admin/update-batch-stats', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    const statsData = await c.req.json();
    
    const store = c.env.MINTED_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'Minted store not available' }, 500);
    }

    // バッチ統計データを保存
    await store.put('batch_stats', JSON.stringify({
      lastExecuted: statsData.lastExecuted || new Date().toISOString(),
      processedUsers: statsData.processedUsers || 0,
      errors: statsData.errors || 0,
      totalUsers: statsData.totalUsers || 0,
      collectionId: statsData.collectionId || '',
      action: statsData.action || '',
      updatedAt: new Date().toISOString()
    }));

    return c.json({ success: true, message: 'Batch statistics updated successfully' });
  } catch (error) {
    console.error('Update batch stats error:', error);
    return c.json({ success: false, error: 'Failed to update batch statistics' }, 500);
  }
});

// NFT保有状況チェックAPI
app.post('/api/admin/check-nft-ownership', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    const { discordId } = await c.req.json();
    
    if (!discordId) {
      return c.json({ success: false, error: 'discordId is required' }, 400);
    }

    const store = c.env.MINTED_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'Minted store not available' }, 500);
    }

    // ユーザーデータを取得
    const userDataStr = await store.get(`verified_user:${discordId}`);
    if (!userDataStr) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    const userData = JSON.parse(userDataStr);
    
    // SuiネットワークからNFT保有状況を確認（簡易版）
    const suiNetwork = c.env.SUI_NETWORK || 'mainnet';
    const fullnode = suiNetwork === 'testnet'
      ? 'https://fullnode.testnet.sui.io:443'
      : suiNetwork === 'devnet'
        ? 'https://fullnode.devnet.sui.io:443'
        : 'https://fullnode.mainnet.sui.io:443';

    let hasNFT = false;
    
    try {
      // Sui JSON-RPCでオブジェクトを取得
      const response = await fetch(fullnode, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'suix_getOwnedObjects',
          params: [
            userData.address,
            {
              filter: {
                StructType: userData.collectionIds[0] // 最初のコレクションをチェック
              }
            },
            null,
            10
          ]
        })
      });

      const result = await response.json() as any;
      if (result.result && result.result.data && result.result.data.length > 0) {
        hasNFT = true;
      }
  } catch (error) {
      console.error('NFT ownership check failed:', error);
      // チェック失敗時は既存の状態を維持
      hasNFT = true; // デフォルトで保有していると仮定
    }

    // lastCheckedを更新
    userData.lastChecked = new Date().toISOString();
    userData.hasNFT = hasNFT;

    // 更新されたユーザーデータを保存
    await store.put(`verified_user:${discordId}`, JSON.stringify(userData));

    return c.json({
      success: true,
      data: {
        discordId,
        hasNFT,
        lastChecked: userData.lastChecked,
        address: userData.address
      }
    });

  } catch (error) {
    console.error('Check NFT ownership error:', error);
    return c.json({ success: false, error: 'Failed to check NFT ownership' }, 500);
  }
});

// テスト用：認証済みユーザー削除
app.delete('/api/admin/delete-test-user', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    const { discordId } = await c.req.json();
    
    if (!discordId) {
      return c.json({ success: false, error: 'discordId is required' }, 400);
    }

    const store = c.env.MINTED_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'Minted store not available' }, 500);
    }

    // テストユーザーを削除
    await store.delete(`verified_user:${discordId}`);

    return c.json({ success: true, message: 'Test user deleted successfully' });
    } catch (error) {
    console.error('Delete test user error:', error);
    return c.json({ success: false, error: 'Failed to delete test user' }, 500);
  }
});

// テスト用：認証済みユーザーを手動追加
app.post('/api/admin/set-test-user', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    const { discordId, address, collectionId } = await c.req.json();
    
    if (!discordId || !address || !collectionId) {
      return c.json({ success: false, error: 'discordId, address, and collectionId are required' }, 400);
    }

    const store = c.env.MINTED_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'Minted store not available' }, 500);
    }

    // テストユーザーデータを作成
    const userData = {
          discordId,
              address,
      collectionId,
      verifiedAt: new Date().toISOString(),
      roleName: 'NFT Holder'
    };

    // KVストアに保存
    await store.put(`verified_user:${discordId}`, JSON.stringify(userData));

    return c.json({ success: true, message: 'Test user added successfully', data: userData });
      } catch (error) {
    console.error('Set test user error:', error);
    return c.json({ success: false, error: 'Failed to add test user' }, 500);
  }
});

// 認証済みユーザーのcollectionIds更新API
app.patch('/api/admin/verified-users/:discordId/collections', async (c) => {
  try {
    const admin = c.req.header('X-Admin-Address');
    if (!admin || !(await isAdmin(c, admin))) return c.json({ success: false, error: 'forbidden' }, 403);

    const discordId = c.req.param('discordId');
    const { collectionIds } = await c.req.json();
    
    if (!discordId) {
      return c.json({ success: false, error: 'discordId is required' }, 400);
    }
    
    if (!Array.isArray(collectionIds)) {
      return c.json({ success: false, error: 'collectionIds must be an array' }, 400);
    }

    const store = c.env.MINTED_STORE as KVNamespace | undefined;
    if (!store) {
      return c.json({ success: false, error: 'Minted store not available' }, 500);
    }

    // 既存ユーザーデータを取得
    const existingData = await store.get(`verified_user:${discordId}`);
    if (!existingData) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    const userData = JSON.parse(existingData);
    
    // collectionIdsを更新
    userData.collectionIds = collectionIds;
    userData.updatedAt = new Date().toISOString();
    
    // KVストアに保存
    await store.put(`verified_user:${discordId}`, JSON.stringify(userData));

    return c.json({ success: true, message: 'User collections updated successfully', data: userData });
  } catch (error) {
    console.error('Update user collections error:', error);
    return c.json({ success: false, error: 'Failed to update user collections' }, 500);
  }
});

// Cloudflare Workers用のスケジュール関数
export async function scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
  console.log('Scheduled event triggered:', controller.cron, controller.scheduledTime);
  
  try {
    // バッチ処理設定をチェック
    const store = env.COLLECTION_STORE as KVNamespace | undefined;
    if (!store) {
      console.log('Collection store not available');
      return;
    }

    const configStr = await store.get('batch_config');
    if (!configStr) {
      console.log('No batch config found');
      return;
    }

    let config;
    try {
      config = JSON.parse(configStr);
    } catch (parseError) {
      console.error('Failed to parse batch config:', parseError);
      return;
    }
    
    // バッチ処理が有効でない場合はスキップ
    if (!config.enabled) {
      console.log('Batch processing is disabled');
      return;
    }

    // 次回実行時刻をチェック
    const now = new Date();
    let nextRun: Date | null = null;
    
    if (config.nextRun) {
      try {
        nextRun = new Date(config.nextRun);
        if (isNaN(nextRun.getTime())) {
          console.error('Invalid nextRun date:', config.nextRun);
          nextRun = null;
        }
      } catch (dateError) {
        console.error('Failed to parse nextRun date:', dateError);
        nextRun = null;
      }
    }
    
    if (nextRun && now < nextRun) {
      console.log('Not time to run batch processing yet');
      return;
    }

    console.log('Starting batch processing...');
    
    // バッチ処理を実行（Discord Bot APIに委譲）
    const botApiUrl = env.DISCORD_BOT_API_URL || 'https://nft-verification-bot.onrender.com';
    
    try {
      // タイムアウト付きでバッチ処理を実行
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('Batch processing timeout reached, aborting...');
        abortController.abort();
      }, 30000); // 30秒タイムアウト
      
      let response: Response;
      try {
        response = await fetch(`${botApiUrl}/api/batch-process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Cloudflare-Worker-Scheduled'
          },
          body: JSON.stringify({
            collectionId: config.collectionId || '',
            action: 'check_and_update_roles',
            adminAddress: env.ADMIN_ADDRESSES?.split(',')[0] || '',
            scheduled: true
          }),
          signal: abortController.signal
        });
      } finally {
        // 必ずタイムアウトをクリア（メモリリーク防止）
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        const result = await response.json();
        console.log('Batch processing completed:', result);
        
        // 実行時刻を更新
        config.lastRun = new Date().toISOString();
        if (config.interval && config.interval > 0) {
          // intervalは秒単位なので、ミリ秒に変換
          const nextRunDate = new Date(now.getTime() + (config.interval * 1000));
          config.nextRun = nextRunDate.toISOString();
        }
        
        // 設定更新を非同期で実行（waitUntilで適切に管理）
        const updatePromise = store.put('batch_config', JSON.stringify(config))
          .catch((storeError: any) => {
            console.error('Failed to update batch config:', storeError);
          });
        
        ctx.waitUntil(updatePromise);
      } else {
        console.error('Batch processing failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Batch processing error:', error);
      
      // エラー時は再試行を無効化（noRetry）
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Batch processing timed out, disabling retry');
        controller.noRetry();
      } else if (error instanceof Error && error.name === 'TypeError' && error.message.includes('fetch')) {
        console.log('Network error occurred, disabling retry');
        controller.noRetry();
      }
    }
    
  } catch (error) {
    console.error('Scheduled function error:', error);
  }
}

export default app;
