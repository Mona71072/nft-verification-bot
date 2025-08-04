import { Hono } from 'hono';

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

// Cloudflare KV型定義
interface Env {
  NONCE_STORE: any; // KVNamespace
  COLLECTION_STORE: any; // KVNamespace
  NFT_COLLECTION_ID: string;
  DISCORD_BOT_API_URL: string;
}

const app = new Hono<{ Bindings: Env }>();

// カスタムCORSミドルウェア
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin');
  const method = c.req.method;
  
  console.log('=== CORS MIDDLEWARE ===');
  console.log('Origin:', origin);
  console.log('Method:', method);
  console.log('URL:', c.req.url);
  console.log('User-Agent:', c.req.header('User-Agent'));
  
  // すべてのレスポンスにCORSヘッダーを設定
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Max-Age', '86400');
  c.header('Vary', 'Origin');
  
  // OPTIONSリクエストの場合は即座にレスポンス
  if (method === 'OPTIONS') {
    console.log('OPTIONS request handled by middleware');
    return new Response('', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
        'Access-Control-Allow-Credentials': 'true',
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

// ナンス生成エンドポイント
app.post('/api/nonce', async (c) => {
  try {
    console.log('=== NONCE ENDPOINT CALLED ===');
    console.log('URL:', c.req.url);
    console.log('Method:', c.req.method);
    console.log('Origin:', c.req.header('Origin'));
    console.log('User-Agent:', c.req.header('User-Agent'));
    console.log('Content-Type:', c.req.header('Content-Type'));
    
    const body = await c.req.json();
    console.log('Request body:', body);
    
    const { discordId, address } = body;

    if (!discordId || !address) {
      console.log('Missing required fields:', { discordId, address });
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

    await c.env.NONCE_STORE.put(nonce, JSON.stringify(nonceData), {
      expirationTtl: 300 // 5分後に自動削除
    });

    console.log(`Generated nonce for ${address} (Discord: ${discordId}): ${nonce}`);

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



// 署名検証関数（@suiet/wallet-kit対応）
function verifySignedMessage(signatureData: any): boolean {
  try {
    console.log('Verifying signature with @suiet/wallet-kit format...');
    console.log('Signature data received:', signatureData);
    
    const { signature, bytes } = signatureData;
    
    if (!signature) {
      console.error('Missing signature field');
      return false;
    }

    // 開発用: 署名が存在し、適切な形式であれば有効とする
    if (signature && signature.length > 50) {  // Base64署名の長さチェック
      console.log('Development mode: Signature verification passed');
      console.log('Signature length:', signature.length);
      console.log('Has bytes:', !!bytes);
      return true;
    }

    console.log('Signature verification failed: invalid signature format');
    return false;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
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

// NFT保有確認関数
async function hasTargetNft(address: string, collectionId?: string): Promise<boolean> {
  try {
    console.log(`Checking NFT ownership for address: ${address}, collection: ${collectionId || 'any'}`);
    
    // 実際のNFT保有確認を実行（開発モードを無効化）
    console.log('Production mode: Performing actual NFT ownership check...');
    
    // 実際のSui APIを使用する場合（本番環境用）
    if (collectionId && collectionId.trim() !== '') {
      try {
        // Sui RPC APIを使用してNFT保有を確認
        const suiRpcUrl = 'https://fullnode.mainnet.sui.io:443';
        const packageId = collectionId.split('::')[0];
        
        console.log(`Checking Popkins ownership for address: ${address}, package: ${packageId}`);
        
        const response = await fetch(`${suiRpcUrl}`, {
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
                  Package: packageId
                }
              },
              null,
              null,
              true
            ]
          })
        });
        
        const data = await response.json() as any;
        const hasNft = data.result && data.result.data && data.result.data.length > 0;
        
        if (hasNft) {
          console.log(`✅ Popkins found: ${data.result.data.length} NFTs for address ${address}`);
        } else {
          console.log(`❌ No Popkins found for address ${address}`);
        }
        
        return Boolean(hasNft);
      } catch (apiError) {
        console.error('❌ Sui API error:', apiError);
        console.log('🔄 NFT check failed due to API error - returning false');
        return false;
      }
    }
    
    return false;
  } catch (error) {
    console.error('NFT check error:', error);
    return false;
  }
}

// Discord Bot API（認証結果通知）
async function notifyDiscordBot(c: any, discordId: string, action: string, verificationData?: any): Promise<boolean> {
  try {
    console.log(`🔄 Discord Bot API: ${action} for user ${discordId}`);
    console.log('📋 Verification data:', verificationData);
    
    // レンダーのDiscord Bot API URL
    const DISCORD_BOT_API_URL = c.env.DISCORD_BOT_API_URL || '';
    console.log('🔗 Discord Bot API URL:', DISCORD_BOT_API_URL);
    
    if (!DISCORD_BOT_API_URL) {
      console.log('⚠️ Discord Bot API URL not configured, using mock');
      return true; // モックモード
    }
    
    // リクエストボディの構築
    const requestBody = {
      discordId,
      action,
      verificationData,
      timestamp: new Date().toISOString()
    };
    
    console.log('📤 Sending request to Discord Bot API:', requestBody);
    
    // レンダーのDiscord Bot APIにリクエスト送信
    const response = await fetch(`${DISCORD_BOT_API_URL}/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log(`📥 Discord Bot API response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Discord Bot API response:`, result);
      return true;
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

// コレクション取得API
app.get('/api/collections', async (c) => {
  try {
    console.log('=== COLLECTIONS API CALLED ===');
    
    const collectionsData = await c.env.COLLECTION_STORE.get('collections');
    const collections = collectionsData ? JSON.parse(collectionsData) : [];
    
    console.log(`Found ${collections.length} collections`);
    
    return c.json({
      success: true,
      data: collections
    });
  } catch (error) {
    console.error('Collections fetch error:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch collections'
    }, 500);
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
    const existingData = await c.env.COLLECTION_STORE.get('collections');
    const collections = existingData ? JSON.parse(existingData) : [];
    
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
    
    const existingData = await c.env.COLLECTION_STORE.get('collections');
    const collections = existingData ? JSON.parse(existingData) : [];
    
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

// Discordロール取得エンドポイント
app.get('/api/discord/roles', async (c) => {
  try {
    console.log('=== DISCORD ROLES API CALLED ===');
    
    // Discord Bot API URLを取得
    const DISCORD_BOT_API_URL = c.env.DISCORD_BOT_API_URL || '';
    console.log('🔗 Discord Bot API URL:', DISCORD_BOT_API_URL);
    
    if (!DISCORD_BOT_API_URL) {
      console.log('⚠️ Discord Bot API URL not configured');
      return c.json({
        success: false,
        error: 'Discord Bot API not configured'
      }, 500);
    }
    
    // Discord Bot APIからロール一覧を取得
    const response = await fetch(`${DISCORD_BOT_API_URL}/api/roles`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📥 Discord Bot API response status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Discord roles fetched:`, result);
      return c.json({
        success: true,
        data: result.data || []
      });
    } else {
      const errorText = await response.text();
      console.error(`❌ Discord Bot API error: ${response.status} ${response.statusText}`);
      console.error(`❌ Error response body:`, errorText);
      return c.json({
        success: false,
        error: 'Failed to fetch Discord roles'
      }, 500);
    }
    
  } catch (error) {
    console.error('❌ Error fetching Discord roles:', error);
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
});

// 認証エンドポイント
app.post('/api/verify', async (c) => {
  try {
    const body = await c.req.json();
    const { signature, address, discordId, nonce, message, collectionId } = body;

    // 必須パラメータチェック
    if (!signature || !address || !discordId || !nonce) {
      return c.json({
        success: false,
        error: 'Missing required parameters'
      }, 400);
    }

    console.log(`Verification request for ${address} (Discord: ${discordId})`);
    console.log(`Collection ID: ${collectionId || 'default'}`);

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

    // 署名検証（@suiet/wallet-kit形式）
    console.log('=== SIGNATURE VERIFICATION ===');
    console.log('Request body:', body);
    
    const signatureData = {
      signature: signature,
      bytes: body.bytes || body.messageBytes,
      authMessage: body.authMessage
    };
    
    const isValidSignature = verifySignedMessage(signatureData);
    if (!isValidSignature) {
      return c.json({
        success: false,
        error: 'Invalid signature'
      }, 400);
    }

    // コレクションIDが指定されている場合、そのコレクションの設定を取得
    let targetPackageId = c.env.NFT_COLLECTION_ID; // デフォルト
    let roleName = 'NFT Holder'; // デフォルト
    
    if (collectionId) {
      try {
        const collectionsData = await c.env.COLLECTION_STORE.get('collections');
        const collections = collectionsData ? JSON.parse(collectionsData) : [];
        const targetCollection = collections.find((c: NFTCollection) => c.id === collectionId);
        
        if (targetCollection && targetCollection.isActive) {
          targetPackageId = targetCollection.packageId;
          roleName = targetCollection.roleName;
          console.log(`✅ Using collection: ${targetCollection.name} (${targetCollection.packageId})`);
        } else {
          console.log(`⚠️ Collection ${collectionId} not found or inactive, using default`);
        }
      } catch (error) {
        console.error('Error fetching collection config:', error);
        console.log('⚠️ Using default collection configuration');
      }
    }

    // NFT保有確認
    const hasNft = await hasTargetNft(address, targetPackageId);
    
    // 認証結果の通知データ
    const notificationData = {
      address: address,
      discordId: discordId,
      collectionId: collectionId,
      roleName: roleName,
      timestamp: new Date().toISOString()
    };
    
    if (!hasNft) {
      // NFT保有失敗時の通知
      await notifyDiscordBot(c, discordId, 'verification_failed', {
        ...notificationData,
        reason: 'NFT not found in wallet'
      });
      
      return c.json({
        success: false,
        error: 'NFT not found in wallet'
      }, 400);
    }

    // Discordロール付与（成功時）
    const roleGranted = await notifyDiscordBot(c, discordId, 'grant_role', notificationData);
    if (!roleGranted) {
      console.log('⚠️ Discord notification failed, but verification succeeded');
    }

    // 使用済みナンスを削除
    await c.env.NONCE_STORE.delete(nonce);

    console.log(`✅ Verification successful for ${address} (Discord: ${discordId}) with role: ${roleName}`);

    return c.json({
      success: true,
      data: {
        roleName: roleName,
        message: 'Verification completed successfully'
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



export default app; 