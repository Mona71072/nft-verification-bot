"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.client = void 0;
exports.grantRoleToUser = grantRoleToUser;
exports.sendVerificationFailureMessage = sendVerificationFailureMessage;
exports.revokeRoleFromUser = revokeRoleFromUser;
const discord_js_1 = require("discord.js");
const config_1 = require("./config");
const api_server_1 = require("./api-server");
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
    console.log(`✅ Bot logged in as ${readyClient.user.tag}!`);
    console.log(`🆔 Bot ID: ${readyClient.user.id}`);
    // 設定のバリデーション
    console.log('🔍 Validating configuration...');
    if (!(0, config_1.validateConfig)()) {
        console.error('❌ Configuration validation failed. Bot will not function properly.');
        return;
    }
    // 設定情報をログ出力
    console.log('📋 Configuration summary:');
    console.log(`  - Guild ID: ${config_1.config.DISCORD_GUILD_ID}`);
    console.log(`  - Role ID: ${config_1.config.DISCORD_ROLE_ID}`);
    console.log(`  - Channel ID: ${config_1.config.VERIFICATION_CHANNEL_ID}`);
    console.log(`  - Verification URL: ${config_1.config.VERIFICATION_URL}`);
    console.log(`  - Admin User ID: ${config_1.config.ADMIN_USER_ID}`);
    console.log(`  - Sui Network: ${config_1.config.SUI_NETWORK}`);
    // 無料プラン用の最適化
    console.log('🚀 Bot optimized for free tier deployment');
    console.log('📊 Memory usage:', process.memoryUsage());
    // Botの権限を確認
    try {
        console.log('🔍 Checking bot permissions...');
        const guild = await client.guilds.fetch(config_1.config.DISCORD_GUILD_ID);
        console.log(`✅ Found guild: ${guild.name} (${guild.id})`);
        const botMember = guild.members.cache.get(client.user.id);
        if (botMember) {
            console.log('🔐 Bot permissions:', botMember.permissions.toArray());
            console.log('🔐 Bot roles:', botMember.roles.cache.map(r => r.name).join(', '));
            // 必要な権限をチェック
            const requiredPermissions = ['SendMessages', 'ManageRoles'];
            const missingPermissions = requiredPermissions.filter(perm => !botMember.permissions.has(perm));
            if (missingPermissions.length > 0) {
                console.error('❌ Missing required permissions:', missingPermissions);
            }
            else {
                console.log('✅ All required permissions are available');
            }
        }
        else {
            console.error('❌ Bot member not found in guild');
        }
    }
    catch (error) {
        console.error('❌ Error checking bot permissions:', error);
    }
    // APIサーバー起動
    console.log('🚀 Starting API server...');
    (0, api_server_1.startApiServer)();
    // 認証チャンネルをセットアップ
    console.log('🔧 Setting up verification channel...');
    await setupVerificationChannel();
});
// チャンネルテンプレート取得
async function getChannelTemplates() {
    try {
        console.log(`🌐 Fetching from: ${config_1.config.CLOUDFLARE_WORKERS_API_URL}/api/channel-templates`);
        const response = await fetch(`${config_1.config.CLOUDFLARE_WORKERS_API_URL}/api/channel-templates`);
        console.log(`📡 Response status: ${response.status}`);
        if (!response.ok) {
            console.error(`❌ HTTP Error: ${response.status} ${response.statusText}`);
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        console.log('📥 Raw response data:', JSON.stringify(data, null, 2));
        if (data.success) {
            console.log('✅ Successfully got channel templates from Workers');
            return data.data;
        }
        else {
            console.log('⚠️ Workers returned failure, using fallback');
            return data.fallback || getDefaultChannelTemplates();
        }
    }
    catch (error) {
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
            description: 'Starting verification...\n\n⚠️ **Note:** Wallet signatures are safe. We only verify NFT ownership and do not move any assets.\n\n',
            color: 0x57F287
        },
        verificationUrl: 'https://syndicatextokyo.app'
    };
}
// 認証チャンネルとメッセージのセットアップ
async function setupVerificationChannel() {
    try {
        console.log('🔍 Setting up verification channel...');
        const guild = await client.guilds.fetch(config_1.config.DISCORD_GUILD_ID);
        if (!guild) {
            console.error('❌ Guild not found');
            return;
        }
        console.log(`✅ Found guild: ${guild.name}`);
        // 手動作成されたチャンネルを取得
        console.log(`🔍 Looking for channel with ID: ${config_1.config.VERIFICATION_CHANNEL_ID}`);
        const verificationChannel = await guild.channels.fetch(config_1.config.VERIFICATION_CHANNEL_ID);
        if (!verificationChannel) {
            console.error('❌ Verification channel not found. Please create a channel with ID:', config_1.config.VERIFICATION_CHANNEL_ID);
            return;
        }
        console.log(`✅ Found verification channel: ${verificationChannel.name} (${verificationChannel.id})`);
        // チャンネルの権限をチェック
        const botPermissions = verificationChannel.permissionsFor(client.user);
        if (botPermissions) {
            console.log('🔐 Channel permissions for bot:', botPermissions.toArray());
            if (!botPermissions.has('SendMessages')) {
                console.error('❌ Bot cannot send messages in this channel');
                return;
            }
        }
        // 既存のBotメッセージをチェック（権限を確認してから実行）
        console.log('🔍 Checking existing bot messages...');
        try {
            const permissions = verificationChannel.permissionsFor(client.user);
            if (permissions?.has('ReadMessageHistory')) {
                const messages = await verificationChannel.messages.fetch({ limit: 50 });
                const botMessages = messages.filter(msg => msg.author.id === client.user.id);
                console.log(`📊 Found ${botMessages.size} existing bot messages`);
                // 古いメッセージを削除（権限があれば）
                if (botMessages.size > 0 && permissions?.has('ManageMessages')) {
                    try {
                        await verificationChannel.bulkDelete(botMessages);
                        console.log(`🧹 Bulk deleted ${botMessages.size} old bot messages`);
                    }
                    catch (bulkError) {
                        console.log('⚠️ Bulk delete failed, trying individual deletion:', bulkError);
                        // 個別削除を試行
                        for (const message of botMessages.values()) {
                            try {
                                await message.delete();
                                console.log(`🧹 Deleted individual message: ${message.embeds[0]?.title || 'No title'}`);
                            }
                            catch (individualError) {
                                console.log(`⚠️ Could not delete message: ${individualError}`);
                            }
                        }
                    }
                }
                else if (botMessages.size > 0) {
                    console.log('⚠️ No permission to delete messages, keeping existing ones');
                }
            }
            else {
                console.log('⚠️ No permission to read message history, skipping message cleanup');
            }
        }
        catch (error) {
            console.log('⚠️ Could not check existing messages:', error);
            // エラーが発生しても新しいメッセージを送信
        }
        console.log('🔄 Creating new verification messages...');
        // テンプレートを取得
        console.log('📡 Fetching channel templates from Workers...');
        const templates = await getChannelTemplates();
        console.log('📥 Received templates:', JSON.stringify(templates, null, 2));
        const channelTemplate = templates.verificationChannel;
        // シンプルな認証メッセージ
        const verificationEmbed = new discord_js_1.EmbedBuilder()
            .setTitle(channelTemplate.title)
            .setDescription(channelTemplate.description)
            .addFields({ name: '📋 Verification Steps', value: '1. Click the button\n2. Sign with your wallet\n3. NFT ownership check\n4. Role assignment', inline: false })
            .setColor(channelTemplate.color || 0x57F287)
            .setFooter({
            text: 'NFT Verification Bot'
        })
            .setTimestamp();
        // シンプルなボタン
        const verifyButton = new discord_js_1.ButtonBuilder()
            .setCustomId('verify_nft')
            .setLabel('Start NFT Verification')
            .setStyle(discord_js_1.ButtonStyle.Primary)
            .setEmoji('🎫');
        const actionRow = new discord_js_1.ActionRowBuilder()
            .addComponents(verifyButton);
        // 認証メッセージ送信
        console.log('📤 Sending verification message...');
        await verificationChannel.send({
            embeds: [verificationEmbed],
            components: [actionRow]
        });
        console.log('✅ Verification message sent');
    }
    catch (error) {
        console.error('❌ Error setting up verification channel:', error);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error details:', {
            guildId: config_1.config.DISCORD_GUILD_ID,
            channelId: config_1.config.VERIFICATION_CHANNEL_ID,
            workersUrl: config_1.config.CLOUDFLARE_WORKERS_API_URL
        });
    }
}
// ボタンインタラクション処理
client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
    console.log(`🔄 Interaction received: ${interaction.type}`);
    if (!interaction.isButton()) {
        console.log(`❌ Not a button interaction: ${interaction.type}`);
        return;
    }
    const { customId, user, member } = interaction;
    const isAdmin = user.id === config_1.config.ADMIN_USER_ID;
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
        }
        else {
            console.log(`❌ Unknown button interaction: ${customId}`);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Unknown button interaction.',
                    ephemeral: true
                });
            }
        }
    }
    catch (error) {
        console.error('❌ Error handling interaction:', error);
        console.error('❌ Error stack:', error.stack);
        // エラーの種類に応じて処理
        if (error && typeof error === 'object' && 'code' in error) {
            const errorCode = error.code;
            if (errorCode === 10062) {
                console.log('⚠️ Unknown interaction - interaction may have expired');
                return;
            }
            else if (errorCode === 40060) {
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
        }
        catch (replyError) {
            console.error('❌ Error sending error reply:', replyError);
        }
    }
});
// NFT認証処理（ミニマル版）
async function handleVerifyNFT(interaction) {
    try {
        console.log(`🔄 Starting NFT verification for user ${interaction.user.username} (${interaction.user.id})`);
        console.log(`📋 Config check:`, {
            VERIFICATION_URL: config_1.config.VERIFICATION_URL,
            hasUrl: !!config_1.config.VERIFICATION_URL
        });
        if (!config_1.config.VERIFICATION_URL) {
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
        const baseUrl = templates.verificationUrl || config_1.config.VERIFICATION_URL;
        const verificationUrl = `${baseUrl}?discord_id=${interaction.user.id}`;
        console.log(`🔗 Verification URL: ${verificationUrl}`);
        console.log('🔧 Creating embed with new format...');
        console.log('📋 Template data:', JSON.stringify(startTemplate, null, 2));
        console.log('🔗 URL:', verificationUrl);
        const verifyEmbed = new discord_js_1.EmbedBuilder()
            .setTitle(startTemplate.title)
            .setDescription(startTemplate.description)
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
                }
                catch (error) {
                    console.log('❌ Failed to auto-delete message:', error);
                    console.log('Message may have been deleted manually or expired');
                }
            }, 5 * 60 * 1000); // 5分 = 300秒
            // タイムアウトIDを保存（必要に応じてキャンセル可能）
            console.log(`⏰ Auto-delete scheduled for user ${interaction.user.id} in 5 minutes`);
        }
        else {
            console.log('⚠️ Interaction already replied, skipping verification message');
        }
    }
    catch (error) {
        console.error('❌ Error in handleVerifyNFT:', error);
        console.error('❌ Error stack:', error.stack);
        // エラーの種類に応じて処理
        if (error && typeof error === 'object' && 'code' in error) {
            const errorCode = error.code;
            if (errorCode === 10062) {
                console.log('⚠️ Unknown interaction - interaction may have expired');
                return;
            }
            else if (errorCode === 40060) {
                console.log('⚠️ Interaction already acknowledged');
                return;
            }
        }
        throw error; // 上位のエラーハンドラーで処理
    }
}
// ロール付与関数（APIから呼び出される）
async function grantRoleToUser(discordId, collectionId, roleName, customMessage) {
    try {
        console.log(`🔄 Attempting to grant role to Discord ID: ${discordId}`);
        console.log(`📋 Collection ID: ${collectionId || 'default'}`);
        console.log(`📋 Role Name: ${roleName || 'NFT Holder'}`);
        console.log(`📋 Config: Guild ID: ${config_1.config.DISCORD_GUILD_ID}, Role ID: ${config_1.config.DISCORD_ROLE_ID}`);
        const guild = await client.guilds.fetch(config_1.config.DISCORD_GUILD_ID);
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
        let roleId = config_1.config.DISCORD_ROLE_ID; // デフォルトロール
        if (collectionId) {
            try {
                console.log(`🔄 Fetching role ID for collection: ${collectionId}`);
                const collectionRoleId = await getRoleIdForCollection(collectionId);
                if (collectionRoleId) {
                    roleId = collectionRoleId;
                    console.log(`✅ Found role ID for collection: ${roleId}`);
                }
                else {
                    console.log(`⚠️ No role ID found for collection ${collectionId}, using default`);
                }
            }
            catch (error) {
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
        }
        else {
            console.log(`ℹ️ User ${discordId} (${member.user.username}) already has the role ${role.name}`);
        }
        // ユーザーにDM送信（Cloudflare Workersから送信されたメッセージを使用）
        try {
            // カスタムメッセージ（Cloudflare Workersから送信）をそのまま使用
            if (customMessage?.title && customMessage?.description) {
                const successEmbed = new discord_js_1.EmbedBuilder()
                    .setTitle(customMessage.title)
                    .setDescription(customMessage.description)
                    .setColor(customMessage.color ?? 0x57F287)
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
                    }
                    catch (error) {
                        console.log('❌ Failed to auto-delete message:', error);
                        console.log('Message may have been deleted manually or expired');
                    }
                }, 5 * 60 * 1000); // 5分 = 300秒
                console.log(`⏰ Auto-delete scheduled for Discord ID: ${discordId} in 5 minutes`);
                console.log(`✅ DM sent to user ${member.user.username}`);
            }
            else {
                console.log('📋 No custom message provided from Cloudflare Workers');
            }
        }
        catch (dmError) {
            console.log('Could not send DM to user:', dmError);
        }
        return true;
    }
    catch (error) {
        console.error('❌ Error granting role:', error);
        console.error('❌ Error details:', error.message);
        return false;
    }
}
// コレクション別ロールID取得関数
async function getRoleIdForCollection(collectionId) {
    try {
        console.log(`🔄 Fetching collection config for ID: ${collectionId}`);
        // Cloudflare Workers APIからコレクション設定を取得
        const response = await fetch(`${config_1.config.CLOUDFLARE_WORKERS_API_URL}/api/collections`);
        const data = await response.json();
        if (data.success && data.data) {
            const collection = data.data.find((c) => c.id === collectionId);
            if (collection && collection.isActive) {
                console.log(`✅ Found active collection: ${collection.name} with role ID: ${collection.roleId}`);
                return collection.roleId;
            }
            else {
                console.log(`⚠️ Collection ${collectionId} not found or inactive`);
            }
        }
        else {
            console.log('❌ Failed to fetch collections from API');
        }
    }
    catch (error) {
        console.error('❌ Error fetching collection config:', error);
    }
    return null;
}
// 認証失敗時のDiscordチャンネル通知
async function sendVerificationFailureMessage(discordId, verificationData) {
    try {
        console.log(`🔄 Sending verification failure message for Discord ID: ${discordId}`);
        console.log('📋 Verification data:', verificationData);
        const guild = await client.guilds.fetch(config_1.config.DISCORD_GUILD_ID);
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
        // カスタムメッセージ（Cloudflare Workersから送信）をそのまま使用
        if (cm.title && cm.description) {
            const failureEmbed = new discord_js_1.EmbedBuilder()
                .setTitle(cm.title)
                .setDescription(cm.description)
                .setColor(cm.color ?? 0xED4245)
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
                }
                catch (error) {
                    console.log('❌ Failed to auto-delete message:', error);
                    console.log('Message may have been deleted manually or expired');
                }
            }, 5 * 60 * 1000); // 5分 = 300秒
            console.log(`⏰ Auto-delete scheduled for Discord ID: ${discordId} in 5 minutes`);
            return true;
        }
        else {
            console.log('📋 No custom message provided from Cloudflare Workers for failure');
            return false;
        }
    }
    catch (error) {
        console.error('❌ Error sending verification failure message:', error);
        console.error('❌ Error details:', error.message);
        console.error('❌ Error stack:', error.stack);
        return false;
    }
}
// ロール剥奪関数（Cronから呼び出される）
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
        console.log(`✅ Role revoked from user ${discordId}`);
        // ユーザーにDM送信（Cloudflare Workersから送信されたメッセージを使用）
        try {
            // カスタムメッセージ（Cloudflare Workersから送信）をそのまま使用
            if (customMessage?.title && customMessage?.description) {
                const revokeEmbed = new discord_js_1.EmbedBuilder()
                    .setTitle(customMessage.title)
                    .setDescription(customMessage.description)
                    .setColor(customMessage.color ?? 0xED4245)
                    .setTimestamp();
                console.log('📤 Sending revoke notification to user DM...');
                // ユーザーにDMを送信
                const message = await member.send({
                    embeds: [revokeEmbed]
                });
                console.log(`✅ Revoke message sent for Discord ID: ${discordId}`);
                // 5分後にメッセージを自動削除
                setTimeout(async () => {
                    try {
                        console.log(`🔄 Auto-deleting revoke message for Discord ID: ${discordId}...`);
                        await message.delete();
                        console.log(`✅ Auto-deleted revoke message for Discord ID: ${discordId}`);
                    }
                    catch (error) {
                        console.log('❌ Failed to auto-delete message:', error);
                        console.log('Message may have been deleted manually or expired');
                    }
                }, 5 * 60 * 1000); // 5分 = 300秒
                console.log(`⏰ Auto-delete scheduled for Discord ID: ${discordId} in 5 minutes`);
            }
            else {
                console.log('📋 No custom message provided from Cloudflare Workers for revoke');
            }
        }
        catch (dmError) {
            console.log('Could not send DM to user:', dmError);
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
console.log(`  - DISCORD_TOKEN: ${config_1.config.DISCORD_TOKEN ? '✅ Set' : '❌ Not set'}`);
console.log(`  - DISCORD_CLIENT_ID: ${config_1.config.DISCORD_CLIENT_ID ? '✅ Set' : '❌ Not set'}`);
console.log(`  - DISCORD_GUILD_ID: ${config_1.config.DISCORD_GUILD_ID ? '✅ Set' : '❌ Not set'}`);
console.log(`  - VERIFICATION_CHANNEL_ID: ${config_1.config.VERIFICATION_CHANNEL_ID ? '✅ Set' : '❌ Not set'}`);
console.log(`  - VERIFICATION_URL: ${config_1.config.VERIFICATION_URL ? '✅ Set' : '❌ Not set'}`);
//# sourceMappingURL=index.js.map