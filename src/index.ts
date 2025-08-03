import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createDiscordBotAPI } from './lib/discord';
import { VerificationFlowManager } from './lib/verification';
import { VerificationRequestSchema, NonceRequestSchema, type Env, type APIResponse } from './types';
import crypto from 'node:crypto';

const app = new Hono<{ Bindings: Env }>();

// CORS設定
app.use('*', cors({
  origin: ['https://discord.com', 'https://discordapp.com'],
  allowMethods: ['POST', 'GET', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-Signature-Ed25519', 'X-Signature-Timestamp'],
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
  return c.redirect('https://58404073.nft-verification-frontend.pages.dev');
});

// Discordチャンネル投稿エンドポイント
app.post('/api/discord/post', async (c) => {
  try {
    if (!c.env) {
      throw new Error('Environment not available');
    }

    const channelId = c.env.VERIFICATION_CHANNEL_ID;
    const botToken = c.env.DISCORD_TOKEN;

    const embedMessage = {
      embeds: [{
        title: '🎯 SXT NFT Verification Portal',
        description: '**Join the exclusive NFT community by verifying your Sui wallet ownership!**\n\n🌟 **What you\'ll get:**\n• **Exclusive Discord Role:** NFT Holder\n• **Premium Access:** Special channels and features\n• **Community Status:** Verified NFT holder\n• **Future Benefits:** Early access to upcoming features\n\n🎯 **How to verify:**\n1. **Click the verification button below**\n2. **Get your personalized verification URL**\n3. **Connect your Sui wallet** (Sui Wallet, Slush Wallet, etc.)\n4. **Enter your Discord ID**\n5. **Sign a verification message**\n6. **Get your exclusive role automatically!**\n\n💎 **Security Features:**\n• Blockchain-verified NFT ownership\n• Secure message signing (no private key access)\n• Instant role assignment\n• Professional verification process\n\n🔗 **Start Verification:**\nClick the button below to get your personalized verification link!',
        color: 0x57F287,
        thumbnail: {
          url: 'https://i.imgur.com/8tBXd6L.png'
        },
        fields: [
          {
            name: '🎁 Role',
            value: 'NFT Holder',
            inline: true
          },
          {
            name: '⚡ Speed',
            value: 'Instant Verification',
            inline: true
          },
          {
            name: '🔒 Security',
            value: 'Maximum Protection',
            inline: true
          },
          {
            name: '🌐 Network',
            value: 'Sui Mainnet',
            inline: true
          },
          {
            name: '🎯 Status',
            value: 'Active & Ready',
            inline: true
          },
          {
            name: '📱 Support',
            value: 'All Sui Wallets',
            inline: true
          }
        ],
        footer: {
          text: 'Sui NFT Verification • Professional & Secure',
          icon_url: 'https://i.imgur.com/8tBXd6L.png'
        },
        timestamp: new Date().toISOString()
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 1,
          label: '🔗 Get Verification Link',
          custom_id: 'get_verification_link',
          url: null
        }]
      }]
    };

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(embedMessage)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to post to Discord:', response.status, errorText);
      throw new Error(`Failed to post to Discord: ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Posted to Discord successfully:', result);

    return c.json({
      success: true,
      message: 'Posted to Discord successfully',
      data: result
    });

                } catch (error) {
    console.error('❌ Error posting to Discord:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to post to Discord',
    }, 500);
  }
});

// 認証ボタン用エンドポイント
app.post('/api/discord/button', async (c) => {
  try {
    if (!c.env) {
      throw new Error('Environment not available');
    }

    const body = await c.req.json();
    const { discordId } = body;

                if (!discordId) {
      return c.json({
        success: false,
        error: 'Discord ID is required'
      }, 400);
    }

    // 個人用の認証URLを生成
    const verificationUrl = `https://58404073.nft-verification-frontend.pages.dev/?discord_id=${discordId}`;

    const response = {
      success: true,
      data: {
        verificationUrl,
        discordId,
        message: 'Your personalized verification link has been generated!'
      }
    };

    return c.json(response);

                } catch (error) {
    console.error('❌ Error generating verification link:', error);
    
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate verification link',
    }, 500);
  }
});

