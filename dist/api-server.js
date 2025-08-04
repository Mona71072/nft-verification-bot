"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
exports.startApiServer = startApiServer;
const express_1 = __importDefault(require("express"));
const config_1 = require("./config");
const index_1 = require("./index");
const index_2 = require("./index");
const app = (0, express_1.default)();
exports.app = app;
const PORT = config_1.config.PORT;
app.use(express_1.default.json());
// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'nft-verification-bot',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});
// CORS設定
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
    }
    next();
});
// Cloudflare Workersからの認証結果通知エンドポイント
app.post('/notify', async (req, res) => {
    try {
        console.log('🔄 Received notification from Cloudflare Workers');
        console.log('📋 Request body:', req.body);
        console.log('📋 Request headers:', req.headers);
        const { discordId, action, verificationData, timestamp } = req.body;
        if (!discordId || !action) {
            console.error('❌ Missing required fields:', { discordId, action });
            return res.status(400).json({
                success: false,
                error: 'discordId and action are required'
            });
        }
        console.log(`🔄 Processing ${action} for Discord ID: ${discordId}`);
        console.log('📋 Verification data:', verificationData);
        console.log('📋 Timestamp:', timestamp);
        let result = false;
        let message = '';
        switch (action) {
            case 'grant_role':
                console.log('🎯 Attempting to grant role...');
                // 複数コレクション対応: collectionIdとroleNameを取得
                const collectionId = verificationData?.collectionId;
                const roleName = verificationData?.roleName;
                console.log(`📋 Collection ID: ${collectionId || 'default'}`);
                console.log(`📋 Role Name: ${roleName || 'NFT Holder'}`);
                result = await (0, index_1.grantRoleToUser)(discordId, collectionId, roleName);
                message = result ? 'Role granted successfully' : 'Failed to grant role';
                console.log(`✅ Role grant result: ${result}`);
                break;
            case 'verification_failed':
                console.log('❌ Attempting to send verification failure message...');
                // 認証失敗時のDiscordチャンネル通知
                result = await (0, index_1.sendVerificationFailureMessage)(discordId, verificationData);
                message = result ? 'Failure notification sent' : 'Failed to send failure notification';
                console.log(`✅ Verification failure notification result: ${result}`);
                break;
            default:
                console.error('❌ Invalid action:', action);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid action. Must be grant_role or verification_failed'
                });
        }
        const response = {
            success: result,
            action: action,
            discordId: discordId,
            message: message,
            timestamp: timestamp
        };
        console.log('📤 Sending response:', response);
        res.json(response);
    }
    catch (error) {
        console.error('❌ Notification API Error:', error);
        console.error('❌ Error details:', error.message);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Discord アクション処理エンドポイント（既存）
app.post('/api/discord-action', async (req, res) => {
    try {
        const { discord_id, action } = req.body;
        if (!discord_id || !action) {
            console.error('❌ Missing required fields:', { discord_id, action });
            return res.status(400).json({
                success: false,
                error: 'discord_id and action are required'
            });
        }
        console.log(`🔄 Processing ${action} for Discord ID: ${discord_id}`);
        let result = false;
        switch (action) {
            case 'grant_role':
                result = await (0, index_1.grantRoleToUser)(discord_id);
                console.log(`✅ Role grant result: ${result}`);
                break;
            case 'revoke_role':
                result = await (0, index_1.revokeRoleFromUser)(discord_id);
                console.log(`✅ Role revoke result: ${result}`);
                break;
            default:
                console.error('❌ Invalid action:', action);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid action. Must be grant_role or revoke_role'
                });
        }
        res.json({
            success: result,
            action: action,
            discord_id: discord_id
        });
    }
    catch (error) {
        console.error('❌ API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// 認証済みユーザー一覧取得（デバッグ用）
app.get('/api/verified-users', async (req, res) => {
    try {
        // KVストレージから認証済みユーザー一覧を取得（実装予定）
        res.json({
            success: true,
            users: [],
            message: 'KV storage integration pending'
        });
    }
    catch (error) {
        console.error('Error fetching verified users:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Discordサーバーのロール一覧取得API
app.get('/api/roles', async (req, res) => {
    try {
        const guild = await index_2.client.guilds.fetch(config_1.config.DISCORD_GUILD_ID);
        const roles = await guild.roles.fetch();
        const roleList = roles.map(role => ({
            id: role.id,
            name: role.name,
            color: role.color,
            position: role.position,
            mentionable: role.mentionable
        }));
        res.json({ success: true, roles: roleList });
    }
    catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch roles' });
    }
});
function startApiServer() {
    app.listen(PORT, () => {
        console.log(`🚀 Discord Bot API server running on http://localhost:${PORT}`);
    });
}
//# sourceMappingURL=api-server.js.map