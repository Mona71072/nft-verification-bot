# NFT Verification Discord Bot

## 🚀 Render.comデプロイ（推奨）

### ✅ Render.comの利点
- **無料**: 無制限利用
- **安定性**: 高可用性
- **自動復旧**: クラッシュ時自動再起動
- **スケーリング**: 自動負荷調整
- **ログ監視**: リアルタイムログ

### 🚀 Render.com Deploy

### 1. Render.comにサインアップ
- [Render.com](https://render.com) にアクセス
- GitHubアカウントでサインアップ

### 2. プロジェクトをデプロイ
1. Render dashboard で "New +" をクリック
2. "Web Service" を選択
3. GitHubリポジトリを接続
4. このリポジトリの `bot` フォルダを選択

### 3. 設定
- **Name**: `nft-verification-bot`
- **Environment**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Health Check Path**: `/health`

### 4. 環境変数を設定
Render dashboardの Environment タブで以下を設定：

```
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=1400483007009394740
DISCORD_GUILD_ID=1214855750917160960
DISCORD_ROLE_ID=1400485848008491059
SUI_NETWORK=mainnet
NFT_COLLECTION_ID=0x2::coin::Coin<0x2::sui::SUI>
API_BASE_URL=https://nft-verification-production.mona-syndicatextokyo.workers.dev
VERIFICATION_URL=https://nft-verification-production.mona-syndicatextokyo.workers.dev/verify.html
ADMIN_USER_ID=1060224603663896577
```

### 5. デプロイ確認
- デプロイが成功すると自動的に起動
- ヘルスチェック: `https://your-app-name.onrender.com/health`
- ログ確認: Render dashboardの Logs タブ

## 🔧 ローカル開発

```bash
cd bot
npm install
cp .env.example .env
# .env ファイルを編集
npm run dev
```

## 📋 機能

- Discord ボタンインタラクション
- NFT認証システム
- 自動ロール付与/剥奪
- DM通知
- 管理者統計

## 🛠️ トラブルシューティング

### ボットが応答しない
1. Railway のログを確認
2. 環境変数が正しく設定されているか確認
3. Discord Bot Tokenが有効か確認

### インタラクション失敗
1. ボットが適切な権限を持っているか確認
2. サーバーにボットが追加されているか確認