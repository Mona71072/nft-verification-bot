export const config = {
  // Discord Bot設定
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '1400483007009394740',
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID || '1214855750917160960',
  DISCORD_ROLE_ID: process.env.DISCORD_ROLE_ID || '1400485848008491059',
  
  // Sui Network設定
  SUI_NETWORK: process.env.SUI_NETWORK || 'testnet',
  NFT_COLLECTION_ID: process.env.NFT_COLLECTION_ID || '0x1234567890abcdef::test_nft::NFT',
  
  // API設定
  API_BASE_URL: process.env.API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev',
  PORT: process.env.PORT || 3000,
  
  // 認証チャンネル設定
  VERIFICATION_CHANNEL_ID: '1400491600634708090',
  VERIFICATION_CHANNEL_NAME: 'nft-verification',
  VERIFICATION_URL: process.env.VERIFICATION_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev/verify.html',
  
  // 管理者ユーザーID（ボット作成者）
  // あなたのDiscord IDを設定してください (プロフィール右クリック → IDをコピー)
  ADMIN_USER_ID: process.env.ADMIN_USER_ID || '1000000000000000000' // TODO: 実際のIDに変更
};