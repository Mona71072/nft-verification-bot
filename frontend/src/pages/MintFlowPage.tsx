import React from 'react';
import { ToastProvider, useToast } from '../components/ui/ToastProvider';
import { useEvents } from '../hooks/queries/useEvents';

type Step = 'wallet' | 'event' | 'sign' | 'mint' | 'result';
type Status = 'idle' | 'loading' | 'success' | 'error';

interface Event {
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
  const [step, setStep] = React.useState<Step>('wallet');
  const [status, setStatus] = React.useState<Status>('idle');
  const [selectedEvent, setSelectedEvent] = React.useState<Event | null>(null);
  const [walletAddress, setWalletAddress] = React.useState<string>('');
  const [txDigest, setTxDigest] = React.useState<string>('');

  const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

  // TanStack Queryを使用してキャッシュを活用（リクエスト削減のため）
  const { data: eventsData = [], isLoading: eventsLoading, error: eventsError } = useEvents();
  
  // エラーハンドリング
  React.useEffect(() => {
    if (eventsError && step === 'event') {
      showToast('イベント一覧の取得に失敗しました', 'error');
    }
  }, [eventsError, step, showToast]);

  const onWalletConnect = (address: string) => {
    setWalletAddress(address);
    setStep('event');
    showToast('ウォレットに接続しました', 'success');
  };

  const onEventSelect = (event: Event) => {
    setSelectedEvent(event);
    setStep('sign');
    showToast('イベントを選択しました', 'success');
  };

  const onSign = async () => {
    setStatus('loading');
    setStep('mint');
    showToast('署名をリクエストしています...', 'info');
    
    // 実際の署名処理はウォレット側で行われる想定
    // ここでは簡易的にタイムアウトでミントへ進行
    setTimeout(() => {
      setStatus('idle');
      showToast('署名が完了しました', 'success');
    }, 2000);
  };

