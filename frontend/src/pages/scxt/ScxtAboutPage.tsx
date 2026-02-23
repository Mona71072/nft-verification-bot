import { CTASection } from '@/components/scxt/CTASection';
import { FadeIn } from '@/components/motion/FadeIn';
import { useScxtSEO } from '@/hooks/useScxtSEO';

export function ScxtAboutPage() {
  useScxtSEO({ title: 'About - SCXT', description: 'SyndicateXTokyo（SCXT）は、東京発のコミュニティ。音楽・英会話・Web3の交差点。' });
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <FadeIn>
          <h1 className="text-3xl font-bold text-white mb-6">SCXT とは</h1>
          <p className="text-white/80 leading-relaxed mb-6">
            SyndicateXTokyo（SCXT）は、東京発のコミュニティです。
            音楽（DJイベント）、英会話（English Cafe）、Web3の交差点で、
            新しい出会いと体験を創っています。
          </p>
          <p className="text-white/80 leading-relaxed mb-6">
            クラブカルチャーとテクノロジー、言語と文化。
            私たちは、それらが自然に混ざり合う場を大切にしています。
          </p>
        </FadeIn>

        <FadeIn className="mt-8">
          <h2 className="text-xl font-semibold text-white mb-4">活動内容</h2>
          <ul className="space-y-2 text-white/80">
            <li>・DJ イベント（House, Techno）</li>
            <li>・English Cafe（気軽な英会話交流会）</li>
            <li>・Web3 / NFT 関連イベント</li>
          </ul>
        </FadeIn>

        <FadeIn className="mt-12">
          <h2 className="text-xl font-semibold text-white mb-4">参加する</h2>
          <p className="text-white/80 mb-4">
            Discord で最新情報をチェック。イベント申込は各イベントページから。
          </p>
          <CTASection showDiscord showWallet ticketUrl={undefined} />
        </FadeIn>
      </div>
    </div>
  );
}
