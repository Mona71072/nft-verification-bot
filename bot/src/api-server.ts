import express from 'express';
import { config } from './config';
import { grantRoleToUser, revokeRoleFromUser, sendVerificationFailureMessage } from './index';
import { client } from './index';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { getWalrusConfig, getDisplayImageUrl } from './services/walrus';
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

// Discord ロール一覧取得エンドポイント
app.get('/api/discord/roles', async (req, res) => {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    if (!guild) {
      return res.status(404).json({
        success: false,
        error: 'Guild not found'
      });
    }

    const roles = await guild.roles.fetch();
    const rolesList = roles.map(role => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
      permissions: role.permissions.toArray(),
      mentionable: role.mentionable,
      hoist: role.hoist
    }));

    res.json({
      success: true,
      data: rolesList
    });
  } catch (error) {
    console.error('Discord roles API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Discord roles'
    });
  }
});

// Discord DM通知エンドポイント
app.post('/api/notify-discord', async (req, res) => {
  try {
    const { discordId, action, verificationData, timestamp } = req.body;

    if (!discordId || !action) {
      return res.status(400).json({
        success: false,
        error: 'discordId and action are required'
      });
    }

    console.log('Discord notification requested:', { discordId, action, verificationData });

    // Discordユーザーを取得
    const user = await client.users.fetch(discordId);
    if (!user) {
      console.error('Discord user not found:', discordId);
      return res.status(404).json({
        success: false,
        error: 'Discord user not found'
      });
    }

    // 認証成功時のDM送信
    if (action === 'grant_roles' && verificationData) {
      try {
        // DM設定テンプレートを取得
        const dmSettingsResponse = await fetch(`${config.CLOUDFLARE_WORKERS_API_URL}/api/admin/dm-settings`, {
          headers: {
            'X-Admin-Address': '0x1234567890abcdef1234567890abcdef12345678',
            'User-Agent': 'Discord-Bot'
          }
        });

        let embed;
        if (dmSettingsResponse.ok) {
          const dmSettingsData = await dmSettingsResponse.json() as any;
          if (dmSettingsData.success && dmSettingsData.data && dmSettingsData.data.templates) {
            const templates = dmSettingsData.data.templates;
            const template = templates.successNew || templates.successUpdate;
            
            if (template) {
              // テンプレートを使用してDMを作成
              const description = template.description
                .replace('{collectionName}', verificationData.roleName || 'NFT Holder')
                .replace('{roles}', verificationData.roleName || 'NFT Holder')
                .replace(/\\n/g, '\n'); // エスケープされた改行を実際の改行に変換

              embed = {
                title: template.title,
                description: description,
                color: template.color,
                timestamp: timestamp || new Date().toISOString(),
                footer: {
                  text: 'SXT NFT Verification System'
                }
              };
            }
          }
        }

        // テンプレートが取得できない場合はデフォルトメッセージを使用
        if (!embed) {
          embed = {
            title: '🎉 Verification Completed',
            description: `**Your NFT verification is complete!**\n\n**Verified NFT Collection:**\n• ${verificationData.roleName || 'NFT Holder'}\n\n**Granted Roles:**\n• ${verificationData.roleName || 'NFT Holder'}\n\nIt may take a moment for roles to appear in the server.\n\nThank you for verifying!`,
            color: 0x00ff00,
            timestamp: timestamp || new Date().toISOString(),
            footer: {
              text: 'SXT NFT Verification System'
            }
          };
        }

        await user.send({ embeds: [embed] });
        console.log('Successfully sent DM to user:', discordId);
      } catch (dmError) {
        console.error('Failed to send DM:', dmError);
        return res.status(500).json({
          success: false,
          error: 'Failed to send DM'
        });
      }
    }

    res.json({
      success: true,
      message: 'Discord notification sent successfully'
    });

  } catch (error) {
    console.error('Discord notification API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send Discord notification'
    });
  }
});

