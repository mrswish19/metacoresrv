const { createClient } = require('bedrock-protocol');
const http = require('http');

/* ======================
   CONFIG
   ====================== */
const BASE_CONFIG = {
  host: 'metacoresrv.aternos.me',
  port: 36614,
  offline: true,
  version: '1.21.130'
};

const BOT_A = { ...BASE_CONFIG, username: 'Noxell' };
const BOT_B = { ...BASE_CONFIG, username: 'Noxell_2' };

const RECONNECT_DELAY = 3 * 1000; // 3 seconds

/* ======================
   STATE
   ====================== */
let afkIntervals = {};
let reconnectTimers = {};
let bots = {};

/* ======================
   CREATE BOT
   ====================== */
function createBot(config, name) {
  console.log(`🚀 Starting ${name}...`);
  const bot = createClient(config);
  bots[name] = bot;

  bot.on('spawn', () => {
    console.log(`✅ ${name} spawned (AFK SAFE)`);
    startAfkLoop(bot, name);
  });

  bot.on('text', p => {
    console.log(`[${name}] ${p.message}`);
  });

  const handleDisconnect = (reason) => {
    console.log(`🔄 ${name} reconnecting in 3s... Reason:`, reason);

    clearTimeout(reconnectTimers[name]);
    reconnectTimers[name] = setTimeout(() => {
      bots[name] = createBot(config, name);
    }, RECONNECT_DELAY);
  };

  bot.on('kick', p => handleDisconnect(p.reason));
  bot.on('error', e => handleDisconnect(e.message));

  return bot;
}

/* ======================
   100% AFK SAFE LOOP
   ====================== */
function startAfkLoop(bot, name) {
  if (afkIntervals[name]) clearInterval(afkIntervals[name]);

  afkIntervals[name] = setInterval(() => {
    if (!bot?.entity?.runtime_id || !bot?.entity?.position) return;

    // Minimal keep-alive (sneak pulse)
    bot.queue('player_action', {
      runtime_id: bot.entity.runtime_id,
      action: 1, // START_SNEAK
      position: bot.entity.position,
      result_position: bot.entity.position
    });

    setTimeout(() => {
      bot.queue('player_action', {
        runtime_id: bot.entity.runtime_id,
        action: 2, // STOP_SNEAK
        position: bot.entity.position,
        result_position: bot.entity.position
      });
    }, 250);

    console.log(`[AFK] ${name} keep-alive pulse`);
  }, 90 * 1000);
}

/* ======================
   START BOTH BOTS
   ====================== */
function startBothBots() {
  createBot(BOT_A, 'BOT_A');
  
  // Start Bot B after 2 minutes
  setTimeout(() => {
    createBot(BOT_B, 'BOT_B');
  }, 2 * 60 * 1000);
}

/* ======================
   START EVERYTHING
   ====================== */
startBothBots();

/* ======================
   HTTP SERVER (RENDER REQUIRED)
   ====================== */
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bedrock AFK bots are running ✅');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 HTTP server running on port ${PORT}`);
});
