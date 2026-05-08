const fs = require('fs');
const db = require('../firebase');

async function sync() {
    console.log("Reading saved_lineups.json...");
    const lineups = JSON.parse(fs.readFileSync('saved_lineups.json', 'utf8'));
    
    console.log("Syncing to Firebase lineups/matches...");
    try {
        await db.ref("lineups/matches").set(lineups);
        console.log("Successfully synced all lineups to Firebase.");
    } catch (err) {
        console.error("Failed to sync to Firebase:", err.message);
        if (err.message.includes("Invalid JWT Signature")) {
            console.log("\nTIP: This error often means the system time is out of sync or the service account key is invalid.");
        }
    }
    process.exit(0);
}

sync();
