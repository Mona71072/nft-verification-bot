<<<<<<< HEAD
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
=======
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
>>>>>>> 1156ca82f0807a5ef7318033993367ddc671d4cf
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
    
<<<<<<< HEAD
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
=======
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
>>>>>>> 1156ca82f0807a5ef7318033993367ddc671d4cf
    } else {
      console.error('❌ Bot member not found in guild');
    }
  } catch (error) {
    console.error('❌ Error checking bot permissions:', error);
  }
  
  // APIサーバー起動
  console.log('🚀 Starting API server...');
  const apiServer = startApiServer();

  // DiscordクライアントをAPIサーバーで利用できるように設定
  if (apiServer && apiServer.setDiscordClient) {
    apiServer.setDiscordClient(client);
  }

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

    const channel = await guild.channels.fetch(config.VERIFICATION_CHANNEL_ID) as TextChannel;
    if (!channel) {
      console.error('❌ Verification channel not found');
      return;
    }

    console.log(`✅ Found verification channel: ${channel.name} (${channel.id})`);

    // 既存のメッセージを削除
    try {
      const messages = await channel.messages.fetch({ limit: 100 });
      if (messages.size > 0) {
        console.log(`🗑️ Deleting ${messages.size} existing messages...`);
        await channel.bulkDelete(messages);
      }
    } catch (error) {
      console.log('Could not delete existing messages:', error);
    }

    // 新しい認証メッセージを作成
    const verificationEmbed = new EmbedBuilder()
      .setTitle('NFT Verification')
      .setDescription('Sui NFTの保有を確認してロールを取得できます。\n\n下のボタンをクリックして認証を開始してください。')
      .setColor(0x5865F2)
      .addFields(
        { name: '認証手順', value: '1. ボタンをクリック\n2. ウォレットアドレスを入力\n3. 署名を実行\n4. NFT保有を確認\n5. ロールを付与', inline: false },
        { name: '注意事項', value: '• 認証は一度のみ必要です\n• NFTを売却した場合、ロールは自動で削除されます\n• プライベートキーは要求されません', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'NFT Verification Bot' });

    const verifyButton = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('verify_nft')
          .setLabel('NFT認証を開始')
          .setStyle(ButtonStyle.Primary)
      );

    await channel.send({
      embeds: [verificationEmbed],
      components: [verifyButton]
    });

    console.log('✅ Verification message sent successfully');
  } catch (error) {
    console.error('❌ Error setting up verification channel:', error);
  }
}

// インタラクション処理
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  try {
    console.log(`🔘 Button interaction: ${interaction.customId} by ${interaction.user.tag}`);

    switch (interaction.customId) {
      case 'verify_nft':
        await handleVerifyNFT(interaction);
        break;
      default:
        console.log(`Unknown button interaction: ${interaction.customId}`);
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ エラーが発生しました。もう一度お試しください。',
          ephemeral: true
        });
      }
    } catch (replyError) {
      console.error('Error sending error reply:', replyError);
    }
  }
});

// NFT認証処理
async function handleVerifyNFT(interaction: ButtonInteraction) {
  try {
    console.log(`🔐 Starting NFT verification for user: ${interaction.user.tag} (${interaction.user.id})`);

    // 既にロールを持っているかチェック
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(interaction.user.id);
    const role = await guild.roles.fetch(config.DISCORD_ROLE_ID);

    if (!role) {
      console.error('Role not found');
      await interaction.reply({
        content: '❌ ロールが見つかりません。管理者に連絡してください。',
        ephemeral: true
      });
      return;
    }

    if (member.roles.cache.has(role.id)) {
      console.log(`User ${interaction.user.tag} already has the role`);
      await interaction.reply({
        content: '✅ 既にロールが付与されています。',
        ephemeral: true
      });
      return;
    }

    // 認証URLを生成
    const verificationUrl = `${config.VERIFICATION_URL}?discord_id=${interaction.user.id}`;
    
    const verificationEmbed = new EmbedBuilder()
      .setTitle('NFT認証')
      .setDescription(`認証を開始します。\n\n下のリンクをクリックして認証を完了してください。\n\n[認証ページを開く](${verificationUrl})`)
      .setColor(0x5865F2)
      .addFields(
        { name: '手順', value: '1. リンクをクリック\n2. ウォレットアドレスを入力\n3. 署名を実行\n4. 認証完了', inline: false },
        { name: '注意', value: '• プライベートキーは要求されません\n• 認証は安全に行われます\n• 5分以内に完了してください', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'NFT Verification Bot' });

    await interaction.reply({
      embeds: [verificationEmbed],
      ephemeral: true
    });

    console.log(`✅ Verification URL sent to user: ${interaction.user.tag}`);
  } catch (error) {
    console.error('Error in handleVerifyNFT:', error);
    await interaction.reply({
      content: 'エラーが発生しました。もう一度お試しください。',
      ephemeral: true
    });
  }
}

