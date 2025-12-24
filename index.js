const { createClient } = require('bedrock-protocol');
const http = require('http');

/* ======================
   CONFIG
   ====================== */
const CONFIG = {
  host: 'metacoresrv.aternos.me',
  port: 36614,
  offline: true,
  version: '1.21.130',
  username: 'Mikito2687'
};

const RECONNECT_DELAY = 3000; // 3 seconds

/* ======================
   STATE
   ====================== */
let afkInterval = null;
let moveInterval = null;
let reconnectTimer = null;
let bot = null;

/* ======================
   CREATE BOT
   ====================== */
function startBot() {
  console.log('🚀 Starting bot...');
  bot = createClient(CONFIG);

  bot.on('spawn', () => {
    console.log('✅ Bot spawned!');
    startAfkLoop();
    startTinyMovement();
  });

  bot.on('text', p => console.log(`[Server] ${p.message}`));

  const handleDisconnect = (reason) => {
    console.log(`🔄 Reconnecting in 3s... Reason:`, reason);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(startBot, RECONNECT_DELAY);
  };

  bot.on('kick', p => handleDisconnect(p.reason));
  bot.on('error', e => handleDisconnect(e.message));
}

/* ======================
   AFK SAFE LOOP (sneak pulses)
   ====================== */
function startAfkLoop() {
  if (afkInterval) clearInterval(afkInterval);

  afkInterval = setInterval(() => {
    if (!bot?.entity?.runtime_id || !bot?.entity?.position) return;

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

    console.log('[AFK] Sneak pulse sent');
  }, 90 * 1000);
}

/* ======================
   TINY HUMAN-LIKE MOVEMENT
   ====================== */
function startTinyMovement() {
  if (moveInterval) clearInterval(moveInterval);

  let angle = Math.random() * Math.PI * 2;

  moveInterval = setInterval(() => {
    if (!bot?.entity?.position) return;

    const pos = bot.entity.position;

    // Tiny random movement, very subtle
    const dx = (Math.random() - 0.5) * 0.05; // ±0.025 blocks
    const dz = (Math.random() - 0.5) * 0.05;
    angle += (Math.random() - 0.5) * 0.1; // small rotation

    const newPos = {
      x: pos.x + dx,
      y: pos.y,
      z: pos.z + dz
    };

    bot.queue('move_player', {
      runtime_id: bot.entity.runtime_id,
      position: newPos,
      pitch: 0,
      yaw: (angle * 180) / Math.PI,
      head_yaw: (angle * 180) / Math.PI,
      mode: 0,
      on_ground: true,
      riding_runtime_id: 0,
      teleportation_cause: 0,
      teleportation_item: 0
    });

    bot.entity.position = newPos;

  }, 2000 + Math.random() * 1000); // 2–3 seconds between movements
}

/* ======================
   START BOT
   ====================== */
startBot();

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
