const db = require("./firebase");
const { createSeededRandom } = require("./utils/random");
const commentaryEngine = require("./utils/commentaryEngine");
const DEFAULT_PROBABILITIES = {
  dot: 0.35,
  single: 0.30,
  double: 0.08,
  four: 0.14,
  six: 0.08,
  wicket: 0.05
};

function getMatchPhase(context) {
  const over = context.currentOver + 1; // 1-indexed for logic
  if (over <= 6) return "powerplay";
  if (over <= 15) return "middle";
  return "death";
}

function calculateAdjustedProbabilities(batsman, bowler, context) {
  const phase = getMatchPhase(context);
  const effects = context.environmentalEffects || {};
  
  // 1. Load Base Probabilities
  const batBase = batsman.batting?.base || batsman.batting_probabilities || DEFAULT_PROBABILITIES;
  const probs = {
    "dot": Number(batBase.dot) || 0.35,
    "1": Number(batBase["1"] || batBase.single) || 0.3,
    "2": Number(batBase["2"] || batBase.double) || 0.08,
    "4": Number(batBase["4"] || batBase.four) || 0.14,
    "6": Number(batBase["6"] || batBase.six) || 0.08,
    "wicket": Number(batBase.wicket) || 0.05
  };

  // 2. Apply Phase Aggression Modifiers
  const batsmanAggression = batsman.batting?.aggression?.[phase] ?? 0.5;
  const bowlerAggression = bowler.bowling?.aggression?.[phase] ?? 0.5;

  if (phase === "powerplay") {
    probs["dot"] *= (1.0 - (batsmanAggression * 0.3));
    probs["4"] *= (1.0 + batsmanAggression * 0.4);
    probs["6"] *= (1.0 + batsmanAggression * 0.2);
    probs["wicket"] *= (1.0 + (batsmanAggression * 0.2) + (bowlerAggression * 0.3));

    // Environmental: Swing Factor
    if (effects.swing) {
      probs["wicket"] *= effects.swing;
      probs["dot"] *= (1.0 + (effects.swing - 1.0) * 0.5);
    }
  } else if (phase === "middle") {
    const temperament = batsman.batting?.temperament ?? 0.5;
    probs["1"] *= (1.0 + temperament * 0.2);
    probs["2"] *= (1.0 + temperament * 0.1);
    probs["wicket"] *= (1.0 - temperament * 0.3);
    probs["4"] *= (1.0 - (1.0 - batsmanAggression) * 0.2);

    // Environmental: Spin Assistance
    if (effects.spinAssistance && context.bowlerType === "Spin") {
      probs["dot"] *= effects.spinAssistance;
      probs["wicket"] *= (1.0 + (effects.spinAssistance - 1.0) * 0.5);
    }
  } else if (phase === "death") {
    const finishing = batsman.behavior?.deathFinishing ?? 0.5;
    const slogging = batsman.behavior?.sloggingAbility ?? 0.5;
    const power = (finishing + slogging) / 2;
    
    probs["dot"] *= 0.7;
    probs["6"] *= (1.2 + power * 0.8);
    probs["4"] *= (1.1 + power * 0.4);
    probs["wicket"] *= (1.3 + (1.0 - power) * 0.5);
  }

  // 3. Apply Bowler Influence
  const economy = bowler.bowling?.economyControl ?? 0.5;
  const strike = bowler.bowling?.wicketTaking ?? 0.5;
  const accuracy = bowler.bowling?.accuracy ?? 0.5;

  probs["dot"] *= (1.0 + economy * 0.4 + accuracy * 0.2);
  probs["4"] *= (1.0 - economy * 0.3);
  probs["6"] *= (1.0 - economy * 0.4);
  probs["wicket"] *= (1.0 + strike * 0.6);

  // 4. Matchup Modifiers (vsPace / vsSpin)
  const matchupMultiplier = context.bowlerType === "Pace" 
    ? (batsman.batting?.vsPace ?? 1.0) 
    : (batsman.batting?.vsSpin ?? 1.0);
  
  probs["1"] *= matchupMultiplier;
  probs["4"] *= matchupMultiplier;
  probs["6"] *= matchupMultiplier;

  // 5. Match Context Modifiers (Pressure, Run Rate)
  if (context.isChasing && context.runsRequired !== null) {
    const ballsRemaining = context.ballsRemaining || 1;
    const rrr = (context.runsRequired / ballsRemaining) * 6;

    // Environmental: Dew Factor (Easier chasing)
    const dewBoost = effects.dew ? (1.0 + (effects.dew - 1.0) * 0.5) : 1.0;
    
    if (rrr > 9.0) {
      const pressure = Math.min(1.0, (rrr - 9.0) / 6.0);
      const handling = batsman.behavior?.pressureHandling ?? 0.5;
      const chaseBoost = batsman.behavior?.chaseBoost ?? 0.5;
      
      probs["6"] *= (1.0 + pressure * chaseBoost * 0.6 * dewBoost);
      probs["4"] *= (1.0 + pressure * chaseBoost * 0.3 * dewBoost);
      probs["wicket"] *= (1.0 + pressure * (1.0 - handling) * 0.8 / dewBoost);
    } else {
      // Normal chasing with dew
      probs["1"] *= dewBoost;
      probs["4"] *= dewBoost;
    }
  }

  // 6. Batting Collapse Resistance
  if (context.wicketsFallen >= 3) {
    const resistance = batsman.behavior?.collapseResistance ?? 0.5;
    probs["wicket"] *= (1.2 - resistance * 0.5);
    if (resistance > 0.7) {
      probs["dot"] *= 1.1;
    }
  }

  // 7. Form and Stamina Decay
  const form = batsman.form ?? 1.0;
  probs["1"] *= (0.9 + form * 0.2);
  probs["4"] *= (0.9 + form * 0.2);

  if (batsman.stamina) {
    // Environmental: Heat Fatigue
    const fatigueMultiplier = effects.heatFatigue ?? 1.0;
    const decayRate = (batsman.stamina.decayRate ?? 0.01) * fatigueMultiplier;
    const faced = context.batsmanBallsFaced || 0;
    const currentStamina = Math.max(0.2, (batsman.stamina.initial ?? 1.0) - (faced * decayRate));
    
    probs["6"] *= (0.5 + currentStamina * 0.5);
    probs["4"] *= (0.7 + currentStamina * 0.3);
    probs["wicket"] *= (1.0 + (1.0 - currentStamina) * 0.4);
  }

  // Ensure no negative probabilities
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

function createAbortError(matchId) {
  const error = new Error(`Match ${matchId} was aborted.`);
  error.code = "MATCH_ABORTED";
  return error;
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
  let partnershipRuns = 0;
  let partnershipBalls = 0;
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

  const validBowlers = bowling.filter(p => {
    const role = (p.role || "").toLowerCase();
    const type = (p.type || "").toLowerCase();
    return role === "bowler" || role === "allrounder" || type.includes("bowler") || type === "tailender";
  });
  const bowlersToUse = validBowlers.length > 0 ? validBowlers : bowling;

  for (let over = 0; over < oversLimit; over++) {
    const bowler = bowlersToUse[over % bowlersToUse.length];
    let runsInOver = 0;

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
        runsRequired: chaseTarget !== null ? Math.max(chaseTarget - runs, 0) : null,
        ballsRemaining: (oversLimit * 6) - ballsBowled,
        partnershipRuns,
        partnershipBalls,
        environmentalEffects: options.environmentalEffects || {}
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
        partnershipRuns = 0;
        partnershipBalls = 0;
      }

      runsInOver += ballRuns;
      partnershipRuns += ballRuns;
      partnershipBalls += 1;
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
      let wicketType = null;
      if (result === "W") {
        const wr = rng.next();
        if (wr < 0.2) wicketType = "bowled";
        else if (wr < 0.4) wicketType = "lbw";
        else if (wr < 0.1) wicketType = "stumped";
        else wicketType = "caught";
      }

      const commentaryText = commentaryEngine.generate(matchId, {
        result,
        batsman: batsman,
        bowler: bowler,
        battingTeam: battingTeamName,
        bowlingTeam: bowlingTeamName,
        wicketType,
        state: {
          runs,
          wickets,
          over: currentOver,
          ball: currentBall,
          totalOvers: oversLimit,
          target: chaseTarget,
          isChasing: chaseTarget !== null
        }
      });

      await pushCommentary(matchId, String(ballsBowled).padStart(3, "0"), commentaryText);

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

    // Over Summary Commentary
    if (!abortSignal?.aborted) {
      const overSummaryText = commentaryEngine.generate(matchId, {
        isOverEnd: true,
        runsInOver,
        battingTeam: battingTeamName,
        bowlingTeam: bowlingTeamName,
        bowler: bowler,
        state: {
          runs,
          wickets,
          over: over,
          totalOvers: oversLimit
        }
      });
      await pushCommentary(matchId, String(ballsBowled).padStart(3, "1"), overSummaryText);
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
    pauseSignal,
    environmentalEffects: options.environmentalEffects
  });

  if (abortSignal?.aborted) {
    throw createAbortError(matchId);
  }

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
    pauseSignal,
    environmentalEffects: options.environmentalEffects
  });


  if (abortSignal?.aborted) {
    throw createAbortError(matchId);
  }

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
