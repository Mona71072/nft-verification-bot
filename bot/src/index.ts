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

function unescapeText(text: string | undefined): string {
  if (!text) return '';
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

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
  if (!validateConfig()) {
    console.error('Configuration validation failed');
    return;
  }
  
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const botMember = guild.members.cache.get(client.user!.id);
    
    if (botMember) {
      const requiredPermissions = ['SendMessages', 'ManageRoles'] as const;
      const missingPermissions = requiredPermissions.filter(perm => !botMember.permissions.has(perm as any));
      
      if (missingPermissions.length > 0) {
        console.error('Missing required permissions:', missingPermissions);
      }
    }
  } catch (error) {
    console.error('Error checking bot permissions:', error);
  }
  
  startApiServer();
  await setupVerificationChannel();
});

// チャンネルテンプレート取得
async function getChannelTemplates() {
  try {
    const response = await fetch(`${config.CLOUDFLARE_WORKERS_API_URL}/api/channel-templates`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json() as any;
    
    if (data.success) {
      return data.data;
    } else {
      return data.fallback || getDefaultChannelTemplates();
    }
  } catch (error) {
    console.error('Error fetching channel templates:', error);
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
      description: 'Starting verification...\n\n⚠️ **Note:** Wallet signatures are safe. We only verify NFT ownership and do not move any assets.\n\n',
      color: 0x57F287
    },
    verificationUrl: 'https://syndicatextokyo.app'
  };
}

// 認証チャンネルとメッセージのセットアップ
async function setupVerificationChannel() {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    if (!guild) {
      console.error('Guild not found');
      return;
    }

    const verificationChannel = await guild.channels.fetch(config.VERIFICATION_CHANNEL_ID) as TextChannel;
    
    if (!verificationChannel) {
      console.error('Verification channel not found');
      return;
    }

    const botPermissions = verificationChannel.permissionsFor(client.user!);
    if (botPermissions && !botPermissions.has('SendMessages')) {
      console.error('Bot cannot send messages in this channel');
      return;
    }

    // 既存のBotメッセージを削除
    try {
      const permissions = verificationChannel.permissionsFor(client.user!);
      if (permissions?.has('ReadMessageHistory')) {
        const messages = await verificationChannel.messages.fetch({ limit: 50 });
        const botMessages = messages.filter(msg => msg.author.id === client.user!.id);

        if (botMessages.size > 0 && permissions?.has('ManageMessages')) {
          await verificationChannel.bulkDelete(botMessages);
        }
      }
    } catch (error) {
      // エラーが発生しても新しいメッセージを送信
    }

    const templates = await getChannelTemplates();
    const channelTemplate = templates.verificationChannel;
    const channelTitle = unescapeText(channelTemplate?.title);
    const channelDescription = unescapeText(channelTemplate?.description);

    const verificationEmbed = new EmbedBuilder()
      .setTitle(channelTitle)
      .setDescription(channelDescription)
      .addFields(
        { name: '📋 Verification Steps', value: '1. Click the button\n2. Sign with your wallet\n3. NFT ownership check\n4. Role assignment', inline: false }
      )
      .setColor(channelTemplate.color || 0x57F287)
      .setFooter({ text: 'NFT Verification Bot' })
      .setTimestamp();

    const verifyButton = new ButtonBuilder()
      .setCustomId('verify_nft')
      .setLabel('Start NFT Verification')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎫');

    const actionRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(verifyButton);

    await verificationChannel.send({
      embeds: [verificationEmbed],
      components: [actionRow]
    });

  } catch (error) {
    console.error('Error setting up verification channel:', error);
  }
}

