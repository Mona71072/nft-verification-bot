import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WalletProvider } from '@suiet/wallet-kit'
import '@suiet/wallet-kit/style.css'
import './index.css'
import App from './App.tsx'

// グローバルエラーハンドリング
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // ウォレット関連のエラーの場合は無視
  if (event.error?.message?.includes('register') || 
      event.error?.message?.includes('wallet') ||
      event.error?.message?.includes('@suiet')) {
    console.log('Wallet-related error ignored:', event.error.message);
    event.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // ウォレット関連のエラーの場合は無視
  if (event.reason?.message?.includes('register') || 
      event.reason?.message?.includes('wallet') ||
      event.reason?.message?.includes('@suiet')) {
    console.log('Wallet-related promise rejection ignored:', event.reason.message);
    event.preventDefault();
  }
});

// エラーハンドリングを追加
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

// WalletProviderの初期化エラーをキャッチ
export const AppWithErrorBoundary = () => {
  try {
    return (
      <WalletProvider>
        <App />
      </WalletProvider>
    );
  } catch (error) {
    console.error('WalletProvider initialization error:', error);
    // フォールバック: WalletProviderなしでアプリを表示
    return <App />;
  }
};

createRoot(rootElement).render(
  <StrictMode>
    <AppWithErrorBoundary />
  </StrictMode>,
)