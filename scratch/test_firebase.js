const db = require("../firebase");

async function check() {
    try {
        const snapshot = await db.ref(".info/connected").get();
        console.log("Connected:", snapshot.val());
        process.exit(0);
    } catch (e) {
        console.error("Connection failed:", e);
        process.exit(1);
    }
}
check();
