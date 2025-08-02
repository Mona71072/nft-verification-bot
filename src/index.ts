import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { VerificationFlowManager } from './lib/verification';
import { createDiscordBotAPI } from './lib/discord';
import { VerificationRequestSchema, NonceRequestSchema, type Env, type APIResponse } from './types';

const app = new Hono<{ Bindings: Env }>();

// CORS設定
app.use('*', cors({
  origin: ['http://localhost:3000', 'https://nft-verification-production.mona-syndicatextokyo.workers.dev'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ヘルスチェック
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
  });
});

// ナンス生成エンドポイント
app.post('/api/nonce', async (c) => {
  try {
    const body = await c.req.json();
    const validation = NonceRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.errors
      }, 400);
    }

    const { discordId, address } = validation.data;
    
    console.log('🔑 Generating nonce for:', { discordId, address });

    if (!c.env) {
      throw new Error('Environment not available');
    }

    const verificationManager = new VerificationFlowManager(c.env);
    const nonce = await verificationManager.generateNonce(discordId, address);

    const response: APIResponse<{ nonce: string }> = {
      success: true,
      data: { nonce },
      message: 'Nonce generated successfully',
    };

    return c.json(response);
  } catch (error) {
    console.error('❌ Error generating nonce:', error);
    
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate nonce',
    };

    return c.json(response, 500);
  }
});

// NFT検証エンドポイント
app.post('/api/verify', async (c) => {
  try {
    const body = await c.req.json();
    const validation = VerificationRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return c.json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.errors
      }, 400);
    }

    const request = validation.data;
    
    console.log('🔍 Starting NFT verification:', {
      address: request.address,
      discordId: request.discordId,
    });

    if (!c.env) {
      throw new Error('Environment not available');
    }

    const verificationManager = new VerificationFlowManager(c.env);
    const result = await verificationManager.verifyNFTOwnership(request);

    if (result.success) {
      // Discordロール付与
      const discordAPI = createDiscordBotAPI(c.env.DISCORD_TOKEN, c.env.API_BASE_URL);
      const roleResult = await discordAPI.processRoleAssignment(
        request.discordId,
        request.address,
        c.env.DISCORD_ROLE_ID,
        c.env.DISCORD_TOKEN
      );

      if (roleResult.success) {
        // 成功時のレスポンス
        const response: APIResponse<{
          discordId: string;
          address: string;
          roleName: string;
          nftCount: number;
        }> = {
          success: true,
          data: {
            discordId: request.discordId,
            address: request.address,
            roleName: roleResult.roleName || 'NFT Holder',
            nftCount: result.nftCount || 0,
          },
          message: 'NFT verification and role assignment completed successfully',
        };

        return c.json(response);
      } else {
        // ロール付与失敗時のレスポンス
        const response: APIResponse = {
          success: false,
          error: 'NFT verification succeeded but role assignment failed',
          message: roleResult.message,
        };

        return c.json(response, 500);
      }
    } else {
      // 検証失敗時のレスポンス
      const response: APIResponse = {
        success: false,
        error: result.message,
      };

      return c.json(response, 400);
    }
  } catch (error) {
    console.error('❌ Error in verification:', error);
    
    const response: APIResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };

    return c.json(response, 500);
  }
});

