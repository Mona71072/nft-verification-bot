# 自前Walrus Publisher セットアップガイド（Mainnet）

## 概要

このガイドでは、Mainnet用の自前Walrus Publisherをセットアップする手順を説明します。

---

## 前提条件

- [ ] Sui CLIがインストール済み
- [ ] Suiウォレットが作成済み
- [ ] Mainnetウォレットに十分なSUIとWALがある
- [ ] Rustがインストール済み（cargo使用）
- [ ] 安定したネットワーク環境

---

## Phase 1: Walrus CLIインストール

### A. 最新バイナリのダウンロード

```bash
# Walrus公式リリースから最新版をダウンロード
# macOS (Apple Silicon)の場合
curl -LO https://github.com/MystenLabs/walrus/releases/latest/download/walrus-latest-macos-arm64
chmod +x walrus-latest-macos-arm64
sudo mv walrus-latest-macos-arm64 /usr/local/bin/walrus

# macOS (Intel)の場合
curl -LO https://github.com/MystenLabs/walrus/releases/latest/download/walrus-latest-macos-x86_64
chmod +x walrus-latest-macos-x86_64
sudo mv walrus-latest-macos-x86_64 /usr/local/bin/walrus

# Linuxの場合
curl -LO https://github.com/MystenLabs/walrus/releases/latest/download/walrus-latest-ubuntu-x86_64
chmod +x walrus-latest-ubuntu-x86_64
sudo mv walrus-latest-ubuntu-x86_64 /usr/local/bin/walrus

# バージョン確認
walrus --version
```

### B. またはCargoでビルド

```bash
# Rustがインストール済みの場合
cargo install --git https://github.com/MystenLabs/walrus.git walrus
```

---

## Phase 2: Sui Mainnetウォレット準備

### A. Suiウォレット確認

```bash
# アクティブなアドレスを確認
sui client active-address

# Mainnet環境を確認
sui client envs

# Mainnetに切り替え（必要な場合）
sui client switch --env mainnet

# 残高確認
sui client balance

# 必要残高の目安:
# - SUI: 最低10 SUI（ガス代用）
# - WAL: 使用量に応じて（ストレージコスト）
```

### B. 残高不足の場合

```bash
# SUIの入手方法:
# 1. 取引所から送金
# 2. Sui Bridgeを使用
# 3. Sui Faucet（Testnetのみ）

# WALの入手方法:
# 1. DEXで購入（例: Cetus）
# 2. Sui Walletで交換
```

---

## Phase 3: Walrus設定ファイル作成

### A. 設定ディレクトリ作成

```bash
# Walrus設定ディレクトリを作成
mkdir -p ~/.config/walrus
```

### B. Mainnet設定ファイル作成

```bash
# client_config.yamlを作成
cat > ~/.config/walrus/client_config.yaml << 'EOF'
# Walrus Mainnet設定
system_object: "0x3efc80ff0e87f2b5b5d1c2b5b5c9e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0"
staking_object: "0x4efc80ff0e87f2b5b5d1c2b5b5c9e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0"
exchange_objects:
  - "0x5efc80ff0e87f2b5b5d1c2b5b5c9e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0"
  - "0x6efc80ff0e87f2b5b5d1c2b5b5c9e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0"
subsidies_object: "0x7efc80ff0e87f2b5b5d1c2b5b5c9e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0"
EOF

# ⚠️ 上記のオブジェクトIDはプレースホルダーです
# 実際のMainnet用オブジェクトIDは以下で確認:
# https://docs.walrus.site/usage/setup.html
```

### C. 実際のMainnetオブジェクトID取得

```bash
# Walrus公式ドキュメントから最新のオブジェクトIDを取得
curl -s https://docs.walrus.site/usage/setup.html | grep -A 20 "mainnet"

# または、Walrus CLIで取得
walrus info --network mainnet
```

---

## Phase 4: Publisher起動（JWT認証付き）

### A. Publisher用ウォレットディレクトリ作成

```bash
# Publisherサブウォレット用ディレクトリ
PUBLISHER_WALLETS_DIR=~/.config/walrus/publisher-wallets
mkdir -p "$PUBLISHER_WALLETS_DIR"
```

### B. JWT認証設定ファイル作成

