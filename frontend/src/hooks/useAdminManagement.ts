import { useState, useCallback } from 'react';

export function useAdminManagement() {
  const [adminAddresses, setAdminAddresses] = useState<string[]>([]);
  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);

  const fetchAdminAddresses = useCallback(async (apiBaseUrl: string) => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/admin/addresses`);
      const data = await res.json();
      if (data.success) {
        setAdminAddresses(data.data || []);
      }
    } catch (error) {
    }
  }, []);

  const addAdminAddress = useCallback(async (address: string, apiBaseUrl: string) => {
    try {
      setAdminLoading(true);
      
      const response = await fetch(`${apiBaseUrl}/api/admin/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAdminAddresses(prev => [...prev, address]);
        setNewAdminAddress('');
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: '管理者アドレスの追加に失敗しました' };
    } finally {
      setAdminLoading(false);
    }
  }, []);

  const removeAdminAddress = useCallback(async (address: string, apiBaseUrl: string) => {
    try {
      setAdminLoading(true);
      
      const response = await fetch(`${apiBaseUrl}/api/admin/addresses/${address}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        setAdminAddresses(prev => prev.filter(addr => addr !== address));
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: '管理者アドレスの削除に失敗しました' };
    } finally {
      setAdminLoading(false);
    }
  }, []);

  return {
    adminAddresses,
    setAdminAddresses,
    newAdminAddress,
    setNewAdminAddress,
    adminLoading,
    setAdminLoading,
    fetchAdminAddresses,
    addAdminAddress,
    removeAdminAddress
  };
}
