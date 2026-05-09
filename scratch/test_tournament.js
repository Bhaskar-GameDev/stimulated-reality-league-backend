const fs = require("fs");
const path = require("path");
const db = require("../firebase");
const tournamentEngine = require("../tournaments/tournamentengine");
const teamsData = require("../teams.json");

const { teamCatalog } = require("../services/teamService");

async function runTest() {
  console.log("--- Tournament Test Initialization ---");
  
  // Select 8 available teams
  const selectedTeamNames = [
    "India (men)", 
    "Australia (men)", 
    "New Zealand (men)", 
    "South Africa (men)", 
    "Pakistan (men)", 
    "England (men)",
    "West Indies (men)",
    "Sri Lanka (men)"
  ];

  const teams = selectedTeamNames.map(name => teamCatalog[name]).filter(Boolean);
  
  if (teams.length < 8) {
    console.error("Could not find all required teams in catalog.");
    console.log("Available teams:", Object.keys(teamCatalog));
    process.exit(1);
  }

  // Create Tournament with 1 over limit
  const tournamentId = await tournamentEngine.createTournament({
    templateKey: "WORLD_CUP",
    season: "2026-TEST",
    teams: teams,
    tournamentName: "ICC T20 World Cup (1 Over Test)",
    startDate: new Date(),
    country: "India",
    overs: 1 // SETTING OVERS TO 1 AS REQUESTED
  });

  console.log(`Tournament created successfully! ID: ${tournamentId}`);
  
  // Schedule matches one after the other (instantly)
  const tournamentSnap = await db.ref(`tournaments/${tournamentId}`).once("value");
  const tournament = tournamentSnap.val();
  
  if (tournament && tournament.fixtures) {
    console.log(`Scheduling ${tournament.fixtures.length} matches sequentially...`);
    
    const now = Date.now();
    const updates = {};
    
    tournament.fixtures.forEach((fixture, index) => {
      // Each match scheduled 1 minute after the previous one, starting from now
      // This ensures they are "due" for the runner
      const scheduledTime = new Date(now + (index * 60000)).toISOString();
      updates[`fixtures/${index}/utcTimestamp`] = scheduledTime;
    });

    await db.ref(`tournaments/${tournamentId}`).update(updates);
    console.log("All matches updated to start sequentially (1 min apart).");
  }

  console.log("\nTo run the tournament matches one by one, you can call tournamentEngine.runNextMatch(tournamentId) in a loop.");
  console.log("Do you want to run the first 3 matches now for testing? (y/n)");
  
  // For now, let's just finish the setup as requested.
  // The user can run index.js or a separate runner to execute matches.
  
  console.log(`\nSetup complete. Tournament ID: ${tournamentId}`);
  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