// プロフェッショナルなUIを提供するメインページ
app.get('/', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sui NFT Verification - Professional</title>
    <link rel="icon" type="image/x-icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🪙</text></svg>">
    <script src="https://unpkg.com/@mysten/wallet-standard@latest/dist/index.js"></script>
    <script src="https://unpkg.com/@mysten/sui.js@latest/dist/index.js"></script>
    <script>
        // Wallet Standard APIの初期化を待つ
        function waitForWalletStandard() {
            return new Promise((resolve, reject) => {
                let attempts = 0;
                const maxAttempts = 100; // 10秒間試行
            
                const checkWallet = () => {
                    attempts++;
                    console.log('Checking for Wallet Standard API... (attempt ' + attempts + ')');
                    console.log('window object:', window);
                    console.log('getWallets function exists:', typeof getWallets === 'function');
                    
                    // Wallet Standard APIの存在確認
                    if (typeof getWallets === 'function') {
                        console.log('Wallet Standard API found!');
                        try {
                            const wallets = getWallets().get();
                            console.log('Available wallets:', wallets);
                            console.log('Number of wallets:', wallets.length);
                            resolve(wallets);
                        } catch (error) {
                            console.error('Error getting wallets:', error);
                            reject(error);
                        }
                    } else if (attempts >= maxAttempts) {
                        console.error('Wallet Standard API not found after 10 seconds');
                        reject(new Error('Wallet Standard API not found after 10 seconds'));
                    } else {
                        setTimeout(checkWallet, 100);
                    }
                };
                
                checkWallet();
            });
        }

        // 追加のデバッグ機能
        function debugWalletStandard() {
            console.log('=== Wallet Standard Debug Information ===');
            console.log('getWallets function exists:', typeof getWallets === 'function');
            
            if (typeof getWallets === 'function') {
                try {
                    const wallets = getWallets().get();
                    console.log('Available wallets:', wallets);
                    console.log('Number of wallets:', wallets.length);
                    
                    wallets.forEach((wallet, index) => {
                        console.log('Wallet ' + (index + 1) + ':', {
                            name: wallet.name,
                            icon: wallet.icon,
                            version: wallet.version,
                            chains: wallet.chains,
                            features: Object.keys(wallet.features),
                            accounts: wallet.accounts
                        });
                    });
                } catch (error) {
                    console.error('Error in debugWalletStandard:', error);
                }
            }
            
            // グローバルオブジェクトの確認
            console.log('Global objects containing "wallet":', Object.keys(window).filter(key => key.toLowerCase().includes('wallet')));
            console.log('Global objects containing "sui":', Object.keys(window).filter(key => key.toLowerCase().includes('sui')));
            
            console.log('=== End Debug Information ===');
        }

        // DOMContentLoadedイベントでも初期化を試行
        document.addEventListener('DOMContentLoaded', () => {
            console.log('DOMContentLoaded event fired');
            console.log('DOMContentLoaded debug check:');
            debugWalletStandard();
        });

        // 代替のウォレット検出方法
        function detectWalletAlternative() {
            console.log('=== Alternative Wallet Detection ===');
            
            // 様々な可能性のあるAPI名をチェック
            const possibleAPIs = [
                'getWallets',
                'window.getWallets',
                'window.walletStandard',
                'window.suiWallet',
                'window.slushWallet',
                'window.suiWalletStandard',
                'window.slushWalletStandard'
            ];
            
            possibleAPIs.forEach(apiName => {
                try {
                    const api = eval(apiName);
                    console.log(apiName + ' exists:', !!api);
                    console.log(apiName + ' type:', typeof api);
                    if (api && typeof api === 'function') {
                        console.log(apiName + ' is a function!');
                        try {
                            const result = api();
                            console.log(apiName + ' result:', result);
                        } catch (error) {
                            console.log(apiName + ' execution error:', error.message);
                        }
                    }
                } catch (error) {
                    console.log(apiName + ' error:', error.message);
                }
            });
            
            console.log('=== End Alternative Detection ===');
        }
    </script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #333;
        }

        .container {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            padding: 48px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            max-width: 500px;
            width: 90%;
            position: relative;
            overflow: hidden;
        }

        .container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #667eea, #764ba2);
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
        }

        .logo {
            font-size: 32px;
            margin-bottom: 16px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .title {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 8px;
            color: #1a1a1a;
        }

        .subtitle {
            font-size: 16px;
            color: #666;
            line-height: 1.5;
        }

        .step {
            background: #f8fafc;
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
            border: 1px solid #e2e8f0;
            transition: all 0.3s ease;
        }

        .step.active {
            border-color: #667eea;
            background: #f0f4ff;
        }

        .step.completed {
            border-color: #10b981;
            background: #f0fdf4;
        }

        .step-header {
            display: flex;
            align-items: center;
            margin-bottom: 16px;
        }

        .step-number {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: #e2e8f0;
            color: #64748b;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            margin-right: 12px;
            transition: all 0.3s ease;
        }

        .step.active .step-number {
            background: #667eea;
            color: white;
        }

        .step.completed .step-number {
            background: #10b981;
            color: white;
        }

        .step-title {
            font-weight: 600;
            color: #1a1a1a;
        }

        .step-description {
            color: #666;
            font-size: 14px;
            margin-top: 4px;
        }

        .wallet-info {
            background: #f1f5f9;
            border-radius: 12px;
            padding: 16px;
            margin-top: 16px;
            border: 1px solid #e2e8f0;
        }

        .wallet-address {
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 12px;
            color: #64748b;
            word-break: break-all;
        }

        .btn {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            border-radius: 12px;
            padding: 16px 24px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }

        .btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }

        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }

        .btn.secondary {
            background: #f1f5f9;
            color: #64748b;
            border: 1px solid #e2e8f0;
        }

        .btn.secondary:hover:not(:disabled) {
            background: #e2e8f0;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .input-group {
            margin-bottom: 16px;
        }

        .input-label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #374151;
        }

        .input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            font-size: 16px;
            transition: all 0.3s ease;
            background: white;
        }

        .input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .alert {
            padding: 16px;
            border-radius: 12px;
            margin-top: 16px;
            font-size: 14px;
        }

        .alert.success {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            color: #166534;
        }

        .alert.error {
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #dc2626;
        }

        .alert.info {
            background: #eff6ff;
            border: 1px solid #bfdbfe;
            color: #1e40af;
        }

        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .hidden {
            display: none;
        }

        .flex {
            display: flex;
        }

        .items-center {
            align-items: center;
        }

        .justify-between {
            justify-content: space-between;
        }

        .gap-2 {
            gap: 8px;
        }

        .mt-4 {
            margin-top: 16px;
        }

        .mb-4 {
            margin-bottom: 16px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎯</div>
            <h1 class="title">Sui NFT Verification Portal</h1>
            <p class="subtitle">Join the exclusive NFT community by verifying your Sui wallet ownership</p>
        </div>

        <!-- Step 1: Wallet Connection -->
        <div class="step" id="step1">
            <div class="step-header">
                <div class="step-number">1</div>
                <div>
                    <div class="step-title">Connect Wallet</div>
                    <div class="step-description">Securely connect your Sui wallet to verify NFT ownership</div>
                </div>
            </div>
            <button class="btn" id="connectBtn" onclick="connectWallet()">
                <span>🔗</span>
                <span>Connect Wallet</span>
            </button>
            <div class="wallet-info hidden" id="walletInfo">
                <div class="flex items-center justify-between">
                    <span>Connected:</span>
                    <span class="wallet-address" id="walletAddress"></span>
                </div>
                <button class="btn secondary mt-4" onclick="disconnectWallet()">
                    <span>🔌</span>
                    <span>Disconnect</span>
                </button>
            </div>
        </div>

        <!-- Step 2: Discord ID Input -->
        <div class="step" id="step2">
            <div class="step-header">
                <div class="step-number">2</div>
                <div>
                    <div class="step-title">Enter Discord ID</div>
                    <div class="step-description">Enter your Discord ID to receive your exclusive role</div>
                </div>
            </div>
            <div class="input-group">
                <label class="input-label" for="discordId">Discord ID</label>
                <input type="text" id="discordId" class="input" placeholder="123456789012345678" required>
            </div>
        </div>

        <!-- Step 3: Verification -->
        <div class="step" id="step3">
            <div class="step-header">
                <div class="step-number">3</div>
                <div>
                    <div class="step-title">Verify NFT Ownership</div>
                    <div class="step-description">Sign a message to confirm your NFT ownership securely</div>
                </div>
            </div>
            <button class="btn" id="verifyBtn" onclick="verifyNFT()" disabled>
                <span>🔐</span>
                <span>Start Verification</span>
            </button>
        </div>

        <!-- Results -->
        <div id="results"></div>
    </div>

    <script>
        let wallet = null;
        let walletAddress = '';
        let currentNonce = '';

        // ウォレット接続
        async function connectWallet() {
            const connectBtn = document.getElementById('connectBtn');
            const originalText = connectBtn.innerHTML;
            
            try {
                connectBtn.disabled = true;
                connectBtn.innerHTML = '<span class="loading"></span><span>Connecting...</span>';

                // Wallet Standard APIの存在確認
                console.log('Checking Wallet Standard API...');
                console.log('getWallets function exists:', typeof getWallets === 'function');
                
                if (typeof getWallets !== 'function') {
                    throw new Error('Wallet Standard API is not available. Please install a compatible wallet extension.');
                }

                // 利用可能なウォレットを取得
                const wallets = getWallets().get();
                console.log('Available wallets:', wallets);

                if (wallets.length === 0) {
                    throw new Error('No wallets found. Please make sure your wallet is unlocked and has accounts.');
                }

                // 最初のウォレットを選択
                const selectedWallet = wallets[0];
                console.log('Selected wallet:', selectedWallet);

                // ウォレットの機能を確認
                if (!selectedWallet.features['standard:connect']) {
                    throw new Error('This wallet does not support connection feature.');
                }

                // ウォレットに接続
                console.log('Connecting to wallet...');
                await selectedWallet.features['standard:connect'].connect();
                console.log('Wallet connected successfully');

                // アカウント情報を取得
                if (selectedWallet.accounts.length === 0) {
                    throw new Error('No accounts found in wallet. Please make sure your wallet has accounts.');
                }

                wallet = selectedWallet;
                walletAddress = selectedWallet.accounts[0].address;
                console.log('Wallet address:', walletAddress);

                // UI更新
                updateStepStatus('step1', 'completed');
                document.getElementById('walletAddress').textContent = walletAddress;
                document.getElementById('walletInfo').classList.remove('hidden');
                document.getElementById('verifyBtn').disabled = false;

                connectBtn.innerHTML = '<span>✅</span><span>Connected</span>';
                connectBtn.classList.add('secondary');

                showAlert('✅ Wallet connected successfully!', 'success');

            } catch (error) {
                console.error('Wallet connection error:', error);
                showAlert('❌ Wallet connection error: ' + error.message, 'error');

                connectBtn.disabled = false;
                connectBtn.innerHTML = originalText;
            }
        }

        // ウォレット切断
        async function disconnectWallet() {
            if (wallet && wallet.features['standard:disconnect']) {
                try {
                    await wallet.features['standard:disconnect'].disconnect();
                } catch (error) {
                    console.error('Disconnect error:', error);
                }
            }

            wallet = null;
            walletAddress = '';

            updateStepStatus('step1', 'active');
            document.getElementById('walletInfo').classList.add('hidden');
            document.getElementById('verifyBtn').disabled = true;

            const connectBtn = document.getElementById('connectBtn');
            connectBtn.innerHTML = '<span>🔗</span><span>Connect Wallet</span>';
            connectBtn.classList.remove('secondary');

            showAlert('Wallet disconnected successfully.', 'info');
        }

        // NFT認証
        async function verifyNFT() {
            try {
                const discordId = document.getElementById('discordId').value.trim();
                if (!discordId) {
                    showAlert('❌ Please enter your Discord ID.', 'error');
                    return;
                }

                if (!wallet || !walletAddress) {
                    showAlert('❌ Wallet is not connected.', 'error');
                    return;
                }

                const verifyBtn = document.getElementById('verifyBtn');
                const originalText = verifyBtn.innerHTML;
                
                verifyBtn.disabled = true;
                verifyBtn.innerHTML = '<span class="loading"></span><span>Verifying...</span>';

                // ナンス生成
                const nonceResponse = await fetch('/api/nonce', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        discordId: discordId,
                        address: walletAddress
                    })
                });

                const nonceData = await nonceResponse.json();
                if (!nonceData.success) {
                    throw new Error(nonceData.error || 'Failed to generate nonce.');
                }

                currentNonce = nonceData.data.nonce;

                // 署名メッセージの生成
                const message = \`Verify NFT ownership for Discord role assignment.

Discord ID: \${discordId}
Wallet Address: \${walletAddress}
Nonce: \${currentNonce}
Timestamp: \${new Date().toISOString()}

By signing this message, you confirm that you own the specified NFT and authorize the role assignment.\`;

                console.log('Signing message:', message);

                // 署名機能の確認
                if (!wallet.features['sui:signMessage']) {
                    throw new Error('This wallet does not support message signing.');
                }

                // メッセージを署名
                const signature = await wallet.features['sui:signMessage'].signMessage({
                    message: new TextEncoder().encode(message)
                });

                console.log('Signature received:', signature);

                // バックエンドに送信
                const response = await fetch('/api/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        signature: signature,
                        address: walletAddress,
                        discordId: discordId,
                        nonce: currentNonce,
                        message: message,
                        walletType: wallet.name
                    })
                });

                const data = await response.json();

                if (data.success) {
                    updateStepStatus('step3', 'completed');
                    showAlert(\`✅ Verification completed! Role "\${data.data.roleName}" has been assigned to your account.\`, 'success');
                } else {
                    showAlert('❌ ' + (data.error || 'Verification failed.'), 'error');
                }

            } catch (error) {
                console.error('Verification error:', error);
                showAlert('❌ An error occurred: ' + error.message, 'error');
            } finally {
                const verifyBtn = document.getElementById('verifyBtn');
                verifyBtn.disabled = false;
                verifyBtn.innerHTML = originalText;
            }
        }

        // ステップ状態の更新
        function updateStepStatus(stepId, status) {
            const step = document.getElementById(stepId);
            step.className = 'step ' + status;
        }

        // アラート表示
        function showAlert(message, type) {
            const resultsDiv = document.getElementById('results');
            const alertDiv = document.createElement('div');
            alertDiv.className = \`alert \${type}\`;
            alertDiv.textContent = message;
            
            resultsDiv.innerHTML = '';
            resultsDiv.appendChild(alertDiv);

            // 5秒後に自動削除
            setTimeout(() => {
                alertDiv.remove();
            }, 5000);
        }

        // ページ読み込み時の初期化
        window.addEventListener('load', () => {
            console.log('NFT Verification Portal v2.0 loaded');
            console.log('Starting initialization...');
            
            // URLパラメータからDiscord IDを取得
            const urlParams = new URLSearchParams(window.location.search);
            const discordId = urlParams.get('discord_id');
            if (discordId) {
                document.getElementById('discordId').value = discordId;
            }

            // 即座にデバッグ情報を出力
            console.log('Initial debug check:');
            debugWalletStandard();
            detectWalletAlternative();

            // Wallet Standard APIの初期化を待つ
            waitForWalletStandard()
                .then((wallets) => {
                    console.log('Wallet Standard API is ready.');
                    console.log('Available wallets:', wallets);
                    // ウォレット接続ボタンを有効化
                    const connectBtn = document.getElementById('connectBtn');
                    if (connectBtn) {
                        connectBtn.disabled = false;
                        connectBtn.innerHTML = '<span>🔗</span><span>Connect Wallet</span>';
                        connectBtn.classList.remove('secondary');
                    }
                })
                .catch(error => {
                    console.error('Wallet Standard API not found after 10 seconds. Please ensure a compatible wallet extension is installed and unlocked.');
                    console.error('Final debug check:');
                    debugWalletStandard();
                    detectWalletAlternative();
                    showAlert('No compatible wallet extension found. Please install a Sui-compatible wallet extension.', 'error');
                });

            // 5秒後に再度デバッグ情報を出力
            setTimeout(() => {
                console.log('5-second delayed debug check:');
                debugWalletStandard();
                detectWalletAlternative();
            }, 5000);
        });
    </script>
</body>
</html>
  `);
});

export default app; 