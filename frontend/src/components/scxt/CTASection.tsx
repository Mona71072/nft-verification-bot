import { ConnectButton } from '@mysten/dapp-kit';
import { cn } from '@/lib/utils';

const DISCORD_URL = 'https://discord.gg/syndicatextokyo';

interface CTASectionProps {
  ticketUrl?: string;
  ticketLabel?: string;
  showDiscord?: boolean;
  showWallet?: boolean;
  className?: string;
}

export function CTASection({
  ticketUrl,
  ticketLabel = '参加する',
  showDiscord = true,
  showWallet = true,
  className,
}: CTASectionProps) {
  return (
    <div className={cn('flex flex-wrap gap-3 items-center', className)}>
      {ticketUrl && (
        <a
          href={ticketUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-6 py-3 bg-white text-black font-semibold rounded-lg hover:bg-white/90 transition-colors"
        >
          {ticketLabel}
        </a>
      )}
      {showDiscord && (
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-6 py-3 border border-white/30 text-white font-medium rounded-lg hover:bg-white/10 transition-colors"
        >
          Discord
        </a>
      )}
      {showWallet && (
        <div className="[&_button]:!bg-white/10 [&_button]:!text-white [&_button]:!border-white/20">
          <ConnectButton />
        </div>
      )}
    </div>
  );
}
