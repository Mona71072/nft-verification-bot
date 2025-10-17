import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface ResponsiveState {
  deviceType: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}

const BREAKPOINTS = {
  mobile: 640,
  tablet: 1024,
} as const;

export function useResponsive(): ResponsiveState {
  const [state, setState] = useState<ResponsiveState>(() => {
    // 初期値を設定（SSR対応）
    if (typeof window === 'undefined') {
      return {
        deviceType: 'desktop',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        width: 1024,
        height: 768,
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    
    let deviceType: DeviceType;
    if (width < BREAKPOINTS.mobile) {
      deviceType = 'mobile';
    } else if (width < BREAKPOINTS.tablet) {
      deviceType = 'tablet';
    } else {
      deviceType = 'desktop';
    }

    return {
      deviceType,
      isMobile: deviceType === 'mobile',
      isTablet: deviceType === 'tablet',
      isDesktop: deviceType === 'desktop',
      width,
      height,
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      let deviceType: DeviceType;
      if (width < BREAKPOINTS.mobile) {
        deviceType = 'mobile';
      } else if (width < BREAKPOINTS.tablet) {
        deviceType = 'tablet';
      } else {
        deviceType = 'desktop';
      }

      setState({
        deviceType,
        isMobile: deviceType === 'mobile',
        isTablet: deviceType === 'tablet',
        isDesktop: deviceType === 'desktop',
        width,
        height,
      });
    };

    // リサイズイベントリスナーを追加
    window.addEventListener('resize', handleResize);
    
    // 初期化時に一度実行
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return state;
}

// ユーティリティ関数
export const getResponsiveValue = <T>(
  mobile: T,
  tablet: T,
  desktop: T,
  deviceType: DeviceType
): T => {
  switch (deviceType) {
    case 'mobile':
      return mobile;
    case 'tablet':
      return tablet;
    case 'desktop':
      return desktop;
    default:
      return desktop;
  }
};

// メディアクエリヘルパー
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    const handleChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    
    mediaQuery.addEventListener('change', handleChange);
    setMatches(mediaQuery.matches);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
};
