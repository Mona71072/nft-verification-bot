const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS設定
app.use(cors({
  origin: ['*'],
  allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400
}));

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, 'web')));
app.use(express.json());

// ヘルスチェック
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'NFT Verification Service' });
});

// 認証ページの配信
app.get('/verify.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'verify.html'));
});

// ウォレット検出テストページの配信
app.get('/wallet-test.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'web', 'wallet-test.html'));
});

// Discordサーバー情報取得
app.get('/server-info', async (req, res) => {
  try {
    const guildId = process.env.DISCORD_GUILD_ID || '1214855750917160960';
    
    // 本番環境では実際のDiscord APIを呼び出す
    // ここでは開発用のモック実装
    const serverInfo = {
      name: 'Mona Syndicate Tokyo',
      id: guildId,
      memberCount: 1500,
      description: 'Suiエコシステムのコミュニティ'
    };
    
    res.json(serverInfo);
  } catch (error) {
    console.error('Error fetching server info:', error);
    res.status(500).json({ error: 'Failed to fetch server info' });
  }
});

// ナンス生成エンドポイント
app.post('/nonce', async (req, res) => {
  try {
    const { wallet_address } = req.body;

    if (!wallet_address) {
      return res.status(400).json({ error: 'wallet_address is required' });
    }

    // ナンス生成（タイムスタンプベース）
    const nonce = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分後

    // メモリに保存（本番環境ではRedisなどを使用）
    global.nonceStore = global.nonceStore || new Map();
    global.nonceStore.set(nonce, {
      nonce,
      wallet_address,
      expires_at: expiresAt
    });

    // 5分後に自動削除
    setTimeout(() => {
      global.nonceStore.delete(nonce);
    }, 5 * 60 * 1000);

    console.log(`Generated nonce for ${wallet_address}: ${nonce}`);
    res.json({ nonce });

  } catch (error) {
    console.error('Nonce generation error:', error);
    res.status(500).json({ error: 'Failed to generate nonce' });
  }
});

// 署名検証関数（開発用）
function verifySignedMessage(address, nonce, signature) {
  try {
    console.log(`Verifying signature for address: ${address}, nonce: ${nonce}`);
    
    if (!signature || signature.trim() === '') {
      console.error('Empty signature provided');
      return false;
    }

    // 開発用: 署名が存在し、適切な形式であれば有効とする
    if (signature.startsWith('0x') || signature.length >= 64) {
      console.log('Development mode: Signature verification passed');
      return true;
    }

    console.log('Signature verification failed: invalid format');
    return false;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// ナンス検証関数
function validateNonce(nonce, storedNonceData) {
  try {
    const now = Date.now();
    return storedNonceData.nonce === nonce && now < storedNonceData.expires_at;
  } catch (error) {
    console.error('Nonce validation error:', error);
    return false;
  }
}

// NFT保有確認関数（開発用）
function hasTargetNft(address) {
  // 開発用: アドレスが有効な形式であればtrueを返す
  if (address && address.startsWith('0x') && address.length >= 40) {
    console.log(`Development mode: NFT check passed for address: ${address}`);
    return true;
  }
  return false;
}

// Discord Bot API（簡易版）
async function notifyDiscordBot(discordId, action) {
  try {
    console.log(`🔄 Discord Bot API: ${action} for user ${discordId}`);
    
    // 本番環境では実際のDiscord APIを呼び出す
    // ここでは開発用のモック実装
    console.log(`✅ Mock: ${action} completed for Discord ID: ${discordId}`);
    return true;
  } catch (error) {
    console.error('❌ Error with Discord Bot API:', error);
    return false;
  }
}

// 認証エンドポイント
app.post('/verify', async (req, res) => {
  try {
    const { wallet_address, discord_id, signature, nonce } = req.body;

    // 必須パラメータチェック
    if (!wallet_address || !discord_id || !signature || !nonce) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required parameters' 
      });
    }

    console.log(`Verification request for ${wallet_address} (Discord: ${discord_id})`);

    // ナンス検証
    const storedNonceData = global.nonceStore.get(nonce);
    if (!storedNonceData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired nonce' 
      });
    }

    const isValidNonce = validateNonce(nonce, storedNonceData);
    if (!isValidNonce) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired nonce' 
      });
    }

    // 署名検証
    const isValidSignature = verifySignedMessage(wallet_address, nonce, signature);
    if (!isValidSignature) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid signature' 
      });
    }

    // NFT保有確認
    const hasNft = hasTargetNft(wallet_address);
    if (!hasNft) {
      return res.status(400).json({ 
        success: false, 
        message: 'NFT not found in wallet' 
      });
    }

    // Discordロール付与
    const roleGranted = await notifyDiscordBot(discord_id, 'grant_role');
    if (!roleGranted) {
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to grant Discord role' 
      });
    }

    // 使用済みナンスを削除
    global.nonceStore.delete(nonce);

    console.log(`✅ Verification successful for ${wallet_address} (Discord: ${discord_id})`);

    res.json({
      success: true,
      message: 'Verification completed successfully'
    });

  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 NFT Verification Service running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/`);
  console.log(`🔐 Verification page: http://localhost:${PORT}/verify.html`);
}); 