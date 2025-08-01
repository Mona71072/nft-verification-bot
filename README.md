# NFT Verification Service

Sui NFT認証システムです。ユーザーが特定のNFTを所有しているかどうかを確認し、Discordサーバーでロールを付与します。

## 🚀 機能

- **Discord Bot**: NFT認証とロール管理
- **Cloudflare Workers**: 高速なWeb API
- **インタラクティブUI**: モダンな認証インターフェース
- **自動化**: NFT保有確認とロール付与の自動化

## 📁 プロジェクト構造

```
├── src/                    # メインアプリケーション（Cloudflare Workers）
│   ├── index.ts           # メインエントリーポイント
│   ├── discord-bot.ts     # Discord Bot API
│   ├── lib/               # ユーティリティライブラリ
│   └── types.ts           # 型定義
├── bot/                   # Discord Bot（独立したサービス）
│   ├── src/              # Botソースコード
│   └── commands/         # Botコマンド
├── web/                   # 静的Webファイル
│   ├── index.html        # メインWebページ
│   └── verify.html       # 認証ページ
└── test/                  # テストファイル
```

## ⚙️ セットアップ

### 前提条件

- Node.js 18以上
- Discord Bot Token
- Sui Network アクセス

### 環境変数

```env
# Discord設定
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_guild_id
DISCORD_ROLE_ID=your_role_id

# Sui設定
SUI_NETWORK=mainnet
NFT_COLLECTION_ID=your_nft_collection_id

# API設定
API_BASE_URL=your_api_base_url
VERIFICATION_URL=your_verification_url
ADMIN_USER_ID=your_admin_user_id
```

### インストール

```bash
# メインアプリケーション
npm install
npm run dev

# Discord Bot（別途）
cd bot
npm install
npm run dev
```

## 🚀 デプロイ

### Cloudflare Workers（メインAPI）

```bash
npm run deploy
```

### Discord Bot（Render.com推奨）

1. `bot/`ディレクトリをRender.comにデプロイ
2. 環境変数を設定
3. ビルドコマンド: `npm install && npm run build`
4. スタートコマンド: `npm start`

## 📖 使用方法

1. Discordサーバーにボットを招待
2. 認証チャンネルで認証ボタンをクリック
3. NFTを所有している場合、自動的にロールが付与されます

## 🧪 テスト

```bash
npm test
```

## 📄 ライセンス

MIT 