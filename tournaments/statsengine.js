function updateTournamentStats(stats, matchResult) {
  // stats: { playerStats: { playerId: { runs, wickets, balls, matches, 50s, 100s, bestFigures } } }
  if (!stats.playerStats) stats.playerStats = {};

  const processInnings = (batting, bowling) => {
    // Process Batting
    Object.values(batting).forEach(p => {
      const id = p.id || p.name;
      if (!id) return;
      if (!stats.playerStats[id]) {
        stats.playerStats[id] = { id, name: p.name, runs: 0, wickets: 0, matches: 0, balls: 0, fours: 0, sixes: 0, "50s": 0, "100s": 0, bestFigures: { wickets: 0, runs: 0 } };
      }
      const ps = stats.playerStats[id];
      ps.runs += p.runs;
      ps.balls += p.balls;
      ps.fours += p.fours;
      ps.sixes += p.sixes;
      if (p.runs >= 100) ps["100s"] += 1;
      else if (p.runs >= 50) ps["50s"] += 1;
      
      // Increment matches played only once per player (handled outside if needed, but here is fine)
      ps.matchesPlayed = (ps.matchesPlayed || 0) + 1;
    });

    // Process Bowling
    Object.values(bowling).forEach(p => {
      const id = p.id || p.name;
      if (!id) return;
      if (!stats.playerStats[id]) {
        stats.playerStats[id] = { id, name: p.name, runs: 0, wickets: 0, matches: 0, balls: 0, fours: 0, sixes: 0, "50s": 0, "100s": 0, bestFigures: { wickets: 0, runs: 0 } };
      }
      const ps = stats.playerStats[id];
      ps.wickets += p.wickets;
      ps.bowlingRuns += p.runs;
      ps.bowlingBalls += p.balls;
      
      if (p.wickets > ps.bestFigures.wickets || (p.wickets === ps.bestFigures.wickets && p.runs < ps.bestFigures.runs)) {
          ps.bestFigures = { wickets: p.wickets, runs: p.runs };
      }
    });
  };

  if (matchResult.firstInnings && matchResult.firstInnings.batting) {
      processInnings(matchResult.firstInnings.batting, matchResult.secondInnings.bowling);
  }
  if (matchResult.secondInnings && matchResult.secondInnings.batting) {
      processInnings(matchResult.secondInnings.batting, matchResult.firstInnings.bowling);
  }

  return stats;
}

module.exports = { updateTournamentStats };
