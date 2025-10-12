# デプロイ完了状況

## ✅ デプロイ済み

### バックエンド（Cloudflare Workers）
- **URL**: https://nft-verification-production.mona-syndicatextokyo.workers.dev
- **Version ID**: d3683c4f-83f4-4893-80b9-7b2431b359d7
- **デプロイ日時**: 2025-01-12

### フロントエンド（Cloudflare Pages）
- **本番URL**: https://7abaf0e6.nft-verification-frontend.pages.dev
- **エイリアスURL**: https://main.nft-verification-frontend.pages.dev
- **カスタムドメイン**: syndicatextokyo.app（要設定確認）

### GitHubリポジトリ
- **リポジトリ**: github.com:Mona71072/nft-verification-bot.git
- **最新コミット**: feat: Discord OAuth統合とルーティング変更

## ⚠️ 必須設定項目（未設定の場合）

### 1. Cloudflare Workers環境変数（バックエンド）

以下の環境変数を設定してください：

```
DISCORD_CLIENT_ID=<Discord ApplicationのClient ID>
DISCORD_CLIENT_SECRET=<Discord ApplicationのClient Secret> ← 必ずEncrypt有効化
```

**設定方法**:
1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages
2. `nft-verification-production` を選択
3. Settings → Variables → Environment Variables
4. 上記2つの変数を追加（Client Secretは「Encrypt」を有効化）
5. 保存後、Workersを再デプロイ: `npm run deploy`

### 2. Cloudflare Pages環境変数（フロントエンド）

以下の環境変数を設定してください：

```
VITE_DISCORD_CLIENT_ID=<Discord ApplicationのClient ID>
```

**設定方法**:
1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages
2. `nft-verification-sxt` を選択
3. Settings → Environment variables → Production
4. 上記変数を追加
5. 保存後、フロントエンドを再デプロイ: `cd frontend && npm run deploy`

### 3. Discord Developer Portal設定

**Redirect URLsに追加**:
- 本番: `https://syndicatextokyo.app/Verification`
- テスト: `https://7abaf0e6.nft-verification-frontend.pages.dev/Verification`
- ブランチ: `https://main.nft-verification-frontend.pages.dev/Verification`

**設定方法**:
1. [Discord Developer Portal](https://discord.com/developers/applications)
2. 該当のApplicationを選択
3. OAuth2 → General → Redirects
4. 上記URLを全て追加
5. Save Changes

## 🔍 動作確認手順

### 1. ダッシュボードの確認
1. `https://syndicatextokyo.app/` にアクセス
2. ダッシュボードが表示されることを確認
3. ウォレット接続が機能することを確認

### 2. 検証ページの確認
1. `https://syndicatextokyo.app/Verification` に直接アクセス
2. リダイレクトURL表示ボックスが見えることを確認
3. コピーボタンで `https://syndicatextokyo.app/Verification` がコピーされることを確認

### 3. Discord OAuth認証フロー
1. 「Discordでログイン」ボタンをクリック
2. Discord認証画面に遷移
3. 認証後、`/Verification` に戻る
4. 「✓ Discord認証済み: username」が表示される
5. Discord IDが自動入力され編集不可になる

### 4. NFT検証フロー（全体）
1. Discord OAuthでログイン完了
2. ウォレットを接続
3. NFTコレクションを選択
4. 「Start Verification」で署名
5. 検証成功メッセージとDiscordロール付与確認

## 🐛 トラブルシューティング

### 「Discord OAuth が設定されていません」エラー
- フロントエンドの`VITE_DISCORD_CLIENT_ID`が未設定
- Pages環境変数を追加後、再デプロイが必要

### 「Failed to exchange Discord code」エラー
- バックエンドの`DISCORD_CLIENT_ID`または`DISCORD_CLIENT_SECRET`が未設定
- Workers環境変数を追加後、再デプロイが必要

### 「redirect_uri_mismatch」エラー
- Discord Developer PortalのRedirectsに正しいURLが登録されていない
- URLを確認して追加（末尾スラッシュの有無に注意）

### Discord認証後に「Discord認証に失敗しました」
- ブラウザのConsoleでエラーを確認
- バックエンドのAPI URLが正しいか確認
- CORSエラーの場合、Workers側の設定を確認

## 📝 次のステップ

1. **環境変数を設定** → 上記の必須設定項目を全て完了
2. **再デプロイ実行**:
   ```bash
   # バックエンド
   npm run deploy
   
   # フロントエンド
   cd frontend && npm run deploy
   ```
3. **動作確認** → 検証フロー全体をテスト
4. **カスタムドメイン確認** → `syndicatextokyo.app` が正しく設定されているか確認

## 📚 参考ドキュメント

- [DISCORD_OAUTH_SETUP.md](./DISCORD_OAUTH_SETUP.md) - Discord OAuth詳細設定ガイド
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 一般的なデプロイ手順

