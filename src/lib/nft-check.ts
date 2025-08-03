import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import type { Env } from '../types';

/**
 * 指定されたアドレスがターゲットNFTを保有しているかチェック
 * @param address ウォレットアドレス
 * @param env 環境変数
 * @returns NFTを保有しているかどうか
 */
export async function hasTargetNft(address: string, env: Env): Promise<boolean> {
  try {
    console.log('Checking NFT ownership for address:', address);
    console.log('Using RPC URL:', env.SUI_NETWORK);
    console.log('Target collection ID:', env.NFT_COLLECTION_ID);
    
    const client = new SuiClient({
      url: getFullnodeUrl(env.SUI_NETWORK as 'mainnet' | 'testnet' | 'devnet')
    });

    // アドレスが所有するオブジェクトを取得
    const ownedObjects = await client.getOwnedObjects({
      owner: address,
      options: {
        showType: true,
        showContent: true,
        showOwner: true,
        showDisplay: true,
      }
    });

    console.log(`Found ${ownedObjects.data.length} objects for address: ${address}`);

    if (ownedObjects.data.length === 0) {
      console.log(`No objects found for address: ${address}`);
      return false;
    }

    // NFTコレクションIDが設定されている場合、特定のコレクションをチェック
    if (env.NFT_COLLECTION_ID && env.NFT_COLLECTION_ID !== '0x2::coin::Coin<0x2::sui::SUI>') {
      const targetNfts = ownedObjects.data.filter(obj => {
        const nft = obj.data;
        return nft && 
               nft.type && 
               nft.type.includes(env.NFT_COLLECTION_ID) &&
               nft.owner === address;
      });

      console.log(`Found ${targetNfts.length} target NFTs for collection: ${env.NFT_COLLECTION_ID}`);
      return targetNfts.length > 0;
    }

    // コレクションIDが設定されていない場合、NFTタイプのオブジェクトをチェック
    const nftObjects = ownedObjects.data.filter(obj => {
      const nft = obj.data;
      return nft && 
             nft.type && 
             nft.type.includes('::nft::') &&
             nft.owner === address;
    });

    console.log(`Found ${nftObjects.length} NFT objects for address: ${address}`);
    return nftObjects.length > 0;

  } catch (error) {
    console.error('Error checking NFT ownership:', error);
    return false;
  }
}

/**
 * 特定のNFTオブジェクトIDの所有者を確認
 * @param objectId NFTオブジェクトID
 * @param expectedOwner 期待される所有者アドレス
 * @param env 環境変数
 * @returns 所有者が一致するかどうか
 */
export async function verifyNftOwnership(
  objectId: string, 
  expectedOwner: string, 
  env: Env
): Promise<boolean> {
  try {
    const client = new SuiClient({
      url: getFullnodeUrl(env.SUI_NETWORK as 'mainnet' | 'testnet' | 'devnet')
    });

    const object = await client.getObject({
      id: objectId,
      options: {
        showOwner: true,
        showType: true,
        showContent: true,
        showDisplay: true
      }
    });

    if (!object.data) {
      console.log(`NFT object not found: ${objectId}`);
      return false;
    }

    const nft = object.data;
    const actualOwner = nft.owner;

    console.log(`NFT ownership verification: expected=${expectedOwner}, actual=${actualOwner}`);
    return actualOwner === expectedOwner;

  } catch (error) {
    console.error('Error verifying NFT ownership:', error);
    return false;
  }
}

/**
 * コレクション内のNFT数を取得
 * @param address ウォレットアドレス
 * @param env 環境変数
 * @returns 保有NFT数
 */
export async function getNftCount(address: string, env: Env): Promise<number> {
  try {
    const client = new SuiClient({
      url: getFullnodeUrl(env.SUI_NETWORK as 'mainnet' | 'testnet' | 'devnet')
    });

    let filter = undefined;
    
    // 特定のコレクションIDが設定されている場合
    if (env.NFT_COLLECTION_ID && env.NFT_COLLECTION_ID !== '0x2::coin::Coin<0x2::sui::SUI>') {
      filter = {
        StructType: env.NFT_COLLECTION_ID
      };
    }

    const ownedObjects = await client.getOwnedObjects({
      owner: address,
      filter: filter,
      options: {
        showType: true,
        showContent: true,
        showDisplay: true
      }
    });

    // フィルタが設定されていない場合、NFTタイプのオブジェクトのみをカウント
    if (!filter) {
      const nftObjects = ownedObjects.data.filter(obj => {
        const nft = obj.data;
        return nft && nft.type && nft.type.includes('::nft::');
      });
      return nftObjects.length;
    }

    return ownedObjects.data.length;

  } catch (error) {
    console.error('Error getting NFT count:', error);
    return 0;
  }
} 