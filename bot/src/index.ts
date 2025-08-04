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
      .setTitle('🔐 NFT認証システム')
      .setDescription('**Sui NFTの保有を確認してロールを取得できます**\\n\\n下のボタンをクリックして認証を開始してください。')
      .setColor(0x5865F2)
      .addFields(
        { name: '📋 認証手順', value: '1. ボタンをクリック\\n2. ウォレットアドレスを入力\\n3. 署名を実行\\n4. NFT保有を確認\\n5. ロールを付与', inline: false },
        { name: '⚠️ 注意事項', value: '• 認証は一度のみ必要です\\n• NFTを売却した場合、ロールは自動で削除されます\\n• プライベートキーは要求されません', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'NFT Verification Bot' });

    const verifyButton = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('verify_nft')
          .setLabel('🔐 NFT認証を開始')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔐')
      );

    const adminButton = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('admin_stats')
          .setLabel('📊 統計情報')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('📊'),
        new ButtonBuilder()
          .setCustomId('admin_refresh')
          .setLabel('🔄 更新')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🔄')
      );

    await channel.send({
      embeds: [verificationEmbed],
      components: [verifyButton, adminButton]
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
      case 'admin_stats':
        const isAdmin = interaction.user.id === config.ADMIN_USER_ID;
        await handleAdminStats(interaction, isAdmin);
        break;
      case 'admin_refresh':
        const isAdminRefresh = interaction.user.id === config.ADMIN_USER_ID;
        await handleAdminRefresh(interaction, isAdminRefresh);
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
      .setTitle('🔐 NFT認証')
      .setDescription(`**認証を開始します**\\n\\n下のリンクをクリックして認証を完了してください。\\n\\n[🔗 認証ページを開く](${verificationUrl})`)
      .setColor(0x5865F2)
      .addFields(
        { name: '📋 手順', value: '1. リンクをクリック\\n2. ウォレットアドレスを入力\\n3. 署名を実行\\n4. 認証完了', inline: false },
        { name: '⚠️ 注意', value: '• プライベートキーは要求されません\\n• 認証は安全に行われます\\n• 5分以内に完了してください', inline: false }
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
      content: '❌ エラーが発生しました。もう一度お試しください。',
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
            .setTitle('🎉 認証完了！')
            .setDescription(`**NFT認証が完了しました！**\\n\\nロール "${role.name}" が付与されました。\\n\\nサーバーでロールが表示されるまで少し時間がかかる場合があります。`)
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

// 複数ロール付与関数（APIから呼び出される）
export async function grantMultipleRolesToUser(discordId: string, roles: Array<{roleId: string, roleName: string}>): Promise<boolean> {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(discordId);
    
    const grantedRoles = [];
    const failedRoles = [];

    for (const roleData of roles) {
      try {
        const role = await guild.roles.fetch(roleData.roleId);
        if (role) {
          await member.roles.add(role);
          grantedRoles.push(roleData.roleName);
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
        .setTitle('🎉 認証完了！')
        .setColor(0x57F287)
        .setTimestamp();

      if (grantedRoles.length > 0) {
        embed.setDescription(`**NFT認証が完了しました！**\\n\\n以下のロールが付与されました:\\n\\n${grantedRoles.map(name => `• ${name}`).join('\\n')}\\n\\nサーバーでロールが表示されるまで少し時間がかかる場合があります。`);
      }

      if (failedRoles.length > 0) {
        embed.addFields({
          name: '⚠️ 付与できなかったロール',
          value: failedRoles.map(name => `• ${name}`).join('\\n'),
          inline: false
        });
      }

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

// 管理者統計情報（ミニマル版）
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
      .setColor(0x5865F2)
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
