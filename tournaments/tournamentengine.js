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

  // If autoMode is enabled, override all fixture timestamps to 'now' for immediate sequential execution
  if (autoMode) {
    const now = new Date().toISOString();
    tournamentFixtures = tournamentFixtures.map(f => ({ ...f, utcTimestamp: now }));
  }

  const matches = {};
  const matchOrder = [];
  tournamentFixtures.forEach(f => {
    matches[f.matchId] = f;
    matchOrder.push(f.matchId);
  });

  const tournamentData = {
    id: tournamentId,
    name: tournamentName || `${template.name} ${season}`,
    status: "upcoming",
    stage: template.format === "group_knockout" ? "league" : "league",
    season,
    templateKey,
    autoMode: !!autoMode,
    format: template.format,
    overs: overs || template.overs || 20,
    teams,
    matches,
    matchOrder,
    standings: {},
    stats: { playerStats: {} },
    currentRound: 1,
    winner: "TBA",
    createdAt: new Date().toISOString()
  };

  await db.ref(`tournaments/${tournamentId}`).set(tournamentData);
  
  // Create lightweight index for listing
  await db.ref(`tournaments_list/${tournamentId}`).set({
    id: tournamentData.id,
    name: tournamentData.name,
    status: tournamentData.status,
    season: tournamentData.season,
    format: tournamentData.format
  });

  return tournamentId;
}

async function runNextMatch(tournamentId) {
  const tournamentSnap = await db.ref(`tournaments/${tournamentId}`).once("value");
  const tournament = tournamentSnap.val();
  if (tournament.status === "completed") return;

  const matches = tournament.matches;
  const scheduledMatchId = tournament.matchOrder.find(id => matches[id].status === "scheduled");
  const liveMatchId = tournament.matchOrder.find(id => matches[id].status === "live");

  if (!scheduledMatchId) {
    if (liveMatchId) {
      console.log(`Tournament ${tournamentId} is waiting for live match ${liveMatchId} to complete.`);
      return { status: "waiting", message: "Live match in progress" };
    }

    if (tournament.stage === "league") {
      return advanceToPlayoffs(tournamentId);
    }
    await db.ref(`tournaments/${tournamentId}/status`).set("completed");
    await db.ref(`tournaments_list/${tournamentId}/status`).set("completed");
    return;
  }

  const fixture = matches[scheduledMatchId];
  
  // REAL-TIME CHECK: Only run if the match is due (unless autoMode is on)
  const now = new Date();
  const scheduledTime = new Date(fixture.utcTimestamp);
  
  if (!tournament.autoMode && now < scheduledTime) {
    console.log(`Match ${fixture.matchId} is scheduled for ${fixture.utcTimestamp}. Waiting...`);
    return { status: "waiting", scheduledTime: fixture.utcTimestamp };
  }

  // Safety check: Don't run if teams are not yet decided (TBD)
  if (fixture.teamA.id === "TBD" || fixture.teamB.id === "TBD") {
    console.log(`Match ${fixture.matchId} is waiting for teams to be decided.`);
    return { status: "waiting", message: "Teams not yet decided" };
  }

  try {
    await db.ref(`tournaments/${tournamentId}/status`).set("live");
    await db.ref(`tournaments_list/${tournamentId}/status`).set("live");
    await db.ref(`tournaments/${tournamentId}/matches/${fixture.matchId}/status`).set("live");
    
    // Resolve players for both teams
    const teamAEntry = getTeamByName(fixture.teamA.name);
    const teamBEntry = getTeamByName(fixture.teamB.name);
    
    if (!teamAEntry || !teamBEntry) {
      throw new Error(`Teams ${fixture.teamA.name} or ${fixture.teamB.name} not found in catalog.`);
    }

    const format = tournament.overs === 20 ? "T20" : (tournament.overs === 50 ? "ODI" : "TEST");
    const teamAPlayers = resolvePlayingXI(teamAEntry, [], format);
    const teamBPlayers = resolvePlayingXI(teamBEntry, [], format);

    // Call match engine
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

    await processMatchResult(tournamentId, fixture.matchId, result);
    
    if (tournament.autoMode) {
      setTimeout(() => runNextMatch(tournamentId), 2000);
    }

    return { status: "completed", matchId: fixture.matchId };
  } catch (error) {
    console.error("Match simulation failed", error);
    await db.ref(`tournaments/${tournamentId}/matches/${fixture.matchId}/status`).set("failed");
    return { status: "failed", error: error.message };
  }
}

