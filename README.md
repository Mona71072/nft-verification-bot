# SXT NFT Verification Portal

Suiブロックチェーン上のNFT保有を確認し、Discordロールを自動付与する完全なシステムです。

## 🏗️ システムアーキテクチャ

### 全体構成
```
📁 NFT Verification Portal
├── 🎯 frontend/          # React + Vite + @suiet/wallet-kit
│   ├── src/App.tsx      # メインアプリケーション
│   ├── src/main.tsx     # エントリーポイント
│   ├── package.json     # フロントエンド依存関係
│   └── wrangler.toml    # Cloudflare Pages設定
├── 🔧 src/              # Cloudflare Workers API
│   └── index.ts         # Hono APIサーバー
├── 🤖 bot/              # Discord Bot (Render)
│   ├── src/index.ts     # Discord Bot実装
│   ├── src/api-server.ts # APIサーバー
│   ├── src/config.ts    # 設定管理
│   └── render.yaml      # Render設定
└── ⚙️ 設定ファイル
    ├── wrangler.toml    # Cloudflare Workers設定
    ├── env.example      # 環境変数例
    └── config.example.toml # 詳細設定例
```

### データフロー
```
Discord → フロントエンド → Cloudflare Workers → Discord Bot → Discord DM
     ↓              ↓              ↓                    ↓              ↓
   ボタンクリック   ウォレット接続    NFT認証           ロール付与     プライベート通知
```

## 🚀 デプロイ済みURL

### 本番環境
- **フロントエンド**: https://main.nft-verification-frontend.pages.dev
- **Cloudflare Workers API**: https://nft-verification-production.mona-syndicatextokyo.workers.dev
- **Discord Bot API**: https://nft-verification-bot.onrender.com

### テスト環境
- **フロントエンド**: https://c840eaf3.nft-verification-frontend.pages.dev

## �� 主要機能

### ✅ 実装済み機能（Phase 1）
- 🔗 **安定したウォレット接続**: @suiet/wallet-kitによる確実なSuiウォレット統合
- 🎨 **NFT保有確認**: Suiブロックチェーン上のNFT所有権検証（Claynosaurz Popkins）
- 🔐 **署名検証**: セキュアなメッセージ署名による認証
- 🎭 **Discordロール自動付与**: 認証成功時の自動ロール付与
- 📱 **レスポンシブUI**: モダンなインラインスタイルデザイン
- ⚡ **高速開発**: Viteによる高速な開発環境
- 🔒 **プライバシー保護**: DM通知 + 5分間自動削除
- 📊 **詳細ログ**: 開発・デバッグ用の詳細ログ機能

### ✅ 新機能（Phase 2）
- 🔄 **定期的なバッチ処理**: 自動NFT保有確認とロール管理
- ⏰ **スケジュール実行**: 設定可能な実行間隔（デフォルト60分）
- 🎛️ **管理者パネル**: バッチ処理の設定・監視・手動実行
- 📈 **統計ダッシュボード**: 処理結果の詳細統計表示
- 🔔 **自動通知**: ロール削除時の自動DM通知
- 🛡️ **エラーハンドリング**: 堅牢なエラー処理とリトライ機能
- 📊 **リアルタイム監視**: 処理状況のリアルタイム表示

### 🎯 現在のNFT設定
- **コレクション**: Claynosaurz Popkins
- **Package ID**: `0xb908f3c6fea6865d32e2048c520cdfe3b5c5bbcebb658117c41bad70f52b7ccc::popkins_nft::Popkins`
- **ネットワーク**: Sui Mainnet

## 🛠️ 技術スタック

### フロントエンド
- **React 19** - 最新のReactフレームワーク
- **TypeScript** - 型安全性
- **Vite** - 高速な開発サーバー
- **@suiet/wallet-kit** - Suiウォレット統合（安定版）
- **インラインスタイル** - 一貫性のあるデザイン

### バックエンド（Cloudflare Workers）
- **Hono** - Cloudflare Workers用Webフレームワーク
- **TypeScript** - 型安全性
- **Cloudflare Workers** - エッジコンピューティング
- **Cloudflare KV** - データストレージ（ナンス・コレクション・バッチ設定）

### Discord Bot（Render）
- **Node.js** - サーバーサイドJavaScript
- **Discord.js** - Discord API統合
- **Express** - APIサーバー
- **TypeScript** - 型安全性

## 🔧 セットアップ

