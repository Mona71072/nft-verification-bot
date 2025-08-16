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
  
  // APIサーバーを開始
  console.log('🚀 Starting API server...');
  const apiApp = startApiServer();
  
  // Discordクライアントを設定
  if (apiApp.setDiscordClient) {
    apiApp.setDiscordClient(readyClient);
    console.log('✅ Discord client attached to API server');
  }
  
  // 認証チャンネルの設定を確認
  await setupVerificationChannel();
});

// 認証チャンネルの設定
async function setupVerificationChannel() {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const channel = await guild.channels.fetch(config.VERIFICATION_CHANNEL_ID) as TextChannel;
    
    if (!channel) {
      console.error('❌ Verification channel not found');
      return;
    }
    
    console.log(`✅ Verification channel found: ${channel.name}`);
    
    // チャンネルのメッセージをクリア
    const messages = await channel.messages.fetch({ limit: 100 });
    if (messages.size > 0) {
      await channel.bulkDelete(messages);
      console.log('🧹 Cleared verification channel messages');
    }
    
    // 認証メッセージを送信
    const embed = new EmbedBuilder()
      .setTitle('🎫 NFT認証システム')
      .setDescription('SuiネットワークのNFTを保有しているユーザーにロールを付与します。\n\n下のボタンをクリックして認証を開始してください。')
      .setColor(0x57F287)
      .addFields(
        { name: '📋 認証手順', value: '1. ボタンをクリック\n2. ウォレットで署名\n3. NFT保有確認\n4. ロール付与', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'NFT Verification Bot' });
    
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('verify_nft')
          .setLabel('NFT認証を開始')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🎫')
      );
    
    await channel.send({ embeds: [embed], components: [row] });
    console.log('✅ Verification message sent to channel');
    
  } catch (error) {
    console.error('❌ Error setting up verification channel:', error);
  }
}

// ボタンインタラクション処理
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  
  if (interaction.customId === 'verify_nft') {
    await handleVerifyNFT(interaction);
  }
});

// NFT認証処理
async function handleVerifyNFT(interaction: ButtonInteraction) {
  try {
    console.log(`🔍 NFT verification requested by ${interaction.user.tag} (${interaction.user.id})`);
    
    // ユーザーIDを含むパーソナライズされた認証URLを生成
    const baseUrl = config.VERIFICATION_URL.replace(/\/$/, ''); // 末尾のスラッシュを削除
    const personalizedUrl = `${baseUrl}?user_id=${interaction.user.id}`;
    
    const embed = new EmbedBuilder()
      .setTitle('🎫 NFT認証')
      .setDescription('認証を開始します。')
      .setColor(0x57F287)
      .addFields(
        { name: '🔗 認証URL', value: personalizedUrl, inline: false },
        { name: '⚠️ 注意', value: 'ウォレットの署名は安全です。NFTの所有権のみを確認し、資産の移動は行われません。', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'NFT Verification Bot' });
    
    await interaction.reply({ embeds: [embed], ephemeral: true });
    
  } catch (error) {
    console.error('❌ Error handling NFT verification:', error);
    await interaction.reply({ 
      content: '❌ 認証処理中にエラーが発生しました。しばらく時間をおいて再度お試しください。', 
      ephemeral: true 
    });
  }
}

// Discord Bot APIエンドポイント（Cloudflare Workersから呼び出される）
export async function grantRoleToUser(discordId: string, options?: { disableChannelPost?: boolean, notifyUser?: boolean, customMessage?: string }): Promise<boolean> {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(discordId);
    const role = await guild.roles.fetch(config.DISCORD_ROLE_ID);
    
    if (!role) {
      console.error('❌ Role not found');
      return false;
    }
    
    await member.roles.add(role);
    console.log(`✅ Role "${role.name}" granted to user ${discordId}`);
    
    // ユーザーにDM送信
    if (options?.notifyUser !== false) {
      try {
        if (options?.customMessage) {
          await member.send({ content: options.customMessage });
        } else {
          await member.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('認証完了')
                .setDescription(`NFT認証が完了しました。\n\nロール "${role.name}" が付与されました。\n\nサーバーでロールが表示されるまで少し時間がかかる場合があります。`)
                .setColor(0x57F287)
                .setTimestamp()
            ]
          });
        }
      } catch (dmError) {
        console.log('Could not send DM to user:', dmError);
      }
    }
    
    // チャンネル投稿（disableChannelPostがfalseの場合のみ）
    if (!options?.disableChannelPost) {
      try {
        const channel = await guild.channels.fetch(config.VERIFICATION_CHANNEL_ID) as TextChannel;
        if (channel) {
          await channel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('🎉 認証完了')
                .setDescription(`<@${discordId}> のNFT認証が完了しました！`)
                .setColor(0x57F287)
                .setTimestamp()
            ]
          });
        }
      } catch (channelError) {
        console.log('Could not send channel message:', channelError);
      }
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error granting role:', error);
    return false;
  }
}

