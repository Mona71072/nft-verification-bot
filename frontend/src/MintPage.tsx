import { useEffect, useMemo, useState } from 'react';
import { ConnectButton } from '@suiet/wallet-kit';
import '@suiet/wallet-kit/style.css';
import { useWalletWithErrorHandling } from './hooks/useWallet';

export default function MintPage() {
  const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';
  const { account, connected, signPersonalMessage } = useWalletWithErrorHandling() as any;

  type MintEvent = {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    active: boolean;
    startAt?: string;
    endAt?: string;
  };

  const eventId = useMemo(() => {
    const parts = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : [];
    return parts.length >= 2 ? parts[1] : '';
  }, []);

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<MintEvent | null>(null);
  const [message, setMessage] = useState('');
  const [minting, setMinting] = useState(false);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!eventId) {
        setMessage('イベントIDが指定されていません');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/api/events/${eventId}/public`);
        const data = await res.json();
        if (!ignore) {
          if (data.success) {
            setEvent(data.data);
          } else {
            setMessage(data.error || 'イベント情報の取得に失敗しました');
          }
        }
      } catch {
        if (!ignore) setMessage('イベント情報の取得に失敗しました');
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [API_BASE_URL, eventId]);

  const handleMint = async () => {
    try {
      if (!event) {
        setMessage('イベントが取得できていません');
        return;
      }
      if (!connected || !account?.address || !signPersonalMessage) {
        setMessage('ウォレットを接続してください');
        return;
      }

      setMinting(true);
      setMessage('');

      // 1) ナンス（既存APIを流用）
      const nonceResp = await fetch(`${API_BASE_URL}/api/nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordId: 'event', address: account.address, scope: 'mint', eventId })
      });
      const nonceData = await nonceResp.json();
      if (!nonceData?.success) throw new Error(nonceData?.error || 'ナンスの発行に失敗しました');

      // 2) 署名メッセージ
      const timestamp = new Date().toISOString();
      const authMessage = `SXT Event Mint\naddress=${account.address}\neventId=${eventId}\nnonce=${nonceData.data.nonce}\ntimestamp=${timestamp}`;
      const bytes = new TextEncoder().encode(authMessage);
      const sig = await signPersonalMessage({ message: bytes });

      // 3) ミント要求（WorkersがスポンサーAPIへ委譲）
      const mintResp = await fetch(`${API_BASE_URL}/api/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          address: account.address,
          signature: sig.signature,
          bytes: sig.bytes,
          publicKey: (sig as any)?.publicKey ?? (account as any)?.publicKey,
          authMessage
        })
      });
      const mintData = await mintResp.json();
      if (mintData?.success) {
        setMessage(`ミント完了: ${mintData?.data?.txDigest || ''}`);
      } else {
        setMessage(mintData?.error || 'ミントに失敗しました');
      }
    } catch (e: any) {
      setMessage(e?.message || 'ミント処理でエラーが発生しました');
    } finally {
      setMinting(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: 'white',
          fontSize: '18px',
          fontWeight: '500'
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            border: '3px solid rgba(255,255,255,0.3)',
            borderTop: '3px solid white',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          読み込み中...
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '24px',
        padding: '32px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        animation: 'slideUp 0.6s ease-out'
      }}>
        <style>{`
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          .mint-button {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .mint-button:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          }
          .mint-button:active:not(:disabled) {
            transform: translateY(0);
          }
          .image-container {
            transition: transform 0.3s ease;
          }
          .image-container:hover {
            transform: scale(1.02);
          }
        `}</style>

        {/* Event Image */}
        {event?.imageUrl && (
          <div className="image-container" style={{
            marginBottom: '24px',
            borderRadius: '16px',
            overflow: 'hidden',
            position: 'relative'
          }}>
            <img 
              src={event.imageUrl} 
              alt={event.name} 
              style={{
                width: '100%',
                height: '240px',
                objectFit: 'cover',
                display: 'block'
              }}
            />
            <div style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600'
            }}>
              {event?.active ? '🟢 LIVE' : '🔴 ENDED'}
            </div>
          </div>
        )}

        {/* Event Title */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{
            margin: '0 0 8px 0',
            fontSize: '28px',
            fontWeight: '800',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            {event?.name || 'Event Mint'}
          </h1>
          {event?.description && (
            <p style={{
              margin: '0 0 16px 0',
              color: '#6b7280',
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              {event.description}
            </p>
          )}
        </div>

        {/* Wallet Connection */}
        {!connected && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '24px'
          }}>
            <div style={{
              padding: '16px',
              background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
              borderRadius: '16px',
              border: '2px dashed #d1d5db'
            }}>
              <ConnectButton />
            </div>
          </div>
        )}

        {/* Mint Button */}
        <button
          className="mint-button"
          onClick={handleMint}
          disabled={!connected || !event?.active || minting}
          style={{
            width: '100%',
            padding: '16px 24px',
            background: (!connected || !event?.active || minting) 
              ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '16px',
            cursor: (!connected || !event?.active || minting) ? 'not-allowed' : 'pointer',
            fontWeight: '700',
            fontSize: '18px',
            marginBottom: '16px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {minting && (
            <div style={{
              position: 'absolute',
              left: '20px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '20px',
              height: '20px',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTop: '2px solid white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
          )}
          <span style={{ marginLeft: minting ? '32px' : '0' }}>
            {minting ? 'ミント中...' : connected ? '🎁 無料でミント' : 'ウォレットを接続'}
          </span>
        </button>

        {/* Status Messages */}
        {!event?.active && event && (
          <div style={{
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            color: '#92400e',
            padding: '12px 16px',
            borderRadius: '12px',
            textAlign: 'center',
            marginBottom: '16px',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            ⏰ このイベントは現在ミント期間外です
          </div>
        )}

        {message && (
          <div style={{
            background: message.includes('完了') 
              ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
              : 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
            color: message.includes('完了') ? '#065f46' : '#991b1b',
            padding: '12px 16px',
            borderRadius: '12px',
            textAlign: 'center',
            marginBottom: '16px',
            fontSize: '14px',
            fontWeight: '600'
          }}>
            {message.includes('完了') ? '✅ ' : '⚠️ '}
            {message}
          </div>
        )}

        {/* Event Details */}
        <div style={{
          background: 'rgba(107, 114, 128, 0.1)',
          borderRadius: '12px',
          padding: '16px',
          fontSize: '14px',
          color: '#6b7280'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Event ID:</span>
            <span style={{ fontWeight: '600', color: '#374151' }}>{eventId || 'N/A'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Network:</span>
            <span style={{ fontWeight: '600', color: '#374151' }}>Sui Mainnet</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Cost:</span>
            <span style={{ fontWeight: '600', color: '#10b981' }}>FREE (Gas Sponsored)</span>
          </div>
        </div>
      </div>
    </div>
  );
}


