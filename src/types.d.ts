declare module '@noble/ed25519';

// Cloudflare Env 拡張（生成ファイルを汚さないために追加定義で補完）
declare namespace Cloudflare {
  interface Env {
    DM_TEMPLATE_STORE?: KVNamespace;
    EVENT_STORE?: KVNamespace;
    MINTED_STORE?: KVNamespace;
    DISCORD_BOT_API_URL?: string;
    MINT_SPONSOR_API_URL?: string;
    SUI_NETWORK?: string;
    NFT_COLLECTION_ID?: string;
    DEFAULT_MOVE_TARGET?: string;
    DEFAULT_COLLECTION_CREATE_TARGET?: string;
    ADMIN_ADDRESSES?: string;
    ADMIN_API_KEY?: string;
    WALRUS_AGGREGATOR_BASE?: string;
    WALRUS_AGGREGATOR_FALLBACKS?: string;
    WALRUS_PUBLISHER_BASE?: string;
    WALRUS_PUBLISHER_AUTH?: string;
    WALRUS_PUBLISHER_JWT_SECRET?: string;
    WALRUS_DEFAULT_EPOCHS?: string;
    WALRUS_DEFAULT_PERMANENT?: string;
  }
}

