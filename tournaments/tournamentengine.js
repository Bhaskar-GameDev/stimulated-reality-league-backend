const db = require("../firebase");
const { startMatch, resolvePlayingXI, buildMatchPlayer } = require("../services/matchService");
const { getTeamByName } = require("../services/teamService");

const standingsEngine = require("./standingsengine");
const statsEngine = require("./statsengine");
const fixtureGenerator = require("./fixturegenerator");
const templates = require("./tournamenttemplates");

async function createTournament({ templateKey, season, teams, tournamentName, fixtures, startDate, country, overs, autoMode }) {
  const template = templates[templateKey];
  const tournamentId = `TOURN_${Date.now()}`;
  
  // Generate fixtures if not provided
  let tournamentFixtures = fixtures;
  if (!tournamentFixtures || tournamentFixtures.length === 0) {
    tournamentFixtures = fixtureGenerator.createFullTournamentSchedule(teams, {
      format: template.format,
      rounds: template.rounds || 1,
      groupCount: template.groupCount, // Pass groupCount from template
      startDate: startDate || new Date(),
      country: country || template.defaultCountry || "India"
    });
  }

  const tournamentData = {
    id: tournamentId,
    name: tournamentName || `${template.name} ${season}`,
    status: "upcoming",
    stage: template.format === "group_knockout" ? "league" : "league",
    season,
    templateKey,
    autoMode: !!autoMode,
    format: template.format,
    overs: overs || template.overs || 20, // Use provided overs or template default
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
  
  // REAL-TIME CHECK: Only run if the match is due (unless autoMode is on)
  const now = new Date();
  const scheduledTime = new Date(fixture.utcTimestamp);
  
  if (!tournament.autoMode && now < scheduledTime) {
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
    
    // If auto-mode, trigger next match after a small delay
    if (tournament.autoMode) {
      setTimeout(() => runNextMatch(tournamentId), 2000);
    }

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
    teamBOvers: parseFloat(rawResult.secondInnings.overs),
    group: fixture.group || "A"
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

  // Knockout propagation logic
  const currentFixturesSnap = await db.ref(`tournaments/${tournamentId}/fixtures`).once("value");
  const fixtures = currentFixturesSnap.val() || [];
  let fixturesChanged = false;

  const winnerSF1 = fixtures.find(f => f.matchId === "SF1")?.winner;
  const winnerSF2 = fixtures.find(f => f.matchId === "SF2")?.winner;
  const winnerQ1 = fixtures.find(f => f.matchId === "PLY_Q1")?.winner;
  const winnerEL = fixtures.find(f => f.matchId === "PLY_EL")?.winner;

  fixtures.forEach((f, idx) => {
    if (f.status !== "scheduled") return;

    if (f.matchId === "FINAL" && tournament.format === "group_knockout") {
      if (winnerSF1 && f.teamA.name === "TBD") { f.teamA = { id: winnerSF1, name: winnerSF1 }; fixturesChanged = true; }
      if (winnerSF2 && f.teamB.name === "TBD") { f.teamB = { id: winnerSF2, name: winnerSF2 }; fixturesChanged = true; }
    }
    
    if (tournament.format === "league") { // IPL Style
      if (f.matchId === "PLY_Q2") {
        const loserQ1 = fixtures.find(fi => fi.matchId === "PLY_Q1")?.winner === fixtures.find(fi => fi.matchId === "PLY_Q1")?.teamA.name 
          ? fixtures.find(fi => fi.matchId === "PLY_Q1")?.teamB 
          : fixtures.find(fi => fi.matchId === "PLY_Q1")?.teamA;
        if (loserQ1 && f.teamA.name === "TBD") { f.teamA = loserQ1; fixturesChanged = true; }
        if (winnerEL && f.teamB.name === "TBD") { f.teamB = { id: winnerEL, name: winnerEL }; fixturesChanged = true; }
      }
      if (f.matchId === "PLY_FN") {
        const winnerQ2 = fixtures.find(fi => fi.matchId === "PLY_Q2")?.winner;
        if (winnerQ1 && f.teamA.name === "TBD") { f.teamA = { id: winnerQ1, name: winnerQ1 }; fixturesChanged = true; }
        if (winnerQ2 && f.teamB.name === "TBD") { f.teamB = { id: winnerQ2, name: winnerQ2 }; fixturesChanged = true; }
      }
    }
  });

  if (fixturesChanged) {
    await db.ref(`tournaments/${tournamentId}/fixtures`).set(fixtures);
  }

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
  
  if (tournament.format === "group_knockout") {
    const groupStandings = standingsEngine.getGroupStandings(tournament.standings);
    const winners = Object.keys(groupStandings).map(g => groupStandings[g][0]);

    // Semi Finals for World Cup (4 groups)
    const playoffs = [
      { 
        matchId: `SF1`, 
        teamA: { id: winners[0].teamId, name: winners[0].teamName }, 
        teamB: { id: winners[1].teamId, name: winners[1].teamName }, 
        stage: "Semi Final 1", status: "scheduled", utcTimestamp: new Date().toISOString() 
      },
      { 
        matchId: `SF2`, 
        teamA: { id: winners[2].teamId, name: winners[2].teamName }, 
        teamB: { id: winners[3].teamId, name: winners[3].teamName }, 
        stage: "Semi Final 2", status: "scheduled", utcTimestamp: new Date().toISOString() 
      },
      { 
        matchId: `FINAL`, 
        teamA: { id: "TBD", name: "TBD" }, 
        teamB: { id: "TBD", name: "TBD" }, 
        stage: "Final", status: "scheduled", utcTimestamp: new Date().toISOString() 
      }
    ];

    await db.ref(`tournaments/${tournamentId}/fixtures`).set([...tournament.fixtures, ...playoffs]);
    await db.ref(`tournaments/${tournamentId}/stage`).set("playoffs");
  } else {
    // IPL Style Playoffs
    const sorted = standingsEngine.sortStandings(tournament.standings);
    const top4 = sorted.slice(0, 4);

    const playoffs = [
      { 
        matchId: `PLY_Q1`, 
        teamA: { id: top4[0].teamId, name: top4[0].teamName }, 
        teamB: { id: top4[1].teamId, name: top4[1].teamName }, 
        stage: "Qualifier 1", status: "scheduled", utcTimestamp: new Date().toISOString() 
      },
      { 
        matchId: `PLY_EL`, 
        teamA: { id: top4[2].teamId, name: top4[2].teamName }, 
        teamB: { id: top4[3].teamId, name: top4[3].teamName }, 
        stage: "Eliminator", status: "scheduled", utcTimestamp: new Date().toISOString() 
      },
      { 
        matchId: `PLY_Q2`, teamA: { id: "TBD", name: "TBD" }, teamB: { id: "TBD", name: "TBD" }, 
        stage: "Qualifier 2", status: "scheduled", utcTimestamp: new Date().toISOString() 
      },
      { 
        matchId: `PLY_FN`, teamA: { id: "TBD", name: "TBD" }, teamB: { id: "TBD", name: "TBD" }, 
        stage: "Final", status: "scheduled", utcTimestamp: new Date().toISOString() 
      }
    ];

    await db.ref(`tournaments/${tournamentId}/fixtures`).set([...tournament.fixtures, ...playoffs]);
    await db.ref(`tournaments/${tournamentId}/stage`).set("playoffs");
  }
}

module.exports = { createTournament, runNextMatch, processMatchResult };
