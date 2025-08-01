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
import { config } from './config';
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
  
  // 無料プラン用の最適化
  console.log('🚀 Bot optimized for free tier deployment');
  console.log('📊 Memory usage:', process.memoryUsage());
  
  // Botの権限を確認
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const botMember = guild.members.cache.get(client.user!.id);
    if (botMember) {
      console.log('🔐 Bot permissions:', botMember.permissions.toArray());
      console.log('🔐 Bot roles:', botMember.roles.cache.map(r => r.name).join(', '));
    }
  } catch (error) {
    console.error('❌ Error checking bot permissions:', error);
  }
  
  // APIサーバー起動
  startApiServer();
  
  // 認証チャンネルをセットアップ
  await setupVerificationChannel();
});

// 認証チャンネルとメッセージのセットアップ
async function setupVerificationChannel() {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    if (!guild) {
      console.error('Guild not found');
      return;
    }

    // 手動作成されたチャンネルを取得
    const verificationChannel = await guild.channels.fetch(config.VERIFICATION_CHANNEL_ID) as TextChannel;
    
    if (!verificationChannel) {
      console.error('Verification channel not found. Please create a channel with ID:', config.VERIFICATION_CHANNEL_ID);
      return;
    }

    console.log(`✅ Found verification channel: ${verificationChannel.name}`);

    // 既存のBotメッセージをチェック
    const messages = await verificationChannel.messages.fetch({ limit: 50 });
    const botMessages = messages.filter(msg => 
      msg.author.id === client.user!.id && 
      msg.embeds.length > 0 &&
      (msg.embeds[0].title?.includes('NFT認証') || msg.embeds[0].title?.includes('管理者'))
    );

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
    await verificationChannel.send({
      embeds: [userVerificationEmbed],
      components: [userActionRow]
    });

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
    await verificationChannel.send({
      embeds: [adminEmbed],
      components: [adminActionRow]
    });

    console.log('✅ User and Admin verification messages posted successfully');

  } catch (error) {
    console.error('Error setting up verification channel:', error);
  }
}

// ボタンインタラクション処理
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  const { customId, user, member } = interaction;
  const isAdmin = user.id === config.ADMIN_USER_ID;

  try {
    // 一般ユーザー向けボタン
    if (customId === 'verify_nft') {
      await handleVerifyNFT(interaction);
    }
    // 管理者向けボタン
    else if (customId === 'admin_stats') {
      await handleAdminStats(interaction, isAdmin);
    } else if (customId === 'admin_refresh') {
      await handleAdminRefresh(interaction, isAdmin);
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    
    if (!interaction.replied) {
      await interaction.reply({
        content: '❌ エラーが発生しました。しばらく待ってから再試行してください。',
        ephemeral: true
      });
    }
  }
});

// NFT認証処理（ミニマル版）
async function handleVerifyNFT(interaction: ButtonInteraction) {
  const verificationUrl = `${config.VERIFICATION_URL}?discord_id=${interaction.user.id}`;

  const verifyEmbed = new EmbedBuilder()
    .setTitle('🔗 認証')
    .setDescription(`[認証ページを開く](${verificationUrl})\\n\\n5分で自動削除されます`)
    .setColor(0x6366f1);

  const reply = await interaction.reply({
    embeds: [verifyEmbed],
    ephemeral: true,
    fetchReply: true
  });

  // 5分後に自動削除
  setTimeout(async () => {
    try {
      await interaction.deleteReply();
      console.log(`✅ Auto-deleted verification message for user ${interaction.user.id}`);
    } catch (error) {
      console.log('Message already deleted or expired');
    }
  }, 5 * 60 * 1000);
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
  if (!isAdmin) {
    await interaction.reply({ content: '❌ 管理者限定', ephemeral: true });
    return;
  }

  const statsEmbed = new EmbedBuilder()
    .setTitle('📊 統計')
    .setDescription(`**API:** 🟢 正常\\n**更新:** ${new Date().toLocaleString('ja-JP')}`)
    .setColor(0x22c55e);

  await interaction.reply({ embeds: [statsEmbed], ephemeral: true });
}



// 管理者リフレッシュ（ミニマル版）
async function handleAdminRefresh(interaction: ButtonInteraction, isAdmin: boolean) {
  if (!isAdmin) {
    await interaction.reply({ content: '❌ 管理者限定', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const healthCheck = await fetch(`${config.API_BASE_URL}/`).catch(() => null);
    const apiStatus = healthCheck?.ok ? '🟢' : '🔴';
    const uptime = Math.floor(process.uptime() / 60);

    const refreshEmbed = new EmbedBuilder()
      .setTitle('🔄 状態')
      .setDescription(`**API:** ${apiStatus}\\n**稼働:** ${uptime}分\\n**更新:** ${new Date().toLocaleTimeString('ja-JP')}`)
      .setColor(0x6366f1);

    await interaction.editReply({ embeds: [refreshEmbed] });
  } catch (error) {
    await interaction.editReply({ content: '❌ 更新失敗' });
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

// Bot起動
client.login(config.DISCORD_TOKEN);

console.log('🤖 Discord Bot starting...');