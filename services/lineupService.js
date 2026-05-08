const db = require('../firebase');

let firebaseLineups = {};

/**
 * Fetches all lineups from the 'lineups' node in Firebase.
 * The user has updated these manually or via external tools.
 */
async function fetchLineupsFromFirebase() {
  try {
    const snapshot = await db.ref("lineups").get();
    firebaseLineups = snapshot.exists() ? snapshot.val() : {};
    console.log("Lineups fetched from Firebase.");
    return firebaseLineups;
  } catch (error) {
    console.error("Failed to fetch lineups from Firebase:", error.message);
    return firebaseLineups;
  }
}

// Initial fetch
fetchLineupsFromFirebase();

// Update every minute to stay in sync with manual Firebase changes
setInterval(fetchLineupsFromFirebase, 60000);

function getLineup(teamName) {
  return firebaseLineups[teamName] || null;
}

/**
 * Saves a lineup to Firebase. 
 * Note: The user mentioned having updated these in Firebase, 
 * but we keep this for potential programmatic updates.
 */
async function saveLineup(teamName, lineupIds) {
  try {
    await db.ref(`lineups/${teamName}`).set(lineupIds);
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

