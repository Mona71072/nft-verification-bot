// ウォレット関連のフックを安全に使用
import { 
  useCurrentAccount,
  useDisconnectWallet,
  useConnectWallet,
  useSignPersonalMessage,
} from '@mysten/dapp-kit';

// 署名結果の型定義
interface SignatureResult {
  signature: string | Uint8Array;
  bytes: Uint8Array;
  publicKey?: string;
}

// ウォレット状態の型定義
interface WalletState {
  account: unknown; // useCurrentAccountの戻り値の型をunknownに変更
  connected: boolean;
  signPersonalMessage: (params: { message: Uint8Array }) => Promise<SignatureResult>;
  connecting: boolean;
  select: () => void;
  disconnect: () => void;
  wallets: unknown[];
}

// ウォレットエラーハンドリング用のカスタムフック
export const useWalletWithErrorHandling = (): WalletState => {
  // WalletProviderの存在を確認してからフックを呼び出し
  let account: unknown = null;
  let connected = false;
  let disconnect: () => void = () => {};
  let connectMutate: (args?: unknown) => void = () => {};
  let signMutateAsync: (params: { message: Uint8Array }) => Promise<SignatureResult> = async () => ({
    signature: '',
    bytes: new Uint8Array(),
    publicKey: undefined
  });
  
  try {
    // WalletProvider内でのみ使用されることを前提とする
    account = useCurrentAccount();
    connected = !!account;
    
    const disconnectResult = useDisconnectWallet();
    const connectResult = useConnectWallet();
    const signResult = useSignPersonalMessage();
    
    disconnect = disconnectResult?.mutate || (() => {});
    connectMutate = (args?: unknown) => {
      try {
        (connectResult?.mutate as ((args?: unknown) => void) || (() => {}))(args);
      } catch (error) {
        // Error handling without logging
      }
    };
    signMutateAsync = async (params: { message: Uint8Array }) => {
      const result = await (signResult?.mutateAsync || (async () => ({
        signature: '',
        bytes: '',
      })))(params);
      
      return {
        signature: result.signature,
        bytes: typeof result.bytes === 'string' ? new TextEncoder().encode(result.bytes) : result.bytes,
        publicKey: undefined
      };
    };
  } catch (error) {
    // エラーが発生してもアプリは継続動作
    account = null;
    connected = false;
  }

  // ウォレット接続用のヘルパー関数
  const connect = () => {
    try {
      connectMutate({});
    } catch (error) {
      // Error handling without logging
    }
  };

  // 署名用のヘルパー関数
  const signMessage = async ({ message }: { message: Uint8Array }): Promise<SignatureResult> => {
    try {
      const result = await signMutateAsync({ message });
      return result;
    } catch (error) {
      throw error;
    }
  };

  return {
    account,
    connected,
    signPersonalMessage: signMessage,
    connecting: false,
    select: connect,
    disconnect: () => {
      try {
        disconnect();
      } catch (error) {
        // Error handling without logging
      }
    },
    wallets: []
  };
};

