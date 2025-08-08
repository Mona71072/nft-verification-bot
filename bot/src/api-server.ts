import express from 'express';
import { config } from './config';
import { 
  grantRoleToUser, 
  revokeRoleFromUser, 
  grantMultipleRolesToUser, 
  sendVerificationFailedMessage,
  revokeMultipleRolesFromUser,
  sendBatchProcessNotification
} from './index';
import { Role } from 'discord.js';

// Expressアプリケーションの型を拡張
interface CustomExpressApp extends express.Application {
  setDiscordClient?: (client: any) => void;
}

const app = express() as CustomExpressApp;
const PORT = config.PORT;

app.use(express.json());

// ヘルスチェックエンドポイント
// /health は下部で定義済みのため重複回避

// CORS設定
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  
  next();
});

// Discord アクション処理エンドポイント
app.post('/api/discord-action', async (req, res) => {
  try {
    const { discord_id, action, verification_data } = req.body;

    if (!discord_id || !action) {
      console.error('❌ Missing required fields:', { discord_id, action });
      return res.status(400).json({
        success: false,
        error: 'discord_id and action are required'
      });
    }

    console.log(`🔄 Processing ${action} for Discord ID: ${discord_id}`);

    let result = false;

    switch (action) {
      case 'grant_role':
        result = await grantRoleToUser(discord_id);
        console.log(`✅ Role grant result: ${result}`);
        break;
      case 'grant_roles':
        // 複数ロール付与
        if (verification_data && verification_data.grantedRoles) {
          console.log(`🔄 Granting ${verification_data.grantedRoles.length} roles to user ${discord_id}`);
          result = await grantMultipleRolesToUser(discord_id, verification_data.grantedRoles);
          console.log(`✅ Multiple roles grant result: ${result}`);
        } else {
          console.error('❌ No granted roles data provided');
          result = false;
        }
        break;
      case 'verification_failed':
        // 認証失敗時のDM送信
        result = await sendVerificationFailedMessage(discord_id, verification_data);
        console.log(`✅ Verification failed message result: ${result}`);
        break;
      case 'revoke_role':
        result = await revokeRoleFromUser(discord_id);
        console.log(`✅ Role revoke result: ${result}`);
        break;
      case 'revoke_roles':
        // 複数ロール剥奪（バッチ処理用）
        if (verification_data && verification_data.revokedRoles) {
          console.log(`🔄 Revoking ${verification_data.revokedRoles.length} roles from user ${discord_id}`);
          result = await revokeMultipleRolesFromUser(discord_id, verification_data.revokedRoles);
          console.log(`✅ Multiple roles revoke result: ${result}`);
        } else {
          console.error('❌ No revoked roles data provided');
          result = false;
        }
        break;
      case 'batch_notification':
        // バッチ処理結果通知
        result = await sendBatchProcessNotification(discord_id, verification_data);
        console.log(`✅ Batch notification result: ${result}`);
        break;
      case 'admin_batch_notification':
        // 管理者用バッチ処理通知（実装予定）
        console.log(`⚠️ Admin batch notification not implemented yet`);
        result = false;
        break;
      default:
        console.error('❌ Invalid action:', action);
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Must be grant_role, grant_roles, verification_failed, revoke_role, revoke_roles, batch_notification, or admin_batch_notification'
        });
    }

    res.json({
      success: result,
      action: action,
      discord_id: discord_id
    });

  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// バッチ処理実行エンドポイント
app.post('/api/batch-execute', async (req, res) => {
  try {
    console.log('🔄 Manual batch execution requested via Discord Bot API');
    
    // Cloudflare Workers APIにバッチ処理を委譲
    const workersApiUrl = process.env.WORKERS_API_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';
    
    const response = await fetch(`${workersApiUrl}/api/admin/batch-execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json() as any;
      console.log('✅ Batch execution completed via Workers API');
      
      // 管理者に通知（実装予定）
      if (result.success && result.data) {
        console.log(`⚠️ Admin notification not implemented yet`);
      }
      
      res.json(result);
    } else {
      console.error('❌ Workers API error:', response.status, response.statusText);
      res.status(500).json({
        success: false,
        error: 'Failed to execute batch process'
      });
    }
    
  } catch (error) {
    console.error('❌ Batch execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// バッチ処理設定取得エンドポイント
app.get('/api/batch-config', async (req, res) => {
  try {
    const workersApiUrl = process.env.WORKERS_API_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';
    
    const response = await fetch(`${workersApiUrl}/api/admin/batch-config`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json() as any;
      res.json(result);
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to get batch configuration'
      });
    }
    
  } catch (error) {
    console.error('❌ Batch config error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// バッチ処理統計取得エンドポイント
app.get('/api/batch-stats', async (req, res) => {
  try {
    const workersApiUrl = process.env.WORKERS_API_URL || 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';
    
    const response = await fetch(`${workersApiUrl}/api/admin/batch-stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const result = await response.json() as any;
      res.json(result);
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to get batch statistics'
      });
    }
    
  } catch (error) {
    console.error('❌ Batch stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Discordロール取得エンドポイント
app.get('/api/roles', async (req, res) => {
  try {
    console.log('=== DISCORD ROLES API CALLED ===');
    
    // Discordクライアントが準備できているかチェック
    if (!req.app.locals.discordClient) {
      console.error('❌ Discord client not available');
      return res.status(503).json({
        success: false,
        error: 'Discord client not ready'
      });
    }
    
    const client = req.app.locals.discordClient;
    
    // ギルドを取得
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    if (!guild) {
      console.error('❌ Guild not found');
      return res.status(404).json({
        success: false,
        error: 'Discord guild not found'
      });
    }
    
    // ロール一覧を取得
    const roles = await guild.roles.fetch();
    const roleList = roles.map((role: Role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
      permissions: role.permissions.toArray(),
      mentionable: role.mentionable,
      hoist: role.hoist
    }));
    
    console.log(`✅ Fetched ${roleList.length} Discord roles`);
    
    res.json({
      success: true,
      data: roleList
    });
    
  } catch (error) {
    console.error('❌ Error fetching Discord roles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Discord roles'
    });
  }
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Discord Bot API',
    timestamp: new Date().toISOString()
  });
});

// 認証済みユーザー一覧取得（デバッグ用）
app.get('/api/verified-users', async (req, res) => {
  try {
    // KVストレージから認証済みユーザー一覧を取得（実装予定）
    res.json({
      success: true,
      users: [],
      message: 'KV storage integration pending'
    });
  } catch (error) {
    console.error('Error fetching verified users:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export function startApiServer() {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Discord Bot API server running on http://localhost:${PORT}`);
  });
  
  // Discordクライアントを設定するための関数を追加
  app.setDiscordClient = (client: any) => {
    app.locals.discordClient = client;
    console.log('✅ Discord client attached to API server');
  };
  
  return app;
}

export { app };