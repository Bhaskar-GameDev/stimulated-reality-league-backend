const db = require("./firebase");
const commentaryEngine = require("./utils/commentaryEngine");
const { createSeededRandom } = require("./utils/random");

const DEFAULT_PROBABILITIES = {
  dot: 0.35,
  single: 0.30,
  double: 0.08,
  four: 0.14,
  six: 0.08,
  wicket: 0.05
};

function getMatchPhase(context) {
  const over = context.currentOver + 1; 
  if (over <= 2) return "setup";
  if (over <= 6) return "powerplay";
  if (over <= 10) return "stabilize";
  if (over <= 15) return "acceleration";
  return "death";
}

function calculateAdjustedProbabilities(batsman, bowler, context) {
  const batBase = batsman.batting?.base || batsman.batting_probabilities || batsman.base_probabilities || DEFAULT_PROBABILITIES;
  
  const probs = {
    "dot": Number(batBase.dot || batBase["dot"] || 0.35),
    "1": Number(batBase["1"] || batBase.single || 0.3),
    "2": Number(batBase["2"] || batBase.double || 0.08),
    "4": Number(batBase["4"] || batBase.four || 0.14),
    "6": Number(batBase["6"] || batBase.six || 0.08),
    "wicket": Number(batBase.wicket || batBase["wicket"] || 0.05)
  };

  const phase = getMatchPhase(context);
  const playerType = (batsman.type || "").toLowerCase();
  
  let boundaryMult = 1.0;
  let dotMult = 1.0;
  let wicketMult = 1.0;
  let rotationMult = 1.0;

  const isAggressive = playerType.includes("aggressive") || playerType.includes("hitter") || playerType.includes("finisher");
  const isAnchor = playerType.includes("anchor") || playerType.includes("stable");

  switch (phase) {
    case "setup":
      boundaryMult = isAggressive ? 1.0 : 0.6;
      dotMult = isAnchor ? 1.1 : 1.3;
      wicketMult = 0.5;
      break;
    case "powerplay":
      boundaryMult = isAggressive ? 1.8 : 1.5;
      dotMult = 0.8;
      wicketMult = 1.2;
      break;
    case "stabilize":
      boundaryMult = isAggressive ? 1.2 : 0.8;
      dotMult = 0.9;
      rotationMult = isAnchor ? 1.6 : 1.3;
      wicketMult = isAnchor ? 0.4 : 0.7;
      break;
    case "acceleration":
      boundaryMult = isAggressive ? 1.6 : 1.3;
      dotMult = 0.7;
      rotationMult = 1.2;
      wicketMult = 1.1;
      break;
    case "death":
      boundaryMult = isAggressive ? 2.8 : 2.0;
      dotMult = 0.4;
      wicketMult = isAggressive ? 1.5 : 2.0;
      if (isAnchor) {
          boundaryMult = 1.8;
          wicketMult = 2.5;
      }
      break;
  }

  if (context.isChasing && context.target !== null) {
    const ballsRemaining = (context.totalOvers * 6) - ((context.currentOver * 6) + context.currentBallInOver);
    const runsRemaining = Math.max(0, context.target - context.currentScore);
    const rrr = ballsRemaining > 0 ? (runsRemaining / ballsRemaining) * 6 : 0;
    
    if (rrr > 10.0) {
      const pressure = Math.min(1.5, (rrr - 10.0) / 8.0);
      boundaryMult *= (1.0 + pressure * 0.6);
      wicketMult *= (1.0 + pressure * 0.5);
      dotMult *= (1.0 - pressure * 0.2);
    } else if (rrr < 6.0 && ballsRemaining > 30) {
      boundaryMult *= 0.8;
      wicketMult *= 0.6;
      rotationMult *= 1.2;
    }
    
    if (context.wicketsFallen >= 7) {
      const tailPressure = (context.wicketsFallen - 6) * 0.2;
      wicketMult *= (1.0 + tailPressure);
      dotMult *= (1.0 + tailPressure * 0.5);
      boundaryMult *= (1.0 - tailPressure * 0.3);
    }
  }

  probs["4"] *= boundaryMult;
  probs["6"] *= boundaryMult;
  probs["dot"] *= dotMult;
  probs["wicket"] *= wicketMult;
  probs["1"] *= rotationMult;
  probs["2"] *= rotationMult;

  const restrictiveFactor = ((bowler.bowling?.economyControl ?? 0.5) + (bowler.bowling?.accuracy ?? 0.5)) / 2.0;
  const wicketTakingFactor = (bowler.bowling?.wicketTaking ?? 0.5);

  probs["dot"] *= (1.0 + restrictiveFactor * 0.5);
  probs["4"] *= (1.0 - restrictiveFactor * 0.3);
  probs["wicket"] *= (1.0 + wicketTakingFactor * 0.6);

  const matchupMultiplier = context.bowlerType === "Spin" 
    ? (batsman.batting?.vsSpin ?? 1.0) 
    : (batsman.batting?.vsPace ?? 1.0);
  
  probs["4"] *= matchupMultiplier;
  probs["6"] *= matchupMultiplier;

  const form = batsman.form ?? 1.0;
  const consistency = batsman.batting?.consistency ?? 0.5;
  const reliability = (form + consistency) / 2.0;
  probs["wicket"] *= Math.max(0.3, 1.3 - reliability);

  if (batsman.stamina) {
    const staminaDecay = (batsman.stamina.decayRate ?? 0.005) * (context.batsmanBallsFaced || 0);
    const currentStamina = Math.max(0.2, (batsman.stamina.initial ?? 1.0) - staminaDecay);
    const fatigue = 1.0 - currentStamina;
    probs["dot"] *= (1.0 + fatigue * 0.3);
    probs["wicket"] *= (1.0 + fatigue * 0.4);
  }

  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  Object.keys(probs).forEach(k => probs[k] /= total);
  return probs;
}

