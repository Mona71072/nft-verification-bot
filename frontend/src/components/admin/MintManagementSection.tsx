import React, { useCallback, useMemo } from 'react';
import { MintTable } from '../MintTable';
import { useMints, type MintRecord } from '../../hooks/useMints';
import { useToast } from '../ui/ToastProvider';
import { useAdminCheck } from '../../hooks/useAdminCheck';
import { createMintRetryService } from '../../services/mintRetryService';
import type { MintQuery } from '../../hooks/useMints';

interface MintManagementSectionProps {
  apiBaseUrl: string;
  query: MintQuery;
  onQueryChange: (query: MintQuery | ((prev: MintQuery) => MintQuery)) => void;
  className?: string;
  style?: React.CSSProperties;
}

export function MintManagementSection({
  apiBaseUrl,
  query,
  onQueryChange,
  className = '',
  style = {}
}: MintManagementSectionProps) {
  const { showToast, showProgress } = useToast();
  const { data, loading, error } = useMints(apiBaseUrl, query);
  const { isAdmin } = useAdminCheck(apiBaseUrl);

  // ミント再試行サービス
  const mintRetryService = useMemo(
    () => createMintRetryService(apiBaseUrl, showToast, showProgress),
    [apiBaseUrl, showToast, showProgress]
  );

  const handleRetry = useCallback(
    async (record: MintRecord) => {
      await mintRetryService.retrySingle(record);
    },
    [mintRetryService]
  );

  const handleRetryBulk = useCallback(
    async (records: MintRecord[]) => {
      await mintRetryService.retryBulk(records);
    },
    [mintRetryService]
  );

  const containerStyle: React.CSSProperties = {
    ...style
  };

  return (
    <div style={containerStyle} className={className}>
      <MintTable
        records={data}
        loading={loading}
        error={error}
        query={query}
        onQueryChange={onQueryChange}
        onRetry={handleRetry}
        onRetryBulk={isAdmin ? handleRetryBulk : undefined}
        isAdmin={isAdmin}
      />
    </div>
  );
}