  const onMint = async () => {
    if (!selectedEvent || !walletAddress) return;
    
    setStatus('loading');
    showToast('ミントを実行しています...', 'info');
    
    try {
      const res = await fetch(`${API_BASE}/api/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEvent.id,
          address: walletAddress,
          // 実際の署名データは省略（ウォレット連携時に追加）
        })
      });
      
      const json = await res.json();
      if (json.success && json.txDigest) {
        setTxDigest(json.txDigest);
        setStatus('success');
        setStep('result');
        showToast('ミントが完了しました！', 'success');
      } else {
        throw new Error(json.error || 'ミントに失敗しました');
      }
    } catch (e: any) {
      setStatus('error');
      setStep('result');
      showToast(e.message || 'ミントに失敗しました', 'error');
    }
  };

  const onRetry = () => {
    setStep('wallet');
    setStatus('idle');
    setSelectedEvent(null);
    setWalletAddress('');
    setTxDigest('');
    showToast('最初からやり直します', 'info');
  };

  const steps = [
    { key: 'wallet', label: 'ウォレット接続', active: step === 'wallet', completed: ['event', 'sign', 'mint', 'result'].includes(step) },
    { key: 'event', label: 'イベント選択', active: step === 'event', completed: ['sign', 'mint', 'result'].includes(step) },
    { key: 'sign', label: '署名', active: step === 'sign', completed: ['mint', 'result'].includes(step) },
    { key: 'mint', label: 'ミント実行', active: step === 'mint', completed: step === 'result' },
    { key: 'result', label: '完了', active: step === 'result', completed: false }
  ];

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 32, textAlign: 'center' }}>
        NFT ミント
      </h1>

      {/* ステップ進行バー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 32, position: 'relative' }}>
        {steps.map((s, i) => (
          <React.Fragment key={s.key}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: s.completed ? '#16a34a' : s.active ? '#2563eb' : '#e5e7eb',
                color: s.completed || s.active ? 'white' : '#64748b',
                fontWeight: 700
              }}>
                {s.completed ? '✓' : i + 1}
              </div>
              <div style={{
                marginTop: 8, fontSize: 12, fontWeight: s.active ? 600 : 400,
                color: s.active ? '#2563eb' : s.completed ? '#16a34a' : '#64748b'
              }}>
                {s.label}
              </div>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                position: 'absolute', top: 20, left: `calc(${(i + 1) * (100 / steps.length)}% - 40px)`,
                width: 'calc(100% / 5)', height: 2, background: s.completed ? '#16a34a' : '#e5e7eb'
              }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ステップ内容 */}
      <div style={{ minHeight: 400, padding: 24, border: '1px solid #e5e7eb', borderRadius: 12, background: '#fafafa' }}>
        {step === 'wallet' && (
          <WalletStep onConnect={onWalletConnect} />
        )}
        
        {step === 'event' && (
          <EventStep events={eventsData as Event[]} onSelect={onEventSelect} loading={eventsLoading || status === 'loading'} />
        )}
        
        {step === 'sign' && (
          <SignStep event={selectedEvent} onSign={onSign} loading={status === 'loading'} />
        )}
        
        {step === 'mint' && (
          <MintStep event={selectedEvent} onMint={onMint} loading={status === 'loading'} />
        )}
        
        {step === 'result' && (
          <ResultStep 
            success={status === 'success'} 
            txDigest={txDigest} 
            event={selectedEvent}
            onRetry={onRetry}
          />
        )}
      </div>
    </div>
  );
}

// ウォレット接続ステップ
function WalletStep({ onConnect }: { onConnect: (address: string) => void }) {
  const [address, setAddress] = React.useState('');
  
  return (
    <div style={{ textAlign: 'center' }}>
      <h3 style={{ fontSize: 20, marginBottom: 16 }}>ウォレット接続</h3>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        ミントを開始するためにウォレットに接続してください
      </p>
      
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 16 }}>
        <input
          type="text"
          placeholder="ウォレットアドレスを入力"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={{ padding: '12px 16px', borderRadius: 8, border: '1px solid #e5e7eb', width: 300 }}
        />
        <button
          onClick={() => address && onConnect(address)}
          disabled={!address}
          style={{
            padding: '12px 24px', borderRadius: 8, border: 'none',
            background: address ? '#2563eb' : '#e5e7eb',
            color: 'white', cursor: address ? 'pointer' : 'not-allowed'
          }}
        >
          接続
        </button>
      </div>
      
      <div style={{ fontSize: 12, color: '#64748b' }}>
        実際の実装では Suiet Wallet Kit を使用してウォレット接続を行います
      </div>
    </div>
  );
}

// イベント選択ステップ
function EventStep({ events, onSelect, loading }: { events: Event[], onSelect: (event: Event) => void, loading: boolean }) {
  return (
    <div>
      <h3 style={{ fontSize: 20, marginBottom: 16 }}>イベント選択</h3>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        ミントしたいイベントを選択してください
      </p>
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>読み込み中...</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {events.map((event) => (
            <div
              key={event.id}
              onClick={() => onSelect(event)}
              style={{
                padding: 16, border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer',
                background: 'white', transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = '#2563eb'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>{event.name}</div>
              <div style={{ color: '#64748b', fontSize: 14 }}>{event.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 署名ステップ
function SignStep({ event, onSign, loading }: { event: Event | null, onSign: () => void, loading: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h3 style={{ fontSize: 20, marginBottom: 16 }}>署名</h3>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        選択したイベント: <strong>{event?.name}</strong>
      </p>
      
      <button
        onClick={onSign}
        disabled={loading}
        style={{
          padding: '12px 24px', borderRadius: 8, border: 'none',
          background: loading ? '#e5e7eb' : '#2563eb',
          color: 'white', cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        {loading ? '署名中...' : '署名を実行'}
      </button>
      
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 16 }}>
        実際の実装ではウォレットで署名ダイアログが表示されます
      </div>
    </div>
  );
}

// ミント実行ステップ
function MintStep({ onMint, loading }: { event: Event | null, onMint: () => void, loading: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h3 style={{ fontSize: 20, marginBottom: 16 }}>ミント実行</h3>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        NFT のミントを実行しています...
      </p>
      
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <div style={{
          width: 40, height: 40, border: '4px solid #e5e7eb', borderTop: '4px solid #2563eb',
          borderRadius: '50%', animation: loading ? 'spin 1s linear infinite' : 'none'
        }} />
        <div style={{ color: '#64748b' }}>
          {loading ? 'ミント処理中...' : '準備完了'}
        </div>
      </div>
      
      {!loading && (
        <button
          onClick={onMint}
          style={{
            marginTop: 24, padding: '12px 24px', borderRadius: 8, border: 'none',
            background: '#16a34a', color: 'white', cursor: 'pointer'
          }}
        >
          ミントを実行
        </button>
      )}
      
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// 結果表示ステップ
function ResultStep({ success, txDigest, onRetry }: { 
  success: boolean, 
  txDigest: string, 
  event: Event | null, 
  onRetry: () => void 
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        fontSize: 48, marginBottom: 16,
        color: success ? '#16a34a' : '#dc2626'
      }}>
        {success ? '✅' : '❌'}
      </div>
      
      <h3 style={{ fontSize: 20, marginBottom: 16, color: success ? '#16a34a' : '#dc2626' }}>
        {success ? 'ミント完了！' : 'ミント失敗'}
      </h3>
      
      {success && (
        <div style={{ marginBottom: 24, padding: 16, background: '#f0f9ff', borderRadius: 8, border: '1px solid #bae6fd' }}>
          <div style={{ fontSize: 14, color: '#0369a1', marginBottom: 8 }}>トランザクションID</div>
          <code style={{ fontSize: 12, color: '#0369a1', wordBreak: 'break-all' }}>{txDigest}</code>
        </div>
      )}
      
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <button
          onClick={onRetry}
          style={{
            padding: '12px 24px', borderRadius: 8, border: '1px solid #e5e7eb',
            background: 'white', color: '#374151', cursor: 'pointer'
          }}
        >
          もう一度ミント
        </button>
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
