// behaviorManager.js
const {
  handleNightSafety,
  handleLostSafety,   // <-- Added
  handleHunger,
  handleMobAvoidance,
  handlePathing,
  respawnIfDead
} = require('./index');

module.exports = function behaviorManager(bot) {
  let activeBehavior = null;
  let cooldown = 0;

  function switchBehavior(name, fn) {
    if (activeBehavior !== name) {
      activeBehavior = name;
      fn();
    }
  }

  async function loop() {
    if (cooldown > 0) {
      cooldown--;
      return;
    }

    // 1️⃣ Respawn if dead
    if (respawnIfDead(bot)) {
      switchBehavior('respawn', () => console.log('Respawning...'));
      cooldown = 20;
      return;
    }

    // 2️⃣ Lost safety check
    if (handleLostSafety(bot)) {
      switchBehavior('lostSafety', () => console.log('Finding safe spot (lostSafety)...'));
      cooldown = 20;
      return;
    }

    // 3️⃣ Hunger management
    if (handleHunger(bot)) {
      switchBehavior('hunger', () => console.log('Eating food...'));
      cooldown = 20;
      return;
    }

    // 4️⃣ Night safety
    if (handleNightSafety(bot)) {
      switchBehavior('nightSafety', () => console.log('Seeking safe place at night...'));
      cooldown = 20;
      return;
    }

    // 5️⃣ Mob avoidance
    if (handleMobAvoidance(bot)) {
      switchBehavior('mobAvoidance', () => console.log('Avoiding mobs...'));
      cooldown = 20;
      return;
    }

    // 6️⃣ Pathing / walking
    switchBehavior('pathing', () => handlePathing(bot));
    cooldown = 10;
  }

  setInterval(loop, 50);
};