// ロール剥奪関数
export async function revokeRoleFromUser(discordId: string, options?: { disableChannelPost?: boolean, notifyUser?: boolean, customMessage?: string }): Promise<boolean> {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(discordId);
    const role = await guild.roles.fetch(config.DISCORD_ROLE_ID);

    if (!role) {
      console.error('❌ Role not found');
      return false;
    }

    await member.roles.remove(role);
    console.log(`✅ Role revoked from user ${discordId}`);

    // ユーザーにDM送信
    if (options?.notifyUser !== false) {
      try {
        if (options?.customMessage) {
          await member.send({ content: options.customMessage });
        } else {
          await member.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('ロール更新通知')
                .setDescription(`NFTの保有が確認できなくなったため、ロール "${role.name}" が削除されました。\n再度NFTを取得された場合は、認証チャンネルから再認証を行ってください。`)
                .setColor(0xED4245)
                .setTimestamp()
            ]
          });
        }
      } catch (dmError) {
        console.log('Could not send DM to user:', dmError);
      }
    }

    // チャンネル投稿（disableChannelPostがfalseの場合のみ）
    if (!options?.disableChannelPost) {
      try {
        const channel = await guild.channels.fetch(config.VERIFICATION_CHANNEL_ID) as TextChannel;
        if (channel) {
          await channel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('⚠️ ロール削除')
                .setDescription(`<@${discordId}> のNFT保有が確認できなくなったため、ロールが削除されました。`)
                .setColor(0xED4245)
                .setTimestamp()
            ]
          });
        }
      } catch (channelError) {
        console.log('Could not send channel message:', channelError);
      }
    }

    return true;
  } catch (error) {
    console.error('❌ Error revoking role:', error);
    return false;
  }
}

// 認証済みユーザーかどうかをチェックする関数
async function isVerifiedUser(discordId: string): Promise<boolean> {
  try {
    console.log(`🔍 Starting verification check for Discord ID: ${discordId}`);
    const apiUrl = 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';
    console.log(`🔗 API URL: ${apiUrl}/api/admin/verified-users`);
    
    // KVストアから認証済みユーザー一覧を取得
    const verifiedUsersResponse = await fetch(`${apiUrl}/api/admin/verified-users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📡 Response status: ${verifiedUsersResponse.status} ${verifiedUsersResponse.statusText}`);
    
    if (verifiedUsersResponse.ok) {
      const result = await verifiedUsersResponse.json() as any;
      console.log(`📋 API Response:`, JSON.stringify(result, null, 2));
      
      if (result.success && result.data) {
        console.log(`📊 Found ${result.data.length} verified users in KV store`);
        console.log(`👥 Verified users:`, result.data.map((user: any) => `${user.discordId} (${user.address})`));
        
        // 指定されたDiscord IDが認証済みユーザーリストに存在するかチェック
        const isVerified = result.data.some((user: any) => user.discordId === discordId);
        console.log(`✅ Verification result for ${discordId}: ${isVerified}`);
        return isVerified;
      } else {
        console.log(`❌ API response not successful or no data`);
      }
    } else {
      const errorText = await verifiedUsersResponse.text();
      console.log(`❌ API error response: ${errorText}`);
    }
    
    console.log(`⚠️ Could not fetch verified users from KV store`);
    return false;
  } catch (error) {
    console.error('❌ Error checking verified user status:', error);
    return false;
  }
}

