export interface Env {
  DISCORD_TOKEN: string;
  DISCORD_GUILD_ID: string;
  DISCORD_ROLE_ID: string;
  SUI_NETWORK: string;
  NFT_COLLECTION_ID: string;
  NONCE_KV: KVNamespace;
  ASSETS: Fetcher;
  [key: string]: any;
}

export interface ReqBody {
  wallet_address: string;
  discord_id: string;
  signature: string;
  nonce: string;
}

export interface VerificationResult {
  success: boolean;
  message: string;
  has_nft?: boolean;
  role_granted?: boolean;
}

export interface SuiNftObject {
  objectId: string;
  version: string;
  digest: string;
  type: string;
  owner: {
    AddressOwner?: string;
    ObjectOwner?: string;
    Shared?: { initial_shared_version: number };
  };
  content?: {
    dataType: string;
    type: string;
    fields: Record<string, any>;
  };
}

export interface NonceData {
  nonce: string;
  created_at: number;
  expires_at: number;
} 