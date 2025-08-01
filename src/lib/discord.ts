/**
 * Discord REST API経由でユーザーに役割を付与
 * @param discordId DiscordユーザーID
 * @param roleId 付与する役割ID
 * @param token Discordボットトークン
 * @param guildId DiscordサーバーID
 * @returns 役割付与が成功したかどうか
 */
export async function giveRole(
  discordId: string,
  roleId: string,
  token: string,
  guildId?: string
): Promise<boolean> {
  try {
    // TODO: guildIdが渡されない場合の処理を実装
    if (!guildId) {
      console.error('Guild ID is required for role assignment');
      return false;
    }

    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${roleId}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json',
        'X-Audit-Log-Reason': 'NFT Verification - Automated role assignment'
      }
    });

    if (response.status === 204) {
      console.log(`Successfully granted role ${roleId} to user ${discordId}`);
      return true;
    } else if (response.status === 404) {
      console.error(`User ${discordId} not found in guild or role ${roleId} not found`);
      return false;
    } else {
      const errorText = await response.text();
      console.error(`Failed to grant role: ${response.status} - ${errorText}`);
      return false;
    }

  } catch (error) {
    console.error('Error granting Discord role:', error);
    return false;
  }
}

/**
 * ユーザーから役割を削除
 * @param discordId DiscordユーザーID
 * @param roleId 削除する役割ID
 * @param token Discordボットトークン
 * @param guildId DiscordサーバーID
 * @returns 役割削除が成功したかどうか
 */
export async function removeRole(
  discordId: string,
  roleId: string,
  token: string,
  guildId: string
): Promise<boolean> {
  try {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}/roles/${roleId}`;
    
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bot ${token}`,
        'X-Audit-Log-Reason': 'NFT Verification - Automated role removal'
      }
    });

    if (response.status === 204) {
      console.log(`Successfully removed role ${roleId} from user ${discordId}`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`Failed to remove role: ${response.status} - ${errorText}`);
      return false;
    }

  } catch (error) {
    console.error('Error removing Discord role:', error);
    return false;
  }
}

/**
 * ユーザーの現在の役割を取得
 * @param discordId DiscordユーザーID
 * @param guildId DiscordサーバーID
 * @param token Discordボットトークン
 * @returns ユーザーの役割ID配列
 */
export async function getUserRoles(
  discordId: string,
  guildId: string,
  token: string
): Promise<string[]> {
  try {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bot ${token}`
      }
    });

    if (response.ok) {
      const member = await response.json() as any;
      return member.roles || [];
    } else {
      console.error(`Failed to get user roles: ${response.status}`);
      return [];
    }

  } catch (error) {
    console.error('Error getting user roles:', error);
    return [];
  }
}

/**
 * ユーザーが特定の役割を持っているかチェック
 * @param discordId DiscordユーザーID
 * @param roleId チェックする役割ID
 * @param guildId DiscordサーバーID
 * @param token Discordボットトークン
 * @returns 役割を持っているかどうか
 */
export async function hasRole(
  discordId: string,
  roleId: string,
  guildId: string,
  token: string
): Promise<boolean> {
  const roles = await getUserRoles(discordId, guildId, token);
  return roles.includes(roleId);
}

// TODO: Cron Jobs用の関数 - NFTを手放したユーザーから役割を削除
export async function revokeRolesForNonHolders(): Promise<void> {
  // TODO: 実装予定
  // 1. KVから検証済みユーザーリストを取得
  // 2. 各ユーザーのNFT保有状況を再確認
  // 3. NFTを持たないユーザーから役割を削除
  console.log('TODO: Implement role revocation for non-NFT holders');
} 