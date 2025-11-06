export interface AdminService {
  fetchAdminAddresses: (apiBaseUrl: string) => Promise<string[]>;
  addAdminAddress: (apiBaseUrl: string, address: string) => Promise<void>;
  removeAdminAddress: (apiBaseUrl: string, address: string) => Promise<void>;
}

export function createAdminService(): AdminService {
  const fetchAdminAddresses = async (apiBaseUrl: string): Promise<string[]> => {
    const response = await fetch(`${apiBaseUrl}/api/admin/addresses`);
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || '管理者アドレスの取得に失敗しました');
    }
    
    return data.data || [];
  };

  const addAdminAddress = async (apiBaseUrl: string, address: string): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/api/admin/addresses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address })
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || '管理者アドレスの追加に失敗しました');
    }
  };

  const removeAdminAddress = async (apiBaseUrl: string, address: string): Promise<void> => {
    const response = await fetch(`${apiBaseUrl}/api/admin/addresses/${address}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || '管理者アドレスの削除に失敗しました');
    }
  };

  return {
    fetchAdminAddresses,
    addAdminAddress,
    removeAdminAddress
  };
}
