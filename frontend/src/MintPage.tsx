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
        <div style={{ color: 'white' }}>読み込み中...</div>
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
      <div style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 520 }}>
        <h1 style={{ marginTop: 0, marginBottom: 8 }}>{event?.name || 'Event Mint'}</h1>
        <p style={{ color: '#666', marginTop: 0, marginBottom: 8 }}>
          Event ID: <b>{eventId || '(not specified)'}</b>
        </p>
        {event?.description && (
          <p style={{ color: '#444', marginTop: 0, marginBottom: 12 }}>{event.description}</p>
        )}
        {event?.imageUrl && (
          <div style={{ marginBottom: 16 }}>
            <img src={event.imageUrl} alt={event.name} style={{ width: '100%', borderRadius: 12 }} />
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <ConnectButton />
        </div>
        <button
          onClick={handleMint}
          disabled={!event?.active || minting}
          style={{ width: '100%', padding: '12px 16px', background: (!event?.active || minting) ? '#9ca3af' : '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: (!event?.active || minting) ? 'not-allowed' : 'pointer', fontWeight: 700, marginBottom: 8 }}
        >
          {minting ? 'ミント中...' : '無料でミント'}
        </button>
        {!event?.active && (
          <div style={{ color: '#b91c1c', textAlign: 'center', marginBottom: 8 }}>
            現在このイベントはミント不可の期間です
          </div>
        )}
        {message && (
          <div style={{ color: '#b91c1c', textAlign: 'center', marginBottom: 8 }}>{message}</div>
        )}
        <p style={{ margin: 0, color: '#444' }}>次のステップでミント実行ボタンと署名連携を追加します。</p>
      </div>
    </div>
  );
}


