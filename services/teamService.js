/**
 * TeamService: Handles team data loading and lookup
 */
const fs = require('fs');
const path = require('path');

let teamCatalog = {};

function loadTeamCatalog() {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../teams.json'), 'utf8'));
    teamCatalog = {};
    
    // Normalize and flatten teams
    if (data.men) {
      Object.entries(data.men).forEach(([name, teamData]) => {
        const players = Array.isArray(teamData) ? teamData : (teamData.players || []);
        teamCatalog[name] = { 
          name, 
          players, 
          sourceGroup: 'men',
          ...(Array.isArray(teamData) ? {} : teamData) 
        };
      });
    }
    if (data.women) {
      Object.entries(data.women).forEach(([name, teamData]) => {
        const players = Array.isArray(teamData) ? teamData : (teamData.players || []);
        teamCatalog[name] = { 
          name, 
          players, 
          sourceGroup: 'women',
          ...(Array.isArray(teamData) ? {} : teamData) 
        };
      });
    }

    console.log(`Loaded ${Object.keys(teamCatalog).length} teams into catalog.`);
  } catch (error) {
    console.error("Error loading team catalog:", error);
  }
}

function getTeamByName(name) {
  if (!name) return null;
  // Handle common suffixes or variations
  const cleanName = name.replace(/\s*\(men\)\s*/i, '').trim();
  return teamCatalog[name] || teamCatalog[cleanName] || null;
}

// Initial load
loadTeamCatalog();

module.exports = {
  getTeamByName,
  loadTeamCatalog,
  teamCatalog
};