// ロール付与関数（APIから呼び出される）
export async function grantRoleToUser(discordId: string): Promise<boolean> {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(discordId);
    const role = await guild.roles.fetch(config.DISCORD_ROLE_ID);

    if (!role) {
      console.error('Role not found');
      return false;
    }

    await member.roles.add(role);
    console.log(`✅ Role granted to user ${discordId}`);

    // ユーザーにDM送信
    try {
      await member.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('認証完了')
            .setDescription(`NFT認証が完了しました。\n\nロール "${role.name}" が付与されました。\n\nサーバーでロールが表示されるまで少し時間がかかる場合があります。`)
            .setColor(0x57F287)
            .setTimestamp()
        ]
      });
    } catch (dmError) {
      console.log('Could not send DM to user:', dmError);
    }

    return true;
  } catch (error) {
    console.error('Error granting role:', error);
    return false;
  }
}

<<<<<<< HEAD
// 複数ロール付与関数（APIから呼び出される）
export async function grantMultipleRolesToUser(discordId: string, roles: Array<{roleId: string, roleName: string}>): Promise<boolean> {
=======
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
      return addresses;
    }
    
    // 初期設定の管理者アドレス（現在のアドレスを含む）
    const defaultAdmins = [
      '0x645a45e619b62f8179e217bed972bc65281fddee193fc0505566490c7743aa9d',
      '0x645a45e619b62f8179e217bed972bc65281fddee193fc0505566490c7743aa9d'.toLowerCase()
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
      '0x645a45e619b62f8179e217bed972bc65281fddee193fc0505566490c7743aa9d',
      '0x645a45e619b62f8179e217bed972bc65281fddee193fc0505566490c7743aa9d'.toLowerCase()
    ];
  }
}

