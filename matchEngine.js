const db = require("./firebase");
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
  const overRatio = context.currentOver / context.totalOvers;
  if (overRatio < 0.3) return "powerplay";
  if (overRatio < 0.75) return "middle";
  return "death";
}

function calculateAdjustedProbabilities(batsman, bowler, context) {
  const batBase = batsman.batting?.base || batsman.batting_probabilities || batsman.base_probabilities || DEFAULT_PROBABILITIES;
  
  const probs = {
    "dot": batBase.dot || batBase["dot"] || 0.35,
    "1": batBase["1"] || batBase.single || 0.3,
    "2": batBase["2"] || batBase.double || 0.08,
    "4": batBase["4"] || batBase.four || 0.14,
    "6": batBase["6"] || batBase.six || 0.08,
    "wicket": batBase.wicket || batBase["wicket"] || 0.05
  };

  if (!batsman.batting || !bowler.bowling) {
    const bowlBase = bowler.bowling_probabilities || bowler.base_probabilities || DEFAULT_PROBABILITIES;
    return {
      "dot": (probs["dot"] + (bowlBase.dot || 0.35)) / 2,
      "1": (probs["1"] + (bowlBase.single || bowlBase["1"] || 0.3)) / 2,
      "2": (probs["2"] + (bowlBase.double || bowlBase["2"] || 0.08)) / 2,
      "4": (probs["4"] + (bowlBase.four || bowlBase["4"] || 0.14)) / 2,
      "6": (probs["6"] + (bowlBase.six || bowlBase["6"] || 0.08)) / 2,
      "wicket": (probs["wicket"] + (bowlBase.wicket || 0.05)) / 2
    };
  }

  const phase = getMatchPhase(context);

  const aggMultiplier = batsman.batting.aggression?.[phase] ?? 1.0;
  probs["4"] *= (1.0 + aggMultiplier * 0.5);
  probs["6"] *= (1.0 + aggMultiplier * 0.8);
  probs["wicket"] *= (1.0 + aggMultiplier * 0.3);
  probs["dot"] *= Math.max(0.1, 1.0 - (aggMultiplier * 0.2));

  const bowlerAggression = bowler.bowling.aggression?.[phase] ?? 1.0;
  const restrictiveFactor = ((bowler.bowling.economyControl ?? 0.5) + (bowler.bowling.accuracy ?? 0.5)) / 2.0;
  probs["dot"] *= (1.0 + restrictiveFactor * 0.5);
  probs["4"] *= Math.max(0.1, 1.0 - restrictiveFactor * 0.4);
  probs["6"] *= Math.max(0.1, 1.0 - restrictiveFactor * 0.6);
  probs["wicket"] *= (1.0 + (bowler.bowling.wicketTaking ?? 0.5) * 0.6 + bowlerAggression * 0.2);

  if (phase === "death") {
    probs["dot"] *= (1.0 + (bowler.behavior?.deathOverSkill ?? 0.5) * 0.3);
    probs["wicket"] *= (1.0 + (bowler.behavior?.deathOverSkill ?? 0.5) * 0.3);
  }

  const matchupMultiplier = context.bowlerType === "Pace" 
    ? (batsman.batting.vsPace ?? 1.0) 
    : (batsman.batting.vsSpin ?? 1.0);
  
  probs["1"] *= matchupMultiplier;
  probs["2"] *= matchupMultiplier;
  probs["4"] *= matchupMultiplier;
  probs["6"] *= (matchupMultiplier * 1.2);

  const form = batsman.form ?? 1.0;
  const consistency = batsman.batting.consistency ?? 0.5;
  const reliability = (form + consistency) / 2.0;
  probs["wicket"] *= Math.max(0.2, 1.5 - reliability);
  probs["1"] *= (1.0 + reliability * 0.2);
  probs["2"] *= (1.0 + reliability * 0.3);

  if (batsman.stamina) {
    const staminaDecay = (batsman.stamina.decayRate ?? 0.01) * context.batsmanBallsFaced;
    const currentStamina = Math.max(0.1, (batsman.stamina.initial ?? 1.0) - staminaDecay);
    probs["2"] *= currentStamina;
    probs["4"] *= (0.5 + currentStamina * 0.5);
    probs["6"] *= currentStamina;
    const fatigue = 1.0 - currentStamina;
    probs["dot"] *= (1.0 + fatigue * 0.5);
    probs["wicket"] *= (1.0 + fatigue * 0.3);
  }

  if (batsman.behavior) {
    if (context.isChasing && context.runsRequired !== null) {
      const ballsRemaining = (context.totalOvers * 6) - ((context.currentOver * 6) + context.currentBallInOver);
      const rrr = ballsRemaining > 0 ? (context.runsRequired / ballsRemaining) * 6 : 0;
      
      if (rrr > 9.0) {
        const rrrPressure = (rrr - 9.0) / 5.0;
        const boost = batsman.behavior.chaseBoost ?? 0.5;
        const pressureHandling = batsman.behavior.pressureHandling ?? 0.5;
        
        probs["4"] *= (1.0 + rrrPressure * boost);
        probs["6"] *= (1.0 + rrrPressure * boost * 1.5);
        probs["wicket"] *= (1.0 + rrrPressure * Math.max(0.1, 1.5 - pressureHandling));
      }
    }

    if (context.wicketsFallen >= 3) {
      const collapseRisk = Math.max(0.1, 1.5 - (batsman.behavior.collapseResistance ?? 0.5));
      probs["wicket"] *= collapseRisk;
      if ((batsman.behavior.collapseResistance ?? 0.5) > 0.6) {
        probs["dot"] *= 1.2;
        probs["1"] *= 1.1;
      }
    }
  }

  for (const key of Object.keys(probs)) {
    probs[key] = Math.max(0.001, probs[key]);
  }

  return probs;
}