async function processMatchResult(tournamentId, matchId, rawResult) {
  const tournamentSnap = await db.ref(`tournaments/${tournamentId}`).once("value");
  const tournament = tournamentSnap.val();
  const fixture = tournament.matches[matchId];

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

  // Update Standings
  const newStandings = standingsEngine.updateStandings(tournament.standings || {}, standingsResult);
  await db.ref(`tournaments/${tournamentId}/standings`).set(newStandings);
  
  // Update Stats
  const newStats = statsEngine.updateTournamentStats(tournament.stats || { playerStats: {} }, rawResult);
  await db.ref(`tournaments/${tournamentId}/stats`).set(newStats);

  // Update Fixture Status
  await db.ref(`tournaments/${tournamentId}/matches/${matchId}`).update({
    status: "completed",
    winner: rawResult.result.winner,
    resultSummary: rawResult.result.margin ? `${rawResult.result.winner} won by ${rawResult.result.margin}` : "Match tied"
  });

  // Knockout propagation logic
  const matches = tournament.matches;
  matches[matchId].status = "completed";
  matches[matchId].winner = rawResult.result.winner;
  
  let matchesChanged = false;

  const winnerSF1 = matches["SF1"]?.winner;
  const winnerSF2 = matches["SF2"]?.winner;
  const winnerQ1 = matches["PLY_Q1"]?.winner;
  const winnerEL = matches["PLY_EL"]?.winner;

  // Late-fill TBD teams from standings if advanceToPlayoffs ran early
  const groupStandings = standingsEngine.getGroupStandings(newStandings);
  const sortedStandings = standingsEngine.sortStandings(newStandings);

  Object.keys(matches).forEach(id => {
    const f = matches[id];
    if (f.status !== "scheduled") return;

    // Fill SF/Knockouts from standings if they are still TBD
    if (tournament.format === "group_knockout") {
      const gA = groupStandings["A"] || [];
      const gB = groupStandings["B"] || [];
      if (id === "SF1") {
        if (gA[0] && f.teamA.name === "TBD") { f.teamA = { id: gA[0].teamId, name: gA[0].teamName }; matchesChanged = true; }
        if (gB[1] && f.teamB.name === "TBD") { f.teamB = { id: gB[1].teamId, name: gB[1].teamName }; matchesChanged = true; }
      }
      if (id === "SF2") {
        if (gB[0] && f.teamA.name === "TBD") { f.teamA = { id: gB[0].teamId, name: gB[0].teamName }; matchesChanged = true; }
        if (gA[1] && f.teamB.name === "TBD") { f.teamB = { id: gA[1].teamId, name: gA[1].teamName }; matchesChanged = true; }
      }
    }

    if (id === "FINAL" && tournament.format === "group_knockout") {
      if (winnerSF1 && f.teamA.name === "TBD") { f.teamA = { id: winnerSF1, name: winnerSF1 }; matchesChanged = true; }
      if (winnerSF2 && f.teamB.name === "TBD") { f.teamB = { id: winnerSF2, name: winnerSF2 }; matchesChanged = true; }
    }
    
    if (tournament.format === "league") { // IPL Style
      if (id === "PLY_Q1") {
        if (sortedStandings[0] && f.teamA.name === "TBD") { f.teamA = { id: sortedStandings[0].teamId, name: sortedStandings[0].teamName }; matchesChanged = true; }
        if (sortedStandings[1] && f.teamB.name === "TBD") { f.teamB = { id: sortedStandings[1].teamId, name: sortedStandings[1].teamName }; matchesChanged = true; }
      }
      if (id === "PLY_EL") {
        if (sortedStandings[2] && f.teamA.name === "TBD") { f.teamA = { id: sortedStandings[2].teamId, name: sortedStandings[2].teamName }; matchesChanged = true; }
        if (sortedStandings[3] && f.teamB.name === "TBD") { f.teamB = { id: sortedStandings[3].teamId, name: sortedStandings[3].teamName }; matchesChanged = true; }
      }
      if (id === "PLY_Q2") {
        const q1Match = matches["PLY_Q1"];
        const loserQ1 = q1Match?.winner === q1Match?.teamA.name ? q1Match?.teamB : q1Match?.teamA;
        if (loserQ1 && f.teamA.name === "TBD") { f.teamA = loserQ1; matchesChanged = true; }
        if (winnerEL && f.teamB.name === "TBD") { f.teamB = { id: winnerEL, name: winnerEL }; matchesChanged = true; }
      }
      if (id === "PLY_FN") {
        const winnerQ2 = matches["PLY_Q2"]?.winner;
        if (winnerQ1 && f.teamA.name === "TBD") { f.teamA = { id: winnerQ1, name: winnerQ1 }; matchesChanged = true; }
        if (winnerQ2 && f.teamB.name === "TBD") { f.teamB = { id: winnerQ2, name: winnerQ2 }; matchesChanged = true; }
      }
    }
  });

  // Update tournament winner if this was the final match
  if (matchId === "FINAL" || matchId === "PLY_FN") {
    await db.ref(`tournaments/${tournamentId}/winner`).set(rawResult.result.winner);
    await db.ref(`tournaments/${tournamentId}/status`).set("completed");
    await db.ref(`tournaments_list/${tournamentId}/status`).set("completed");
  }

  if (matchesChanged) {
    await db.ref(`tournaments/${tournamentId}/matches`).set(matches);
  }

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
  await db.ref(`tournaments_list/${tournamentId}`).remove();
  console.log(`Tournament ${tournamentId} archived to ${archivePath}`);
}


