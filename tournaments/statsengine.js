function updateTournamentStats(stats, matchResult) {
  // stats: { playerStats: { playerId: { id, name, runs, wickets, balls, matches } } }
  if (!stats.playerStats) stats.playerStats = {};
  
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

function getLeaderboard(stats) {
  const players = Object.values(stats.playerStats || {});
  
  const orangeCap = [...players]
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 10);
    
  const purpleCap = [...players]
    .sort((a, b) => b.wickets - a.wickets)
    .slice(0, 10);
    
  return { orangeCap, purpleCap };
}

module.exports = { updateTournamentStats, getLeaderboard };
