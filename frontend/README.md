# Sui NFT Verification Frontend

このプロジェクトは、Suiウォレットを使用したNFT認証システムのフロントエンドです。

## 機能

- 🪙 Suiウォレット（Suiet、Slush等）との接続
- 🔐 メッセージ署名によるNFT所有権確認
- 🎯 Discordロールの自動付与
- 📱 レスポンシブデザイン

## 技術スタック

- **React 19** - 最新のReactフレームワーク
- **TypeScript** - 型安全性
- **Vite** - 高速な開発サーバー
- **Tailwind CSS** - モダンなスタイリング
- **@suiet/wallet-kit** - Suiウォレット統合
- **@mysten/sui.js** - Suiブロックチェーン操作

## セットアップ

### 前提条件

- Node.js 18以上
- npm または yarn
- バックエンドAPIサーバー（Cloudflare Workers）

### インストール

```bash
npm install
```

### 開発サーバー起動

```bash
npm run dev
```

開発サーバーは `http://localhost:5173` で起動します。

### ビルド

```bash
npm run build
```

## 使用方法

1. **ウォレット接続**: ConnectButtonをクリックしてSuiウォレットを接続
2. **Discord ID入力**: Discord IDを入力フィールドに入力
3. **認証開始**: 「認証開始」ボタンをクリックしてNFT所有権を確認
4. **署名**: ウォレットでメッセージに署名
5. **完了**: 認証が成功するとDiscordロールが自動付与されます

## 環境設定

### 開発環境

開発時は、Viteのプロキシ設定により `/api` エンドポイントが自動的にバックエンドサーバー（`http://localhost:8787`）に転送されます。

### 本番環境

本番環境では、以下の環境変数を設定してください：

```bash
VITE_API_BASE_URL=https://your-api-domain.com
```

## トラブルシューティング

### ウォレットが接続されない

1. Suiet WalletまたはSlush Walletがインストールされていることを確認
2. ブラウザを再読み込み
3. ウォレット拡張機能が有効になっていることを確認

### APIエラー

1. バックエンドサーバーが起動していることを確認
2. ネットワーク接続を確認
3. ブラウザの開発者ツールでエラーログを確認

## ライセンス

MIT License
