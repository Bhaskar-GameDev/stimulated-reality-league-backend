const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const DEFAULT_DATABASE_URL = "https://stimulated-reality-league-default-rtdb.firebaseio.com/";

function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (error) {
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT JSON: ${error.message}`);
    }
  }

  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  const fallbackPath = path.join(__dirname, "serviceAccountKey.json");
  const serviceAccountPath = configuredPath ? path.resolve(configuredPath) : fallbackPath;

  if (!fs.existsSync(serviceAccountPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read Firebase credentials from ${serviceAccountPath}: ${error.message}`);
  }
}

function buildCredential() {
  const serviceAccount = loadServiceAccount();
  if (serviceAccount) {
    return admin.credential.cert(serviceAccount);
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.credential.applicationDefault();
  }

  throw new Error(
    "Firebase credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT, FIREBASE_SERVICE_ACCOUNT_PATH, or GOOGLE_APPLICATION_CREDENTIALS."
  );
}

function getDatabaseUrl() {
  return process.env.FIREBASE_DATABASE_URL || DEFAULT_DATABASE_URL;
}

function initializeFirebase() {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: buildCredential(),
      databaseURL: getDatabaseUrl()
    });
  }

  return admin.database();
}

module.exports = initializeFirebase();
