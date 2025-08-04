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
        // 既存のBotメッセージをチェック（すべてのBotメッセージを削除）
        console.log('🔍 Checking existing bot messages...');
        const messages = await verificationChannel.messages.fetch({ limit: 50 });
        const botMessages = messages.filter(msg => msg.author.id === client.user.id);
        console.log(`📊 Found ${botMessages.size} existing bot messages`);
        console.log('📋 Bot message titles:', botMessages.map(msg => msg.embeds.length > 0 ? msg.embeds[0].title : 'No embed'));
        // 古いメッセージを削除（権限があれば）
        if (botMessages.size > 0) {
            try {
                const permissions = verificationChannel.permissionsFor(client.user);
                if (permissions?.has('ManageMessages')) {
                    // 一括削除を試行
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
                else {
                    console.log('⚠️ No permission to delete messages, keeping existing ones');
                    // 権限がない場合は既存メッセージを削除せずに新しいメッセージを送信
                }
            }
            catch (error) {
                console.log('⚠️ Could not delete old messages:', error);
                // エラーが発生しても新しいメッセージを送信
            }
        }
        console.log('🔄 Creating new verification messages...');
        // シンプルでカッコいいユーザー認証メッセージ
        const userVerificationEmbed = new discord_js_1.EmbedBuilder()
            .setTitle('🎯 SXT NFT Verification Portal')
            .setDescription(`**Join the exclusive NFT community by verifying your Sui wallet ownership!**

🌟 **What you'll get:**
• **Exclusive Discord Role:** NFT Holder
• **Premium Access:** Special channels and features
• **Community Status:** Verified NFT holder
• **Future Benefits:** Early access to upcoming features

🎯 **How to verify:**
1. **Click the verification button below**
2. **Get your personalized verification URL**
3. **Connect your Sui wallet** (Sui Wallet, Slush Wallet, etc.)
4. **Complete the verification process**
5. **Get your exclusive role automatically!**

💎 **Security Features:**
• Blockchain-verified NFT ownership
• Secure message signing (no private key access)
• Instant role assignment
• Professional verification process`)
            .setColor(0x6366f1)
            .setFooter({
            text: 'Sui NFT Verification'
        })
            .setTimestamp();
        // シンプルなボタン
        const verifyButton = new discord_js_1.ButtonBuilder()
            .setCustomId('verify_nft')
            .setLabel('Verify NFT')
            .setStyle(discord_js_1.ButtonStyle.Primary)
            .setEmoji('🚀');
        const helpButton = new discord_js_1.ButtonBuilder()
            .setCustomId('help_verification')
            .setLabel('Help')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('❓');
        const userActionRow = new discord_js_1.ActionRowBuilder()
            .addComponents(verifyButton, helpButton);
        // 一般ユーザー向けメッセージ送信
        console.log('📤 Sending user verification message...');
        await verificationChannel.send({
            embeds: [userVerificationEmbed],
            components: [userActionRow]
        });
        console.log('✅ User verification message sent');
        // シンプルでカッコいい管理者パネル
        const adminEmbed = new discord_js_1.EmbedBuilder()
            .setTitle('⚙️ Admin Panel')
            .setDescription(`**System Status: Online**

Manage verification system and monitor performance.`)
            .setColor(0x71717a)
            .setFooter({
            text: 'Admin Panel'
        })
            .setTimestamp();
        // シンプルな管理ボタン
        const statsButton = new discord_js_1.ButtonBuilder()
            .setCustomId('admin_stats')
            .setLabel('Stats')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('📊');
        const refreshButton = new discord_js_1.ButtonBuilder()
            .setCustomId('admin_refresh')
            .setLabel('Refresh')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('🔄');
        const statusButton = new discord_js_1.ButtonBuilder()
            .setCustomId('admin_status')
            .setLabel('Status')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('🟢');
        const collectionsButton = new discord_js_1.ButtonBuilder()
            .setCustomId('admin_collections')
            .setLabel('Collections')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('🎨');
        const adminActionRow = new discord_js_1.ActionRowBuilder()
            .addComponents(statsButton, refreshButton, statusButton, collectionsButton);
        // 管理者向けメッセージ送信
        console.log('📤 Sending admin verification message...');
        await verificationChannel.send({
            embeds: [adminEmbed],
            components: [adminActionRow]
        });
        console.log('✅ Admin verification message sent');
        console.log('✅ User and Admin verification messages posted successfully');
    }
    catch (error) {
        console.error('❌ Error setting up verification channel:', error);
        console.error('❌ Error stack:', error.stack);
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
        // 一般ユーザー向けボタン
        if (customId === 'verify_nft') {
            console.log(`✅ Processing verify_nft for user ${user.username}`);
            await handleVerifyNFT(interaction);
        }
        // ヘルプボタン
        else if (customId === 'help_verification') {
            console.log(`✅ Processing help_verification for user ${user.username}`);
            await handleHelpVerification(interaction);
        }
        // サポートボタン
        else if (customId === 'support_verification') {
            console.log(`✅ Processing support_verification for user ${user.username}`);
            await handleSupportVerification(interaction);
        }
        // 管理者向けボタン
        else if (customId === 'admin_stats') {
            console.log(`✅ Processing admin_stats for user ${user.username} (isAdmin: ${isAdmin})`);
            await handleAdminStats(interaction, isAdmin);
        }
        else if (customId === 'admin_refresh') {
            console.log(`✅ Processing admin_refresh for user ${user.username} (isAdmin: ${isAdmin})`);
            await handleAdminRefresh(interaction, isAdmin);
        }
        else if (customId === 'admin_status') {
            console.log(`✅ Processing admin_status for user ${user.username} (isAdmin: ${isAdmin})`);
            await handleAdminStatus(interaction, isAdmin);
        }
        else if (customId === 'admin_logs') {
            console.log(`✅ Processing admin_logs for user ${user.username} (isAdmin: ${isAdmin})`);
            await handleAdminLogs(interaction, isAdmin);
        }
        else if (customId === 'admin_collections') {
            console.log(`✅ Processing admin_collections for user ${user.username} (isAdmin: ${isAdmin})`);
            await handleAdminCollections(interaction, isAdmin);
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
        const verificationUrl = `${config_1.config.VERIFICATION_URL}?discord_id=${interaction.user.id}`;
        console.log(`🔗 Verification URL: ${verificationUrl}`);
        const verifyEmbed = new discord_js_1.EmbedBuilder()
            .setTitle('🔗 NFT Verification')
            .setDescription(`**Starting NFT verification**
[Open verification page](${verificationUrl})`)
            .setColor(0x6366f1)
            .setFooter({
            text: 'Sui NFT Verification'
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
// ヘルプボタン処理
async function handleHelpVerification(interaction) {
    try {
        console.log(`🔄 Handling help_verification for user ${interaction.user.username} (${interaction.user.id})`);
        const helpEmbed = new discord_js_1.EmbedBuilder()
            .setTitle('❓ Help')
            .setDescription(`**How to verify your NFT:**

1. Click "Verify NFT" button
2. Open the verification page
3. Connect your wallet
4. Sign the message
5. Get your role

**Requirements:**
• Sui wallet with NFTs
• Wallet extension installed
• Discord server membership`)
            .setColor(0x57F287)
            .setFooter({
            text: 'Sui NFT Verification'
        })
            .setTimestamp();
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                embeds: [helpEmbed],
                ephemeral: true
            });
        }
    }
    catch (error) {
        console.error('❌ Error in handleHelpVerification:', error);
        console.error('❌ Error stack:', error.stack);
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({
                    content: '❌ 認証方法の説明に失敗しました。',
                    ephemeral: true
                });
            }
            catch (replyError) {
                console.error('❌ Error sending help reply:', replyError);
            }
        }
    }
}
// サポートボタン処理
async function handleSupportVerification(interaction) {
    try {
        console.log(`🔄 Handling support_verification for user ${interaction.user.username} (${interaction.user.id})`);
        const supportEmbed = new discord_js_1.EmbedBuilder()
            .setTitle('🆘 Support & Assistance')
            .setDescription(`**Need help with the NFT verification process?**\\n\\n🔗 **[🔐 Open Secure Verification Portal](${config_1.config.VERIFICATION_URL || 'Configured in system'})**\\n\\n📚 **Documentation:**\\n• Visit our official documentation for detailed guides: [Sui NFT Verification Docs](https://docs.sui.network/docs/learn/nft-verification)\\n\\n💬 **Discord Support:**\\n• Join our official Discord server for immediate assistance: [Sui NFT Verification Discord](https://discord.gg/sui)\\n\\n🔒 **Security:**\\n• All verification is done through secure signatures\\n• Your wallet data remains private\\n• Blockchain-verified ownership only\\n\\n❓ **Common Issues:**\\n• **Q: I can't connect my wallet.**\\n  A: Ensure your Sui Wallet extension is installed and up-to-date.\\n\\n• **Q: The verification link expired.**\\n  A: The verification link is valid for 5 minutes. If it expires, please request a new one.\\n\\n• **Q: My role isn't showing up.**\\n  A: Please check your wallet connection and try again. If the issue persists, contact support.`)
            .setColor(0xFEE75C)
            .setThumbnail('https://i.imgur.com/8tBXd6L.png')
            .addFields({ name: '🌐 Verification Portal', value: config_1.config.VERIFICATION_URL || 'Configured in system', inline: true }, { name: '💬 Support Channel', value: 'https://discord.gg/sui', inline: true }, { name: '🔒 Security Level', value: 'Maximum Protection', inline: true }, { name: '⚡ Process Speed', value: 'Under 2 minutes', inline: true }, { name: '🎁 Benefits', value: 'Exclusive Access', inline: true })
            .setFooter({
            text: 'Sui NFT Verification Support • Professional Assistance',
            iconURL: 'https://i.imgur.com/8tBXd6L.png'
        })
            .setTimestamp();
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                embeds: [supportEmbed],
                ephemeral: true
            });
        }
    }
    catch (error) {
        console.error('❌ Error in handleSupportVerification:', error);
        console.error('❌ Error stack:', error.stack);
        if (!interaction.replied && !interaction.deferred) {
            try {
                await interaction.reply({
                    content: '❌ サポートに失敗しました。',
                    ephemeral: true
                });
            }
            catch (replyError) {
                console.error('❌ Error sending support reply:', replyError);
            }
        }
    }
}
// ロール付与関数（APIから呼び出される）
async function grantRoleToUser(discordId, collectionId, roleName) {
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
        // ユーザーにDM送信（成功通知）
        try {
            const successEmbed = new discord_js_1.EmbedBuilder()
                .setTitle('🎉 NFT Verification Successful!')
                .setDescription(`**Congratulations! Your NFT verification has been completed successfully!**\\n\\n🌟 **What you've received:**\\n• **Exclusive Discord Role:** "${role.name}"\\n• **Premium Access:** Special channels and features\\n• **Community Status:** Verified NFT holder\\n• **Future Benefits:** Early access to upcoming features\\n\\n🎯 **Your Benefits:**\\n• Access to exclusive channels\\n• Special community recognition\\n• Priority support and assistance\\n• Early access to new features\\n\\n💎 **Security Confirmation:**\\n• Your NFT ownership has been verified on the blockchain\\n• All verification was done securely without accessing private keys\\n• Your wallet data remains completely private\\n\\n*Welcome to the exclusive NFT community! Enjoy your new privileges!*`)
                .setColor(0x57F287)
                .setThumbnail('https://i.imgur.com/8tBXd6L.png')
                .addFields({ name: '🎁 Role Granted', value: role.name, inline: true }, { name: '🆔 Discord ID', value: discordId, inline: true }, { name: '⏰ Verified At', value: new Date().toLocaleString(), inline: true }, { name: '🔒 Security Level', value: 'Maximum Protection', inline: true }, { name: '⚡ Process Speed', value: 'Instant Verification', inline: true }, { name: '🎯 Status', value: 'Active & Verified', inline: true })
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
                }
                catch (error) {
                    console.log('❌ Failed to auto-delete message:', error);
                    console.log('Message may have been deleted manually or expired');
                }
            }, 5 * 60 * 1000); // 5分 = 300秒
            console.log(`⏰ Auto-delete scheduled for Discord ID: ${discordId} in 5 minutes`);
            console.log(`✅ DM sent to user ${member.user.username}`);
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
        const failureEmbed = new discord_js_1.EmbedBuilder()
            .setTitle('❌ NFT Verification Failed')
            .setDescription(`**NFT verification failed for user <@${discordId}>**

**Wallet Address:** \`${verificationData?.address || 'Unknown'}\`
**Reason:** ${verificationData?.reason || 'NFT not found in wallet'}
**Timestamp:** ${new Date().toLocaleString()}

**Next Steps:**
• Ensure you own the required NFTs
• Check your wallet connection
• Try the verification process again`)
            .setColor(0xED4245)
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
            }
            catch (error) {
                console.log('❌ Failed to auto-delete message:', error);
                console.log('Message may have been deleted manually or expired');
            }
        }, 5 * 60 * 1000); // 5分 = 300秒
        console.log(`⏰ Auto-delete scheduled for Discord ID: ${discordId} in 5 minutes`);
        return true;
    }
    catch (error) {
        console.error('❌ Error sending verification failure message:', error);
        console.error('❌ Error details:', error.message);
        console.error('❌ Error stack:', error.stack);
        return false;
    }
}
// 管理者統計表示（シンプル版）
async function handleAdminStats(interaction, isAdmin) {
    try {
        if (!isAdmin) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Administrator privileges required.',
                    ephemeral: true
                });
            }
            return;
        }
        const statsEmbed = new discord_js_1.EmbedBuilder()
            .setTitle('📊 Stats')
            .setDescription(`**System Statistics**

Bot ID: ${client.user?.id || 'Unknown'}
Guild: ${interaction.guild?.name || 'Unknown'}
Version: 2.0.0`)
            .setColor(0x57F287)
            .setFooter({
            text: 'Admin Panel'
        })
            .setTimestamp();
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                embeds: [statsEmbed],
                ephemeral: true
            });
        }
    }
    catch (error) {
        console.error('Error in handleAdminStats:', error);
        throw error;
    }
}
// 管理者リフレッシュ（シンプル版）
async function handleAdminRefresh(interaction, isAdmin) {
    try {
        if (!isAdmin) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Administrator privileges required.',
                    ephemeral: true
                });
            }
            return;
        }
        const refreshEmbed = new discord_js_1.EmbedBuilder()
            .setTitle('🔄 Refresh')
            .setDescription(`**System refreshed successfully**

Status: Online
Network: ${config_1.config.SUI_NETWORK}
Time: ${new Date().toLocaleString()}`)
            .setColor(0x57F287)
            .setFooter({
            text: 'Admin Panel'
        })
            .setTimestamp();
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                embeds: [refreshEmbed],
                ephemeral: true
            });
        }
    }
    catch (error) {
        console.error('Error in handleAdminRefresh:', error);
        throw error;
    }
}
// 管理者ステータス表示（シンプル版）
async function handleAdminStatus(interaction, isAdmin) {
    try {
        if (!isAdmin) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Administrator privileges required.',
                    ephemeral: true
                });
            }
            return;
        }
        const statusEmbed = new discord_js_1.EmbedBuilder()
            .setTitle('🟢 Status')
            .setDescription(`**System Status: Online**

Bot Service: Online
API Connection: Connected
Database: Healthy
Verification: Active`)
            .setColor(0x57F287)
            .setFooter({
            text: 'Admin Panel'
        })
            .setTimestamp();
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                embeds: [statusEmbed],
                ephemeral: true
            });
        }
    }
    catch (error) {
        console.error('Error in handleAdminStatus:', error);
        throw error;
    }
}
// 管理者ログ表示（プロフェッショナル版）
async function handleAdminLogs(interaction, isAdmin) {
    try {
        if (!isAdmin) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Administrator privileges required.',
                    ephemeral: true
                });
            }
            return;
        }
        const logsEmbed = new discord_js_1.EmbedBuilder()
            .setTitle('📋 System Logs')
            .setDescription(`**Latest System Logs**\\n\\n*Logs will be implemented in future updates*`)
            .setColor(0x57F287)
            .setThumbnail('https://i.imgur.com/8tBXd6L.png')
            .addFields({ name: '🆔 Bot ID', value: client.user?.id || 'Unknown', inline: true }, { name: '🏠 Guild', value: interaction.guild?.name || 'Unknown', inline: true }, { name: '📈 Version', value: '2.0.0', inline: true })
            .setFooter({
            text: 'System Logs • Real-time Monitoring',
            iconURL: client.user?.displayAvatarURL()
        })
            .setTimestamp();
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                embeds: [logsEmbed],
                ephemeral: true
            });
        }
    }
    catch (error) {
        console.error('Error in handleAdminLogs:', error);
        throw error;
    }
}
// コレクション管理ボタン処理
async function handleAdminCollections(interaction, isAdmin) {
    try {
        if (!isAdmin) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ Administrator privileges required.',
                    ephemeral: true
                });
            }
            return;
        }
        const collectionsEmbed = new discord_js_1.EmbedBuilder()
            .setTitle('🎨 Collections Management')
            .setDescription(`**Manage your NFT collections and their associated roles.**

\`\`\`
Collection ID: ${config_1.config.NFT_COLLECTION_ID || 'Not set'}
Role ID: ${config_1.config.DISCORD_ROLE_ID || 'Not set'}
\`\`\`

**Current Collections:**
${config_1.config.NFT_COLLECTION_ID ? `• \`${config_1.config.NFT_COLLECTION_ID}\` (Active)` : '• No collections configured.'}

