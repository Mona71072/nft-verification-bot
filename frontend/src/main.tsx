import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit'
import { getFullnodeUrl } from '@mysten/sui/client'
import { registerSlushWallet } from '@mysten/slush-wallet'
import '@mysten/dapp-kit/dist/index.css'
import './index.css'
import App from './App.tsx'

// グローバルエラーハンドリング（最小限・安全）
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // サードパーティinpageスクリプト由来のみ抑制
  if (event.filename?.includes('inpage-script.js')) {
    console.log('Third-party inpage-script error suppressed');
    event.preventDefault();
    return false;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // 抑制は行わずログのみ
});

// エラーハンドリングを追加
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('Root element not found, creating fallback');
  const fallbackRoot = document.createElement('div');
  fallbackRoot.id = 'root';
  document.body.appendChild(fallbackRoot);
}

// Slush Wallet を最初期に登録（公式パターン）
try {
  registerSlushWallet('SyndicateXTokyo', { network: 'mainnet' as const });
} catch (e) {
  console.warn('registerSlushWallet skipped:', e);
}

// ネットワーク設定を作成（公式のcreateNetworkConfigを使用）
const { networkConfig } = createNetworkConfig({
  mainnet: { url: getFullnodeUrl('mainnet') },
  testnet: { url: getFullnodeUrl('testnet') },
});

const queryClient = new QueryClient();

// WalletProviderの初期化エラーをキャッチ
const AppWithErrorBoundary = () => {
  try {
    return (
      <QueryClientProvider client={queryClient}>
        <SuiClientProvider networks={networkConfig} defaultNetwork="mainnet">
          <WalletProvider autoConnect slushWallet={{ name: 'SyndicateXTokyo' }}>
            <App />
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    );
  } catch (error) {
    console.error('WalletProvider initialization error:', error);
    // フォールバック: WalletProviderなしでアプリを表示
    return <App />;
  }
};

// アプリケーションの初期化
try {
  const root = createRoot(rootElement || document.getElementById('root') || document.body);
  root.render(
    <StrictMode>
      <AppWithErrorBoundary />
    </StrictMode>
  );
} catch (error) {
  console.error('Failed to render app:', error);
  // フォールバック: シンプルなエラーメッセージを表示
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-family: system-ui, -apple-system, sans-serif;
    text-align: center;
    padding: 2rem;
  `;
  errorDiv.innerHTML = `
    <div>
      <h1>アプリケーションエラー</h1>
      <p>ページを再読み込みしてください。</p>
      <button onclick="window.location.reload()" style="
        padding: 0.75rem 1.5rem;
        background: white;
        color: #667eea;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        margin-top: 1rem;
      ">再読み込み</button>
    </div>
  `;
  document.body.appendChild(errorDiv);
}