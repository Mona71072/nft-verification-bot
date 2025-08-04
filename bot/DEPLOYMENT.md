# NFT Verification Portal デプロイガイド

## 前提条件

1. **Cloudflareアカウント**
   - Cloudflare Workersを使用するため、アカウントが必要です
   - https://cloudflare.com でアカウントを作成

2. **Node.js 18以上**
   - 最新のLTS版を推奨

3. **Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

## セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Cloudflare Workersへのログイン

```bash
wrangler login
```

### 3. 環境変数の設定

`wrangler.toml`ファイルで以下の値を設定してください：

#### Discord設定
```toml
[env.production.vars]
DISCORD_TOKEN = "your_discord_bot_token"
DISCORD_GUILD_ID = "your_guild_id"
DISCORD_ROLE_ID = "your_role_id"
```

#### NFT設定
```toml
NFT_COLLECTION_ID = "your_nft_collection_id"
```

#### API設定
```toml
API_BASE_URL = "https://your-domain.workers.dev"
VERIFICATION_URL = "https://your-domain.workers.dev"
```

### 4. Discord Bot設定

1. **Discord Developer Portal**でボットを作成
   - https://discord.com/developers/applications
   - 新しいアプリケーションを作成
   - Botタブでボットを作成

2. **必要な権限を設定**
   - Manage Roles
   - Send Messages
   - Read Message History
   - Use Slash Commands

3. **ボットトークンを取得**
   - Botタブで「Token」をコピー
   - `wrangler.toml`の`DISCORD_TOKEN`に設定

4. **サーバーにボットを招待**
   - OAuth2 > URL Generator
   - 必要な権限を選択
   - 生成されたURLでボットを招待

### 5. NFTコレクションIDの設定

実際のNFTコレクションIDを設定してください：

```toml
# 例: カスタムNFTコレクション
NFT_COLLECTION_ID = "0x1234567890abcdef::my_nft::MyNFT"

# 例: 特定のNFTタイプ
NFT_COLLECTION_ID = "0x2::nft::NFT"

# 空の場合はすべてのNFTタイプを検索
NFT_COLLECTION_ID = ""
```

## デプロイ手順

### 開発環境でのテスト

```bash
# 開発サーバーを起動
npm run dev

# または
wrangler dev
```

### 本番環境へのデプロイ

```bash
# 本番環境にデプロイ
npm run deploy

# または
wrangler deploy --env production
```

### 開発環境へのデプロイ

```bash
# 開発環境にデプロイ
npm run deploy:dev

# または
wrangler deploy --env development
```

## デプロイ後の確認

### 1. ヘルスチェック

```bash
curl https://your-domain.workers.dev/health
```

期待されるレスポンス：
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "2.0.0"
}
```

### 2. ウォレット接続テスト

1. ブラウザでデプロイされたURLにアクセス
2. ウォレット拡張機能がインストールされていることを確認
3. 「Connect Wallet」ボタンをクリック
4. ウォレットが正常に接続されることを確認

### 3. NFT検証テスト

1. Discord IDを入力
2. 「Start Verification」ボタンをクリック
3. 署名プロンプトが表示されることを確認
4. 署名後、ロールが付与されることを確認

## トラブルシューティング

### よくある問題

1. **ウォレット接続エラー**
   ```bash
   # ログを確認
   wrangler tail
   ```

2. **Discord Bot権限エラー**
   - ボットに適切な権限があるか確認
   - サーバーにボットが招待されているか確認

3. **NFT検証エラー**
   - NFT_COLLECTION_IDが正しく設定されているか確認
   - ウォレットに該当するNFTが存在するか確認

### ログの確認

```bash
# リアルタイムログを確認
wrangler tail

# 特定のエラーを検索
wrangler tail | grep "ERROR"
```

## 環境変数の管理

### 本番環境での環境変数設定

```bash
# 個別の環境変数を設定
wrangler secret put DISCORD_TOKEN

# または、wrangler.tomlで設定
```

### 開発環境での環境変数設定

```bash
# .dev.varsファイルを作成
echo "DISCORD_TOKEN=your_dev_token" > .dev.vars
```

## セキュリティ

### 重要な設定

1. **Discord Bot Token**
   - 本番環境では必ずシークレットとして管理
   - 公開リポジトリにコミットしない

2. **NFTコレクションID**
   - 実際のNFTコレクションIDを正確に設定
   - テスト環境では開発用のNFTを使用

3. **KVストレージ**
   - 本番環境では適切なアクセス制御を設定

## パフォーマンス最適化

### 推奨設定

1. **キャッシュ設定**
   - 静的アセットに適切なキャッシュヘッダーを設定

2. **エラーハンドリング**
   - 適切なエラーレスポンスを設定
   - ユーザーフレンドリーなエラーメッセージを表示

3. **モニタリング**
   - Cloudflare Analyticsでトラフィックを監視
   - エラー率を定期的に確認

## 更新手順

### コードの更新

```bash
# 最新のコードをプル
git pull origin main

# 依存関係を更新
npm install

# 本番環境にデプロイ
npm run deploy
```

### 設定の更新

```bash
# wrangler.tomlを編集後
wrangler deploy --env production
```

## サポート

問題が発生した場合は、以下を確認してください：

1. **ログの確認**: `wrangler tail`
2. **設定の確認**: `wrangler.toml`
3. **権限の確認**: Discord Bot設定
4. **ウォレットの確認**: 拡張機能のインストール状況 