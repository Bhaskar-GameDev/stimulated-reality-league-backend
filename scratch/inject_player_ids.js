const fs = require('fs');
const crypto = require('crypto');

const data = JSON.parse(fs.readFileSync('teams.json', 'utf8'));

let idCount = 0;

function generateId(teamName, playerName) {
  // Create a stable hash for the player
  return 'PL_' + crypto.createHash('md5').update(`${teamName}_${playerName}`).digest('hex').slice(0, 10);
}

// Process Men
for (const [teamName, teamData] of Object.entries(data.men || {})) {
  if (Array.isArray(teamData)) {
    // Some formats might have direct array
    teamData.forEach(player => {
      if (!player.id) {
        player.id = generateId(teamName, player.name);
        idCount++;
      }
    });
  } else if (teamData.players) {
    teamData.players.forEach(player => {
      if (!player.id) {
        player.id = generateId(teamName, player.name);
        idCount++;
      }
    });
  }
}

// Process Women
for (const [teamName, teamData] of Object.entries(data.women || {})) {
  if (Array.isArray(teamData)) {
    teamData.forEach(player => {
      if (!player.id) {
        player.id = generateId(teamName, player.name);
        idCount++;
      }
    });
  } else if (teamData.players) {
    teamData.players.forEach(player => {
      if (!player.id) {
        player.id = generateId(teamName, player.name);
        idCount++;
      }
    });
  }
}

fs.writeFileSync('teams.json', JSON.stringify(data, null, 2), 'utf8');
console.log(`Injected ${idCount} missing IDs into teams.json`);
