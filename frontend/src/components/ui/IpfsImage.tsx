import React, { useEffect, useMemo, useState } from 'react';
import { getIpfsGatewayUrls } from '../../utils/ipfs';

interface IpfsImageProps {
  url: string | undefined;
  alt: string;
  style?: React.CSSProperties;
  className?: string;
  /** 全ゲートウェイ失敗時に表示するフォールバック（省略時は非表示） */
  fallback?: React.ReactNode;
  /** フォールバックとして文字のみ渡す場合（グラデーション＋1文字を表示） */
  fallbackLetter?: string;
}

/**
 * IPFS画像 - 複数ゲートウェイを順に試行し、失敗時はプレースホルダーを表示
 */
export function IpfsImage({
  url,
  alt,
  style,
  className,
  fallback,
  fallbackLetter,
}: IpfsImageProps) {
  const urls = useMemo(() => getIpfsGatewayUrls(url), [url]);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolvedUrl(null);
    setShowFallback(false);

    if (!url || urls.length === 0) {
      setShowFallback(true);
      return () => {
        cancelled = true;
      };
    }

    const TIMEOUT_MS = 3500;
    const candidateUrls = urls.slice(0, 5);

    const preload = (src: string): Promise<string> =>
      new Promise((resolve, reject) => {
        const img = new Image();
        let finished = false;

        const cleanup = () => {
          finished = true;
          img.onload = null;
          img.onerror = null;
        };

        const timer = window.setTimeout(() => {
          if (finished) return;
          cleanup();
          reject(new Error('timeout'));
        }, TIMEOUT_MS);

        img.onload = () => {
          if (finished) return;
          window.clearTimeout(timer);
          cleanup();
          resolve(src);
        };

        img.onerror = () => {
          if (finished) return;
          window.clearTimeout(timer);
          cleanup();
          reject(new Error('load_error'));
        };

        img.src = src;
      });

    Promise.any(candidateUrls.map(preload))
      .then((fastestUrl) => {
        if (cancelled) return;
        setResolvedUrl(fastestUrl);
      })
      .catch(() => {
        if (cancelled) return;
        setShowFallback(true);
      });

    return () => {
      cancelled = true;
    };
  }, [url, urls]);

  if (!url || urls.length === 0) {
    return fallback ?? null;
  }

  if (showFallback) {
    if (fallback) return <>{fallback}</>;
    if (fallbackLetter !== undefined) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            fontWeight: 700,
            color: 'white',
            ...style,
          }}
        >
          {fallbackLetter.charAt(0)}
        </div>
      );
    }
    return null;
  }

  if (!resolvedUrl) {
    return null;
  }

  return (
    <img
      src={resolvedUrl}
      alt={alt}
      style={style}
      className={className}
      onError={() => setShowFallback(true)}
    />
  );
}
