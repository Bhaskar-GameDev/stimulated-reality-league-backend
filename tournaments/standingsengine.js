function updateStandings(standings, result, group = null) {
  const { teamA, teamB, winner, teamAScore, teamBScore, teamAOvers, teamBOvers } = result;

  const update = (teamId, name, won, runsScored, oversFaced, runsConceded, oversBowled) => {
    if (!standings[teamId]) {
      standings[teamId] = { 
        teamId, teamName: name, played: 0, won: 0, lost: 0, points: 0, nrr: 0, 
        runsScored: 0, oversFaced: 0, runsConceded: 0, oversBowled: 0,
        group: group 
      };
    }
    const s = standings[teamId];
    s.played += 1;
    if (won) {
      s.won += 1;
      s.points += 2;
    } else if (winner === "Tie" || winner === "No Result") {
      s.points += 1;
    } else {
      s.lost += 1;
    }
    s.runsScored += runsScored;
    s.oversFaced += oversFaced;
    s.runsConceded += runsConceded;
    s.oversBowled += oversBowled;
    s.nrr = calculateNRR(s.runsScored, s.oversFaced, s.runsConceded, s.oversBowled);
  };

  update(teamA.id, teamA.name, winner === teamA.name, teamAScore, teamAOvers, teamBScore, teamBOvers);
  update(teamB.id, teamB.name, winner === teamB.name, teamBScore, teamBOvers, teamAScore, teamAOvers);
  
  return standings;
}

function calculateNRR(runsScored, oversFaced, runsConceded, oversBowled) {
  const scRate = runsScored / Math.max(0.1, oversFaced);
  const concRate = runsConceded / Math.max(0.1, oversBowled);
  return scRate - concRate;
}

function sortStandings(standings) {
  return Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.nrr !== a.nrr) return b.nrr - a.nrr;
    if (b.won !== a.won) return b.won - a.won;
    return 0; // Head-to-head would go here
  });
}

module.exports = { updateStandings, sortStandings };
