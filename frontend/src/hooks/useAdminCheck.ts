import { useState, useEffect } from 'react';

interface AdminCheckResult {
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
}

export function useAdminCheck(apiBaseUrl: string): AdminCheckResult {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        setLoading(true);
        setError(null);

        const addr = (window as any).currentWalletAddress || undefined;
        const fallback = (window as any).lastAdminAddress;
        const target = addr || fallback;

        if (!target) {
          setIsAdmin(false);
          return;
        }

        const response = await fetch(`${apiBaseUrl}/api/admin/check/${target}`);
        const result = await response.json().catch(() => null);
        
        setIsAdmin(Boolean(result?.success && result?.isAdmin));
      } catch (err) {
        setError(err instanceof Error ? err.message : '管理者権限チェックに失敗しました');
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, [apiBaseUrl]);

  return { isAdmin, loading, error };
}
