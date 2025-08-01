import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verifySignedMessage } from './lib/verify';
import { hasTargetNft } from './lib/nft-check';
import { DiscordBotAPI } from './discord-bot';
import type { Env, ReqBody, VerificationResult } from './types';

const app = new Hono<{ Bindings: Env }>();

// Discord Bot通信関数
async function notifyDiscordBot(discordId: string, action: 'grant_role' | 'revoke_role', env: Env): Promise<boolean> {
  try {
    console.log(`🔄 Discord Bot API: ${action} for user ${discordId}`);
    
    // Cloudflare Workers環境では、環境変数をenvオブジェクトから取得
    const discordBot = new DiscordBotAPI(env);
    
    if (action === 'grant_role') {
      return await discordBot.grantRole(discordId);
    } else {
      return await discordBot.revokeRole(discordId);
    }

  } catch (error) {
    console.error('❌ Error with Discord Bot API:', error);
    return false;
  }
}

// CORS設定（より寛容に）
app.use('*', cors({
  origin: ['*'],
  allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400
}));

// ヘルスチェック
app.get('/', (c) => {
  return c.json({ status: 'ok', message: 'NFT Verification Service' });
});

// 認証ページの配信
app.get('/verify.html', (c) => {
  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NFT認証</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', sans-serif;
            background: #0a0a0a;
            color: #ffffff;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        .container {
            width: 100%;
            max-width: 400px;
            padding: 0 24px;
            animation: fadeIn 0.6s ease-out;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .header {
            text-align: center;
            margin-bottom: 32px;
        }

        .logo {
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            border-radius: 20px;
            margin: 0 auto 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            box-shadow: 0 8px 32px rgba(99, 102, 241, 0.3);
        }

        h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
            background: linear-gradient(135deg, #ffffff, #a1a1aa);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .subtitle {
            color: #71717a;
            font-size: 14px;
            font-weight: 400;
        }

        .discord-tag {
            background: #1e1e1e;
            border: 1px solid #2a2a2a;
            border-radius: 12px;
            padding: 16px;
            margin: 24px 0;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .discord-tag .icon {
            width: 32px;
            height: 32px;
            background: #5865f2;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
        }

        .discord-tag .text {
            flex: 1;
            font-size: 14px;
            color: #a1a1aa;
        }

        .discord-tag .value {
            font-family: 'SF Mono', monospace;
            color: #ffffff;
            font-size: 13px;
        }

        .action-area {
            margin: 32px 0;
        }

        .wallet-button {
            width: 100%;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            border: none;
            border-radius: 16px;
            padding: 20px;
            color: white;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
            margin-bottom: 16px;
        }

        .wallet-button::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .wallet-button:hover::before {
            opacity: 1;
        }

        .wallet-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 40px rgba(99, 102, 241, 0.4);
        }

        .wallet-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
        }

        .wallet-button .content {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .verify-button {
            width: 100%;
            background: linear-gradient(135deg, #10b981, #059669);
            border: none;
            border-radius: 16px;
            padding: 20px;
            color: white;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            opacity: 0;
            transform: translateY(20px);
            pointer-events: none;
        }

        .verify-button.show {
            opacity: 1;
            transform: translateY(0);
            pointer-events: all;
        }

        .verify-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 12px 40px rgba(16, 185, 129, 0.4);
        }

        .wallet-info {
            background: #1e1e1e;
            border: 1px solid #2a2a2a;
            border-radius: 12px;
            padding: 16px;
            margin: 16px 0;
            display: none;
            align-items: center;
            gap: 12px;
        }

        .wallet-info.show {
            display: flex;
        }

        .wallet-info .icon {
            width: 32px;
            height: 32px;
            background: #6366f1;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
        }

        .wallet-info .text {
            flex: 1;
            font-size: 14px;
            color: #a1a1aa;
        }

        .wallet-info .value {
            font-family: 'SF Mono', monospace;
            color: #ffffff;
            font-size: 13px;
        }

        .status {
            padding: 16px;
            border-radius: 12px;
            margin: 16px 0;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 14px;
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.3s ease;
        }

        .status.show {
            opacity: 1;
            transform: translateY(0);
        }

        .status.success {
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.3);
            color: #10b981;
        }

        .status.error {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #ef4444;
        }

        .status.loading {
            background: rgba(99, 102, 241, 0.1);
            border: 1px solid rgba(99, 102, 241, 0.3);
            color: #6366f1;
        }

        .spinner {
            width: 16px;
            height: 16px;
            border: 2px solid transparent;
            border-top: 2px solid currentColor;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            display: none;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .progress {
            width: 100%;
            height: 4px;
            background: #2a2a2a;
            border-radius: 2px;
            margin: 16px 0;
            overflow: hidden;
            display: none;
        }

        .progress.show {
            display: block;
        }

        .progress-bar {
            height: 100%;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            border-radius: 2px;
            transition: width 0.3s ease;
            width: 0%;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">✨</div>
            <h1>NFT認証</h1>
            <p class="subtitle">Discordロールを取得するためにNFTを認証してください</p>
        </div>

        <div class="discord-tag">
            <div class="icon">🎮</div>
            <div class="text">Discord ID:</div>
            <div class="value" id="discord-id">Loading...</div>
        </div>

        <div class="action-area">
            <button class="wallet-button" id="connect-btn" onclick="connectWallet()">
                <div class="content">
                    <span>🔗</span>
                    <span>Sui Walletに接続</span>
                </div>
            </button>

            <div class="wallet-info" id="wallet-info">
                <div class="icon">💎</div>
                <div class="text">ウォレット:</div>
                <div class="value" id="wallet-address"></div>
            </div>

            <div class="progress" id="progress">
                <div class="progress-bar" id="progress-bar"></div>
            </div>

            <div class="status" id="status">
                <div class="spinner" id="spinner"></div>
                <span id="status-text"></span>
            </div>

            <button class="verify-button" id="verify-btn" onclick="startVerification()">
                <div class="content">
                    <span>✨</span>
                    <span>認証開始</span>
                </div>
            </button>
        </div>
    </div>

    <script>
        let connectedWallet = null;
        let walletAddress = null;
        let discordId = null;
        
        // APIベースURLを環境に応じて設定
        const API_BASE_URL = window.location.hostname === 'localhost' 
            ? 'http://localhost:8787' 
            : 'https://nft-verification-production.mona-syndicatextokyo.workers.dev';

        // URLパラメータからDiscord IDを取得
        const urlParams = new URLSearchParams(window.location.search);
        discordId = urlParams.get('discord_id');
        
        if (discordId) {
            document.getElementById('discord-id').textContent = discordId.slice(0, 8) + '...';
        } else {
            showStatus('error', 'Discord IDが見つかりません');
        }

        // ミステンラボdApp Kitを使用したウォレット接続
        window.connectWallet = async function() {
            showStatus('loading', 'ウォレットを検索中...');
            
            try {
                console.log('🔍 Using Mysten Labs dApp Kit for wallet connection...');
                
                // 利用可能なウォレットを検出
                const availableWallets = await detectAvailableWallets();
                
                if (availableWallets.length === 0) {
                    throw new Error('利用可能なウォレットが見つかりません。Sui Walletをインストールしてください。');
                }

                // 最初のウォレットに接続
                const selectedWallet = availableWallets[0];
                console.log(\`Connecting to wallet: \${selectedWallet.name}\`);
                
                const accounts = await selectedWallet.connect();
                
                if (accounts && accounts.length > 0) {
                    walletAddress = accounts[0].address;
                    connectedWallet = selectedWallet;
                    
                    console.log(\`Connected to wallet: \${walletAddress}\`);
                    showStatus('success', 'ウォレットに接続しました');
                    
                    // UI更新
                    document.getElementById('connect-btn').style.display = 'none';
                    document.getElementById('verify-btn').classList.add('show');
                    document.getElementById('wallet-info').classList.add('show');
                    document.getElementById('wallet-address').textContent = walletAddress.slice(0, 8) + '...' + walletAddress.slice(-6);
                } else {
                    throw new Error('ウォレットの接続に失敗しました');
                }
            } catch (error) {
                console.error('Wallet connection error:', error);
                showStatus('error', error.message || 'ウォレット接続に失敗しました');
            }
        };

        // 利用可能なウォレットを検出
        async function detectAvailableWallets() {
            const wallets = [];
            
            // Sui Wallet (公式ウォレット)
            if (window.suiWallet) {
                wallets.push({
                    name: 'Sui Wallet',
                    connect: async () => {
                        const accounts = await window.suiWallet.request({ method: 'eth_accounts' });
                        return accounts.map(addr => ({ address: addr }));
                    },
                    signMessage: async (message) => {
                        const signature = await window.suiWallet.request({
                            method: 'personal_sign',
                            params: [message, walletAddress]
                        });
                        return { signature };
                    }
                });
            }
            
            // Sui Wallet Extension
            if (window.sui) {
                wallets.push({
                    name: 'Sui Wallet Extension',
                    connect: async () => {
                        const accounts = await window.sui.request({ method: 'eth_accounts' });
                        return accounts.map(addr => ({ address: addr }));
                    },
                    signMessage: async (message) => {
                        const signature = await window.sui.request({
                            method: 'personal_sign',
                            params: [message, walletAddress]
                        });
                        return { signature };
                    }
                });
            }
            
            // 開発用デモウォレット
            wallets.push({
                name: 'Demo Wallet',
                connect: async () => [{ 
                    address: '0x1234567890abcdef1234567890abcdef12345678' 
                }],
                signMessage: async (message) => ({ 
                    signature: '0x' + 'a'.repeat(128) 
                })
            });
            
            console.log(\`Found \${wallets.length} wallets:\`, wallets.map(w => w.name));
            return wallets;
        }

        // 認証開始
        window.startVerification = async function() {
            if (!walletAddress || !discordId) {
                showStatus('error', '接続情報が不完全です');
                return;
            }

            document.getElementById('progress').classList.add('show');
            setProgress(0);

            try {
                // ナンス取得
                setProgress(25);
                showStatus('loading', 'ナンス生成中...');
                
                const nonceRes = await fetch(\`\${API_BASE_URL}/nonce\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ wallet_address: walletAddress })
                });

                if (!nonceRes.ok) throw new Error('ナンス取得失敗');
                const { nonce } = await nonceRes.json();

                // 署名
                setProgress(50);
                showStatus('loading', 'ウォレットで署名...');
                
                const message = \`Verify NFT ownership for Discord role.\\nNonce: \${nonce}\\nAddress: \${walletAddress}\`;
                const messageBytes = new TextEncoder().encode(message);

                let signature = '';
                
                // 署名処理
                try {
                    const signResult = await connectedWallet.signMessage(messageBytes);
                    signature = signResult.signature || signResult;
                } catch (signError) {
                    console.error('Sign error:', signError);
                    throw new Error('署名に失敗しました: ' + signError.message);
                }

                // 認証
                setProgress(75);
                showStatus('loading', 'NFT確認中...');
                
                const verifyRes = await fetch(\`\${API_BASE_URL}/verify\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        wallet_address: walletAddress,
                        discord_id: discordId,
                        signature: signature,
                        nonce: nonce
                    })
                });

                const result = await verifyRes.json();

                setProgress(100);
                if (result.success) {
                    showStatus('success', '認証完了！Discordを確認してください');
                    setTimeout(() => window.close(), 3000);
                } else {
                    showStatus('error', result.message);
                }

            } catch (error) {
                console.error('Verification error:', error);
                showStatus('error', error.message || '認証に失敗しました');
                document.getElementById('progress').classList.remove('show');
            }
        };

        function showStatus(type, message) {
            const status = document.getElementById('status');
            const text = document.getElementById('status-text');
            const spinner = document.getElementById('spinner');
            
            status.className = \`status \${type}\`;
            text.textContent = message;
            spinner.style.display = type === 'loading' ? 'block' : 'none';
            status.classList.add('show');
        }

        function setProgress(percent) {
            document.getElementById('progress-bar').style.width = \`\${percent}%\`;
        }
    </script>
</body>
</html>`;
  
  return c.html(html);
});

// ナンス生成エンドポイント
app.post('/nonce', async (c) => {
  try {
    const body: ReqBody = await c.req.json();
    const { wallet_address } = body;

    if (!wallet_address) {
      return c.json({ error: 'wallet_address is required' }, 400);
    }

    // ナンス生成（タイムスタンプベース）
    const nonce = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5分後

    // KVに保存
    const nonceData = JSON.stringify({
      nonce,
      wallet_address,
      expires_at: expiresAt
    });

    await c.env.NONCE_KV.put(nonce, nonceData, { expirationTtl: 300 }); // 5分で期限切れ

    console.log(`Generated nonce for ${wallet_address}: ${nonce}`);
    return c.json({ nonce });

  } catch (error) {
    console.error('Nonce generation error:', error);
    return c.json({ error: 'Failed to generate nonce' }, 500);
  }
});

// 認証エンドポイント
app.post('/verify', async (c) => {
  try {
    const body: ReqBody = await c.req.json();
    const { wallet_address, discord_id, signature, nonce } = body;

    // 必須パラメータチェック
    if (!wallet_address || !discord_id || !signature || !nonce) {
      return c.json({ 
        success: false, 
        message: 'Missing required parameters' 
      }, 400);
    }

    console.log(`Verification request for ${wallet_address} (Discord: ${discord_id})`);

    // ナンス検証
    const storedNonceData = await c.env.NONCE_KV.get(nonce);
    if (!storedNonceData) {
      return c.json({ 
        success: false, 
        message: 'Invalid or expired nonce' 
      }, 400);
    }

    const isValidNonce = validateNonce(nonce, storedNonceData);
    if (!isValidNonce) {
      return c.json({ 
        success: false, 
        message: 'Invalid or expired nonce' 
      }, 400);
    }

    // 署名検証
    const isValidSignature = await verifySignedMessage(wallet_address, nonce, signature);
    if (!isValidSignature) {
      return c.json({ 
        success: false, 
        message: 'Invalid signature' 
      }, 400);
    }

    // NFT保有確認
    const hasNft = await hasTargetNft(wallet_address, c.env);
    if (!hasNft) {
      return c.json({ 
        success: false, 
        message: 'NFT not found in wallet' 
      }, 400);
    }

    // Discordロール付与
    const roleGranted = await notifyDiscordBot(discord_id, 'grant_role', c.env);
    if (!roleGranted) {
      return c.json({ 
        success: false, 
        message: 'Failed to grant Discord role' 
      }, 500);
    }

    // 使用済みナンスを削除
    await c.env.NONCE_KV.delete(nonce);

    console.log(`✅ Verification successful for ${wallet_address} (Discord: ${discord_id})`);

    return c.json({
      success: true,
      message: 'Verification completed successfully'
    });

  } catch (error) {
    console.error('Verification error:', error);
    return c.json({ 
      success: false, 
      message: 'Internal server error' 
    }, 500);
  }
});

// ナンス検証関数
function validateNonce(nonce: string, storedNonceData: string): boolean {
  try {
    const data = JSON.parse(storedNonceData);
    const now = Date.now();
    
    return data.nonce === nonce && now < data.expires_at;
  } catch (error) {
    console.error('Nonce validation error:', error);
    return false;
  }
}

export default app; 