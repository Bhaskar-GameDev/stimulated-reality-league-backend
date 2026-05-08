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


    // Call match engine with correct parameter order: (matchId, teamA, teamB, options)
    const result = await startMatch(fixture.matchId, teamAPlayers, teamBPlayers, {
      teamAName: fixture.teamA.name,
      teamBName: fixture.teamB.name,
      matchType: tournament.overs === 20 ? "T20" : "ODI",
      oversLimit: tournament.overs || 20,
      venue: fixture.venue,
      city: fixture.city,
      dayNight: fixture.dayNight,
      environmentalEffects: fixture.environmentalEffects
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

  // Map raw result to standings engine format
  const standingsResult = {
    teamA: { id: fixture.teamA.id, name: fixture.teamA.name },
    teamB: { id: fixture.teamB.id, name: fixture.teamB.name },
    winner: rawResult.result.winner,
    teamAScore: rawResult.firstInnings.runs,
    teamBScore: rawResult.secondInnings.runs,
    teamAOvers: parseFloat(rawResult.firstInnings.overs),
    teamBOvers: parseFloat(rawResult.secondInnings.overs)
  };

  // Update Standings (Decoupled Path)
  const newStandings = standingsEngine.updateStandings(tournament.standings || {}, standingsResult);
  await db.ref(`tournaments/${tournamentId}/standings`).set(newStandings);
  
  // Update Stats (Decoupled Path)
  const newStats = statsEngine.updateTournamentStats(tournament.stats || { playerStats: {} }, rawResult);
  await db.ref(`tournaments/${tournamentId}/stats`).set(newStats);

  // Update Fixture Status
  await db.ref(`tournaments/${tournamentId}/fixtures/${fixtureIndex}`).update({
    status: "completed",
    winner: rawResult.result.winner,
    resultSummary: rawResult.result.margin ? `${rawResult.result.winner} won by ${rawResult.result.margin}` : "Match tied"
  });

  // Narrative Trigger (Placeholder for Step B)
  await generateNarrative(tournamentId, rawResult);
}



async function generateNarrative(tournamentId, result) {
  const headline = result.result.margin 
    ? `${result.result.winner} dominant in victory over ${result.teamBName}`
    : `Thriller ends in tie between ${result.teamAName} and ${result.teamBName}`;
  
  await db.ref(`narratives/${tournamentId}`).push({
    headline,
    timestamp: new Date().toISOString(),
    type: "match_report"
  });
}

async function archiveTournament(tournamentId) {
  const tournamentSnap = await db.ref(`tournaments/${tournamentId}`).once("value");
  const tournament = tournamentSnap.val();
  if (!tournament) return;

  const season = tournament.season || "2026";
  const archivePath = `history/seasons/${season}/${tournamentId}`;

  // Snapshot and Move
  await db.ref(archivePath).set({
    ...tournament,
    archivedAt: new Date().toISOString(),
    finalStatus: "completed"
  });

  // Clean up live node
  await db.ref(`tournaments/${tournamentId}`).remove();
  console.log(`Tournament ${tournamentId} archived to ${archivePath}`);
}


async function advanceToPlayoffs(tournamentId) {
  const tournamentSnap = await db.ref(`tournaments/${tournamentId}`).once("value");
  const tournament = tournamentSnap.val();
  
  const sorted = standingsEngine.sortStandings(tournament.standings);
  const top4 = sorted.slice(0, 4);

  // Example IPL Style Playoffs
  const playoffs = [
    { matchId: `PLY_Q1`, teamA: top4[0], teamB: top4[1], stage: "Qualifier 1", status: "scheduled" },
    { matchId: `PLY_EL`, teamA: top4[2], teamB: top4[3], stage: "Eliminator", status: "scheduled" },
    { matchId: `PLY_Q2`, teamA: "TBD", teamB: "TBD", stage: "Qualifier 2", status: "scheduled" },
    { matchId: `PLY_FN`, teamA: "TBD", teamB: "TBD", stage: "Final", status: "scheduled" }
  ];

  await db.ref(`tournaments/${tournamentId}/fixtures`).set([...tournament.fixtures, ...playoffs]);
  await db.ref(`tournaments/${tournamentId}/stage`).set("playoffs");
}

module.exports = { createTournament, runNextMatch, processMatchResult };
