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
const client_1 = require("@mysten/sui/client");
const transactions_1 = require("@mysten/sui/transactions");
const ed25519_1 = require("@mysten/sui/keypairs/ed25519");
const cryptography_1 = require("@mysten/sui/cryptography");
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
function getSuiClient() {
    const net = (process.env.SUI_NETWORK || 'mainnet');
    return new client_1.SuiClient({ url: (0, client_1.getFullnodeUrl)(net) });
}
function getSponsorKeypair() {
    const secret = process.env.SPONSOR_SECRET_KEY || '';
    const mnemonic = process.env.SPONSOR_MNEMONIC || '';
    if (secret) {
        const { secretKey } = (0, cryptography_1.decodeSuiPrivateKey)(secret);
        return ed25519_1.Ed25519Keypair.fromSecretKey(secretKey);
    }
    if (mnemonic) {
        return ed25519_1.Ed25519Keypair.deriveKeypair(mnemonic);
    }
    throw new Error('SPONSOR_SECRET_KEY or SPONSOR_MNEMONIC must be set');
}
// Cloudflare Workersからの認証結果通知エンドポイント
app.post('/notify', async (req, res) => {
    try {
        const { discordId, action, verificationData, timestamp } = req.body;
        const notifyUser = verificationData?.notifyUser !== false;
        const custom = verificationData?.custom_message;
        if (!discordId || !action) {
            console.error('Missing required fields:', { discordId, action });
            return res.status(400).json({
                success: false,
                error: 'discordId and action are required'
            });
        }
        let result = false;
        let message = '';
        switch (action) {
            case 'grant_roles':
            case 'grant_role':
                const collectionId = verificationData?.collectionId;
                const roleName = verificationData?.roleName;
                result = await (0, index_1.grantRoleToUser)(discordId, collectionId, roleName);
                message = result ? 'Role granted successfully' : 'Failed to grant role';
                break;
            case 'verification_failed':
                if (!notifyUser) {
                    result = true;
                    message = 'DM skipped by settings';
                    break;
                }
                result = await (0, index_1.sendVerificationFailureMessage)(discordId, verificationData);
                message = result ? 'Failure notification sent' : 'Failed to send failure notification';
                break;
            default:
                console.error('Invalid action:', action);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid action. Must be grant_roles/grant_role or verification_failed'
                });
        }
        const response = {
            success: result,
            action: action,
            discordId: discordId,
            message: message,
            timestamp: timestamp
        };
        res.json(response);
    }
    catch (error) {
        console.error('Notification API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// Discord アクション処理エンドポイント
app.post('/api/discord-action', async (req, res) => {
    try {
        const { discord_id, action, verification_data } = req.body;
        if (!discord_id || !action) {
            console.error('Missing required fields:', { discord_id, action });
            return res.status(400).json({
                success: false,
                error: 'discord_id and action are required'
            });
        }
        let result = false;
        switch (action) {
            case 'grant_roles':
            case 'grant_role': {
                const collectionId = verification_data?.collectionId;
                const roleName = verification_data?.roleName;
                const custom = verification_data?.custom_message;
                const notifyUser = verification_data?.notifyUser !== false;
                result = await (0, index_1.grantRoleToUser)(discord_id, collectionId, roleName, custom);
                break;
            }
            case 'verification_failed': {
                const notifyUser = verification_data?.notifyUser !== false;
                if (!notifyUser) {
                    result = true;
                    break;
                }
                result = await (0, index_1.sendVerificationFailureMessage)(discord_id, verification_data);
                break;
            }
            case 'revoke_role': {
                const custom = verification_data?.custom_message;
                result = await (0, index_1.revokeRoleFromUser)(discord_id, custom);
                break;
            }
            default:
                console.error('Invalid action:', action);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid action. Must be grant_roles/grant_role, verification_failed or revoke_role'
                });
        }
        res.json({
            success: result,
            action: action,
            discord_id: discord_id
        });
    }
    catch (error) {
        console.error('API Error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});
// スポンサー実行: Suiでのミント処理を代理送信
app.post('/api/mint', async (req, res) => {
    try {
        const { eventId, recipient, moveCall, imageUrl } = req.body || {};
        if (!eventId || !recipient || !moveCall?.target) {
            return res.status(400).json({ success: false, error: 'Missing eventId/recipient/moveCall.target' });
        }
        const client = getSuiClient();
        const kp = getSponsorKeypair();
        const tx = new transactions_1.Transaction();
        const args = Array.isArray(moveCall.argumentsTemplate) ? moveCall.argumentsTemplate : [];
        const builtArgs = args.map((a) => {
            if (a === '{recipient}')
                return tx.pure.address(recipient);
            if (a === '{imageUrl}')
                return tx.pure.string(imageUrl || '');
            return tx.pure.string(String(a));
        });
        tx.moveCall({
            target: moveCall.target,
            typeArguments: Array.isArray(moveCall.typeArguments) ? moveCall.typeArguments : [],
            arguments: builtArgs
        });
        if (moveCall.gasBudget)
            tx.setGasBudget(Number(moveCall.gasBudget));
        const result = await client.signAndExecuteTransaction({ signer: kp, transaction: tx, options: { showEffects: true } });
        return res.json({ success: true, txDigest: result.digest });
    }
    catch (e) {
        console.error('Sponsor mint failed:', e);
        return res.status(500).json({ success: false, error: e?.message || 'Sponsor mint failed' });
    }
});
// 認証済みユーザー一覧取得
app.get('/api/verified-users', async (req, res) => {
    try {
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
        console.log(`Discord Bot API server running on http://localhost:${PORT}`);
    });
}
//# sourceMappingURL=api-server.js.map