// ボタンインタラクション処理
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) {
    return;
  }

  const { customId, user } = interaction;

  try {
    if (interaction.replied || interaction.deferred) {
      return;
    }

    if (customId === 'verify_nft') {
      await handleVerifyNFT(interaction);
    } else {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'Unknown button interaction.',
          flags: MessageFlags.Ephemeral
        });
      }
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    
    if (error && typeof error === 'object' && 'code' in error) {
      const errorCode = (error as any).code;
      
      if (errorCode === 10062 || errorCode === 40060) {
        return;
      }
    }
    
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'An error occurred while processing your request.',
          flags: MessageFlags.Ephemeral
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
    if (!config.VERIFICATION_URL) {
      console.error('VERIFICATION_URL is not set');
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: '設定エラー: VERIFICATION_URLが設定されていません。',
          flags: MessageFlags.Ephemeral
        });
      }
      return;
    }
    
    const templates = await getChannelTemplates();
    const startTemplate = templates.verificationStart;
    const startTitle = unescapeText(startTemplate?.title);
    const startDescription = unescapeText(startTemplate?.description);
    
    const baseUrl = templates.verificationUrl || config.VERIFICATION_URL;
    const verificationUrl = `${baseUrl}/Verification?discord_id=${interaction.user.id}`;
    
    const verifyEmbed = new EmbedBuilder()
      .setTitle(startTitle)
      .setDescription(startDescription)
      .addFields(
        { 
          name: '🔗 Verification URL', 
          value: `[Click to open verification page](${verificationUrl})`, 
          inline: false 
        },
        {
          name: '📋 URL for Copy',
          value: `\`\`\`${verificationUrl}\`\`\``,
          inline: false
        }
      )
      .setColor(startTemplate.color || 0x57F287)
      .setFooter({ text: 'NFT Verification Bot' })
      .setTimestamp();

    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        embeds: [verifyEmbed],
        flags: MessageFlags.Ephemeral,
        withResponse: true
      });

      // 5分後に自動削除
      setTimeout(async () => {
        try {
          if (!interaction.replied) {
            return;
          }
          await interaction.deleteReply();
        } catch (error) {
          // メッセージが既に削除されている場合
        }
      }, 5 * 60 * 1000);
    }

  } catch (error) {
    console.error('Error in handleVerifyNFT:', error);
    
    if (error && typeof error === 'object' && 'code' in error) {
      const errorCode = (error as any).code;
      
      if (errorCode === 10062 || errorCode === 40060) {
        return;
      }
    }
    
    throw error;
  }
}

// ロール付与関数
export async function grantRoleToUser(discordId: string, collectionId?: string, roleName?: string, customMessage?: { title?: string; description?: string; color?: number }): Promise<boolean> {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    if (!guild) {
      console.error('Guild not found');
      return false;
    }

    const member = await guild.members.fetch(discordId);
    if (!member) {
      console.error('Member not found:', discordId);
      return false;
    }

    let roleId = config.DISCORD_ROLE_ID;
    
    if (collectionId) {
      try {
        const collectionRoleId = await getRoleIdForCollection(collectionId);
        if (collectionRoleId) {
          roleId = collectionRoleId;
        }
      } catch (error) {
        console.error('Error fetching collection role ID:', error);
      }
    }

    const role = await guild.roles.fetch(roleId);
    if (!role) {
      console.error('Role not found');
      return false;
    }

    const hasRole = member.roles.cache.has(roleId);
    
    if (!hasRole) {
      await member.roles.add(role);
    }

    // ユーザーにDM送信
    try {
      if (customMessage?.title && customMessage?.description) {
        const successEmbed = new EmbedBuilder()
          .setTitle(customMessage.title)
          .setDescription(customMessage.description)
          .setColor(customMessage.color ?? 0x57F287)
          .setTimestamp();

        const message = await member.send({
          embeds: [successEmbed]
        });

        // 5分後にメッセージを自動削除
        setTimeout(async () => {
          try {
            await message.delete();
          } catch (error) {
            // メッセージが既に削除されている場合
          }
        }, 5 * 60 * 1000);
      }
    } catch (dmError) {
      console.error('Could not send DM to user:', dmError);
    }

    return true;
  } catch (error) {
    console.error('Error granting role:', error);
    return false;
  }
}

// コレクション別ロールID取得関数
async function getRoleIdForCollection(collectionId: string): Promise<string | null> {
  try {
    const response = await fetch(`${config.CLOUDFLARE_WORKERS_API_URL}/api/collections`);
    const data = await response.json() as any;
    
    if (data.success && data.data) {
      const collection = data.data.find((c: any) => c.id === collectionId);
      if (collection && collection.isActive) {
        return collection.roleId;
      }
    }
  } catch (error) {
    console.error('Error fetching collection config:', error);
  }
  return null;
}

