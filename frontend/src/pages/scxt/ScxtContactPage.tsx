import { CTASection } from '@/components/scxt/CTASection';
import { FadeIn } from '@/components/motion/FadeIn';
import { useScxtSEO } from '@/hooks/useScxtSEO';

const DISCORD_URL = 'https://discord.gg/syndicatextokyo';
const CONTACT_EMAIL = 'mailto:contact@syndicatextokyo.app';

export function ScxtContactPage() {
  useScxtSEO({ title: 'Contact - SCXT', description: 'イベントに関するお問い合わせ、コラボレーションのご提案など。' });

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <FadeIn>
          <h1 className="text-3xl font-bold text-white mb-6">Contact</h1>
          <p className="text-white/80 leading-relaxed mb-8">
            イベントに関するお問い合わせ、コラボレーションのご提案など、
            お気軽にご連絡ください。
          </p>
        </FadeIn>

        <FadeIn className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Discord</h2>
            <p className="text-white/70 mb-2">コミュニティへの参加はこちら</p>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/15 transition-colors"
            >
              Discord に参加
            </a>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-white mb-2">Email</h2>
            <p className="text-white/70 mb-2">お問い合わせはメールで</p>
            <a
              href={CONTACT_EMAIL}
              className="inline-flex items-center px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/15 transition-colors"
            >
              contact@syndicatextokyo.app
            </a>
          </div>
        </FadeIn>

        <FadeIn className="mt-12">
          <CTASection showDiscord ticketUrl={undefined} showWallet />
        </FadeIn>
      </div>
    </div>
  );
}
