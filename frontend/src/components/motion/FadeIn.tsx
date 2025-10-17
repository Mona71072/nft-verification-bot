import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
}

/**
 * フェードイン + 方向アニメーション（軽量化版）
 */
export function FadeIn({ 
  children, 
  delay = 0, 
  duration = 0.3, // 短縮
  className,
  direction = 'up'
}: FadeInProps) {
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    // 初回マウント時は軽量アニメーション
    const timer = setTimeout(() => setShouldAnimate(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const directionOffset = {
    up: { y: 10 }, // 移動距離を短縮
    down: { y: -10 },
    left: { x: 10 },
    right: { x: -10 },
    none: {}
  };

  // 初回マウント時は軽量アニメーション
  if (!shouldAnimate) {
    return <div className={cn(className)}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ 
        opacity: 0,
        ...directionOffset[direction]
      }}
      animate={{ 
        opacity: 1,
        y: 0,
        x: 0
      }}
      transition={{ 
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * スタッガー（段階的）アニメーション（軽量化版）
 */
export function StaggerChildren({ 
  children,
  staggerDelay = 0.05, // 短縮
  className
}: {
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
}) {
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShouldAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!shouldAnimate) {
    return <div className={cn(className)}>{children}</div>;
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay
          }
        }
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * スタッガー用の子要素（軽量化版）
 */
export function StaggerItem({ 
  children,
  className 
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 }, // 移動距離を短縮
        visible: { 
          opacity: 1, 
          y: 0,
          transition: {
            duration: 0.2, // 短縮
            ease: [0.25, 0.1, 0.25, 1]
          }
        }
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

