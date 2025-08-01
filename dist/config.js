"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.validateConfig = validateConfig;
exports.config = {
    // Discord Bot設定
    DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '',
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID || '',
    DISCORD_ROLE_ID: process.env.DISCORD_ROLE_ID || '',
    // Sui Network設定
    SUI_NETWORK: process.env.SUI_NETWORK || 'mainnet',
    NFT_COLLECTION_ID: process.env.NFT_COLLECTION_ID || '',
    // API設定
    API_BASE_URL: process.env.API_BASE_URL || '',
    PORT: process.env.PORT || 3000,
    // 認証チャンネル設定
    VERIFICATION_CHANNEL_ID: process.env.VERIFICATION_CHANNEL_ID || '',
    VERIFICATION_CHANNEL_NAME: 'nft-verification',
    VERIFICATION_URL: process.env.VERIFICATION_URL || '',
    // 管理者ユーザーID（ボット作成者）
    ADMIN_USER_ID: process.env.ADMIN_USER_ID || ''
};
// 設定のバリデーション
function validateConfig() {
    const requiredFields = [
        'DISCORD_TOKEN',
        'DISCORD_CLIENT_ID',
        'DISCORD_GUILD_ID',
        'DISCORD_ROLE_ID',
        'VERIFICATION_CHANNEL_ID',
        'VERIFICATION_URL'
    ];
    const missingFields = requiredFields.filter(field => !exports.config[field]);
    if (missingFields.length > 0) {
        console.error('❌ Missing required environment variables:', missingFields);
        console.error('Please check your .env file or environment variables');
        return false;
    }
    console.log('✅ All required configuration fields are set');
    return true;
}
//# sourceMappingURL=config.js.map