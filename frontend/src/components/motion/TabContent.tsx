import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

interface TabContentProps {
  activeKey: string;
  tabKey: string;
  children: ReactNode;
}

/**
 * タブコンテンツのフェードイン/アウトアニメーション
 */
export function TabContent({ activeKey, tabKey, children }: TabContentProps) {
  return (
    <AnimatePresence mode="wait">
      {activeKey === tabKey && (
        <motion.div
          key={tabKey}
          initial={{ opacity: 0, y: 10 }}
          animate={{ 
            opacity: 1, 
            y: 0,
            transition: {
              duration: 0.3,
              ease: [0.4, 0.0, 0.2, 1]
            }
          }}
          exit={{ 
            opacity: 0, 
            y: -10,
            transition: {
              duration: 0.2,
              ease: [0.4, 0.0, 1, 1]
            }
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

