import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';

interface AccordionProps {
  isOpen: boolean;
  children: ReactNode;
  duration?: number;
}

/**
 * Smooth accordion animation
 */
export function Accordion({ isOpen, children, duration = 0.3 }: AccordionProps) {
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ 
            height: 'auto', 
            opacity: 1,
            transition: {
              height: {
                duration: duration,
                ease: [0.4, 0.0, 0.2, 1] // easeInOut
              },
              opacity: {
                duration: duration * 0.8,
                ease: 'easeOut'
              }
            }
          }}
          exit={{ 
            height: 0, 
            opacity: 0,
            transition: {
              height: {
                duration: duration * 0.7,
                ease: [0.4, 0.0, 1, 1] // easeIn
              },
              opacity: {
                duration: duration * 0.5,
                ease: 'easeIn'
              }
            }
          }}
          style={{ overflow: 'hidden' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Icon with rotation animation (▶ → ▼)
 */
interface RotateIconProps {
  isOpen: boolean;
  icon?: string;
  children?: ReactNode;
  duration?: number;
}

export function RotateIcon({ isOpen, icon, children, duration = 0.2 }: RotateIconProps) {
  return (
    <motion.span
      animate={{ rotate: isOpen ? 90 : 0 }}
      transition={{ duration, ease: 'easeOut' }}
      style={{ display: 'inline-block' }}
    >
      {children || icon || '▶'}
    </motion.span>
  );
}

