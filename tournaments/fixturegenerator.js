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
  validTeams.forEach((team, i) => groups[i % groupCount].push(team));


  let fixtures = [];
  groups.forEach((group, i) => {
    const groupFixtures = generateRoundRobin(group, 1).map(f => ({ ...f, group: String.fromCharCode(65 + i) }));
    fixtures = fixtures.concat(groupFixtures);
  });

  return { groups, fixtures };
}

function generateT20WorldCupFixtures(teams) {
  const groupA_Names = ["India", "Australia", "Bangladesh", "Ireland", "Scotland", "Netherlands"];
  const groupB_Names = ["England", "Pakistan", "New Zealand", "South Africa", "Sri Lanka", "West Indies"];

  const getTeam = (name) => {
    return teams.find(t => t.name.includes(name)) || { id: name, name: name };
  };

  const groupA = groupA_Names.map(getTeam);
  const groupB = groupB_Names.map(getTeam);

  const fixtures = [];

  // GROUP A FIXTURES
  const groupA_Matches = [
    [0, 1], [2, 3], [4, 5], [0, 2], [1, 4], [3, 5], [0, 4], [1, 5], [2, 4], [3, 0], [1, 2], [5, 0], [3, 4], [2, 5], [1, 3]
  ];

  groupA_Matches.forEach((m, i) => {
    fixtures.push({
      matchId: `WC_A_${i + 1}`,
      teamA: groupA[m[0]],
      teamB: groupA[m[1]],
      round: i + 1,
      status: "scheduled",
      stage: "league",
      group: "A"
    });
  });

  // GROUP B FIXTURES
  const groupB_Matches = [
    [0, 1], [2, 3], [4, 5], [0, 2], [1, 4], [3, 5], [0, 3], [1, 5], [2, 4], [0, 4], [1, 3], [5, 2], [0, 5], [3, 4], [1, 2]
  ];

  groupB_Matches.forEach((m, i) => {
    fixtures.push({
      matchId: `WC_B_${i + 16}`,
      teamA: groupB[m[0]],
      teamB: groupB[m[1]],
      round: i + 1,
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
  if (options.templateKey === "WORLD_CUP") {
    rawFixtures = generateT20WorldCupFixtures(teams);
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
    matchesPerDay: 2, // 2 matches per day for World Cup feel
    restDayFrequency: 10
  });
}

module.exports = { generateRoundRobin, generateGroups, createFullTournamentSchedule, generateT20WorldCupFixtures };