function normalizeProbabilities(p) {
  const categories = ["dot", "1", "2", "4", "6", "wicket"];
  const normalized = {};
  const values = categories.map(cat => Math.max(0, Number(p?.[cat]) || 0));
  const total = values.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return { "dot": 0.35, "1": 0.3, "2": 0.08, "4": 0.14, "6": 0.08, "wicket": 0.05 };
  }

  categories.forEach((cat, index) => {
    normalized[cat] = values[index] / total;
  });

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
    if (r < bucket.threshold) {
      return bucket.result;
    }
  }

  return "dot";
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitWhilePaused(pauseSignal) {
  if (!pauseSignal || !pauseSignal.paused) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    const interval = setInterval(() => {
      if (!pauseSignal.paused) {
        clearInterval(interval);
        resolve();
      }
    }, 200);
  });
}

async function writeDb(refPath, data, method = "set") {
  try {
    if (method === "push") {
      await db.ref(refPath).push(data);
    } else if (method === "update") {
      await db.ref(refPath).update(data);
    } else {
      await db.ref(refPath).set(data);
    }
  } catch (error) {
    console.error(`Firebase write failed [${method}] ${refPath}:`, error);
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

async function updateMatchRegistry(matchId, meta) {
  await writeDb(`matches/list/${matchId}`, {
    matchId,
    teamA: meta.teamA || meta.teamAName || "Team A",
    teamB: meta.teamB || meta.teamBName || "Team B",
    teamAName: meta.teamAName || meta.teamA || "Team A",
    teamBName: meta.teamBName || meta.teamB || "Team B",
    venue: meta.venue || null,
    oversLimit: meta.oversLimit || meta.overs || 20,
    matchType: meta.matchType || null,
    status: meta.status || "running",
    startAt: meta.startAt || null,
    startTime: Date.now()
  }, "update");
}

function buildBallKey(over, ball) {
  return `${over}_${ball}`;
}

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

function computeRunRate(runs, ballsBowled) {
  if (ballsBowled <= 0) return 0;
  const overs = Math.floor(ballsBowled / 6) + (ballsBowled % 6) / 6;
  return Number((runs / overs).toFixed(1));
}

async function initMatch(matchId, meta) {
  const metaPayload = {
    teamA: meta.teamA || meta.teamAName || "Team A",
    teamB: meta.teamB || meta.teamBName || "Team B",
    venue: meta.venue || null,
    oversLimit: meta.oversLimit || meta.overs || 20,
    matchType: meta.matchType || null,
    status: meta.status || "running",
    startAt: meta.startAt || null,
    startTime: Date.now()
  };

  await writeDb(`matches/${matchId}/meta`, metaPayload);
  await updateMatchRegistry(matchId, metaPayload);
}

async function pushBallRecord(matchId, inningNumber, data) {
  await writeDb(`matches/${matchId}/balls/${inningNumber}/${buildBallKey(data.over, data.ball)}`, data);
}

async function pushCurrentState(matchId, inningNumber, state) {
  await writeDb(`matches/${matchId}/snapshot`, {
    inning: inningNumber,
    runs: state.runs,
    wickets: state.wickets,
    over: state.over,
    ball: state.ball,
    status: state.status || "running",
    striker: { name: state.striker?.name },
    nonStriker: { name: state.nonStriker?.name },
    bowler: { name: state.bowler?.name },
    result: state.result
  });
}

async function pushScorecard(matchId, inningNumber, scorecard) {
  await writeDb(`matches/${matchId}/scorecard/${inningNumber}`, scorecard);
}

async function pushRecentBalls(matchId, recentBalls) {
  await writeDb(`matches/${matchId}/recentBalls`, recentBalls);
}

async function pushCommentary(matchId, key, text) {
  await writeDb(`matches/${matchId}/commentary/${key}`, text);
}

async function pushInningsSummary(matchId, inningNumber, summary) {
  await writeDb(`matches/${matchId}/innings/${inningNumber}/summary`, summary);
}

async function pushMatchResult(matchId, result) {
  await writeDb(`matches/${matchId}/result`, result);
  await writeDb(`matches/${matchId}/status`, "completed");
  await writeDb(`matches/${matchId}/meta/status`, "completed");
  await writeDb(`matches/list/${matchId}/status`, "completed");
}

function formatBallState({ over, ball }) {
  if (ball === 6) {
    return `${over + 1}`;
  }
  return `${over}.${ball}`;
}

function formatOvers(ballsBowled) {
  if (ballsBowled <= 0) return "0";
  const oversCompleted = Math.floor(ballsBowled / 6);
  const ballsInCurrentOver = ballsBowled % 6;
  return ballsInCurrentOver === 0 ? `${oversCompleted}` : `${oversCompleted}.${ballsInCurrentOver}`;
}

function updateBattingStats(scorecard, batsman, ballRuns, result) {
  const key = batsman.id || batsman.name;
  const existing = scorecard.batting[key] || {
    name: batsman.name,
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    strikeRate: 0,
    isOut: false
  };

  existing.runs += ballRuns;
  existing.balls += 1;
  if (result === "4") existing.fours += 1;
  if (result === "6") existing.sixes += 1;
  if (result === "W") existing.isOut = true;
  existing.strikeRate = existing.balls > 0 ? Number(((existing.runs / existing.balls) * 100).toFixed(1)) : 0;
  scorecard.batting[key] = existing;
}

function updateBowlingStats(scorecard, bowler, ballRuns, result) {
  const key = bowler.id || bowler.name;
  const existing = scorecard.bowling[key] || {
    name: bowler.name,
    balls: 0,
    overs: "0",
    runs: 0,
    wickets: 0,
    economy: 0
  };

  existing.balls += 1;
  existing.overs = formatOvers(existing.balls);
  existing.runs += ballRuns;
  if (result === "W") existing.wickets += 1;
  existing.economy = existing.balls > 0 ? Number((existing.runs / (existing.balls / 6)).toFixed(1)) : 0;
  scorecard.bowling[key] = existing;
}

async function simulateInnings(matchId, inningNumber, batting, bowling, options = {}) {
  const {
    oversLimit = 20,
    delayMs = 0,
    rng,
    chaseTarget = null,
    battingTeamName = "Team A",
    bowlingTeamName = "Team B",
    onBall = null,
    onStatusUpdate = null,
    abortSignal = null,
    pauseSignal = null
  } = options;

  let runs = 0;
  let wickets = 0;
  let striker = 0;
  let nonStriker = 1;
  let nextBatsman = 2;
  let ballsBowled = 0;
  const recentBalls = {};
  let scorecard = await readDb(`matches/${matchId}/scorecard/${inningNumber}`) || { batting: {}, bowling: {} };

  const inningMeta = {
    inningNumber,
    battingTeamName,
    bowlingTeamName,
    oversLimit,
    chaseTarget: chaseTarget !== null ? chaseTarget : null,
    startedAt: Date.now()
  };

  await writeDb(`matches/${matchId}/innings/${inningNumber}/meta`, inningMeta);

  for (let over = 0; over < oversLimit; over++) {
    const bowler = bowling[over % bowling.length];

    for (let ball = 0; ball < 6; ball++) {
      if (abortSignal?.aborted) break;
      await waitWhilePaused(pauseSignal);
      if (abortSignal?.aborted) break;
      if (wickets >= 10 || striker < 0) break;
      if (chaseTarget !== null && runs >= chaseTarget) break;

      const batsman = batting[striker];

      const context = {
        currentOver: over,
        currentBallInOver: ball,
        totalOvers: oversLimit,
        wicketsFallen: wickets,
        isChasing: chaseTarget !== null,
        target: chaseTarget,
        currentScore: runs,
        batsmanBallsFaced: scorecard.batting[batsman.id || batsman.name]?.balls || 0,
        bowlerType: bowler.type && bowler.type.toLowerCase().includes("spin") ? "Spin" : "Pace",
        runsRequired: chaseTarget !== null ? Math.max(chaseTarget - runs, 0) : null
      };

      const result = simulateBall(
    batsman,
    bowler,
    {
        ...context,
        rng
    }
);
      let ballRuns = 0;

      if (result === "1") {
        ballRuns = 1;
        runs += 1;
        [striker, nonStriker] = [nonStriker, striker];
      } else if (result === "2") {
        ballRuns = 2;
        runs += 2;
      } else if (result === "4") {
        ballRuns = 4;
        runs += 4;
      } else if (result === "6") {
        ballRuns = 6;
        runs += 6;
      } else if (result === "W") {
        wickets += 1;
        striker = nextBatsman < batting.length ? nextBatsman++ : -1;
      }

      ballsBowled += 1;
      const { over: currentOver, ball: currentBall } = getBallPosition(ballsBowled);
      const currentBatsman = batting[striker];
      const currentNonStriker = batting[nonStriker];
      const score = `${runs}/${wickets}`;
      const runsRequired = chaseTarget !== null ? Math.max(chaseTarget - runs, 0) : null;
      const lastBallInfo = {
        runs: ballRuns,
        type: formatBallType(result)
      };
      recentBalls[buildBallKey(currentOver, currentBall)] = result;

      const ballData = {
        inning: inningNumber,
        over: currentOver,
        ball: currentBall,
        ballClock: formatBallState({ over: currentOver, ball: currentBall }),
        result,
        ballRuns,
        cumulativeRuns: runs,
        wickets,
        score,
        target: chaseTarget !== null ? chaseTarget : null,
        runsRequired,
        batsman: batsman.name,
        batsmanId: batsman.id,
        striker: batsman.name,
        strikerId: batsman.id,
        nonStriker: currentNonStriker?.name || null,
        nonStrikerId: currentNonStriker?.id || null,
        bowler: bowler.name,
        bowlerId: bowler.id,
        timestamp: Date.now()
      };

      await writeDb(`matches/${matchId}/balls/${inningNumber}/${buildBallKey(currentOver, currentBall)}`, ballData);
      updateBattingStats(scorecard, batsman, ballRuns, result);
      updateBowlingStats(scorecard, bowler, ballRuns, result);
      await pushScorecard(matchId, inningNumber, scorecard);
      await pushCurrentState(matchId, inningNumber, {
        over: currentOver,
        ball: currentBall,
        runs,
        wickets,
        striker: currentBatsman,
        nonStriker: currentNonStriker,
        bowler: bowler,
        result: result
      });
      await pushRecentBalls(matchId, recentBalls);
      await pushCommentary(matchId, String(ballsBowled).padStart(3, "0"),
        result === "W"
          ? `WICKET! ${bowler.name} to ${currentBatsman?.name}`
          : result === "6"
            ? `SIX! ${currentBatsman?.name} clears the rope`
            : result === "4"
              ? `FOUR! ${currentBatsman?.name} finds the boundary`
              : `${ballRuns} run${ballRuns === 1 ? "" : "s"} from ${currentBatsman?.name}`
      );

      if (typeof onBall === "function") {
        onBall({ matchId, inningNumber, ballData, status: { runs, wickets, over: currentOver, ball: currentBall, score, result, target: chaseTarget } });
      }

      console.log(
        `Innings ${inningNumber} | ${currentOver}.${currentBall} | ${batsman.name} vs ${bowler.name} → ${result} | ${score}`
      );

      if (delayMs > 0) {
        await delay(delayMs);
      }

      if (wickets >= 10 || striker < 0 || (chaseTarget !== null && runs >= chaseTarget)) {
        break;
      }
    }

    if (wickets >= 10 || striker < 0 || (chaseTarget !== null && runs >= chaseTarget)) {
      break;
    }

    [striker, nonStriker] = [nonStriker, striker];
  }

  const oversCompleted = Math.floor(ballsBowled / 6);
  const ballsInCurrentOver = ballsBowled % 6;

  const summary = {
    inningNumber,
    battingTeamName,
    bowlingTeamName,
    runs,
    wickets,
    overs: formatOvers(ballsBowled),
    balls: ballsBowled,
    target: chaseTarget !== null ? chaseTarget : null,
    runsRequired: chaseTarget !== null ? Math.max(chaseTarget - runs, 0) : null,
    finishedAt: Date.now()
  };

  await pushInningsSummary(matchId, inningNumber, summary);

  return { runs, wickets, ballsBowled, summary };
}

function determineResult(first, second, teamAName, teamBName) {
  if (second.runs > first.runs) {
    return {
      winner: teamBName,
      margin: `${second.runs - first.runs} runs`,
      status: "second innings won"
    };
  }

  if (second.runs === first.runs) {
    return {
      winner: null,
      margin: "tie",
      status: "tied"
    };
  }

  return {
    winner: teamAName,
    margin: `${first.runs - second.runs} runs`,
    status: "first innings won"
  };
}

async function startMatch(matchId, teamA, teamB, options = {}) {
  const {
    teamAName = "Team A",
    teamBName = "Team B",
    rng = createSeededRandom(options.seed || matchId),
    matchType = null,
    startAt = null,
    oversLimit = 20,
    delayMs = 0,
    onBall = null,
    onStatusUpdate = null,
    abortSignal = null,
    pauseSignal = null
  } = options;

  await initMatch(matchId, { teamAName, teamBName, matchType, startAt, oversLimit });

  if (typeof onStatusUpdate === "function") {
    onStatusUpdate({ status: "started", matchId, teamAName, teamBName });
  }

  const firstInnings = await simulateInnings(matchId, 1, teamA, teamB, {
    
    oversLimit,
    delayMs,
    rng,
    battingTeamName: teamAName,
    bowlingTeamName: teamBName,
    onBall,
    onStatusUpdate,
    abortSignal,
    pauseSignal
  });

  const secondInnings = await simulateInnings(matchId, 2, teamB, teamA, {
    
    oversLimit,
    delayMs,
    rng,
    chaseTarget: firstInnings.runs,
    battingTeamName: teamBName,
    bowlingTeamName: teamAName,
    onBall,
    onStatusUpdate,
    abortSignal,
    pauseSignal
  });

  const result = determineResult(firstInnings, secondInnings, teamAName, teamBName);
  await pushMatchResult(matchId, result);

  if (typeof onStatusUpdate === "function") {
    onStatusUpdate({ status: "completed", matchId, result });
  }

  return {
    matchId,
    teamAName,
    teamBName,
    firstInnings: firstInnings.summary,
    secondInnings: secondInnings.summary,
    result
  };
}

module.exports = { startMatch, pushScorecard };
