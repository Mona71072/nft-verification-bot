import type { DiscordBotAPI as IDiscordBotAPI, DiscordRoleAssignment } from '../types';

/**
 * Discord Bot API クラス
 */
export class DiscordBotAPI implements IDiscordBotAPI {
  private baseUrl: string;
  private token: string;

  constructor(token: string, baseUrl: string) {
    this.token = token;
    this.baseUrl = baseUrl;
  }

  /**
   * Discordロールを付与する
   */
  async grantRole(discordId: string, roleId: string, token: string): Promise<boolean> {
    try {
      console.log('🎭 Granting Discord role:', { discordId, roleId });

      const response = await fetch(`${this.baseUrl}/discord/grant-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          discordId,
          roleId,
        }),
      });

      if (!response.ok) {
        console.error('❌ Failed to grant role:', response.status, response.statusText);
        return false;
      }

      const result = await response.json();
      console.log('✅ Role granted successfully:', result);
      return true;
    } catch (error) {
      console.error('❌ Error granting role:', error);
      return false;
    }
  }

  /**
   * Discordロールを削除する
   */
  async revokeRole(discordId: string, roleId: string, token: string): Promise<boolean> {
    try {
      console.log('🗑️ Revoking Discord role:', { discordId, roleId });

      const response = await fetch(`${this.baseUrl}/discord/revoke-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          discordId,
          roleId,
        }),
      });

      if (!response.ok) {
        console.error('❌ Failed to revoke role:', response.status, response.statusText);
        return false;
      }

      const result = await response.json();
      console.log('✅ Role revoked successfully:', result);
      return true;
    } catch (error) {
      console.error('❌ Error revoking role:', error);
      return false;
    }
  }

  /**
   * Discordユーザー情報を取得する
   */
  async getUserInfo(discordId: string, token: string): Promise<any> {
    try {
      console.log('👤 Getting Discord user info:', discordId);

      const response = await fetch(`${this.baseUrl}/discord/user/${discordId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('❌ Failed to get user info:', response.status, response.statusText);
        return null;
      }

      const userInfo = await response.json();
      console.log('✅ User info retrieved:', userInfo);
      return userInfo;
    } catch (error) {
      console.error('❌ Error getting user info:', error);
      return null;
    }
  }

  /**
   * ロール付与の結果を処理する
   */
  async processRoleAssignment(
    discordId: string,
    address: string,
    roleId: string,
    token: string
  ): Promise<DiscordRoleAssignment> {
    try {
      console.log('🎯 Processing role assignment:', { discordId, address, roleId });

      // ロール付与を実行
      const success = await this.grantRole(discordId, roleId, token);

      if (success) {
        // ユーザー情報を取得してロール名を取得
        const userInfo = await this.getUserInfo(discordId, token);
        const roleName = userInfo?.roles?.find((r: any) => r.id === roleId)?.name || 'NFT Holder';

        return {
          success: true,
          message: 'Role assigned successfully',
          discordId,
          address,
          roleName,
        };
      } else {
        return {
          success: false,
          message: 'Failed to assign role',
          discordId,
          address,
        };
      }
    } catch (error) {
      console.error('❌ Error processing role assignment:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        discordId,
        address,
      };
    }
  }

  /**
   * DM送信
   */
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
}

/**
 * Discord Bot API のファクトリー関数
 */
export function createDiscordBotAPI(token: string, baseUrl: string): IDiscordBotAPI {
  return new DiscordBotAPI(token, baseUrl);
} 