import { Hono, Context } from 'hono';

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
  NFT_COLLECTION_ID: string;
  DISCORD_BOT_API_URL: string;
  [key: string]: any;
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

    await (c.env.NONCE_STORE as any).put(nonce, JSON.stringify(nonceData), {
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
        
        console.log(`Checking NFT ownership for address: ${address}, collection: ${collectionId}`);
        
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
                  StructType: collectionId
                }
              },
              null,
              null,
              true
            ]
          })
        });
        
        const data = await response.json() as any;
        console.log(`📥 Sui API response:`, JSON.stringify(data, null, 2));
        
        const hasNft = data.result && data.result.data && data.result.data.length > 0;
        
        if (hasNft) {
          console.log(`✅ NFTs found: ${data.result.data.length} NFTs for address ${address} in collection ${collectionId}`);
        } else {
          console.log(`❌ No NFTs found for address ${address} in collection ${collectionId}`);
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
async function notifyDiscordBot(c: Context<{ Bindings: Env }>, discordId: string, action: string, verificationData?: any): Promise<boolean> {
  try {
    console.log(`🔄 Discord Bot API: ${action} for user ${discordId}`);
    console.log('📋 Verification data:', verificationData);
    
    // レンダーのDiscord Bot API URL
    const DISCORD_BOT_API_URL = 'https://nft-verification-bot.onrender.com';
    console.log('🔗 Discord Bot API URL:', DISCORD_BOT_API_URL);
    
    if (!DISCORD_BOT_API_URL) {
      console.log('⚠️ Discord Bot API URL not configured, using mock');
      return true; // モックモード
    }
    
    // リクエストボディの構築
    const requestBody = {
      discord_id: discordId,
      action: action,
      verification_data: verificationData,
      timestamp: new Date().toISOString()
    };
    
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
    const isAdminUser = adminAddresses.includes(normalizedAddress);
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

// 認証エンドポイント
app.post('/api/verify', async (c) => {
  try {
    const body = await c.req.json();
    const { signature, address, discordId, nonce, message, collectionIds } = body;

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
      await notifyDiscordBot(c, discordId, 'verification_failed', {
        ...notificationData,
        reason: 'No NFTs found in any selected collections'
      });
      
      return c.json({
        success: false,
        error: 'No NFTs found in selected collections'
      }, 400);
    }

    // Discordロール付与（成功時）
    const roleGranted = await notifyDiscordBot(c, discordId, 'grant_roles', notificationData);
    if (!roleGranted) {
      console.log('⚠️ Discord notification failed, but verification succeeded');
    }

    // 使用済みナンスを削除
    await c.env.NONCE_STORE.delete(nonce);

    // 認証済みユーザーとして保存
    await addVerifiedUser(c, {
      discordId: discordId,
      address: address,
      collectionId: collectionIds.join(','), // 複数コレクションの場合はカンマ区切りで保存
      roleId: grantedRoles[0].roleId, // 最初に付与されたロールIDを保存
      roleName: grantedRoles[0].roleName, // 最初に付与されたロール名を保存
      verifiedAt: new Date().toISOString(),
      lastChecked: new Date().toISOString()
    });

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
        const hasNft = await hasTargetNft(user.address, user.collectionId);
        
        if (!hasNft) {
          console.log(`❌ User ${user.discordId} no longer has NFT, revoking role`);
          
          // Discord Botにロール剥奪を通知
          const revoked = await notifyDiscordBot(c, user.discordId, 'revoke_role', {
            address: user.address,
            collectionId: user.collectionId,
            reason: 'NFT no longer owned',
            timestamp: new Date().toISOString()
          });
          
          if (revoked) {
            // 認証済みユーザーリストから削除
            await removeVerifiedUser(c, user.discordId, user.collectionId);
            revokedCount++;
          }
        } else {
          console.log(`✅ User ${user.discordId} still has NFT`);
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

// バッチ処理の設定
interface BatchConfig {
  enabled: boolean;
  interval: number; // 分単位
  lastRun: string;
  nextRun: string;
  maxUsersPerBatch: number;
  retryAttempts: number;
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
      retryAttempts: 3
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
      retryAttempts: 3
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
        const hasNft = await hasTargetNft(user.address, user.collectionId);
        
        if (!hasNft) {
          console.log(`❌ User ${user.discordId} no longer has NFT, revoking role`);
          
          // Discord Botにロール剥奪を通知
          const revoked = await notifyDiscordBot(c, user.discordId, 'revoke_role', {
            address: user.address,
            collectionId: user.collectionId,
            reason: 'NFT no longer owned',
            timestamp: new Date().toISOString()
          });
          
          if (revoked) {
            // 認証済みユーザーリストから削除
            await removeVerifiedUser(c, user.discordId, user.collectionId);
            revokedCount++;
          }
        } else {
          console.log(`✅ User ${user.discordId} still has NFT`);
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

// バッチ処理統計取得API
app.get('/api/admin/batch-stats', async (c) => {
  try {
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


export default app; 