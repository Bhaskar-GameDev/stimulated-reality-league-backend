const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccount = JSON.parse(fs.readFileSync('serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://stimulated-reality-league-default-rtdb.firebaseio.com/"
});

const db = admin.database();

async function test() {
  try {
    console.log("Attempting to write to /test...");
    await db.ref("test").set({ timestamp: Date.now(), message: "Hello from Backend" });
    console.log("Write successful!");
    
    console.log("Attempting to read from /test...");
    const snap = await db.ref("test").get();
    console.log("Read successful! Data:", snap.val());
  } catch (err) {
    console.error("Firebase Test Failed:", err.message);
    if (err.stack) console.error(err.stack);
  }
  process.exit(0);
}

test();