function normalizeProbabilities(p) {
  const categories = ["dot", "1", "2", "4", "6", "wicket"];
  const normalized = {};
  const values = categories.map(cat => Math.max(0, Number(p?.[cat]) || 0));
  const total = values.reduce((sum, value) => sum + value, 0);

  if (total <= 0) return { "dot": 0.35, "1": 0.3, "2": 0.08, "4": 0.14, "6": 0.08, "wicket": 0.05 };
  categories.forEach((cat, index) => normalized[cat] = values[index] / total);
  return normalized;
}

function simulateBall(batsman, bowler, context) {
  const rawProbs = calculateAdjustedProbabilities(batsman, bowler, context);
  const p = normalizeProbabilities(rawProbs);
  const r = context.rng.next();

  const thresholds = [
    { result: "dot", threshold: p["dot"] },
    { result: "1", threshold: p["dot"] + p["1"] },
    { result: "2", threshold: p["dot"] + p["1"] + p["2"] },
    { result: "4", threshold: p["dot"] + p["1"] + p["2"] + p["4"] },
    { result: "6", threshold: p["dot"] + p["1"] + p["2"] + p["4"] + p["6"] },
    { result: "W", threshold: 1 }
  ];

  for (const bucket of thresholds) {
    if (r < bucket.threshold) return bucket.result;
  }
  return "dot";
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function waitWhilePaused(pauseSignal) {
  if (!pauseSignal || !pauseSignal.paused) return Promise.resolve();
  return new Promise(resolve => {
    const interval = setInterval(() => {
      if (!pauseSignal.paused) { clearInterval(interval); resolve(); }
    }, 200);
  });
}

async function writeDb(refPath, data, method = "set") {
  try {
    if (method === "update") await db.ref(refPath).update(data);
    else await db.ref(refPath).set(data);
  } catch (error) { console.error(`Firebase write failed [${method}] ${refPath}:`, error); }
}

async function readDb(refPath) {
  try {
    const snapshot = await db.ref(refPath).get();
    return snapshot.exists() ? snapshot.val() : null;
  } catch (error) { console.error(`Firebase read failed [${refPath}]:`, error); return null; }
}

function buildBallKey(over, ball) { return `${over}_${ball}`; }

function formatBallType(result) {
  if (result === "W") return "wicket";
  if (result === "4" || result === "6") return "boundary";
  if (result === "2") return "double";
  if (result === "1") return "single";
  return "dot";
}

function getBallPosition(ballsBowled) {
  if (ballsBowled <= 0) return { over: 0, ball: 0 };
  const over = Math.floor((ballsBowled - 1) / 6);
  const ball = ((ballsBowled - 1) % 6) + 1;
  return { over, ball };
}

function formatOvers(ballsBowled) {
  if (ballsBowled <= 0) return "0";
  const oversCompleted = Math.floor(ballsBowled / 6);
  const ballsInCurrentOver = ballsBowled % 6;
  return ballsInCurrentOver === 0 ? `${oversCompleted}` : `${oversCompleted}.${ballsInCurrentOver}`;
}

function updateBattingStats(scorecard, batsman, ballRuns, result, pos) {
  const key = batsman.id || batsman.name;
  const existing = scorecard.batting[key] || {
    name: batsman.name, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, isOut: false, pos: pos || 99
  };
  existing.runs += ballRuns;
  existing.balls += 1;
  if (result === "4") existing.fours += 1;
  if (result === "6") existing.sixes += 1;
  if (result === "W") existing.isOut = true;
  existing.strikeRate = existing.balls > 0 ? Number(((existing.runs / existing.balls) * 100).toFixed(1)) : 0;
  scorecard.batting[key] = existing;
}

function updateBowlingStats(scorecard, bowler, ballRuns, result, pos) {
  const key = bowler.id || bowler.name;
  const existing = scorecard.bowling[key] || {
    name: bowler.name, balls: 0, overs: "0", runs: 0, wickets: 0, economy: 0, pos: pos || 99
  };
  existing.balls += 1;
  existing.overs = formatOvers(existing.balls);
  existing.runs += ballRuns;
  if (result === "W") existing.wickets += 1;
  existing.economy = existing.balls > 0 ? Number((existing.runs / (existing.balls / 6)).toFixed(1)) : 0;
  scorecard.bowling[key] = existing;
}

async function simulateInnings(matchId, inningNumber, batting, bowling, options = {}) {
  const { oversLimit = 20, delayMs = 0, rng, chaseTarget = null, battingTeamName = "Team A", bowlingTeamName = "Team B", venue = "the stadium", onBall, abortSignal, pauseSignal } = options;
  let runs = 0, wickets = 0, striker = 0, nonStriker = 1, nextBatsman = 2, ballsBowled = 0;
  let partnershipRuns = 0, partnershipBalls = 0, partnershipStrikerRuns = 0, partnershipNonStrikerRuns = 0;
  const recentBalls = {};
  let scorecard = await readDb(`matches/${matchId}/scorecard/${inningNumber}`) || { batting: {}, bowling: {} };

  await writeDb(`matches/${matchId}/innings/${inningNumber}/meta`, { inningNumber, battingTeamName, bowlingTeamName, oversLimit, chaseTarget, startedAt: Date.now() });

  const maxOversPerBowler = Math.ceil(oversLimit / 5);
  const bowlerOversCount = {};
  const bowlerOrderIndex = {};
  let nextBowlerPos = 0, lastBowlerId = null;

  for (let over = 0; over < oversLimit; over++) {
    const pool = bowling.filter(p => p.role?.toLowerCase().includes("bowler") || p.role?.toLowerCase().includes("allrounder")).length > 0 
                ? bowling.filter(p => p.role?.toLowerCase().includes("bowler") || p.role?.toLowerCase().includes("allrounder"))
                : bowling.slice(-5);
    const available = pool.filter(p => (bowlerOversCount[p.id || p.name] || 0) < maxOversPerBowler);
    const candidates = available.filter(p => (p.id || p.name) !== lastBowlerId);
    const bowler = candidates.length > 0 ? candidates.sort((a, b) => (bowlerOversCount[a.id || a.name] || 0) - (bowlerOversCount[b.id || b.name] || 0))[0] : (available[0] || pool[0]);
    
    const bId = bowler.id || bowler.name;
    if (bowlerOrderIndex[bId] === undefined) bowlerOrderIndex[bId] = nextBowlerPos++;
    lastBowlerId = bId;
    bowlerOversCount[bId] = (bowlerOversCount[bId] || 0) + 1;

    for (let ball = 0; ball < 6; ball++) {
      if (abortSignal?.aborted) break;
      await waitWhilePaused(pauseSignal);
      if (abortSignal?.aborted || wickets >= 10 || striker < 0 || (chaseTarget !== null && runs >= chaseTarget)) break;

      const batsman = batting[striker];
      const result = simulateBall(batsman, bowler, {
        currentOver: over, currentBallInOver: ball, totalOvers: oversLimit, wicketsFallen: wickets,
        isChasing: chaseTarget !== null, target: chaseTarget, currentScore: runs,
        batsmanBallsFaced: scorecard.batting[batsman.id || batsman.name]?.balls || 0,
        bowlerType: (bowler.type || "").toLowerCase().includes("spin") ? "Spin" : "Pace", rng
      });

      let ballRuns = 0;
      partnershipBalls += 1;
      if (result === "1") { ballRuns = 1; [striker, nonStriker] = [nonStriker, striker]; [partnershipStrikerRuns, partnershipNonStrikerRuns] = [partnershipNonStrikerRuns, partnershipStrikerRuns + 1]; }
      else if (result === "2") { ballRuns = 2; partnershipStrikerRuns += 2; }
      else if (result === "4") { ballRuns = 4; partnershipStrikerRuns += 4; }
      else if (result === "6") { ballRuns = 6; partnershipStrikerRuns += 6; }
      else if (result === "W") { wickets += 1; partnershipRuns = 0; partnershipBalls = 0; partnershipStrikerRuns = 0; partnershipNonStrikerRuns = 0; striker = nextBatsman < batting.length ? nextBatsman++ : -1; }
      
      if (result !== "W") { runs += ballRuns; partnershipRuns += ballRuns; }
      ballsBowled += 1;
      const { over: cOver, ball: cBall } = getBallPosition(ballsBowled);
      recentBalls[buildBallKey(cOver, cBall)] = result;

      updateBattingStats(scorecard, batsman, ballRuns, result, striker);
      updateBowlingStats(scorecard, bowler, ballRuns, result, bowlerOrderIndex[bId]);

      const updates = {};
      updates[`matches/${matchId}/balls/${inningNumber}/${buildBallKey(cOver, cBall)}`] = {
        inning: inningNumber, over: cOver, ball: cBall, result, ballRuns, cumulativeRuns: runs, wickets, score: `${runs}/${wickets}`,
        target: chaseTarget, batsman: batsman.name, bowler: bowler.name, timestamp: Date.now()
      };
      updates[`matches/${matchId}/snapshot`] = {
        inning: inningNumber, runs, wickets, over: cOver, ball: cBall, striker: { name: batting[striker]?.name }, nonStriker: { name: batting[nonStriker]?.name },
        bowler: { name: bowler.name }, result, partnership: { runs: partnershipRuns, balls: partnershipBalls }
      };
      updates[`matches/${matchId}/scorecard/${inningNumber}`] = scorecard;
      updates[`matches/${matchId}/recentBalls`] = recentBalls;
      updates[`matches/${matchId}/commentary/${String(ballsBowled).padStart(3, "0")}`] = commentaryEngine.generate(matchId, {
        result, batsman, bowler, battingTeam: battingTeamName, bowlingTeam: bowlingTeamName, venue, state: { runs, wickets, over: cOver, ball: cBall, target: chaseTarget }
      });

      if (ballRuns >= 4 || result === "W" || cBall === 6) {
          updates[`matches/list/${matchId}/score`] = `${runs}/${wickets}`;
          updates[`matches/list/${matchId}/overs`] = `${cOver}.${cBall}`;
      }
      await db.ref().update(updates);

      if (cBall === 6 || wickets >= 10 || (chaseTarget !== null && runs >= chaseTarget)) {
        await writeDb(`matches/${matchId}/commentary/${String(ballsBowled).padStart(3, "0")}_over`, commentaryEngine.generate(matchId, {
          isOverEnd: true, batsman, bowler, battingTeam: battingTeamName, bowlingTeam: bowlingTeamName, venue, state: { runs, wickets, over: cOver, ball: cBall, target: chaseTarget }
        }));
      }

      if (typeof onBall === "function") onBall({ matchId, inningNumber, ballData: updates[`matches/${matchId}/balls/${inningNumber}/${buildBallKey(cOver, cBall)}`], status: updates[`matches/${matchId}/snapshot`] });
      if (delayMs > 0) await delay(delayMs);
    }
    if (wickets >= 10 || striker < 0 || (chaseTarget !== null && runs >= chaseTarget)) break;
    [striker, nonStriker] = [nonStriker, striker];
    [partnershipStrikerRuns, partnershipNonStrikerRuns] = [partnershipNonStrikerRuns, partnershipStrikerRuns];
  }

  const summary = { inningNumber, battingTeamName, bowlingTeamName, runs, wickets, overs: formatOvers(ballsBowled), target: chaseTarget, finishedAt: Date.now() };
  await writeDb(`matches/${matchId}/innings/${inningNumber}/summary`, summary);
  return { runs, summary };
}

async function startMatch(matchId, teamA, teamB, options = {}) {
  const { teamAName = "Team A", teamBName = "Team B", rng = createSeededRandom(options.seed || matchId), oversLimit = 20, delayMs = 0, onBall, onStatusUpdate, abortSignal, pauseSignal } = options;
  
  const initMeta = { teamA: teamAName, teamB: teamBName, oversLimit, status: "running", startTime: Date.now() };
  await writeDb(`matches/${matchId}/meta`, initMeta);
  await writeDb(`matches/list/${matchId}`, initMeta, "update");
  await writeDb(`matches/${matchId}/lineups`, { [teamAName]: teamA, [teamBName]: teamB });

  if (onStatusUpdate) onStatusUpdate({ status: "started", matchId, teamAName, teamBName });

  const first = await simulateInnings(matchId, 1, teamA, teamB, { oversLimit, delayMs, rng, battingTeamName: teamAName, bowlingTeamName: teamBName, venue: options.venue, onBall, abortSignal, pauseSignal });
  const second = await simulateInnings(matchId, 2, teamB, teamA, { oversLimit, delayMs, rng, chaseTarget: first.runs, battingTeamName: teamBName, bowlingTeamName: teamAName, venue: options.venue, onBall, abortSignal, pauseSignal });

  const result = second.summary.runs > first.summary.runs ? { winner: teamBName, margin: `${second.summary.runs - first.summary.runs} runs` } : (second.summary.runs === first.summary.runs ? { winner: null, margin: "tie" } : { winner: teamAName, margin: `${first.summary.runs - second.summary.runs} runs` });
  
  const finalUpdates = {};
  finalUpdates[`matches/${matchId}/result`] = result;
  finalUpdates[`matches/${matchId}/status`] = "completed";
  finalUpdates[`matches/${matchId}/meta/status`] = "completed";
  finalUpdates[`matches/list/${matchId}/status`] = "completed";
  await db.ref().update(finalUpdates);

  if (onStatusUpdate) onStatusUpdate({ status: "completed", matchId, result });
  return { matchId, result };
}

module.exports = { startMatch };
