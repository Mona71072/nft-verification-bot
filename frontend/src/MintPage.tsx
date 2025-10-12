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
        setMessage('❌ Event information could not be retrieved');
        return;
      }
      if (!connected || !account?.address || !signPersonalMessage) {
        setMessage('❌ Please connect your wallet');
        return;
      }

      // イベントの有効性チェック
      if (!event.active) {
        setMessage('❌ This event is not currently active');
        return;
      }

      setMinting(true);
      setMessage('🔄 Preparing mint...');

      // 1) ナンス取得
      setMessage('🔄 Preparing authentication...');
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
      setMessage('🔄 Preparing signature...');
      const timestamp = new Date().toISOString();
      
      // 厳格なメッセージ形式（改行・順序を固定）
      const authMessage = `SXT Event Mint\naddress=${account.address}\neventId=${eventId}\nnonce=${nonceData.data.nonce}\ntimestamp=${timestamp}`;
      
      console.log('🔍 Auth message (exact):', JSON.stringify(authMessage));
      console.log('🔍 Auth message length:', authMessage.length);
      console.log('🔍 Auth message bytes:', Array.from(authMessage));
      
      const bytes = new TextEncoder().encode(authMessage);
      console.log('🔍 Encoded bytes:', Array.from(bytes));
      
      let sig;
      try {
        sig = await signPersonalMessage({ message: bytes });
        console.log('Signature result:', {
          signature: sig.signature,
          bytes: sig.bytes,
          publicKey: (sig as any)?.publicKey ?? (account as any)?.publicKey
        });
      } catch (e: any) {
        throw new Error('Signature was cancelled');
      }

      // 3) ミント実行
      setMessage('🚀 Minting NFT...');
      const mintResp = await fetch(`${API_BASE_URL}/api/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          address: account.address,
          signature: sig.signature,
          bytes: Array.from(bytes), // Uint8Arrayを配列に変換
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
        
        // 成功メッセージをカスタムHTMLで設定
        if (nftObjectIds.length > 0) {
          const messageDiv = document.createElement('div');
          messageDiv.innerHTML = `
            <div style="text-align: center;">
              <div style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">🎉 Mint Successful!</div>
              <div style="margin-bottom: 12px;">
                <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">NFT Object ID:</div>
                ${nftObjectIds.map((id: string) => `
                  <a href="https://suivision.xyz/object/${id}" target="_blank" rel="noreferrer" 
                     style="display: block; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                            color: white; border-radius: 8px; text-decoration: none; font-family: monospace; 
                            font-size: 13px; margin-bottom: 8px; word-break: break-all; transition: opacity 0.2s;"
                     onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
                    ${id}
                  </a>
                `).join('')}
              </div>
            </div>
          `;
          setMessage(messageDiv.innerHTML);
        } else {
          setMessage(`🎉 Mint Successful! Transaction: ${txDigest}`);
        }
      } else {
        throw new Error(mintData?.error || 'Mint failed');
      }
    } catch (e: any) {
      console.error('Mint error:', e);
      setMessage(`❌ ${e?.message || 'An error occurred during minting'}`);
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
          Loading...
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
          .success-message {
            animation: bounce 1s ease-in-out;
          }
        `}</style>

        {/* Event Image */}
        {(() => {
          // Walrus.pdf準拠の画像URL生成
          const imageUrl = getImageDisplayUrl(event?.imageCid, event?.imageUrl);
          
          return imageUrl ? (
            <div className="image-container" style={{
              marginBottom: '24px',
              borderRadius: '16px',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              aspectRatio: '1'
            }}>
              <img 
                src={imageUrl} 
                alt={event?.name || 'Event NFT'} 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block'
                }}
                onError={(e) => {
                  console.log('Walrus portal image load error, showing placeholder...');
                  const img = e.target as HTMLImageElement;
                  
                  // 画像読み込み失敗時はプレースホルダーを表示
                  img.style.display = 'none';
                  const parent = img.parentElement;
                  if (parent) {
                    parent.innerHTML = `
                      <div style="
                        width: 100%;
                        height: 100%;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-size: 18px;
                        font-weight: 600;
                      ">
                        🖼️ ${event?.name || 'Event NFT'}
                      </div>
                    `;
                  }
                }}
              />
            </div>
          ) : (
            // 画像がない場合のプレースホルダー
            <div style={{
              marginBottom: '24px',
              borderRadius: '16px',
              overflow: 'hidden',
              position: 'relative',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
              aspectRatio: '1'
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '18px',
                fontWeight: '600'
              }}>
                🎨 {event?.name || 'Event NFT'}
              </div>
            </div>
          );
        })()}

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
            {minting ? 'Minting...' : connected ? '🎁 Mint for Free' : 'Connect Wallet'}
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
            fontWeight: '600',
            border: '1px solid #f59e0b'
          }}>
            ⏰ This event is not currently active
          </div>
        )}

        {message && (
          <div 
            className={message.includes('🎉') || message.includes('Successful') ? 'success-message' : ''}
            style={{
              background: message.includes('🎉') || message.includes('Successful') 
                ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                : message.includes('❌') 
                ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
                : message.includes('🔄') || message.includes('🚀')
                ? 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)'
                : 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
              color: message.includes('🎉') || message.includes('Successful') 
                ? '#065f46' 
                : message.includes('❌') 
                ? '#991b1b'
                : message.includes('🔄') || message.includes('🚀')
                ? '#1e40af'
                : '#374151',
              padding: '12px 16px',
              borderRadius: '12px',
              textAlign: 'center',
              marginBottom: '16px',
              fontSize: '14px',
              fontWeight: '600',
              border: message.includes('🎉') || message.includes('Successful') 
                ? '1px solid #10b981'
                : message.includes('❌') 
                ? '1px solid #ef4444'
                : message.includes('🔄') || message.includes('🚀')
                ? '1px solid #3b82f6'
                : '1px solid #d1d5db',
              animation: (message.includes('🔄') || message.includes('🚀')) ? 'pulse 2s infinite' : 'none'
            }}
            dangerouslySetInnerHTML={{ __html: message }}
          />
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
            <span>Cost:</span>
            <span style={{ fontWeight: '600', color: '#10b981' }}>FREE (Gas Sponsored)</span>
          </div>
          {event && event.startAt && event.endAt && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Period:</span>
              <span style={{ fontWeight: '600', color: '#374151', fontSize: '12px' }}>
                {new Date(event.startAt).toLocaleDateString('en-US')} - {new Date(event.endAt).toLocaleDateString('en-US')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


