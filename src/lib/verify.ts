/**
 * Sui walletからの署名を検証する（開発用実装）
 * @param address ウォレットアドレス
 * @param nonce 署名対象のナンス
 * @param signature Base64エンコードされた署名
 * @returns 署名が有効かどうか
 */
export async function verifySignedMessage(
  address: string,
  nonce: string,
  signature: string
): Promise<boolean> {
  try {
    console.log(`Verifying signature for address: ${address}, nonce: ${nonce}`);
    
    // 署名が空でないことを確認
    if (!signature || signature.trim() === '') {
      console.error('Empty signature provided');
      return false;
    }

    // 開発用: 署名が存在し、適切な形式であれば有効とする
    if (signature.startsWith('0x') || signature.length >= 64) {
      console.log('Development mode: Signature verification passed');
      return true;
    }

    console.log('Signature verification failed: invalid format');
    return false;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * ナンスの有効性を検証する
 * @param nonce 検証するナンス
 * @param storedNonceData 保存されたナンスデータ
 * @returns ナンスが有効かどうか
 */
export function validateNonce(nonce: string, storedNonceData: string): boolean {
  try {
    const data = JSON.parse(storedNonceData);
    const now = Date.now();
    
    return data.nonce === nonce && now < data.expires_at;
  } catch (error) {
    console.error('Nonce validation error:', error);
    return false;
  }
}

/**
 * メッセージ生成（フロントエンド用）
 * @param nonce ナンス
 * @param address ウォレットアドレス
 * @returns 署名対象のメッセージ
 */
export function generateVerificationMessage(nonce: string, address: string): string {
  return `Verify NFT ownership for Discord role.\nNonce: ${nonce}\nAddress: ${address}`;
} 