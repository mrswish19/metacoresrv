const { createClient } = require('bedrock-protocol');
const express = require('express');
const behaviorManager = require('./behaviors/behaviorManager');

// Express server to keep alive
const app = express();
app.get('/', (_, res) => res.send('Bot is alive!'));
app.listen(3000, () => console.log('Keep-alive server running on port 3000'));

// Create bot
const bot = createClient({
  host: 'kupaleros-rg1D.aternos.me',
  port: 40915,
  username: 'Noxell',
  offline: true,
  version: '1.21.120'
});

// Start behaviors when spawned
bot.on('spawn', () => {
  console.log('Bot spawned! Starting AI behaviors...');
  behaviorManager(bot); // handles walking, pathing, safety, etc.
});

bot.on('text', (packet) => console.log(`[Server] ${packet.message}`));
bot.on('error', (err) => console.error('Bot error:', err));
bot.on('kick', (packet) => console.log('Kicked from server:', packet.reason));
