const FormEngine = require("./formEngine");
const FatigueEngine = require("./fatigueEngine");

class SelectionEngine {
  static async selectPlayingXI(squad, format, venueProfile) {
    const availablePlayers = [];
    
    for (const player of squad) {
      const fatigue = await FatigueEngine.getFatigue(player.id || player.name);
      if (fatigue.level < 90) { // Don't select if critically fatigued
        const form = await FormEngine.getForm(player.id || player.name);
        availablePlayers.push({ ...player, formConfidence: form.confidence });
      }
    }

    // Sort by form confidence
    availablePlayers.sort((a, b) => b.formConfidence - a.formConfidence);

    // Pick top 11
    const playingXI = availablePlayers.slice(0, 11);
    return playingXI;
  }
}

module.exports = SelectionEngine;
