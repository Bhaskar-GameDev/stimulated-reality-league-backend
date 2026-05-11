const db = require("../firebase");

class RankingEngine {
  static async updateTeamRanking(teamA, teamB, winnerId, format) {
    const path = `international/rankings/teams/${format}`;
    const snapA = await db.ref(`${path}/${teamA}`).once("value");
    const snapB = await db.ref(`${path}/${teamB}`).once("value");

    let ratingA = snapA.val()?.rating || 100;
    let ratingB = snapB.val()?.rating || 100;

    // ELO based approach
    const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

    const k = 20; // Importance factor
    const scoreA = winnerId === teamA ? 1 : (winnerId === "Tie" ? 0.5 : 0);
    const scoreB = winnerId === teamB ? 1 : (winnerId === "Tie" ? 0.5 : 0);

    ratingA = Math.round(ratingA + k * (scoreA - expectedA));
    ratingB = Math.round(ratingB + k * (scoreB - expectedB));

    await db.ref(`${path}/${teamA}`).update({ rating: ratingA });
    await db.ref(`${path}/${teamB}`).update({ rating: ratingB });
  }

  static async getRankings(format) {
    const snap = await db.ref(`international/rankings/teams/${format}`).once("value");
    const data = snap.val() || {};
    return Object.entries(data).map(([team, stats]) => ({ team, ...stats })).sort((a, b) => b.rating - a.rating);
  }
}

module.exports = RankingEngine;
