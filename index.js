const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { exec } = require("child_process");
const crypto = require("crypto");
const { startMatch, pushScorecard } = require("./matchEngine");
const db = require("./firebase");
const teamsData = require("./teams.json");
const { buildHtmlPage } = require("./ui/page");
const lineupService = require("./services/lineupService");
const matchService = require("./services/matchService");
const tournamentEngine = require("./tournaments/tournamentengine");
const fixtureGenerator = require("./tournaments/fixturegenerator");
const standingsEngine = require("./tournaments/standingsengine");
const statsEngine = require("./tournaments/statsengine");
const templates = require("./tournaments/tournamenttemplates");

let PORT = Number(process.env.PORT || 3000);
const serverStartedAt = new Date().toISOString();
const STORAGE_PATH = path.join(__dirname, "schedules.json");

// Poll for due tournament matches every 30 seconds
setInterval(async () => {
  try {
    const tournamentsSnap = await db.ref("tournaments").once("value");
    const tournaments = tournamentsSnap.val();
    if (!tournaments) return;

    for (const tId of Object.keys(tournaments)) {
      if (tournaments[tId].status !== "completed") {
        await tournamentEngine.runNextMatch(tId);
      }
    }
  } catch (err) {
    console.error("Tournament poll failed:", err);
  }
}, 30000);

// Centralized Logger
const logger = {
  info: (msg, meta = {}) => {
    const traceId = meta.traceId ? `[TraceID: ${meta.traceId}] ` : "";
    const duration = meta.duration ? ` [${meta.duration}ms]` : "";
    console.log(`[INFO] [${new Date().toISOString()}] ${traceId}${msg}${duration}`, Object.keys(meta).filter(k => k !== 'traceId' && k !== 'duration').length ? meta : "");
  },
  error: (msg, err, meta = {}) => {
    const traceId = meta.traceId ? `[TraceID: ${meta.traceId}] ` : "";
    console.error(`[ERROR] [${new Date().toISOString()}] ${traceId}${msg}`, err?.stack || err, Object.keys(meta).filter(k => k !== 'traceId').length ? meta : "");
  },
  warn: (msg, meta = {}) => {
    const traceId = meta.traceId ? `[TraceID: ${meta.traceId}] ` : "";
    console.warn(`[WARN] [${new Date().toISOString()}] ${traceId}${msg}`, Object.keys(meta).filter(k => k !== 'traceId').length ? meta : "");
  },
  match: (matchId, msg) => console.log(`[MATCH:${matchId}] [${new Date().toISOString()}] ${msg}`)
};

