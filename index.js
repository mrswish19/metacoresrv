const { createClient } = require('bedrock-protocol');
const behaviorManager = require('./behaviors/behaviorManager');

// Connect to local Survival server
const bot = createClient({
  host: 'kupaleros-rg1D.aternos.me',       // Local server
  port: 40915,             // Default Bedrock port
  username: 'BotNoxell',
  offline: true,           // Offline mode
  version: '1.21.120'
});

bot.on('spawn', () => {
  console.log('Bot spawned! Starting AI behaviors...');
  behaviorManager(bot);
});

bot.on('error', err => console.log('Bot error:', err));
bot.on('kick', packet => console.log('Kicked:', packet.reason));
bot.on('text', packet => console.log(`[Server] ${packet.message}`));