// バッチ処理実行エンドポイント
app.post('/api/batch-process', async (req, res) => {
  try {
    const { collectionId, action, adminAddress } = req.body;

    if (!collectionId || !action) {
      return res.status(400).json({
        success: false,
        error: 'collectionId and action are required'
      });
    }

    console.log('Batch process requested:', { collectionId, action, adminAddress });

    // Cloudflare Workersから認証済みユーザーを取得
    const workersResponse = await fetch(`${config.CLOUDFLARE_WORKERS_API_URL}/api/admin/verified-users`, {
      headers: {
        'X-Admin-Address': adminAddress || '0x1234567890abcdef1234567890abcdef12345678',
        'User-Agent': 'Discord-Bot'
      }
    });

    if (!workersResponse.ok) {
      console.error('Failed to fetch verified users from Workers');
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch verified users'
      });
    }

    const usersData = await workersResponse.json() as any;
    const verifiedUsers = usersData.success ? usersData.data : [];

    console.log(`Found ${verifiedUsers.length} verified users`);

    let processedUsers = 0;
    let errors = 0;

    // 認証済みユーザーのロールを処理
    for (const user of verifiedUsers) {
      try {
        // 指定されたcollectionIdに対応するユーザーのみを処理
        const userCollectionIds = Array.isArray(user.collectionIds) ? user.collectionIds : [];
        const shouldProcess = userCollectionIds.includes(collectionId);
        
        if (!shouldProcess) {
          console.log(`Skipping user ${user.discordId} (not subscribed to collection ${collectionId})`);
          continue;
        }
        
        if (action === 'revoke') {
          // ロールを剥奪
          const success = await revokeRoleFromUser(user.discordId);
          if (success) {
            processedUsers++;
          } else {
            errors++;
          }
        } else if (action === 'verify') {
          // ロールを確認・付与
          const success = await grantRoleToUser(user.discordId, collectionId);
          if (success) {
            processedUsers++;
          } else {
            errors++;
          }
        } else if (action === 'check_and_update_roles') {
          // NFT保有状態をチェックしてロールを更新
          // hasNFTフィールドがある場合はそれを使用、ない場合は保有していると仮定
          const hasNFT = user.hasNFT !== false;
          
          if (hasNFT) {
            // NFTを保有している場合：ロールを付与
            const success = await grantRoleToUser(user.discordId, collectionId, user.roleName);
            if (success) {
              processedUsers++;
              console.log(`✅ Granted role to user ${user.discordId}`);
            } else {
              errors++;
            }
          } else {
            // NFTを保有していない場合：ロールを剥奪
            const success = await revokeRoleFromUser(user.discordId);
            if (success) {
              processedUsers++;
              console.log(`⚠️ Revoked role from user ${user.discordId} (no NFT)`);
            } else {
              errors++;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing user ${user.discordId}:`, error);
        errors++;
      }
    }

    console.log(`Batch process completed: ${processedUsers} processed, ${errors} errors`);

    // バッチ処理統計を更新
    try {
      const statsUpdate = {
        lastExecuted: new Date().toISOString(),
        processedUsers,
        errors,
        totalUsers: verifiedUsers.length,
        collectionId,
        action
      };

      const workersStatsResponse = await fetch(`${config.CLOUDFLARE_WORKERS_API_URL}/api/admin/update-batch-stats`, {
        method: 'POST',
        headers: {
          'X-Admin-Address': adminAddress || '0x1234567890abcdef1234567890abcdef12345678',
          'Content-Type': 'application/json',
          'User-Agent': 'Discord-Bot'
        },
        body: JSON.stringify(statsUpdate)
      });

      if (workersStatsResponse.ok) {
        console.log('Batch statistics updated successfully');
      } else {
        console.error('Failed to update batch statistics:', workersStatsResponse.status);
      }
    } catch (statsError) {
      console.error('Error updating batch statistics:', statsError);
    }

    res.json({
      success: true,
      message: 'Batch process completed successfully',
      data: {
        collectionId,
        action,
        processedUsers,
        errors,
        totalUsers: verifiedUsers.length
      }
    });
  } catch (error) {
    console.error('Batch process API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute batch process'
    });
  }
});

// スポンサー実行: Suiでのミント処理を代理送信（Walrus.pdf準拠）
app.post('/api/mint', async (req, res) => {
  try {
    const { eventId, recipient, moveCall, imageCid, imageMimeType, eventName, eventDate } = req.body || {};
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
        // name, imageCid, imageMimeType, eventDate に対応（Display標準対応）
        if (a === '{name}') return tx.pure.string(eventName || 'Event NFT');
        if (a === '{imageCid}') return tx.pure.string(imageCid || '');
        if (a === '{imageMimeType}') return tx.pure.string(imageMimeType || '');
        if (a === '{eventDate}') return tx.pure.string(eventDate || new Date().toISOString());
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

// PublisherオブジェクトID取得エンドポイント
app.get('/api/display/publisher/:packageId', async (req, res) => {
  try {
    const { packageId } = req.params;
    if (!packageId) {
      return res.status(400).json({ success: false, error: 'Missing packageId' });
    }

    const client = getSuiClient();
    
    // パッケージの詳細を取得してPublisherオブジェクトを検索
    const packageData = await client.getObject({
      id: packageId,
      options: { showContent: true, showOwner: true }
    });

    if (!packageData.data) {
      return res.status(404).json({ success: false, error: 'Package not found' });
    }

    // パッケージのオーナーからPublisherオブジェクトを検索
    const owner = packageData.data.owner;
    if (owner && typeof owner === 'object' && 'AddressOwner' in owner) {
      const ownerAddress = (owner as any).AddressOwner;
      
      // オーナーが所有するオブジェクトを検索
      const ownedObjects = await client.getOwnedObjects({
        owner: ownerAddress,
        filter: { StructType: '0x2::package::Publisher' },
        options: { showContent: true }
      });

      if (ownedObjects.data && ownedObjects.data.length > 0) {
        const publisher = ownedObjects.data[0];
        return res.json({ 
          success: true, 
          publisherId: publisher.data?.objectId,
          owner: ownerAddress
        });
      }
    }

    return res.status(404).json({ success: false, error: 'Publisher object not found for this package' });
  } catch (e: any) {
    console.error('Publisher lookup failed:', e);
    return res.status(500).json({ success: false, error: e?.message || 'Publisher lookup failed' });
  }
});

// 型Display設定エンドポイント（Publisher権限のあるアカウントで実行）
app.post('/api/display/setup', async (req, res) => {
  try {
    const { type, publisherId, fields } = req.body || {};
    if (!type || !publisherId) {
      return res.status(400).json({ success: false, error: 'Missing type or publisherId' });
    }

    // デフォルトDisplayフィールド（Walrus Aggregator API準拠の画像URL）
    const defaultKeys = ['name', 'description', 'image_url'];
    const defaultValues = ['{name}', '{description}', getDisplayImageUrl('{image_cid}', process.env)];

    const keys: string[] = Array.isArray(fields?.keys) && fields.keys.length > 0 ? fields.keys : defaultKeys;
    const values: string[] = Array.isArray(fields?.values) && fields.values.length === keys.length ? fields.values : defaultValues;

    // 型パスの簡易検証
    if (!/^0x[a-fA-F0-9]+::[a-zA-Z_][a-zA-Z0-9_]*::[a-zA-Z_][a-zA-Z0-9_]*$/.test(type)) {
      return res.status(400).json({ success: false, error: `Invalid type format: ${type}` });
    }

    // PublisherオブジェクトIDの簡易検証
    if (!/^0x[0-9a-fA-F]+$/.test(publisherId)) {
      return res.status(400).json({ success: false, error: `Invalid publisherId: ${publisherId}` });
    }

    const client = getSuiClient();
    const kp = getSponsorKeypair();
    const tx = new Transaction();

    // 0x2::display::new_with_fields<T>(&uid_owner, keys, values, &mut TxContext)
    // 注意: Move側の署名に依存します。Publisher権限が必要です。
    // 正しい引数形式: keysとvaluesはvector<string>として渡す
    const keysVector = tx.pure.vector('string', keys);
    const valuesVector = tx.pure.vector('string', values);
    
    // デバッグ情報を追加
    console.log('Display setup debug:', {
      type,
      publisherId,
      keys,
      values,
      keysVector: keysVector,
      valuesVector: valuesVector
    });
    
    // 0x2::display::new_with_fields<T>(publisher, keys, values)
    // モナさんの指摘通り、Publisherオブジェクトを使用
    tx.moveCall({
      target: '0x2::display::new_with_fields',
      typeArguments: [type],
      arguments: [
        tx.object(publisherId),  // ← ここがPublisher（必須）
        keysVector,
        valuesVector
      ]
    });

    // 2段階フロー（保険）: もしnew_with_fieldsが通らない場合
    // 1. 0x2::display::new<T>(publisher) で空Displayを作成
    // 2. 0x2::display::update_version<T>(display, keys, values) でfieldsを追加
    // どちらも引数0はPublisher/Displayで、keys/valuesはvector<string>

    // ガス安全枠
    tx.setGasBudget(100_000_000);

    const result = await client.signAndExecuteTransaction({
      signer: kp,
      transaction: tx,
      options: { showEffects: true, showEvents: true, showObjectChanges: true }
    });

    return res.json({ success: true, txDigest: result.digest, result });
  } catch (e: any) {
    console.error('Display setup failed:', e);
    return res.status(500).json({ success: false, error: e?.message || 'display setup failed' });
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

// 画像アップロード + Display設定の統合エンドポイント
app.post('/api/display/setup-with-image', async (req, res) => {
  try {
    const { type, publisherId, imageBase64, imageContentType, name, description } = req.body || {};
    if (!type || !publisherId || !imageBase64) {
      return res.status(400).json({ success: false, error: 'Missing type, publisherId, or imageBase64' });
    }

    console.log('Starting image upload + display setup process...');

    // 1. 画像をWalrusにアップロード
    const uploadResponse = await fetch(`${req.protocol}://${req.get('host')}/api/walrus/sponsor-upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataBase64: imageBase64,
        contentType: imageContentType || 'image/png'
      })
    });

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json().catch(() => ({})) as any;
      return res.status(500).json({ 
        success: false, 
        error: `Image upload failed: ${errorData.error || 'Unknown error'}` 
      });
    }

    const uploadData = await uploadResponse.json() as any;
    if (!uploadData.success) {
      return res.status(500).json({ 
        success: false, 
        error: `Image upload failed: ${uploadData.error}` 
      });
    }

    const imageCid = uploadData.data.blob_id;
    console.log(`Image uploaded successfully, CID: ${imageCid}`);

    // 2. Display設定を実行
    const displayResponse = await fetch(`${req.protocol}://${req.get('host')}/api/display/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        publisherId,
        fields: {
          keys: ['name', 'description', 'image_url'],
          values: [
            name || '{name}',
            description || '{description}',
            `https://wal.app/ipfs/${imageCid}` // Walrus形式の画像URL
          ]
        }
      })
    });

    if (!displayResponse.ok) {
      const errorData = await displayResponse.json().catch(() => ({})) as any;
      return res.status(500).json({ 
        success: false, 
        error: `Display setup failed: ${errorData.error || 'Unknown error'}` 
      });
    }

    const displayData = await displayResponse.json() as any;
    if (!displayData.success) {
      return res.status(500).json({ 
        success: false, 
        error: `Display setup failed: ${displayData.error}` 
      });
    }

    console.log('Display setup completed successfully');

    return res.json({
      success: true,
      data: {
        imageCid,
        imageUrl: `https://wal.app/ipfs/${imageCid}`,
        txDigest: displayData.txDigest,
        displayResult: displayData.result
      }
    });

  } catch (e: any) {
    console.error('Image upload + display setup failed:', e);
    return res.status(500).json({ 
      success: false, 
      error: e?.message || 'Image upload + display setup failed' 
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