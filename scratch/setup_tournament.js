const fs = require("fs");
const path = require("path");
const db = require("../firebase");
const tournamentEngine = require("../tournaments/tournamentengine");
const teamsData = require("../teams.json");

// Helper to build team catalog similar to index.js
function buildTeamCatalog(source) {
  console.log("Building catalog from teams data...");
  const collections = Object.entries(source || {})
    .filter(([, teams]) => teams && typeof teams === "object" && !Array.isArray(teams));
  const catalog = {};
  collections.forEach(([groupName, teams]) => {
    Object.entries(teams).forEach(([teamName, players]) => {
      const displayName = `${teamName} (${groupName})`;
      catalog[displayName] = { name: displayName, id: displayName }; 
    });
  });
  return catalog;
}

async function setup() {
  console.log("Setting up tournament...");
  const saPath = path.join(__dirname, "../serviceAccountKey.json");
  console.log("Checking service account at:", saPath);
  if (fs.existsSync(saPath)) {
    console.log("Service account file found.");
  } else {
    console.error("Service account file NOT found.");
  }

  const catalog = buildTeamCatalog(teamsData);
  
  // Select 6 top teams
  const selectedTeamNames = [
    "India (men)", 
    "Australia (men)", 
    "New Zealand (men)", 
    "South Africa (men)", 
    "Pakistan (men)", 
    "England (men)"
  ];

  const teams = selectedTeamNames.map(name => catalog[name]).filter(Boolean);
  
  if (teams.length < 6) {
    console.error("Could not find all required teams in catalog.");
    process.exit(1);
  }

  // Create Tournament
  // Template WORLD_CUP with 2 groups (3 teams each)
  const tournamentId = await tournamentEngine.createTournament({
    templateKey: "WORLD_CUP",
    season: "2026",
    teams: teams,
    tournamentName: "Stimulated Reality Cup 2026",
    startDate: new Date(), // Start from today
    country: "India"
  });

  console.log(`Tournament created successfully! ID: ${tournamentId}`);
  
  // Update the first fixture to be due NOW so the user sees it starting
  const tournamentSnap = await db.ref(`tournaments/${tournamentId}`).once("value");
  const tournament = tournamentSnap.val();
  
  if (tournament && tournament.matchOrder && tournament.matchOrder.length > 0) {
    const firstMatchId = tournament.matchOrder[0];
    // Set the first match to 5 minutes ago
    const pastDate = new Date(Date.now() - 5 * 60000).toISOString();
    await db.ref(`tournaments/${tournamentId}/matches/${firstMatchId}`).update({
      utcTimestamp: pastDate
    });
    console.log("Updated the first match to start immediately.");
  }

  process.exit(0);
}

setup().catch(err => {
  console.error(err);
  process.exit(1);
});
