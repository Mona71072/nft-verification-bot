import { useRef, useCallback, useEffect } from 'react';

interface RenderOptimizationOptions {
  enableRenderTracking?: boolean;
  enableRenderBlocking?: boolean;
  maxRenderTime?: number;
}

export function useRenderOptimization(options: RenderOptimizationOptions = {}) {
  const {
    enableRenderTracking = true,
    enableRenderBlocking = false,
    maxRenderTime = 16 // 16ms = 60fps
  } = options;

  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(0);
  const renderTimesRef = useRef<number[]>([]);

  // レンダリング時間の測定
  const measureRenderTime = useCallback((componentName: string) => {
    if (!enableRenderTracking) return;

    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      renderCountRef.current++;
      lastRenderTimeRef.current = renderTime;
      renderTimesRef.current.push(renderTime);
      
      // 直近10回の平均を保持
      if (renderTimesRef.current.length > 10) {
        renderTimesRef.current.shift();
      }
      
      if (renderTime > maxRenderTime) {
        console.warn(`Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
      
      if (enableRenderTracking) {
        console.log(`${componentName} render #${renderCountRef.current}: ${renderTime.toFixed(2)}ms`);
      }
    };
  }, [enableRenderTracking, maxRenderTime]);

  // レンダリングブロッキングの検出
  const detectRenderBlocking = useCallback(() => {
    if (!enableRenderBlocking) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure' && entry.name.includes('render')) {
          const duration = entry.duration;
          if (duration > maxRenderTime) {
            console.warn(`Render blocking detected: ${duration.toFixed(2)}ms`);
          }
        }
      }
    });

    observer.observe({ entryTypes: ['measure'] });
    return () => observer.disconnect();
  }, [enableRenderBlocking, maxRenderTime]);

  // レンダリング統計の取得
  const getRenderStats = useCallback(() => {
    const times = renderTimesRef.current;
    const averageRenderTime = times.length > 0 
      ? times.reduce((sum, time) => sum + time, 0) / times.length 
      : 0;

    return {
      totalRenders: renderCountRef.current,
      lastRenderTime: lastRenderTimeRef.current,
      averageRenderTime: Math.round(averageRenderTime * 100) / 100,
      slowRenders: times.filter(time => time > maxRenderTime).length,
      isPerformingWell: averageRenderTime < maxRenderTime
    };
  }, [maxRenderTime]);

  // レンダリング最適化の提案
  const getOptimizationSuggestions = useCallback(() => {
    const stats = getRenderStats();
    const suggestions: string[] = [];

    if (stats.averageRenderTime > maxRenderTime) {
      suggestions.push('Consider using React.memo for expensive components');
      suggestions.push('Use useMemo for expensive calculations');
      suggestions.push('Implement virtual scrolling for large lists');
    }

    if (stats.slowRenders > stats.totalRenders * 0.1) {
      suggestions.push('Consider code splitting for heavy components');
      suggestions.push('Use useCallback to prevent unnecessary re-renders');
    }

    if (stats.totalRenders > 100) {
      suggestions.push('Consider implementing shouldComponentUpdate logic');
      suggestions.push('Review dependency arrays in useEffect hooks');
    }

    return suggestions;
  }, [getRenderStats, maxRenderTime]);

  // 初期化
  useEffect(() => {
    const cleanup = detectRenderBlocking();
    return cleanup;
  }, [detectRenderBlocking]);

  return {
    measureRenderTime,
    getRenderStats,
    getOptimizationSuggestions,
    renderCount: renderCountRef.current
  };
}
