/**
 * TeamService: Handles team data loading and lookup
 */
const fs = require('fs');
const path = require('path');

const teamCatalog = {};

function loadTeamCatalog() {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../teams.json'), 'utf8'));
    // Clear existing data without reassigning the object reference
    Object.keys(teamCatalog).forEach(key => delete teamCatalog[key]);
    

    
    // Normalize and flatten teams
    if (data.men) {
      Object.entries(data.men).forEach(([name, teamData]) => {
        const players = Array.isArray(teamData) ? teamData : (teamData.players || []);
        const displayName = `${name} (men)`;
        teamCatalog[displayName] = { 
          name: displayName, 
          players, 
          sourceGroup: 'men',
          ...(Array.isArray(teamData) ? {} : teamData) 
        };
      });
    }
    if (data.women) {
      Object.entries(data.women).forEach(([name, teamData]) => {
        const players = Array.isArray(teamData) ? teamData : (teamData.players || []);
        const displayName = `${name} (women)`;
        teamCatalog[displayName] = { 
          name: displayName, 
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
  
  // 1. Try exact match (includes suffixed names)
  if (teamCatalog[name]) return teamCatalog[name];

  // 2. Try adding (men) suffix if no suffix is present
  if (!name.includes('(')) {
    const menName = `${name} (men)`;
    if (teamCatalog[menName]) return teamCatalog[menName];
    
    const womenName = `${name} (women)`;
    if (teamCatalog[womenName]) return teamCatalog[womenName];
  }

  // 3. Last resort: fuzzy search
  const cleanName = name.replace(/\s*\(.*?\)\s*/, "").trim().toLowerCase();
  const entry = Object.values(teamCatalog).find(t => {
    const tClean = t.name.replace(/\s*\(.*?\)\s*/, "").trim().toLowerCase();
    return tClean === cleanName;
  });

  return entry || null;
}


// Initial load
loadTeamCatalog();

module.exports = {
  getTeamByName,
  loadTeamCatalog,
  teamCatalog
};
