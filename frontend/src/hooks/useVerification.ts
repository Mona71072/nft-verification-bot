import { useState } from 'react';
import type { VerificationResult, VerifiedUser } from '../types';

// 認証処理のカスタムフック
export const useVerification = (apiBaseUrl: string) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const checkIfUserIsVerified = async (discordId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/verified-users`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return data.data.some((user: VerifiedUser) => user.discordId === discordId);
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking verified user status:', error);
      return false;
    }
  };

  const handleVerifyNFT = async (
    account: any,
    signPersonalMessage: any,
    discordId: string,
    selectedCollections: string[]
  ) => {
    if (!account || !signPersonalMessage) {
      setVerificationResult({
        success: false,
        message: 'Wallet is not connected. Please connect your wallet.'
      });
      return;
    }

    if (!discordId.trim()) {
      setVerificationResult({
        success: false,
        message: 'Please enter your Discord ID.'
      });
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      // 1. ナンス生成
      const nonceResponse = await fetch(`${apiBaseUrl}/api/nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: discordId.trim(),
          address: account.address
        })
      });

      const nonceData = await nonceResponse.json();
      if (!nonceData.success) {
        throw new Error(nonceData.error || 'Failed to generate nonce.');
      }

      const nonce = nonceData.data.nonce;

      // 2. 署名メッセージの生成
      const timestamp = new Date().toISOString();
      const authMessage = `SXT NFT Verification\naddress=${account.address}\ndiscordId=${discordId.trim()}\nnonce=${nonce}\ntimestamp=${timestamp}`;

      // 3. メッセージを署名
      const messageBytes = new TextEncoder().encode(authMessage);
      const signatureResult = await signPersonalMessage({
        message: messageBytes
      }).catch((error: unknown) => {
        console.error('Signature error:', error);
        throw new Error('Signature failed. Please approve the signature in your wallet.');
      });

      // 4. バックエンドに送信
      const requestBody = {
        signature: signatureResult.signature,
        bytes: signatureResult.bytes,
        publicKey: (signatureResult as any)?.publicKey ?? (account as any)?.publicKey,
        address: account.address,
        discordId: discordId.trim(),
        nonce: nonce,
        authMessage: authMessage,
        walletType: 'Generic',
        collectionIds: selectedCollections
      };

      const response = await fetch(`${apiBaseUrl}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (data.success) {
        // 認証済みユーザーかどうかをチェック
        const isAlreadyVerified = await checkIfUserIsVerified(discordId);
        
        if (isAlreadyVerified) {
          setVerificationResult({
            success: true,
            message: `Verification updated! Role "${data.data?.roleName || 'NFT Holder'}" has been updated.`
          });
        } else {
          setVerificationResult({
            success: true,
            message: `Verification completed! Role "${data.data?.roleName || 'NFT Holder'}" has been assigned to your account.`
          });
        }
      } else {
        // サーバーからのエラーに応じたわかりやすい文言
        const code = (data.errorCode as string) || '';
        const msg = typeof data.error === 'string' ? data.error : '';
        const notOwned = code === 'NO_NFTS' || msg.includes('No NFTs found');
        const invalidSig = code === 'INVALID_SIGNATURE' || msg.includes('Invalid signature');
        setVerificationResult({
          success: false,
          message: notOwned
            ? 'No NFTs from the target collection were found in your wallet.'
            : invalidSig
              ? 'Signature validation failed. Please try another wallet or browser. If the issue persists, contact an administrator.'
              : (data.error || 'Verification failed.')
        });
      }

    } catch (error) {
      console.error('Verification error:', error);
      setVerificationResult({
        success: false,
        message: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return {
    isVerifying,
    verificationResult,
    handleVerifyNFT
  };
};

