const { createClient } = require('bedrock-protocol');

const bot = createClient({
  host: 'metacoresrv.aternos.me', // 🧠 Use localhost or LAN server (not Aternos)
  port: 36614,       // Default Bedrock port
  offline: true,     // Offline mode must be enabled
  version: '1.21.131',
  username: 'Noxell'
});

bot.on('spawn', () => {
  console.log('✅ Bot spawned! Starting walk loop...');
  startWalkLoop(bot);
});

bot.on('text', p => console.log(`[Server] ${p.message}`));
bot.on('kick', p => console.log('Kicked:', p.reason));
bot.on('error', e => console.log('Error:', e.message));

function startWalkLoop(bot) {
  let tick = 0;
  let angle = 0;

  setInterval(() => {
    if (!bot?.entity?.position) return;

    const pos = bot.entity.position;
    const speed = 0.3;

    // Walk in a smooth circle
    angle += Math.PI / 12;
    const newX = pos.x + Math.cos(angle) * speed;
    const newZ = pos.z + Math.sin(angle) * speed;

    const newPos = { x: newX, y: pos.y, z: newZ };

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
    tick++;
    if (tick % 20 === 0) console.log(`[Walk] New pos: x=${newX.toFixed(2)} z=${newZ.toFixed(2)}`);
  }, 500); // every 0.5s
}