// 管理者アドレスを更新
async function updateAdminAddresses(c: Context<{ Bindings: Env }>, addresses: string[]): Promise<boolean> {
  try {
    console.log(`📝 Updating admin addresses: ${addresses.join(', ')}`);
    
    // 重複を除去（大文字小文字は維持）
    const uniqueAddresses = [...new Set(addresses.filter(addr => addr && addr.trim()))];
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
>>>>>>> 1156ca82f0807a5ef7318033993367ddc671d4cf
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(discordId);
    
<<<<<<< HEAD
    const grantedRoles = [];
    const failedRoles = [];

    for (const roleData of roles) {
      try {
        const role = await guild.roles.fetch(roleData.roleId);
        if (role) {
          await member.roles.add(role);
          grantedRoles.push(roleData); // オブジェクトを追加
          console.log(`✅ Role "${roleData.roleName}" granted to user ${discordId}`);
        } else {
          failedRoles.push(roleData.roleName);
          console.error(`❌ Role not found: ${roleData.roleId}`);
        }
      } catch (error) {
        failedRoles.push(roleData.roleName);
        console.error(`❌ Error granting role "${roleData.roleName}":`, error);
      }
    }

    // ユーザーにDM送信
    try {
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTimestamp()
        .setFooter({ text: 'NFT Verification Bot' });

      // 認証結果の詳細を構築
      let title = '認証完了';
      let description = '';
      
      if (grantedRoles.length > 0) {
        title = '認証完了';
        embed.setColor(0x57F287);
        description = `NFT認証が完了しました。\n\n以下のコレクションでNFTが確認されました:\n\n${grantedRoles.map(role => `• ${role.roleName}`).join('\n')}\n\n対応するロールが付与されました。サーバーでロールが表示されるまで少し時間がかかる場合があります。`;
=======
    const collectionsData = await c.env.COLLECTION_STORE.get('collections');
    const collections = collectionsData ? JSON.parse(collectionsData) : [];
    
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
    
    return c.json({
      success: true,
      data: collections
    });
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
    
    // 大文字小文字を区別せずに削除
    const newAddresses = currentAddresses.filter(addr => 
      addr.toLowerCase() !== addressToRemove.toLowerCase()
    );
    
    console.log(`📋 New addresses: ${newAddresses.join(', ')}`);
    
    // 最低1つの管理者アドレスが残るようにする
    if (newAddresses.length === 0) {
      console.log('⚠️ Cannot remove all admin addresses, keeping at least one');
      return c.json({
        success: false,
        error: 'Cannot remove all admin addresses. At least one admin address must remain.',
        message: '管理者アドレスを全て削除することはできません。最低1つの管理者アドレスが必要です。'
      }, 400);
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
    
    // Discord Bot API URLを取得
    const DISCORD_BOT_API_URL = 'https://nft-verification-bot.onrender.com';
    console.log('🔗 Discord Bot API URL:', DISCORD_BOT_API_URL);
    
    if (!DISCORD_BOT_API_URL) {
      console.log('⚠️ Discord Bot API URL not configured');
      return c.json({
        success: true,
        data: []
      });
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
      const result = await response.json() as any;
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
        success: true,
        data: []
      });
    }
    
  } catch (error) {
    console.error('❌ Error fetching Discord roles:', error);
    return c.json({
      success: true,
      data: []
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
>>>>>>> 1156ca82f0807a5ef7318033993367ddc671d4cf
      }

      if (failedRoles.length > 0) {
        embed.addFields({
          name: '付与できなかったロール',
          value: failedRoles.map(name => `• ${name}`).join('\n'),
          inline: false
        });
      }

      embed.setTitle(title).setDescription(description);

      await member.send({ embeds: [embed] });
    } catch (dmError) {
      console.log('Could not send DM to user:', dmError);
    }

    return grantedRoles.length > 0; // 少なくとも1つのロールが付与されていれば成功
  } catch (error) {
    console.error('Error granting multiple roles:', error);
    return false;
  }
}

// 認証失敗時のDM送信関数
export async function sendVerificationFailedMessage(discordId: string, verificationData?: any): Promise<boolean> {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(discordId);

    // ユーザーにDM送信
    try {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTimestamp()
        .setFooter({ text: 'NFT Verification Bot' });

      // 認証結果の詳細を構築
      let title = '認証完了';
      let description = '';
      
      if (verificationData && verificationData.verificationResults) {
        const results = verificationData.verificationResults;
        const successful = results.filter((r: any) => r.hasNft);
        const failed = results.filter((r: any) => !r.hasNft);

        if (successful.length > 0 && failed.length === 0) {
          // すべて成功
          title = '認証完了';
          embed.setColor(0x57F287);
          description = `NFT認証が完了しました。\n\n以下のコレクションでNFTが確認されました:\n\n${successful.map((result: any) => `• ${result.collectionName}`).join('\n')}\n\n対応するロールが付与されました。サーバーでロールが表示されるまで少し時間がかかる場合があります。`;
        } else if (successful.length > 0 && failed.length > 0) {
          // 一部成功
          title = '認証完了（一部成功）';
          embed.setColor(0xFAA61A);
          description = `NFT認証が完了しました。\n\n✅ **認証成功:**\n${successful.map((result: any) => `• ${result.collectionName}`).join('\n')}\n\n❌ **認証失敗:**\n${failed.map((result: any) => `• ${result.collectionName}`).join('\n')}\n\n認証に成功したコレクションのロールが付与されました。`;
        } else {
          // すべて失敗
          title = '認証失敗';
          embed.setColor(0xED4245);
          description = `NFT認証が失敗しました。\n\n以下のコレクションでNFTが見つかりませんでした:\n\n${failed.map((result: any) => `• ${result.collectionName}`).join('\n')}\n\n再度認証を試行するか、別のコレクションを選択してください。`;
        }
      } else {
        // データがない場合
        title = '認証失敗';
        embed.setColor(0xED4245);
        description = `NFT認証が失敗しました。\n\n選択されたコレクションでNFTが見つかりませんでした。\n\n再度認証を試行するか、別のコレクションを選択してください。`;
      }

      embed.setTitle(title).setDescription(description);

      await member.send({ embeds: [embed] });
      console.log(`✅ Verification result message sent to user ${discordId}`);
      return true;
    } catch (dmError) {
      console.log('Could not send DM to user:', dmError);
      return false;
    }
  } catch (error) {
    console.error('Error sending verification result message:', error);
    return false;
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
            .setTitle('ロール更新通知')
            .setDescription(`NFTの保有が確認できなくなったため、ロール "${role.name}" が削除されました。\n再度NFTを取得された場合は、認証チャンネルから再認証を行ってください。`)
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

// 複数ロール剥奪関数（バッチ処理用）
export async function revokeMultipleRolesFromUser(discordId: string, roles: Array<{roleId: string, roleName: string}>): Promise<boolean> {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(discordId);
    
    const revokedRoles = [];
    const failedRoles = [];

    for (const roleData of roles) {
      try {
        const role = await guild.roles.fetch(roleData.roleId);
        if (role && member.roles.cache.has(role.id)) {
          await member.roles.remove(role);
          revokedRoles.push(roleData);
          console.log(`✅ Role "${roleData.roleName}" revoked from user ${discordId}`);
        } else if (!role) {
          failedRoles.push(roleData.roleName);
          console.error(`❌ Role not found: ${roleData.roleId}`);
        } else {
          console.log(`ℹ️ User ${discordId} doesn't have role "${roleData.roleName}"`);
        }
      } catch (error) {
        failedRoles.push(roleData.roleName);
        console.error(`❌ Error revoking role "${roleData.roleName}":`, error);
      }
    }

    // ユーザーにDM送信（ロールが剥奪された場合のみ）
    if (revokedRoles.length > 0) {
      try {
        const embed = new EmbedBuilder()
          .setTitle('ロール更新通知')
          .setColor(0xED4245)
          .setTimestamp()
          .setFooter({ text: 'NFT Verification Bot' });

        let description = 'NFTの保有が確認できなくなったため、以下のロールが削除されました:\n\n';
        description += revokedRoles.map(role => `• ${role.roleName}`).join('\n');
        description += '\n\n再度NFTを取得された場合は、認証チャンネルから再認証を行ってください。';

        if (failedRoles.length > 0) {
          description += `\n\n⚠️ 以下のロールの削除に失敗しました:\n${failedRoles.map(name => `• ${name}`).join('\n')}`;
        }

        embed.setDescription(description);
        await member.send({ embeds: [embed] });
      } catch (dmError) {
        console.log('Could not send DM to user:', dmError);
      }
    }

    return revokedRoles.length > 0; // 少なくとも1つのロールが剥奪されていれば成功
  } catch (error) {
    console.error('Error revoking multiple roles:', error);
    return false;
  }
}

// バッチ処理結果通知関数
export async function sendBatchProcessNotification(discordId: string, batchData: any): Promise<boolean> {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(discordId);

    const embed = new EmbedBuilder()
      .setTitle('バッチ処理完了通知')
      .setColor(0x57F287)
      .setTimestamp()
      .setFooter({ text: 'NFT Verification Bot' });

    let description = '定期的なNFT保有確認が完了しました。\n\n';
    
    if (batchData.revokedRoles && batchData.revokedRoles.length > 0) {
      description += `❌ **削除されたロール:**\n${batchData.revokedRoles.map((role: any) => `• ${role.roleName}`).join('\n')}\n\n`;
      embed.setColor(0xED4245);
    } else {
      description += '✅ すべてのロールが正常に保持されています。\n\n';
    }

    description += `📊 **処理結果:**\n• 処理対象: ${batchData.totalUsers}人\n• 処理完了: ${batchData.processed}人\n• ロール削除: ${batchData.revokedRoles?.length || 0}人\n• エラー: ${batchData.errors || 0}件`;

    embed.setDescription(description);
    await member.send({ embeds: [embed] });
    
    console.log(`✅ Batch process notification sent to user ${discordId}`);
    return true;
  } catch (error) {
    console.error('Error sending batch process notification:', error);
    return false;
  }
}