// 認証失敗時のDiscordチャンネル通知
export async function sendVerificationFailureMessage(discordId: string, verificationData: any): Promise<boolean> {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    if (!guild) {
      console.error('Guild not found');
      return false;
    }

    const user = await client.users.fetch(discordId);
    if (!user) {
      console.error('User not found');
      return false;
    }

    // DM設定テンプレートを取得
    const dmSettingsResponse = await fetch(`${config.CLOUDFLARE_WORKERS_API_URL}/api/dm-settings`, {
      headers: {
        'User-Agent': 'Discord-Bot'
      }
    });

    let template = null;
    if (dmSettingsResponse.ok) {
      const dmSettingsData = await dmSettingsResponse.json() as any;
      if (dmSettingsData.success && dmSettingsData.data && dmSettingsData.data.templates) {
        template = dmSettingsData.data.templates.failed;
      }
    }

    // テンプレートがない場合はcustom_messageを使用
    const cm = verificationData?.custom_message || {};
    
    if (template) {
      const description = template.description.replace(/\\n/g, '\n');
      
      const failureEmbed = new EmbedBuilder()
        .setTitle(template.title)
        .setDescription(description)
        .setColor(template.color ?? 0xED4245)
        .setTimestamp();

      const message = await user.send({
        embeds: [failureEmbed]
      });

      // 5分後にメッセージを自動削除
      setTimeout(async () => {
        try {
          await message.delete();
        } catch (error) {
          // メッセージが既に削除されている場合
        }
      }, 5 * 60 * 1000);

      return true;
    } else if (cm.title && cm.description) {
      const description = cm.description.replace(/\\n/g, '\n');
      
      const failureEmbed = new EmbedBuilder()
        .setTitle(cm.title)
        .setDescription(description)
        .setColor(cm.color ?? 0xED4245)
        .setTimestamp();

      const message = await user.send({
        embeds: [failureEmbed]
      });

      // 5分後にメッセージを自動削除
      setTimeout(async () => {
        try {
          await message.delete();
        } catch (error) {
          // メッセージが既に削除されている場合
        }
      }, 5 * 60 * 1000);

      return true;
    }
    return false;
  } catch (error) {
    console.error('Error sending verification failure message:', error);
    return false;
  }
}

// ロール剥奪関数
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

    // ユーザーにDM送信
    try {
      // DM設定テンプレートを取得
      const dmSettingsResponse = await fetch(`${config.CLOUDFLARE_WORKERS_API_URL}/api/dm-settings`, {
        headers: {
          'User-Agent': 'Discord-Bot'
        }
      });

      let template = null;
      if (dmSettingsResponse.ok) {
        const dmSettingsData = await dmSettingsResponse.json() as any;
        if (dmSettingsData.success && dmSettingsData.data && dmSettingsData.data.templates) {
          template = dmSettingsData.data.templates.revoked;
        }
      }

      if (template) {
        const description = template.description.replace(/\\n/g, '\n');
        
        const revokeEmbed = new EmbedBuilder()
          .setTitle(template.title)
          .setDescription(description)
          .setColor(template.color ?? 0xFFA500)
          .setTimestamp();

        const message = await member.send({
          embeds: [revokeEmbed]
        });

        // 5分後にメッセージを自動削除
        setTimeout(async () => {
          try {
            await message.delete();
          } catch (error) {
            // メッセージが既に削除されている場合
          }
        }, 5 * 60 * 1000);
      } else if (customMessage?.title && customMessage?.description) {
        const description = customMessage.description.replace(/\\n/g, '\n');
        
        const revokeEmbed = new EmbedBuilder()
          .setTitle(customMessage.title)
          .setDescription(description)
          .setColor(customMessage.color ?? 0xED4245)
          .setTimestamp();

        const message = await member.send({
          embeds: [revokeEmbed]
        });

        // 5分後にメッセージを自動削除
        setTimeout(async () => {
          try {
            await message.delete();
          } catch (error) {
            // メッセージが既に削除されている場合
          }
        }, 5 * 60 * 1000);
      }
    } catch (dmError) {
      console.error('Could not send DM to user:', dmError);
    }

    return true;
  } catch (error) {
    console.error('Error revoking role:', error);
    return false;
  }
}

// Botログイン
client.login(config.DISCORD_TOKEN).catch((error) => {
  console.error('Failed to login:', error);
  process.exit(1);
});

// エラーハンドリング
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

console.log('Discord Bot starting...');

export { client };