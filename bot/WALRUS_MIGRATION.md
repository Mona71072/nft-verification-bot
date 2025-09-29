# Walrus Storage Migration Guide

## 現在の実装（一時保存）

**環境変数**: `USE_WALRUS_STORAGE=false` (デフォルト)
- Upload Relayのみ使用
- WALトークン不要
- SUIでのtip支払いのみ
- 一時的な保存（永続化されない）

## WAL実装への移行

### 1. WALトークンの取得

**方法A: DEXでスワップ**
```bash
# Cetus、Turbos等でSUI → WAL交換
# スポンサーウォレットにWALを送金
```

**方法B: 直接送金**
```bash
# 他のウォレットからスポンサーウォレットにWALを送金
```

### 2. 環境変数の設定

**Render環境変数に追加**:
```
USE_WALRUS_STORAGE=true
```

### 3. デプロイ

```bash
git push origin main
# Renderが自動デプロイ
```

## 実装の違い

| 機能 | 一時保存 | WAL実装 |
|------|----------|---------|
| ストレージ | Upload Relay | Walrus Storage |
| 永続性 | 一時的 | 永続的 |
| コスト | SUI tipのみ | SUI + WAL |
| 複雑さ | シンプル | 標準的 |

## 切り替え手順

1. **WALトークンを取得**
2. **環境変数設定**: `USE_WALRUS_STORAGE=true`
3. **デプロイ**: `git push`
4. **テスト**: アップロード機能を確認

## 注意事項

- WAL実装ではスポンサーウォレットに十分なWALが必要
- 一時保存では画像が一定時間後に削除される可能性
- 本番環境ではWAL実装を推奨
