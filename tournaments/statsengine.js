function updateTournamentStats(stats, matchResult) {
  // stats: { playerStats: { playerId: { runs, wickets, balls, matches } } }
  const players = [...matchResult.teamAPlayers, ...matchResult.teamBPlayers];
  
  players.forEach(p => {
    if (!stats.playerStats[p.id]) {
      stats.playerStats[p.id] = { id: p.id, name: p.name, runs: 0, wickets: 0, matches: 0, balls: 0 };
    }
    const ps = stats.playerStats[p.id];
    ps.matches += 1;
    ps.runs += (p.matchRuns || 0);
    ps.wickets += (p.matchWickets || 0);
    ps.balls += (p.matchBallsFaced || 0);
  });

  return stats;
}

module.exports = { updateTournamentStats };
