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
    winner: rawResult.result.winner,
    teamAScore: rawResult.firstInnings.runs,
    teamBScore: rawResult.secondInnings.runs,
    teamAOvers: parseFloat(rawResult.firstInnings.overs),
    teamBOvers: parseFloat(rawResult.secondInnings.overs)
  };

  if (fixture.stage === "league") {
    const newStandings = standingsEngine.updateStandings(tournament.standings || {}, standingsResult, fixture.group);
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
  
  const sorted = standingsEngine.sortStandings(tournament.standings);
  const groupA = sorted.filter(s => s.group === "A").slice(0, 2);
  const groupB = sorted.filter(s => s.group === "B").slice(0, 2);

  if (groupA.length < 2 || groupB.length < 2) {
    console.error("Not enough teams qualified for knockouts");
    await db.ref(`tournaments/${tournamentId}/status`).set("completed");
    return;
  }

  // Generate Semi Finals (Winner A vs Runner B, Winner B vs Runner A)
  const playoffs = [
    { 
        matchId: `SF1_${tournamentId}`, 
        teamA: { id: groupA[0].teamId, name: groupA[0].teamName }, 
        teamB: { id: groupB[1].teamId, name: groupB[1].teamName }, 
        stage: "Semi Final 1", status: "scheduled",
        utcTimestamp: new Date(Date.now() + 86400000).toISOString(),
        venue: "Semi Final Grounds 1"
    },
    { 
        matchId: `SF2_${tournamentId}`, 
        teamA: { id: groupB[0].teamId, name: groupB[0].teamName }, 
        teamB: { id: groupA[1].teamId, name: groupA[1].teamName }, 
        stage: "Semi Final 2", status: "scheduled",
        utcTimestamp: new Date(Date.now() + 172800000).toISOString(),
        venue: "Semi Final Grounds 2"
    },
    { 
        matchId: `FINAL_${tournamentId}`, 
        teamA: { id: "TBD", name: "TBD" }, 
        teamB: { id: "TBD", name: "TBD" }, 
        stage: "Final", status: "scheduled",
        utcTimestamp: new Date(Date.now() + 259200000).toISOString(),
        venue: "Tournament Final Stadium"
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
