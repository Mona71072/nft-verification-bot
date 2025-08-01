# トラブルシューティングガイド

## ❌ インタラクションに失敗しました

### 1. 環境変数の確認

以下の環境変数が正しく設定されているか確認してください：

```bash
# 必須項目
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_guild_id
DISCORD_ROLE_ID=your_role_id
VERIFICATION_CHANNEL_ID=your_verification_channel_id
VERIFICATION_URL=your_verification_url
ADMIN_USER_ID=your_admin_user_id
```

### 2. Botの権限確認

DiscordサーバーでBotに以下の権限があるか確認：

- **Send Messages**: メッセージ送信
- **Use Slash Commands**: スラッシュコマンド使用
- **Manage Roles**: ロール管理
- **Manage Messages**: メッセージ管理（オプション）

### 3. チャンネルIDの確認

1. Discordで開発者モードを有効にする
2. 認証チャンネルを右クリック → 「IDをコピー」
3. `VERIFICATION_CHANNEL_ID`に設定

### 4. ログの確認

Botのログで以下のメッセージを確認：

```
✅ All required configuration fields are set
✅ All required permissions are available
✅ Found verification channel: [チャンネル名]
```

### 5. よくある問題

#### 問題: "Configuration validation failed"
**解決策**: 環境変数が不足しています。`.env`ファイルを確認してください。

#### 問題: "Missing required permissions"
**解決策**: Botに必要な権限を付与してください。

#### 問題: "Verification channel not found"
**解決策**: `VERIFICATION_CHANNEL_ID`が正しく設定されているか確認してください。

#### 問題: "Unknown button interaction"
**解決策**: Botを再起動して、認証メッセージを再生成してください。

### 6. 再起動手順

1. Botを停止
2. 環境変数を確認
3. Botを再起動
4. 認証チャンネルでメッセージが表示されるか確認

### 7. デバッグモード

開発時は以下のログを確認：

```bash
npm run dev
```

ログで以下を確認：
- ✅ Bot logged in as [Bot名]
- ✅ All required configuration fields are set
- ✅ All required permissions are available
- ✅ Found verification channel: [チャンネル名]
- ✅ User and Admin verification messages posted successfully 