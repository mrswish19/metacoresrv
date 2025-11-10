// lostSafety.js
module.exports = function lostSafety(bot) {
  // 🏠 Step 1: Set home base (first spawn position)
  if (!bot.home) {
    bot.home = { ...bot.entity.position };
    console.log(`[LostSafety] Home position set at (${bot.home.x.toFixed(1)}, ${bot.home.y.toFixed(1)}, ${bot.home.z.toFixed(1)})`);
  }

  // Configurable limits
  const maxRadius = 80; // Max wander distance from home
  const stuckCheckInterval = 1000; // ms
  const stuckThreshold = 5; // seconds before unstuck
  let lastPos = null;
  let stuckTicks = 0;

  // 🧭 Step 2: Watch position every second
  if (bot.lostSafetyInterval) clearInterval(bot.lostSafetyInterval);

  bot.lostSafetyInterval = setInterval(() => {
    if (!bot.entity || !bot.entity.position) return;

    const pos = bot.entity.position;

    // 📏 Distance check
    const dx = pos.x - bot.home.x;
    const dz = pos.z - bot.home.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // 🧱 Detect stuck movement
    if (lastPos && pos.x === lastPos.x && pos.z === lastPos.z) stuckTicks++;
    else stuckTicks = 0;
    lastPos = { ...pos };

    // 🚨 If stuck too long, move randomly
    if (stuckTicks > stuckThreshold) {
      console.log('[LostSafety] Bot seems stuck — nudging position slightly.');
      const offsetX = (Math.random() - 0.5) * 2;
      const offsetZ = (Math.random() - 0.5) * 2;

      bot.entity.position.x += offsetX;
      bot.entity.position.z += offsetZ;

      bot.queue('move_player', {
        runtime_entity_id: bot.entity.runtime_id,
        position: bot.entity.position,
        pitch: 0,
        yaw: 0,
        head_yaw: 0,
        mode: 0,
        on_ground: true,
        ridden_runtime_id: 0,
      });

      stuckTicks = 0;
    }

    // 🏠 If too far from home, walk back
    if (dist > maxRadius) {
      console.log(`[LostSafety] Too far from home (${dist.toFixed(1)} blocks) — returning...`);
      const dirX = (bot.home.x - pos.x) / dist;
      const dirZ = (bot.home.z - pos.z) / dist;

      const step = 0.3; // return speed
      const newPos = {
        x: pos.x + dirX * step,
        y: pos.y,
        z: pos.z + dirZ * step,
      };

      bot.queue('move_player', {
        runtime_entity_id: bot.entity.runtime_id,
        position: newPos,
        pitch: 0,
        yaw: 0,
        head_yaw: 0,
        mode: 0,
        on_ground: true,
        ridden_runtime_id: 0,
      });

      bot.entity.position = newPos;
    }
  }, stuckCheckInterval);
};
