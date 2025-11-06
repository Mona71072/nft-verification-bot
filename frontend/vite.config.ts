import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // node_modulesの依存関係を分離
          if (id.includes('node_modules')) {
            // ReactとReact DOMを専用チャンクに分離（最重要：最初に読み込まれるようにする）
            if (id.includes('react') || id.includes('react-dom') || id.includes('react/jsx-runtime') || id.includes('react/jsx-dev-runtime') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            // TanStack Queryを分離（Reactに依存）
            if (id.includes('@tanstack')) {
              return 'vendor-query';
            }
            // Radix UIはReactに依存するため、Reactの後に読み込まれるようにする
            if (id.includes('@radix-ui')) {
              return 'vendor-radix';
            }
            // UIライブラリを分離（framer-motionはReactに依存）
            if (id.includes('framer-motion') || id.includes('lucide-react') || id.includes('recharts')) {
              return 'vendor-ui';
            }
            // Sui関連のSDKを分離（Reactに依存しない）
            if (id.includes('@mysten')) {
              return 'vendor-sui';
            }
            // その他のユーティリティライブラリ（Reactに依存しない）
            if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
              return 'vendor-utils';
            }
            // その他のベンダーライブラリはメインチャンクに含める（vendorチャンクを削除）
            // これにより、Reactが正しく読み込まれた後に実行されることを保証
            return undefined;
          }
          
          // アドミン機能を分離
          if (id.includes('/pages/admin/')) {
            return 'admin';
          }
          
          // ユーティリティを分離
          if (id.includes('/hooks/') || id.includes('/utils/')) {
            return 'utils';
          }
        },
        // チャンクファイル名の最適化
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
    },
      // Tree Shaking の最適化（Reactには副作用があるため、falseにしない）
    treeshake: {
        moduleSideEffects: (id: string) => {
          // ReactとReact関連ライブラリには副作用があるため、Tree Shakingを緩和
          if (id.includes('react') || id.includes('react-dom') || id.includes('@radix-ui') || id.includes('framer-motion')) {
            return true;
          }
          return false;
        }
      }
    },
    // CommonJSモジュールの処理を改善
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    },
    // チャンクサイズの警告を調整
    chunkSizeWarningLimit: 1000,
    // ソースマップ（本番環境では無効化）
    sourcemap: false,
    // 圧縮最適化
    minify: 'esbuild',
    // ターゲットブラウザの設定
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14']
  },
  // 開発時の最適化
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@mysten/dapp-kit',
      '@mysten/sui/client',
      '@tanstack/react-query',
      'framer-motion',
      'lucide-react'
    ],
    exclude: [
      // 動的インポートされるモジュール（遅延読み込みされるコンポーネント）
      './src/pages/admin/AdminDashboard',
      './src/pages/admin/EventManagement',
      './src/pages/admin/MintHistory',
      './src/pages/admin/RolesManagement',
      './src/pages/HomePage',
      './src/components/NFTVerificationPage',
      './src/MintPage'
    ]
  },
  // パフォーマンス最適化
  esbuild: {
    // 本番ビルドでの不要なコードの削除
    drop: ['console', 'debugger']
  }
})
