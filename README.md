# SXT NFT Verification Portal

Suiブロックチェーン上のNFT保有を確認し、Discordロールを自動付与するシステムです。

## 🚀 新機能: Reactフロントエンド

**重要**: 最新のWallet Standard APIに対応したReactフロントエンドが追加されました。これにより、Suiet Wallet、Slush Walletなどの主要なSuiウォレットとの安定した接続が可能になります。

### アーキテクチャ

```
📁 NFT Verification Portal
├── 🎯 frontend/          # React + Vite + Wallet Kit
│   ├── src/App.tsx      # メインアプリケーション
│   ├── package.json     # フロントエンド依存関係
│   └── vite.config.ts   # Vite設定（APIプロキシ）
└── 🔧 src/              # Cloudflare Workers API
    ├── index.ts         # Hono APIサーバー
    ├── lib/             # ビジネスロジック
    └── types.ts         # TypeScript型定義
```

## 機能

- 🔗 **安定したウォレット接続**: @suiet/wallet-kitによる確実なSuiウォレット統合
- 🎨 **NFT保有確認**: Suiブロックチェーン上のNFT所有権検証
- 🔐 **署名検証**: セキュアなメッセージ署名による認証
- 🎭 **Discordロール自動付与**: 認証成功時の自動ロール付与
- 📱 **レスポンシブUI**: モダンなTailwind CSSデザイン
- ⚡ **高速開発**: Viteによる高速な開発環境

## セットアップ

### 1. 環境変数の設定

`wrangler.toml`ファイルで以下の環境変数を設定してください：

```toml
[env.production.vars]
DISCORD_TOKEN = "your_discord_bot_token"
DISCORD_GUILD_ID = "your_guild_id"
DISCORD_ROLE_ID = "your_role_id"
SUI_NETWORK = "mainnet"
NFT_COLLECTION_ID = "your_nft_collection_id"
```

### 2. NFTコレクションIDの設定

実際のNFTコレクションIDを設定してください：

```toml
# 例: カスタムNFTコレクション
NFT_COLLECTION_ID = "0x1234567890abcdef::my_nft::MyNFT"

# 例: 特定のNFTタイプ
NFT_COLLECTION_ID = "0x2::nft::NFT"

# 空の場合は、すべてのNFTタイプのオブジェクトを検索
NFT_COLLECTION_ID = ""
```

### 3. Discord Bot設定

1. Discord Developer Portalでボットを作成
2. 必要な権限を付与：
   - Manage Roles
   - Send Messages
   - Read Message History
3. ボットトークンを取得して設定

### 4. 開発環境の起動

#### バックエンド（Cloudflare Workers）

```bash
# 依存関係のインストール
npm install

# 開発環境でのテスト
npm run dev
```

#### フロントエンド（React + Vite）

```bash
# フロントエンドディレクトリに移動
cd frontend

# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev
```

フロントエンドは `http://localhost:5173` で起動し、APIリクエストは自動的にバックエンド（`http://localhost:8787`）にプロキシされます。

### 5. 本番環境へのデプロイ

```bash
# バックエンドのデプロイ
npm run deploy

# フロントエンドのビルド
cd frontend
npm run build
```

## 使用方法

### 🎯 新しいReactフロントエンド

1. **ウォレット接続**: ConnectButtonをクリックしてSuiウォレット（Suiet、Slush等）を接続
2. **Discord ID入力**: Discord IDを入力フィールドに入力
3. **認証開始**: 「認証開始」ボタンをクリックしてNFT所有権を確認
4. **署名**: ウォレットでメッセージに署名
5. **完了**: 認証が成功するとDiscordロールが自動付与されます

### 📡 API エンドポイント

#### ナンス生成
```bash
POST /api/nonce
{
  "discordId": "123456789012345678",
  "address": "0x..."
}
```

#### NFT検証
```bash
POST /api/verify
{
  "signature": "base64_signature",
  "address": "0x...",
  "discordId": "123456789012345678",
  "nonce": "generated_nonce",
  "message": "verification_message"
}
```

## 技術スタック

### フロントエンド
- **React 19** - 最新のReactフレームワーク
- **TypeScript** - 型安全性
- **Vite** - 高速な開発サーバー
- **Tailwind CSS** - モダンなスタイリング
- **@suiet/wallet-kit** - Suiウォレット統合
- **@mysten/sui.js** - Suiブロックチェーン操作

### バックエンド
- **Hono** - Cloudflare Workers用Webフレームワーク
- **TypeScript** - 型安全性
- **Cloudflare Workers** - エッジコンピューティング
- **Cloudflare KV** - データストレージ

## トラブルシューティング

### ウォレット接続の問題

#### 新しいReactフロントエンド
1. **Suiet Wallet**または**Slush Wallet**がインストールされていることを確認
2. ブラウザを再読み込み
3. ウォレット拡張機能が有効になっていることを確認

#### 従来のHTMLフロントエンド
1. ウォレット拡張機能がインストールされているか確認
2. ウォレットがロックされているか確認
3. ブラウザの開発者ツールでエラーログを確認

### NFT検証エラー

1. NFT_COLLECTION_IDが正しく設定されているか確認
2. ウォレットに該当するNFTが存在するか確認
3. ネットワーク設定（mainnet/testnet）が正しいか確認

### Discordロール付与エラー

1. ボットに適切な権限があるか確認
2. ロールIDが正しく設定されているか確認
3. ボットがサーバーに参加しているか確認

### APIエラー

1. バックエンドサーバーが起動していることを確認
2. ネットワーク接続を確認
3. ブラウザの開発者ツールでエラーログを確認

## 開発ガイド

### フロントエンド開発

```bash
cd frontend
npm run dev
```

### バックエンド開発

```bash
npm run dev
```

### デバッグ

ブラウザの開発者ツールでコンソールログを確認してください：

```javascript
// ウォレット接続状態
console.log('Wallet connected:', wallet);

// NFT検証結果
console.log('Verification response:', data);
```

## ライセンス

MIT License 