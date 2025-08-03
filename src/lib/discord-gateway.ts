import { WebSocket } from 'ws';

export class DiscordGatewayBot {
  private ws: WebSocket | null = null;
  private token: string;
  private heartbeatInterval: number = 0;
  private sequence: number | null = null;

  constructor(token: string) {
    this.token = token;
  }

  async connect() {
    try {
      // Gateway URLを取得
      const response = await fetch('https://discord.com/api/v10/gateway');
      const gatewayData = await response.json();
      
      // WebSocket接続
      this.ws = new WebSocket(`${gatewayData.url}/?v=10&encoding=json`);
      
      this.ws.on('open', () => {
        console.log('Gateway connected');
        this.identify();
      });

      this.ws.on('message', (data) => {
        const payload = JSON.parse(data.toString());
        this.handleMessage(payload);
      });

      this.ws.on('close', () => {
        console.log('Gateway disconnected');
        // 再接続ロジック
        setTimeout(() => this.connect(), 5000);
      });

    } catch (error) {
      console.error('Gateway connection error:', error);
    }
  }

  private identify() {
    const identifyPayload = {
      op: 2,
      d: {
        token: this.token,
        properties: {
          os: 'linux',
          browser: 'DiscordBot',
          device: 'DiscordBot'
        },
        intents: 513 // MESSAGE_CONTENT + GUILD_MESSAGES
      }
    };
    
    this.ws?.send(JSON.stringify(identifyPayload));
  }

  private handleMessage(payload: any) {
    console.log('Received payload:', payload);

    switch (payload.op) {
      case 10: // Hello
        this.heartbeatInterval = payload.d.heartbeat_interval;
        this.startHeartbeat();
        break;
      
      case 0: // Dispatch
        this.sequence = payload.s;
        this.handleDispatch(payload);
        break;
      
      case 11: // Heartbeat ACK
        console.log('Heartbeat ACK received');
        break;
    }
  }

  private handleDispatch(payload: any) {
    switch (payload.t) {
      case 'INTERACTION_CREATE':
        this.handleInteraction(payload.d);
        break;
      
      case 'MESSAGE_CREATE':
        this.handleMessageCreate(payload.d);
        break;
    }
  }

  private handleInteraction(interaction: any) {
    console.log('=== Handling Interaction ===');
    console.log('Interaction type:', interaction.type);
    console.log('Custom ID:', interaction.data?.custom_id);
    console.log('User ID:', interaction.member?.user?.id);
    
    if (interaction.type === 3 && interaction.data?.custom_id === 'get_verification_link') {
      console.log('✅ Verification link button clicked');
      const discordId = interaction.member?.user?.id;
      
      console.log('Discord ID:', discordId);
      
      if (discordId) {
        const verificationUrl = `https://523854d2.nft-verification-frontend.pages.dev/?discord_id=${discordId}`;
        console.log('Generated verification URL:', verificationUrl);

        const response = {
          type: 4,
          data: {
            content: `🎯 **Your personalized verification link has been generated!**\n\n🔗 **Verification URL:**\n${verificationUrl}\n\n📋 **Next Steps:**\n1. Click the link above\n2. Connect your Sui wallet\n3. Complete the verification process\n4. Get your exclusive role!\n\n💎 **Security:** Your Discord ID (${discordId}) is automatically linked to this verification.`,
            flags: 64
          }
        };

        console.log('Sending response:', JSON.stringify(response, null, 2));
        
        // 応答を送信
        this.respondToInteraction(interaction.id, interaction.token, response);
      } else {
        console.error('❌ No Discord ID found in interaction');
      }
    } else {
      console.log('❌ Unknown interaction type or custom_id');
      console.log('Interaction type:', interaction.type);
      console.log('Custom ID:', interaction.data?.custom_id);
    }
  }

  private async respondToInteraction(interactionId: string, interactionToken: string, response: any) {
    try {
      const url = `https://discord.com/api/v10/interactions/${interactionId}/${interactionToken}/callback`;
      
      console.log('Sending interaction response to:', url);
      console.log('Response data:', JSON.stringify(response, null, 2));
      
      const result = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${this.token}`
        },
        body: JSON.stringify(response)
      });
      
      console.log('Response status:', result.status);
      console.log('Response headers:', result.headers);
      
      if (!result.ok) {
        const errorText = await result.text();
        console.error('Error response:', errorText);
      } else {
        console.log('Interaction response sent successfully');
      }
    } catch (error) {
      console.error('Error responding to interaction:', error);
    }
  }

  private handleMessageCreate(message: any) {
    console.log('Message received:', message.content);
  }

  private startHeartbeat() {
    if (this.heartbeatInterval > 0) {
      setInterval(() => {
        const heartbeatPayload = {
          op: 1,
          d: this.sequence
        };
        
        this.ws?.send(JSON.stringify(heartbeatPayload));
        console.log('Heartbeat sent');
      }, this.heartbeatInterval);
    }
  }

  disconnect() {
    this.ws?.close();
  }
} 