async function advanceToPlayoffs(tournamentId) {
  const tournamentSnap = await db.ref(`tournaments/${tournamentId}`).once("value");
  const tournament = tournamentSnap.val();
  
  if (tournament.format === "group_knockout") {
    const groupStandings = standingsEngine.getGroupStandings(tournament.standings);
    const groupA = groupStandings["A"] || [];
    const groupB = groupStandings["B"] || [];

    if (groupA.length < 2 || groupB.length < 2) {
      console.warn("Not enough teams in groups for semi-finals. Advancing top winners.");
    }

    const A1 = groupA[0] || { teamId: "TBD", teamName: "TBD" };
    const A2 = groupA[1] || { teamId: "TBD", teamName: "TBD" };
    const B1 = groupB[0] || { teamId: "TBD", teamName: "TBD" };
    const B2 = groupB[1] || { teamId: "TBD", teamName: "TBD" };

    // Semi Finals (Cross-group: A1 vs B2, B1 vs A2)
    const playoffs = [
      { 
        matchId: `SF1`, 
        teamA: { id: A1.teamId, name: A1.teamName }, 
        teamB: { id: B2.teamId, name: B2.teamName }, 
        stage: "Semi Final 1", status: "scheduled", utcTimestamp: new Date().toISOString() 
      },
      { 
        matchId: `SF2`, 
        teamA: { id: B1.teamId, name: B1.teamName }, 
        teamB: { id: A2.teamId, name: A2.teamName }, 
        stage: "Semi Final 2", status: "scheduled", utcTimestamp: new Date().toISOString() 
      },
      { 
        matchId: `FINAL`, 
        teamA: { id: "TBD", name: "TBD" }, 
        teamB: { id: "TBD", name: "TBD" }, 
        stage: "Final", status: "scheduled", utcTimestamp: new Date().toISOString() 
      }
    ];

    const updates = {};
    const newMatchOrder = [...(tournament.matchOrder || [])];
    playoffs.forEach(p => {
      updates[`matches/${p.matchId}`] = p;
      newMatchOrder.push(p.matchId);
    });
    updates["matchOrder"] = newMatchOrder;
    updates["stage"] = "playoffs";

    await db.ref(`tournaments/${tournamentId}`).update(updates);
  } else {
    // IPL Style Playoffs
    const sorted = standingsEngine.sortStandings(tournament.standings);
    const top4 = sorted.slice(0, 4);
    const t1 = top4[0] || { teamId: "TBD", teamName: "TBD" };
    const t2 = top4[1] || { teamId: "TBD", teamName: "TBD" };
    const t3 = top4[2] || { teamId: "TBD", teamName: "TBD" };
    const t4 = top4[3] || { teamId: "TBD", teamName: "TBD" };

    const playoffs = [
      { 
        matchId: `PLY_Q1`, 
        teamA: { id: t1.teamId, name: t1.teamName }, 
        teamB: { id: t2.teamId, name: t2.teamName }, 
        stage: "Qualifier 1", status: "scheduled", utcTimestamp: new Date().toISOString() 
      },
      { 
        matchId: `PLY_EL`, 
        teamA: { id: t3.teamId, name: t3.teamName }, 
        teamB: { id: t4.teamId, name: t4.teamName }, 
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

    const updates = {};
    const newMatchOrder = [...(tournament.matchOrder || [])];
    playoffs.forEach(p => {
      updates[`matches/${p.matchId}`] = p;
      newMatchOrder.push(p.matchId);
    });
    updates["matchOrder"] = newMatchOrder;
    updates["stage"] = "playoffs";

    await db.ref(`tournaments/${tournamentId}`).update(updates);
  }
}

module.exports = { createTournament, runNextMatch, processMatchResult };
