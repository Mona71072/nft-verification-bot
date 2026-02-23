import { HeroSection } from '@/components/scxt/HeroSection';
import { useScxtSEO } from '@/hooks/useScxtSEO';

export function ScxtHomePage() {
  useScxtSEO({ title: 'SCXT', description: '東京発。音楽・英会話・Web3が交わる、新しいイベントとコミュニティ。' });
  return (
    <div className="min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-16">
        <HeroSection />
      </div>
    </div>
  );
}
