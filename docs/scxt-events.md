# SCXT イベント追加手順

SCXT イベントサイトのイベント情報を追加・編集する手順です。

## データの場所

イベントデータは `frontend/src/data/events.ts` に定義されています。

## イベント追加の手順

1. `frontend/src/data/events.ts` を開く
2. `scxtEvents` 配列に新しいイベントオブジェクトを追加する
3. 以下を必ず設定する:
   - `slug`: URL 用の一意の識別子（例: `dj-night-april-2025`）
   - `title`: イベント名
   - `category`: `dj` または `english`
   - `startAt`, `endAt`: ISO 8601 形式（例: `2025-04-20T14:00:00+09:00`）
   - `venue`, `address`: 会場名と住所
   - `priceText`: 料金表示テキスト
   - `ticketUrl`: 申込フォーム（Peatix / Google Form 等）の URL
   - `heroImage`: ヒーロー画像のパス（例: `/scxt-placeholder-hero.svg`）
   - `description`: 説明文

## データ構造（全フィールド）

```ts
interface ScxtEvent {
  slug: string;
  title: string;
  category: 'dj' | 'english';
  startAt: string;
  endAt: string;
  venue: string;
  address: string;
  priceText: string;
  capacityText?: string;
  ticketUrl: string;
  heroImage: string;
  galleryImages?: string[];
  lineup?: { name: string; role?: string }[];
  timetable?: { time: string; description: string }[];
  description: string;
  highlights?: string[];
  notes?: string[];
  faq?: { q: string; a: string }[];
  tags?: string[];
}
```

## 画像について

- プレースホルダは `/public/scxt-placeholder-hero.svg` に配置済み
- 本番画像は `/public/` に配置し、`heroImage` で参照（例: `/scxt-events/dj-night-2025.jpg`）
- OGP 用画像は 1200x630 推奨

## CMS への差し替え

将来的に CMS（Strapi, Contentful 等）を使う場合:

1. `frontend/src/data/events.ts` の `scxtEvents` を API 呼び出しに置き換える
2. `frontend/src/hooks/useScxtEvents.ts` の `scxtEvents` 参照を `fetch` に変更
3. 型（`ScxtEvent`）は維持し、API レスポンスを同じ形式にマッピングする

## ルート一覧

| ルート | 説明 |
|--------|------|
| `/scxt` | ホーム |
| `/scxt/events` | イベント一覧 |
| `/scxt/events/[slug]` | イベント詳細 |
| `/scxt/about` | SCXT とは |
| `/scxt/contact` | 問い合わせ |
