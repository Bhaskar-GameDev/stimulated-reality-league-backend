const db = require("../firebase");
const { startMatch, resolvePlayingXI, buildMatchPlayer } = require("../services/matchService");
const { getTeamByName } = require("../services/teamService");

const standingsEngine = require("./standingsengine");
const statsEngine = require("./statsengine");
const fixtureGenerator = require("./fixturegenerator");
const templates = require("./tournamenttemplates");

async function createTournament({ templateKey, season, teams, tournamentName, fixtures, startDate, country }) {
  const template = templates[templateKey];
  const tournamentId = `TOURN_${Date.now()}`;
  
  // Generate fixtures if not provided
  let tournamentFixtures = fixtures;
  if (!tournamentFixtures || tournamentFixtures.length === 0) {
    tournamentFixtures = fixtureGenerator.createFullTournamentSchedule(teams, {
      format: template.format,
      rounds: template.rounds || 1,
      startDate: startDate || new Date(),
      country: country || template.defaultCountry || "India"
    });
  }

  const tournamentData = {
    id: tournamentId,
    name: tournamentName || `${template.name} ${season}`,
    status: "upcoming",
    season,
    templateKey,
    format: template.format,
    overs: template.overs || 20, // Added overs property
    teams,
    fixtures: tournamentFixtures,
    standings: {},
    stats: { playerStats: {} },
    currentRound: 1,
    stage: "league",
    createdAt: new Date().toISOString()
  };

  await db.ref(`tournaments/${tournamentId}`).set(tournamentData);
  return tournamentId;
}

async function runNextMatch(tournamentId) {
  const tournamentSnap = await db.ref(`tournaments/${tournamentId}`).once("value");
  const tournament = tournamentSnap.val();
  if (tournament.status === "completed") return;

  const nextFixtureIndex = tournament.fixtures.findIndex(f => f.status === "scheduled");
  if (nextFixtureIndex === -1) {
    if (tournament.stage === "league") {
      return advanceToPlayoffs(tournamentId);
    }
    await db.ref(`tournaments/${tournamentId}/status`).set("completed");
    return;
  }

  const fixture = tournament.fixtures[nextFixtureIndex];
  
  // REAL-TIME CHECK: Only run if the match is due
  const now = new Date();
  const scheduledTime = new Date(fixture.utcTimestamp);
  
  if (now < scheduledTime) {
    console.log(`Match ${fixture.matchId} is scheduled for ${fixture.utcTimestamp}. Waiting...`);
    return { status: "waiting", scheduledTime: fixture.utcTimestamp };
  }

  try {
    await db.ref(`tournaments/${tournamentId}/status`).set("live");
    await db.ref(`tournaments/${tournamentId}/fixtures/${nextFixtureIndex}/status`).set("live");
    
    // Resolve players for both teams
    const teamAEntry = getTeamByName(fixture.teamA.name);
    const teamBEntry = getTeamByName(fixture.teamB.name);
    
    if (!teamAEntry || !teamBEntry) {
      throw new Error(`Teams ${fixture.teamA.name} or ${fixture.teamB.name} not found in catalog.`);
    }

    const format = tournament.overs === 20 ? "T20" : (tournament.overs === 50 ? "ODI" : "TEST");
    const teamAPlayers = resolvePlayingXI(teamAEntry, [], format);
    const teamBPlayers = resolvePlayingXI(teamBEntry, [], format);


    // Call match engine with correct parameters
    const result = await startMatch(fixture.matchId, teamAPlayers, teamBPlayers, {
      teamAName: fixture.teamA.name,
      teamBName: fixture.teamB.name,
      matchType: tournament.overs === 20 ? "T20" : "ODI",
      oversLimit: tournament.overs || 20,
      venue: fixture.venue,
      isKnockout: fixture.stage !== "league",
      isFinal: fixture.stage === "Final"
    });

    await processMatchResult(tournamentId, nextFixtureIndex, result);
    return { status: "completed", matchId: fixture.matchId };
  } catch (error) {
    console.error("Match simulation failed", error);
    await db.ref(`tournaments/${tournamentId}/fixtures/${nextFixtureIndex}/status`).set("failed");
    return { status: "failed", error: error.message };
  }
}

async function processMatchResult(tournamentId, fixtureIndex, rawResult) {
  const tournamentSnap = await db.ref(`tournaments/${tournamentId}`).once("value");
  const tournament = tournamentSnap.val();
  const fixture = tournament.fixtures[fixtureIndex];

  // 1. Update Standings / Stats
  const standingsResult = {
    teamA: { id: fixture.teamA.id, name: fixture.teamA.name },
    teamB: { id: fixture.teamB.id, name: fixture.teamB.name },
    group: fixture.group, // Pass group info
    winner: rawResult.result.winner,
    teamAScore: rawResult.firstInnings.runs,
    teamBScore: rawResult.secondInnings.runs,
    teamAOvers: parseFloat(rawResult.firstInnings.overs),
    teamBOvers: parseFloat(rawResult.secondInnings.overs)
  };

  if (fixture.stage === "league") {
    const newStandings = standingsEngine.updateStandings(tournament.standings || {}, standingsResult);
    await db.ref(`tournaments/${tournamentId}/standings`).set(newStandings);
  }
  
  const newStats = statsEngine.updateTournamentStats(tournament.stats || { playerStats: {} }, rawResult);
  await db.ref(`tournaments/${tournamentId}/stats`).set(newStats);

  // 2. Update Fixture Status
  await db.ref(`tournaments/${tournamentId}/fixtures/${fixtureIndex}`).update({
    status: "completed",
    winner: rawResult.result.winner,
    resultSummary: rawResult.result.margin ? `${rawResult.result.winner} won by ${rawResult.result.margin}` : "Match tied"
  });

  // 3. Knockout Progression (Resolve TBDs)
  if (fixture.stage !== "league") {
    await resolveNextKnockoutRound(tournamentId, fixture, rawResult.result.winner);
  }

  // 4. Champion Check
  if (fixture.stage === "Final") {
    await db.ref(`tournaments/${tournamentId}`).update({
      status: "completed",
      champion: rawResult.result.winner,
      completedAt: new Date().toISOString()
    });
    console.log(`[TOURNAMENT] ${rawResult.result.winner} are the CHAMPIONS!`);
  }

  await generateNarrative(tournamentId, rawResult);
}

