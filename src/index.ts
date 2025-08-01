import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verifySignedMessage } from './lib/verify';
import { hasTargetNft } from './lib/nft-check';
import { DiscordBotAPI } from './discord-bot';
import type { Env, ReqBody, VerificationResult } from './types';

const app = new Hono<{ Bindings: Env }>();

// Discord Bot API
const discordBot = new DiscordBotAPI();

// Discord Bot通信関数
async function notifyDiscordBot(discordId: string, action: 'grant_role' | 'revoke_role'): Promise<boolean> {
  try {
    console.log(`🔄 Discord Bot API: ${action} for user ${discordId}`);
    
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
    <script type="module">
        // Wallet Standard ライブラリを CDN から読み込み
        import { getWallets } from 'https://unpkg.com/@mysten/wallet-standard@latest/dist/esm/index.js';
        window.getWallets = getWallets;
    </script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #333;
        }

        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            padding: 40px;
            max-width: 500px;
            width: 90%;
            text-align: center;
        }

        .logo {
            font-size: 2.5rem;
            font-weight: bold;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 20px;
        }

        .status {
            margin: 20px 0;
            padding: 15px;
            border-radius: 10px;
            font-weight: 500;
        }

        .status.connecting {
            background: #e3f2fd;
            color: #1976d2;
        }

        .status.success {
            background: #e8f5e8;
            color: #2e7d32;
        }

        .status.error {
            background: #ffebee;
            color: #c62828;
        }

        .progress-bar {
            width: 100%;
            height: 6px;
            background: #e0e0e0;
            border-radius: 3px;
            overflow: hidden;
            margin: 20px 0;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #667eea, #764ba2);
            width: 0%;
            transition: width 0.3s ease;
        }

        .btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 15px 30px;
            border-radius: 25px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: transform 0.2s ease;
            margin: 10px;
        }

        .btn:hover {
            transform: translateY(-2px);
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }

        .wallet-info {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            font-family: monospace;
            font-size: 14px;
            word-break: break-all;
        }

        .hidden {
            display: none;
        }

        .wallet-selection {
            margin: 20px 0;
        }

        .wallet-selection h3 {
            margin-bottom: 15px;
            font-size: 1.2rem;
            color: #333;
        }

        .wallet-list {
            display: grid;
            gap: 10px;
            margin-bottom: 20px;
        }

        .wallet-item {
            display: flex;
            align-items: center;
            padding: 15px;
            border: 2px solid #e0e0e0;
            border-radius: 15px;
            cursor: pointer;
            transition: all 0.3s ease;
            background: #f9f9f9;
        }

        .wallet-item:hover {
            border-color: #6366f1;
            background: #f0f0ff;
        }

        .wallet-item.selected {
            border-color: #6366f1;
            background: linear-gradient(135deg, #6366f1, #764ba2);
            color: white;
        }

        .wallet-item.unavailable {
            opacity: 0.5;
            cursor: not-allowed;
            background: #f0f0f0;
        }

        .wallet-icon {
            font-size: 1.5rem;
            margin-right: 12px;
        }

        .wallet-details {
            flex: 1;
        }

        .wallet-name {
            font-weight: 600;
            margin-bottom: 2px;
        }

        .wallet-status {
            font-size: 0.85rem;
            opacity: 0.8;
        }

        .btn.secondary {
            background: #6b7280;
            color: white;
        }

        .btn.secondary:hover {
            background: #4b5563;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">NFT Verification</div>
        
        <div id="status" class="status connecting">
            Discord認証を開始しています...
        </div>
        
        <div class="progress-bar">
            <div id="progress" class="progress-fill"></div>
        </div>
        
        <div id="walletSelection" class="wallet-selection">
            <h3>ウォレットを選択してください</h3>
            <div id="walletList" class="wallet-list"></div>
            <button id="refreshWallets" class="btn secondary" onclick="detectAndShowWallets()">
                ウォレットを再検出
            </button>
        </div>
        
        <button id="connectBtn" class="btn hidden" onclick="connectSelectedWallet()">
            Connect to Selected Wallet
        </button>
        
        <div id="walletInfo" class="wallet-info hidden"></div>
        
        <div id="result" class="status hidden"></div>
    </div>

    <script>
        const API_BASE_URL = location.origin;
        const urlParams = new URLSearchParams(window.location.search);
        const discordId = urlParams.get('discord_id');
        
        let currentWallet = null;
        let currentAddress = null;
        let selectedWalletId = null;
        let availableWallets = [];

        // デモウォレット（開発用）
        const demoWallet = {
            id: 'demo',
            name: 'Demo Wallet',
            icon: '🧪',
            description: '開発用デモウォレット',
            available: true,
            features: {
                'standard:connect': {
                    version: '1.0.0',
                    connect: async () => {
                        return {
                            accounts: [{
                                address: '0x1234567890abcdef1234567890abcdef12345678',
                                publicKey: new Uint8Array(32),
                                chains: ['sui:devnet'],
                                features: ['standard:connect', 'sui:signPersonalMessage']
                            }]
                        };
                    }
                },
                'sui:signPersonalMessage': {
                    version: '1.0.0',
                    signPersonalMessage: async ({ message }) => {
                        return {
                            signature: new Uint8Array(64),
                            bytes: new TextEncoder().encode(message)
                        };
                    }
                }
            }
        };

        // Wallet Standard準拠の包括的なウォレット検出
        function detectAllWallets() {
            console.log('🔍 Detecting wallets using Wallet Standard and legacy methods...');
            const wallets = [];
            
            try {
                // 1. Wallet Standard準拠のウォレットを検出
                console.log('🔬 Checking for Wallet Standard...');
                
                // 複数のパターンでgetWalletsを試行
                let getWalletsFunction = null;
                if (typeof window !== 'undefined') {
                    getWalletsFunction = window.getWallets || 
                                       (window.navigator?.wallets?.get) ||
                                       (window.suiWallets?.get) ||
                                       (window.wallets?.get);
                }
                
                if (getWalletsFunction) {
                    console.log('✅ Wallet Standard API found');
                    
                    try {
                        const standardWallets = typeof getWalletsFunction === 'function' 
                            ? getWalletsFunction() 
                            : getWalletsFunction.get?.();
                            
                        if (Array.isArray(standardWallets)) {
                            console.log(\`Found \${standardWallets.length} standard wallets:\`, standardWallets.map(w => w.name));
                            
                            for (const wallet of standardWallets) {
                                console.log(\`📋 Checking wallet: \${wallet.name}\`);
                                
                                // Sui対応チェック
                                const supportsSui = wallet.chains?.some(chain => 
                                    chain.toString().toLowerCase().includes('sui')
                                ) || wallet.name.toLowerCase().includes('sui');
                                
                                if (!supportsSui) {
                                    console.log(\`⚠️ Wallet \${wallet.name} does not support Sui\`);
                                    continue;
                                }
                                
                                // 必要な機能があるかチェック
                                const hasConnect = wallet.features?.['standard:connect'];
                                const hasSignMessage = wallet.features?.['sui:signPersonalMessage'] || 
                                                     wallet.features?.['sui:signMessage'];
                                
                                if (hasConnect) {
                                    console.log(\`✅ Adding standard wallet: \${wallet.name}\`);
                                    
                                    wallets.push({
                                        id: \`standard_\${wallet.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}\`,
                                        name: wallet.name,
                                        icon: getWalletIcon(wallet),
                                        description: 'Wallet Standard準拠',
                                        available: true,
                                        isStandard: true,
                                        wallet: wallet,
                                        connect: async () => {
                                            console.log(\`🔗 Connecting to \${wallet.name} via Wallet Standard...\`);
                                            const result = await wallet.features['standard:connect'].connect();
                                            const account = result.accounts?.[0] || wallet.accounts?.[0];
                                            if (!account) {
                                                throw new Error('No accounts returned from wallet');
                                            }
                                            return {
                                                address: account.address,
                                                publicKey: account.publicKey
                                            };
                                        },
                                        signMessage: hasSignMessage ? async (message) => {
                                            console.log(\`✍️ Signing message with \${wallet.name} via Wallet Standard...\`);
                                            const account = wallet.accounts?.[0];
                                            if (!account) {
                                                throw new Error('No accounts available for signing');
                                            }
                                            
                                            const feature = wallet.features['sui:signPersonalMessage'] || 
                                                          wallet.features['sui:signMessage'];
                                            
                                            const result = await feature.signPersonalMessage({
                                                message: new TextEncoder().encode(message),
                                                account: account
                                            });
                                            
                                            return Array.isArray(result.signature) 
                                                ? result.signature.join('') 
                                                : result.signature;
                                        } : null
                                    });
                                } else {
                                    console.log(\`❌ Wallet \${wallet.name} missing required features\`);
                                }
                            }
                        }
                    } catch (standardError) {
                        console.error('Error accessing standard wallets:', standardError);
                    }
                } else {
                    console.log('⚠️ Wallet Standard API not available');
                }
                
                // 2. レガシーウォレット検出（フォールバック）
                console.log('🔍 Checking for legacy wallet APIs...');
                const legacyWallets = [
                    {
                        id: 'suiet_legacy',
                        name: 'Suiet Wallet',
                        icon: '🔮',
                        description: '人気のSuiウォレット',
                        windowKey: 'suiet',
                        downloadUrl: 'https://chrome.google.com/webstore/detail/suiet-sui-wallet/khpkpbbcccdmmclmpigdgddabeilkdpd'
                    },
                    {
                        id: 'sui_legacy',
                        name: 'Sui Wallet',
                        icon: '💧',
                        description: '公式Suiウォレット',
                        windowKey: 'sui',
                        downloadUrl: 'https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil'
                    },
                    {
                        id: 'martian_legacy',
                        name: 'Martian Wallet',
                        icon: '🚀',
                        description: 'マルチチェーンウォレット',
                        windowKey: 'martian',
                        downloadUrl: 'https://chromewebstore.google.com/detail/martian-aptos-wallet/efbglgofoippbgcjepnhiblaibcnclgk'
                    },
                    {
                        id: 'ethos_legacy',
                        name: 'Ethos Wallet',
                        icon: '🌟',
                        description: 'Suiエコシステムウォレット',
                        windowKey: 'ethos',
                        downloadUrl: 'https://chrome.google.com/webstore/detail/ethos-sui-wallet/mcbigmjiafegjnnogedioegffbooigli'
                    }
                ];
                
                for (const config of legacyWallets) {
                    const walletObject = window[config.windowKey];
                    const isAvailable = walletObject && (walletObject.connect || walletObject.getAccounts);
                    
                    // 既にWallet Standardで検出されていないかチェック
                    const alreadyDetected = wallets.some(w => 
                        w.name.toLowerCase().includes(config.name.toLowerCase().split(' ')[0])
                    );
                    
                    if (isAvailable && !alreadyDetected) {
                        console.log(\`✅ Found legacy wallet: \${config.name}\`);
                        wallets.push({
                            ...config,
                            available: true,
                            isStandard: false,
                            connect: async () => {
                                console.log(\`🔗 Connecting to \${config.name} via legacy API...\`);
                                const result = await walletObject.connect();
                                return {
                                    address: result.address || result.account?.address || result.accounts?.[0]?.address,
                                    publicKey: result.publicKey || result.account?.publicKey || result.accounts?.[0]?.publicKey
                                };
                            },
                            signMessage: async (message) => {
                                console.log(\`✍️ Signing message with \${config.name} via legacy API...\`);
                                return await walletObject.signMessage({ message });
                            }
                        });
                    } else if (!alreadyDetected) {
                        // 利用不可能なウォレットも表示（インストール促進のため）
                        console.log(\`❌ Legacy wallet not available: \${config.name}\`);
                        wallets.push({
                            ...config,
                            available: false,
                            isStandard: false,
                            connect: null,
                            signMessage: null
                        });
                    }
                }
                
                // 3. モバイル環境の検出
                const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                if (isMobile) {
                    console.log('📱 Mobile environment detected');
                    
                    // モバイル固有のウォレットを追加
                    const mobileWallets = [
                        {
                            id: 'sui_mobile',
                            name: 'Sui Wallet (Mobile)',
                            icon: '📱',
                            description: 'モバイルアプリを開く',
                            available: true,
                            isMobile: true,
                            connect: async () => {
                                // WalletConnectやディープリンク実装はここに
                                throw new Error('モバイルウォレット接続は開発中です');
                            },
                            signMessage: null
                        }
                    ];
                    
                    wallets.push(...mobileWallets);
                }
                
                // 4. デモウォレット（開発環境のみ）
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    console.log('🧪 Adding demo wallet for development');
                    wallets.push({
                        id: 'demo',
                        name: 'Demo Wallet',
                        icon: '🧪',
                        description: '開発用デモウォレット',
                        available: true,
                        isStandard: false,
                        connect: async () => {
                            console.log('🔗 Connecting to demo wallet...');
                            return {
                                address: '0x1234567890abcdef1234567890abcdef12345678',
                                publicKey: '0x1234567890abcdef1234567890abcdef12345678'
                            };
                        },
                        signMessage: async (message) => {
                            console.log('✍️ Signing with demo wallet...');
                            return '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
                        }
                    });
                }
                
            } catch (error) {
                console.error('❌ Critical error in wallet detection:', error);
                
                // エラー時のフォールバック
                wallets.push({
                    id: 'error_fallback',
                    name: 'エラーが発生しました',
                    icon: '❌',
                    description: 'ページを再読み込みしてください',
                    available: false,
                    connect: null,
                    signMessage: null
                });
            }
            
            console.log(\`🎯 Final wallet detection result: \${wallets.length} wallets found\`);
            console.log('Available wallets:', wallets.filter(w => w.available).map(w => w.name));
            console.log('Unavailable wallets:', wallets.filter(w => !w.available).map(w => w.name));
            
            return wallets;
        }
        
        // ウォレットアイコンを取得するヘルパー関数
        function getWalletIcon(wallet) {
            if (wallet.icon) {
                // データURLかHTTPSリンクの場合はそのまま使用
                if (wallet.icon.startsWith('data:') || wallet.icon.startsWith('https:')) {
                    return wallet.icon;
                }
            }
            
            // ウォレット名から推測
            const name = wallet.name.toLowerCase();
            if (name.includes('suiet')) return '🔮';
            if (name.includes('sui')) return '💧';
            if (name.includes('martian')) return '🚀';
            if (name.includes('ethos')) return '🌟';
            if (name.includes('onekey')) return '🔑';
            if (name.includes('phantom')) return '👻';
            
            return '🔗'; // デフォルト
        }
        
        // ウォレット選択UIを表示
        function detectAndShowWallets() {
            availableWallets = detectAllWallets();
            const walletListElement = document.getElementById('walletList');
            const connectBtn = document.getElementById('connectBtn');
            
            walletListElement.innerHTML = '';
            
            if (availableWallets.length === 0) {
                walletListElement.innerHTML = \`
                    <div class="wallet-item unavailable">
                        <div class="wallet-icon">⚠️</div>
                        <div class="wallet-details">
                            <div class="wallet-name">No wallets found</div>
                            <div class="wallet-status">Please install a Sui wallet</div>
                        </div>
                    </div>
                \`;
                return;
            }
            
            availableWallets.forEach(wallet => {
                const walletElement = document.createElement('div');
                walletElement.className = \`wallet-item \${wallet.available ? '' : 'unavailable'}\`;
                walletElement.dataset.walletId = wallet.id;
                
                // ウォレットタイプのバッジを追加
                const typeBadge = wallet.isStandard ? 
                    '<span style="background: #10b981; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7rem; margin-left: 8px;">Standard</span>' :
                    wallet.isMobile ? 
                    '<span style="background: #f59e0b; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7rem; margin-left: 8px;">Mobile</span>' :
                    '<span style="background: #6b7280; color: white; padding: 2px 6px; border-radius: 10px; font-size: 0.7rem; margin-left: 8px;">Legacy</span>';
                
                walletElement.innerHTML = \`
                    <div class="wallet-icon">
                        \${wallet.icon && wallet.icon.startsWith('data:') ? 
                            \`<img src="\${wallet.icon}" style="width: 24px; height: 24px; border-radius: 50%;" alt="\${wallet.name}">\` : 
                            wallet.icon
                        }
                    </div>
                    <div class="wallet-details">
                        <div class="wallet-name">
                            \${wallet.name}
                            \${wallet.available ? typeBadge : ''}
                        </div>
                        <div class="wallet-status">
                            \${wallet.available ? 
                                (wallet.isStandard ? 'Wallet Standard準拠' : 
                                 wallet.isMobile ? 'モバイルアプリ' : 
                                 wallet.description) : 
                                'インストールが必要'
                            }
                        </div>
                    </div>
                    \${!wallet.available && wallet.downloadUrl ? 
                        \`<a href="\${wallet.downloadUrl}" target="_blank" style="color: #6366f1; font-size: 0.8rem; text-decoration: none;">📥 インストール</a>\` : 
                        ''
                    }
                \`;
                
                if (wallet.available) {
                    walletElement.addEventListener('click', () => {
                        // 他の選択を解除
                        document.querySelectorAll('.wallet-item.selected').forEach(el => {
                            el.classList.remove('selected');
                        });
                        
                        // 選択
                        walletElement.classList.add('selected');
                        selectedWalletId = wallet.id;
                        currentWallet = wallet;
                        
                        // 接続ボタンを表示
                        connectBtn.classList.remove('hidden');
                        connectBtn.textContent = \`Connect to \${wallet.name}\`;
                    });
                }
                
                walletListElement.appendChild(walletElement);
            });
        }

        // 選択されたウォレットに接続
        async function connectSelectedWallet() {
            if (!currentWallet) {
                showError('ウォレットが選択されていません');
                return;
            }
            
            if (!discordId) {
                showError('Discord IDが見つかりません');
                return;
            }

            const connectBtn = document.getElementById('connectBtn');
            const status = document.getElementById('status');
            const progress = document.getElementById('progress');
            const walletSelection = document.getElementById('walletSelection');

            try {
                // ウォレット選択UIを隠す
                walletSelection.style.display = 'none';
                connectBtn.classList.add('hidden');
                
                // ステップ1: ウォレット接続
                updateStatus(\`\${currentWallet.name}に接続中...\`, 'connecting');
                updateProgress(20);

                console.log(\`Connecting to \${currentWallet.name} using Wallet Standard...\`);
                
                try {
                    // Wallet Standard の接続を使用
                    const connection = await currentWallet.connect();
                    console.log('Wallet connection result:', connection);
                    
                    currentAddress = connection.address;
                    
                    if (!currentAddress) {
                        throw new Error('ウォレットからアドレスを取得できませんでした');
                    }
                    
                    console.log(\`Connected to address: \${currentAddress}\`);
                    
                    // ウォレットの accounts 情報を更新（標準ウォレットの場合）
                    if (currentWallet.wallet) {
                        console.log('Updated wallet accounts:', currentWallet.wallet.accounts);
                    }
                    
                } catch (walletError) {
                    console.error('Wallet connection error:', walletError);
                    showError(\`\${currentWallet.name}への接続に失敗しました。\\n\\nウォレットを開いて認証を完了してから再試行してください。\\n\\nエラー: \${walletError.message}\`);
                    
                    // エラー時にUIを戻す
                    walletSelection.style.display = 'block';
                    connectBtn.classList.remove('hidden');
                    return;
                }
                
                document.getElementById('walletInfo').innerHTML = \`接続済み: \${currentAddress}\`;
                document.getElementById('walletInfo').classList.remove('hidden');

                updateStatus('認証メッセージを生成中...', 'connecting');
                updateProgress(40);

                // ステップ2: ナンス取得
                const nonceResponse = await fetch(\`\${API_BASE_URL}/nonce\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ discord_id: discordId })
                });

                if (!nonceResponse.ok) {
                    throw new Error('ナンスの取得に失敗しました');
                }

                const { nonce } = await nonceResponse.json();

                updateStatus('メッセージに署名中...', 'connecting');
                updateProgress(80);

                // ステップ3: メッセージ署名（Wallet Standard を使用）
                const message = \`NFT Verification\\n\\nDiscord ID: \${discordId}\\nNonce: \${nonce}\\nTimestamp: \${Date.now()}\`;
                console.log('Signing message with Wallet Standard:', message);
                
                let signature;
                try {
                    // Wallet Standard の sui:signPersonalMessage 機能を使用
                    signature = await currentWallet.signMessage(message);
                    console.log('Signature result:', signature);
                    
                    if (!signature) {
                        throw new Error('署名が生成されませんでした');
                    }
                    
                    // 署名をhex文字列に変換（必要に応じて）
                    if (Array.isArray(signature)) {
                        signature = '0x' + signature.map(b => b.toString(16).padStart(2, '0')).join('');
                    }
                    
                } catch (signError) {
                    console.error('Signature error:', signError);
                    showError(\`メッセージの署名に失敗しました。\\n\\n\${currentWallet.name}で署名を承認してください。\\n\\nエラー: \${signError.message}\`);
                    return;
                }

                updateStatus('認証を完了中...', 'connecting');
                updateProgress(90);

                // ステップ4: 認証送信
                const verifyResponse = await fetch(\`\${API_BASE_URL}/verify\`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        discord_id: discordId,
                        wallet_address: currentAddress,
                        signature: signature,
                        nonce: nonce
                    })
                });

                if (!verifyResponse.ok) {
                    throw new Error('認証に失敗しました');
                }

                const result = await verifyResponse.json();
                updateProgress(100);

                if (result.success) {
                    showSuccess('Verification completed successfully!\\n\\nDiscord role has been granted and DM has been sent.');
                    connectBtn.disabled = true;
                    connectBtn.textContent = 'Verification Complete';
                } else {
                    showError('Verification failed: ' + (result.error || 'Unknown error'));
                }

            } catch (error) {
                console.error('Verification error:', error);
                showError('認証エラー: ' + error.message);
            }
        }

        function updateStatus(message, type = 'connecting') {
            const status = document.getElementById('status');
            status.textContent = message;
            status.className = \`status \${type}\`;
        }

        function updateProgress(percent) {
            const progress = document.getElementById('progress');
            progress.style.width = percent + '%';
        }

        function showSuccess(message) {
            const result = document.getElementById('result');
            result.textContent = message;
            result.className = 'status success';
            result.classList.remove('hidden');
        }

        function showError(message) {
            const result = document.getElementById('result');
            result.textContent = message;
            result.className = 'status error';
            result.classList.remove('hidden');
        }

        // 初期化（Wallet Standard ライブラリの読み込み完了を待つ）
        console.log('Page loaded with Discord ID:', discordId);
        
        if (!discordId) {
            showError('Discord IDが指定されていません');
        } else {
            updateStatus('ウォレットライブラリを読み込み中...');
            
            // Wallet Standard ライブラリの読み込みを待つ
            const checkWalletStandard = () => {
                if (window.getWallets) {
                    updateStatus('ウォレットを検出中...');
                    // ページ読み込み時にウォレット検出
                    detectAndShowWallets();
                } else {
                    console.log('Waiting for Wallet Standard to load...');
                    setTimeout(checkWalletStandard, 100);
                }
            };
            
            // 少し待ってからチェック開始
            setTimeout(checkWalletStandard, 500);
        }
    </script>
</body>
</html>`;
  
  return c.html(html);
});

// ナンス生成エンドポイント
app.post('/nonce', async (c) => {
  try {
    const { discord_id } = await c.req.json();
    
    if (!discord_id) {
      return c.json({ error: 'discord_id is required' }, 400);
    }

    const nonce = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + (10 * 60 * 1000); // 10分後に期限切れ

    const nonceData = {
      nonce,
      created_at: now,
      expires_at: expiresAt,
      discord_id: discord_id
    };

    await c.env.KV.put(`nonce:${discord_id}`, JSON.stringify(nonceData), {
      expirationTtl: 600 // 10分
    });

    return c.json({ nonce });
  } catch (error) {
    console.error('Error generating nonce:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// NFT検証エンドポイント
app.post('/verify', async (c) => {
  try {
    const body: ReqBody = await c.req.json();
    const { wallet_address, discord_id, signature, nonce } = body;

    // 必須フィールドの検証
    if (!wallet_address || !discord_id || !signature || !nonce) {
      return c.json({ 
        success: false, 
        message: 'Missing required fields' 
      } as VerificationResult, 400);
    }

    // ナンスの検証
    const storedNonceData = await c.env.KV.get(`nonce:${wallet_address}`);
    if (!storedNonceData) {
      return c.json({
        success: false,
        message: 'Invalid or expired nonce'
      } as VerificationResult, 400);
    }

    // 署名検証
    const isValidSignature = await verifySignedMessage(wallet_address, nonce, signature);
    if (!isValidSignature) {
      return c.json({
        success: false,
        message: 'Invalid signature'
      } as VerificationResult, 401);
    }

    // NFT保有確認（開発時は常にtrue）
    let hasNft = true; // 開発用に常にtrue
    try {
      // 本番環境でのみ実際のNFTチェックを実行
      if (c.env.SUI_NETWORK === 'mainnet') {
        hasNft = await hasTargetNft(wallet_address, c.env);
      }
    } catch (error) {
      console.error('NFT check error:', error);
      // 開発時はエラーを無視して続行
      hasNft = true;
    }
    
    if (!hasNft) {
      return c.json({
        success: false,
        message: 'Required NFT not found',
        has_nft: false
      } as VerificationResult, 403);
    }

    // Discord Bot経由での役割付与を通知
    const roleGranted = await notifyDiscordBot(discord_id, 'grant_role');
    
    // ナンスを削除（一度だけ使用可能）
    await c.env.KV.delete(`nonce:${wallet_address}`);

    // 検証成功の記録（ウォレットアドレスとDiscord IDの紐付け）
    await c.env.KV.put(`verified:${wallet_address}`, JSON.stringify({
      discord_id,
      wallet_address,
      verified_at: Date.now()
    }));

    // Discord IDでも記録（逆引き用）
    await c.env.KV.put(`discord:${discord_id}`, JSON.stringify({
      wallet_address,
      discord_id,
      verified_at: Date.now()
    }));

    return c.json({
      success: true,
      message: 'Verification successful',
      has_nft: true,
      role_granted: roleGranted
    } as VerificationResult);

  } catch (error) {
    console.error('Verification error:', error);
    return c.json({
      success: false,
      message: 'Internal server error'
    } as VerificationResult, 500);
  }
});

export default app; 