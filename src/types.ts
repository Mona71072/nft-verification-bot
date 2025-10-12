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

// デフォルト設定
export const DEFAULT_DM_SETTINGS: DmSettings = {
  mode: 'all',
  batchMode: 'new_and_revoke',
  templates: {
    successNew: {
      title: '🎉 Verification Completed',
      description: '**Your NFT verification is complete!**\\n\\n**Verified NFT Collection:**\\n• {collectionName}\\n\\n**Granted Roles:**\\n• {roles}\\n\\nIt may take a moment for roles to appear in the server.\\n\\nThank you for verifying!',
      color: 0x00ff00
    },
    successUpdate: {
      title: '🔄 Verification Updated',
      description: '**Your NFT verification has been updated!**\\n\\n**Verified NFT Collection:**\\n• {collectionName}\\n\\n**Updated Roles:**\\n• {roles}\\n\\nIt may take a moment for roles to appear in the server.\\n\\nThank you!',
      color: 0x0099ff
    },
    failed: {
      title: '❌ Verification Failed',
      description: '**Verification failed.**\\n\\nPlease check the following and try again:\\n• You hold the target collection NFT\\n• You are connected with the correct wallet\\n• Your network connection is stable\\n\\nIf the issue persists, please contact an administrator.',
      color: 0xff0000
    },
    revoked: {
      title: '⚠️ Role Revoked',
      description: '**Your role has been revoked because your NFT ownership could not be confirmed.**\\n\\n**Revoked Roles:**\\n• {roles}\\n\\n**How to restore:**\\n• If you reacquire the NFT, please re-verify from the verification channel\\n• If you changed wallets, please verify with the new wallet\\n\\nIf you have any questions, please contact an administrator.',
      color: 0xff6600
    }
  },
  channelTemplates: {
    verificationChannel: {
      title: '🎫 NFT Verification System',
      description: 'This system grants roles to users who hold NFTs on the Sui network.\\n\\nClick the button below to start verification.',
      color: 0x57F287
    },
    verificationStart: {
      title: '🎫 NFT Verification',
      description: 'Starting verification...\\n\\n⚠️ **Note:** Wallet signatures are safe. We only verify NFT ownership and do not move any assets.',
      color: 0x57F287
    },
    verificationUrl: 'https://syndicatextokyo.app'
  }
};

// バッチ処理設定の型定義
export interface BatchConfig {
  enabled: boolean;
  interval: number;
  lastRun: string;
  nextRun: string;
  maxUsersPerBatch: number;
  retryAttempts: number;
  enableDmNotifications: boolean;
  collectionId?: string;
}

export interface BatchStats {
  totalUsers: number;
  processed: number;
  revoked: number;
  errors: number;
  lastRun: string;
  duration: number;
}

// デフォルトバッチ設定
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  enabled: false,
  interval: 86400, // 24時間（秒）
  lastRun: '',
  nextRun: '',
  maxUsersPerBatch: 100,
  retryAttempts: 3,
  enableDmNotifications: true
};
