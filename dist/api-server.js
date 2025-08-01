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
// Discord アクション処理エンドポイント
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
// ヘルスチェック
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'Discord Bot API',
        timestamp: new Date().toISOString()
    });
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
function startApiServer() {
    app.listen(PORT, () => {
        console.log(`🚀 Discord Bot API server running on http://localhost:${PORT}`);
    });
}
//# sourceMappingURL=api-server.js.map