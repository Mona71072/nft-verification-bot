import { useState, useEffect } from 'react';

// URLパラメータ管理のカスタムフック
export const useUrlParams = () => {
  const [discordIdFromUrl, setDiscordIdFromUrl] = useState<string>('');
  const [paramUsed, setParamUsed] = useState<string | null>(null);

  useEffect(() => {
    try {
      console.log('🔍 Checking URL for Discord ID parameter...');
      console.log('🔍 Current URL:', window.location.href);
      console.log('🔍 Search params:', window.location.search);
      
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
      
      console.log('🔍 All URL params:', Object.fromEntries(urlParams.entries()));
      console.log('🔍 Discord ID from URL:', foundDiscordId);
      console.log('🔍 Parameter used:', foundParam);
      
      if (foundDiscordId) {
        setDiscordIdFromUrl(foundDiscordId);
        setParamUsed(foundParam);
        console.log('✅ Discord ID set from URL:', foundDiscordId, 'via parameter:', foundParam);
      } else {
        console.log('⚠️ No Discord ID parameter found in URL');
        console.log('⚠️ Checked parameters:', possibleParams);
      }
    } catch (error: unknown) {
      console.error('Error parsing URL parameters:', error);
    }
  }, []);

  return { discordIdFromUrl, paramUsed };
};

