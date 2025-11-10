// behaviors/behaviorManager.js
const walkLoop = require('./walkLoop');
const { handleHunger, handleLostSafety, handleMobAvoidance, handleNightSafety, respawnIfDead } = require('./handlers');

module.exports = function behaviorManager(bot) {
  console.log('BehaviorManager running');

  // Random pathYaw for roaming
  setInterval(() => {
    bot.pathYaw = Math.random() * 360;
  }, 5000);

  // Continuous walking
  setInterval(() => {
    if (!bot?.entity?.position) return;
    walkLoop(bot);
  }, 50);

  // Other behaviors every 1s
  setInterval(() => {
    if (!bot?.entity) return;

    if (respawnIfDead(bot)) return;
    if (handleLostSafety(bot)) return;
    if (handleHunger(bot)) return;
    if (handleNightSafety(bot)) return;
    if (handleMobAvoidance(bot)) return;
  }, 1000);
};