```bash
# Publisher設定ファイル作成
cat > ~/.config/walrus/publisher_config.yaml << 'EOF'
# Publisher設定（JWT認証付き）
bind_address: "0.0.0.0:31415"
sub_wallets_dir: "~/.config/walrus/publisher-wallets"
n_clients: 8

# JWT認証設定
auth:
  jwt:
    enabled: true
    # Cloudflare Workersで設定した秘密鍵と同じものを使用
    verify_secret: "YOUR_BASE64_SECRET_HERE"
    max_file_size: 10485760  # 10MB
    max_epochs: 53  # 約2年
    require_expiration: true
    expiration_max: 300  # 最大5分
EOF

# ⚠️ YOUR_BASE64_SECRET_HERE を実際の秘密鍵に置き換える
```

### C. Publisher起動

```bash
# Publisherを起動
walrus publisher \
  --config ~/.config/walrus/publisher_config.yaml \
  --wallet ~/.sui/sui_config/client.yaml

# またはシンプルに
walrus publisher \
  --bind-address "0.0.0.0:31415" \
  --sub-wallets-dir "$PUBLISHER_WALLETS_DIR" \
  --n-clients 8
```

### D. バックグラウンド起動（本番用）

```bash
# systemdサービスとして起動（Linux）
sudo tee /etc/systemd/system/walrus-publisher.service > /dev/null << 'EOF'
[Unit]
Description=Walrus Publisher
After=network.target

[Service]
Type=simple
User=YOUR_USER
WorkingDirectory=/home/YOUR_USER
ExecStart=/usr/local/bin/walrus publisher --config /home/YOUR_USER/.config/walrus/publisher_config.yaml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# サービス有効化
sudo systemctl daemon-reload
sudo systemctl enable walrus-publisher
sudo systemctl start walrus-publisher

# ステータス確認
sudo systemctl status walrus-publisher
```

---

## Phase 5: Worker設定更新

### A. wrangler.toml更新

```bash
cd "/Users/user/sui/NFT Verification "

# wrangler.tomlを編集（20行目付近）
# WALRUS_PUBLISHER_BASE を実際のPublisher URLに変更

# ローカル開発の場合
WALRUS_PUBLISHER_BASE = "http://localhost:31415"

# 本番デプロイの場合（ドメイン設定後）
WALRUS_PUBLISHER_BASE = "https://walrus-publisher.yourdomain.com"
```

### B. デプロイとテスト

```bash
# Worker デプロイ
wrangler deploy

# 診断実行
curl https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/walrus/diagnose | jq .

# 期待結果:
# - health.publisher: "healthy"
# - health.canWrite: true
```

---

## Phase 6: スモークテスト

### A. 小さいファイルでPUTテスト

```bash
# テスト画像作成
echo -n "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==" | base64 -d > /tmp/test.png

# Worker経由でアップロード
curl -X POST \
  "https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/walrus/store?epochs=1" \
  -F "file=@/tmp/test.png" | jq .

# 期待結果:
# {
#   "success": true,
#   "data": {
#     "blobId": "...",
#     "contentType": "image/png"
#   }
# }
```

### B. 読み出し確認

```bash
# 上記で取得したblobIdを使用
BLOB_ID="<returned-blob-id>"

# Aggregatorで読み出し
curl -I "https://aggregator.walrus-mainnet.walrus.space/v1/blobs/$BLOB_ID"

# 期待結果: HTTP/2 200
```

### C. 同一ファイル再アップロード（idempotency確認）

```bash
# 同じファイルを再アップロード
curl -X POST \
  "https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/walrus/store?epochs=1" \
  -F "file=@/tmp/test.png" | jq .

# 期待結果: alreadyCertified が返る
```

---

## トラブルシューティング

### Publisher起動エラー

**問題**: `Error: Failed to initialize publisher`

**解決策**:
```bash
# 1. Suiウォレット設定確認
sui client envs

# 2. 残高確認
sui client balance

# 3. 設定ファイル確認
cat ~/.config/walrus/client_config.yaml

# 4. ログ確認
walrus publisher --log-level debug
```

### JWT認証エラー

**問題**: `401 Unauthorized`

**解決策**:
```bash
# 1. JWT秘密鍵が一致しているか確認
# Cloudflare Workers側: wrangler secret list
# Publisher側: publisher_config.yaml の verify_secret

# 2. JWTペイロードを確認
# exp, jti, max_size, max_epochs が適切か
```

