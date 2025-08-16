import { useWallet } from '@suiet/wallet-kit';

// ウォレットエラーハンドリング用のカスタムフック
export const useWalletWithErrorHandling = () => {
  try {
    return useWallet();
  } catch (error) {
    console.error('Wallet hook error:', error);
    return {
      account: null,
      connected: false,
      signPersonalMessage: null,
      connecting: false,
      select: () => {},
      disconnect: () => {},
      wallets: []
    };
  }
};

