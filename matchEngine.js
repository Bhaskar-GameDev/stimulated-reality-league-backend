const db = require("./firebase");
const commentaryEngine = require("./utils/commentaryEngine");
const { createSeededRandom } = require("./utils/random");

const DEFAULT_PROBABILITIES = {
  dot: 0.35,
  "1": 0.30,
  "2": 0.08,
  "3": 0.01,
  "4": 0.14,
  "6": 0.08,
  "wicket": 0.04
};

function getMatchPhase(over) {
  if (over < 6) return "powerplay"; // 1-6
  if (over < 15) return "middle";   // 7-15
  return "death";                  // 16-20
}

/**
 * Calculates probabilities based on player skills, phase, and match situation.
 */
function calculateAdjustedProbabilities(batsman, bowler, context) {
  const batBase = batsman.batting?.base || DEFAULT_PROBABILITIES;
  const bowlBase = bowler.bowling?.base || DEFAULT_PROBABILITIES;

  // Initial merge: Average of batsman's intent and bowler's restriction
  const probs = {
    "dot": (Number(batBase.dot || 0.3) + Number(bowlBase.dot || 0.4)) / 2,
    "1": (Number(batBase["1"] || 0.3) + Number(bowlBase["1"] || 0.3)) / 2,
    "2": (Number(batBase["2"] || 0.05) + Number(bowlBase["2"] || 0.05)) / 2,
    "3": (Number(batBase["3"] || 0.01) + Number(bowlBase["3"] || 0.01)) / 2,
    "4": (Number(batBase["4"] || 0.1) + Number(bowlBase["4"] || 0.1)) / 2,
    "6": (Number(batBase["6"] || 0.05) + Number(bowlBase["6"] || 0.05)) / 2,
    "wicket": (Number(batBase.wicket || 0.04) + Number(bowlBase.wicket || 0.05)) / 2
  };

  const phase = getMatchPhase(context.currentOver);
  const batsmanType = (batsman.type || "").toLowerCase();
  
  let boundaryMult = 1.0;
  let dotMult = 1.0;
  let wicketMult = 1.0;

  // Phase adjustments
  if (phase === "powerplay") {
    boundaryMult = 1.4;
    dotMult = 0.8;
    wicketMult = 1.1;
  } else if (phase === "middle") {
    boundaryMult = 0.9;
    dotMult = 0.9;
    wicketMult = 0.8;
  } else if (phase === "death") {
    boundaryMult = 2.2;
    dotMult = 0.5;
    wicketMult = 1.8;
  }

  // Batsman type impact
  if (batsmanType.includes("aggressive") || batsmanType.includes("hitter")) {
    boundaryMult *= 1.3;
    wicketMult *= 1.2;
    dotMult *= 0.9;
  } else if (batsmanType.includes("anchor")) {
    boundaryMult *= 0.8;
    wicketMult *= 0.6;
    dotMult *= 1.1;
  }

  // Chase logic / Pressure
  if (context.isChasing && context.target !== null) {
    const ballsRemaining = (context.totalOvers * 6) - ((context.currentOver * 6) + context.currentBallInOver);
    const runsRemaining = Math.max(0, context.target - context.currentScore);
    const rrr = ballsRemaining > 0 ? (runsRemaining / ballsRemaining) * 6 : 0;
    
    if (rrr > 10) {
      const urgency = Math.min(1.5, (rrr - 10) / 10);
      boundaryMult *= (1.0 + urgency);
      wicketMult *= (1.0 + urgency * 0.8);
      dotMult *= (1.0 - urgency * 0.3);
    }
  }

  // Wickets fallen pressure
  if (context.wicketsFallen >= 7) {
    wicketMult *= 1.5;
    boundaryMult *= 0.7;
  }

  // Matchup: Pace vs Spin
  const isSpin = (bowler.bowling?.type || "").toLowerCase().includes("spin");
  const matchupScore = isSpin ? (batsman.batting?.vsSpin ?? 1.0) : (batsman.batting?.vsPace ?? 1.0);
  boundaryMult *= matchupScore;

  // Apply multipliers
  probs["4"] *= boundaryMult;
  probs["6"] *= boundaryMult;
  probs["dot"] *= dotMult;
  probs["wicket"] *= wicketMult;

  // Final normalization
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  Object.keys(probs).forEach(k => probs[k] /= total);
  return probs;
}

