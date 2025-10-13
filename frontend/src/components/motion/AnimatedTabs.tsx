import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
}

interface AnimatedTabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

/**
 * アニメーション付きタブコンポーネント
 * - スライドアニメーション
 * - アクティブインジケーター
 * - スムーズな色変化
 */
export function AnimatedTabs({ tabs, activeTab, onChange, className }: AnimatedTabsProps) {
  const [hoveredTab, setHoveredTab] = React.useState<string | null>(null);
  
  return (
    <div 
      className={cn(
        "relative flex gap-2 p-2 bg-card/80 backdrop-blur-sm rounded-xl border border-border/50 shadow-2",
        "overflow-x-auto scrollbar-hide",
        className
      )}
      style={{
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isHovered = hoveredTab === tab.id;
        
        return (
          <motion.button
            key={tab.id}
            onClick={() => !tab.disabled && onChange(tab.id)}
            disabled={tab.disabled}
            onHoverStart={() => !tab.disabled && setHoveredTab(tab.id)}
            onHoverEnd={() => setHoveredTab(null)}
            className={cn(
              "relative px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap",
              "transition-colors duration-200 min-h-[44px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              tab.disabled && "opacity-50 cursor-not-allowed",
              !tab.disabled && "cursor-pointer"
            )}
            style={{
              color: isActive ? 'white' : tab.disabled ? 'var(--muted-foreground)' : 'var(--foreground)',
            }}
            whileTap={!tab.disabled ? { scale: 0.98 } : undefined}
          >
            {/* Background indicator */}
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-primary rounded-lg"
                style={{ zIndex: -1 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 35
                }}
              />
            )}
            
            {/* Hover effect */}
            {!isActive && isHovered && !tab.disabled && (
              <motion.div
                className="absolute inset-0 bg-muted rounded-lg"
                style={{ zIndex: -1 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            )}
            
            {/* Tab content */}
            <span className="relative z-10 flex items-center gap-2">
              {tab.icon && <span>{tab.icon}</span>}
              {tab.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/**
 * タブコンテンツのアニメーション
 */
export function AnimatedTabContent({ 
  children, 
  value 
}: { 
  children: React.ReactNode; 
  value: string;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={value}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

