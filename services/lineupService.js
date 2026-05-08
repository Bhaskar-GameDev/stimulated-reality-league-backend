const db = require('../firebase');

let firebaseLineups = {};

async function fetchLineupsFromFirebase() {
  try {
    const snapshot = await db.ref("lineups/matches").get();
    firebaseLineups = snapshot.exists() ? snapshot.val() : {};
    return firebaseLineups;
  } catch (error) {
    console.error("Failed to fetch lineups from Firebase:", error.message);
    return {};
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
