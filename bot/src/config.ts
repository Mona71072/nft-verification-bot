export const config = {
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
  // あなたのDiscord IDを設定してください (プロフィール右クリック → IDをコピー)
  ADMIN_USER_ID: process.env.ADMIN_USER_ID || ''
};