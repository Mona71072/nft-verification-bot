import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ScaleInProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  whileHover?: boolean;
  whileTap?: boolean;
}

/**
 * スケールインアニメーション
 * カード、ボタンなどに使用
 */
export function ScaleIn({ 
  children, 
  delay = 0,
  className,
  whileHover = false,
  whileTap = false
}: ScaleInProps) {
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ 
        duration: 0.3,
        delay,
        ease: [0.25, 0.1, 0.25, 1]
      }}
      whileHover={whileHover ? { 
        scale: 1.02,
        transition: { duration: 0.2 }
      } : undefined}
      whileTap={whileTap ? { 
        scale: 0.98,
        transition: { duration: 0.1 }
      } : undefined}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * ホバー時のフロートエフェクト
 */
export function FloatOnHover({ 
  children,
  className 
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ 
        y: -4,
        transition: { 
          duration: 0.2,
          ease: "easeOut"
        }
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * クリック時のプレスエフェクト
 */
export function PressEffect({ 
  children,
  className,
  onPress
}: {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
}) {
  return (
    <motion.div
      whileTap={{ 
        scale: 0.96,
        transition: { duration: 0.1 }
      }}
      onClick={onPress}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * カード用の洗練されたホバーエフェクト
 */
export function CardHover({ 
  children,
  disabled = false
}: {
  children: React.ReactNode;
  disabled?: boolean;
}) {
  if (disabled) {
    return <>{children}</>;
  }

  return (
    <motion.div
      whileHover={{ 
        y: -6,
        scale: 1.02,
        transition: { 
          duration: 0.25,
          ease: [0.4, 0.0, 0.2, 1]
        }
      }}
      whileTap={{ 
        scale: 0.98,
        transition: { duration: 0.1 }
      }}
    >
      {children}
    </motion.div>
  );
}