// 複数ロール付与関数（APIから呼び出される）
export async function grantMultipleRolesToUser(
  discordId: string,
  roles: Array<{ roleId: string; roleName: string }>,
  options?: { notifyUser?: boolean; disableChannelPost?: boolean, customMessage?: string }
): Promise<boolean> {
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
          grantedRoles.push(roleData);
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

    // ユーザーにDM送信（オプション）
    const shouldNotify = options?.notifyUser !== false;
    if (shouldNotify) {
      try {
        if (options?.customMessage) {
          await member.send({ content: options.customMessage });
        } else {
          const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTimestamp()
            .setFooter({ text: 'NFT Verification Bot' });

          let title = '認証完了';
          let description = '';
          
          // 認証済みユーザーかどうかをチェック
          console.log(`🔍 Checking if user ${discordId} is already verified...`);
          const isVerified = await isVerifiedUser(discordId);
          console.log(`📋 Verification check result for ${discordId}: ${isVerified}`);
          
          if (grantedRoles.length > 0) {
            if (isVerified) {
              console.log(`🔄 User ${discordId} is already verified, sending update message`);
              title = '認証更新完了';
              embed.setColor(0x57F287);
              description = `NFT認証の更新が完了しました。\n\n以下のコレクションでNFTが確認されました:\n\n${grantedRoles.map(role => `• ${role.roleName}`).join('\n')}\n\n対応するロールが更新されました。サーバーでロールが表示されるまで少し時間がかかる場合があります。`;
            } else {
              console.log(`🆕 User ${discordId} is new, sending completion message`);
              title = '認証完了';
              embed.setColor(0x57F287);
              description = `NFT認証が完了しました。\n\n以下のコレクションでNFTが確認されました:\n\n${grantedRoles.map(role => `• ${role.roleName}`).join('\n')}\n\n対応するロールが付与されました。サーバーでロールが表示されるまで少し時間がかかる場合があります。`;
            }
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
        }
      } catch (dmError) {
        console.log('Could not send DM to user:', dmError);
      }
    }

    // チャンネル投稿（disableChannelPostがfalseの場合のみ）
    if (!options?.disableChannelPost) {
      try {
        const channel = await guild.channels.fetch(config.VERIFICATION_CHANNEL_ID) as TextChannel;
        if (channel && grantedRoles.length > 0) {
          await channel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('🎉 認証完了')
                .setDescription(`<@${discordId}> のNFT認証が完了しました！\n\n付与されたロール: ${grantedRoles.map(role => role.roleName).join(', ')}`)
                .setColor(0x57F287)
                .setTimestamp()
            ]
          });
        }
      } catch (channelError) {
        console.log('Could not send channel message:', channelError);
      }
    }

    return grantedRoles.length > 0;
  } catch (error) {
    console.error('❌ Error granting multiple roles:', error);
    return false;
  }
}

// 複数ロール剥奪関数
export async function revokeMultipleRolesFromUser(
  discordId: string, 
  roles: Array<{roleId: string, roleName: string}>,
  options?: { disableChannelPost?: boolean, notifyUser?: boolean, customMessage?: string }
): Promise<boolean> {
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

    if (revokedRoles.length > 0 && options?.notifyUser !== false) {
      try {
        if (options?.customMessage) {
          await member.send({ content: options.customMessage });
        } else {
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
        }
      } catch (dmError) {
        console.log('Could not send DM to user:', dmError);
      }
    }

    // チャンネル投稿（disableChannelPostがfalseの場合のみ）
    if (!options?.disableChannelPost && revokedRoles.length > 0) {
      try {
        const channel = await guild.channels.fetch(config.VERIFICATION_CHANNEL_ID) as TextChannel;
        if (channel) {
          await channel.send({
            embeds: [
              new EmbedBuilder()
                .setTitle('⚠️ ロール削除')
                .setDescription(`<@${discordId}> のNFT保有が確認できなくなったため、以下のロールが削除されました:\n\n${revokedRoles.map(role => `• ${role.roleName}`).join('\n')}`)
                .setColor(0xED4245)
                .setTimestamp()
            ]
          });
        }
      } catch (channelError) {
        console.log('Could not send channel message:', channelError);
      }
    }

    return revokedRoles.length > 0;
  } catch (error) {
    console.error('❌ Error revoking multiple roles:', error);
    return false;
  }
}

