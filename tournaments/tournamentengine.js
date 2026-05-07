const db = require("../firebase");
const { startMatch } = require("../index"); // Existing match starter
const standingsEngine = require("./standingsengine");
const statsEngine = require("./statsengine");
const fixtureGenerator = require("./fixturegenerator");
const templates = require("./tournamenttemplates");

async function createTournament({ templateKey, season, teams, tournamentName, fixtures }) {
  const template = templates[templateKey];
  const tournamentId = `TOURN_${Date.now()}`;
  
  const tournamentData = {
    id: tournamentId,
    name: tournamentName || `${template.name} ${season}`,
    status: "upcoming",
    season,
    templateKey,
    format: template.format,
    teams,
    fixtures: fixtures || [],
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
    // If no more league matches, check for playoffs or finish
    if (tournament.stage === "league") {
      return advanceToPlayoffs(tournamentId);
    }
    await db.ref(`tournaments/${tournamentId}/status`).set("completed");
    return;
  }

  const fixture = tournament.fixtures[nextFixtureIndex];
  
  // Start the actual simulation
  try {
    await db.ref(`tournaments/${tournamentId}/status`).set("live");
    await db.ref(`tournaments/${tournamentId}/fixtures/${nextFixtureIndex}/status`).set("live");
    
    // Call existing matchEngine startMatch logic (this is a simplified placeholder call)
    // In index.js, we should export a way to trigger a match with these params
    const result = await startMatch(fixture.teamA, fixture.teamB, fixture.matchId, {
      matchType: tournament.overs === 20 ? "T20" : "ODI",
      overs: tournament.overs || 20
    });

    await processMatchResult(tournamentId, nextFixtureIndex, result);
  } catch (error) {
    console.error("Match simulation failed", error);
    await db.ref(`tournaments/${tournamentId}/fixtures/${nextFixtureIndex}/status`).set("failed");
  }
}

async function processMatchResult(tournamentId, fixtureIndex, result) {
  const tournamentSnap = await db.ref(`tournaments/${tournamentId}`).once("value");
  const tournament = tournamentSnap.val();

  // Update Standings
  const newStandings = standingsEngine.updateStandings(tournament.standings || {}, result);
  
  // Update Stats
  const newStats = statsEngine.updateTournamentStats(tournament.stats || { playerStats: {} }, result);

  // Update Fixture Status
  await db.ref(`tournaments/${tournamentId}/fixtures/${fixtureIndex}`).update({
    status: "completed",
    winner: result.winner,
    resultSummary: result.summary
  });

  await db.ref(`tournaments/${tournamentId}/standings`).set(newStandings);
  await db.ref(`tournaments/${tournamentId}/stats`).set(newStats);
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
