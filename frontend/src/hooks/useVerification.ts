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
        message: 'ウォレットが接続されていません。ウォレットを接続してください。'
      });
      return;
    }

    if (!discordId.trim()) {
      setVerificationResult({
        success: false,
        message: 'Discord IDを入力してください。'
      });
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      // 1. ナンス生成
      console.log('Requesting nonce...');
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
        throw new Error(nonceData.error || 'ナンス生成に失敗しました。');
      }

      const nonce = nonceData.data.nonce;
      console.log('Nonce received:', nonce);

      // 2. 署名メッセージの生成
      const timestamp = new Date().toISOString();
      const authMessage = `SXT NFT Verification\naddress=${account.address}\ndiscordId=${discordId.trim()}\nnonce=${nonce}\ntimestamp=${timestamp}`;
      console.log('Auth message:', authMessage);

      // 3. メッセージを署名
      console.log('Requesting signature...');
      const messageBytes = new TextEncoder().encode(authMessage);
      const signatureResult = await signPersonalMessage({
        message: messageBytes
      }).catch((error: unknown) => {
        console.error('Signature error:', error);
        throw new Error('署名に失敗しました。ウォレットで署名を承認してください。');
      });

      console.log('Signature result:', signatureResult);

      // 4. バックエンドに送信
      const requestBody = {
        signature: signatureResult.signature,
        bytes: signatureResult.bytes, // ウォレットが実際に署名したbytesを使用
        publicKey: (signatureResult as any)?.publicKey ?? (account as any)?.publicKey,
        address: account.address,
        discordId: discordId.trim(),
        nonce: nonce,
        authMessage: authMessage,
        walletType: 'Generic',
        collectionIds: selectedCollections
      };

      console.log('Sending verification request:', requestBody);

      const response = await fetch(`${apiBaseUrl}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log('Verification response:', data);

      if (data.success) {
        // 認証済みユーザーかどうかをチェック
        const isAlreadyVerified = await checkIfUserIsVerified(discordId);
        
        if (isAlreadyVerified) {
          setVerificationResult({
            success: true,
            message: `認証の更新が完了しました！ロール "${data.data?.roleName || 'NFT Holder'}" が更新されました。`
          });
        } else {
          setVerificationResult({
            success: true,
            message: `認証が完了しました！ロール "${data.data?.roleName || 'NFT Holder'}" がアカウントに割り当てられました。`
          });
        }
      } else {
        // サーバーからのエラーに応じたわかりやすい文言（errorCode優先）
        const code = (data.errorCode as string) || '';
        const msg = typeof data.error === 'string' ? data.error : '';
        const notOwned = code === 'NO_NFTS' || msg.includes('No NFTs found');
        const invalidSig = code === 'INVALID_SIGNATURE' || msg.includes('Invalid signature');
        setVerificationResult({
          success: false,
          message: notOwned
            ? '対象コレクションのNFTを保有していません。ウォレット内の保有状況をご確認ください。'
            : invalidSig
              ? '署名の確認に失敗しました。別のウォレット（Suiet / Surf など）またはブラウザでお試しください。改善しない場合は管理者にお問い合わせください。'
              : (data.error || '認証に失敗しました。')
        });
      }

    } catch (error) {
      console.error('Verification error:', error);
      setVerificationResult({
        success: false,
        message: `エラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}`
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