const MAX_LOG_ITEMS = 150;
const teamCatalog = buildTeamCatalog(teamsData);
const teamOptions = Object.values(teamCatalog)
  .map(team => ({
    name: team.name,
    gender: team.sourceGroup || "men",
    players: team.players.map(player => ({
      id: player.id,
      name: player.name,
      role: player.role,
      type: player.type
    }))
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

let activeMatches = new Map(); // matchId -> match state object
let schedules = loadSchedules();
let scheduledJobs = {};
let liveLogs = [];
let nextScheduleId = schedules.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;

restoreScheduledJobs();

const matchTypes = [
  { key: "T20", label: "T20", overs: 20 },
  { key: "ODI", label: "ODI", overs: 50 },
  { key: "Test", label: "Test", overs: 90 }
];

function loadSchedules() {
  try {
    const text = fs.readFileSync(STORAGE_PATH, "utf8");
    const items = JSON.parse(text);
    if (Array.isArray(items)) return items;
  } catch (error) {
    // ignore missing or invalid storage file
  }
  return [];
}

function restoreScheduledJobs() {
  schedules.forEach(schedule => {
    if (schedule.status !== "scheduled" || !schedule.startAt) return;

    const delay = new Date(schedule.startAt).getTime() - Date.now();
    if (delay <= 0) {
      schedule.status = "running";
      schedule.updatedAt = new Date().toISOString();
      runMatch(schedule);
      return;
    }

    scheduledJobs[schedule.id] = setTimeout(() => runMatch(schedule), delay);
  });
}

function saveSchedules() {
  try {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(schedules, null, 2), 'utf8');
  } catch (error) {
    console.error('Unable to save schedules:', error.message);
  }
}



function openBrowser(urlToOpen) {
  const platform = process.platform;
  const command = platform === "win32"
    ? `start "" "${urlToOpen}"`
    : platform === "darwin"
      ? `open "${urlToOpen}"`
      : `xdg-open "${urlToOpen}"`;

  exec(command, err => {
    if (err) {
      console.error("Could not open browser:", err.message);
    }
  });
}

function getTeamByName(name) {
  return teamCatalog[name] || null;
}

function buildTeamCatalog(source) {
  const collections = Object.entries(source || {})
    .filter(([, teams]) => teams && typeof teams === "object" && !Array.isArray(teams));
  const teamNameCounts = new Map();

  collections.forEach(([, teams]) => {
    Object.keys(teams).forEach(teamName => {
      teamNameCounts.set(teamName, (teamNameCounts.get(teamName) || 0) + 1);
    });
  });

  const catalog = {};

  collections.forEach(([groupName, teams]) => {
    Object.entries(teams).forEach(([teamName, players]) => {
      if (!Array.isArray(players) || players.length === 0) {
        return;
      }

      const displayName = teamNameCounts.get(teamName) > 1
        ? `${teamName} (${groupName})`
        : teamName;

      catalog[displayName] = {
        name: displayName,
        sourceGroup: groupName,
        sourceTeamName: teamName,
        players: players.map((player, index) => normalizeSquadPlayer(displayName, player, index))
      };
    });
  });

  return catalog;
}

function normalizeSquadPlayer(teamName, player, index) {
  const name = String(player?.name || `Player ${index + 1}`);
  return {
    ...player,
    id: buildPlayerId(teamName, name, index),
    name,
    role: player?.role || "player",
    type: player?.type || "balanced"
  };
}

function buildPlayerId(teamName, playerName, index) {
  return `${slugify(teamName)}_${String(index + 1).padStart(2, "0")}_${slugify(playerName)}`;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "player";
}

function mapOutcomeProbabilities(probabilities) {
  return {
    dot: Number(probabilities?.dot) || 0,
    single: Number(probabilities?.["1"]) || 0,
    double: Number(probabilities?.["2"]) || 0,
    four: Number(probabilities?.["4"]) || 0,
    six: Number(probabilities?.["6"]) || 0,
    wicket: Number(probabilities?.wicket) || 0
  };
}

const ROLE_PRIORITY = {
  "batsman": 1,
  "wicket-keeper": 2,
  "wicketkeeper": 2,
  "allrounder": 3,
  "all-rounder": 3,
  "bowler": 4
};

function buildMatchPlayer(player) {
  return matchService.buildMatchPlayer(player);
}

function resolvePlayingXI(teamEntry, selectedIds) {
  return matchService.resolvePlayingXI(teamEntry, selectedIds);
}

function summarizePlayingXI(players) {
  return matchService.summarizePlayingXI(players);
}

function getMatchTypeByKey(key) {
  return matchTypes.find(item => item.key === key) || matchTypes[0];
}

function addLog(message) {
  liveLogs.unshift({ timestamp: new Date().toISOString(), message });
  if (liveLogs.length > MAX_LOG_ITEMS) liveLogs.length = MAX_LOG_ITEMS;
}

function updateMatchStatus(matchId, status) {
  if (!matchId || !status) return;
  db.ref(`matches/${matchId}/status`).set(status).catch(error => {
    console.error(`Unable to update match root status for ${matchId}:`, error);
  });
  db.ref(`matches/${matchId}/meta`).update({ status }).catch(error => {
    console.error(`Unable to update match meta status for ${matchId}:`, error);
  });
  db.ref(`matches/list/${matchId}`).update({ status }).catch(error => {
    console.error(`Unable to update match list status for ${matchId}:`, error);
  });
}

function updateCurrentMatch(matchId, update) {
  const match = activeMatches.get(matchId);
  if (!match) return;
  const updated = { ...match, ...update, updatedAt: new Date().toISOString() };
  activeMatches.set(matchId, updated);
  if (update.status) {
    updateMatchStatus(matchId, update.status);
  }
}

async function readDb(refPath) {
  try {
    const snapshot = await db.ref(refPath).get();
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) {
    console.error(`Firebase read failed [${refPath}]:`, error);
    return null;
  }
}

async function getActiveMatchesSummary() {
  if (activeMatches.size > 0) {
    return Array.from(activeMatches.values());
  }
  // Fall back to Firebase for any matches that survived a server restart
  const activeSchedules = schedules.filter(item => item.status === "running" || item.status === "paused");
  if (activeSchedules.length === 0) return [];

  const results = await Promise.all(
    activeSchedules.map(async schedule => {
      const [meta, state] = await Promise.all([
        readDb(`matches/${schedule.matchId}/meta`),
        readDb(`matches/${schedule.matchId}/snapshot`)
      ]);
      if (!state) return null;
      return {
        matchId: schedule.matchId,
        status: schedule.status,
        matchType: schedule.matchType,
        teamAName: schedule.teamAName,
        teamBName: schedule.teamBName,
        overs: schedule.overs,
        delayMs: schedule.delayMs,
        startedAt: meta?.startTime ? new Date(meta.startTime).toISOString() : undefined,
        ...state
      };
    })
  );
  return results.filter(Boolean);
}

function jsonResponse(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function textResponse(res, status, body) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(body);
}

const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 MB

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let bytesReceived = 0;
    req.on("data", chunk => {
      bytesReceived += chunk.length;
      if (bytesReceived > MAX_BODY_BYTES) {
        req.destroy();
        return reject(Object.assign(new Error("Request body too large."), { statusCode: 413 }));
      }
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function saveMatchRegistryEntry(schedule) {
  const metaPayload = {
    id: schedule.id,
    matchId: schedule.matchId,
    teamA: schedule.teamAName,
    teamB: schedule.teamBName,
    seed: schedule.seed,
    teamAPlayingXI: schedule.teamAPlayingXI || [],
    teamBPlayingXI: schedule.teamBPlayingXI || [],
    venue: schedule.venue || null,
    oversLimit: schedule.overs,
    overs: schedule.overs,
    matchType: schedule.matchType,
    status: schedule.status,
    startAt: schedule.startAt || null,
    delayMs: schedule.delayMs,
    startTime: schedule.startAt ? new Date(schedule.startAt).getTime() : Date.now(),
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt
  };

  try {
    await Promise.all([
      db.ref(`matches/list/${schedule.matchId}`).set(metaPayload),
      db.ref(`matches/${schedule.matchId}/meta`).set(metaPayload)
    ]);
  } catch (error) {
    console.error(`Unable to save match registry entry for ${schedule.matchId}:`, error);
  }
}

function updateScheduleList() {
  saveSchedules();
}

async function initScorecardsForMatch(matchId, teamAWithIds, teamBWithIds) {
  try {
    const scorecard1 = { batting: {}, bowling: {} };
    teamAWithIds.forEach(player => {
      scorecard1.batting[player.id] = {
        name: player.name,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        isOut: false
      };
    });
    teamBWithIds.forEach(player => {
      scorecard1.bowling[player.id] = {
        name: player.name,
        balls: 0,
        overs: "0",
        runs: 0,
        wickets: 0,
        economy: 0
      };
    });

    const scorecard2 = { batting: {}, bowling: {} };
    teamBWithIds.forEach(player => {
      scorecard2.batting[player.id] = {
        name: player.name,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        strikeRate: 0,
        isOut: false
      };
    });
    teamAWithIds.forEach(player => {
      scorecard2.bowling[player.id] = {
        name: player.name,
        balls: 0,
        overs: "0",
        runs: 0,
        wickets: 0,
        economy: 0
      };
    });

    await db.ref(`matches/${matchId}/scorecard/1`).set(scorecard1);
    await db.ref(`matches/${matchId}/scorecard/2`).set(scorecard2);
  } catch (error) {
    console.error(`Unable to initialize scorecards for ${matchId}:`, error);
  }
}

async function scheduleMatch(payload) {
  const teamAEntry = getTeamByName(payload.teamA);
  const teamBEntry = getTeamByName(payload.teamB);
  if (!teamAEntry || !teamBEntry) {
    throw new Error("One or both selected teams are invalid.");
  }
  if (payload.teamA === payload.teamB) {
    throw new Error("Team A and Team B must be different.");
  }

  const teamAPlayingXI = resolvePlayingXI(teamAEntry, payload.teamAPlayingXI);
  const teamBPlayingXI = resolvePlayingXI(teamBEntry, payload.teamBPlayingXI);

  const type = getMatchTypeByKey(payload.matchType || "T20");
  const overs = Number(payload.overs) || type.overs;
  if (overs <= 0) {
    throw new Error("Invalid overs count.");
  }
  const delayMs = Number(payload.delayMs);
  if (Number.isNaN(delayMs) || delayMs < 0) {
    throw new Error("Delay must be a valid non-negative number.");
  }

  const startAt = payload.startAt ? new Date(payload.startAt) : null;
  if (startAt && Number.isNaN(startAt.getTime())) {
    throw new Error("Invalid scheduled start time.");
  }
const matchId =
  `${payload.teamA}_vs_${payload.teamB}_${type.key}_${crypto.randomUUID().slice(0,8)}`;

const matchSeed =
  `${matchId}_${Date.now()}`;
  const schedule = {
    id: nextScheduleId++,
    matchId: matchId,
    teamAName: payload.teamA,

    teamBName: payload.teamB,
    seed: matchSeed,
    matchType: type.key,
    overs,
    delayMs,
    startAt: startAt ? startAt.toISOString() : null,
    guidedSimulationSettings: payload.guidedSimulationSettings || null,
    teamAPlayingXIIds: teamAPlayingXI.map(player => player.id),
    teamBPlayingXIIds: teamBPlayingXI.map(player => player.id),
    teamAPlayingXI: summarizePlayingXI(teamAPlayingXI),
    teamBPlayingXI: summarizePlayingXI(teamBPlayingXI),
    status: startAt ? "scheduled" : "running",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  schedules.push(schedule);
  updateScheduleList();
  await saveMatchRegistryEntry(schedule);

  const teamAWithIds = teamAPlayingXI.map(buildMatchPlayer);
  const teamBWithIds = teamBPlayingXI.map(buildMatchPlayer);

  await initScorecardsForMatch(schedule.matchId, teamAWithIds, teamBWithIds);

  if (!schedule.startAt) {
    runMatch(schedule);
    return `Match ${schedule.matchId} started immediately.`;
  }

  const runAt = new Date(schedule.startAt).getTime();
  const delay = runAt - Date.now();
  if (delay <= 0) {
    schedule.status = "running";
    schedule.updatedAt = new Date().toISOString();
    runMatch(schedule);
    updateScheduleList();
    return `Scheduled time is in the past, starting match ${schedule.matchId} now.`;
  }

  schedule.status = "scheduled";
  scheduledJobs[schedule.id] = setTimeout(() => runMatch(schedule), delay);
  updateScheduleList();
  return `Match ${schedule.matchId} scheduled successfully for your selected time.`;
}


function runMatch(schedule) {
  const matchId = schedule.matchId;
  console.log(`[${new Date().toISOString()}] Attempting to start scheduled match: ${matchId}`);
  
  const alreadyRunning = Array.from(activeMatches.values()).find(m => m.matchId === matchId);

  if (alreadyRunning) {
    addLog(`Match ${schedule.matchId} is already running.`);
    return;
  }

  clearTimeout(scheduledJobs[schedule.id]);
  delete scheduledJobs[schedule.id];

  const teamAEntry = getTeamByName(schedule.teamAName);
  const teamBEntry = getTeamByName(schedule.teamBName);

  if (!teamAEntry || !teamBEntry) {
    schedule.status = "failed";
    schedule.updatedAt = new Date().toISOString();
    updateScheduleList();
    addLog(`Match ${schedule.matchId} could not start because one or both teams are missing.`);
    return;
  }

  let teamA;
  let teamB;

  try {
    teamA = resolvePlayingXI(
      teamAEntry,
      schedule.teamAPlayingXIIds || schedule.teamAPlayingXI?.map(player => player.id)
    ).map(buildMatchPlayer);
    teamB = resolvePlayingXI(
      teamBEntry,
      schedule.teamBPlayingXIIds || schedule.teamBPlayingXI?.map(player => player.id)
    ).map(buildMatchPlayer);
  } catch (error) {
    schedule.status = "failed";
    schedule.updatedAt = new Date().toISOString();
    updateScheduleList();
    addLog(`Match ${schedule.matchId} could not start: ${error.message}`);
    return;
  }

  const abortSignal = { aborted: false };
  const pauseSignal = { paused: false };


  activeMatches.set(matchId, {
    status: "running",
    matchId,
    teamAName: schedule.teamAName,
    teamBName: schedule.teamBName,
    teamAPlayingXI: schedule.teamAPlayingXI || [],
    teamBPlayingXI: schedule.teamBPlayingXI || [],
    overs: schedule.overs,
    delayMs: schedule.delayMs,
    matchType: schedule.matchType,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    score: "0/0",
    wickets: 0,
    lastBall: null,
    target: null,
    abortSignal,
    pauseSignal,
    error: null
  });

  liveLogs = [];
  addLog(`Match ${matchId} is starting: ${schedule.teamAName} vs ${schedule.teamBName}`);
  schedule.status = "running";
  schedule.updatedAt = new Date().toISOString();
  updateScheduleList();
  updateMatchStatus(matchId, "running");

  startMatch(matchId, teamA, teamB, {
    oversLimit: schedule.overs,
    delayMs: schedule.delayMs,
    teamAName: schedule.teamAName,
    teamBName: schedule.teamBName,
    seed: schedule.seed,
    matchType: schedule.matchType,
    startAt: schedule.startAt,
    guidedSimulationSettings: schedule.guidedSimulationSettings,
    status: "running",
    abortSignal,
    pauseSignal,
    onBall: ({ ballData }) => {
      updateCurrentMatch(matchId, {
        score: ballData.score,
        wickets: ballData.wickets,
        lastBall: ballData.ballClock,
        target: ballData.target
      });
      addLog(`Over ${ballData.over}.${ballData.ball}: ${ballData.batsman} -> ${ballData.result} (${ballData.score})`);
    },
    onStatusUpdate: event => {
      if (event.status === "completed") {
        addLog(`Match ${matchId} completed.`);
      }
    }
  }).then(result => {
    schedule.status = "completed";
    schedule.updatedAt = new Date().toISOString();
    updateScheduleList();
    updateCurrentMatch(matchId, { status: "completed" });
    addLog(`Final result: ${result.result.winner || "Tie"}`);
    activeMatches.delete(matchId);
  }).catch(error => {
    schedule.status = abortSignal.aborted ? "aborted" : "failed";
    schedule.updatedAt = new Date().toISOString();
    updateCurrentMatch(matchId, { status: schedule.status, error: error.message });
    addLog(`Match ${matchId} ended with error: ${error.message}`);
    updateScheduleList();
    activeMatches.delete(matchId);
  });
}

function ensureScheduleExists(id) {
  return schedules.find(item => item.id === id);
}

function cancelSchedule(id) {
  const schedule = ensureScheduleExists(id);
  if (!schedule) throw new Error("Schedule not found.");
  if (schedule.status !== "scheduled") {
    throw new Error("Only scheduled matches can be cancelled.");
  }
  clearTimeout(scheduledJobs[id]);
  delete scheduledJobs[id];
  schedule.status = "cancelled";
  schedule.updatedAt = new Date().toISOString();
  updateScheduleList();
  
  // Also update Firebase
  updateMatchStatus(schedule.matchId, "cancelled");
  
  addLog(`Scheduled match ${schedule.matchId} was cancelled.`);
}

function pauseCurrentMatch(matchId) {
  const match = matchId ? activeMatches.get(matchId) : Array.from(activeMatches.values()).find(m => m.status === "running");
  if (!match || match.status !== "running") {
    throw new Error("No running match to pause.");
  }
  match.pauseSignal.paused = true;
  match.status = "paused";
  match.updatedAt = new Date().toISOString();
  activeMatches.set(match.matchId, match);
  updateMatchStatus(match.matchId, "paused");
  addLog(`Match ${match.matchId} paused.`);
}

function resumeCurrentMatch(matchId) {
  const match = matchId ? activeMatches.get(matchId) : Array.from(activeMatches.values()).find(m => m.status === "paused");
  if (!match || match.status !== "paused") {
    throw new Error("No paused match to resume.");
  }
  match.pauseSignal.paused = false;
  match.status = "running";
  match.updatedAt = new Date().toISOString();
  activeMatches.set(match.matchId, match);
  updateMatchStatus(match.matchId, "running");
  addLog(`Match ${match.matchId} resumed.`);
}

function abortCurrentMatch(matchId) {
  const match = matchId ? activeMatches.get(matchId) : Array.from(activeMatches.values()).find(m => m.status === "running" || m.status === "paused");
  if (!match || (match.status !== "running" && match.status !== "paused")) {
    throw new Error("No active match to abort.");
  }
  match.abortSignal.aborted = true;
  match.status = "aborted";
  match.updatedAt = new Date().toISOString();
  activeMatches.set(match.matchId, match);
  updateMatchStatus(match.matchId, "aborted");
  addLog(`Match ${match.matchId} abort requested.`);
}

const server = http.createServer(async (req, res) => {
  const startTime = Date.now();
  const traceId = req.headers['x-trace-id'] || Math.random().toString(36).substring(2, 15);
  
  try {
    const baseUrl = `http://${req.headers.host}`;
    const requestUrl = new URL(req.url, baseUrl);

    logger.info(`${req.method} ${requestUrl.pathname}`, { traceId });

    // Middleware to inject traceId and end timer
    const originalEnd = res.end;
    res.end = function(...args) {
      const duration = Date.now() - startTime;
      logger.info(`Response: ${res.statusCode} ${requestUrl.pathname}`, { traceId, duration });
      return originalEnd.apply(this, args);
    };

    if (req.method === "GET" && requestUrl.pathname === "/") {
      textResponse(res, 200, buildHtmlPage({ teamOptions, matchTypes }));
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/background.jpg") {
      const imagePath = path.join(__dirname, "background.jpg");
      fs.readFile(imagePath, (error, data) => {
        if (error) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Background image not found.");
          return;
        }
        res.writeHead(200, { "Content-Type": "image/jpeg" });
        res.end(data);
      });
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/status") {
      try {
        const activeMatchList = await getActiveMatchesSummary();
        const statusCounts = schedules.reduce((acc, s) => {
          acc[s.status] = (acc[s.status] || 0) + 1;
          return acc;
        }, {});
        
        const lineups = lineupService.getAllLineups() || {};
        const tournamentsSnap = await db.ref("tournaments").once("value");
        const tournaments = tournamentsSnap.val() || {};
        const activeTournaments = Object.values(tournaments).filter(t => t.status !== "completed");

        const summary = {
          activeMatchCount: activeMatchList.length,
          activeTournamentCount: activeTournaments.length,
          statusCounts,
          teamCount: Object.keys(teamCatalog).length,
          uptimeSeconds: Math.floor((Date.now() - new Date(serverStartedAt).getTime()) / 1000),
          nextScheduledMatch: schedules
            .filter(s => s.status === "scheduled" && s.startAt)
            .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))[0] || null
        };

        const currentMatch = activeMatchList.length > 0 ? activeMatchList[0] : null;
        jsonResponse(res, 200, { currentMatch, activeMatches: activeMatchList, liveLogs, summary, tournaments: activeTournaments });
      } catch (error) {
        logger.error("API /api/status failed", error);
        jsonResponse(res, 500, { error: "Internal server error" });
      }
      return;
    }


    if (req.method === "GET" && requestUrl.pathname === "/api/matches") {
      try {
        const list = await readDb("matches/list");
        jsonResponse(res, 200, list || {});
      } catch (error) {
        logger.error("API /api/matches failed", error);
        jsonResponse(res, 500, { error: "Internal server error" });
      }
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/clear-logs") {
      liveLogs = [];
      jsonResponse(res, 200, { message: "Logs cleared." });
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/match") {
      try {
        const matchId = requestUrl.searchParams.get("matchId");
        if (!matchId) {
          jsonResponse(res, 400, { error: "Missing matchId parameter." });
          return;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(matchId)) {
          jsonResponse(res, 400, { error: "Invalid matchId format." });
          return;
        }

        const [meta, rawState, result] = await Promise.all([
          readDb(`matches/${matchId}/meta`),
          readDb(`matches/${matchId}/snapshot`),
          readDb(`matches/${matchId}/result`)
        ]);

        if (!meta) {
          jsonResponse(res, 404, { error: "Match not found." });
          return;
        }

        const currentState = rawState
          ? { ...rawState, status: meta?.status || rawState.status }
          : null;

        jsonResponse(res, 200, {
          matchId,
          meta,
          currentState,
          result
        });
      } catch (error) {
        logger.error("API /api/match failed", error);
        jsonResponse(res, 500, { error: "Internal server error" });
      }
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/scheduled") {

      jsonResponse(res, 200, schedules);
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/api/teams") {
      const lineups = lineupService.getAllLineups();
      const teamsWithLineups = teamOptions.map(t => ({
        ...t,
        hasSavedLineup: !!lineups[t.name],
        savedLineup: lineups[t.name] || null
      }));
      jsonResponse(res, 200, teamsWithLineups);
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/schedule") {
      try {
        const payload = await parseRequestBody(req);
        const message = await scheduleMatch(payload);
        jsonResponse(res, 200, { message });
      } catch (error) {
        logger.error("API /api/schedule failed", error);
        jsonResponse(res, error.statusCode || 400, { error: error.message });
      }
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/cancel") {
      try {
        const payload = await parseRequestBody(req);
        cancelSchedule(Number(payload.id));
        jsonResponse(res, 200, { message: "Schedule cancelled." });
      } catch (error) {
        logger.error("API /api/cancel failed", error);
        jsonResponse(res, error.statusCode || 400, { error: error.message });
      }
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/pause") {
      try {
        const payload = await parseRequestBody(req);
        pauseCurrentMatch(payload.matchId || null);
        jsonResponse(res, 200, { message: "Match paused." });
      } catch (error) {
        logger.error("API /api/pause failed", error);
        jsonResponse(res, error.statusCode || 400, { error: error.message });
      }
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/resume") {
      try {
        const payload = await parseRequestBody(req);
        resumeCurrentMatch(payload.matchId || null);
        jsonResponse(res, 200, { message: "Match resumed." });
      } catch (error) {
        logger.error("API /api/resume failed", error);
        jsonResponse(res, error.statusCode || 400, { error: error.message });
      }
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/abort") {
      try {
        const payload = await parseRequestBody(req);
        abortCurrentMatch(payload.matchId || null);
        jsonResponse(res, 200, { message: "Match abort requested." });
      } catch (error) {
        logger.error("API /api/abort failed", error);
        jsonResponse(res, error.statusCode || 400, { error: error.message });
      }
      return;
    }
    if (req.method === "POST" && requestUrl.pathname === "/api/admin/setup-tournament") {
      try {
        const selectedTeamNames = [
          "India (men)", 
          "Australia (men)", 
          "New Zealand (men)", 
          "South Africa (men)", 
          "Pakistan (men)", 
          "England (men)"
        ];
        const teams = selectedTeamNames.map(name => ({ name, id: name }));
        const tournamentId = await tournamentEngine.createTournament({
          templateKey: "WORLD_CUP",
          season: "2026",
          teams: teams,
          tournamentName: "Stimulated Reality Cup 2026",
          startDate: new Date(),
          country: "India"
        });

        if (tournament && tournament.matchOrder && tournament.matchOrder.length > 0) {
          const firstMatchId = tournament.matchOrder[0];
          const pastDate = new Date(Date.now() - 5 * 60000).toISOString();
          await db.ref(`tournaments/${tournamentId}/matches/${firstMatchId}`).update({
            utcTimestamp: pastDate
          });
        }

        jsonResponse(res, 200, { message: "Tournament created and first match scheduled for now.", tournamentId });
      } catch (error) {
        logger.error("Tournament setup failed", error);
        jsonResponse(res, 500, { error: error.message });
      }
      return;
    }
    if (req.method === "POST" && requestUrl.pathname === "/api/admin/cleanup") {
      try {
        const { nodes, dateRange, startDate, endDate } = await parseRequestBody(req);
        if (!Array.isArray(nodes) || nodes.length === 0) {
          throw new Error("No data nodes selected for cleanup.");
        }

        const results = [];
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const yesterdayStr = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

        for (const node of nodes) {
          if (!["matches", "tournaments"].includes(node)) continue;

          const snapshot = await db.ref(node).once("value");
          const data = snapshot.val();
          if (!data) {
            results.push(`Node '${node}' is already empty.`);
            continue;
          }

          let deleteCount = 0;
          const keys = Object.keys(data);

          for (const key of keys) {
            const item = data[key];
            // Determine the date of the item
            let itemDateStr = "";
            if (node === "matches") {
              // Check list entry first
              const createdAt = item.createdAt || (item.meta ? item.meta.createdAt : null);
              if (createdAt) itemDateStr = createdAt.split('T')[0];
              else if (item.startTime) itemDateStr = new Date(item.startTime).toISOString().split('T')[0];
            } else {
              if (item.createdAt) itemDateStr = item.createdAt.split('T')[0];
            }

            let shouldDelete = false;
            if (dateRange === "all") {
              shouldDelete = true;
            } else if (itemDateStr) {
              if (dateRange === "today" && itemDateStr === todayStr) shouldDelete = true;
              else if (dateRange === "yesterday" && itemDateStr === yesterdayStr) shouldDelete = true;
              else if (dateRange === "custom" && startDate && endDate) {
                shouldDelete = itemDateStr >= startDate && itemDateStr <= endDate;
              }
            }

            if (shouldDelete) {
              await db.ref(`${node}/${key}`).remove();
              // Also clean up matches/list if node is matches
              if (node === "matches") {
                await db.ref(`matches/list/${key}`).remove();
              }
              deleteCount++;
            }
          }
          results.push(`Cleared ${deleteCount} items from '${node}'.`);
        }

        jsonResponse(res, 200, { results });
      } catch (error) {
        logger.error("API /api/admin/cleanup failed", error);
        jsonResponse(res, 400, { error: error.message });
      }
      return;
    }

    // --- Tournament Engine Endpoints ---
    if (req.method === "GET" && requestUrl.pathname === "/api/tournaments/list") {
      try {
        const snap = await db.ref("tournaments").once("value");
        const data = snap.val() || {};
        jsonResponse(res, 200, Object.values(data));
      } catch (error) {
        jsonResponse(res, 500, { error: error.message });
      }
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/tournaments/generate") {
      try {
        const { templateKey, season, teams, tournamentName } = await parseRequestBody(req);
        const template = templates[templateKey];
        if (!template) throw new Error("Invalid tournament template.");

        const fixtures = fixtureGenerator.createFullTournamentSchedule(teams, {
          format: template.format,
          rounds: template.rounds || 1,
          groupCount: template.groupCount,
          startDate: new Date(),
          country: "India"
        });

        jsonResponse(res, 200, { fixtures });
      } catch (error) {
        jsonResponse(res, 400, { error: error.message });
      }
      return;
    }

    if (req.method === "POST" && requestUrl.pathname === "/api/tournaments/save") {
      try {
        const payload = await parseRequestBody(req);
        const tournamentId = await tournamentEngine.createTournament(payload);
        
        // If autoMode, trigger the first match immediately without waiting for the 30s poll
        if (payload.autoMode) {
          tournamentEngine.runNextMatch(tournamentId).catch(err => console.error("Initial auto-run failed:", err));
        }

        jsonResponse(res, 200, { message: "Tournament saved successfully.", tournamentId });
      } catch (error) {
        jsonResponse(res, 500, { error: error.message });
      }
      return;
    }

    if (req.method === "GET" && requestUrl.pathname.startsWith("/api/tournaments/standings/")) {
      try {
        const tid = requestUrl.pathname.split("/").pop();
        const snap = await db.ref(`tournaments/${tid}/standings`).once("value");
        const standings = snap.val() || {};
        jsonResponse(res, 200, standingsEngine.sortStandings(standings));
      } catch (error) {
        jsonResponse(res, 500, { error: error.message });
      }
      return;
    }

    if (req.method === "GET" && requestUrl.pathname.startsWith("/api/tournaments/leaders/")) {
      try {
        const tid = requestUrl.pathname.split("/").pop();
        const snap = await db.ref(`tournaments/${tid}/stats`).once("value");
        const stats = snap.val() || { playerStats: {} };
        jsonResponse(res, 200, statsEngine.getLeaderboard(stats));
      } catch (error) {
        jsonResponse(res, 500, { error: error.message });
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  } catch (error) {
    logger.error("Global request handler caught error", error);
    jsonResponse(res, 500, { error: "Internal server error" });
  }
});

server.on("error", error => {
  if (error.code === "EADDRINUSE") {
    const fallbackPort = PORT + 1;
    console.warn(`Port ${PORT} is in use, trying ${fallbackPort} instead.`);
    PORT = fallbackPort;
    server.listen(PORT);
    return;
  }

  console.error("Server error:", error);
  process.exit(1);
});

server.listen(PORT, () => {
  const urlToOpen = `http://localhost:${PORT}`;
  console.log(`Advanced scheduler running at ${urlToOpen}`);
  openBrowser(urlToOpen);
});
