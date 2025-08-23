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
  GuildMember,
  MessageFlags
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

// チャンネルテンプレート取得
async function getChannelTemplates() {
  try {
    console.log(`🌐 Fetching from: ${config.CLOUDFLARE_WORKERS_API_URL}/api/channel-templates`);
    const response = await fetch(`${config.CLOUDFLARE_WORKERS_API_URL}/api/channel-templates`);
    console.log(`📡 Response status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json() as any;
    console.log('📥 Raw response data:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('✅ Successfully got channel templates from Workers');
      return data.data;
    } else {
      console.log('⚠️ Workers returned failure, using fallback');
      return data.fallback || getDefaultChannelTemplates();
    }
  } catch (error) {
    console.error('❌ Error fetching channel templates:', error);
    console.log('🔄 Using default fallback templates');
    return getDefaultChannelTemplates();
  }
}

function getDefaultChannelTemplates() {
  return {
    verificationChannel: {
      title: '🎫 NFT Verification System',
      description: 'This system grants roles to users who hold NFTs on the Sui network.\n\nClick the button below to start verification.',
      color: 0x57F287
    },
    verificationStart: {
      title: '🎫 NFT Verification',
      description: 'Starting verification...\n\n⚠️ **Note:** Wallet signatures are safe. We only verify NFT ownership and do not move any assets.',
      color: 0x57F287
    },
    verificationUrl: 'https://syndicatextokyo.app'
  };
}

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

    // 既存のBotメッセージをチェック（すべてのBotメッセージを削除）
    console.log('🔍 Checking existing bot messages...');
    const messages = await verificationChannel.messages.fetch({ limit: 50 });
    const botMessages = messages.filter(msg => 
      msg.author.id === client.user!.id
    );

    console.log(`📊 Found ${botMessages.size} existing bot messages`);
    console.log('📋 Bot message titles:', botMessages.map(msg => 
      msg.embeds.length > 0 ? msg.embeds[0].title : 'No embed'
    ));

    // 古いメッセージを削除（権限があれば）
    if (botMessages.size > 0) {
      try {
        const permissions = verificationChannel.permissionsFor(client.user!);
        if (permissions?.has('ManageMessages')) {
          // 一括削除を試行
          try {
            await verificationChannel.bulkDelete(botMessages);
            console.log(`🧹 Bulk deleted ${botMessages.size} old bot messages`);
          } catch (bulkError) {
            console.log('⚠️ Bulk delete failed, trying individual deletion:', bulkError);
            // 個別削除を試行
            for (const message of botMessages.values()) {
              try {
                await message.delete();
                console.log(`🧹 Deleted individual message: ${message.embeds[0]?.title || 'No title'}`);
              } catch (individualError) {
                console.log(`⚠️ Could not delete message: ${individualError}`);
              }
            }
          }
        } else {
          console.log('⚠️ No permission to delete messages, keeping existing ones');
          // 権限がない場合は既存メッセージを削除せずに新しいメッセージを送信
        }
      } catch (error) {
        console.log('⚠️ Could not delete old messages:', error);
        // エラーが発生しても新しいメッセージを送信
      }
    }

    console.log('🔄 Creating new verification messages...');

    // テンプレートを取得
    console.log('📡 Fetching channel templates from Workers...');
    const templates = await getChannelTemplates();
    console.log('📥 Received templates:', JSON.stringify(templates, null, 2));
    const channelTemplate = templates.verificationChannel;

    // シンプルな認証メッセージ
    const verificationEmbed = new EmbedBuilder()
      .setTitle(channelTemplate.title)
      .setDescription(channelTemplate.description)
      .addFields(
        { name: '📋 Verification Steps', value: '1. Click the button\n2. Sign with your wallet\n3. NFT ownership check\n4. Role assignment', inline: false }
      )
      .setColor(channelTemplate.color || 0x57F287)
      .setFooter({ 
        text: 'NFT Verification Bot'
      })
      .setTimestamp();

    // シンプルなボタン
    const verifyButton = new ButtonBuilder()
      .setCustomId('verify_nft')
      .setLabel('Start NFT Verification')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎫');

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(verifyButton);

    // 認証メッセージ送信
    console.log('📤 Sending verification message...');
    await verificationChannel.send({
      embeds: [verificationEmbed],
      components: [actionRow]
    });
    console.log('✅ Verification message sent');

  } catch (error) {
    console.error('❌ Error setting up verification channel:', error);
    console.error('❌ Error stack:', (error as Error).stack);
    console.error('❌ Error details:', {
      guildId: config.DISCORD_GUILD_ID,
      channelId: config.VERIFICATION_CHANNEL_ID,
      workersUrl: config.CLOUDFLARE_WORKERS_API_URL
    });
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

    // 認証ボタン
    if (customId === 'verify_nft') {
      console.log(`✅ Processing verify_nft for user ${user.username}`);
      await handleVerifyNFT(interaction);
    } else {
      console.log(`❌ Unknown button interaction: ${customId}`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '❌ Unknown button interaction.',
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
        await interaction.reply({
          content: '❌ An error occurred while processing your request.',
          ephemeral: true
        });
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
    
    // テンプレートを取得
    const templates = await getChannelTemplates();
    const startTemplate = templates.verificationStart;
    
    // URLをテンプレートから取得、フォールバックはconfigから
    const baseUrl = templates.verificationUrl || config.VERIFICATION_URL;
    const verificationUrl = `${baseUrl}?discord_id=${interaction.user.id}`;
    
    // 短縮表示用のURL（Discord IDを短縮）
    const shortDiscordId = interaction.user.id.slice(-6); // 最後の6文字
    const shortUrl = `${baseUrl}?discord_id=...${shortDiscordId}`;
    
    console.log(`🔗 Verification URL: ${verificationUrl}`);
    console.log(`🔗 Short URL: ${shortUrl}`);

    console.log('🔧 Creating embed with new format...');
    console.log('📋 Template data:', JSON.stringify(startTemplate, null, 2));
    console.log('🔗 URL:', verificationUrl);
    
    const verifyEmbed = new EmbedBuilder()
      .setTitle(startTemplate.title)
      .setDescription(startTemplate.description)
      .addFields(
        { 
          name: '🔗 Verification URL', 
          value: `[クリックして認証ページを開く](${verificationUrl})`, 
          inline: false 
        },
        {
          name: '📋 Copy URL',
          value: `\`${shortUrl}\`\n\n**Full URL:**\n\`${verificationUrl}\``,
          inline: false
        }
      )
      .setColor(startTemplate.color || 0x57F287)
      .setFooter({ 
        text: 'NFT Verification Bot'
      })
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
export async function grantRoleToUser(discordId: string, collectionId?: string, roleName?: string, customMessage?: { title?: string; description?: string; color?: number }): Promise<boolean> {
  try {
    console.log(`🔄 Attempting to grant role to Discord ID: ${discordId}`);
    console.log(`📋 Collection ID: ${collectionId || 'default'}`);
    console.log(`📋 Role Name: ${roleName || 'NFT Holder'}`);
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

    // コレクションIDが指定されている場合、そのコレクションのロールIDを取得
    let roleId = config.DISCORD_ROLE_ID; // デフォルトロール
    
    if (collectionId) {
      try {
        console.log(`🔄 Fetching role ID for collection: ${collectionId}`);
        const collectionRoleId = await getRoleIdForCollection(collectionId);
        if (collectionRoleId) {
          roleId = collectionRoleId;
          console.log(`✅ Found role ID for collection: ${roleId}`);
        } else {
          console.log(`⚠️ No role ID found for collection ${collectionId}, using default`);
        }
      } catch (error) {
        console.error('❌ Error fetching collection role ID:', error);
        console.log('⚠️ Using default role ID');
      }
    }

    const role = await guild.roles.fetch(roleId);
    if (!role) {
      console.error('❌ Role not found');
      return false;
    }
    console.log(`✅ Found role: ${role.name} (${role.id})`);

    // 既にロールを持っているかチェック
    const hasRole = member.roles.cache.has(roleId);
    
    if (!hasRole) {
      console.log(`🔄 Adding role ${role.name} to user ${member.user.username}...`);
      await member.roles.add(role);
      console.log(`✅ Role granted to user ${discordId} (${member.user.username})`);
    } else {
      console.log(`ℹ️ User ${discordId} (${member.user.username}) already has the role ${role.name}`);
    }

    // ユーザーにDM送信（成功通知）
    try {
      const title = customMessage?.title || '🎉 NFT Verification Successful!';
      const description = customMessage?.description || `**Congratulations! Your NFT verification has been completed successfully!**\\n\\n🌟 **What you've received:**\\n• **Exclusive Discord Role:** "${role.name}"\\n• **Premium Access:** Special channels and features\\n• **Community Status:** Verified NFT holder\\n• **Future Benefits:** Early access to upcoming features\\n\\n🎯 **Your Benefits:**\\n• Access to exclusive channels\\n• Special community recognition\\n• Priority support and assistance\\n• Early access to new features\\n\\n💎 **Security Confirmation:**\\n• Your NFT ownership has been verified on the blockchain\\n• All verification was done securely without accessing private keys\\n• Your wallet data remains completely private\\n\\n*Welcome to the exclusive NFT community! Enjoy your new privileges!*`;
      const color = customMessage?.color ?? 0x57F287;

      const successEmbed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(color)
        .setThumbnail('https://i.imgur.com/8tBXd6L.png')
        .addFields(
          { name: '🎁 Role Granted', value: role.name, inline: true },
          { name: '🆔 Discord ID', value: discordId, inline: true },
          { name: '⏰ Verified At', value: new Date().toLocaleString(), inline: true },
          { name: '🔒 Security Level', value: 'Maximum Protection', inline: true },
          { name: '⚡ Process Speed', value: 'Instant Verification', inline: true },
          { name: '🎯 Status', value: 'Active & Verified', inline: true }
        )
        .setFooter({ 
          text: 'Sui NFT Verification • Professional & Secure',
          iconURL: 'https://i.imgur.com/8tBXd6L.png'
        })
        .setTimestamp();

      console.log('📤 Sending success embed to user DM...');
      
      // ユーザーにDMを送信（自分以外には見られない）
      const message = await member.send({
        embeds: [successEmbed]
      });

      console.log(`✅ Success message sent for Discord ID: ${discordId}`);

      // 5分後にメッセージを自動削除
      setTimeout(async () => {
        try {
          console.log(`🔄 Auto-deleting success message for Discord ID: ${discordId}...`);
          await message.delete();
          console.log(`✅ Auto-deleted success message for Discord ID: ${discordId}`);
        } catch (error) {
          console.log('❌ Failed to auto-delete message:', error);
          console.log('Message may have been deleted manually or expired');
        }
      }, 5 * 60 * 1000); // 5分 = 300秒

      console.log(`⏰ Auto-delete scheduled for Discord ID: ${discordId} in 5 minutes`);
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

// コレクション別ロールID取得関数
async function getRoleIdForCollection(collectionId: string): Promise<string | null> {
  try {
    console.log(`🔄 Fetching collection config for ID: ${collectionId}`);
    
    // Cloudflare Workers APIからコレクション設定を取得
    const response = await fetch(`${config.CLOUDFLARE_WORKERS_API_URL}/api/collections`);
    const data = await response.json() as any;
    
    if (data.success && data.data) {
      const collection = data.data.find((c: any) => c.id === collectionId);
      if (collection && collection.isActive) {
        console.log(`✅ Found active collection: ${collection.name} with role ID: ${collection.roleId}`);
        return collection.roleId;
      } else {
        console.log(`⚠️ Collection ${collectionId} not found or inactive`);
      }
    } else {
      console.log('❌ Failed to fetch collections from API');
    }
  } catch (error) {
    console.error('❌ Error fetching collection config:', error);
  }
  return null;
}

// 認証失敗時のDiscordチャンネル通知
export async function sendVerificationFailureMessage(discordId: string, verificationData: any): Promise<boolean> {
  try {
    console.log(`🔄 Sending verification failure message for Discord ID: ${discordId}`);
    console.log('📋 Verification data:', verificationData);
    
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    if (!guild) {
      console.error('❌ Guild not found');
      return false;
    }
    console.log(`✅ Found guild: ${guild.name}`);

    // ユーザーを取得
    const user = await client.users.fetch(discordId);
    if (!user) {
      console.error('❌ User not found');
      return false;
    }

    const cm = verificationData?.custom_message || {};
    const failureEmbed = new EmbedBuilder()
      .setTitle(cm.title || '❌ NFT Verification Failed')
      .setDescription(cm.description || `**NFT verification failed for user <@${discordId}>**\n\n**Wallet Address:** \`${verificationData?.address || 'Unknown'}\`\n**Reason:** ${verificationData?.reason || 'NFT not found in wallet'}\n**Timestamp:** ${new Date().toLocaleString()}\n\n**Next Steps:**\n• Ensure you own the required NFTs\n• Check your wallet connection\n• Try the verification process again`)
      .setColor(cm.color ?? 0xED4245)
      .setFooter({ 
        text: 'Sui NFT Verification • Professional System'
      })
      .setTimestamp();

    console.log('📤 Sending failure embed to user DM...');
    
    // ユーザーにDMを送信（自分以外には見られない）
    const message = await user.send({
      embeds: [failureEmbed]
    });

    console.log(`✅ Verification failure message sent for Discord ID: ${discordId}`);

    // 5分後にメッセージを自動削除
    setTimeout(async () => {
      try {
        console.log(`🔄 Auto-deleting verification failure message for Discord ID: ${discordId}...`);
        await message.delete();
        console.log(`✅ Auto-deleted verification failure message for Discord ID: ${discordId}`);
      } catch (error) {
        console.log('❌ Failed to auto-delete message:', error);
        console.log('Message may have been deleted manually or expired');
      }
    }, 5 * 60 * 1000); // 5分 = 300秒

    console.log(`⏰ Auto-delete scheduled for Discord ID: ${discordId} in 5 minutes`);
    return true;
  } catch (error) {
    console.error('❌ Error sending verification failure message:', error);
    console.error('❌ Error details:', (error as Error).message);
    console.error('❌ Error stack:', (error as Error).stack);
    return false;
  }
}

// ロール剥奪関数（Cronから呼び出される）
export async function revokeRoleFromUser(discordId: string, customMessage?: { title?: string; description?: string; color?: number }): Promise<boolean> {
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
      const title = customMessage?.title || '📋 Role Update Notification';
      const description = customMessage?.description || `**Your NFT verification status has been updated**\\n\\n⚠️ **Role Removed:** The "${role.name}" role has been removed from your account.\\n\\n🔍 **Reason:** Your NFT ownership could not be verified on the blockchain.\\n\\n🔄 **How to restore your role:**\\n1. Ensure you still own the required NFTs\\n2. Visit the verification channel\\n3. Click "Start Verification" to re-verify\\n4. Complete the verification process again\\n\\n💡 **Tips:**\\n• Make sure your wallet is properly connected\\n• Verify that you still own the required NFTs\\n• Check that your NFTs are on the correct network\\n\\n*If you believe this is an error, please contact server administrators for assistance.*`;
      const color = customMessage?.color ?? 0xED4245;

      await member.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(color)
            .setThumbnail('https://i.imgur.com/8tBXd6L.png')
            .addFields(
              { name: '🎭 Role Removed', value: role.name, inline: true },
              { name: '🆔 Discord ID', value: discordId, inline: true },
              { name: '⏰ Updated At', value: new Date().toLocaleString(), inline: true },
              { name: '🔍 Status', value: 'Verification Required', inline: true },
              { name: '🔄 Action', value: 'Re-verify to restore', inline: true },
              { name: '💬 Support', value: 'Contact administrators', inline: true }
            )
            .setFooter({ 
              text: 'Sui NFT Verification • Professional System',
              iconURL: 'https://i.imgur.com/8tBXd6L.png'
            })
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

export { client };