import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { createNetworkConfig, SuiClientProvider, WalletProvider } from '@mysten/dapp-kit'
import { getFullnodeUrl } from '@mysten/sui/client'
import { registerSlushWallet } from '@mysten/slush-wallet'
import '@mysten/dapp-kit/dist/index.css'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { queryClient } from './lib/query-client'

// グローバルエラーハンドリング（最小限・安全）
window.addEventListener('error', (event) => {
  // サードパーティinpageスクリプト由来のみ抑制
  if (event.filename?.includes('inpage-script.js')) {
    event.preventDefault();
    return false;
  }
});

// エラーハンドリングを追加
const rootElement = document.getElementById('root');

if (!rootElement) {
  const fallbackRoot = document.createElement('div');
  fallbackRoot.id = 'root';
  document.body.appendChild(fallbackRoot);
}

// Slush Wallet を最初期に登録（公式パターン）
try {
  registerSlushWallet('SyndicateXTokyo', { network: 'mainnet' as const });
} catch (e) {
  // Error handling without logging
}

// ネットワーク設定を作成（公式のcreateNetworkConfigを使用）
const { networkConfig } = createNetworkConfig({
  mainnet: { url: getFullnodeUrl('mainnet') },
  testnet: { url: getFullnodeUrl('testnet') },
});

// WalletProviderの初期化エラーをキャッチするためにErrorBoundaryで囲む
// Exported as const to satisfy react-refresh rules
export const AppWithErrorBoundary = () => {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SuiClientProvider networks={networkConfig} defaultNetwork="mainnet">
          <WalletProvider 
            autoConnect={true}
            storageKey="sui:wallet"
            slushWallet={{ name: 'SyndicateXTokyo' }}
          >
            <App />
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
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
  // フォールバック: シンプルなエラーメッセージを表示（innerHTMLではなくDOM要素で安全に構築）
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
  
  const container = document.createElement('div');
  
  const title = document.createElement('h1');
  title.textContent = 'アプリケーションエラー';
  container.appendChild(title);
  
  const message = document.createElement('p');
  message.textContent = 'ページを再読み込みしてください。';
  container.appendChild(message);
  
  const reloadButton = document.createElement('button');
  reloadButton.textContent = '再読み込み';
  reloadButton.style.cssText = `
    padding: 0.75rem 1.5rem;
    background: white;
    color: #667eea;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    margin-top: 1rem;
  `;
  reloadButton.addEventListener('click', () => window.location.reload());
  container.appendChild(reloadButton);
  
  errorDiv.appendChild(container);
  document.body.appendChild(errorDiv);
}