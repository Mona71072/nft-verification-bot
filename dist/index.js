"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
exports.grantRoleToUser = grantRoleToUser;
exports.sendVerificationFailureMessage = sendVerificationFailureMessage;
exports.revokeRoleFromUser = revokeRoleFromUser;
const discord_js_1 = require("discord.js");
const config_1 = require("./config");
const api_server_1 = require("./api-server");
function unescapeText(text) {
    if (!text)
        return '';
    return text
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t');
}
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.GuildMembers
    ]
});
exports.client = client;
// Bot準備完了時
client.once(discord_js_1.Events.ClientReady, async (readyClient) => {
    if (!(0, config_1.validateConfig)()) {
        console.error('Configuration validation failed');
        return;
    }
    try {
        const guild = await client.guilds.fetch(config_1.config.DISCORD_GUILD_ID);
        const botMember = guild.members.cache.get(client.user.id);
        if (botMember) {
            const requiredPermissions = ['SendMessages', 'ManageRoles'];
            const missingPermissions = requiredPermissions.filter(perm => !botMember.permissions.has(perm));
            if (missingPermissions.length > 0) {
                console.error('Missing required permissions:', missingPermissions);
            }
        }
    }
    catch (error) {
        console.error('Error checking bot permissions:', error);
    }
    (0, api_server_1.startApiServer)();
    await setupVerificationChannel();
});
// チャンネルテンプレート取得
async function getChannelTemplates() {
    try {
        const response = await fetch(`${config_1.config.CLOUDFLARE_WORKERS_API_URL}/api/channel-templates`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data.success) {
            return data.data;
        }
        else {
            return data.fallback || getDefaultChannelTemplates();
        }
    }
    catch (error) {
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
        const guild = await client.guilds.fetch(config_1.config.DISCORD_GUILD_ID);
        if (!guild) {
            console.error('Guild not found');
            return;
        }
        const verificationChannel = await guild.channels.fetch(config_1.config.VERIFICATION_CHANNEL_ID);
        if (!verificationChannel) {
            console.error('Verification channel not found');
            return;
        }
        const botPermissions = verificationChannel.permissionsFor(client.user);
        if (botPermissions && !botPermissions.has('SendMessages')) {
            console.error('Bot cannot send messages in this channel');
            return;
        }
        // 既存のBotメッセージを削除
        try {
            const permissions = verificationChannel.permissionsFor(client.user);
            if (permissions?.has('ReadMessageHistory')) {
                const messages = await verificationChannel.messages.fetch({ limit: 50 });
                const botMessages = messages.filter(msg => msg.author.id === client.user.id);
                if (botMessages.size > 0 && permissions?.has('ManageMessages')) {
                    await verificationChannel.bulkDelete(botMessages);
                }
            }
        }
        catch (error) {
            // エラーが発生しても新しいメッセージを送信
        }
        const templates = await getChannelTemplates();
        const channelTemplate = templates.verificationChannel;
        const channelTitle = unescapeText(channelTemplate?.title);
        const channelDescription = unescapeText(channelTemplate?.description);
        const verificationEmbed = new discord_js_1.EmbedBuilder()
            .setTitle(channelTitle)
            .setDescription(channelDescription)
            .addFields({ name: '📋 Verification Steps', value: '1. Click the button\n2. Sign with your wallet\n3. NFT ownership check\n4. Role assignment', inline: false })
            .setColor(channelTemplate.color || 0x57F287)
            .setFooter({ text: 'NFT Verification Bot' })
            .setTimestamp();
        const verifyButton = new discord_js_1.ButtonBuilder()
            .setCustomId('verify_nft')
            .setLabel('Start NFT Verification')
            .setStyle(discord_js_1.ButtonStyle.Primary)
            .setEmoji('🎫');
        const actionRow = new discord_js_1.ActionRowBuilder()
            .addComponents(verifyButton);
        await verificationChannel.send({
            embeds: [verificationEmbed],
            components: [actionRow]
        });
    }
    catch (error) {
        console.error('Error setting up verification channel:', error);
    }
}
// ボタンインタラクション処理
client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
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
        }
        else {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'Unknown button interaction.',
                    flags: discord_js_1.MessageFlags.Ephemeral
                });
            }
        }
    }
    catch (error) {
        console.error('Error handling interaction:', error);
        if (error && typeof error === 'object' && 'code' in error) {
            const errorCode = error.code;
            if (errorCode === 10062 || errorCode === 40060) {
                return;
            }
        }
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'An error occurred while processing your request.',
                    flags: discord_js_1.MessageFlags.Ephemeral
                });
            }
        }
        catch (replyError) {
            console.error('Error sending error reply:', replyError);
        }
    }
});
// NFT認証処理
async function handleVerifyNFT(interaction) {
    try {
        if (!config_1.config.VERIFICATION_URL) {
            console.error('VERIFICATION_URL is not set');
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '設定エラー: VERIFICATION_URLが設定されていません。',
                    flags: discord_js_1.MessageFlags.Ephemeral
                });
            }
            return;
        }
        const templates = await getChannelTemplates();
        const startTemplate = templates.verificationStart;
        const startTitle = unescapeText(startTemplate?.title);
        const startDescription = unescapeText(startTemplate?.description);
        const baseUrl = templates.verificationUrl || config_1.config.VERIFICATION_URL;
        const verificationUrl = `${baseUrl}/Verification?discord_id=${interaction.user.id}`;
        const verifyEmbed = new discord_js_1.EmbedBuilder()
            .setTitle(startTitle)
            .setDescription(startDescription)
            .addFields({
            name: '🔗 Verification URL',
            value: `[Click to open verification page](${verificationUrl})`,
            inline: false
        }, {
            name: '📋 URL for Copy',
            value: `\`\`\`${verificationUrl}\`\`\``,
            inline: false
        })
            .setColor(startTemplate.color || 0x57F287)
            .setFooter({ text: 'NFT Verification Bot' })
            .setTimestamp();
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                embeds: [verifyEmbed],
                flags: discord_js_1.MessageFlags.Ephemeral,
                withResponse: true
            });
            // 5分後に自動削除
            setTimeout(async () => {
                try {
                    if (!interaction.replied) {
                        return;
                    }
                    await interaction.deleteReply();
                }
                catch (error) {
                    // メッセージが既に削除されている場合
                }
            }, 5 * 60 * 1000);
        }
    }
    catch (error) {
        console.error('Error in handleVerifyNFT:', error);
        if (error && typeof error === 'object' && 'code' in error) {
            const errorCode = error.code;
            if (errorCode === 10062 || errorCode === 40060) {
                return;
            }
        }
        throw error;
    }
}
// ロール付与関数
async function grantRoleToUser(discordId, collectionId, roleName, customMessage) {
    try {
        const guild = await client.guilds.fetch(config_1.config.DISCORD_GUILD_ID);
        if (!guild) {
            console.error('Guild not found');
            return false;
        }
        const member = await guild.members.fetch(discordId);
        if (!member) {
            console.error('Member not found:', discordId);
            return false;
        }
        let roleId = config_1.config.DISCORD_ROLE_ID;
        if (collectionId) {
            try {
                const collectionRoleId = await getRoleIdForCollection(collectionId);
                if (collectionRoleId) {
                    roleId = collectionRoleId;
                }
            }
            catch (error) {
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
                const successEmbed = new discord_js_1.EmbedBuilder()
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
                    }
                    catch (error) {
                        // メッセージが既に削除されている場合
                    }
                }, 5 * 60 * 1000);
            }
        }
        catch (dmError) {
            console.error('Could not send DM to user:', dmError);
        }
        return true;
    }
    catch (error) {
        console.error('Error granting role:', error);
        return false;
    }
}
// コレクション別ロールID取得関数
async function getRoleIdForCollection(collectionId) {
    try {
        const response = await fetch(`${config_1.config.CLOUDFLARE_WORKERS_API_URL}/api/collections`);
        const data = await response.json();
        if (data.success && data.data) {
            const collection = data.data.find((c) => c.id === collectionId);
            if (collection && collection.isActive) {
                return collection.roleId;
            }
        }
    }
    catch (error) {
        console.error('Error fetching collection config:', error);
    }
    return null;
}
// 認証失敗時のDiscordチャンネル通知
async function sendVerificationFailureMessage(discordId, verificationData) {
    try {
        const guild = await client.guilds.fetch(config_1.config.DISCORD_GUILD_ID);
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
        const dmSettingsResponse = await fetch(`${config_1.config.CLOUDFLARE_WORKERS_API_URL}/api/dm-settings`, {
            headers: {
                'User-Agent': 'Discord-Bot'
            }
        });
        let template = null;
        if (dmSettingsResponse.ok) {
            const dmSettingsData = await dmSettingsResponse.json();
            if (dmSettingsData.success && dmSettingsData.data && dmSettingsData.data.templates) {
                template = dmSettingsData.data.templates.failed;
            }
        }
        // テンプレートがない場合はcustom_messageを使用
        const cm = verificationData?.custom_message || {};
        if (template) {
            console.log('Failed template description BEFORE replace:', template.description);
            const description = template.description.replace(/\\n/g, '\n');
            console.log('Failed template description AFTER replace:', description);
            const failureEmbed = new discord_js_1.EmbedBuilder()
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
                }
                catch (error) {
                    // メッセージが既に削除されている場合
                }
            }, 5 * 60 * 1000);
            return true;
        }
        else if (cm.title && cm.description) {
            const description = cm.description.replace(/\\n/g, '\n');
            const failureEmbed = new discord_js_1.EmbedBuilder()
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
                }
                catch (error) {
                    // メッセージが既に削除されている場合
                }
            }, 5 * 60 * 1000);
            return true;
        }
        return false;
    }
    catch (error) {
        console.error('Error sending verification failure message:', error);
        return false;
    }
}
// ロール剥奪関数
async function revokeRoleFromUser(discordId, customMessage) {
    try {
        const guild = await client.guilds.fetch(config_1.config.DISCORD_GUILD_ID);
        const member = await guild.members.fetch(discordId);
        const role = await guild.roles.fetch(config_1.config.DISCORD_ROLE_ID);
        if (!role) {
            console.error('Role not found');
            return false;
        }
        await member.roles.remove(role);
        // ユーザーにDM送信
        try {
            // DM設定テンプレートを取得
            const dmSettingsResponse = await fetch(`${config_1.config.CLOUDFLARE_WORKERS_API_URL}/api/dm-settings`, {
                headers: {
                    'User-Agent': 'Discord-Bot'
                }
            });
            let template = null;
            if (dmSettingsResponse.ok) {
                const dmSettingsData = await dmSettingsResponse.json();
                if (dmSettingsData.success && dmSettingsData.data && dmSettingsData.data.templates) {
                    template = dmSettingsData.data.templates.revoked;
                }
            }
            if (template) {
                const roleName = role.name || 'NFT Holder';
                console.log('Revoked template description BEFORE replace:', template.description);
                const description = template.description
                    .replace(/{roles}/g, roleName)
                    .replace(/\\n/g, '\n');
                console.log('Revoked template description AFTER replace:', description);
                const revokeEmbed = new discord_js_1.EmbedBuilder()
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
                    }
                    catch (error) {
                        // メッセージが既に削除されている場合
                    }
                }, 5 * 60 * 1000);
            }
            else if (customMessage?.title && customMessage?.description) {
                const description = customMessage.description.replace(/\\n/g, '\n');
                const revokeEmbed = new discord_js_1.EmbedBuilder()
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
                    }
                    catch (error) {
                        // メッセージが既に削除されている場合
                    }
                }, 5 * 60 * 1000);
            }
        }
        catch (dmError) {
            console.error('Could not send DM to user:', dmError);
        }
        return true;
    }
    catch (error) {
        console.error('Error revoking role:', error);
        return false;
    }
}
// Botログイン
client.login(config_1.config.DISCORD_TOKEN).catch((error) => {
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
//# sourceMappingURL=index.js.map