import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ErrorBannerProps {
  title?: string;
  message: string;
  technicalDetails?: {
    status?: number;
    endpoint?: string;
    traceId?: string;
    timestamp?: string;
  };
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * エラーバナーコンポーネント
 * - エラーメッセージ表示
 * - 再試行ボタン
 * - 技術詳細の折り畳み表示
 */
export function ErrorBanner({
  title = 'エラーが発生しました',
  message,
  technicalDetails,
  onRetry,
  onDismiss,
  className,
}: ErrorBannerProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div
      className={cn(
        "rounded-lg border border-danger-500/50 bg-danger-500/10 p-4 shadow-2",
        className
      )}
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        {/* Icon + Content */}
        <div className="flex items-start gap-3 flex-1">
          <div className="text-danger-600 dark:text-danger-400 text-xl shrink-0 mt-0.5">
            ⚠️
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-danger-800 dark:text-danger-300 mb-1">
              {title}
            </h3>
            <p className="text-sm text-danger-700 dark:text-danger-400 mb-3">
              {message}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {onRetry && (
                <Button
                  onClick={onRetry}
                  variant="outline"
                  size="sm"
                  className="border-danger-500/50 text-danger-700 dark:text-danger-300 hover:bg-danger-500/20"
                >
                  🔄 再試行
                </Button>
              )}
              {technicalDetails && (
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-danger-600 dark:text-danger-400 underline hover:no-underline"
                >
                  {showDetails ? '詳細を隠す' : '技術詳細を表示'}
                </button>
              )}
            </div>

            {/* Technical Details */}
            {showDetails && technicalDetails && (
              <div className="mt-3 p-3 rounded bg-surface-950/10 dark:bg-surface-50/5 border border-danger-500/30">
                <div className="text-xs font-mono space-y-1 text-danger-700 dark:text-danger-300">
                  {technicalDetails.status && (
                    <div>
                      <span className="opacity-70">Status:</span> {technicalDetails.status}
                    </div>
                  )}
                  {technicalDetails.endpoint && (
                    <div className="break-all">
                      <span className="opacity-70">Endpoint:</span> {technicalDetails.endpoint}
                    </div>
                  )}
                  {technicalDetails.traceId && (
                    <div className="break-all">
                      <span className="opacity-70">Trace ID:</span> {technicalDetails.traceId}
                    </div>
                  )}
                  {technicalDetails.timestamp && (
                    <div>
                      <span className="opacity-70">Timestamp:</span> {new Date(technicalDetails.timestamp).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-danger-600 dark:text-danger-400 hover:text-danger-700 dark:hover:text-danger-300 shrink-0"
            aria-label="閉じる"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

