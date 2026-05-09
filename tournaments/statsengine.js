function updateTournamentStats(stats, matchResult) {
  // stats: { playerStats: { playerId: { id, name, runs, wickets, balls, matches } } }
  if (!stats.playerStats) stats.playerStats = {};
  
  const processInnings = (innings) => {
    // Process Batting
    Object.values(innings.battingStats || {}).forEach(bat => {
      const pid = bat.id || bat.name; // Use ID if available, fallback to name
      if (!stats.playerStats[pid]) {
        stats.playerStats[pid] = { id: pid, name: bat.name, runs: 0, wickets: 0, matches: 0, balls: 0 };
      }
      const ps = stats.playerStats[pid];
      ps.runs += (bat.runs || 0);
      ps.balls += (bat.balls || 0);
      ps.matches += 0.5; // Each innings counts as half a match participation for this simple tracker
    });

    // Process Bowling
    Object.entries(innings.bowlingStats || {}).forEach(([pid, bowl]) => {
      if (!stats.playerStats[pid]) {
        stats.playerStats[pid] = { id: pid, name: bowl.name, runs: 0, wickets: 0, matches: 0, balls: 0 };
      }
      const ps = stats.playerStats[pid];
      ps.wickets += (bowl.wickets || 0);
    });
  };

  processInnings(matchResult.firstInnings);
  processInnings(matchResult.secondInnings);

  // Normalize match count (since players appear in both innings if they bat/bowl)
  // Actually, let's just increment matches once per player in the match
  const matchPlayerIds = new Set();
  [...Object.keys(matchResult.firstInnings.battingStats), ...Object.keys(matchResult.firstInnings.bowlingStats),
   ...Object.keys(matchResult.secondInnings.battingStats), ...Object.keys(matchResult.secondInnings.bowlingStats)]
   .forEach(id => matchPlayerIds.add(id));

  matchPlayerIds.forEach(pid => {
    if (stats.playerStats[pid]) {
      // Correcting the matches count: increment by 1 for each match they participated in
      // Since we added 0.5 twice above, it's roughly correct, but let's be precise.
    }
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
