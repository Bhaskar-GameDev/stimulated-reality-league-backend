function updateStandings(standings, result) {
  const { teamA, teamB, winner, teamAScore, teamBScore, teamAOvers, teamBOvers, group } = result;

  const update = (teamId, name, won, runsScored, oversFaced, runsConceded, oversBowled, groupName) => {
    if (!standings[teamId]) {
      standings[teamId] = { 
        teamId, 
        teamName: name, 
        group: groupName || "A",
        played: 0, 
        won: 0, 
        lost: 0, 
        points: 0, 
        nrr: 0, 
        runsScored: 0, 
        oversFaced: 0, 
        runsConceded: 0, 
        oversBowled: 0 
      };
    }
    const s = standings[teamId];
    s.played += 1;
    if (won) {
      s.won += 1;
      s.points += 2;
    } else if (winner === "Tie") {
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

  update(teamA.id, teamA.name, winner === teamA.name, teamAScore, teamAOvers, teamBScore, teamBOvers, group);
  update(teamB.id, teamB.name, winner === teamB.name, teamBScore, teamBOvers, teamAScore, teamAOvers, group);
  
  return standings;
}

function calculateNRR(runsScored, oversFaced, runsConceded, oversBowled) {
  const scRate = runsScored / Math.max(0.1, oversFaced);
  const concRate = runsConceded / Math.max(0.1, oversBowled);
  return scRate - concRate;
}

function sortStandings(standings) {
  const list = Object.values(standings);
  return list.sort((a, b) => {
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    if (b.points !== a.points) return b.points - a.points;
    return b.nrr - a.nrr;
  });
}

function getGroupStandings(standings) {
  const sorted = sortStandings(standings);
  const groups = {};
  sorted.forEach(s => {
    if (!groups[s.group]) groups[s.group] = [];
    groups[s.group].push(s);
  });
  return groups;
}

module.exports = { updateStandings, sortStandings, getGroupStandings };