### 1. 環境変数の設定

#### Cloudflare Workers (`wrangler.toml`)
```toml
[env.production.vars]
DISCORD_BOT_API_URL = "https://nft-verification-bot.onrender.com"
SUI_NETWORK = "mainnet"
NFT_COLLECTION_ID = "0xb908f3c6fea6865d32e2048c520cdfe3b5c5bbcebb658117c41bad70f52b7ccc::popkins_nft::Popkins"

[[env.production.kv_namespaces]]
binding = "NONCE_STORE"
id = "dfd1a07f0e704320bd5324fc3102f3ba"

[[env.production.kv_namespaces]]
binding = "COLLECTION_STORE"
id = "73186a10a62946718119aa112e87dba9"
```

#### フロントエンド (`frontend/wrangler.toml`)
```toml
[env.production.vars]
VITE_API_BASE_URL = "https://nft-verification-production.mona-syndicatextokyo.workers.dev"
```

#### Discord Bot (`bot/render.yaml`)
```yaml
envVars:
  - key: DISCORD_TOKEN
    value: ""  # レンダーで設定
  - key: DISCORD_CLIENT_ID
    value: 1400483007009394740
  - key: DISCORD_GUILD_ID
    value: 1214855750917160960
  - key: DISCORD_ROLE_ID
    value: 1400485848008491059
  - key: VERIFICATION_CHANNEL_ID
    value: 1400491600634708090
  - key: ADMIN_USER_ID
    value: 1060224603663896577
  - key: SUI_NETWORK
    value: mainnet
  - key: NFT_COLLECTION_ID
    value: 0x2::coin::Coin<0x2::sui::SUI>
  - key: VERIFICATION_URL
    value: https://main.nft-verification-frontend.pages.dev
```

### 2. Discord Bot設定

#### 必要な権限
- **Manage Roles** - ロール付与・削除
- **Send Messages** - メッセージ送信
- **Read Message History** - メッセージ履歴読み取り
- **Use Slash Commands** - スラッシュコマンド使用

#### Bot設定手順
1. Discord Developer Portalでボットを作成
2. 必要な権限を付与
3. ボットトークンを取得
4. レンダーで環境変数として設定

### 3. 開発環境の起動

#### フロントエンド開発
```bash
cd frontend
npm install
npm run dev
```

#### Cloudflare Workers開発
```bash
npm install -g wrangler
wrangler dev
```

#### Discord Bot開発
```bash
cd bot
npm install
npm run dev
```

## 📡 API エンドポイント

### Cloudflare Workers API

#### ヘルスチェック
```bash
GET /
Response: { status: 'ok', message: 'NFT Verification API' }
```

#### ナンス生成
```bash
POST /api/nonce
Content-Type: application/json

{
  "discordId": "123456789012345678",
  "address": "0x..."
}

Response: {
  "success": true,
  "data": {
    "nonce": "generated_nonce",
    "expiresAt": 1234567890
  }
}
```

#### NFT検証
```bash
POST /api/verify
Content-Type: application/json

{
  "signature": "base64_signature",
  "bytes": "base64_message_bytes",
  "address": "0x...",
  "discordId": "123456789012345678",
  "nonce": "generated_nonce",
  "authMessage": "Sign in to SXT NFT Verification at ...",
  "walletType": "Slush Wallet"
}

Response: {
  "success": true,
  "data": {
    "roleName": "NFT Holder",
    "message": "Verification completed successfully"
  }
}
```

#### バッチ処理実行（管理者用）
```bash
POST /api/admin/batch-execute
Content-Type: application/json

Response: {
  "success": true,
  "data": {
    "totalUsers": 100,
    "processed": 95,
    "revoked": 5,
    "errors": 0,
    "lastRun": "2025-01-20T10:00:00.000Z",
    "duration": 15000
  }
}
```

#### バッチ処理設定取得（管理者用）
```bash
GET /api/admin/batch-config

Response: {
  "success": true,
  "data": {
    "config": {
      "enabled": true,
      "interval": 60,
      "lastRun": "2025-01-20T10:00:00.000Z",
      "nextRun": "2025-01-20T11:00:00.000Z",
      "maxUsersPerBatch": 50,
      "retryAttempts": 3
    },
    "stats": {
      "totalUsers": 100,
      "processed": 95,
      "revoked": 5,
      "errors": 0,
      "lastRun": "2025-01-20T10:00:00.000Z",
      "duration": 15000
    }
  }
}
```

