import React from 'react';
import { ConnectButton } from '@mysten/dapp-kit';
import '@mysten/dapp-kit/dist/index.css';
import { ToastProvider, useToast } from '../components/ui/ToastProvider';
import { useEvents } from '../hooks/queries/useEvents';
import { useWalletWithErrorHandling } from '../hooks/useWallet';

type Step = 'wallet' | 'event' | 'sign' | 'result';
type Status = 'idle' | 'loading' | 'success' | 'error';

interface MintEvent {
  id: string;
  name: string;
  description: string;
  imageCid?: string;
  imageMimeType?: string;
  moveCall: any;
  collectionId?: string;
  startAt?: string;
  endAt?: string;
}

function MintFlowPageInner() {
  const { showToast } = useToast();
  const mintInProgressRef = React.useRef(false); // 二重送信防止（stateは非同期で反映されるためrefを使用）
  const [step, setStep] = React.useState<Step>('wallet');
  const [status, setStatus] = React.useState<Status>('idle');
  const [selectedEvent, setSelectedEvent] = React.useState<MintEvent | null>(null);
  const [txDigest, setTxDigest] = React.useState<string>('');
  const [errorMessage, setErrorMessage] = React.useState<string>('');

  const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

  const { account, connected, signPersonalMessage } = useWalletWithErrorHandling() as any;
  const { data: eventsData = [], isLoading: eventsLoading, error: eventsError } = useEvents();

  React.useEffect(() => {
    if (eventsError && step === 'event') {
      showToast('イベント一覧の取得に失敗しました', 'error');
    }
  }, [eventsError, step, showToast]);

  React.useEffect(() => {
    if (connected && account?.address && step === 'wallet') {
      setStep('event');
      showToast('ウォレットに接続しました', 'success');
    }
  }, [connected, account?.address, step, showToast]);

  const onEventSelect = (event: MintEvent) => {
    setSelectedEvent(event);
    setStep('sign');
    showToast('イベントを選択しました', 'success');
  };

  const onSignAndMint = async () => {
    if (!selectedEvent || !connected || !account?.address || !signPersonalMessage) {
      showToast('ウォレットが接続されていません', 'error');
      return;
    }
    // 二重クリック防止: refで即座にチェック（stateは次のレンダリングまで反映されない）
    if (mintInProgressRef.current) {
      showToast('ミント処理中です。しばらくお待ちください。', 'info');
      return;
    }
    mintInProgressRef.current = true;
    setStatus('loading');
    setErrorMessage('');

    try {
      showToast('ナンスを取得しています...', 'info');
      const nonceResp = await fetch(`${API_BASE}/api/nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordId: 'event',
          address: account.address,
          scope: 'mint',
          eventId: selectedEvent.id
        })
      });

      if (!nonceResp.ok) {
        throw new Error(`認証エラー (${nonceResp.status})`);
      }

      const nonceData = await nonceResp.json();
      if (!nonceData?.success) {
        throw new Error(nonceData?.error || 'ナンスの取得に失敗しました');
      }

      showToast('ウォレットで署名してください...', 'info');
      const timestamp = new Date().toISOString();
      const authMessage = `SXT Event Mint\naddress=${account.address}\neventId=${selectedEvent.id}\nnonce=${nonceData.data.nonce}\ntimestamp=${timestamp}`;
      const bytes = new TextEncoder().encode(authMessage);

      let sig;
      try {
        sig = await signPersonalMessage({ message: bytes });
      } catch {
        throw new Error('署名がキャンセルされました');
      }

      showToast('ミントを実行しています...', 'info');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      let mintResp: Response;
      try {
        mintResp = await fetch(`${API_BASE}/api/mint`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: selectedEvent.id,
            address: account.address,
            signature: sig.signature,
            bytes: Array.from(sig.bytes instanceof Uint8Array ? sig.bytes : new Uint8Array(sig.bytes)),
            publicKey: (sig as any)?.publicKey ?? (account as any)?.publicKey,
            authMessage
          }),
          signal: controller.signal
        });
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('ミントリクエストがタイムアウトしました。もう一度お試しください。');
        }
        throw fetchError;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!mintResp.ok) {
        const errorText = await mintResp.text().catch(() => 'Unknown error');
        let errorData;
        try { errorData = JSON.parse(errorText); } catch { errorData = { error: errorText }; }
        throw new Error(`ミントエラー (${mintResp.status}): ${errorData.error || errorText}`);
      }

      const mintData = await mintResp.json().catch(() => ({ success: false, error: 'レスポンスの解析に失敗しました' }));
      if (mintData?.success) {
        const digest = mintData?.data?.txDigest || 'N/A';
        setTxDigest(digest);
        setStatus('success');
        setStep('result');
        showToast('ミントが完了しました！', 'success');
      } else {
        throw new Error(mintData?.error || 'ミントに失敗しました');
      }
    } catch (e: any) {
      setStatus('error');
      setErrorMessage(e.message || 'ミント処理中にエラーが発生しました');
      setStep('result');
      showToast(e.message || 'ミントに失敗しました', 'error');
    } finally {
      mintInProgressRef.current = false; // 処理完了時は必ずリセット（成功・失敗どちらでも）
    }
  };

  const onRetry = () => {
    setStep('event');
    setStatus('idle');
    setSelectedEvent(null);
    setTxDigest('');
    setErrorMessage('');
    showToast('イベント選択からやり直します', 'info');
  };

  const stepDefs = [
    { key: 'wallet', label: 'ウォレット接続', active: step === 'wallet', completed: step !== 'wallet' },
    { key: 'event', label: 'イベント選択', active: step === 'event', completed: ['sign', 'result'].includes(step) },
    { key: 'sign', label: '署名 & ミント', active: step === 'sign', completed: step === 'result' },
    { key: 'result', label: '完了', active: step === 'result', completed: false }
  ];

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 32, textAlign: 'center', color: 'white' }}>
        NFT Mint
      </h1>

      {/* Progress bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32, position: 'relative' }}>
        {stepDefs.map((s, i) => (
          <React.Fragment key={s.key}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative', zIndex: 1 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: s.completed ? '#16a34a' : s.active ? '#2563eb' : 'rgba(255,255,255,0.15)',
                color: s.completed || s.active ? 'white' : '#94a3b8',
                fontWeight: 700, fontSize: 14, border: '2px solid transparent',
                borderColor: s.active ? '#3b82f6' : 'transparent',
                transition: 'all 0.3s ease'
              }}>
                {s.completed ? '\u2713' : i + 1}
              </div>
              <div style={{
                marginTop: 8, fontSize: 12, fontWeight: s.active ? 600 : 400,
                color: s.active ? '#93c5fd' : s.completed ? '#86efac' : '#94a3b8'
              }}>
                {s.label}
              </div>
            </div>
            {i < stepDefs.length - 1 && (
              <div style={{
                position: 'absolute', top: 20,
                left: `calc(${((i + 0.5) / stepDefs.length) * 100}%)`,
                width: `calc(${(1 / stepDefs.length) * 100}%)`,
                height: 2, background: s.completed ? '#16a34a' : 'rgba(255,255,255,0.15)',
                zIndex: 0
              }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div style={{
        minHeight: 350, padding: 32, borderRadius: 16,
        background: 'rgba(30, 27, 75, 0.65)',
        border: '1px solid rgba(79, 70, 229, 0.35)',
        backdropFilter: 'blur(10px)'
      }}>
        {step === 'wallet' && (
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: 20, marginBottom: 16, color: '#e0e7ff' }}>ウォレット接続</h3>
            <p style={{ color: '#a5b4fc', marginBottom: 24 }}>
              ミントを開始するためにウォレットに接続してください
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ConnectButton />
            </div>
          </div>
        )}

        {step === 'event' && (
          <div>
            <h3 style={{ fontSize: 20, marginBottom: 16, color: '#e0e7ff' }}>イベント選択</h3>
            <p style={{ color: '#a5b4fc', marginBottom: 24 }}>
              ミントしたいイベントを選択してください
            </p>
            {eventsLoading ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#a5b4fc' }}>読み込み中...</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {(eventsData as MintEvent[]).map((event) => (
                  <button
                    key={event.id}
                    onClick={() => onEventSelect(event)}
                    style={{
                      padding: 16, border: '1px solid rgba(79, 70, 229, 0.35)', borderRadius: 10, cursor: 'pointer',
                      background: 'rgba(15, 23, 42, 0.35)', transition: 'all 0.2s', textAlign: 'left',
                      color: '#e0e7ff'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = 'rgba(79, 70, 229, 0.2)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(79, 70, 229, 0.35)'; e.currentTarget.style.background = 'rgba(15, 23, 42, 0.35)'; }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{event.name}</div>
                    <div style={{ color: '#a5b4fc', fontSize: 14 }}>{event.description}</div>
                  </button>
                ))}
                {(eventsData as MintEvent[]).length === 0 && (
                  <div style={{ textAlign: 'center', padding: 40, color: '#a5b4fc' }}>
                    現在ミント可能なイベントはありません
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === 'sign' && (
          <div style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: 20, marginBottom: 16, color: '#e0e7ff' }}>署名 & ミント実行</h3>
            <p style={{ color: '#a5b4fc', marginBottom: 8 }}>
              選択したイベント: <strong style={{ color: '#e0e7ff' }}>{selectedEvent?.name}</strong>
            </p>
            <p style={{ color: '#a5b4fc', marginBottom: 24, fontSize: 14 }}>
              ボタンを押すとウォレットで署名を求められ、署名完了後に自動的にミントが実行されます。
            </p>
            <button
              onClick={onSignAndMint}
              disabled={status === 'loading'}
              style={{
                padding: '14px 32px', borderRadius: 10, border: 'none',
                background: status === 'loading'
                  ? 'rgba(79, 70, 229, 0.3)'
                  : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: 'white', cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                fontSize: 16, fontWeight: 600,
                boxShadow: status === 'loading' ? 'none' : '0 4px 16px rgba(99, 102, 241, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              {status === 'loading' ? '処理中...' : '署名してミント'}
            </button>
            {status === 'loading' && (
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 24, height: 24, border: '3px solid rgba(99, 102, 241, 0.3)',
                  borderTop: '3px solid #6366f1', borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                <span style={{ color: '#a5b4fc', fontSize: 14 }}>ウォレットの確認をお待ちください...</span>
              </div>
            )}
            <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {step === 'result' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              {status === 'success' ? '\u2705' : '\u274C'}
            </div>
            <h3 style={{ fontSize: 20, marginBottom: 16, color: status === 'success' ? '#86efac' : '#fca5a5' }}>
              {status === 'success' ? 'ミント完了！' : 'ミント失敗'}
            </h3>
            {status === 'success' && txDigest && (
              <div style={{ marginBottom: 24, padding: 16, background: 'rgba(15, 23, 42, 0.5)', borderRadius: 10, border: '1px solid rgba(79, 70, 229, 0.3)' }}>
                <div style={{ fontSize: 14, color: '#a5b4fc', marginBottom: 8 }}>トランザクションID</div>
                <a
                  href={`https://suivision.xyz/txblock/${txDigest}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 12, color: '#93c5fd', wordBreak: 'break-all', textDecoration: 'underline' }}
                >
                  {txDigest}
                </a>
              </div>
            )}
            {status === 'error' && errorMessage && (
              <div style={{ marginBottom: 24, padding: 16, background: 'rgba(239, 68, 68, 0.1)', borderRadius: 10, border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <div style={{ fontSize: 14, color: '#fca5a5' }}>{errorMessage}</div>
              </div>
            )}
            <button
              onClick={onRetry}
              style={{
                padding: '12px 24px', borderRadius: 10,
                border: '1px solid rgba(79, 70, 229, 0.35)',
                background: 'rgba(30, 27, 75, 0.65)',
                color: '#e0e7ff', cursor: 'pointer',
                fontWeight: 600, transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(79, 70, 229, 0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(30, 27, 75, 0.65)'; }}
            >
              もう一度ミント
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MintFlowPage() {
  return (
    <ToastProvider>
      <MintFlowPageInner />
    </ToastProvider>
  );
}
