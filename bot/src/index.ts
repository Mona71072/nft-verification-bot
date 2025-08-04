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
