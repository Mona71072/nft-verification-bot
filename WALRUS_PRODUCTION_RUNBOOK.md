# Walrus Mainnet 本番投入 Runbook

## 即実行できる手順（ゼロダウンタイム）

### Phase 1: Publisher設定（5分）

#### A. JWT秘密鍵の設定（推奨方式）

```bash
# ランダムな32バイトシークレットを生成
SECRET=$(openssl rand -base64 32)

# Cloudflare Workers Secretsに設定
cd "/Users/user/sui/NFT Verification "
wrangler secret put WALRUS_PUBLISHER_JWT_SECRET
# プロンプトで上記SECRETを貼り付け
```

#### B. Publisher Base URLの設定

```bash
# wrangler.toml を編集
# WALRUS_PUBLISHER_BASE を実際のPublisher URLに変更

# 例: 自前Publisher
WALRUS_PUBLISHER_BASE = "https://walrus-publisher.yourdomain.com"

# 例: マネージドPublisher
WALRUS_PUBLISHER_BASE = "https://publisher-api.walrus-provider.com"
```

---

### Phase 2: スモークテスト（3分）

#### A. 診断エンドポイント確認

```bash
# Walrus疎通診断
curl https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/walrus/diagnose | jq .

# 期待結果:
# - health.aggregator: "healthy"
# - health.publisher: "healthy"
# - health.canRead: true
# - health.canWrite: true
```

#### B. 小さいテスト画像でPUT

```bash
# 1x1ピクセルのテスト画像を作成
echo -n "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" | base64 -d > test.png

# Worker経由でアップロード
curl -X POST \
  "https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/walrus/store?epochs=1" \
  -F "file=@test.png" | jq .

# 期待結果:
# {
#   "success": true,
#   "data": {
#     "blobId": "...",
#     "contentType": "image/png",
#     "size": 68
#   }
# }
```

#### C. Aggregator読み出し確認

```bash
# 上記で取得したblobIdを使用
BLOB_ID="<returned-blob-id>"

curl -I "https://aggregator.walrus-mainnet.walrus.space/v1/blobs/$BLOB_ID"

# 期待結果:
# HTTP/2 200
# content-type: image/png
```

---

### Phase 3: カナリアテスト（10分）

#### A. 実際の画像でフルフロー

```bash
# 1. 実画像をアップロード
curl -X POST \
  "https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/walrus/store?epochs=12" \
  -F "file=@event-image.jpg" | jq . > upload-result.json

# 2. blobIdを抽出
BLOB_ID=$(jq -r '.data.blobId' upload-result.json)
echo "Blob ID: $BLOB_ID"

# 3. Aggregatorで読み出し確認
curl -I "https://aggregator.walrus-mainnet.walrus.space/v1/blobs/$BLOB_ID"

# 4. 同じファイルを再アップロード（alreadyCertified確認）
curl -X POST \
  "https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/walrus/store?epochs=12" \
  -F "file=@event-image.jpg" | jq .

# 期待結果: alreadyCertified が返る（同一コンテンツ = 同一blobId）
```

#### B. UI統合テスト

1. https://main.nft-verification-frontend.pages.dev/admin
2. イベント管理 → 新規イベント作成
3. 画像をドラッグ&ドロップ
4. ブラウザコンソールでアップロード成功を確認
5. blobIdがフォームに設定されることを確認
6. ドラフト保存
7. イベント一覧で画像が表示されることを確認

---

### Phase 4: 本番稼働（1分）

#### A. デプロイ

```bash
cd "/Users/user/sui/NFT Verification "

# Worker デプロイ
wrangler deploy

# Frontend デプロイ
cd frontend
npx wrangler pages deploy dist
```

#### B. ヘルスチェック

```bash
# 定期的に診断実行（60秒毎を推奨）
watch -n 60 'curl -s https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/walrus/diagnose | jq .health'

# 期待結果:
# {
#   "aggregator": "healthy",
#   "publisher": "healthy",
#   "overall": "healthy",
#   "canRead": true,
#   "canWrite": true
# }
```

---

## トラブルシューティング

### 問題: 401 Unauthorized

**原因**: JWT無効、期限切れ、署名不一致

**確認**:
```bash
# JWT秘密鍵が設定されているか確認
wrangler secret list

# 期待: WALRUS_PUBLISHER_JWT_SECRET が表示される
```

**修正**:
```bash
# シークレットを再設定
wrangler secret put WALRUS_PUBLISHER_JWT_SECRET
```

---

### 問題: 413 Payload Too Large

**原因**: ファイルサイズ超過

