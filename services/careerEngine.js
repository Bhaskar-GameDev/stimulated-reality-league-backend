const db = require("../firebase");

class CareerEngine {
  static async updateCareerStats(playerId, stats) {
    const ref = db.ref(`international/careers/${playerId}`);
    const snap = await ref.once("value");
    let career = snap.val() || {
      matches: 0, runs: 0, wickets: 0, centuries: 0, fifties: 0,
      ballsFaced: 0, ballsBowled: 0, runsConceded: 0, milestones: []
    };

    career.matches += 1;
    career.runs += stats.runs || 0;
    career.wickets += stats.wickets || 0;
    career.ballsFaced += stats.balls || 0;
    career.ballsBowled += stats.ballsBowled || 0;
    career.runsConceded += stats.runsConceded || 0;

    if (stats.runs >= 100) career.centuries += 1;
    else if (stats.runs >= 50) career.fifties += 1;

    // Averages and SR
    career.battingAverage = career.matches > 0 ? (career.runs / career.matches).toFixed(2) : 0;
    career.strikeRate = career.ballsFaced > 0 ? ((career.runs / career.ballsFaced) * 100).toFixed(2) : 0;
    career.bowlingAverage = career.wickets > 0 ? (career.runsConceded / Math.max(1, career.wickets)).toFixed(2) : 0;
    career.economy = career.ballsBowled > 0 ? (career.runsConceded / (career.ballsBowled / 6)).toFixed(2) : 0;

    await ref.set(career);
  }
}

module.exports = CareerEngine;