function simulateBall(batsman, bowler, context) {
  // First check for extras (Wide / No Ball) - approx 4% chance in T20
  const extraRand = context.rng.next();
  if (extraRand < 0.03) return "WD"; // Wide
  if (extraRand < 0.04) return "NB"; // No Ball

  const p = calculateAdjustedProbabilities(batsman, bowler, context);
  const r = context.rng.next();

  let cumulative = 0;
  const categories = ["dot", "1", "2", "3", "4", "6", "wicket"];
  for (const cat of categories) {
    cumulative += p[cat];
    if (r < cumulative) {
        if (cat === "wicket") return "W";
        return cat;
    }
  }
  return "dot";
}

async function simulateInnings(matchId, inningNumber, batting, bowling, options = {}) {
  const { oversLimit = 20, delayMs = 100, rng, chaseTarget = null, battingTeamName, bowlingTeamName, venue, abortSignal, onBall } = options;
  
  console.log(`[MATCH:${matchId}] Starting Inning ${inningNumber}. Target: ${isNaN(chaseTarget) || chaseTarget === null ? "N/A" : chaseTarget}`);
  const target = isNaN(chaseTarget) || chaseTarget === null ? Infinity : chaseTarget;
  
  let runs = 0, wickets = 0, ballsBowled = 0, legalBallsInOver = 0, currentOver = 0;
  let strikerIdx = 0, nonStrikerIdx = 1, nextBatsmanIdx = 2;
  
  const scorecard = { batting: {}, bowling: {}, extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 } };
  const bowlerStats = {}; // Tracks overs, runs, wickets per bowler
  const recentBalls = [];
  let currentPartnership = { runs: 0, balls: 0, strikerRuns: 0, nonStrikerRuns: 0, strikerId: null, nonStrikerId: null };
  
  // Initialize scorecard with all players (DNB)
  batting.forEach((p, i) => {
    scorecard.batting[p.id || p.name] = { name: p.name, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, status: "DNB", pos: i };
  });
  scorecard.batting[batting[0].id || batting[0].name].status = "not out";
  scorecard.batting[batting[1].id || batting[1].name].status = "not out";

  let lastBowlerId = null;

  const calculateWinProbability = (runs, wickets, over, ball, target) => {
    if (target === null) {
      // 1st Innings: Heuristic based on projected score
      const totalBalls = oversLimit * 6;
      const ballsDone = (over * 6) + ball;
      const projected = ballsDone > 0 ? (runs / ballsDone) * totalBalls : 160;
      let prob = 50 + (projected - 160) / 2.5;
      prob -= (wickets * 3); 
      return Math.max(15, Math.min(85, Math.round(prob)));
    } else {
      // 2nd Innings: Based on RRR and Wickets
      const totalBalls = oversLimit * 6;
      const ballsDone = (over * 6) + ball;
      const ballsLeft = Math.max(1, totalBalls - ballsDone);
      const runsLeft = target - runs;
      if (runsLeft <= 0) return 100;
      const rrr = (runsLeft / ballsLeft) * 6;
      const wicketsLeft = 10 - wickets;
      let prob = 100 - (rrr * 8) + (wicketsLeft * 4) - 20;
      return Math.max(0, Math.min(100, Math.round(prob)));
    }
  };



  while (currentOver < oversLimit && wickets < 10 && (chaseTarget === null || runs < chaseTarget)) {
    // Select bowler for the over
    const possibleBowlers = bowling.map((p, index) => ({ ...p, originalIndex: index }))
      .filter(p => {
        const id = p.id || p.name;
        const stats = bowlerStats[id] || { overs: 0 };
        return id !== lastBowlerId && stats.overs < 4;
      });
    
    // Sort possible bowlers: 
    // Frontline Bowlers (index 7-10) get highest priority
    // All-rounders (index 4-6) get medium priority
    // Top order (index 0-3) get lowest priority
    possibleBowlers.sort((a, b) => {
        const getPriority = (idx) => {
            if (idx >= 7) return 3; // Main Bowler
            if (idx >= 4) return 2; // All-rounder
            return 1; // Part-timer
        };
        const prioA = getPriority(a.originalIndex);
        const prioB = getPriority(b.originalIndex);
        if (prioA !== prioB) return prioB - prioA;
        // If same priority, pick the one with fewer overs bowled
        const statsA = bowlerStats[a.id || a.name]?.overs || 0;
        const statsB = bowlerStats[b.id || b.name]?.overs || 0;
        return statsA - statsB;
    });

    // Pick among best available
    const poolSize = possibleBowlers.length >= 3 ? 3 : possibleBowlers.length;
    const bowler = possibleBowlers[Math.floor(rng.next() * poolSize)] || bowling[10];
    
    const bowlerId = bowler.id || bowler.name;
    lastBowlerId = bowlerId;

    if (!bowlerStats[bowlerId]) {
        bowlerStats[bowlerId] = { name: bowler.name, balls: 0, runs: 0, wickets: 0, overs: "0", economy: 0 };
    }

    legalBallsInOver = 0;
    let runsThisOver = 0;
    while (legalBallsInOver < 6 && wickets < 10 && (runs < target)) {
      if (abortSignal?.aborted) return;

      const batsman = batting[strikerIdx];
      const context = {
        currentOver, currentBallInOver: legalBallsInOver, totalOvers: oversLimit, 
        wicketsFallen: wickets, isChasing: chaseTarget !== null, target: chaseTarget, 
        currentScore: runs, rng
      };

      const result = simulateBall(batsman, bowler, context);
      let ballRuns = 0;
      let isLegal = true;

      // Partnership tracking
      if (currentPartnership.strikerId !== (batsman.id || batsman.name)) {
          // If striker changed (e.g. new innings or just started), sync IDs
          currentPartnership.strikerId = (batsman.id || batsman.name);
          currentPartnership.nonStrikerId = batting[nonStrikerIdx]?.id || batting[nonStrikerIdx]?.name;
      }

      if (result === "WD") {
        runs += 1;
        scorecard.extras.wides += 1;
        bowlerStats[bowlerId].runs += 1;
        runsThisOver += 1;
        currentPartnership.runs += 1; // Wide adds to partnership total but not to individual balls
        isLegal = false;
      } else if (result === "NB") {
        runs += 1;
        scorecard.extras.noBalls += 1;
        bowlerStats[bowlerId].runs += 1;
        runsThisOver += 1;
        currentPartnership.runs += 1;
        isLegal = false;
      } else if (result === "W") {
        wickets += 1;
        scorecard.batting[batsman.id || batsman.name].status = "out";
        scorecard.batting[batsman.id || batsman.name].balls += 1;
        bowlerStats[bowlerId].balls += 1;
        bowlerStats[bowlerId].wickets += 1;
        
        // Reset Partnership on wicket
        currentPartnership = { runs: 0, balls: 0, strikerRuns: 0, nonStrikerRuns: 0, strikerId: null, nonStrikerId: null };

        if (nextBatsmanIdx < batting.length) {
            strikerIdx = nextBatsmanIdx++;
            scorecard.batting[batting[strikerIdx].id || batting[strikerIdx].name].status = "not out";
        } else {
            strikerIdx = -1; // All out
        }
      } else {
        ballRuns = parseInt(result) || 0;
        runs += ballRuns;
        runsThisOver += ballRuns;
        bowlerStats[bowlerId].runs += ballRuns;
        bowlerStats[bowlerId].balls += 1;
        
        // Update Partnership
        currentPartnership.runs += ballRuns;
        currentPartnership.balls += 1;
        currentPartnership.strikerRuns += ballRuns;

        const batStat = scorecard.batting[batsman.id || batsman.name];
        batStat.runs += ballRuns;
        batStat.balls += 1;
        if (ballRuns === 4) batStat.fours += 1;
        if (ballRuns === 6) batStat.sixes += 1;
        batStat.strikeRate = Number(((batStat.runs / batStat.balls) * 100).toFixed(1));

        // Strike rotation
        if (ballRuns % 2 !== 0) {
            [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
            // Also rotate partnership individual trackers
            [currentPartnership.strikerRuns, currentPartnership.nonStrikerRuns] = [currentPartnership.nonStrikerRuns, currentPartnership.strikerRuns];
            [currentPartnership.strikerId, currentPartnership.nonStrikerId] = [currentPartnership.nonStrikerId, currentPartnership.strikerId];
        }
      }

      if (isLegal) {
          legalBallsInOver++;
          ballsBowled++;
      }

      // Track recent balls for UI
      recentBalls.push(result);
      if (recentBalls.length > 12) recentBalls.shift();

      // NEW/OLD ARCHITECTURE: Record every ball in the 'balls' section
      const ballId = `${currentOver}_${legalBallsInOver}_${Date.now()}`; // Unique key for the ball
      const totalBallRuns = result === "W" ? 0 : (result === "WD" || result === "NB" ? 1 : (parseInt(result) || 0));
      const isWicket = result === "W";
      
      const ballData = {
        inning: inningNumber,
        over: currentOver,
        ball: legalBallsInOver,
        result,
        ballRuns: totalBallRuns, // Numeric runs for charts
        isWicket, // Boolean for charts
        batsman: batsman.name,
        bowler: bowler.name,
        score: `${runs}/${wickets}`,
        cumulativeRuns: runs,
        wickets: wickets,
        timestamp: Date.now()
      };

      // Update Firebase
      const updates = {};
      
      // 1. The persistent history of balls
      updates[`matches/${matchId}/balls/${inningNumber}/${ballId}`] = ballData;
      
      // 2. The live snapshot for the dashboard/main UI
      updates[`matches/${matchId}/snapshot`] = {
        inning: inningNumber, 
        runs, 
        wickets, 
        over: currentOver,
        ball: legalBallsInOver,
        striker: batting[strikerIdx]?.name || "None",
        nonStriker: batting[nonStrikerIdx]?.name || "None",
        bowler: bowler.name,
        recentBalls,
        partnership: currentPartnership, // ADDED: Active partnership data
        winProbability: calculateWinProbability(runs, wickets, currentOver, legalBallsInOver, chaseTarget),
        target: chaseTarget,
        result,
        lastBall: ballData // Include latest ball data in snapshot too
      };

      // 3. Scorecard update
      updates[`matches/${matchId}/scorecard/${inningNumber}`] = {
          batting: Object.values(scorecard.batting).sort((a,b) => a.pos - b.pos),
          bowling: Object.values(bowlerStats),
          extras: scorecard.extras,
          total: { runs, wickets, overs: `${currentOver}.${legalBallsInOver}` }
      };
      
      // Commentary
      const commId = String(ballsBowled + (inningNumber - 1) * 120).padStart(3, "0");
      updates[`matches/${matchId}/commentary/${commId}`] = commentaryEngine.generate(matchId, {
          result, batsman, bowler, battingTeam: battingTeamName, bowlingTeam: bowlingTeamName, venue,
          state: { 
            runs, wickets, over: currentOver, ball: legalBallsInOver, 
            target: chaseTarget, isChasing: chaseTarget !== null,
            totalOvers: oversLimit
          }
      });

      await db.ref().update(updates);
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }

    // Over end
    currentOver++;
    bowlerStats[bowlerId].overs = Math.floor(bowlerStats[bowlerId].balls / 6);
    bowlerStats[bowlerId].economy = Number((bowlerStats[bowlerId].runs / (bowlerStats[bowlerId].balls / 6)).toFixed(2));
    
    // Over summary commentary
    const lastBatsman = batting[strikerIdx];
    const overSummaryCommId = String(ballsBowled + (inningNumber - 1) * 120).padStart(3, "0") + "_over";
    const overSummary = {
        result: "dot", // dummy
        isOverEnd: true,
        batsman: lastBatsman,
        bowler: bowler, // bowler is already in scope from the outer loop
        battingTeam: battingTeamName,
        bowlingTeam: bowlingTeamName,
        venue,
        runsInOver: runsThisOver,
        state: { 
            runs, wickets, over: currentOver, ball: 0, 
            target: chaseTarget, isChasing: chaseTarget !== null,
            totalOvers: oversLimit
        }
    };
    await db.ref(`matches/${matchId}/commentary/${overSummaryCommId}`).set(commentaryEngine.generate(matchId, overSummary));

    // Rotate strike at end of over
    if (wickets < 10 && strikerIdx !== -1 && runs < (chaseTarget || Infinity)) {
        [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
    }
  }

  const finalSummary = { 
      runs, 
      wickets, 
      overs: `${currentOver}.${legalBallsInOver}`, 
      ballsBowled,
      finishedAt: Date.now() 
  };
  await db.ref(`matches/${matchId}/innings/${inningNumber}/summary`).set(finalSummary);

  // Match/Innings End Commentary
  const endCommId = String(ballsBowled + (inningNumber - 1) * 120 + 1).padStart(3, "0") + "_end";
  const endContext = inningNumber === 2 ? "match_end" : "innings_end";
  await db.ref(`matches/${matchId}/commentary/${endCommId}`).set(
      inningNumber === 2 ? `**MATCH OVER!** ${battingTeamName} finished at ${runs}/${wickets} in ${currentOver}.${legalBallsInOver} overs.` :
      `**INNINGS OVER!** ${battingTeamName} set a target of ${runs + 1} runs.`
  );

  return finalSummary;
}

async function startMatch(matchId, teamA, teamB, options = {}) {
  const { teamAName = "Team A", teamBName = "Team B", oversLimit = 20, delayMs = 100, venue = "International Stadium" } = options;
  const rng = createSeededRandom(matchId);

  const initData = {
    matchId, teamA: teamAName, teamB: teamBName, status: "running",
    oversLimit, venue, startedAt: Date.now()
  };
  await db.ref(`matches/${matchId}/meta`).set(initData);
  await db.ref(`matches/list/${matchId}`).set(initData);

  // Save Lineups (Playing XI) so they appear in the Info tab
  const lineups = {};
  lineups[teamAName] = teamA;
  lineups[teamBName] = teamB;
  await db.ref(`matches/${matchId}/lineups`).set(lineups);

  // Innings 1: Team A bats
  const firstInnings = await simulateInnings(matchId, 1, teamA, teamB, {
      oversLimit, delayMs, rng, battingTeamName: teamAName, bowlingTeamName: teamBName, venue
  });

  // Innings 2: Team B bats
  const secondInnings = await simulateInnings(matchId, 2, teamB, teamA, {
      oversLimit, delayMs, rng, chaseTarget: firstInnings.runs + 1, battingTeamName: teamBName, bowlingTeamName: teamAName, venue
  });

  // Calculate Result
  let winner = null, margin = "";
  if (secondInnings.runs >= firstInnings.runs + 1) {
      winner = teamBName;
      const wicketsLeft = 10 - secondInnings.wickets;
      const ballsLeft = (oversLimit * 6) - secondInnings.ballsBowled;
      margin = `${wicketsLeft} wickets (with ${ballsLeft} balls remaining)`;
  } else if (secondInnings.runs === firstInnings.runs) {
      winner = "Tie";
      margin = "Scores level";
  } else {
      winner = teamAName;
      margin = `${firstInnings.runs - secondInnings.runs} runs`;
  }

  const result = { winner, margin, summary: `${winner} won by ${margin}` };
  await db.ref(`matches/${matchId}/result`).set(result);
  await db.ref(`matches/${matchId}/status`).set("completed");
  await db.ref(`matches/list/${matchId}`).update({ status: "completed", resultSummary: result.summary });

  return { matchId, result, firstInnings, secondInnings };
}

module.exports = { startMatch };