### 残高不足エラー

**問題**: `Error: Insufficient balance`

**解決策**:
```bash
# 1. 残高確認
sui client balance

# 2. SUI/WAL入金
# 取引所から送金またはDEXで購入

# 3. 入金確認
sui client balance
```

---

## 監視

### Publisher健全性チェック

```bash
# 1. Publisherプロセス確認
ps aux | grep walrus

# 2. ポート確認
lsof -i :31415

# 3. ログ確認
tail -f ~/walrus-publisher.log

# 4. 残高監視（定期実行推奨）
watch -n 300 'sui client balance'  # 5分毎
```

### Worker診断

```bash
# 定期診断（60秒毎）
watch -n 60 'curl -s https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/walrus/diagnose | jq .health'
```

---

## セキュリティ

### JWT秘密鍵の安全管理

```bash
# 秘密鍵を環境変数で管理
export JWT_SECRET=$(openssl rand -base64 32)

# publisher_config.yamlに設定
sed -i "s/YOUR_BASE64_SECRET_HERE/$JWT_SECRET/" ~/.config/walrus/publisher_config.yaml

# Cloudflare Workersに設定
echo $JWT_SECRET | wrangler secret put WALRUS_PUBLISHER_JWT_SECRET
```

### ファイアウォール設定

```bash
# Publisherポートを保護（Cloudflare Workersからのみ許可）
# UFW (Ubuntu/Debian)の場合
sudo ufw allow from CLOUDFLARE_IP_RANGE to any port 31415

# iptablesの場合
sudo iptables -A INPUT -p tcp --dport 31415 -s CLOUDFLARE_IP_RANGE -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 31415 -j DROP
```

---

## 本番デプロイ

### A. ドメイン設定

```bash
# 1. DNSレコード設定
# A レコード: walrus-publisher.yourdomain.com → YOUR_SERVER_IP

# 2. SSL証明書取得（Let's Encrypt）
sudo certbot --nginx -d walrus-publisher.yourdomain.com

# 3. Nginx設定
sudo tee /etc/nginx/sites-available/walrus-publisher > /dev/null << 'EOF'
server {
    listen 443 ssl;
    server_name walrus-publisher.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/walrus-publisher.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/walrus-publisher.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:31415;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/walrus-publisher /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### B. wrangler.toml最終更新

```toml
# 本番Publisher URL
WALRUS_PUBLISHER_BASE = "https://walrus-publisher.yourdomain.com"
```

### C. デプロイ

```bash
cd "/Users/user/sui/NFT Verification "
wrangler deploy

# 診断確認
curl https://nft-verification-production.mona-syndicatextokyo.workers.dev/api/walrus/diagnose | jq .health

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

## クイックスタート（開発環境）

ローカル開発の場合、以下の手順で即座に開始できます：

```bash
# 1. Walrus CLIインストール
curl -LO https://github.com/MystenLabs/walrus/releases/latest/download/walrus-latest-macos-arm64
chmod +x walrus-latest-macos-arm64
sudo mv walrus-latest-macos-arm64 /usr/local/bin/walrus

# 2. 設定ディレクトリ作成
mkdir -p ~/.config/walrus/publisher-wallets

# 3. Publisher起動（シンプル版、JWT認証なし - 開発のみ）
walrus publisher \
  --bind-address "127.0.0.1:31415" \
  --sub-wallets-dir ~/.config/walrus/publisher-wallets \
  --n-clients 4

# 4. 別ターミナルでwrangler.toml更新
# WALRUS_PUBLISHER_BASE = "http://localhost:31415"

# 5. Worker デプロイ
wrangler deploy

# 6. テスト
curl -X POST "http://localhost:8787/api/walrus/store?epochs=1" \
  -F "file=@test.png"
```

**⚠️ 注意**: ローカル開発でJWT認証なしは、開発環境のみです。本番では必ずJWT認証を有効にしてください。

---

## 次のステップ

1. ✅ Walrus CLIインストール
2. ✅ Suiウォレット準備
3. ✅ Walrus設定ファイル作成
4. ✅ Publisher起動
5. ✅ wrangler.toml更新
6. ✅ デプロイ＆テスト

すべて完了したら、`WALRUS_PRODUCTION_RUNBOOK.md`のスモークテストを実行してください。

