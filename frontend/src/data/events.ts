/**
 * SCXT イベントデータ
 * 後で CMS に差し替え可能な設計（このファイルを fetch / API 呼び出しに変更）
 */

export interface ScxtEvent {
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

/**
 * Asia/Tokyo で日時をフォーマット
 */
export function formatEventDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * 日付のみ（時刻なし）を Asia/Tokyo でフォーマット
 */
export function formatEventDateShort(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

export const scxtEvents: ScxtEvent[] = [
  {
    slug: 'dj-night-march-2025',
    title: 'SCXT DJ Night Vol.1',
    category: 'dj',
    startAt: '2025-03-15T20:00:00+09:00',
    endAt: '2025-03-16T02:00:00+09:00',
    venue: 'Unit',
    address: '東京都渋谷区道玄坂2-10-12 新南口ビルB2F',
    priceText: '前売 2,500円 / 当日 3,000円',
    capacityText: '120名',
    ticketUrl: 'https://peatix.com/example',
    heroImage: '/scxt-placeholder-hero.svg',
    lineup: [
      { name: 'DJ A', role: 'House' },
      { name: 'DJ B', role: 'Techno' },
    ],
    timetable: [
      { time: '20:00', description: 'Doors Open' },
      { time: '21:00', description: 'DJ A' },
      { time: '23:00', description: 'DJ B' },
    ],
    description:
      'SyndicateXTokyo 初の DJ イベント。東京発、クラブカルチャーとWeb3の交差点で、新しい一夜を。',
    highlights: ['初開催', '2フロア', '限定NFT付き前売券あり'],
    notes: ['20歳以上', '身分証持参必須'],
    faq: [
      { q: '支払いは何がありますか？', a: '現金・クレジットカード・電子マネーでお支払いいただけます。' },
      { q: 'キャンセルできますか？', a: '開演日の3日前までPeatix経由でキャンセル可能です。' },
    ],
    tags: ['house', 'techno', 'tokyo'],
  },
  {
    slug: 'english-cafe-april-2025',
    title: 'English Cafe – Spring Edition',
    category: 'english',
    startAt: '2025-04-20T14:00:00+09:00',
    endAt: '2025-04-20T17:00:00+09:00',
    venue: '渋谷 某カフェ',
    address: '東京都渋谷区渋谷1-2-3',
    priceText: '参加費 1,500円（1ドリンク付）',
    ticketUrl: 'https://forms.google.com/example',
    heroImage: '/scxt-placeholder-hero.svg',
    description:
      '気軽に英語で話せるカフェイベント。音楽・Web3に興味のある方も歓迎。ネイティブゲストあり。',
    highlights: ['初心者歓迎', '少人数制', 'フリートーク中心'],
    notes: ['事前申込推奨'],
    faq: [
      { q: '英語ができなくても参加できますか？', a: 'はい、初めての方も歓迎です。気軽にお越しください。' },
      { q: '途中参加は可能ですか？', a: '可能です。空きがあればご参加いただけます。' },
    ],
    tags: ['english', 'cafe', 'networking'],
  },
];
