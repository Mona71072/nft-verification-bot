import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * テーマ切替ボタン
 * - ライト/ダーク/システム設定切替
 * - アイコンで現在のテーマを表示
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const getIcon = () => {
    if (theme === 'system') {
      return '🖥️';
    }
    return resolvedTheme === 'dark' ? '🌙' : '☀️';
  };

  const getLabel = () => {
    if (theme === 'system') {
      return `システム設定 (${resolvedTheme === 'dark' ? 'ダーク' : 'ライト'})`;
    }
    return theme === 'dark' ? 'ダークモード' : 'ライトモード';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            aria-label="テーマ切替"
            className="rounded-full"
          >
            <span className="text-lg">{getIcon()}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{getLabel()}</p>
          <p className="text-xs text-muted-foreground mt-1">
            クリックで切替
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

