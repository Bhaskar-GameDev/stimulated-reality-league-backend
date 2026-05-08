const db = require("../firebase");

async function clearNodes() {
    console.log("Starting Firebase cleanup...");
    
    try {
        console.log("Clearing 'matches' node...");
        await db.ref("matches").set(null);
        console.log("Successfully cleared 'matches'.");

        console.log("Clearing 'tournaments' node...");
        await db.ref("tournaments").set(null);
        console.log("Successfully cleared 'tournaments'.");

        console.log("Cleanup complete. Exiting...");
        process.exit(0);
    } catch (error) {
        console.error("Error during cleanup:", error);
        process.exit(1);
    }
}

clearNodes();
