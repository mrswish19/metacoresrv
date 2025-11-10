// behaviors/walkLoop.js
module.exports = function walkLoop(bot) {
  if (!bot?.entity?.position) return;

  // Initialize random direction if undefined
  if (!bot.pathYaw) bot.pathYaw = Math.random() * 360;

  const speed = 0.2; // movement per tick
  const rad = bot.pathYaw * (Math.PI / 180);

  const dx = Math.sin(rad) * speed;
  const dz = Math.cos(rad) * speed;

  const pos = bot.entity.position;
  const newPos = {
    x: pos.x + dx,
    y: pos.y,
    z: pos.z + dz
  };

  try {
    bot.queue('move_player', {
      runtime_id: bot.entity.runtime_id,
      position: newPos,
      pitch: 0,
      yaw: bot.pathYaw,
      head_yaw: bot.pathYaw,
      mode: 0,
      on_ground: true,
      riding_runtime_id: 0,
      teleportation_cause: 0
    });

    // Update local cache
    bot.entity.position = newPos;

    // Log every step
    console.log(`[WalkLoop] Walking to x:${newPos.x.toFixed(2)} z:${newPos.z.toFixed(2)}`);
  } catch (err) {
    console.log('WalkLoop error:', err.message);
  }
};
