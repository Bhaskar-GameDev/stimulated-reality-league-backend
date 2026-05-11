const db = require("../firebase");

class SeriesEngine {
  static async createSeries(tourId, format, totalMatches, teamA, teamB) {
    const seriesId = `SERIES_${Date.now()}`;
    const seriesData = {
      id: seriesId,
      tourId,
      format,
      teamA,
      teamB,
      totalMatches,
      matchesPlayed: 0,
      score: { [teamA]: 0, [teamB]: 0, "Tie": 0 },
      status: "scheduled"
    };
    await db.ref(`international/series/${seriesId}`).set(seriesData);
    return seriesId;
  }

  static async processMatchResult(seriesId, winner) {
    const ref = db.ref(`international/series/${seriesId}`);
    const snap = await ref.once("value");
    if (!snap.exists()) return;
    
    const series = snap.val();
    series.matchesPlayed += 1;
    series.score[winner] = (series.score[winner] || 0) + 1;
    
    if (series.matchesPlayed >= series.totalMatches) {
        series.status = "completed";
        // Determine series winner
        if (series.score[series.teamA] > series.score[series.teamB]) series.winner = series.teamA;
        else if (series.score[series.teamB] > series.score[series.teamA]) series.winner = series.teamB;
        else series.winner = "Tie";
    }

    await ref.set(series);
  }
}

module.exports = SeriesEngine;
