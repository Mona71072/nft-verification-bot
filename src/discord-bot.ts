// 設定（本番環境では環境変数から取得）
// Cloudflare Workers環境では、環境変数はコンストラクタで渡されます

// Discord Bot API機能
export class DiscordBotAPI {
  private token: string;
  private guildId: string;
  private roleId: string;

  constructor(env?: any) {
    // Cloudflare Workers環境では環境変数をenvオブジェクトから取得
    if (env) {
      this.token = env.DISCORD_TOKEN || '';
      this.guildId = env.DISCORD_GUILD_ID || '';
      this.roleId = env.DISCORD_ROLE_ID || '';
    } else {
      // ローカル環境ではデフォルト値を使用
      this.token = '';
      this.guildId = '';
      this.roleId = '';
    }
  }

  // ロール付与
  async grantRole(discordId: string): Promise<boolean> {
    try {
      console.log(`🔄 Granting role to Discord ID: ${discordId}`);
      
      const url = `https://discord.com/api/v10/guilds/${this.guildId}/members/${discordId}/roles/${this.roleId}`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${this.token}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        console.log(`✅ Role granted to user ${discordId}`);
        
        // DM送信
        await this.sendDM(discordId, '🎉 認証完了！\n\nNFTの保有が確認されました！\n特別ロール "NFT holder" が付与されました。');
        
        return true;
      } else {
        console.error(`❌ Failed to grant role: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Error granting role:', error);
      return false;
    }
  }

  // ロール剥奪
  async revokeRole(discordId: string): Promise<boolean> {
    try {
      console.log(`🔄 Revoking role from Discord ID: ${discordId}`);
      
      const url = `https://discord.com/api/v10/guilds/${this.guildId}/members/${discordId}/roles/${this.roleId}`;
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bot ${this.token}`,
          'Content-Type': 'application/json',
        }
      });

      if (response.ok) {
        console.log(`✅ Role revoked from user ${discordId}`);
        return true;
      } else {
        console.error(`❌ Failed to revoke role: ${response.status} ${response.statusText}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Error revoking role:', error);
      return false;
    }
  }

  // DM送信
  async sendDM(discordId: string, message: string): Promise<boolean> {
    try {
      // まずDMチャンネルを作成
      const createDMUrl = `https://discord.com/api/v10/users/@me/channels`;
      const createDMResponse = await fetch(createDMUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipient_id: discordId
        })
      });

      if (!createDMResponse.ok) {
        console.error(`❌ Failed to create DM channel: ${createDMResponse.status}`);
        return false;
      }

      const dmChannel = await createDMResponse.json();
      
      // DMを送信
      const sendDMUrl = `https://discord.com/api/v10/channels/${dmChannel.id}/messages`;
      const sendDMResponse = await fetch(sendDMUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: message,
          embeds: [{
            title: '🎉 認証完了！',
            description: '**NFTの保有が確認されました！**\n\n特別ロール "NFT holder" が付与されました。',
            color: 0x57F287,
            timestamp: new Date().toISOString()
          }]
        })
      });

      if (sendDMResponse.ok) {
        console.log(`✅ DM sent to user ${discordId}`);
        return true;
      } else {
        console.error(`❌ Failed to send DM: ${sendDMResponse.status}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Error sending DM:', error);
      return false;
    }
  }

  // ユーザーのロール確認
  async hasRole(discordId: string): Promise<boolean> {
    try {
      const url = `https://discord.com/api/v10/guilds/${this.guildId}/members/${discordId}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bot ${this.token}`,
        }
      });

      if (response.ok) {
        const member = await response.json();
        return member.roles.includes(this.roleId);
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error checking role:', error);
      return false;
    }
  }
} 