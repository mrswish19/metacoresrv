const { createClient } = require('bedrock-protocol');
const behaviorManager = require('./behaviors/behaviorManager');

const bot = createClient({
  host: 'kupaleros-rg1D.aternos.me',
  port: 40915,
  auth: 'microsoft',   // Microsoft login (device code flow)
  version: '1.21.120'
});

bot.on('spawn', () => {
  console.log('✅ Bot spawned successfully! Starting AI behaviors...');
  behaviorManager(bot);
});

bot.on('text', packet => console.log(`[Server] ${packet.message}`));
bot.on('kick', packet => console.log('❌ Kicked:', packet.reason));
bot.on('error', err => console.log('⚠️ Bot error:', err));
