# Discord OAuth セットアップガイド

このガイドでは、NFT検証ページでDiscord OAuthログインを利用するための設定方法を説明します。

## 1. Discord Developer Portalでの設定

### 1.1 Discord Applicationの作成または選択

1. [Discord Developer Portal](https://discord.com/developers/applications)にアクセス
2. 既存のアプリケーションを選択、または「New Application」で新規作成

### 1.2 OAuth2の設定

1. 左メニューから「OAuth2」→「General」を選択
2. **Client ID**と**Client Secret**をコピーして保存（後で使用）
3. 「Redirects」セクションで以下のURLを追加:
   ```
   https://syndicatextokyo.app/Verification
   ```
   - 開発環境の場合は追加で:
   ```
   http://localhost:5173/Verification
   ```

### 1.3 OAuth2スコープの確認

- 必要なスコープ: `identify`（ユーザーIDとユーザー名の取得のみ）

## 2. Cloudflare Workersの環境変数設定

### 2.1 Cloudflare Dashboardでの設定

1. [Cloudflare Dashboard](https://dash.cloudflare.com/)にアクセス
2. Workers & Pages → 該当のWorkerを選択
3. Settings → Variables → Environment Variablesで以下を追加:

   ```
   DISCORD_CLIENT_ID = <Discord ApplicationのClient ID>
   DISCORD_CLIENT_SECRET = <Discord ApplicationのClient Secret>
   ```

   ⚠️ **Client Secretは必ず「Encrypt」オプションを有効にしてください**

### 2.2 ローカル開発用（wrangler.toml）

`.dev.vars`ファイルを作成（gitignore対象）:

```
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here
```

## 3. フロントエンドの環境変数設定

### 3.1 Cloudflare Pagesの場合

1. Cloudflare Dashboard → Pages → 該当のプロジェクトを選択
2. Settings → Environment variables → Productionで追加:

   ```
   VITE_DISCORD_CLIENT_ID = <Discord ApplicationのClient ID>
   ```

### 3.2 ローカル開発用

`frontend/.env`ファイルを作成（gitignore対象）:

```
VITE_API_BASE_URL=http://localhost:8787
VITE_DISCORD_CLIENT_ID=your_client_id_here
```

## 4. 動作確認

### 4.1 リダイレクトURLの確認

1. `https://syndicatextokyo.app/Verification`にアクセス
2. 画面上部の「Discord アプリのリダイレクトURL」ボックスに表示されているURLを確認
3. このURLがDiscord Developer Portalの「Redirects」に登録されていることを確認

### 4.2 OAuth フロー確認

1. 検証ページで「Discordでログイン」ボタンをクリック
2. Discordの認証画面に遷移
3. 「認証」をクリック
4. 検証ページに戻り、Discord IDが自動入力されることを確認
5. ウォレット接続→NFT選択→署名の流れで検証を完了

## 5. トラブルシューティング

### エラー: "Discord OAuth が設定されていません"

- フロントエンドの環境変数`VITE_DISCORD_CLIENT_ID`が設定されていない
- ビルド時に環境変数が読み込まれていない（再デプロイが必要）

### エラー: "Failed to exchange Discord code"

- バックエンドの`DISCORD_CLIENT_ID`または`DISCORD_CLIENT_SECRET`が正しくない
- Discord Developer Portalで設定したClient IDとSecretを再確認

### エラー: "redirect_uri_mismatch"

- Discord Developer Portalの「Redirects」に正しいURLが登録されていない
- URLの末尾のスラッシュの有無を確認（`/Verification`と`/Verification/`は別物）

### Discord認証後にDiscord IDが表示されない

- ブラウザの開発者ツール（Console）でエラーを確認
- `API_BASE_URL`が正しいか確認
- CORS設定を確認（Cloudflare Workersでは通常問題なし）

## 6. セキュリティ上の注意

1. **Client Secretは絶対に公開しないでください**
   - フロントエンドのコードやリポジトリに含めない
   - Cloudflare Workers環境変数では必ず「Encrypt」を有効化

2. **リダイレクトURLは厳密に管理**
   - Discord Developer Portalに登録したURL以外からの認証は拒否される
   - 本番環境のURLのみを登録（開発用は別途）

3. **Stateパラメータ**
   - CSRF攻撃防止のため、現在ランダムなstateを生成しています
   - より厳密な実装が必要な場合は、セッション管理と組み合わせることを検討

## 参考リンク

- [Discord OAuth2 Documentation](https://discord.com/developers/docs/topics/oauth2)
- [Cloudflare Workers Environment Variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)

