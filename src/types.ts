import { z } from 'zod';

// Environment variables
export interface Env {
  DISCORD_TOKEN: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_GUILD_ID: string;
  DISCORD_ROLE_ID: string;
  SUI_NETWORK: string;
  NFT_COLLECTION_ID: string;
  API_BASE_URL: string;
  VERIFICATION_URL: string;
  ADMIN_USER_ID: string;
  SXT_ROLES: KVNamespace;
  [key: string]: any; // インデックスシグネチャを追加
}

// Request body validation schemas
export const VerificationRequestSchema = z.object({
  signature: z.string().min(1, "Signature is required"),
  address: z.string().min(1, "Wallet address is required"),
  discordId: z.string().min(1, "Discord ID is required"),
  nonce: z.string().min(1, "Nonce is required"),
  message: z.string().optional(),
  walletType: z.string().optional(),
});

export const NonceRequestSchema = z.object({
  discordId: z.string().min(1, "Discord ID is required"),
  address: z.string().min(1, "Wallet address is required"),
});

// Type exports
export type VerificationRequest = z.infer<typeof VerificationRequestSchema>;
export type NonceRequest = z.infer<typeof NonceRequestSchema>;

// Discord Bot types
export interface DiscordRoleAssignment {
  success: boolean;
  message: string;
  discordId: string;
  address: string;
  roleName?: string;
}

// NFT Verification types
export interface NFTVerificationResult {
  hasNFT: boolean;
  collectionId: string;
  nftCount: number;
  error?: string;
}

// Sui NFT Object type
export interface SuiNftObject {
  id: string;
  type: string;
  owner: string;
  data: any;
  display: any;
  content: any;
}

// Wallet connection types
export interface WalletConnectionState {
  connected: boolean;
  address?: string;
  walletType?: string;
  error?: string;
}

// API Response types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Verification flow types
export interface VerificationFlow {
  step: 'connect' | 'verify' | 'complete' | 'error';
  discordId?: string;
  address?: string;
  nonce?: string;
  error?: string;
}

// Nonce management
export interface NonceData {
  nonce: string;
  discordId: string;
  address: string;
  createdAt: number;
  expiresAt: number;
}

// Discord Bot API interface
export interface DiscordBotAPI {
  grantRole: (discordId: string, roleId: string, token: string) => Promise<boolean>;
  revokeRole: (discordId: string, roleId: string, token: string) => Promise<boolean>;
  getUserInfo: (discordId: string, token: string) => Promise<any>;
  processRoleAssignment: (discordId: string, address: string, roleId: string, token: string) => Promise<DiscordRoleAssignment>;
  sendDM: (discordId: string, message: string) => Promise<boolean>;
} 