### Discord Bot API

#### ヘルスチェック
```bash
GET /health
Response: { status: 'ok', service: 'nft-verification-bot' }
```

#### 通知エンドポイント
```bash
POST /notify
Content-Type: application/json

{
  "discordId": "123456789012345678",
  "action": "grant_role" | "verification_failed" | "revoke_role" | "revoke_roles" | "batch_notification" | "admin_batch_notification",
  "verificationData": {
    "address": "0x...",
    "reason": "NFT no longer owned"
  },
  "timestamp": "2025-08-03T16:16:09.752Z"
}
```

#### バッチ処理実行（Discord Bot経由）
```bash
POST /api/batch-execute
Content-Type: application/json

Response: {
  "success": true,
  "data": {
    "totalUsers": 100,
    "processed": 95,
    "revoked": 5,
    "errors": 0,
    "lastRun": "2025-01-20T10:00:00.000Z",
    "duration": 15000
  }
}
```

## 🔄 Phase 2: バッチ処理機能

### バッチ処理の概要
Phase 2では、定期的なNFT保有確認とロール自動管理機能を追加しました。

#### 主要機能
1. **自動NFT保有確認**: 設定された間隔で全認証済みユーザーのNFT保有状況をチェック
2. **ロール自動削除**: NFTを売却したユーザーのロールを自動削除
3. **管理者通知**: バッチ処理完了時に管理者に詳細レポートを送信
4. **ユーザー通知**: ロール削除時にユーザーにDM通知
5. **統計管理**: 処理結果の詳細統計を保存・表示

#### バッチ処理設定
- **実行間隔**: デフォルト60分（設定可能）
- **バッチサイズ**: デフォルト50ユーザー（設定可能）
- **リトライ回数**: デフォルト3回（設定可能）
- **有効/無効**: 管理者がバッチ処理を有効/無効に切り替え可能

#### 管理者パネル機能
- **バッチ処理設定**: 実行間隔、バッチサイズ、リトライ回数の設定
- **手動実行**: バッチ処理の手動実行
- **統計表示**: 処理結果の詳細統計表示
- **リアルタイム監視**: 処理状況のリアルタイム表示

### バッチ処理の流れ
1. **スケジュール実行**: 設定された間隔でバッチ処理が自動実行
2. **NFT保有確認**: 各ユーザーのウォレットでNFT保有状況をチェック
3. **ロール削除**: NFTを売却したユーザーのロールを削除
4. **通知送信**: 削除されたユーザーと管理者に通知
5. **統計更新**: 処理結果の統計を更新

## ⚠️ 開発時の注意点

### 1. ウォレット統合

#### ✅ 正しい実装
```typescript
// @suiet/wallet-kitを使用
import { ConnectButton, useWallet } from '@suiet/wallet-kit';

const { account, connected, signPersonalMessage } = useWallet();

// 署名リクエスト
const signatureResult = await signPersonalMessage({
  message: new TextEncoder().encode(authMessage)
});
```

#### ❌ 間違いやすいポイント
- `@mysten/dapp-kit`は使用しない（不安定）
- `signMessage`ではなく`signPersonalMessage`を使用
- メッセージは`Uint8Array`でエンコード

### 2. CORS設定

#### ✅ 正しい実装
```typescript
// Cloudflare Workers側
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (c.req.method === 'OPTIONS') {
    return new Response('', { status: 200, headers: corsHeaders });
  }
  
  await next();
});
```

#### ❌ 間違いやすいポイント
- OPTIONSリクエストの処理を忘れがち
- ヘッダーの設定が不完全
- ブラウザキャッシュの影響

### 3. 環境変数管理

#### ✅ 正しい設定
- Cloudflare Workers: `wrangler.toml`
- フロントエンド: `frontend/wrangler.toml`
- Discord Bot: `bot/render.yaml`

#### ❌ 間違いやすいポイント
- ルートの`package.json`は不要
- 環境変数の重複設定
- 機密情報のハードコーディング

### 4. デプロイ順序

#### ✅ 正しい順序
1. Discord Bot（レンダー）
2. Cloudflare Workers
3. フロントエンド（Cloudflare Pages）

#### ❌ 間違いやすいポイント
- 順序を間違えるとAPI URLが無効になる
- 環境変数の依存関係を忘れる

### 5. エラーハンドリング

