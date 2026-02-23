/**
 * グローバルフッター（SCXT セクション用リンク、SNS、Copyright）
 */

const DISCORD_URL = 'https://discord.gg/syndicatextokyo';
const CONTACT_URL = 'mailto:contact@syndicatextokyo.app';

interface GlobalFooterProps {
  onNavigate?: (path: string) => void;
}

export function GlobalFooter({ onNavigate }: GlobalFooterProps) {
  return (
    <footer
      role="contentinfo"
      style={{
        background: '#0a0a0a',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '2rem 1rem',
        marginTop: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <nav
          role="navigation"
          aria-label="Footer navigation"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1rem',
            justifyContent: 'center',
          }}
        >
          <button
            type="button"
            onClick={() => navigateTo('/scxt')}
            style={{
              color: 'rgba(255,255,255,0.8)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            SCXT
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('/scxt/events')}
            style={{
              color: 'rgba(255,255,255,0.8)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Events
          </button>
          <button
            type="button"
            onClick={() => navigateTo('/scxt/about')}
            style={{
              color: 'rgba(255,255,255,0.8)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            About
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('/scxt/contact')}
            style={{
              color: 'rgba(255,255,255,0.8)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Contact
          </button>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'rgba(255,255,255,0.8)',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Discord
          </a>
          <a
            href={CONTACT_URL}
            style={{
              color: 'rgba(255,255,255,0.8)',
              textDecoration: 'none',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Contact
          </a>
        </nav>
        <p
          style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.75rem',
            margin: 0,
          }}
        >
          © {new Date().getFullYear()} SyndicateXTokyo / SCXT
        </p>
      </div>
    </footer>
  );
}
