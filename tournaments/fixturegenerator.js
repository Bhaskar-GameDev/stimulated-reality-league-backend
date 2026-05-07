function generateRoundRobin(teams, rounds = 1) {
  const fixtures = [];
  const teamList = [...teams];
  if (teamList.length % 2 !== 0) teamList.push({ id: "BYE", name: "BYE" });

  const numTeams = teamList.length;
  const numRounds = (numTeams - 1) * rounds;

  for (let r = 0; r < numRounds; r++) {
    for (let i = 0; i < numTeams / 2; i++) {
      const teamA = teamList[i];
      const teamB = teamList[numTeams - 1 - i];

      if (teamA.id !== "BYE" && teamB.id !== "BYE") {
        fixtures.push({
          matchId: `TRN_${Math.random().toString(36).substr(2, 9)}`,
          teamA,
          teamB,
          round: r + 1,
          status: "scheduled",
          stage: "league"
        });
      }
    }
    // Rotate teamList (keep first team fixed)
    teamList.splice(1, 0, teamList.pop());
  }
  return fixtures;
}

function generateGroups(teams, groupCount) {
  const groups = Array.from({ length: groupCount }, () => []);
  teams.forEach((team, i) => groups[i % groupCount].push(team));

  let fixtures = [];
  groups.forEach((group, i) => {
    const groupFixtures = generateRoundRobin(group, 1).map(f => ({ ...f, group: String.fromCharCode(65 + i) }));
    fixtures = fixtures.concat(groupFixtures);
  });

  return { groups, fixtures };
}

module.exports = { generateRoundRobin, generateGroups };