#### ✅ 正しい実装
```typescript
try {
  const response = await fetch(API_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = await response.json();
} catch (error) {
  console.error('Error:', error);
  // ユーザーフレンドリーなエラーメッセージ
}
```

#### ❌ 間違いやすいポイント
- エラーメッセージが技術的すぎる
- ネットワークエラーの処理不足
- タイムアウト設定の不足

## 🔍 デバッグ方法

### 1. フロントエンドデバッグ
```javascript
// ブラウザの開発者ツールで確認
console.log('Wallet connected:', account);
console.log('Signature result:', signatureResult);
console.log('Verification response:', data);
```

### 2. Cloudflare Workersデバッグ
```bash
# ローカル開発
wrangler dev

# ログ確認
wrangler tail
```

### 3. Discord Botデバッグ
```bash
# レンダーログで確認
# またはローカル開発
cd bot
npm run dev
```

### 4. バッチ処理デバッグ
```bash
# 手動実行でテスト
curl -X POST https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/admin/batch-execute

# 設定確認
curl https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/admin/batch-config
```

## 🚨 よくある問題と解決策

### 1. CORSエラー
**症状**: `Access to fetch at ... has been blocked by CORS policy`
**解決策**: Cloudflare WorkersのCORS設定を確認

### 2. ウォレット接続エラー
**症状**: `WALLET.METHOD_NOT_IMPLEMENTED_ERROR`
**解決策**: `@suiet/wallet-kit`の`signPersonalMessage`を使用

### 3. NFT検証エラー
**症状**: `NFT not found in wallet`
**解決策**: 
- NFT_COLLECTION_IDの確認
- ウォレットにNFTが存在するか確認
- ネットワーク設定の確認

### 4. Discord通知エラー
**症状**: Discordチャンネルに通知が投稿されない
**解決策**:
- Discord Botの権限確認
- レンダーの環境変数設定確認
- `/notify`エンドポイントの動作確認

### 5. バッチ処理エラー
**症状**: バッチ処理が実行されない
**解決策**:
- バッチ処理設定の確認
- KVストレージの権限確認
- 管理者パネルでの手動実行テスト

## 📊 パフォーマンス最適化

### 1. Cloudflare Workers
- ✅ エッジコンピューティング
- ✅ 高速レスポンス
- ✅ 自動スケーリング

### 2. フロントエンド
- ✅ Viteによる高速ビルド
- ✅ インラインスタイルで一貫性
- ✅ 最小限の依存関係

### 3. Discord Bot
- ✅ レンダーの無料プラン
- ✅ 自動復旧機能
- ✅ 詳細ログ機能

### 4. バッチ処理
- ✅ 設定可能なバッチサイズ
- ✅ エラー時のリトライ機能
- ✅ 統計情報の保存

## 🔒 セキュリティ考慮事項

### 1. 署名検証
- ✅ ナンスベース認証
- ✅ 署名検証（開発モード）
- ✅ タイムアウト設定

### 2. プライバシー保護
- ✅ DM通知のみ
- ✅ 5分間自動削除
- ✅ 機密情報の非表示

### 3. エラーハンドリング
- ✅ 詳細ログ（開発用）
- ✅ ユーザーフレンドリーなエラーメッセージ
- ✅ 適切なHTTPステータスコード

### 4. バッチ処理セキュリティ
- ✅ 管理者認証
- ✅ 設定可能な実行間隔
- ✅ エラー時の安全な処理

## 🎯 今後の改善点

### 1. 機能拡張
- [ ] 複数NFTコレクション対応
- [ ] ロール階層システム
- [ ] 統計ダッシュボード
- [ ] リアルタイム通知

### 2. セキュリティ強化
- [ ] 実際の署名検証実装
- [ ] レート制限
- [ ] IP制限
- [ ] より強固な認証システム

### 3. ユーザビリティ改善
- [ ] 多言語対応
- [ ] ダークモード
- [ ] モバイル最適化
- [ ] より詳細な統計表示

### 4. バッチ処理拡張
- [ ] より細かいスケジュール設定
- [ ] 複数コレクション対応
- [ ] より詳細な統計
- [ ] 自動復旧機能

## 📝 ライセンス

MIT License

## 🤝 貢献

プルリクエストやイシューの報告を歓迎します。

---

**注意**: このプロジェクトは本番環境で動作中です。変更を行う際は十分なテストを行ってください。 