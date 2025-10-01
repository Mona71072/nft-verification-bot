# Walrus Mainnet 運用ガイド

## 概要

このガイドは、Walrus.pdf準拠のMainnet運用のための設定と運用手順を説明します。

## アーキテクチャ

```
フロント → Worker → Authenticated Publisher (JWT) → Walrus Mainnet
                  ↓
               Aggregator (公開読み出し)
```

### コンポーネント

1. **Aggregator（読み出し）**: 公開、認証不要
2. **Publisher（書き込み）**: JWT認証必須、SUI/WAL消費

---

## 設定

### 1. 環境変数（wrangler.toml）

```toml
# 読み出し（公開Aggregator）
WALRUS_AGGREGATOR_BASE = "https://aggregator.walrus-mainnet.walrus.space"
WALRUS_AGGREGATOR_FALLBACKS = "https://aggregator.suicore.com,https://sui-walrus-mainnet-aggregator.bwarelabs.com,https://walrus-agg.mainnet.obelisk.sh"

# 書き込み（認証付きPublisher）
WALRUS_PUBLISHER_BASE = "https://your-publisher.example.com"
WALRUS_PUBLISHER_AUTH = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 保存ポリシー（PDF準拠: 寿命を必ず明示）
WALRUS_DEFAULT_EPOCHS = "12"  # 約24週間（Mainnet: 1 epoch ≈ 2週間）
WALRUS_DEFAULT_PERMANENT = "false"
```

### 2. Publisher設定

#### 選択肢A: 自前Publisher運用

1. **Walrus CLIインストール**
   ```bash
   cargo install walrus
   ```

2. **Publisher設定ファイル作成**
   ```yaml
   # publisher-config.yaml
   auth:
     jwt:
       enabled: true
       secret_key: "your-secret-key"
       expiration: 3600  # 1時間
       size_limit: 10485760  # 10MB
       epochs_limit: 53  # 最大約2年
   ```

3. **Suiウォレット設定**
   ```bash
   # SUIとWALを十分に入金
   sui client balance
   ```

4. **Publisher起動**
   ```bash
   walrus publisher start --config publisher-config.yaml
   ```

#### 選択肢B: マネージドPublisher

委託先からBase URLとJWTを受領して設定。

---

## API仕様（PDF準拠）

### 書き込み（PUT）

```bash
# Epochs指定
curl -X PUT "https://your-publisher.example.com/v1/blobs?epochs=12" \
  --data-binary @./image.jpg \
  -H "Content-Type: application/octet-stream" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 永続保存
curl -X PUT "https://your-publisher.example.com/v1/blobs?permanent=true" \
  --data-binary @./image.jpg \
  -H "Content-Type: application/octet-stream" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Blobオブジェクトを指定アドレスに送付
curl -X PUT "https://your-publisher.example.com/v1/blobs?epochs=12&send_object_to=0xYourSuiAddress" \
  --data-binary @./image.jpg \
  -H "Content-Type: application/octet-stream" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**レスポンス例**:
```json
{
  "blobStoreResult": {
    "newlyCreated": {
      "blobObject": {
        "blobId": "URL-safe-base64-encoded-id",
        "size": 12345,
        "encodingType": "RedStuff",
        "certifiedEpoch": 100
      }
    }
  }
}
```

### 読み出し（GET）

```bash
# Aggregator経由（認証不要）
curl -I "https://aggregator.walrus-mainnet.walrus.space/v1/blobs/BLOB_ID"
```

---

## JWT認証

### JWT構造（推奨）

```json
{
  "sub": "user-id",
  "exp": 1735689600,  // 短期（1時間以内推奨）
  "jti": "unique-id",  // リプレイ防止
  "max_size": 10485760,  // 10MB
  "max_epochs": 12
}
```

### JWT発行例（Node.js）

```javascript
const jwt = require('jsonwebtoken');

const token = jwt.sign({
  sub: 'user-123',
  exp: Math.floor(Date.now() / 1000) + 3600, // 1時間
  jti: crypto.randomUUID(),
  max_size: 10485760,
  max_epochs: 12
}, 'your-secret-key');
```

---

## 運用チェックリスト

### 起動前

- [ ] Aggregator疎通確認（`/api/walrus/diagnose`）
- [ ] Publisher JWT設定完了
- [ ] Publisherウォレット残高確認（SUI + WAL）
- [ ] 寿命ポリシー決定（epochs or permanent）

### 定期監視

- [ ] Publisher残高監視（SUI/WAL）
- [ ] JWT有効期限管理
- [ ] エラーレート監視（5xx）
- [ ] 診断エンドポイント定期実行（60秒毎）

### トラブルシューティング

#### 530エラー
- DNS解決失敗またはPublisher到達不可
- `curl -I $WALRUS_PUBLISHER_BASE/v1/blobs` で確認

#### 401エラー
- JWT無効または期限切れ
- JWT署名・有効期限・形式を確認

#### 413エラー
- ファイルサイズ超過
- JWT `max_size` またはPublisher設定を確認

#### 429エラー
- レート制限
- リトライバックオフを確認

---

## 診断コマンド

### 疎通確認
```bash
curl https://your-worker.workers.dev/api/walrus/diagnose | jq .
```

### Publisher直接テスト
```bash
echo "test" | curl -X PUT \
  "$WALRUS_PUBLISHER_BASE/v1/blobs?epochs=1" \
  --data-binary @- \
  -H "Content-Type: application/octet-stream" \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Aggregator読み出しテスト
```bash
curl -I "$WALRUS_AGGREGATOR_BASE/v1/blobs/BLOB_ID"
```

---

## コスト最適化

### 見積もり計算

```
コスト = ファイルサイズ(bytes) × epochs × レート(WAL/byte/epoch)
```

### 推奨設定

- **一時的な画像**: `epochs=5` （約10週間）
- **標準保存**: `epochs=12` （約24週間）
- **長期保存**: `epochs=26` （約1年）
- **永続保存**: `permanent=true`

### 残高監視

```bash
# Publisherウォレット残高確認
sui client balance --address $PUBLISHER_ADDRESS
```

---

## セキュリティ

### JWT管理

- ✅ 短期有効期限（1時間以内推奨）
- ✅ 一意のJTI（リプレイ防止）
- ✅ サイズ・epochs上限を設定
- ❌ JWTをフロントに直接露出しない
- ❌ 長期トークンの使用を避ける

### アクセス制御

- ✅ Workerを経由した書き込みのみ
- ✅ CORS設定で許可オリジンを制限
- ✅ レート制限の実装
- ❌ PublisherをフロントからDirect Accessしない

---

## PDF準拠チェックリスト

- [x] 書き込み: PUT /v1/blobs（バイト列直接送信）
- [x] 読み出し: GET /v1/blobs/{blobId}（Aggregator経由）
- [x] 寿命明示: ?epochs=n / ?permanent=true / ?deletable=true
- [x] JWT認証: Authorization: Bearer
- [x] データモデル: imageCid + imageMime のみ
- [x] URL生成: Aggregator URLを動的生成
- [x] リトライ: 5xx/ネットワークエラーのみ
- [x] タイムアウト: 15秒
- [x] エラーログ: name/message/cause

---

## 参考リンク

- [Walrus公式ドキュメント](https://docs.walrus.site/)
- [Walrus.pdf](https://docs.walrus.site/walrus.pdf)
- [Sui公式サイト](https://sui.io/)

---

## サポート

問題が発生した場合:

1. `/api/walrus/diagnose` で診断実行
2. ブラウザコンソールでエラーログ確認
3. Publisherログで詳細確認
4. 上記で解決しない場合は公式サポートへ

