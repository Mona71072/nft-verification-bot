<<<<<<< HEAD
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
=======
import { 
  Client, 
  GatewayIntentBits, 
  Events, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder,
  ChannelType,
  TextChannel,
  ButtonInteraction,
  GuildMember
} from 'discord.js';
import { config, validateConfig } from './config';
import { startApiServer } from './api-server';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Bot準備完了時
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Bot logged in as ${readyClient.user.tag}!`);
  console.log(`🆔 Bot ID: ${readyClient.user.id}`);
  
  // 設定のバリデーション
  console.log('🔍 Validating configuration...');
  if (!validateConfig()) {
    console.error('❌ Configuration validation failed. Bot will not function properly.');
    return;
  }
  
  // 設定情報をログ出力
  console.log('📋 Configuration summary:');
  console.log(`  - Guild ID: ${config.DISCORD_GUILD_ID}`);
  console.log(`  - Role ID: ${config.DISCORD_ROLE_ID}`);
  console.log(`  - Channel ID: ${config.VERIFICATION_CHANNEL_ID}`);
  console.log(`  - Verification URL: ${config.VERIFICATION_URL}`);
  console.log(`  - Admin User ID: ${config.ADMIN_USER_ID}`);
  console.log(`  - Sui Network: ${config.SUI_NETWORK}`);
  
  // 無料プラン用の最適化
  console.log('🚀 Bot optimized for free tier deployment');
  console.log('📊 Memory usage:', process.memoryUsage());
  
  // Botの権限を確認
  try {
    console.log('🔍 Checking bot permissions...');
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    console.log(`✅ Found guild: ${guild.name} (${guild.id})`);
    
    const botMember = guild.members.cache.get(client.user!.id);
    if (botMember) {
      console.log('🔐 Bot permissions:', botMember.permissions.toArray());
      console.log('🔐 Bot roles:', botMember.roles.cache.map(r => r.name).join(', '));
      
      // 必要な権限をチェック
      const requiredPermissions = ['SendMessages', 'ManageRoles'] as const;
      const missingPermissions = requiredPermissions.filter(perm => !botMember.permissions.has(perm as any));
      
      if (missingPermissions.length > 0) {
        console.error('❌ Missing required permissions:', missingPermissions);
      } else {
        console.log('✅ All required permissions are available');
      }
    } else {
      console.error('❌ Bot member not found in guild');
    }
  } catch (error) {
    console.error('❌ Error checking bot permissions:', error);
  }
  
  // APIサーバー起動
  console.log('🚀 Starting API server...');
  startApiServer();
  
  // 認証チャンネルをセットアップ
  console.log('🔧 Setting up verification channel...');
  await setupVerificationChannel();
});

// 認証チャンネルとメッセージのセットアップ
async function setupVerificationChannel() {
  try {
    console.log('🔍 Setting up verification channel...');
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    if (!guild) {
      console.error('❌ Guild not found');
      return;
    }

    console.log(`✅ Found guild: ${guild.name}`);

    // 手動作成されたチャンネルを取得
    console.log(`🔍 Looking for channel with ID: ${config.VERIFICATION_CHANNEL_ID}`);
    const verificationChannel = await guild.channels.fetch(config.VERIFICATION_CHANNEL_ID) as TextChannel;
    
    if (!verificationChannel) {
      console.error('❌ Verification channel not found. Please create a channel with ID:', config.VERIFICATION_CHANNEL_ID);
      return;
    }

    console.log(`✅ Found verification channel: ${verificationChannel.name} (${verificationChannel.id})`);

    // チャンネルの権限をチェック
    const botPermissions = verificationChannel.permissionsFor(client.user!);
    if (botPermissions) {
      console.log('🔐 Channel permissions for bot:', botPermissions.toArray());
      if (!botPermissions.has('SendMessages')) {
        console.error('❌ Bot cannot send messages in this channel');
        return;
      }
    }

    // 既存のBotメッセージをチェック
    console.log('🔍 Checking existing bot messages...');
    const messages = await verificationChannel.messages.fetch({ limit: 50 });
    const botMessages = messages.filter(msg => 
      msg.author.id === client.user!.id && 
      msg.embeds.length > 0 &&
      (msg.embeds[0].title?.includes('NFT認証') || msg.embeds[0].title?.includes('管理者'))
    );

    console.log(`📊 Found ${botMessages.size} existing bot messages`);

    if (botMessages.size >= 2) {
      console.log('✅ Verification messages already exist, skipping setup');
      return;
    }

    // 古いメッセージを削除（権限があれば）
    if (botMessages.size > 0) {
      try {
        const permissions = verificationChannel.permissionsFor(client.user!);
        if (permissions?.has('ManageMessages')) {
          await verificationChannel.bulkDelete(botMessages);
          console.log(`🧹 Deleted ${botMessages.size} old bot messages`);
        } else {
          console.log('⚠️ No permission to delete messages, keeping existing ones');
          return;
        }
      } catch (error) {
        console.log('⚠️ Could not delete old messages:', error);
      }
    }

    console.log('🔄 Creating new verification messages...');

    // ミニマル認証メッセージ
    const userVerificationEmbed = new EmbedBuilder()
      .setTitle('🎨 NFT認証')
      .setDescription('**Sui NFT保有者にロールを付与**\\n\\nボタンをクリックしてウォレット認証を開始してください。')
      .setColor(0x6366f1)
      .setFooter({ text: 'Powered by Sui' });

    // シンプルボタン
    const verifyButton = new ButtonBuilder()
      .setCustomId('verify_nft')
      .setLabel('認証開始')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔗');

    const userActionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(verifyButton);

    // 一般ユーザー向けメッセージ送信
    console.log('📤 Sending user verification message...');
    await verificationChannel.send({
      embeds: [userVerificationEmbed],
      components: [userActionRow]
    });
    console.log('✅ User verification message sent');

    // ミニマル管理者パネル
    const adminEmbed = new EmbedBuilder()
      .setTitle('⚙️ 管理')
      .setDescription(`**システム状態:** 🟢 稼働中\\n**ネットワーク:** ${config.SUI_NETWORK}`)
      .setColor(0x71717a)
      .setFooter({ text: '管理者専用' });

    // シンプル管理ボタン
    const statsButton = new ButtonBuilder()
      .setCustomId('admin_stats')
      .setLabel('統計')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📊');

    const refreshButton = new ButtonBuilder()
      .setCustomId('admin_refresh')
      .setLabel('更新')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄');

    const adminActionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(statsButton, refreshButton);

    // 管理者向けメッセージ送信
    console.log('📤 Sending admin verification message...');
    await verificationChannel.send({
      embeds: [adminEmbed],
      components: [adminActionRow]
    });
    console.log('✅ Admin verification message sent');

    console.log('✅ User and Admin verification messages posted successfully');

  } catch (error) {
    console.error('❌ Error setting up verification channel:', error);
    console.error('❌ Error stack:', (error as Error).stack);
  }
}

// ボタンインタラクション処理
client.on(Events.InteractionCreate, async (interaction) => {
  console.log(`🔄 Interaction received: ${interaction.type}`);
  
  if (!interaction.isButton()) {
    console.log(`❌ Not a button interaction: ${interaction.type}`);
    return;
  }

  const { customId, user, member } = interaction;
  const isAdmin = user.id === config.ADMIN_USER_ID;

  console.log(`🔄 Handling button interaction: ${customId} from user ${user.username} (${user.id})`);
  console.log(`📋 Interaction details:`, {
    customId,
    userId: user.id,
    username: user.username,
    isAdmin,
    guildId: interaction.guildId,
    channelId: interaction.channelId
  });

  try {
    // インタラクションが既に応答済みかチェック
    if (interaction.replied || interaction.deferred) {
      console.log('⚠️ Interaction already replied/deferred, skipping');
      return;
    }

    // 一般ユーザー向けボタン
    if (customId === 'verify_nft') {
      console.log(`✅ Processing verify_nft for user ${user.username}`);
      await handleVerifyNFT(interaction);
    }
    // 管理者向けボタン
    else if (customId === 'admin_stats') {
      console.log(`✅ Processing admin_stats for user ${user.username} (isAdmin: ${isAdmin})`);
      await handleAdminStats(interaction, isAdmin);
    } else if (customId === 'admin_refresh') {
      console.log(`✅ Processing admin_refresh for user ${user.username} (isAdmin: ${isAdmin})`);
      await handleAdminRefresh(interaction, isAdmin);
    } else {
      console.log(`❌ Unknown button interaction: ${customId}`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ 不明なボタンです。',
          ephemeral: true
        });
      }
    }
  } catch (error) {
    console.error('❌ Error handling interaction:', error);
    console.error('❌ Error stack:', (error as Error).stack);
    
    // エラーの種類に応じて処理
    if (error && typeof error === 'object' && 'code' in error) {
      const errorCode = (error as any).code;
      
      if (errorCode === 10062) {
        console.log('⚠️ Unknown interaction - interaction may have expired');
        return;
      } else if (errorCode === 40060) {
        console.log('⚠️ Interaction already acknowledged');
        return;
      }
    }
    
    try {
      if (!interaction.replied && !interaction.deferred) {
        console.log('🔄 Sending error reply...');
        await interaction.reply({
          content: '❌ インタラクションに失敗しました。しばらく待ってから再試行してください。',
          ephemeral: true
        });
        console.log('✅ Error reply sent');
      } else {
        console.log('⚠️ Interaction already replied, cannot send error message');
      }
    } catch (replyError) {
      console.error('❌ Error sending error reply:', replyError);
    }
  }
});

// NFT認証処理（ミニマル版）
async function handleVerifyNFT(interaction: ButtonInteraction) {
  try {
    console.log(`🔄 Starting NFT verification for user ${interaction.user.username} (${interaction.user.id})`);
    console.log(`📋 Config check:`, {
      VERIFICATION_URL: config.VERIFICATION_URL,
      hasUrl: !!config.VERIFICATION_URL
    });
    
    if (!config.VERIFICATION_URL) {
      console.error('❌ VERIFICATION_URL is not set');
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ 設定エラー: VERIFICATION_URLが設定されていません。',
          ephemeral: true
        });
      }
      return;
    }
    
    const verificationUrl = `${config.VERIFICATION_URL}?discord_id=${interaction.user.id}`;
    console.log(`🔗 Verification URL: ${verificationUrl}`);

    const verifyEmbed = new EmbedBuilder()
      .setTitle('🔗 NFT認証')
      .setDescription(`**NFT認証を開始します**\\n\\n[認証ページを開く](${verificationUrl})\\n\\n※ このメッセージは5分後に自動削除されます`)
      .setColor(0x6366f1)
      .setTimestamp();

    console.log(`🔄 Sending verification reply...`);
    
    // インタラクションが既に応答済みでないことを確認
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [verifyEmbed],
        ephemeral: true,
        fetchReply: true
      });

      console.log(`✅ Verification message sent to user ${interaction.user.username}`);

      // 5分後に自動削除（より確実な実装）
      const autoDeleteTimeout = setTimeout(async () => {
        try {
          console.log(`🔄 Auto-deleting verification message for user ${interaction.user.id}...`);
          
          // インタラクションがまだ有効かチェック
          if (!interaction.replied) {
            console.log('⚠️ Interaction not replied, cannot delete');
            return;
          }
          
          await interaction.deleteReply();
          console.log(`✅ Auto-deleted verification message for user ${interaction.user.id}`);
        } catch (error) {
          console.log('❌ Failed to auto-delete message:', error);
          console.log('Message may have been deleted manually or expired');
        }
      }, 5 * 60 * 1000); // 5分 = 300秒

      // タイムアウトIDを保存（必要に応じてキャンセル可能）
      console.log(`⏰ Auto-delete scheduled for user ${interaction.user.id} in 5 minutes`);
    } else {
      console.log('⚠️ Interaction already replied, skipping verification message');
    }

  } catch (error) {
    console.error('❌ Error in handleVerifyNFT:', error);
    console.error('❌ Error stack:', (error as Error).stack);
    
    // エラーの種類に応じて処理
    if (error && typeof error === 'object' && 'code' in error) {
      const errorCode = (error as any).code;
      
      if (errorCode === 10062) {
        console.log('⚠️ Unknown interaction - interaction may have expired');
        return;
      } else if (errorCode === 40060) {
        console.log('⚠️ Interaction already acknowledged');
        return;
      }
    }
    
    throw error; // 上位のエラーハンドラーで処理
  }
}



// ロール付与関数（APIから呼び出される）
export async function grantRoleToUser(discordId: string): Promise<boolean> {
  try {
    console.log(`🔄 Attempting to grant role to Discord ID: ${discordId}`);
    console.log(`📋 Config: Guild ID: ${config.DISCORD_GUILD_ID}, Role ID: ${config.DISCORD_ROLE_ID}`);
    
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    if (!guild) {
      console.error('❌ Guild not found');
      return false;
    }
    console.log(`✅ Found guild: ${guild.name}`);

    const member = await guild.members.fetch(discordId);
    if (!member) {
      console.error('❌ Member not found:', discordId);
      return false;
    }
    console.log(`✅ Found member: ${member.user.username} (${member.id})`);

    const role = await guild.roles.fetch(config.DISCORD_ROLE_ID);
    if (!role) {
      console.error('❌ Role not found');
      return false;
    }
    console.log(`✅ Found role: ${role.name} (${role.id})`);

    // 既にロールを持っているかチェック
    const hasRole = member.roles.cache.has(config.DISCORD_ROLE_ID);
    
    if (!hasRole) {
      console.log(`🔄 Adding role ${role.name} to user ${member.user.username}...`);
      await member.roles.add(role);
      console.log(`✅ Role granted to user ${discordId} (${member.user.username})`);
    } else {
      console.log(`ℹ️ User ${discordId} (${member.user.username}) already has the role`);
    }

    // ユーザーにDM送信（ロール付与の有無に関係なく）
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle('🎉 認証完了！')
        .setDescription(`**NFTの保有が確認されました！**\\n\\n特別ロール "${role.name}" ${hasRole ? 'は既に付与されています' : 'が付与されました'}。`)
        .setColor(0x57F287)
        .setTimestamp();

      await member.send({
        embeds: [dmEmbed]
      });
      console.log(`✅ DM sent to user ${member.user.username}`);
    } catch (dmError) {
      console.log('Could not send DM to user:', dmError);
    }

    return true;
  } catch (error) {
    console.error('❌ Error granting role:', error);
    console.error('❌ Error details:', (error as Error).message);
    return false;
  }
}

// 管理者統計表示（ミニマル版）
async function handleAdminStats(interaction: ButtonInteraction, isAdmin: boolean) {
  try {
    if (!isAdmin) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ 管理者権限が必要です。',
          ephemeral: true
        });
      }
      return;
    }

    const statsEmbed = new EmbedBuilder()
      .setTitle('📊 統計情報')
      .setDescription('**システム統計**\\n\\n実装予定')
      .setColor(0x57F287)
      .setTimestamp();

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [statsEmbed],
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('Error in handleAdminStats:', error);
    throw error;
  }
}



// 管理者リフレッシュ（ミニマル版）
async function handleAdminRefresh(interaction: ButtonInteraction, isAdmin: boolean) {
  try {
    if (!isAdmin) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ 管理者権限が必要です。',
          ephemeral: true
        });
      }
      return;
    }

    const refreshEmbed = new EmbedBuilder()
      .setTitle('🔄 更新完了')
      .setDescription('**システムを更新しました**\\n\\n実装予定')
      .setColor(0x57F287)
      .setTimestamp();

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [refreshEmbed],
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('Error in handleAdminRefresh:', error);
    throw error;
  }
}

// ロール剥奪関数（Cronから呼び出される）
export async function revokeRoleFromUser(discordId: string): Promise<boolean> {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(discordId);
    const role = await guild.roles.fetch(config.DISCORD_ROLE_ID);

    if (!role) {
      console.error('Role not found');
      return false;
    }

    await member.roles.remove(role);
    console.log(`✅ Role revoked from user ${discordId}`);

    // ユーザーにDM送信
    try {
      await member.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('📋 ロール更新通知')
            .setDescription(`**NFTの保有が確認できなくなったため、ロール "${role.name}" が削除されました。**\\n\\n再度NFTを取得された場合は、認証チャンネルから再認証を行ってください。`)
            .setColor(0xED4245)
            .setTimestamp()
        ]
      });
    } catch (dmError) {
      console.log('Could not send DM to user:', dmError);
    }

    return true;
  } catch (error) {
    console.error('Error revoking role:', error);
    return false;
  }
}

// Botログイン
client.login(config.DISCORD_TOKEN).catch((error) => {
  console.error('❌ Failed to login:', error);
  process.exit(1);
});

// エラーハンドリング
client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

console.log('🤖 Discord Bot starting...');
console.log('📋 Environment check:');
console.log(`  - NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`  - DISCORD_TOKEN: ${config.DISCORD_TOKEN ? '✅ Set' : '❌ Not set'}`);
console.log(`  - DISCORD_CLIENT_ID: ${config.DISCORD_CLIENT_ID ? '✅ Set' : '❌ Not set'}`);
console.log(`  - DISCORD_GUILD_ID: ${config.DISCORD_GUILD_ID ? '✅ Set' : '❌ Not set'}`);
console.log(`  - VERIFICATION_CHANNEL_ID: ${config.VERIFICATION_CHANNEL_ID ? '✅ Set' : '❌ Not set'}`);
console.log(`  - VERIFICATION_URL: ${config.VERIFICATION_URL ? '✅ Set' : '❌ Not set'}`);
>>>>>>> 16da97f (Initial commit: NFT Verification Discord Bot)