**確認**:
```bash
# ファイルサイズを確認
ls -lh event-image.jpg

# Publisher設定のmax_sizeを確認
```

**修正**:
- 画像を圧縮
- Publisher設定のmax_sizeを増やす
- JWT payloadのmax_sizeを調整

---

### 問題: 530 Origin DNS Error

**原因**: Publisher到達不可

**確認**:
```bash
# 診断実行
curl https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/walrus/diagnose | jq .dns.publisherA

# DNSレコードを確認
dig publisher.yourdomain.example
```

**修正**:
- Publisher URLを確認
- DNSレコードを設定
- Publisherサービスの起動確認

---

### 問題: 画像が表示されない

**原因**: Aggregator到達不可、blobId不正

**確認**:
```bash
# Aggregator直接アクセス
curl -I "https://aggregator.walrus-mainnet.walrus.space/v1/blobs/$BLOB_ID"

# フォールバック確認
curl -I "https://aggregator.suicore.com/v1/blobs/$BLOB_ID"
```

**修正**:
- blobIdを確認
- Aggregatorフォールバックを使用
- ブラウザキャッシュをクリア

---

## 監視とアラート

### 定期監視項目

```bash
# 1. ヘルス診断（60秒毎）
curl -s https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/walrus/diagnose | jq .health

# 2. Publisher残高確認（1時間毎）
sui client balance --address $PUBLISHER_WALLET_ADDRESS

# 3. エラーレート（1分毎）
# Cloudflare Workers ダッシュボードで 5xx率を確認
```

### アラート条件

| 条件 | レベル | アクション |
|------|--------|-----------|
| `health.overall != "healthy"` | Warning | 診断ログ確認 |
| `health.canWrite == false` | Critical | Publisher確認 |
| `health.canRead == false` | Critical | Aggregatorフォールバック確認 |
| 5xxエラー率 > 5% | Warning | ログ確認 |
| 5xxエラー率 > 20% | Critical | 緊急対応 |
| Publisher残高 < 10 SUI | Warning | 入金準備 |
| Publisher残高 < 1 SUI | Critical | 緊急入金 |

---

## ロールバック手順

### 緊急時（Publisher障害）

```bash
# 1. 画像アップロード機能を一時無効化
# wrangler.toml
WALRUS_PUBLISHER_BASE = "https://maintenance.example.com"

# 2. デプロイ
wrangler deploy

# 3. UIでアップロード不可メッセージを表示
# "現在メンテナンス中です。しばらくお待ちください。"
```

### 通常時（設定変更）

```bash
# 1. 設定変更
nano wrangler.toml

# 2. デプロイ
wrangler deploy

# 3. ヘルスチェック
curl https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/walrus/diagnose | jq .health
```

---

## セキュリティチェックリスト

- [ ] JWT秘密鍵を`wrangler secret`で管理（環境変数に直接書かない）
- [ ] JWT有効期限を短期に設定（180秒推奨）
- [ ] JWT payloadにmax_size/max_epochsを設定
- [ ] Publisher側でJWT検証を実装
- [ ] CORS設定で許可オリジンを制限
- [ ] レート制限を有効化
- [ ] Publisher walletの秘密鍵を安全に管理
- [ ] 定期的な残高監視
- [ ] エラーログの定期確認

---

## コスト最適化チェックリスト

- [ ] デフォルトepochsを要件に合わせて最小化（現在12）
- [ ] 一時的な画像にはepochs=5を使用
- [ ] 画像を事前圧縮（JPEGなら80-85%品質推奨）
- [ ] 重複画像の再アップロードを防止（同一blobId）
- [ ] Publisher残高を定期監視
- [ ] 月次コスト見積もりを実施

---

## 本番投入前の最終チェック

```bash
# 1. 全ての環境変数を確認
wrangler secret list
cat wrangler.toml | grep WALRUS

# 2. ヘルス診断
curl https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/walrus/diagnose | jq .

# 3. スモークテスト
echo "test" > /tmp/test.txt
curl -X POST \
  "https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/walrus/store?epochs=1" \
  -F "file=@/tmp/test.txt" | jq .

# 4. UI動作確認
# https://main.nft-verification-frontend.pages.dev/admin でイベント作成

# 5. エンドツーエンドテスト
# イベント作成 → 画像アップロード → ドラフト保存 → 公開 → ミント

# すべて成功 → 本番投入OK ✅
```

---

## サポート連絡先

- **Walrus公式**: https://docs.walrus.site/
- **Sui公式**: https://sui.io/
- **問題報告**: GitHub Issues

---

## 更新履歴

- 2025-10-01: 初版作成（Mainnet対応完了）