async function resolveNextKnockoutRound(tournamentId, completedFixture, winner) {
  const tournamentSnap = await db.ref(`tournaments/${tournamentId}`).once("value");
  const tournament = tournamentSnap.val();
  const fixtures = [...tournament.fixtures];
  let updated = false;

  if (completedFixture.stage === "Semi Final 1") {
    const final = fixtures.find(f => f.stage === "Final");
    if (final) { final.teamA = { id: winner, name: winner }; updated = true; }
  } else if (completedFixture.stage === "Semi Final 2") {
    const final = fixtures.find(f => f.stage === "Final");
    if (final) { final.teamB = { id: winner, name: winner }; updated = true; }
  }

  if (updated) {
    await db.ref(`tournaments/${tournamentId}/fixtures`).set(fixtures);
  }
}

async function advanceToPlayoffs(tournamentId) {
  const tournamentSnap = await db.ref(`tournaments/${tournamentId}`).once("value");
  const tournament = tournamentSnap.val();
  
  const standings = tournament.standings || {};
  const allTeams = standingsEngine.sortStandings(standings);

  let semiFinalTeams = [];

  if (tournament.format === "group_knockout") {
    // Top 2 from Group A and Top 2 from Group B
    const groupA = allTeams.filter(t => t.group === "A").slice(0, 2);
    const groupB = allTeams.filter(t => t.group === "B").slice(0, 2);
    
    if (groupA.length < 2 || groupB.length < 2) {
        console.error("Not enough teams in groups for playoffs");
        await db.ref(`tournaments/${tournamentId}/status`).set("completed");
        return;
    }
    
    // SF1: A1 vs B2, SF2: B1 vs A2
    semiFinalTeams = [
        { teamA: groupA[0], teamB: groupB[1] }, // SF1
        { teamB: groupB[0], teamA: groupA[1] }  // SF2
    ];
  } else {
    // Standard League Top 4
    if (allTeams.length < 4) {
        await db.ref(`tournaments/${tournamentId}/status`).set("completed");
        return;
    }
    semiFinalTeams = [
        { teamA: allTeams[0], teamB: allTeams[3] },
        { teamA: allTeams[1], teamB: allTeams[2] }
    ];
  }

  const playoffs = [
    { 
        matchId: `SF1_${tournamentId}`, 
        teamA: { id: semiFinalTeams[0].teamA.teamId, name: semiFinalTeams[0].teamA.teamName }, 
        teamB: { id: semiFinalTeams[0].teamB.teamId, name: semiFinalTeams[0].teamB.teamName }, 
        stage: "Semi Final 1", status: "scheduled",
        utcTimestamp: new Date(Date.now() + 86400000).toISOString(),
        venue: "Tournament Arena"
    },
    { 
        matchId: `SF2_${tournamentId}`, 
        teamA: { id: semiFinalTeams[1].teamA.teamId, name: semiFinalTeams[1].teamA.teamName }, 
        teamB: { id: semiFinalTeams[1].teamB.teamId, name: semiFinalTeams[1].teamB.teamName }, 
        stage: "Semi Final 2", status: "scheduled",
        utcTimestamp: new Date(Date.now() + 172800000).toISOString(),
        venue: "Championship Ground"
    },
    { 
        matchId: `FINAL_${tournamentId}`, 
        teamA: { id: "TBD", name: "TBD" }, 
        teamB: { id: "TBD", name: "TBD" }, 
        stage: "Final", status: "scheduled",
        utcTimestamp: new Date(Date.now() + 259200000).toISOString(),
        venue: "Lord's Cricket Ground"
    }
  ];

  await db.ref(`tournaments/${tournamentId}`).update({
    fixtures: [...tournament.fixtures, ...playoffs],
    stage: "knockout"
  });
}

async function generateNarrative(tournamentId, result) {
  const headline = result.result.isFinal 
    ? `HISTORIC! ${result.result.winner} crowned CHAMPIONS after defeating ${result.teamBName}!`
    : result.result.margin 
      ? `${result.result.winner} victory over ${result.teamBName}`
      : `Thriller ends in tie between ${result.teamAName} and ${result.teamBName}`;
  
  await db.ref(`narratives/${tournamentId}`).push({
    headline,
    timestamp: new Date().toISOString(),
    type: "match_report"
  });
}

module.exports = { createTournament, runNextMatch, processMatchResult };
