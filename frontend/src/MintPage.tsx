import { useEffect, useMemo, useState } from 'react';
import { ConnectButton } from '@mysten/dapp-kit';
import '@mysten/dapp-kit/dist/index.css';
import { useWalletWithErrorHandling } from './hooks/useWallet';
import { getImageDisplayUrl } from './utils/walrus';

export default function MintPage() {
  const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';
  const { account, connected, signPersonalMessage } = useWalletWithErrorHandling() as any;

  type MintEvent = {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    imageCid?: string;
    imageMimeType?: string;
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
  const [alreadyMinted, setAlreadyMinted] = useState(false);
  const [checkingOwnership, setCheckingOwnership] = useState(false);
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    status: 'not-started' | 'active' | 'ended';
  } | null>(null);

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

  // Countdown timer logic
  useEffect(() => {
    if (!event?.startAt || !event?.endAt) return;

    const updateCountdown = () => {
      const now = new Date().getTime();
      const start = new Date(event.startAt!).getTime();
      const end = new Date(event.endAt!).getTime();

      let targetTime: number;
      let status: 'not-started' | 'active' | 'ended';

      if (now < start) {
        targetTime = start;
        status = 'not-started';
      } else if (now >= start && now < end) {
        targetTime = end;
        status = 'active';
      } else {
        status = 'ended';
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, status });
        return;
      }

      const distance = targetTime - now;
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      setCountdown({ days, hours, minutes, seconds, status });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [event]);

  // Check if user already owns this event's NFT
  useEffect(() => {
    if (!connected || !account?.address || !eventId) {
      setAlreadyMinted(false);
      return;
    }

    let ignore = false;
    (async () => {
      setCheckingOwnership(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/mints/check?eventId=${eventId}&address=${account.address}`);
        const data = await res.json();
        if (!ignore) {
          if (data.success && data.alreadyMinted) {
            setAlreadyMinted(true);
          } else {
            setAlreadyMinted(false);
          }
        }
      } catch (error) {
        console.error('Failed to check NFT ownership:', error);
        if (!ignore) setAlreadyMinted(false);
      } finally {
        if (!ignore) setCheckingOwnership(false);
      }
    })();

    return () => { ignore = true; };
  }, [connected, account?.address, eventId, API_BASE_URL]);

  const handleMint = async () => {
    try {
      if (!event) {
        setMessage('ERROR: Event information could not be retrieved');
        return;
      }
      if (!connected || !account?.address || !signPersonalMessage) {
        setMessage('ERROR: Please connect your wallet');
        return;
      }

      // 既にミント済みチェック
      if (alreadyMinted) {
        setMessage('INFO: You already own this event NFT');
        return;
      }

      // イベントの有効性チェック
      if (!event.active) {
        setMessage('ERROR: This event is not currently active');
        return;
      }

      setMinting(true);
      setMessage('PROCESSING: Preparing mint...');

      // 1) ナンス取得
      setMessage('PROCESSING: Preparing authentication...');
      const nonceResp = await fetch(`${API_BASE_URL}/api/nonce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordId: 'event', address: account.address, scope: 'mint', eventId })
      });
      
      if (!nonceResp.ok) {
        throw new Error(`Authentication error (${nonceResp.status}): ${await nonceResp.text()}`);
      }
      
      const nonceData = await nonceResp.json();
      if (!nonceData?.success) {
        throw new Error(nonceData?.error || 'Failed to generate nonce');
      }

      // 2) 署名メッセージ（厳格な形式）
      setMessage('PROCESSING: Preparing signature...');
      const timestamp = new Date().toISOString();
      
      // 厳格なメッセージ形式（改行・順序を固定）
      const authMessage = `SXT Event Mint\naddress=${account.address}\neventId=${eventId}\nnonce=${nonceData.data.nonce}\ntimestamp=${timestamp}`;
      
      const bytes = new TextEncoder().encode(authMessage);
      
      let sig;
      try {
        sig = await signPersonalMessage({ message: bytes });
      } catch (e: any) {
        throw new Error('Signature was cancelled');
      }

      // 3) ミント実行
      setMessage('EXECUTING: Minting NFT...');
      const mintResp = await fetch(`${API_BASE_URL}/api/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          address: account.address,
          signature: sig.signature,
          bytes: Array.from(bytes),
          publicKey: (sig as any)?.publicKey ?? (account as any)?.publicKey,
          authMessage
        })
      });
      
      if (!mintResp.ok) {
        const errorText = await mintResp.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(`Mint error (${mintResp.status}): ${errorData.error || errorText}`);
      }
      
      const mintData = await mintResp.json();
      if (mintData?.success) {
        const txDigest = mintData?.data?.txDigest || 'N/A';
        const nftObjectIds = mintData?.data?.nftObjectIds || [];
        
        // ミント成功後、既に保持している状態に更新
        setAlreadyMinted(true);
        
        // 成功メッセージをカスタムHTMLで設定（ガラスモーフィズムスタイル）
        if (nftObjectIds.length > 0) {
          const messageDiv = document.createElement('div');
          messageDiv.innerHTML = `
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: 800; margin-bottom: 20px; 
                          background: linear-gradient(135deg, rgba(16, 185, 129, 0.9) 0%, rgba(74, 222, 128, 0.9) 100%);
                          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                          background-clip: text; text-shadow: 0 0 20px rgba(16, 185, 129, 0.5);
                          letter-spacing: 0.5px;">
                SUCCESS: Mint Completed!
              </div>
              <div style="margin-bottom: 12px;">
                <div style="font-size: 13px; color: rgba(255, 255, 255, 0.7); margin-bottom: 12px; 
                            font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                  NFT Object ID:
                </div>
                ${nftObjectIds.map((id: string) => `
                  <a href="https://suivision.xyz/object/${id}" target="_blank" rel="noreferrer" 
                     style="display: block; padding: 14px 16px; 
                            background: rgba(102, 126, 234, 0.15);
                            backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
                            border: 1px solid rgba(102, 126, 234, 0.3);
                            color: rgba(102, 126, 234, 0.95); border-radius: 12px; text-decoration: none; font-family: monospace; 
                            font-size: 12px; margin-bottom: 10px; word-break: break-all; 
                            transition: all 0.3s ease;
                            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(102, 126, 234, 0.1);"
                     onmouseover="this.style.background='rgba(102, 126, 234, 0.25)'; this.style.borderColor='rgba(102, 126, 234, 0.5)'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(102, 126, 234, 0.3), inset 0 1px 0 rgba(102, 126, 234, 0.15)';" 
                     onmouseout="this.style.background='rgba(102, 126, 234, 0.15)'; this.style.borderColor='rgba(102, 126, 234, 0.3)'; this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(102, 126, 234, 0.1)';">
                    ${id}
                  </a>
                `).join('')}
              </div>
            </div>
          `;
          setMessage(messageDiv.innerHTML);
        } else {
          setMessage(`SUCCESS: Mint Completed! Transaction: ${txDigest}`);
        }
      } else {
        throw new Error(mintData?.error || 'Mint failed');
      }
    } catch (e: any) {
      console.error('Mint error:', e);
      setMessage(`ERROR: ${e?.message || 'An error occurred during minting'}`);
    } finally {
      setMinting(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
        {/* Subtle Dark Animated Background */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 20% 50%, rgba(102, 126, 234, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)',
          animation: 'float 20s ease-in-out infinite',
          opacity: 0.6
        }}></div>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `radial-gradient(circle, rgba(102, 126, 234, 0.03) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          opacity: 0.5
        }}></div>
        
        <div style={{
          background: 'rgba(20, 20, 30, 0.7)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          borderRadius: '24px',
          padding: '32px 48px',
          border: '1px solid rgba(102, 126, 234, 0.2)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.7), inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          color: 'rgba(255, 255, 255, 0.9)',
          fontSize: '16px',
          fontWeight: '600',
          letterSpacing: '1px',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            border: '3px solid rgba(102, 126, 234, 0.3)',
            borderTop: '3px solid rgba(102, 126, 234, 0.9)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          Loading...
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes float {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(30px, -30px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
          }
        `}</style>
      </div>
    );
  }

  return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}>
      {/* Subtle Dark Animated Background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 20% 50%, rgba(102, 126, 234, 0.08) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.1) 0%, transparent 50%)',
        animation: 'float 20s ease-in-out infinite',
        opacity: 0.6
      }}></div>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.06) 0%, transparent 50%), radial-gradient(circle at 40% 80%, rgba(168, 85, 247, 0.08) 0%, transparent 50%)',
        animation: 'float 25s ease-in-out infinite reverse',
        opacity: 0.4
      }}></div>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `radial-gradient(circle, rgba(102, 126, 234, 0.03) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
        opacity: 0.5
      }}></div>

      {/* Dark Luxury Card */}
      <div style={{
        background: 'rgba(20, 20, 30, 0.7)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderRadius: '32px',
        padding: window.innerWidth < 640 ? '24px' : '48px',
        width: '100%',
        maxWidth: window.innerWidth < 640 ? '95%' : window.innerWidth < 1024 ? '600px' : '680px',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.7), inset 0 1px 0 0 rgba(255, 255, 255, 0.05), 0 0 80px rgba(102, 126, 234, 0.12)',
        border: '1px solid rgba(102, 126, 234, 0.2)',
        borderTop: '1px solid rgba(102, 126, 234, 0.3)',
        borderLeft: '1px solid rgba(102, 126, 234, 0.25)',
        animation: 'slideUp 0.8s ease-out, floating 6s ease-in-out infinite',
        position: 'relative',
        zIndex: 1
      }}>
        <style>{`
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(40px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          @keyframes floating {
            0%, 100% { 
              transform: translateY(0px);
            }
            50% { 
              transform: translateY(-10px);
            }
          }
          @keyframes float {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(30px, -30px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
          }
          @keyframes pulse {
            0%, 100% { 
              transform: scale(1);
              opacity: 1;
            }
            50% { 
              transform: scale(1.02);
              opacity: 0.8;
            }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes bounce {
            0%, 20%, 53%, 80%, 100% {
              transform: translate3d(0,0,0);
            }
            40%, 43% {
              transform: translate3d(0, -8px, 0);
            }
            70% {
              transform: translate3d(0, -4px, 0);
            }
            90% {
              transform: translate3d(0, -2px, 0);
            }
          }
          @keyframes shimmer {
            0% {
              background-position: -1000px 0;
            }
            100% {
              background-position: 1000px 0;
            }
          }
          @keyframes glow {
            0%, 100% {
              box-shadow: 0 0 20px rgba(147, 51, 234, 0.5), 0 0 40px rgba(147, 51, 234, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1);
            }
            50% {
              box-shadow: 0 0 30px rgba(147, 51, 234, 0.8), 0 0 60px rgba(147, 51, 234, 0.5), inset 0 0 30px rgba(255, 255, 255, 0.15);
            }
          }
          @keyframes rotate3d {
            0% {
              transform: perspective(1000px) rotateY(0deg);
            }
            100% {
              transform: perspective(1000px) rotateY(360deg);
            }
          }
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateX(-20px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }
          .mint-button {
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
          }
          .mint-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
            transition: left 0.5s;
          }
          .mint-button:hover:not(:disabled)::before {
            left: 100%;
          }
          .mint-button:hover:not(:disabled) {
            transform: translateY(-3px) scale(1.02);
            box-shadow: 0 20px 40px rgba(147, 51, 234, 0.4), 0 10px 20px rgba(147, 51, 234, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.3);
          }
          .mint-button:active:not(:disabled) {
            transform: translateY(-1px) scale(0.98);
          }
          .image-container {
            transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            animation: imagePulse 3s ease-in-out infinite;
          }
          .image-container::before {
            content: '';
            position: absolute;
            top: -4px;
            left: -4px;
            right: -4px;
            bottom: -4px;
            background: linear-gradient(45deg, #667eea, #764ba2, #f093fb, #4ade80, #667eea);
            border-radius: 24px;
            z-index: -1;
            opacity: 0.6;
            filter: blur(8px);
            background-size: 400% 400%;
            animation: gradientRotate 6s ease infinite;
          }
          .image-container::after {
            content: '';
            position: absolute;
            top: -8px;
            left: -8px;
            right: -8px;
            bottom: -8px;
            background: linear-gradient(45deg, 
              rgba(102, 126, 234, 0.4), 
              rgba(118, 75, 162, 0.4), 
              rgba(240, 147, 251, 0.4), 
              rgba(74, 222, 128, 0.4), 
              rgba(102, 126, 234, 0.4)
            );
            border-radius: 28px;
            z-index: -2;
            opacity: 0;
            filter: blur(20px);
            background-size: 400% 400%;
            animation: gradientRotate 8s ease infinite reverse;
            transition: opacity 0.6s;
          }
          .image-container:hover::before {
            opacity: 1;
            filter: blur(12px);
          }
          .image-container:hover::after {
            opacity: 0.8;
          }
          .image-container:hover {
            transform: perspective(1200px) rotateY(8deg) rotateX(8deg) scale(1.05);
            filter: brightness(1.1);
          }
          @keyframes gradientRotate {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes imagePulse {
            0%, 100% {
              box-shadow: 
                0 0 30px rgba(102, 126, 234, 0.4),
                0 0 60px rgba(118, 75, 162, 0.3),
                0 0 90px rgba(240, 147, 251, 0.2),
                inset 0 0 20px rgba(255, 255, 255, 0.1);
            }
            50% {
              box-shadow: 
                0 0 50px rgba(102, 126, 234, 0.6),
                0 0 100px rgba(118, 75, 162, 0.5),
                0 0 150px rgba(240, 147, 251, 0.4),
                inset 0 0 30px rgba(255, 255, 255, 0.2);
            }
          }
          .success-message {
            animation: bounce 1s ease-in-out, slideIn 0.5s ease-out;
          }
          .glass-card {
            background: rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: all 0.3s ease;
          }
          .glass-card:hover {
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(255, 255, 255, 0.3);
          }
          
          /* Responsive adjustments */
          @media (max-width: 640px) {
            .image-container {
              margin-bottom: 32px;
            }
            .image-container:hover {
              transform: scale(1.02);
              filter: brightness(1.05);
            }
            .mint-button:hover:not(:disabled) {
              transform: translateY(-2px) scale(1.01);
            }
            .image-container::after {
              opacity: 0.5;
            }
          }
          @media (min-width: 641px) {
            .image-container {
              margin-bottom: 48px;
            }
          }
        `}</style>

        {/* Epic Event Image Showcase */}
        {(() => {
          // Walrus.pdf準拠の画像URL生成
          const imageUrl = getImageDisplayUrl(event?.imageCid, event?.imageUrl);
          
          return imageUrl ? (
            <div className="image-container" style={{
              marginBottom: '40px',
              borderRadius: '24px',
              overflow: 'visible',
              position: 'relative',
              aspectRatio: '1',
              padding: '6px',
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.15))',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)'
            }}>
              {/* Floating particles effect */}
              <div style={{
                position: 'absolute',
                top: '-50%',
                left: '-50%',
                right: '-50%',
                bottom: '-50%',
                background: `radial-gradient(circle at 20% 30%, rgba(102, 126, 234, 0.15) 0%, transparent 50%),
                             radial-gradient(circle at 80% 70%, rgba(240, 147, 251, 0.15) 0%, transparent 50%),
                             radial-gradient(circle at 50% 50%, rgba(74, 222, 128, 0.1) 0%, transparent 60%)`,
                animation: 'float 8s ease-in-out infinite',
                pointerEvents: 'none',
                zIndex: 0
              }}></div>
              
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '20px',
                overflow: 'hidden',
                position: 'relative',
                zIndex: 1,
                background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.05))',
                boxShadow: 'inset 0 2px 8px rgba(255, 255, 255, 0.1)'
              }}>
                <img 
                  src={imageUrl} 
                  alt={event?.name || 'Event NFT'} 
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    transform: 'scale(1.02)',
                    transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    img.style.transform = 'scale(1)';
                  }}
                  onError={(e) => {
                    console.log('Walrus portal image load error, showing placeholder...');
                    const img = e.target as HTMLImageElement;
                    
                    img.style.display = 'none';
                    const parent = img.parentElement;
                    if (parent) {
                      parent.innerHTML = `
                        <div style="
                          width: 100%;
                          height: 100%;
                          background: linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%);
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          color: white;
                          font-size: 24px;
                          font-weight: 800;
                          text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                          letter-spacing: 1px;
                        ">
                          ${event?.name || 'EVENT NFT'}
                        </div>
                      `;
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            // 画像がない場合のプレースホルダー
            <div className="image-container" style={{
              marginBottom: '40px',
              borderRadius: '24px',
              overflow: 'visible',
              position: 'relative',
              aspectRatio: '1',
              padding: '6px',
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.15))',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)'
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                borderRadius: '20px',
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.9) 0%, rgba(118, 75, 162, 0.9) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '24px',
                fontWeight: '800',
                textShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                letterSpacing: '1px'
              }}>
                {event?.name || 'EVENT NFT'}
              </div>
            </div>
          );
        })()}

        {/* Event Title with Glass Effect */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{
            margin: '0 0 12px 0',
            fontSize: window.innerWidth < 640 ? '28px' : '36px',
            fontWeight: '800',
            background: 'linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.8) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            textShadow: '0 2px 20px rgba(255, 255, 255, 0.5)',
            letterSpacing: '-0.5px',
            animation: 'slideIn 0.6s ease-out'
          }}>
            {event?.name || 'Event Mint'}
          </h1>
          {event?.description && (
            <p style={{
              margin: '0',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: window.innerWidth < 640 ? '14px' : '16px',
              lineHeight: '1.6',
              textShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
              animation: 'slideIn 0.8s ease-out',
              padding: '0 16px'
            }}>
              {event.description}
            </p>
          )}
        </div>

        {/* Dark Countdown Timer */}
        {countdown && (
          <div style={{
            marginBottom: '32px',
            background: 'rgba(15, 15, 25, 0.6)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: '24px',
            border: '1px solid rgba(102, 126, 234, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(102, 126, 234, 0.1)',
            animation: 'slideIn 1s ease-out'
          }}>
            <div style={{
              fontSize: '13px',
              fontWeight: '800',
              textTransform: 'uppercase',
              letterSpacing: '2.5px',
              marginBottom: '20px',
              textAlign: 'center',
              color: countdown.status === 'not-started' 
                ? '#fbbf24'
                : countdown.status === 'active'
                ? '#10b981'
                : '#ef4444',
              textShadow: countdown.status === 'not-started'
                ? '0 0 15px rgba(251, 191, 36, 0.8)'
                : countdown.status === 'active'
                ? '0 0 15px rgba(16, 185, 129, 0.8)'
                : '0 0 15px rgba(239, 68, 68, 0.8)'
            }}>
              {countdown.status === 'not-started' 
                ? 'STARTS IN' 
                : countdown.status === 'active'
                ? 'ENDS IN'
                : 'EVENT ENDED'}
            </div>
            {countdown.status !== 'ended' && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: window.innerWidth < 640 ? '8px' : '16px'
              }}>
                {[
                  { value: countdown.days, label: 'DAYS' },
                  { value: countdown.hours, label: 'HOURS' },
                  { value: countdown.minutes, label: 'MINS' },
                  { value: countdown.seconds, label: 'SECS' }
                ].map((item, index) => (
                  <div key={index} style={{
                    textAlign: 'center',
                    background: 'rgba(10, 10, 20, 0.5)',
                    borderRadius: '12px',
                    padding: window.innerWidth < 640 ? '12px 8px' : '16px 12px',
                    border: '1px solid rgba(102, 126, 234, 0.15)',
                    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)'
                  }}>
                    <div style={{
                      fontSize: window.innerWidth < 640 ? '28px' : '36px',
                      fontWeight: '900',
                      fontFamily: 'monospace',
                      background: 'linear-gradient(135deg, #ffffff 0%, rgba(255, 255, 255, 0.7) 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      textShadow: '0 0 30px rgba(255, 255, 255, 0.5)',
                      lineHeight: '1',
                      marginBottom: '8px',
                      animation: item.label === 'SECS' ? 'pulse 1s infinite' : 'none'
                    }}>
                      {String(item.value).padStart(2, '0')}
                    </div>
                    <div style={{
                      fontSize: window.innerWidth < 640 ? '9px' : '11px',
                      fontWeight: '700',
                      color: 'rgba(255, 255, 255, 0.6)',
                      letterSpacing: '1.5px'
                    }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Already Minted Notice */}
        {connected && checkingOwnership && (
          <div style={{
            marginBottom: '24px',
            padding: '16px 24px',
            background: 'rgba(59, 130, 246, 0.08)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            borderRadius: '20px',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(59, 130, 246, 0.08)',
            textAlign: 'center',
            animation: 'pulse 2s infinite',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid rgba(59, 130, 246, 0.3)',
              borderTop: '2px solid rgba(59, 130, 246, 0.9)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <div style={{
              fontSize: '13px',
              color: 'rgba(59, 130, 246, 0.9)',
              fontWeight: '600',
              letterSpacing: '0.5px'
            }}>
              Checking ownership...
            </div>
          </div>
        )}
        {connected && alreadyMinted && !checkingOwnership && (
          <div style={{
            marginBottom: '24px',
            padding: '24px 28px',
            background: 'rgba(16, 185, 129, 0.1)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            borderRadius: '20px',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(16, 185, 129, 0.1)',
            textAlign: 'center',
            animation: 'slideIn 0.6s ease-out'
          }}>
            <div style={{
              fontSize: window.innerWidth < 640 ? '20px' : '24px',
              fontWeight: '800',
              color: 'rgba(16, 185, 129, 0.95)',
              marginBottom: '10px',
              textShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
              letterSpacing: '1px'
            }}>
              Already Owned
            </div>
            <div style={{
              fontSize: window.innerWidth < 640 ? '13px' : '14px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontWeight: '500',
              letterSpacing: '0.5px'
            }}>
              このイベントのNFTは既にお持ちです
            </div>
          </div>
        )}

        {/* Main Action Section */}
        <div style={{ marginBottom: '24px' }}>
          {connected ? (
            // Mint Button - Only show when connected
            <button
              className="mint-button"
              onClick={handleMint}
              disabled={!event?.active || minting || alreadyMinted}
              style={{
                width: '100%',
                padding: window.innerWidth < 640 ? '22px 32px' : '26px 44px',
                background: (!event?.active || minting || alreadyMinted) 
                  ? 'rgba(60, 60, 80, 0.4)'
                  : 'linear-gradient(135deg, rgba(102, 126, 234, 0.3) 0%, rgba(118, 75, 162, 0.3) 100%)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                color: (!event?.active || minting || alreadyMinted) ? 'rgba(255, 255, 255, 0.4)' : '#ffffff',
                border: (!event?.active || minting || alreadyMinted)
                  ? '1px solid rgba(102, 126, 234, 0.15)'
                  : '1px solid rgba(102, 126, 234, 0.5)',
                borderRadius: '16px',
                cursor: (!event?.active || minting || alreadyMinted) ? 'not-allowed' : 'pointer',
                fontWeight: '700',
                fontSize: window.innerWidth < 640 ? '20px' : '24px',
                boxShadow: (!event?.active || minting || alreadyMinted)
                  ? 'inset 0 2px 4px rgba(0, 0, 0, 0.3)'
                  : '0 8px 32px rgba(102, 126, 234, 0.25), 0 0 60px rgba(102, 126, 234, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.6)',
                letterSpacing: '3px',
                textTransform: 'uppercase'
              }}
            >
              {minting && (
                <div style={{
                  position: 'absolute',
                  left: '28px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '24px',
                  height: '24px',
                  border: '3px solid rgba(255,255,255,0.3)',
                  borderTop: '3px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
              )}
              <span style={{ 
                marginLeft: minting ? '36px' : '0',
                display: 'inline-block'
              }}>
                {minting ? 'Minting...' : alreadyMinted ? 'Already Owned' : 'Mint'}
              </span>
            </button>
          ) : (
            // Wallet Connection - Show when not connected
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              animation: 'slideIn 1s ease-out'
            }}>
              <div style={{
                padding: '20px 28px',
                borderRadius: '20px',
                background: 'rgba(15, 15, 25, 0.5)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(102, 126, 234, 0.2)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(102, 126, 234, 0.1)',
                textAlign: 'center'
              }}>
                <div style={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '12px',
                  marginBottom: '12px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px'
                }}>
                  Connect wallet to mint
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'center'
                }}>
                  <ConnectButton />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dark Status Messages */}
        {!event?.active && event && (
          <div style={{
            background: 'rgba(251, 191, 36, 0.1)',
            backdropFilter: 'blur(15px)',
            WebkitBackdropFilter: 'blur(15px)',
            color: 'rgba(251, 191, 36, 0.9)',
            padding: '14px 20px',
            borderRadius: '16px',
            textAlign: 'center',
            marginBottom: '20px',
            fontSize: '13px',
            fontWeight: '600',
            border: '1px solid rgba(251, 191, 36, 0.2)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(251, 191, 36, 0.1)',
            animation: 'slideIn 0.5s ease-out'
          }}>
            WARNING: This event is not currently active
          </div>
        )}

        {message && (
          <div 
            className={message.includes('SUCCESS') ? 'success-message' : ''}
            style={{
              background: message.includes('SUCCESS') 
                ? 'rgba(16, 185, 129, 0.1)'
                : message.includes('ERROR') 
                ? 'rgba(239, 68, 68, 0.1)'
                : message.includes('INFO')
                ? 'rgba(59, 130, 246, 0.1)'
                : message.includes('PROCESSING') || message.includes('EXECUTING')
                ? 'rgba(59, 130, 246, 0.1)'
                : 'rgba(100, 100, 120, 0.2)',
              backdropFilter: 'blur(15px)',
              WebkitBackdropFilter: 'blur(15px)',
              color: message.includes('SUCCESS') 
                ? 'rgba(16, 185, 129, 0.9)' 
                : message.includes('ERROR') 
                ? 'rgba(239, 68, 68, 0.9)'
                : message.includes('INFO')
                ? 'rgba(59, 130, 246, 0.9)'
                : message.includes('PROCESSING') || message.includes('EXECUTING')
                ? 'rgba(59, 130, 246, 0.9)'
                : 'rgba(255, 255, 255, 0.8)',
              padding: '14px 20px',
              borderRadius: '16px',
              textAlign: 'center',
              marginBottom: '20px',
              fontSize: '13px',
              fontWeight: '600',
              border: message.includes('SUCCESS') 
                ? '1px solid rgba(16, 185, 129, 0.2)'
                : message.includes('ERROR') 
                ? '1px solid rgba(239, 68, 68, 0.2)'
                : message.includes('INFO')
                ? '1px solid rgba(59, 130, 246, 0.2)'
                : message.includes('PROCESSING') || message.includes('EXECUTING')
                ? '1px solid rgba(59, 130, 246, 0.2)'
                : '1px solid rgba(100, 100, 120, 0.2)',
              boxShadow: message.includes('SUCCESS')
                ? '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(16, 185, 129, 0.1)'
                : message.includes('ERROR')
                ? '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(239, 68, 68, 0.1)'
                : message.includes('INFO') || message.includes('PROCESSING') || message.includes('EXECUTING')
                ? '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(59, 130, 246, 0.1)'
                : '0 4px 16px rgba(0, 0, 0, 0.4)',
              animation: (message.includes('PROCESSING') || message.includes('EXECUTING')) ? 'pulse 2s infinite' : 'slideIn 0.5s ease-out'
            }}
            dangerouslySetInnerHTML={{ __html: message }}
          />
        )}

        {/* Subtle Info */}
        <div style={{
          textAlign: 'center',
          padding: '12px',
          animation: 'slideIn 1.2s ease-out'
        }}>
          <div style={{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.4)',
            fontWeight: '500',
            letterSpacing: '1.5px',
            textTransform: 'uppercase'
          }}>
            Gas Sponsored
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '40px',
          paddingTop: '24px',
          borderTop: '1px solid rgba(102, 126, 234, 0.1)',
          textAlign: 'center',
          animation: 'slideIn 1.4s ease-out'
        }}>
          <div style={{
            fontSize: '11px',
            color: 'rgba(255, 255, 255, 0.3)',
            fontWeight: '500',
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}>
            Supported by
          </div>
          <div style={{
            fontSize: '14px',
            color: 'rgba(102, 126, 234, 0.8)',
            fontWeight: '700',
            letterSpacing: '1.5px',
            marginTop: '8px',
            textShadow: '0 0 20px rgba(102, 126, 234, 0.3)'
          }}>
            SyndicateXTokyo
          </div>
        </div>
      </div>
    </div>
  );
}


