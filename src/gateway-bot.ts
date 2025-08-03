import { DiscordGatewayBot } from './lib/discord-gateway';

async function startGatewayBot() {
  const token = process.env.DISCORD_TOKEN;
  
  if (!token) {
    console.error('DISCORD_TOKEN environment variable is required');
    process.exit(1);
  }

  const bot = new DiscordGatewayBot(token);
  
  console.log('Starting Discord Gateway Bot...');
  await bot.connect();
  
  // プロセス終了時の処理
  process.on('SIGINT', () => {
    console.log('Shutting down Gateway Bot...');
    bot.disconnect();
    process.exit(0);
  });
}

startGatewayBot().catch(console.error); 