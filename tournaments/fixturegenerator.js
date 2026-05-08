const { scheduleFixtures } = require('../utils/schedulerUtils');

function generateRoundRobin(teams, rounds = 1) {
  const fixtures = [];
  const teamList = teams.filter(t => t && (t.id || t.name));
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
  const validTeams = teams.filter(t => t && (t.id || t.name));
  const groups = Array.from({ length: groupCount }, () => []);
  
  const teamsPerGroup = Math.ceil(validTeams.length / groupCount);
  validTeams.forEach((team, i) => {
    const groupIdx = Math.floor(i / teamsPerGroup);
    if (groups[groupIdx]) groups[groupIdx].push(team);
  });

  let fixtures = [];
  groups.forEach((group, i) => {
    const groupFixtures = generateRoundRobin(group, 1).map(f => ({ ...f, group: String.fromCharCode(65 + i) }));
    fixtures = fixtures.concat(groupFixtures);
  });

  return { groups, fixtures };
}

function generateWorldCupFixtures(groups) {
  const fixtures = [];
  
  // Group A (Group 0) - Indices: 0:Ind, 1:Aus, 2:Ban, 3:Ire, 4:Sco, 5:Net
  const groupA = groups[0];
  const orderA = [
    [0, 1], [2, 3], [4, 5], // Matches 1-3
    [0, 2], [1, 4], [3, 5], // Matches 4-6
    [0, 4], [1, 5], [2, 4], // Matches 7-9
    [3, 0], [1, 2], [5, 0], // Matches 10-12
    [3, 4], [2, 5], [1, 3]  // Matches 13-15
  ];

  orderA.forEach((pair, i) => {
    fixtures.push({
      matchId: `WC_A_${i+1}`,
      teamA: groupA[pair[0]],
      teamB: groupA[pair[1]],
      round: Math.floor(i / 3) + 1,
      status: "scheduled",
      stage: "league",
      group: "A"
    });
  });

  // Group B (Group 1) - Indices: 0:Eng, 1:Pak, 2:NZ, 3:SA, 4:SL, 5:WI
  const groupB = groups[1];
  const orderB = [
    [0, 1], [2, 3], [4, 5], // Matches 16-18
    [0, 2], [1, 4], [3, 5], // Matches 19-21
    [0, 3], [1, 5], [2, 4], // Matches 22-24
    [0, 4], [1, 3], [5, 2], // Matches 25-27
    [0, 5], [3, 4], [1, 2]  // Matches 28-30
  ];

  orderB.forEach((pair, i) => {
    fixtures.push({
      matchId: `WC_B_${i+16}`,
      teamA: groupB[pair[0]],
      teamB: groupB[pair[1]],
      round: Math.floor(i / 3) + 1,
      status: "scheduled",
      stage: "league",
      group: "B"
    });
  });

  return fixtures;
}

/**
 * Main entry point for generating a fully scheduled tournament
 */
function createFullTournamentSchedule(teams, options = {}) {
  const { format = "round_robin", rounds = 1, startDate = new Date(), country = "India" } = options;
  
  let rawFixtures;
  if (format === "group_knockout" && teams.length === 12) {
    const { groups } = generateGroups(teams, 2);
    rawFixtures = generateWorldCupFixtures(groups);
  } else if (format === "groups" || format === "group_knockout") {
    const { fixtures } = generateGroups(teams, options.groupCount || 2);
    rawFixtures = fixtures;
  } else {
    rawFixtures = generateRoundRobin(teams, rounds);
  }

  // Assign dates, times, venues, and timezones
  return scheduleFixtures(rawFixtures, startDate, {
    country,
    doubleHeaderWeekends: true,
    matchesPerDay: 1,
    restDayFrequency: 10
  });
}

module.exports = { generateRoundRobin, generateGroups, createFullTournamentSchedule };

