import { useState, useEffect } from 'react';

// URLパラメータ管理のカスタムフック
export const useUrlParams = () => {
  const [discordIdFromUrl, setDiscordIdFromUrl] = useState<string>('');
  const [paramUsed, setParamUsed] = useState<string | null>(null);

  useEffect(() => {
    try {
      
      const urlParams = new URLSearchParams(window.location.search);
      
      // 複数の可能なパラメータ名を試す（user_idを優先）
      const possibleParams = ['user_id', 'discord_id', 'userId', 'discordId', 'id'];
      let foundDiscordId: string | null = null;
      let foundParam: string | null = null;
      
      for (const param of possibleParams) {
        const value = urlParams.get(param);
        if (value) {
          foundDiscordId = value;
          foundParam = param;
          break;
        }
      }
      
      
      if (foundDiscordId) {
        setDiscordIdFromUrl(foundDiscordId);
        setParamUsed(foundParam);
      } else {
      }
    } catch (error: unknown) {
    }
  }, []);

  return { discordIdFromUrl, paramUsed };
};

