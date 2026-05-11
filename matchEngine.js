const db = require("./firebase");
const commentaryEngine = require("./utils/commentaryEngine");
const { createSeededRandom } = require("./utils/random");
const GuidedSimulationController = require("./guidedSimulationController");
const WinPredictor = require("./services/winPredictor");
const CareerEngine = require("./services/careerEngine");
const FormEngine = require("./services/formEngine");
const FatigueEngine = require("./services/fatigueEngine");
const RankingEngine = require("./services/rankingEngine");
const SeriesEngine = require("./services/seriesEngine");


const DEFAULT_PROBABILITIES = {
  dot: 0.35,
  "1": 0.30,
  "2": 0.08,
  "3": 0.01,
  "4": 0.14,
  "6": 0.08,
  "wicket": 0.04
};

function getMatchPhase(over, totalOvers, matchType) {
  if (totalOvers === 50 || matchType === "ODI") {
    if (over < 10) return "powerplay";
    if (over < 40) return "middle";
    return "death";
  }
  // Default T20 logic
  if (over < 6) return "powerplay";
  if (over < 15) return "middle";
  return "death";
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

  const phase = getMatchPhase(context.currentOver, context.totalOvers);
  const batsmanType = (batsman.type || "").toLowerCase();
  
  let boundaryMult = 1.0;
  let dotMult = 1.0;
  let wicketMult = 1.0;
  let singleMult = 1.0;
  let doubleMult = 1.0;

  const isODI = context.totalOvers === 50 || context.matchType === "ODI";

  // Phase adjustments
  if (phase === "powerplay") {
    boundaryMult = isODI ? 1.2 : 1.4;
    dotMult = isODI ? 0.9 : 0.8;
    wicketMult = isODI ? 1.15 : 1.1;
  } else if (phase === "middle") {
    boundaryMult = isODI ? 0.6 : 0.9;
    dotMult = isODI ? 0.8 : 0.9;
    wicketMult = isODI ? 0.7 : 0.8;
    singleMult = isODI ? 1.5 : 1.0;
    doubleMult = isODI ? 1.3 : 1.0;
  } else if (phase === "death") {
    boundaryMult = isODI ? 2.5 : 2.2;
    dotMult = isODI ? 0.4 : 0.5;
    wicketMult = isODI ? 2.0 : 1.8;
  }

  // Settling System for ODI
  if (isODI && context.batsmanBalls !== undefined) {
    if (context.batsmanBalls < 10) {
      boundaryMult *= 0.6;
      wicketMult *= 1.1;
      dotMult *= 1.2;
    } else if (context.batsmanBalls >= 30) {
      boundaryMult *= 1.2;
      wicketMult *= 0.8;
      singleMult *= 1.1;
    }
  }

  // Partnership Momentum for ODI
  if (isODI && context.partnershipBalls !== undefined && context.partnershipBalls > 30) {
    wicketMult *= 0.85;
    singleMult *= 1.1;
  }

  // Batsman type impact
  if (batsmanType.includes("aggressive") || batsmanType.includes("hitter")) {
    boundaryMult *= 1.3;
    wicketMult *= 1.2;
    dotMult *= 0.9;
  } else if (batsmanType.includes("anchor") || batsmanType.includes("accumulator")) {
    boundaryMult *= 0.8;
    wicketMult *= 0.6;
    dotMult *= 1.1;
    singleMult *= 1.2;
  }

  // Chase logic / Pressure
  if (context.isChasing && context.target !== null) {
    const ballsRemaining = (context.totalOvers * 6) - ((context.currentOver * 6) + context.currentBallInOver);
    const runsRemaining = Math.max(0, context.target - context.currentScore);
    const rrr = ballsRemaining > 0 ? (runsRemaining / ballsRemaining) * 6 : 0;
    
    // In ODI, urgency builds slightly differently
    const criticalRRR = isODI ? 8 : 10;
    if (rrr > criticalRRR) {
      const urgency = Math.min(1.5, (rrr - criticalRRR) / criticalRRR);
      boundaryMult *= (1.0 + urgency);
      wicketMult *= (1.0 + urgency * 0.8);
      dotMult *= (1.0 - urgency * 0.3);
    }
  }

  // Wickets fallen pressure
  const criticalWickets = isODI ? 5 : 7;
  if (context.wicketsFallen >= criticalWickets) {
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
  probs["1"] *= singleMult;
  probs["2"] *= doubleMult;
  probs["dot"] *= dotMult;
  probs["wicket"] *= wicketMult;

  // Final normalization
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  Object.keys(probs).forEach(k => probs[k] /= total);
  return probs;
}

function simulateBall(batsman, bowler, context) {
  // First check for extras (Wide / No Ball) - approx 4% chance in T20
  const isODI = context.totalOvers === 50 || context.matchType === "ODI";
  const extraRand = context.rng.next();
  const wideProb = isODI ? 0.02 : 0.03;
  const nbProb = isODI ? 0.01 : 0.04;
  
  if (extraRand < wideProb) return "WD"; // Wide
  if (extraRand < wideProb + nbProb) return "NB"; // No Ball

  let p = calculateAdjustedProbabilities(batsman, bowler, context);
  
  if (context.guidedSimulationSettings && context.guidedSimulationSettings.enabled) {
      p = GuidedSimulationController.applySteering(p, context);
  }

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
  const { oversLimit = 20, delayMs = 100, rng, chaseTarget = null, battingTeamName, bowlingTeamName, venue, abortSignal, onBall, guidedSimulationSettings, matchType } = options;
  
  console.log(`[MATCH:${matchId}] Starting Inning ${inningNumber}. Target: ${isNaN(chaseTarget) || chaseTarget === null ? "N/A" : chaseTarget}`);
  const target = isNaN(chaseTarget) || chaseTarget === null ? Infinity : chaseTarget;
  
  let runs = 0, wickets = 0, ballsBowled = 0, legalBallsInOver = 0, currentOver = 0;
  let strikerIdx = 0, nonStrikerIdx = 1, nextBatsmanIdx = 2;
  
  const scorecard = { batting: {}, bowling: {}, extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 } };
  const bowlerStats = {}; // Tracks overs, runs, wickets per bowler
  const recentBalls = [];
  let currentPartnership = { runs: 0, balls: 0, strikerRuns: 0, nonStrikerRuns: 0, strikerId: null, nonStrikerId: null };
  let lastWicket = null;
  
  // Initialize scorecard with all players (DNB)
  batting.forEach((p, i) => {
    scorecard.batting[p.id || p.name] = { name: p.name, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, status: "DNB", pos: i };
  });
  scorecard.batting[batting[0].id || batting[0].name].status = "not out";
  scorecard.batting[batting[1].id || batting[1].name].status = "not out";

  let lastBowlerId = null;


  while (currentOver < oversLimit && wickets < 10 && (chaseTarget === null || runs < chaseTarget)) {
    // Select bowler for the over
    const maxOversPerBowler = (oversLimit === 50 || matchType === "ODI") ? Math.ceil(oversLimit / 5) : (oversLimit === 90 ? 25 : Math.ceil(oversLimit / 5));
    const possibleBowlers = bowling.map((p, index) => ({ ...p, originalIndex: index }))
      .filter(p => {
        const id = p.id || p.name;
        const stats = bowlerStats[id] || { overs: 0 };
        return id !== lastBowlerId && stats.overs < maxOversPerBowler;
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

      let currentMilestone = null;
      const batsman = batting[strikerIdx];
      const batStat = scorecard.batting[batsman.id || batsman.name];
      const context = {
        currentOver, currentBallInOver: legalBallsInOver, totalOvers: oversLimit, 
        wicketsFallen: wickets, isChasing: chaseTarget !== null, target: chaseTarget, 
        currentScore: runs, rng, battingTeamName, bowlingTeamName, guidedSimulationSettings,
        batsmanBalls: batStat ? batStat.balls : 0,
        partnershipBalls: currentPartnership.balls,
        matchType: matchType
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
        const outBatsman = batsman;
        const batStat = scorecard.batting[outBatsman.id || outBatsman.name];
        lastWicket = {
            name: outBatsman.name,
            playerRuns: batStat.runs,
            playerBalls: batStat.balls + 1, // Including the ball they got out on
            score: runs,
            overs: `${currentOver}.${legalBallsInOver + 1}`
        };
        
        batStat.status = "out";
        batStat.balls += 1;
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
        const oldRuns = batStat.runs;
        batStat.runs += ballRuns;
        batStat.balls += 1;
        
        // Milestone check for celebration
        if (oldRuns < 50 && batStat.runs >= 50) currentMilestone = { id: `${batsman.name}_50`, type: '50', player: batsman.name };
        else if (oldRuns < 100 && batStat.runs >= 100) currentMilestone = { id: `${batsman.name}_100`, type: '100', player: batsman.name };
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
        milestone: currentMilestone,
        lastWicket: lastWicket,
        score: `${runs}/${wickets}`,
        cumulativeRuns: runs,
        wickets: wickets,
        timestamp: Date.now()
      };

      // Update Firebase
      const updates = {};
      
      // 1. The persistent history of balls (Moved to separate root node for flat structure)
      updates[`match_balls/${matchId}/${inningNumber}/${ballId}`] = ballData;
      
      // 2. The live snapshot for the dashboard/main UI
      const predictorContext = {
        runs, wickets, over: currentOver, ball: legalBallsInOver,
        target: chaseTarget, oversLimit, matchType,
        striker: batting[strikerIdx], nonStriker: batting[nonStrikerIdx],
        bowler, recentBalls, partnership: currentPartnership,
        venueProfile: options.venueProfile || null
      };

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
        winProbability: WinPredictor.calculate(predictorContext),
        milestone: currentMilestone,
        lastWicket: lastWicket,
        target: chaseTarget,
        result,
        lastBall: ballData // Include latest ball data in snapshot too
      };

      // 3. Scorecard update (Moved to separate root node)
      updates[`match_scorecards/${matchId}/${inningNumber}`] = {
          batting: Object.values(scorecard.batting).sort((a,b) => a.pos - b.pos),
          bowling: Object.values(bowlerStats),
          extras: scorecard.extras,
          total: { runs, wickets, overs: `${currentOver}.${legalBallsInOver}` }
      };
      
      // Commentary (Moved to separate root node)
      const commId = String(ballsBowled + (inningNumber - 1) * 120).padStart(3, "0");
      updates[`match_commentary/${matchId}/${commId}`] = commentaryEngine.generate(matchId, {
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
    await db.ref(`match_commentary/${matchId}/${overSummaryCommId}`).set(commentaryEngine.generate(matchId, overSummary));

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
  await db.ref(`match_innings_summary/${matchId}/${inningNumber}`).set(finalSummary);

  // Match/Innings End Commentary
  const endCommId = String(ballsBowled + (inningNumber - 1) * 120 + 1).padStart(3, "0") + "_end";
  const endContext = inningNumber === 2 ? "match_end" : "innings_end";
  await db.ref(`match_commentary/${matchId}/${endCommId}`).set(
      inningNumber === 2 ? `**MATCH OVER!** ${battingTeamName} finished at ${runs}/${wickets} in ${currentOver}.${legalBallsInOver} overs.` :
      `**INNINGS OVER!** ${battingTeamName} set a target of ${runs + 1} runs.`
  );

  return { ...finalSummary, battingStats: scorecard.batting, bowlingStats: bowlerStats };
}

async function startMatch(matchId, teamA, teamB, options = {}) {
  const { teamAName = "Team A", teamBName = "Team B", oversLimit = 20, delayMs = 100, venue = "International Stadium", guidedSimulationSettings } = options;
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
  await db.ref(`match_lineups/${matchId}`).set(lineups);

  // Innings 1: Team A bats
  const firstInnings = await simulateInnings(matchId, 1, teamA, teamB, {
      oversLimit, delayMs, rng, battingTeamName: teamAName, bowlingTeamName: teamBName, venue, guidedSimulationSettings
  });

  // Innings 2: Team B bats
  const secondInnings = await simulateInnings(matchId, 2, teamB, teamA, {
      oversLimit, delayMs, rng, chaseTarget: firstInnings.runs + 1, battingTeamName: teamBName, bowlingTeamName: teamAName, venue, guidedSimulationSettings
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
  await db.ref(`matches/list/${matchId}`).update({ 
    status: "completed", 
    resultSummary: result.summary,
    winner: result.winner,
    scoreA: `${firstInnings.runs}/${firstInnings.wickets}`,
    oversA: firstInnings.overs,
    scoreB: `${secondInnings.runs}/${secondInnings.wickets}`,
    oversB: secondInnings.overs
  });

  // Process International Ecosystem updates if part of a series
  if (options.seriesId) {
      try {
          await SeriesEngine.processMatchResult(options.seriesId, result.winner);
          if (result.winner !== "Tie") {
             await RankingEngine.updateTeamRanking(teamAName, teamBName, result.winner, options.matchType || "T20");
          }
          
          const format = options.matchType || "T20";

          const processEcosystemStats = async (inningsStats) => {
              for (const p of Object.values(inningsStats.battingStats || {})) {
                  const pid = p.id || p.name;
                  await CareerEngine.updateCareerStats(pid, p);
                  await FormEngine.updateForm(pid, { runs: p.runs });
                  await FatigueEngine.addWorkload(pid, 0, p.runs, format);
              }
              for (const p of Object.values(inningsStats.bowlingStats || {})) {
                  const pid = p.id || p.name;
                  // balls might be recorded as balls or overs in bowlingStats, assuming 'balls'
                  await CareerEngine.updateCareerStats(pid, { wickets: p.wickets, ballsBowled: p.balls, runsConceded: p.runs });
                  await FormEngine.updateForm(pid, { wickets: p.wickets });
                  await FatigueEngine.addWorkload(pid, p.balls ? p.balls / 6 : 0, 0, format);
              }
          };

          await processEcosystemStats(firstInnings);
          await processEcosystemStats(secondInnings);
      } catch (e) {
          console.error("Failed to process international ecosystem updates:", e);
      }
  }

  return { matchId, result, firstInnings, secondInnings };
}

module.exports = { startMatch };

