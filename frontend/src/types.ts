// NFTコレクション型定義
export interface NFTCollection {
  id: string;
  name: string;
  packageId: string;
  roleId: string;
  roleName: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

// 認証済みユーザー型定義
export interface VerifiedUser {
  discordId: string;
  address: string;
  collectionId: string;
  roleId: string;
  roleName: string;
  verifiedAt: string;
  lastChecked: string;
}

// 認証結果型定義
export interface VerificationResult {
  success: boolean;
  message: string;
}

// Discordロール型定義
export interface DiscordRole {
  id: string;
  name: string;
}

// バッチ処理統計型定義
export interface BatchStats {
  totalUsers: number;
  processed: number;
  revoked: number;
  errors: number;
  lastRun: string;
  duration: number;
}

// バッチ処理設定型定義
export interface BatchConfig {
  enabled: boolean;
  interval: number;
  lastRun: string;
  nextRun: string;
  maxUsersPerBatch: number;
  retryAttempts: number;
}