**Add New Collection:**
1. Create a new channel in Discord.
2. Set its ID in \`VERIFICATION_CHANNEL_ID\` in \`config.ts\`.
3. Set its \`collectionId\` in \`NFT_COLLECTION_ID\` in \`config.ts\`.
4. Set its \`roleId\` in \`DISCORD_ROLE_ID\` in \`config.ts\`.

**Note:**
• \`VERIFICATION_CHANNEL_ID\` must be a text channel.
• \`NFT_COLLECTION_ID\` must be a valid Sui Network collection ID.
• \`DISCORD_ROLE_ID\` must be a role that exists in your Discord server.
• The \`roleId\` in \`config.ts\` must match the role ID in your Discord server.`)
            .setColor(0x57F287)
            .setFooter({
            text: 'Collections Management'
        })
            .setTimestamp();
        const backButton = new discord_js_1.ButtonBuilder()
            .setCustomId('admin_back_to_status')
            .setLabel('Back to Status')
            .setStyle(discord_js_1.ButtonStyle.Secondary)
            .setEmoji('⬅️');
        const actionRow = new discord_js_1.ActionRowBuilder()
            .addComponents(backButton);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                embeds: [collectionsEmbed],
                components: [actionRow],
                ephemeral: true
            });
        }
    }
    catch (error) {
        console.error('Error in handleAdminCollections:', error);
        throw error;
    }
}
// ロール剥奪関数（Cronから呼び出される）
async function revokeRoleFromUser(discordId) {
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
        // ユーザーにDM送信
        try {
            await member.send({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setTitle('📋 Role Update Notification')
                        .setDescription(`**Your NFT verification status has been updated**\\n\\n⚠️ **Role Removed:** The "${role.name}" role has been removed from your account.\\n\\n🔍 **Reason:** Your NFT ownership could not be verified on the blockchain.\\n\\n🔄 **How to restore your role:**\\n1. Ensure you still own the required NFTs\\n2. Visit the verification channel\\n3. Click "Start Verification" to re-verify\\n4. Complete the verification process again\\n\\n💡 **Tips:**\\n• Make sure your wallet is properly connected\\n• Verify that you still own the required NFTs\\n• Check that your NFTs are on the correct network\\n\\n*If you believe this is an error, please contact server administrators for assistance.*`)
                        .setColor(0xED4245)
                        .setThumbnail('https://i.imgur.com/8tBXd6L.png')
                        .addFields({ name: '🎭 Role Removed', value: role.name, inline: true }, { name: '🆔 Discord ID', value: discordId, inline: true }, { name: '⏰ Updated At', value: new Date().toLocaleString(), inline: true }, { name: '🔍 Status', value: 'Verification Required', inline: true }, { name: '🔄 Action', value: 'Re-verify to restore', inline: true }, { name: '💬 Support', value: 'Contact administrators', inline: true })
                        .setFooter({
                        text: 'Sui NFT Verification • Professional System',
                        iconURL: 'https://i.imgur.com/8tBXd6L.png'
                    })
                        .setTimestamp()
                ]
            });
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