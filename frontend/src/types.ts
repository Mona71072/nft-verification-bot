// NFTコレクション型定義
export interface NFTCollection {
  id: string;
  name: string;
  symbol?: string;
  typePath?: string;
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
  lastChecked?: string;
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
  color: number;
  position: number;
  permissions: string[];
  mentionable: boolean;
  hoist: boolean;
}

// バッチ処理統計型定義
export interface BatchStats {
  totalUsers: number;
  processed: number;
  success?: number;
  failed?: number;
  remaining?: number;
  revoked: number;
  errors: number;
  lastRun: string;
  duration: number;
}

// バッチ処理設定型定義
export interface BatchConfig {
  batchSize?: number;
  delayMs?: number;
  maxRetries?: number;
  targetCollection?: string;
  operation?: string;
  enabled: boolean;
  interval: number;
  lastRun: string;
  nextRun: string;
  maxUsersPerBatch: number;
  retryAttempts: number;
  enableDmNotifications: boolean;
  collectionId?: string; // ロール管理用コレクションID
}

// DM通知設定の型定義
export type DmMode = 'all' | 'new_and_revoke' | 'update_and_revoke' | 'revoke_only' | 'none';

export interface DmTemplate {
  title: string;
  description: string;
  color?: number;
}

export interface DmTemplates {
  successNew: DmTemplate;
  successUpdate: DmTemplate;
  failed: DmTemplate;
  revoked: DmTemplate;
}

export interface ChannelTemplates {
  verificationChannel: DmTemplate;
  verificationStart: DmTemplate;
  verificationUrl?: string;
}

export interface DmSettings {
  mode: DmMode; // 通常認証時のDM通知モード
  batchMode: DmMode; // バッチ処理時のDM通知モード
  templates: DmTemplates;
  channelTemplates: ChannelTemplates;
}

// デフォルトバッチ設定
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  enabled: false,
  interval: 86400, // 24時間（秒）
  lastRun: '',
  nextRun: '',
  maxUsersPerBatch: 100,
  retryAttempts: 3,
  enableDmNotifications: true,
  collectionId: '' // デフォルトは未設定
};

// 管理UI用のイベント型
export interface AdminMintEvent {
  id: string;
  name: string;
  description?: string;
  collectionId: string;
  selectedCollectionId?: string;
  imageUrl?: string;
  imageCid?: string;
  imageMimeType?: string;
  imageStorageEpochs?: number; // Walrus保存期間（epochs）
  imageStorageExpiry?: string; // 画像保存期限（ISO日付）
  active: boolean;
  startAt: string; // ISO
  endAt: string;   // ISO
  moveCall?: {
    target?: string;
    typeArguments?: string[];
    argumentsTemplate?: string[];
    gasBudget?: number;
  };
  totalCap?: number;
  totalMints?: number;
  createdAt?: string;
  updatedAt?: string;
  mintedCount?: number;
}

// 表示設定型定義
export interface DisplaySettings {
  enabledCollections: string[]; // コレクションIDの配列
  enabledEvents: string[]; // イベントIDの配列
  customNFTTypes: string[]; // NFTタイプ（packageId::module::StructName）の配列
  includeKiosk: boolean; // Kiosk所有NFTを含めるか
  collectionDisplayNames?: Record<string, string>; // ALLタブ表示名
  collectionImageUrls?: Record<string, string>; // コレクションごとの画像URL
  collectionDetailUrls?: Record<string, string>; // コレクションごとの詳細URL
  collectionLayouts?: Array<{
    id: string;
    title: string;
    subtitle?: string;
    imageUrl?: string;
    collectionIds: string[];
  }>;
  collectionInfo?: Record<string, { // コレクション情報（キーは正規化されたコレクションID）
    packageId: string; // パッケージID
    collectionId: string; // コレクションID（正規化されたID）
    name: string; // コレクション名
    nftType: string; // NFTタイプ（packageId::module::StructName）
  }>;
}



