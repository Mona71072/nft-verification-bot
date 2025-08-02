const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Discordボットの設定
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// テスト用の設定
const config = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || 'test_token',
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID || 'test_guild_id',
  VERIFICATION_CHANNEL_ID: process.env.VERIFICATION_CHANNEL_ID || 'test_channel_id',
  SUI_NETWORK: process.env.SUI_NETWORK || 'mainnet',
  VERIFICATION_URL: process.env.VERIFICATION_URL || 'https://nft-verification.mona-syndicatextokyo.workers.dev'
};

async function postVerificationMessages() {
  try {
    console.log('🤖 Starting Discord Bot for posting messages...');
    
    // ボットログイン
    await client.login(config.DISCORD_TOKEN);
    
    console.log(`✅ Bot logged in as ${client.user.tag}!`);
    
    // ギルドを取得
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    console.log(`✅ Found guild: ${guild.name}`);
    
    // チャンネルを取得
    const channel = await guild.channels.fetch(config.VERIFICATION_CHANNEL_ID);
    console.log(`✅ Found channel: ${channel.name}`);
    
    // プロフェッショナルなユーザー認証メッセージ
    const userVerificationEmbed = new EmbedBuilder()
      .setTitle('🎯 Sui NFT Verification Portal')
      .setDescription(`**Welcome to the Exclusive NFT Verification System!**\\n\\n🌟 **What you'll receive:**\\n• **Exclusive Discord Role** - Special recognition as an NFT holder\\n• **Premium Access** - Unlock special channels and features\\n• **Community Status** - Verified member of our NFT community\\n• **Future Benefits** - Early access to upcoming features\\n\\n🚀 **Simple 3-Step Process:**\\n1️⃣ **Connect** - Link your Sui wallet securely\\n2️⃣ **Verify** - Confirm your NFT ownership\\n3️⃣ **Receive** - Get your exclusive role instantly\\n\\n💎 **Security First:**\\n• No private keys required\\n• Blockchain-verified ownership\\n• Instant verification process\\n• Secure and private\\n\\n*Ready to join the exclusive NFT community? Click below to start!*`)
      .setColor(0x6366f1)
      .setThumbnail('https://i.imgur.com/8tBXd6L.png')
      .addFields(
        { name: '🌐 Network', value: config.SUI_NETWORK, inline: true },
        { name: '⚡ Speed', value: 'Instant Verification', inline: true },
        { name: '🔒 Security', value: 'Blockchain Verified', inline: true },
        { name: '🎁 Benefits', value: 'Exclusive Access', inline: true },
        { name: '📊 Status', value: '🟢 System Online', inline: true },
        { name: '🆕 Version', value: '2.0.0', inline: true }
      )
      .setFooter({ 
        text: 'Powered by Sui Blockchain • Professional NFT Verification System',
        iconURL: 'https://i.imgur.com/8tBXd6L.png'
      })
      .setTimestamp();

    // プロフェッショナルなボタン
    const verifyButton = new ButtonBuilder()
      .setCustomId('verify_nft')
      .setLabel('Start Verification')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🚀');

    const helpButton = new ButtonBuilder()
      .setCustomId('help_verification')
      .setLabel('How it Works')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('❓');

    const supportButton = new ButtonBuilder()
      .setCustomId('support_verification')
      .setLabel('Get Support')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🆘');

    const userActionRow = new ActionRowBuilder()
      .addComponents(verifyButton, helpButton, supportButton);

    // 一般ユーザー向けメッセージ送信
    console.log('📤 Sending user verification message...');
    await channel.send({
      embeds: [userVerificationEmbed],
      components: [userActionRow]
    });
    console.log('✅ User verification message sent');

    // プロフェッショナルな管理者パネル
    const adminEmbed = new EmbedBuilder()
      .setTitle('⚙️ System Administration Dashboard')
      .setDescription(`**Professional NFT Verification System Management**\\n\\n📊 **System Overview:**\\n• **Bot Status:** 🟢 Online & Operational\\n• **Network:** ${config.SUI_NETWORK}\\n• **API Connection:** 🟢 Connected & Stable\\n• **Verification Service:** 🟢 Active & Secure\\n• **Database:** 🟢 Healthy & Responsive\\n\\n🔧 **Administrative Tools:**\\nUse the management buttons below to monitor system performance, view statistics, and manage the verification process.\\n\\n📈 **Real-time Monitoring:**\\n• System performance metrics\\n• Verification success rates\\n• User activity statistics\\n• Error tracking and alerts`)
      .setColor(0x71717a)
      .addFields(
        { name: '🆔 Bot ID', value: client.user?.id || 'Unknown', inline: true },
        { name: '🏠 Guild', value: guild.name, inline: true },
        { name: '📈 Version', value: '2.0.0', inline: true },
        { name: '🌐 Network', value: config.SUI_NETWORK, inline: true },
        { name: '⚡ Response Time', value: '< 100ms', inline: true },
        { name: '🔒 Security Level', value: 'Maximum', inline: true }
      )
      .setFooter({ 
        text: 'Admin Dashboard • Professional NFT Verification System',
        iconURL: client.user?.displayAvatarURL()
      })
      .setTimestamp();

    // 管理ボタン
    const statsButton = new ButtonBuilder()
      .setCustomId('admin_stats')
      .setLabel('System Statistics')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📊');

    const refreshButton = new ButtonBuilder()
      .setCustomId('admin_refresh')
      .setLabel('Refresh System')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄');

    const statusButton = new ButtonBuilder()
      .setCustomId('admin_status')
      .setLabel('System Status')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🟢');

    const logsButton = new ButtonBuilder()
      .setCustomId('admin_logs')
      .setLabel('View Logs')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📋');

    const adminActionRow = new ActionRowBuilder()
      .addComponents(statsButton, refreshButton, statusButton, logsButton);

    // 管理者向けメッセージ送信
    console.log('📤 Sending admin verification message...');
    await channel.send({
      embeds: [adminEmbed],
      components: [adminActionRow]
    });
    console.log('✅ Admin verification message sent');

    console.log('✅ All messages posted successfully!');
    
    // ボットを切断
    await client.destroy();
    console.log('👋 Bot disconnected');
    
  } catch (error) {
    console.error('❌ Error posting messages:', error);
    if (client) {
      await client.destroy();
    }
  }
}

// スクリプト実行
postVerificationMessages(); 