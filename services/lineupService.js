const db = require('../firebase');
const fs = require('fs');
const path = require('path');

const LOCAL_LINEUPS_PATH = path.join(__dirname, '../saved_lineups.json');


let firebaseLineups = {};

async function fetchLineupsFromFirebase() {
  try {
    const snapshot = await db.ref("lineups/matches").get();
    firebaseLineups = snapshot.exists() ? snapshot.val() : {};
    console.log("Lineups fetched from Firebase.");
    return firebaseLineups;
  } catch (error) {
    console.error("Failed to fetch lineups from Firebase, using local fallback:", error.message);
    try {
      if (fs.existsSync(LOCAL_LINEUPS_PATH)) {
        firebaseLineups = JSON.parse(fs.readFileSync(LOCAL_LINEUPS_PATH, 'utf8'));
        console.log("Lineups loaded from local fallback.");
      }
    } catch (localErr) {
      console.error("Failed to load local lineups:", localErr.message);
    }
    return firebaseLineups;
  }
}

// Initial fetch
fetchLineupsFromFirebase();

// Update every minute
setInterval(fetchLineupsFromFirebase, 60000);

function getLineup(teamName) {
  return firebaseLineups[teamName] || null;
}

async function saveLineup(teamName, lineupIds) {
  try {
    await db.ref(`lineups/matches/${teamName}`).set(lineupIds);
    firebaseLineups[teamName] = lineupIds;
  } catch (error) {
    console.error("Failed to save lineup to Firebase:", error.message);
    throw error;
  }
}

module.exports = {
  fetchLineupsFromFirebase,
  getLineup,
  saveLineup,
  getAllLineups: () => firebaseLineups
};