// バッチ処理結果通知関数
export async function sendBatchProcessNotification(discordId: string, batchData: any, options?: { disableChannelPost?: boolean }): Promise<boolean> {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(discordId);

    try {
      const embed = new EmbedBuilder()
        .setTitle('バッチ処理完了通知')
        .setColor(0x57F287)
        .setTimestamp()
        .setFooter({ text: 'NFT Verification Bot' });

      const { summary } = batchData;
      let description = 'バッチ処理が完了しました。\n\n';
      description += `📊 **処理結果:**\n`;
      description += `• 総ユーザー数: ${summary.totalUsers}\n`;
      description += `• 処理済み: ${summary.processed}\n`;
      description += `• ロール剥奪: ${summary.revoked}\n`;
      description += `• エラー: ${summary.errors}\n`;

      if (summary.revoked > 0) {
        description += `\n⚠️ ${summary.revoked}人のユーザーからロールが剥奪されました。`;
      }

      embed.setDescription(description);
      await member.send({ embeds: [embed] });
      return true;
    } catch (dmError) {
      console.log('Could not send DM to user:', dmError);
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending batch process notification:', error);
    return false;
  }
}

// 認証失敗時のDM送信関数
export async function sendVerificationFailedMessage(discordId: string, verificationData?: any, options?: { disableChannelPost?: boolean, notifyUser?: boolean, customMessage?: string }): Promise<boolean> {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(discordId);

    try {
      if (options?.notifyUser === false) return true;
      if (options?.customMessage) {
        await member.send({ content: options.customMessage });
        return true;
      }
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTimestamp()
        .setFooter({ text: 'NFT Verification Bot' });

      let title = '認証失敗';
      let description = '';
      
      if (verificationData && verificationData.verificationResults) {
        const results = verificationData.verificationResults;
        const successful = results.filter((r: any) => r.hasNft);
        const failed = results.filter((r: any) => !r.hasNft);

        if (successful.length > 0 && failed.length === 0) {
          // 認証済みユーザーかどうかをチェック
          const isVerified = await isVerifiedUser(discordId);
          
          if (isVerified) {
            title = '認証更新完了';
            embed.setColor(0x57F287);
            description = `NFT認証の更新が完了しました。\n\n以下のコレクションでNFTが確認されました:\n\n${successful.map((result: any) => `• ${result.collectionName}`).join('\n')}\n\n対応するロールが更新されました。サーバーでロールが表示されるまで少し時間がかかる場合があります。`;
          } else {
            title = '認証完了';
            embed.setColor(0x57F287);
            description = `NFT認証が完了しました。\n\n以下のコレクションでNFTが確認されました:\n\n${successful.map((result: any) => `• ${result.collectionName}`).join('\n')}\n\n対応するロールが付与されました。サーバーでロールが表示されるまで少し時間がかかる場合があります。`;
          }
        } else if (successful.length > 0 && failed.length > 0) {
          title = '部分的な認証完了';
          embed.setColor(0xFAA61A);
          description = `一部のコレクションでのみNFTが確認されました。\n\n✅ **認証成功:**\n${successful.map((result: any) => `• ${result.collectionName}`).join('\n')}\n\n❌ **認証失敗:**\n${failed.map((result: any) => `• ${result.collectionName}`).join('\n')}`;
        } else {
          title = '認証失敗';
          embed.setColor(0xED4245);
          description = `選択されたコレクションでNFTが見つかりませんでした。\n\n以下のコレクションを確認しました:\n${failed.map((result: any) => `• ${result.collectionName}`).join('\n')}\n\nNFTを保有していることを確認してから再度お試しください。`;
        }
      } else {
        description = verificationData?.reason || 'NFT認証に失敗しました。再度お試しください。';
      }

      embed.setTitle(title).setDescription(description);
      await member.send({ embeds: [embed] });
      return true;
    } catch (dmError) {
      console.log('Could not send DM to user:', dmError);
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending verification failed message:', error);
    return false;
  }
}

// Discordロール一覧取得API
export async function getDiscordRoles(): Promise<Array<{id: string, name: string}>> {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const roles = await guild.roles.fetch();
    
    return roles.map(role => ({
      id: role.id,
      name: role.name
    }));
  } catch (error) {
    console.error('❌ Error getting Discord roles:', error);
    return [];
  }
}

// Botログイン
client.login(config.DISCORD_TOKEN);

export default client;