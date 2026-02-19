/**
 * IPFS URL変換ユーティリティ
 * ipfs.io は不安定なため、より安定したゲートウェイを使用
 */

export const IPFS_GATEWAYS = [
  'https://ipfs.io',  // このCIDで動作確認済み
  'https://dweb.link',
  'https://w3s.link',
  'https://nftstorage.link',
  'https://gateway.pinata.cloud',
];

const DEFAULT_GATEWAY =
  import.meta.env.VITE_IPFS_GATEWAY || IPFS_GATEWAYS[0];

/** 任意のIPFS URLからCIDを抽出 */
export const extractCid = (url: string | undefined): string | null => {
  if (!url) return null;
  const m = url.match(/\/ipfs\/([a-zA-Z0-9]+)/) || url.match(/^(Qm[1-9A-HJ-NP-Za-km-z]{44,}|bafy[a-zA-Z0-9]+)$/);
  return m ? m[1] : null;
};

/** CIDに対する全ゲートウェイURLを返す（フォールバック用） */
export const getIpfsGatewayUrls = (url: string | undefined): string[] => {
  const cid = extractCid(url) || (url || '').replace(/^ipfs:\/+/, '').replace(/^https?:\/\/[^/]+\/ipfs\//, '');
  if (!cid || !/^[a-zA-Z0-9]+$/.test(cid)) return url ? [url] : [];
  return IPFS_GATEWAYS.map(g => `${g}/ipfs/${cid}`);
};

/**
 * IPFS URLをHTTPゲートウェイURLに変換
 * ipfs:// や CID をブラウザで取得可能なURLに変換する
 */
export const convertIpfsUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined;

  // 既存の ipfs.io / gateway のURLを安定したゲートウェイに置き換え
  const ipfsGatewayMatch = url.match(/^https?:\/\/([^/]+)\/ipfs\/([a-zA-Z0-9]+)/);
  if (ipfsGatewayMatch) {
    return `${DEFAULT_GATEWAY}/ipfs/${ipfsGatewayMatch[2]}`;
  }

  // ipfs:// 形式
  if (url.startsWith('ipfs://')) {
    const hash = url.replace('ipfs://', '').replace(/^\/+/, '');
    return `${DEFAULT_GATEWAY}/ipfs/${hash}`;
  }

  // /ipfs/ を含む相対形式
  if (url.startsWith('/ipfs/')) {
    const hash = url.replace('/ipfs/', '');
    return `${DEFAULT_GATEWAY}/ipfs/${hash}`;
  }

  // CID のみの形式 (Qm... や bafy... など)
  if (/^(Qm[1-9A-HJ-NP-Za-km-z]{44,}|bafy[a-zA-Z0-9]+)$/.test(url)) {
    return `${DEFAULT_GATEWAY}/ipfs/${url}`;
  }

  return url;
};