// 管理者用バッチ処理通知関数
export async function sendAdminBatchNotification(batchStats: any): Promise<boolean> {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const adminMember = await guild.members.fetch(config.ADMIN_USER_ID);

    const embed = new EmbedBuilder()
      .setTitle('バッチ処理完了レポート')
      .setColor(0x57F287)
      .setTimestamp()
      .setFooter({ text: 'NFT Verification Bot' });

    let description = '定期的なNFT保有確認バッチ処理が完了しました。\n\n';
    description += `📊 **処理統計:**\n• 総ユーザー数: ${batchStats.totalUsers}人\n• 処理完了: ${batchStats.processed}人\n• ロール削除: ${batchStats.revoked}人\n• エラー: ${batchStats.errors}件\n• 処理時間: ${batchStats.duration}ms`;

    if (batchStats.revoked > 0) {
      description += `\n\n⚠️ **注意:** ${batchStats.revoked}人のロールが削除されました。`;
      embed.setColor(0xFAA61A);
    }

    embed.setDescription(description);
    await adminMember.send({ embeds: [embed] });
    
    console.log(`✅ Admin batch notification sent`);
    return true;
  } catch (error) {
    console.error('Error sending admin batch notification:', error);
    return false;
  }
}

// Botログイン
client.login(config.DISCORD_TOKEN).catch((error) => {
  console.error('❌ Failed to login:', error);
  process.exit(1);
});

<<<<<<< HEAD
// エラーハンドリング
client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
=======
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
>>>>>>> 1156ca82f0807a5ef7318033993367ddc671d4cf
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
