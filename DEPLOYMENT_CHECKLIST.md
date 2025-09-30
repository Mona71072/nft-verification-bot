# 🚀 Walrus.pdf 準拠デプロイメントチェックリスト

このチェックリストは、NFT Verification Portal を Walrus.pdf 準拠で本番デプロイする際の必須項目です。

## 📋 事前準備

### ✅ 環境変数の設定

**Cloudflare Workers:**
```bash
wrangler secret put WALRUS_PUBLISHER_BASE
wrangler secret put WALRUS_AGGREGATOR_BASE  
wrangler secret put WALRUS_DEFAULT_EPOCHS
wrangler secret put WALRUS_DEFAULT_PERMANENT
```

**Discord Bot (.env):**
```bash
WALRUS_PUBLISHER_BASE=https://publisher.mainnet.walrus.space
WALRUS_AGGREGATOR_BASE=https://aggregator.mainnet.walrus.space
WALRUS_DEFAULT_EPOCHS=5
WALRUS_DEFAULT_PERMANENT=false
```

**Frontend (.env):**
```bash
VITE_WALRUS_AGGREGATOR_BASE=https://aggregator.mainnet.walrus.space
```

### ✅ 設定値の検証

- [ ] Publisher Base URL が正しい（mainnet/testnet）
- [ ] Aggregator Base URL が正しい（mainnet/testnet）
- [ ] デフォルト Epochs が適切（推奨: 5）
- [ ] デフォルト Permanent が適切（推奨: false）

## 🧪 受け入れ基準テスト

### ✅ 1. Blob保存テスト
```bash
curl -X PUT "https://publisher.mainnet.walrus.space/v1/blobs?epochs=5" \
  --upload-file test-image.jpg \
  -H "Content-Type: image/jpeg"
```
- [ ] HTTP 200 レスポンス
- [ ] JSON に `blobId` が含まれる
- [ ] `blobStoreResult.newlyCreated.blobObject.blobId` が存在

### ✅ 2. 表示URLテスト
```bash
curl "https://aggregator.mainnet.walrus.space/v1/blobs/{blobId}" -I
```
- [ ] HTTP 200 レスポンス
- [ ] Content-Type が適切
- [ ] Content-Length が正しい

### ✅ 3. データモデルテスト
- [ ] イベントデータに `imageUrl` フィールドが残っていない
- [ ] イベントデータに `imageCid` と `imageMimeType` が存在
- [ ] Move コール引数が `{imageCid}`, `{imageMimeType}` のみ

### ✅ 4. ミントフローテスト
- [ ] スポンサーAPI呼び出しに `imageUrl` が含まれない
- [ ] スポンサーAPI呼び出しに `imageCid` と `imageMimeType` が含まれる
- [ ] ミント後のNFTに画像が正しく表示される

### ✅ 5. Sui Display テスト
- [ ] Display の `image_url` が Aggregator 形式
- [ ] `{image_cid}` テンプレートが正しく展開される
- [ ] Sui Explorer で画像が表示される

### ✅ 6. ドキュメントアクセステスト
- [ ] `https://publisher.mainnet.walrus.space/v1/api` がアクセス可能
- [ ] `https://aggregator.mainnet.walrus.space/v1/api` がアクセス可能

## 🔧 本番ハードニング

### ✅ セキュリティ設定

**レート制限:**
- [ ] Publisher API に 10 req/min 制限
- [ ] IP ベースの制限が動作
- [ ] 自動化リクエストの検出

**CORS 設定:**
- [ ] Publisher 系は管理オリジンのみ
- [ ] Aggregator プロキシは読み取り専用で広く許可
- [ ] 不正オリジンからのアクセスをブロック

**セキュリティヘッダー:**
- [ ] CSP ヘッダーの設定
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] MIME スニッフィング防止

### ✅ キャッシュ設定

**Cloudflare キャッシュ:**
- [ ] 画像配信に `Cache-Control: public, max-age=3600`
- [ ] ETag ヘッダーの設定
- [ ] 4xx/5xx エラーの短いキャッシュ

### ✅ 監視設定

**メトリクス監視:**
- [ ] Publisher API の成功率監視
- [ ] Aggregator API の応答時間監視
- [ ] ファイルサイズ分布の監視
- [ ] エラー率のアラート設定

### ✅ UI 警告

**セキュリティ注意喚起:**
- [ ] アップロード前の公開ストレージ警告
- [ ] 画像表示時の公開アクセス警告
- [ ] 暗号化の推奨メッセージ

## 🚀 デプロイ手順

### ✅ 段階的デプロイ

**1. テスト環境:**
- [ ] 全テストが通過
- [ ] E2E フローが動作
- [ ] パフォーマンステスト完了

**2. 本番環境:**
- [ ] データベースマイグレーション
- [ ] 環境変数の設定
- [ ] セキュリティ設定の適用
- [ ] 監視の開始

**3. 検証:**
- [ ] 本番環境での受け入れ基準テスト
- [ ] ユーザーフローの確認
- [ ] パフォーマンスの確認

## 🧹 移行後のクリーンアップ

### ✅ 旧システムの削除

- [ ] 旧 Walrus ゲートウェイURL の削除
- [ ] `imageUrl` フィールドの削除
- [ ] 旧アップロードエンドポイントの削除
- [ ] フォールバックロジックの削除

### ✅ ドキュメント更新

- [ ] API ドキュメントの更新
- [ ] 開発者ガイドの更新
- [ ] トラブルシューティングガイドの更新

## 🚨 緊急時対応

### ✅ ロールバック準備

- [ ] 旧システムのバックアップ
- [ ] ロールバック手順の文書化
- [ ] 緊急連絡先の設定

### ✅ 監視アラート

- [ ] エラー率 5% 超過でアラート
- [ ] 応答時間 5秒超過でアラート
- [ ] ストレージ容量 80% 超過でアラート

## 📊 成功指標

### ✅ 技術指標

- [ ] Walrus API の成功率 > 99%
- [ ] 画像表示の成功率 > 99%
- [ ] ミントフローの成功率 > 95%
- [ ] 平均応答時間 < 2秒

### ✅ ビジネス指標

- [ ] ユーザーエクスペリエンスの維持
- [ ] NFT ミント数の維持
- [ ] Discord ロール付与の正常動作

## 🎯 最終確認

### ✅ チェックリスト完了

- [ ] 全受け入れ基準テスト通過
- [ ] セキュリティ設定完了
- [ ] 監視設定完了
- [ ] ドキュメント更新完了
- [ ] 緊急時対応準備完了

### ✅ ステークホルダー承認

- [ ] 開発チーム承認
- [ ] セキュリティチーム承認
- [ ] 運用チーム承認
- [ ] ビジネスチーム承認

---

**✅ 全項目完了後、本番デプロイを実行してください。**

**📞 問題が発生した場合:**
1. ロールバック手順を実行
2. 開発チームに連絡
3. インシデントレポートを作成

**🎉 デプロイ完了後:**
- 成功指標の監視開始
- ユーザーフィードバックの収集
- パフォーマンスデータの分析
