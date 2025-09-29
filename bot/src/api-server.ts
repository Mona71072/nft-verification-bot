import express from 'express';
import { config } from './config';
import { grantRoleToUser, revokeRoleFromUser, sendVerificationFailureMessage } from './index';
import { client } from './index';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import crypto from 'crypto';

const app = express();
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

function getSuiClient() {
  const net = (process.env.SUI_NETWORK || 'mainnet') as 'mainnet' | 'testnet' | 'devnet';
  return new SuiClient({ url: getFullnodeUrl(net) });
}

function getSponsorKeypair() {
  const secret = process.env.SPONSOR_SECRET_KEY || '';
  const mnemonic = process.env.SPONSOR_MNEMONIC || '';
  if (secret) {
    const { secretKey } = decodeSuiPrivateKey(secret);
    return Ed25519Keypair.fromSecretKey(secretKey);
  }
  if (mnemonic) {
    return Ed25519Keypair.deriveKeypair(mnemonic);
  }
  throw new Error('SPONSOR_SECRET_KEY or SPONSOR_MNEMONIC must be set');
}

// Cloudflare Workersからの認証結果通知エンドポイント
app.post('/notify', async (req, res) => {
  try {
    const { discordId, action, verificationData, timestamp } = req.body;
    const notifyUser = verificationData?.notifyUser !== false;
    const custom = verificationData?.custom_message;

    if (!discordId || !action) {
      console.error('Missing required fields:', { discordId, action });
      return res.status(400).json({
        success: false,
        error: 'discordId and action are required'
      });
    }

    let result = false;
    let message = '';

    switch (action) {
      case 'grant_roles':
      case 'grant_role':
        const collectionId = verificationData?.collectionId;
        const roleName = verificationData?.roleName;
        
        result = await grantRoleToUser(discordId, collectionId, roleName);
        message = result ? 'Role granted successfully' : 'Failed to grant role';
        break;
        
      case 'verification_failed':
        if (!notifyUser) {
          result = true;
          message = 'DM skipped by settings';
          break;
        }
        result = await sendVerificationFailureMessage(discordId, verificationData);
        message = result ? 'Failure notification sent' : 'Failed to send failure notification';
        break;
        
      default:
        console.error('Invalid action:', action);
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Must be grant_roles/grant_role or verification_failed'
        });
    }

    const response = {
      success: result,
      action: action,
      discordId: discordId,
      message: message,
      timestamp: timestamp
    };
    
    res.json(response);

  } catch (error) {
    console.error('Notification API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Discord アクション処理エンドポイント
app.post('/api/discord-action', async (req, res) => {
  try {
    const { discord_id, action, verification_data } = req.body;

    if (!discord_id || !action) {
      console.error('Missing required fields:', { discord_id, action });
      return res.status(400).json({
        success: false,
        error: 'discord_id and action are required'
      });
    }

    let result = false;

    switch (action) {
      case 'grant_roles':
      case 'grant_role': {
        const collectionId = verification_data?.collectionId;
        const roleName = verification_data?.roleName;
        const custom = verification_data?.custom_message;
        const notifyUser = verification_data?.notifyUser !== false;
        
        result = await grantRoleToUser(discord_id, collectionId, roleName, custom);
        break;
      }
      case 'verification_failed': {
        const notifyUser = verification_data?.notifyUser !== false;
        if (!notifyUser) {
          result = true;
          break;
        }
        result = await sendVerificationFailureMessage(discord_id, verification_data);
        break;
      }
      case 'revoke_role': {
        const custom = verification_data?.custom_message;
        result = await revokeRoleFromUser(discord_id, custom);
        break;
      }
      default:
        console.error('Invalid action:', action);
        return res.status(400).json({
          success: false,
          error: 'Invalid action. Must be grant_roles/grant_role, verification_failed or revoke_role'
        });
    }

    res.json({
      success: result,
      action: action,
      discord_id: discord_id
    });

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// スポンサー実行: Suiでのミント処理を代理送信
app.post('/api/mint', async (req, res) => {
  try {
    const { eventId, recipient, moveCall, imageUrl, imageCid, imageMimeType } = req.body || {};
    if (!eventId || !recipient || !moveCall?.target) {
      return res.status(400).json({ success: false, error: 'Missing eventId/recipient/moveCall.target' });
    }

    const client = getSuiClient();
    const kp = getSponsorKeypair();
    const tx = new Transaction();

    const args = Array.isArray(moveCall.argumentsTemplate) ? moveCall.argumentsTemplate : [];
    const builtArgs = args.map((a: string) => {
      try {
        if (a === '{recipient}') {
          // アドレス形式の検証
          if (!/^0x[a-fA-F0-9]{64}$/.test(recipient)) {
            throw new Error(`Invalid recipient address format: ${recipient}`);
          }
          return tx.pure.address(recipient);
        }
        if (a === '{imageUrl}') return tx.pure.string(imageUrl || '');
        if (a === '{imageCid}') return tx.pure.string(imageCid || '');
        if (a === '{imageMimeType}') return tx.pure.string(imageMimeType || '');
        return tx.pure.string(String(a));
      } catch (argError) {
        console.error(`Error building argument ${a}:`, argError);
        throw new Error(`Invalid argument template: ${a}`);
      }
    });

    // Move呼び出しターゲットの検証
    if (!/^0x[a-fA-F0-9]+::[a-zA-Z_][a-zA-Z0-9_]*::[a-zA-Z_][a-zA-Z0-9_]*$/.test(moveCall.target)) {
      throw new Error(`Invalid move call target format: ${moveCall.target}`);
    }

    tx.moveCall({
      target: moveCall.target,
      typeArguments: Array.isArray(moveCall.typeArguments) ? moveCall.typeArguments : [],
      arguments: builtArgs
    });

    // ガスバジェットの設定（デフォルト値で安全性確保）
    const gasBudget = moveCall.gasBudget ? Number(moveCall.gasBudget) : 50000000; // 0.05 SUI
    if (gasBudget < 1000000 || gasBudget > 1000000000) { // 0.001 SUI ~ 1 SUI
      throw new Error(`Gas budget out of safe range: ${gasBudget}`);
    }
    tx.setGasBudget(gasBudget);

    const result = await client.signAndExecuteTransaction({ 
      signer: kp, 
      transaction: tx, 
      options: { 
        showEffects: true,
        showEvents: true,
        showObjectChanges: true
      }
    });

    return res.json({ success: true, txDigest: result.digest });
  } catch (e: any) {
    console.error('Sponsor mint failed:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Sponsor mint failed' });
  }
});

// 汎用 Move 呼び出しエンドポイント（管理用途）
app.post('/api/move-call', async (req, res) => {
  try {
    const { target, typeArguments, argumentsTemplate, variables, gasBudget } = req.body || {};
    if (!target) {
      return res.status(400).json({ success: false, error: 'Missing target' });
    }

    const client = getSuiClient();
    const kp = getSponsorKeypair();
    const tx = new Transaction();

    // 引数テンプレート処理
    const argsTpl: string[] = Array.isArray(argumentsTemplate) ? argumentsTemplate : [];
    const vars: Record<string, any> = variables && typeof variables === 'object' ? variables : {};

    const builtArgs = argsTpl.map((a: string) => {
      try {
        // {key} 形式を variables から解決
        const m = /^\{(.+?)\}$/.exec(a);
        if (m) {
          const key = m[1];
          const val = vars[key];
          if (key === 'recipient') {
            if (!val || typeof val !== 'string' || !/^0x[a-fA-F0-9]{64}$/.test(val)) {
              throw new Error(`Invalid recipient address: ${val}`);
            }
            return tx.pure.address(val);
          }
          // それ以外は基本 string として渡す（必要に応じて拡張）
          return tx.pure.string(val == null ? '' : String(val));
        }
        // リテラル
        return tx.pure.string(String(a));
      } catch (e) {
        console.error('move-call arg build error:', e);
        throw e;
      }
    });

    // ターゲット検証
    if (!/^0x[a-fA-F0-9]+::[a-zA-Z_][a-zA-Z0-9_]*::[a-zA-Z_][a-zA-Z0-9_]*$/.test(target)) {
      return res.status(400).json({ success: false, error: `Invalid move call target format: ${target}` });
    }

    tx.moveCall({
      target,
      typeArguments: Array.isArray(typeArguments) ? typeArguments : [],
      arguments: builtArgs
    });

    const safeGas = gasBudget ? Number(gasBudget) : 50000000;
    if (!(safeGas >= 1000000 && safeGas <= 1000000000)) {
      return res.status(400).json({ success: false, error: `Gas budget out of safe range: ${safeGas}` });
    }
    tx.setGasBudget(safeGas);

    const result = await client.signAndExecuteTransaction({
      signer: kp,
      transaction: tx,
      options: { showEffects: true, showEvents: true, showObjectChanges: true }
    });

    return res.json({ success: true, txDigest: result.digest, result });
  } catch (e: any) {
    console.error('Generic move-call failed:', e);
    return res.status(500).json({ success: false, error: e?.message || 'move-call failed' });
  }
});

// ================
// Walrus: SDK版スポンサーアップロード
// ================
app.post('/api/walrus/sponsor-upload', async (req, res) => {
  try {
    const { dataBase64, contentType } = req.body || {};
    if (!dataBase64) return res.status(400).json({ success: false, error: 'dataBase64 is required' });
    
    const buf = Buffer.from(String(dataBase64), 'base64');
    console.log(`Processing upload with Walrus SDK: size=${buf.length} bytes`);

    // 必要なモジュールをimport
    const { WalrusClient } = await import('@mysten/walrus');
    const { Transaction } = await import('@mysten/sui/transactions');
    const crypto = require('crypto');
    
    const client = getSuiClient();
    const signer = getSponsorKeypair();
    
    const walrusClient = new WalrusClient({
      network: 'mainnet',
      suiClient: client,
      uploadRelay: {
        host: process.env.WALRUS_UPLOAD_URL?.replace('/v1/blob-upload-relay', '') || 'https://upload-relay.mainnet.walrus.space',
        sendTip: {
          max: 10_000_000 // 最大10 SUI
        }
      }
    });

    // 公式Walrus SDKを使用（WAL必要）
    console.log('Using official Walrus SDK implementation');
    
    // 公式Walrus SDK実装（リトライ機能付き）
    let result;
    let lastError;
    const maxRetries = 3;
    const baseDelay = 1000; // 1秒
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Walrus upload attempt ${attempt}/${maxRetries}`);
        
        result = await walrusClient.writeBlob({
          blob: new Uint8Array(buf),
          deletable: false,
          epochs: 1,
          signer: signer
        });
        
        console.log('Walrus official SDK upload successful:', result.blobId);
        return res.json({ 
          success: true, 
          data: { 
            blob_id: result.blobId,
            blobObject: result.blobObject,
            storage_type: 'official_walrus_sdk',
            attempt: attempt
          } 
        });
      } catch (attemptError: any) {
        lastError = attemptError;
        console.error(`Walrus upload attempt ${attempt} failed:`, attemptError.message);
        
        // オブジェクトロック競合エラーの場合はリトライ
        if (attemptError.message?.includes('reserved for another transaction') || 
            attemptError.message?.includes('object is locked') ||
            attemptError.message?.includes('quorum of validators')) {
          
          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000; // 指数バックオフ + ジッター
            console.log(`Retrying in ${Math.round(delay)}ms due to object lock conflict...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        } else {
          // その他のエラーは即座に失敗
          break;
        }
      }
    }
    
    // 全てのリトライが失敗した場合
    throw lastError;
  } catch (e: any) {
    console.error('Walrus SDK upload failed:', e);
    return res.status(500).json({ 
      success: false, 
      error: e?.message || 'Walrus SDK upload error',
      type: e?.constructor?.name || 'Error'
    });
  }
});

// 認証済みユーザー一覧取得
app.get('/api/verified-users', async (req, res) => {
  try {
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

// Discordサーバーのロール一覧取得API
app.get('/api/roles', async (req, res) => {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const roles = await guild.roles.fetch();
    const roleList = roles.map(role => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
      mentionable: role.mentionable
    }));
    res.json({ success: true, roles: roleList });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch roles' });
  }
});

export function startApiServer() {
  app.listen(PORT, () => {
    console.log(`Discord Bot API server running on http://localhost:${PORT}`);
  });
}

export { app };

// =============================
// Package Publish (Admin only)
// =============================
app.post('/api/publish', async (req, res) => {
  try {
    const admin = req.header('X-Admin-Address');
    if (!admin) {
      return res.status(403).json({ success: false, error: 'Forbidden: admin header missing' });
    }
    const { modules, dependencies, gasBudget } = req.body || {};
    if (!Array.isArray(modules) || !Array.isArray(dependencies)) {
      return res.status(400).json({ success: false, error: 'modules and dependencies are required' });
    }

    const client = getSuiClient();
    const kp = getSponsorKeypair();
    const tx = new Transaction();
    tx.publish({ modules, dependencies });

    const safeGas = gasBudget ? Number(gasBudget) : 100_000_000; // 0.1 SUI
    if (!(safeGas >= 1_000_000 && safeGas <= 1_000_000_000)) {
      return res.status(400).json({ success: false, error: `Gas budget out of safe range: ${safeGas}` });
    }
    tx.setGasBudget(safeGas);

    const result = await client.signAndExecuteTransaction({
      signer: kp,
      transaction: tx,
      options: { showEffects: true, showEvents: true, showObjectChanges: true }
    });

    return res.json({ success: true, txDigest: result.digest, result });
  } catch (e: any) {
    console.error('Publish failed:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Publish failed' });
  }
});