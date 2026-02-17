// ウォレット関連のフックを安全に使用
import { 
  useCurrentAccount,
  useCurrentWallet,
  useWallets,
  useDisconnectWallet,
  useConnectWallet,
  useSignPersonalMessage,
} from '@mysten/dapp-kit';
import { useCallback, useMemo } from 'react';

// 署名結果の型定義
interface SignatureResult {
  signature: string | Uint8Array;
  bytes: Uint8Array;
  publicKey?: string;
}

// ウォレット状態の型定義
type AccountType = ReturnType<typeof useCurrentAccount>;
type WalletsArray = ReturnType<typeof useWallets>;
type WalletItem = WalletsArray extends Array<infer Item> ? Item : never;

interface WalletState {
  account: AccountType;
  currentWallet: WalletItem | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  connected: boolean;
  connecting: boolean;
  signPersonalMessage: (params: { message: Uint8Array }) => Promise<SignatureResult>;
  select: (wallet?: WalletItem) => Promise<void>;
  disconnect: () => Promise<void>;
  wallets: WalletsArray;
}

// ウォレットエラーハンドリング用のカスタムフック
export const useWalletWithErrorHandling = (): WalletState => {
  // WalletProviderの存在を確認してからフックを呼び出し
  let account: AccountType = null;
  let walletInfo:
    | ReturnType<typeof useCurrentWallet>
    | null = null;
  let wallets: WalletsArray = [] as WalletsArray;
  let connectMutation: ReturnType<typeof useConnectWallet> | null = null;
  let disconnectMutation: ReturnType<typeof useDisconnectWallet> | null = null;
  let signMutation: ReturnType<typeof useSignPersonalMessage> | null = null;

  try {
    account = useCurrentAccount();
    walletInfo = useCurrentWallet();
    wallets = useWallets();
    connectMutation = useConnectWallet();
    disconnectMutation = useDisconnectWallet();
    signMutation = useSignPersonalMessage();
  } catch (error) {
    account = null;
    walletInfo = null;
    wallets = [] as WalletsArray;
    connectMutation = null;
    disconnectMutation = null;
    signMutation = null;
  }

  const connectionStatus = walletInfo?.connectionStatus ?? 'disconnected';
  const currentWallet = walletInfo?.currentWallet ?? null;
  const connected = connectionStatus === 'connected' && !!account;
  const isConnecting = walletInfo?.isConnecting ?? connectMutation?.isPending ?? false;

  const connect = useCallback(
    async (wallet?: WalletItem) => {
      if (!connectMutation) {
        throw new Error('Wallet provider is not available.');
      }

      const targetWallet = wallet ?? wallets[0];
      if (!targetWallet) {
        throw new Error('No wallet is available to connect.');
      }

      await connectMutation.mutateAsync({ wallet: targetWallet });
    },
    [connectMutation, wallets]
  );

  const disconnect = useCallback(async () => {
    if (!disconnectMutation) {
      return;
    }

    try {
      await disconnectMutation.mutateAsync();
    } catch (error) {
      // Error handling without logging
    }
  }, [disconnectMutation]);

  const signPersonalMessage = useCallback(
    async ({ message }: { message: Uint8Array }): Promise<SignatureResult> => {
      if (!signMutation) {
        throw new Error('Wallet provider is not available.');
      }

      const result = await signMutation.mutateAsync({ message });
      return {
        signature: result.signature,
        bytes:
          typeof result.bytes === 'string'
            ? new TextEncoder().encode(result.bytes)
            : result.bytes,
        publicKey: (result as unknown as { publicKey?: string }).publicKey,
      };
    },
    [signMutation]
  );

  return useMemo(
    () => ({
      account,
      currentWallet,
      connectionStatus,
      connected,
      connecting: isConnecting,
      signPersonalMessage,
      select: connect,
      disconnect,
      wallets,
    }),
    [
      account,
      connect,
      connected,
      connectionStatus,
      disconnect,
      isConnecting,
      signPersonalMessage,
      wallets,
      currentWallet,
    ]
  );
};