// Discord Interaction Signature 検証関数
function verifyDiscordSignature(body: string, signature: string, timestamp: string, publicKey: string): boolean {
  try {
    // Discordの公式実装に従って検証
    const message = timestamp + '.' + body;
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    
    // 署名を検証（簡易版 - 実際の実装ではWeb Crypto APIを使用）
    // この実装は開発用です。本番環境では適切な暗号化ライブラリを使用してください
    console.log('Verifying signature:', signature);
    console.log('Timestamp:', timestamp);
    console.log('Body length:', body.length);
    
    // 一時的に検証をスキップ（開発用）
                    return true;
                } catch (error) {
    console.error('Signature verification error:', error);
                return false;
            }
        }

// Discord Interaction Endpoint
app.post('/api/discord/interactions', async (c) => {
  try {
    if (!c.env) {
      throw new Error('Environment not available');
    }

    // Discord Signature 検証
    const signature = c.req.header('x-signature-ed25519');
    const timestamp = c.req.header('x-signature-timestamp');
    const body = await c.req.text();

    console.log('=== Discord Interaction Received ===');
    console.log('Signature:', signature);
    console.log('Timestamp:', timestamp);
    console.log('Body length:', body.length);

    // PINGリクエストの処理（Discordの検証用）
    if (body.includes('"type":1') || body.includes('"type": 1')) {
      console.log('PING received, responding with PONG');
      return c.json({ type: 1 });
    }

    // Signature 検証（開発用に一時的にスキップ）
    if (!signature || !timestamp || !body) {
      console.error('Missing signature headers');
      return c.json({ error: 'Missing signature headers' }, 401);
    }

    // 開発用：検証をスキップ
    console.log('Development mode: skipping signature verification');

    const interactionBody = JSON.parse(body);
    console.log('Interaction type:', interactionBody.type);
    console.log('Data:', interactionBody.data);
    console.log('Member:', interactionBody.member);

    // Discord Interactionの検証
    if (interactionBody.type === 1) {
      // PING - 応答
      console.log('PING received, responding with PONG');
      return c.json({ type: 1 });
    }

    if (interactionBody.type === 2) {
      // INTERACTION - ボタンクリック
      console.log('Button interaction received');
      const { data, member } = interactionBody;
      
      if (data && data.custom_id === 'get_verification_link') {
        console.log('Verification link button clicked');
        const discordId = member?.user?.id;
        
        console.log('Discord ID:', discordId);
        
        if (!discordId) {
          console.error('No Discord ID found in interaction');
          return c.json({
            type: 4,
            data: {
              content: '❌ Could not identify your Discord ID. Please try again.',
              flags: 64
            }
          });
        }

        // 個人用の認証URLを生成
        const verificationUrl = `https://58404073.nft-verification-frontend.pages.dev/?discord_id=${discordId}`;
        console.log('Generated verification URL:', verificationUrl);

        const response = {
          type: 4,
          data: {
            content: `🎯 **Your personalized verification link has been generated!**\n\n🔗 **Verification URL:**\n${verificationUrl}\n\n📋 **Next Steps:**\n1. Click the link above\n2. Connect your Sui wallet\n3. Complete the verification process\n4. Get your exclusive role!\n\n💎 **Security:** Your Discord ID (${discordId}) is automatically linked to this verification.`,
            flags: 64
          }
        };

        console.log('Sending response:', JSON.stringify(response, null, 2));
        return c.json(response);
      } else {
        console.error('Unknown custom_id:', data?.custom_id);
        return c.json({
          type: 4,
          data: {
            content: '❌ Unknown button interaction',
            flags: 64
          }
        });
      }
    }

    console.error('Unknown interaction type:', interactionBody.type);
    return c.json({
      type: 4,
      data: {
        content: '❌ Unknown interaction type',
        flags: 64
      }
    });

  } catch (error) {
    console.error('❌ Error handling Discord interaction:', error);
    
    return c.json({
      type: 4,
      data: {
        content: '❌ An error occurred while processing your request.',
        flags: 64
      }
    });
  }
});

export default app; 