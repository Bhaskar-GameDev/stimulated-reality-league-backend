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

/**
 * Main entry point for generating a fully scheduled tournament
 */
function createFullTournamentSchedule(teams, options = {}) {
  const { format = "round_robin", rounds = 1, startDate = new Date(), country = "India" } = options;
  
  let rawFixtures;
  if (format === "groups" || format === "group_knockout") {
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
    restDayFrequency: 8
  });
}

module.exports = { generateRoundRobin, generateGroups, createFullTournamentSchedule };

