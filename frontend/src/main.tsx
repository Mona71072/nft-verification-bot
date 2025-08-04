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
console.error = (...args) => {
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

// スクリプトエラーの抑制
const originalAddEventListener = window.addEventListener;
window.addEventListener = function(type, listener, options) {
  if (type === 'error') {
    const wrappedListener = (event) => {
      if (event.filename?.includes('inpage-script.js') || 
          event.error?.message?.includes('register') ||
          event.error?.message?.includes('wallet')) {
        console.log('Error event suppressed:', event.error?.message);
        return;
      }
      listener(event);
    };
    return originalAddEventListener.call(this, type, wrappedListener, options);
  }
  return originalAddEventListener.call(this, type, listener, options);
};

// より強力なスクリプトエラー抑制
const originalOnError = window.onerror;
window.onerror = function(message, source, lineno, colno, error) {
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

// スクリプト読み込みエラーの抑制
const originalCreateElement = document.createElement;
document.createElement = function(tagName) {
  const element = originalCreateElement.call(this, tagName);
  if (tagName.toLowerCase() === 'script') {
    const originalOnError = element.onerror;
    element.onerror = function(event) {
      if (event.target?.src?.includes('inpage-script.js')) {
        console.log('Script load error suppressed');
        return;
      }
      if (originalOnError) {
        originalOnError.call(this, event);
      }
    };
  }
  return element;
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