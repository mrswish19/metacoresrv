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

const JOIN_TIME = 18 * 60 * 1000;   // 18 minutes
const SWITCH_TIME = 15 * 60 * 1000; // 15 minutes
const SWITCH_COOLDOWN = 30 * 1000;  // 30 seconds
const RECONNECT_DELAY = 30 * 1000;  // 30 seconds

/* ======================
   STATE
   ====================== */
let activeBot = null;
let activeName = null;
let activeConfig = null;

let afkInterval = null;
let reconnectTimer = null;
let intentionalStop = false;

/* ======================
   CREATE BOT
   ====================== */
function createBot(config, name) {
  console.log(`🚀 Starting ${name}...`);
  activeConfig = config;

  const bot = createClient(config);

  bot.on('spawn', () => {
    console.log(`✅ ${name} spawned (AFK SAFE)`);
    intentionalStop = false;
    startAfkLoop(bot, name);
  });

  bot.on('text', p => {
    console.log(`[${name}] ${p.message}`);
  });

  const handleDisconnect = (reason) => {
    if (intentionalStop) return;
    if (name !== activeName) return;

    console.log(`🔄 ${name} reconnecting in 30s... Reason:`, reason);

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      activeBot = createBot(activeConfig, activeName);
    }, RECONNECT_DELAY);
  };

  bot.on('kick', p => handleDisconnect(p.reason));
  bot.on('error', e => handleDisconnect(e.message));

  return bot;
}

/* ======================
   STOP BOT (CLEAN)
   ====================== */
function stopBot() {
  if (!activeBot) return;

  intentionalStop = true;
  console.log(`👋 ${activeName} leaving server`);

  clearInterval(afkInterval);
  afkInterval = null;

  try {
    activeBot.disconnect();
  } catch {}

  activeBot = null;
  activeName = null;
}

/* ======================
   100% AFK SAFE LOOP
   ====================== */
function startAfkLoop(bot, name) {
  console.log(`🛡️ ${name} AFK keep-alive enabled`);

  afkInterval = setInterval(() => {
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
  }, 90 * 1000); // every 90 seconds
}

/* ======================
   ROTATION LOGIC
   ====================== */
function startRotation() {
  // Start BOT A
  activeName = 'BOT_A';
  activeBot = createBot(BOT_A, 'BOT_A');

  // First switch after 15 minutes
  setTimeout(() => {
    stopBot();

    setTimeout(() => {
      activeName = 'BOT_B';
      activeBot = createBot(BOT_B, 'BOT_B');
    }, SWITCH_COOLDOWN);
  }, SWITCH_TIME);

  // Continue rotating every 18 minutes
  setInterval(() => {
    stopBot();

    setTimeout(() => {
      if (activeName === 'BOT_A') {
        activeName = 'BOT_B';
        activeBot = createBot(BOT_B, 'BOT_B');
      } else {
        activeName = 'BOT_A';
        activeBot = createBot(BOT_A, 'BOT_A');
      }
    }, SWITCH_COOLDOWN);
  }, JOIN_TIME);
}

/* ======================
   START BOT ROTATION
   ====================== */
startRotation();

/* ======================
   HTTP SERVER (RENDER REQUIRED)
   ====================== */
const PORT = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bedrock AFK bot is running ✅');
}).listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 HTTP server running on port ${PORT}`);
});
