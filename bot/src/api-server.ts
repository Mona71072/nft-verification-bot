import express from 'express';
import { config } from './config';
import { grantRoleToUser, revokeRoleFromUser } from './index';
import { Role } from 'discord.js';

// Expressアプリケーションの型を拡張
interface CustomExpressApp extends express.Application {
  setDiscordClient?: (client: any) => void;
}

const app = express() as CustomExpressApp;
const PORT = config.PORT;

app.use(express.json());

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'nft-verification-bot',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

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
    const { discord_id, action } = req.body;

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
      case 'revoke_role':
        result = await revokeRoleFromUser(discord_id);
        console.log(`✅ Role revoke result: ${result}`);
        break;
      default:
        console.error('❌ Invalid action:', action);
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Must be grant_role or revoke_role'
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