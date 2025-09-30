# Walrus.pdf 準拠への移行ガイド

このガイドでは、NFT Verification Portal を Walrus.pdf の仕様に準拠するよう再設計する手順を説明します。

## 🎯 移行の目標

- **Walrus.pdf 準拠**: Publisher/Aggregator API を直接使用
- **データモデル統一**: `imageCid` + `imageMime` に一本化
- **URL生成統一**: Aggregator API 経由の公開読み出し
- **コードの責務分割**: サービス層・ルート層の分離

## 📋 実装済みの変更

### 1. 環境変数の更新

**変更前:**
```toml
WALRUS_UPLOAD_URL = "https://upload-relay.mainnet.walrus.space/v1/blob-upload-relay"
WALRUS_GATEWAY_BASE = "https://gateway.mainnet.walrus.space/"
```

**変更後:**
```toml
# Walrus.pdf 準拠の設定
WALRUS_PUBLISHER_BASE = "https://publisher.mainnet.walrus.space"
WALRUS_AGGREGATOR_BASE = "https://aggregator.mainnet.walrus.space"
WALRUS_DEFAULT_EPOCHS = "5"
WALRUS_DEFAULT_PERMANENT = "false"
```

### 2. 新しいモジュール構造

```
src/
├── services/
│   ├── walrus.ts      # Walrus API サービス
│   └── mint.ts        # ミント処理サービス
├── routes/
│   ├── walrus.ts      # Walrus API ルート
│   └── mint.ts        # ミント API ルート
├── utils/
│   ├── logger.ts      # ログユーティリティ
│   └── signature.ts   # 署名検証ユーティリティ
└── index.ts           # メインエントリーポイント
```

### 3. Walrus API の刷新

**新しいエンドポイント:**
- `POST /api/walrus/store` - Publisher API への画像保存
- `GET /walrus/blobs/:blobId` - Aggregator API 経由の画像配信
- `GET /api/walrus/config` - Walrus設定取得

**削除されたエンドポイント:**
- `POST /api/walrus/upload` - 旧アップロードプロキシ
- `POST /api/walrus/upload-relay` - 旧リレー転送
- `GET /api/walrus/tip-config` - 旧tip設定

### 4. データモデルの変更

**変更前:**
```typescript
interface Event {
  imageUrl?: string;    // 旧URL
  imageCid?: string;    // 既存CID
  // ...
}
```

**変更後:**
```typescript
interface Event {
  imageCid?: string;     // 必須: Walrus Blob ID
  imageMimeType?: string; // 必須: MIMEタイプ
  // imageUrl は削除、動的生成
}
```

### 5. フロントエンドの統一

**新しいユーティリティ:**
```typescript
// frontend/src/utils/walrus.ts
export const walrusUrlFromCid = (blobId?: string): string | undefined => {
  if (!blobId) return undefined;
  const aggregatorBase = import.meta.env.VITE_WALRUS_AGGREGATOR_BASE || 'https://aggregator.mainnet.walrus.space';
  return `${aggregatorBase}/v1/blobs/${encodeURIComponent(blobId)}`;
};
```

## 🚀 デプロイ手順

### 1. 環境変数の設定

**Cloudflare Workers:**
```bash
wrangler secret put WALRUS_PUBLISHER_BASE
wrangler secret put WALRUS_AGGREGATOR_BASE
wrangler secret put WALRUS_DEFAULT_EPOCHS
wrangler secret put WALRUS_DEFAULT_PERMANENT
```

**Discord Bot:**
```bash
# .env に追加
WALRUS_PUBLISHER_BASE=https://publisher.mainnet.walrus.space
WALRUS_AGGREGATOR_BASE=https://aggregator.mainnet.walrus.space
WALRUS_DEFAULT_EPOCHS=5
WALRUS_DEFAULT_PERMANENT=false
```

**Frontend:**
```bash
# .env に追加
VITE_WALRUS_AGGREGATOR_BASE=https://aggregator.mainnet.walrus.space
```

### 2. 既存データの移行

```bash
cd scripts
npm install
npm run migrate:walrus
```

### 3. API テスト

```bash
cd scripts
npm run test:walrus
```

### 4. デプロイ

```bash
# Cloudflare Workers
wrangler deploy

# Discord Bot
npm run build
npm start

# Frontend
npm run build
npm run preview
```

## 🧪 テスト手順

### 1. Walrus API の直接テスト

```bash
# 画像アップロード
curl -X PUT "https://publisher.mainnet.walrus.space/v1/blobs?permanent=true" \
  --upload-file test-image.png \
  -H "Content-Type: image/png"

# 画像ダウンロード
curl "https://aggregator.mainnet.walrus.space/v1/blobs/{blobId}" \
  -o downloaded-image.png
```

### 2. プロキシ経由テスト

```bash
# 画像アップロード（プロキシ経由）
curl -X POST "https://your-worker.workers.dev/api/walrus/store" \
  -F "file=@test-image.png"

# 画像表示（プロキシ経由）
curl "https://your-worker.workers.dev/walrus/blobs/{blobId}" \
  -o downloaded-image-proxy.png
```

### 3. E2E テスト

1. **イベント作成**: AdminPanel で新しいイベントを作成
2. **画像アップロード**: Walrus に画像を保存
3. **ミント実行**: MintPage でNFTをミント
4. **Discord連携**: ロール付与の確認

## 🔧 トラブルシューティング

### よくある問題

**1. Walrus API エラー**
```
Error: Walrus store failed: 403
```
→ 環境変数の設定を確認、ネットワークアクセスを確認

**2. 画像表示エラー**
```
Image failed to load: https://aggregator.mainnet.walrus.space/v1/blobs/...
```
→ Blob ID の存在確認、Aggregator API の応答確認

**3. ミントエラー**
```
Sponsor mint failed: Invalid argument template: {imageUrl}
```
→ Move コールの引数テンプレートを `{imageCid}`, `{imageMimeType}` に更新

### デバッグ方法

**1. ログ確認**
```bash
# Cloudflare Workers
wrangler tail

# Discord Bot
tail -f logs/app.log
```

**2. API レスポンス確認**
```bash
# Walrus 設定確認
curl "https://your-worker.workers.dev/api/walrus/config"

# イベント情報確認
curl "https://your-worker.workers.dev/api/events/{eventId}/public"
```

## 📚 参考資料

- [Walrus.pdf 公式仕様](https://walrus.space/docs)
- [Sui Display 仕様](https://docs.sui.io/concepts/sui-move-concepts/display)
- [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)

## 🎉 完了チェックリスト

- [ ] 環境変数の設定完了
- [ ] 既存データの移行完了
- [ ] Walrus API テスト通過
- [ ] フロントエンドの画像表示確認
- [ ] ミントフローの動作確認
- [ ] Discord ロール付与の動作確認
- [ ] 本番環境へのデプロイ完了

---

この移行により、NFT Verification Portal は Walrus.pdf の仕様に完全準拠し、より堅牢で保守性の高いシステムになります。
