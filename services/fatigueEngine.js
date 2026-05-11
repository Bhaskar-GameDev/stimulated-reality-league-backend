const db = require("../firebase");

class FatigueEngine {
  static async addWorkload(playerId, oversBowled, runsScored, format) {
    const ref = db.ref(`international/fatigue/${playerId}`);
    const snap = await ref.once("value");
    let fatigue = snap.val() || { level: 0, injuryRisk: 0 };

    let workload = 0;
    if (oversBowled > 0) workload += oversBowled * 2; // Bowlers tire faster
    if (runsScored > 30) workload += runsScored * 0.1;

    fatigue.level = Math.min(100, fatigue.level + workload);
    fatigue.injuryRisk = fatigue.level > 80 ? (fatigue.level - 80) * 0.5 : 0;

    await ref.set(fatigue);
  }

  static async restPlayer(playerId, days) {
    const ref = db.ref(`international/fatigue/${playerId}`);
    const snap = await ref.once("value");
    if (snap.exists()) {
      let fatigue = snap.val();
      fatigue.level = Math.max(0, fatigue.level - (days * 10));
      fatigue.injuryRisk = fatigue.level > 80 ? (fatigue.level - 80) * 0.5 : 0;
      await ref.set(fatigue);
    }
  }

  static async getFatigue(playerId) {
    const snap = await db.ref(`international/fatigue/${playerId}`).once("value");
    return snap.val() || { level: 0, injuryRisk: 0 };
  }
}

module.exports = FatigueEngine;
