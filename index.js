const { createClient } = require('bedrock-protocol');
const behaviorManager = require('./behaviors/behaviorManager');

// Xbox / Microsoft credentials
const xboxEmail = 'sealgaildelarosa20@gmail.com';
const xboxPassword = 'Codezyy@72443';

// Create bot
const bot = createClient({
  host: 'kupaleros-rg1D.aternos.me',
  port: 40915,
  username: sealgaildelarosa20@gmail.com,    // Email is used for Xbox auth
  password: Codezyy@72443, // Xbox password
  version: '1.21.120',   // Minecraft Bedrock version
  auth: 'microsoft'      // Use Microsoft login
});

// Bot spawned
bot.on('spawn', () => {
  console.log('Bot spawned! Starting AI behaviors...');
  behaviorManager(bot);
});

// Optional server logging
bot.on('text', packet => console.log(`[Server] ${packet.message}`));
bot.on('error', err => console.log('Bot error:', err));
bot.on('kick', packet => console.log('Kicked:', packet.reason));
