# NFT Verification Bot

Discordボットを使用したSui NFT認証システムです。ユーザーが特定のNFTを所有しているかどうかを確認し、Discordサーバーでロールを付与します。

## 機能

- DiscordボットによるNFT認証
- インタラクティブな認証UI
- 管理者向け統計情報
- Cloudflare Workersを使用したWeb API
- Render.comでの継続的デプロイ

## セットアップ

### 前提条件

- Node.js 18以上
- Discord Bot Token
- Sui Network アクセス

### 環境変数

以下の環境変数を設定してください：

```env
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_guild_id
DISCORD_ROLE_ID=your_role_id
SUI_NETWORK=mainnet
NFT_COLLECTION_ID=your_nft_collection_id
API_BASE_URL=your_api_base_url
VERIFICATION_URL=your_verification_url
ADMIN_USER_ID=your_admin_user_id
```

### インストール

```bash
# 依存関係のインストール
npm install

# ビルド
npm run build

# 開発サーバー起動
npm run dev
```

## デプロイ

### Render.com

1. GitHubリポジトリをRender.comに接続
2. 環境変数を設定
3. ビルドコマンド: `npm install && npm run build`
4. スタートコマンド: `npm start`

### Cloudflare Workers

```bash
npm run deploy
```

## 使用方法

1. Discordサーバーにボットを招待
2. 認証チャンネルで認証ボタンをクリック
3. NFTを所有している場合、自動的にロールが付与されます

## ライセンス

MIT 