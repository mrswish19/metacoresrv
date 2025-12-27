const { createClient } = require('bedrock-protocol');

// ==============================
// CONFIG
// ==============================
const bot = createClient({
  host: 'kupaleros-rg1D.aternos.me',
  port: 40915,
  username: 'Noxell',
  version: '1.21.130'
});

// ==============================
// TIME TRACKER
// ==============================
let sessionStart = null;
let minuteLogger = null;

function startTimeTracking() {
  sessionStart = Date.now();

  minuteLogger = setInterval(() => {
    const onlineMs = Date.now() - sessionStart;
    console.log(`⏱ Online time: ${formatTime(onlineMs)}`);
  }, 60_000); // every 1 minute
}

function stopTimeTracking(reason = 'Disconnected') {
  if (!sessionStart) return;

  clearInterval(minuteLogger);

  const totalMs = Date.now() - sessionStart;
  console.log(`🛑 ${reason}`);
  console.log(`📊 Final online time: ${formatTime(totalMs)}`);
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}h ${minutes}m ${seconds}s`;
}

// ==============================
// EVENTS
// ==============================
bot.on('spawn', () => {
  console.log('✅ Bot spawned');
  startTimeTracking();
  startLegitAFK(bot);
});

bot.on('text', p => {
  console.log(`[CHAT] ${p.message}`);
});

bot.on('kick', p => {
  stopTimeTracking('Kicked from server');
  console.log('❌ Kick reason:', p.reason);
});

bot.on('disconnect', () => {
  stopTimeTracking('Disconnected');
});

bot.on('error', e => {
  console.log('⚠️ Error:', e.message);
});

// ==============================
// LEGIT HUMAN-LIKE AFK LOGIC
// ==============================
function startLegitAFK(bot) {
  console.log('🟢 Legit AFK mode enabled');

  setInterval(() => {
    if (!bot.entity?.position) return;

    // Random head movement
    const yaw = Math.random() * 360;
    const pitch = (Math.random() * 10) - 5;

    let inputData = [];
    let moveVector = { x: 0, y: 0, z: 0 };

    // Small random movement (rare)
    if (Math.random() < 0.2) {
      inputData.push('forward');
      moveVector.x = Math.cos(yaw * Math.PI / 180) * 0.05;
      moveVector.z = Math.sin(yaw * Math.PI / 180) * 0.05;
    }

    // Rare jump
    if (Math.random() < 0.03) inputData.push('jump');

    // Rare sneak
    if (Math.random() < 0.02) inputData.push('sneak');

    bot.queue('player_auth_input', {
      pitch,
      yaw,
      position: bot.entity.position,
      move_vector: moveVector,
      input_data: inputData,
      input_flags: [],
      tick: Date.now()
    });

  }, 3000); // Human-like idle interval
}
