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
        manualChunks: {
          // ベンダーライブラリを分離
          vendor: ['react', 'react-dom'],
          // UI ライブラリを分離
          ui: ['framer-motion', 'lucide-react'],
          // アドミン機能を分離
          admin: [
            './src/pages/admin/AdminDashboard',
            './src/pages/admin/EventManagement',
            './src/pages/admin/MintHistory',
            './src/pages/admin/RolesManagement'
          ],
          // ユーティリティを分離
          utils: [
            './src/hooks/useOptimizedAPI',
            './src/hooks/useAdvancedCache',
            './src/components/VirtualList',
            './src/components/LazyImage'
          ]
        }
      }
    },
    // Tree Shaking の最適化
    treeshake: {
      moduleSideEffects: false
    },
    // チャンクサイズの警告を調整
    chunkSizeWarningLimit: 1000
  },
  // 開発時の最適化
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'framer-motion',
      'lucide-react'
    ],
    exclude: [
      // 動的インポートされるモジュール
      './src/pages/admin/AdminDashboard',
      './src/pages/admin/EventManagement',
      './src/pages/admin/MintHistory',
      './src/pages/admin/RolesManagement'
    ]
  }
})
