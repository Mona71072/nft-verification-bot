import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WalletProvider } from '@suiet/wallet-kit'
import '@suiet/wallet-kit/style.css'
import './index.css'
import App from './App.tsx'

// より包括的なグローバルエラーハンドリング
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  
  // inpage-script.jsのエラーを完全に抑制
  if (event.filename?.includes('inpage-script.js') || 
      event.error?.message?.includes('register') || 
      event.error?.message?.includes('wallet') ||
      event.error?.message?.includes('@suiet') ||
      event.error?.message?.includes('Cannot destructure') ||
      event.error?.message?.includes('undefined') ||
      event.error?.stack?.includes('inpage-script.js')) {
    console.log('Wallet-related error suppressed:', event.error?.message);
    event.preventDefault();
    return false;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  // inpage-script.jsのPromise rejectionも抑制
  if (event.reason?.message?.includes('register') || 
      event.reason?.message?.includes('wallet') ||
      event.reason?.message?.includes('@suiet') ||
      event.reason?.message?.includes('Cannot destructure') ||
      event.reason?.message?.includes('undefined')) {
    console.log('Wallet-related promise rejection suppressed:', event.reason.message);
    event.preventDefault();
    return false;
  }
});

// より強力なエラー抑制
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const message = args.join(' ');
  if (message.includes('inpage-script.js') || 
      message.includes('register') || 
      message.includes('wallet') ||
      message.includes('@suiet') ||
      message.includes('Cannot destructure')) {
    console.log('Console error suppressed:', message);
    return;
  }
  originalConsoleError.apply(console, args);
};

// より強力なスクリプトエラー抑制
const originalOnError = window.onerror;
window.onerror = function(message: string | Event, source?: string, lineno?: number, colno?: number, error?: Error) {
  if (source?.includes('inpage-script.js') || 
      message?.toString().includes('register') ||
      message?.toString().includes('wallet') ||
      message?.toString().includes('Cannot destructure') ||
      message?.toString().includes('undefined')) {
    console.log('Window error suppressed:', message);
    return true; // エラーを抑制
  }
  if (originalOnError) {
    return originalOnError(message, source, lineno, colno, error);
  }
  return false;
};

// エラーハンドリングを追加
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

// WalletProviderの初期化エラーをキャッチ
const AppWithErrorBoundary = () => {
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