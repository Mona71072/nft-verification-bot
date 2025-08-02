import type { Env } from './types';

// Discord Bot API機能
export class DiscordBotAPI {
  private token: string;
  private guildId: string;
  private roleId: string;

  constructor(env?: any) {
    // Cloudflare Workers環境では、環境変数をenvオブジェクトから取得
    if (env) {
      this.token = env.DISCORD_TOKEN;
      this.guildId = env.DISCORD_GUILD_ID;
      this.roleId = env.DISCORD_ROLE_ID;
    } else {
      // 開発環境用
      this.token = process.env.DISCORD_TOKEN || '';
      this.guildId = process.env.DISCORD_GUILD_ID || '';
      this.roleId = process.env.DISCORD_ROLE_ID || '';
    }
  }

  // ロール付与
  async grantRole(discordId: string): Promise<boolean> {
    try {
      console.log(`🔄 Granting role to user ${discordId}`);
      
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
        await this.sendDM(discordId, '🎉 認証が完了しました！**NFTの保有が確認されました！**特別ロール "NFT holder" が付与されました。');
        
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

  // ロール削除
  async revokeRole(discordId: string): Promise<boolean> {
    try {
      console.log(`🔄 Revoking role from user ${discordId}`);
      
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

      const dmChannel = await createDMResponse.json() as { id: string };
      
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
            title: '🎉 NFT Verification Successful!',
            description: '**Congratulations! Your NFT verification has been completed successfully!**🌟 **What you\'ve received:**\n• **Exclusive Discord Role:** NFT Holder\n• **Premium Access:** Special channels and features\n• **Community Status:** Verified NFT holder\n• **Future Benefits:** Early access to upcoming features🎯 **Your Benefits:**\n• Access to exclusive channels\n• Special community recognition\n• Priority support and assistance\n• Early access to new features💎 **Security Confirmation:**\n• Your NFT ownership has been verified on the blockchain\n• All verification was done securely without accessing private keys\n• Your wallet data remains completely private　*Welcome to the exclusive NFT community! Enjoy your new privileges!*',
            color: 0x57F287,
            thumbnail: {
              url: 'https://i.imgur.com/8tBXd6L.png'
            },
            fields: [
              {
                name: '🎁 Role Granted',
                value: 'NFT Holder',
                inline: true
              },
              {
                name: '🆔 Discord ID',
                value: discordId,
                inline: true
              },
              {
                name: '⏰ Verified At',
                value: new Date().toLocaleString(),
                inline: true
              },
              {
                name: '🔒 Security Level',
                value: 'Maximum Protection',
                inline: true
              },
              {
                name: '⚡ Process Speed',
                value: 'Instant Verification',
                inline: true
              },
              {
                name: '🎯 Status',
                value: 'Active & Verified',
                inline: true
              }
            ],
            footer: {
              text: 'Sui NFT Verification • Professional & Secure',
              icon_url: 'https://i.imgur.com/8tBXd6L.png'
            },
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
        const member = await response.json() as { roles: string[] };
        return member.roles.includes(this.roleId);
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error checking role:', error);
      return false;
    }
  }
} 