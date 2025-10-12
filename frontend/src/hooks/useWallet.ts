import { 
  useCurrentAccount,
  useDisconnectWallet,
  useConnectWallet,
  useSignPersonalMessage,
} from '@mysten/dapp-kit';

// ウォレットエラーハンドリング用のカスタムフック
export const useWalletWithErrorHandling = () => {
  try {
    const account = useCurrentAccount();
    const { mutate: disconnect } = useDisconnectWallet();
    const { mutate: connect } = useConnectWallet();
    const { mutateAsync: signPersonalMessageMutate } = useSignPersonalMessage();

    const signPersonalMessage = async ({ message }: { message: Uint8Array }) => {
      // dapp-kit returns signature bytes; adapt to existing shape
      const res = await signPersonalMessageMutate({ message });
      // Normalizing to { signature, bytes } as used elsewhere
      return {
        signature: (res as any)?.signature || (res as any)?.bytes || (res as any),
        bytes: (res as any)?.bytes || (res as any)?.signature || (res as any),
      } as any;
    };

    return {
      account,
      connected: !!account,
      signPersonalMessage,
      connecting: false,
      select: () => connect(),
      disconnect: () => disconnect(),
      wallets: [],
    } as any;
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

