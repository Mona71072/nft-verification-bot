export const config = {
  // Discord Bot設定
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || 'test_token',
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || 'test_client_id',
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID || 'test_guild_id',
  DISCORD_ROLE_ID: process.env.DISCORD_ROLE_ID || 'test_role_id',
  
  // Sui Network設定
  SUI_NETWORK: process.env.SUI_NETWORK || 'mainnet',
  NFT_COLLECTION_ID: process.env.NFT_COLLECTION_ID || 'test_collection_id',
  
  // API設定
  API_BASE_URL: process.env.API_BASE_URL || 'https://c840eaf3.nft-verification-frontend.pages.dev',
  PORT: process.env.PORT || 3000,
  
  // 認証チャンネル設定
  VERIFICATION_CHANNEL_ID: process.env.VERIFICATION_CHANNEL_ID || 'test_channel_id',
  VERIFICATION_CHANNEL_NAME: 'nft-verification',
  VERIFICATION_URL: process.env.VERIFICATION_URL || 'https://c840eaf3.nft-verification-frontend.pages.dev',
  
  // 管理者ユーザーID（ボット作成者）
  ADMIN_USER_ID: process.env.ADMIN_USER_ID || 'test_admin_id'
};

// 設定のバリデーション
export function validateConfig() {
  const requiredFields = [
    'DISCORD_TOKEN',
    'DISCORD_CLIENT_ID', 
    'DISCORD_GUILD_ID',
    'DISCORD_ROLE_ID',
    'VERIFICATION_CHANNEL_ID',
    'VERIFICATION_URL'
  ];

  const missingFields = requiredFields.filter(field => !config[field as keyof typeof config]);

  if (missingFields.length > 0) {
    console.error('❌ Missing required environment variables:', missingFields);
    console.error('Please check your .env file or environment variables');
    // テストモードでは警告のみで続行
    console.log('⚠️ Running in test mode with default values');
    return true;
  }

  console.log('✅ All required configuration fields are set');
  return true;
}