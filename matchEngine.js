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
  const momentum = context.momentum || 0; // -100 to 100
  const isFinal = context.isFinal || false;

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

  // Momentum Impact: Positive momentum helps batsman, negative helps bowler
  if (momentum > 0) {
      boundaryMult *= (1 + momentum / 500);
      wicketMult *= (1 - momentum / 1000);
  } else if (momentum < 0) {
      dotMult *= (1 + Math.abs(momentum) / 500);
      wicketMult *= (1 + Math.abs(momentum) / 500);
  }

  // Final / Pressure Logic
  if (isFinal) {
      const experience = batsman.experience || 50; // 0-100
      if (experience < 40) {
          wicketMult *= 1.3; // Nerves for inexperienced players
          dotMult *= 1.2;
      } else if (experience > 80) {
          boundaryMult *= 1.1; // Big match players thrive
          wicketMult *= 0.9;
      }
      
      // Increased pressure in death overs of a final
      if (phase === "death") {
          wicketMult *= 1.2;
          dotMult *= 1.1;
      }
  }

  // Phase adjustments
  if (phase === "powerplay") {
    boundaryMult *= 1.4;
    dotMult *= 0.8;
    wicketMult *= 1.1;
  } else if (phase === "middle") {
    boundaryMult *= 0.9;
    dotMult *= 0.9;
    wicketMult *= 0.8;
  } else if (phase === "death") {
    boundaryMult *= 2.2;
    dotMult *= 0.5;
    wicketMult *= 1.8;
  }

  // Batsman type impact
  if (batsmanType.includes("aggressive") || batsmanType.includes("hitter")) {
    boundaryMult *= (phase === "death" ? 1.5 : 1.3); // Finishers thrive in death
    wicketMult *= 1.2;
    dotMult *= 0.9;
  } else if (batsmanType.includes("anchor")) {
    boundaryMult *= 0.8;
    wicketMult *= (context.wicketsFallen >= 5 ? 0.4 : 0.6); // Anchors get more cautious if wickets fall
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
    
    // Collapse logic: if wickets are falling fast, momentum drops and pressure rises
    if (context.wicketsFallen >= 5 && rrr > 12) {
        wicketMult *= 1.4;
    }
  }

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
  const { oversLimit = 20, wicketsLimit = 10, delayMs = 100, rng, chaseTarget = null, battingTeamName, bowlingTeamName, venue, abortSignal, onBall, isFinal = false } = options;
  
  console.log(`[MATCH:${matchId}] Starting Inning ${inningNumber}. Target: ${isNaN(chaseTarget) || chaseTarget === null ? "N/A" : chaseTarget}`);
  const target = isNaN(chaseTarget) || chaseTarget === null ? Infinity : chaseTarget;
  
  let runs = 0, wickets = 0, ballsBowled = 0, legalBallsInOver = 0, currentOver = 0;
  let momentum = 0; // Tracks match momentum (-100 to 100)
  let strikerIdx = 0, nonStrikerIdx = 1, nextBatsmanIdx = 2;
  
  const scorecard = { batting: {}, bowling: {}, extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0 } };
  const bowlerStats = {}; // Tracks overs, runs, wickets per bowler
  const recentBalls = [];
  
  // Initialize scorecard with all players (DNB)
  batting.forEach((p, i) => {
    scorecard.batting[p.id || p.name] = { name: p.name, runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, status: "DNB", pos: i };
  });
  scorecard.batting[batting[0].id || batting[0].name].status = "not out";
  scorecard.batting[batting[1].id || batting[1].name].status = "not out";

  let lastBowlerId = null;

  while (currentOver < oversLimit && wickets < wicketsLimit && (chaseTarget === null || runs < chaseTarget)) {
    // Select bowler for the over
    const possibleBowlers = bowling.filter(p => {
        const id = p.id || p.name;
        const stats = bowlerStats[id] || { overs: 0 };
        return id !== lastBowlerId && stats.overs < 4;
    });
    // Fallback if no legal bowler found (shouldn't happen in 11-man squad)
    const bowler = possibleBowlers[0] || bowling[Math.floor(rng.next() * bowling.length)];
    const bowlerId = bowler.id || bowler.name;
    lastBowlerId = bowlerId;

    if (!bowlerStats[bowlerId]) {
        bowlerStats[bowlerId] = { name: bowler.name, balls: 0, runs: 0, wickets: 0, overs: "0", economy: 0 };
    }

    legalBallsInOver = 0;
    let runsThisOver = 0;
    let currentBatsman = null;
    let currentBowler = bowler;

    while (legalBallsInOver < 6 && wickets < wicketsLimit && (runs < target)) {
      if (abortSignal?.aborted) return;

      currentBatsman = batting[strikerIdx];
      const context = {
        currentOver, currentBallInOver: legalBallsInOver, totalOvers: oversLimit, 
        wicketsFallen: wickets, isChasing: chaseTarget !== null, target: chaseTarget, 
        currentScore: runs, momentum, isFinal, rng
      };

      const result = simulateBall(currentBatsman, currentBowler, context);
      let ballRuns = 0;
      let isLegal = true;

      // Update Momentum
      if (result === "4" || result === "6") momentum = Math.min(100, momentum + 15);
      else if (result === "W") momentum = Math.max(-100, momentum - 25);
      else if (result === "dot") momentum = Math.max(-100, momentum - 2);
      else momentum = Math.min(100, momentum + 2);

      if (result === "WD") {
        runs += 1;
        scorecard.extras.wides += 1;
        bowlerStats[bowlerId].runs += 1;
        runsThisOver += 1;
        isLegal = false;
      } else if (result === "NB") {
        runs += 1;
        scorecard.extras.noBalls += 1;
        bowlerStats[bowlerId].runs += 1;
        runsThisOver += 1;
        isLegal = false;
      } else if (result === "W") {
        wickets += 1;
        scorecard.batting[currentBatsman.id || currentBatsman.name].status = "out";
        scorecard.batting[currentBatsman.id || currentBatsman.name].balls += 1;
        bowlerStats[bowlerId].balls += 1;
        bowlerStats[bowlerId].wickets += 1;
        
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
        
        const batStat = scorecard.batting[currentBatsman.id || currentBatsman.name];
        batStat.runs += ballRuns;
        batStat.balls += 1;
        if (ballRuns === 4) batStat.fours += 1;
        if (ballRuns === 6) batStat.sixes += 1;
        batStat.strikeRate = Number(((batStat.runs / batStat.balls) * 100).toFixed(1));

        // Strike rotation
        if (ballRuns % 2 !== 0) {
            [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
        }
      }

      if (isLegal) {
          legalBallsInOver++;
          ballsBowled++;
      }

      // Track recent balls for UI
      recentBalls.push(result);
      if (recentBalls.length > 12) recentBalls.shift();

      // Update Firebase
      const ballKey = `${currentOver}_${legalBallsInOver}`;
      const updates = {};
      updates[`matches/${matchId}/snapshot`] = {
        inning: inningNumber, runs, wickets, overs: `${currentOver}.${legalBallsInOver}`,
        striker: batting[strikerIdx]?.name || "None",
        nonStriker: batting[nonStrikerIdx]?.name || "None",
        bowler: currentBowler.name,
        recentBalls,
        target: chaseTarget,
        result,
        momentum
      };
      updates[`matches/${matchId}/scorecard/${inningNumber}`] = {
          batting: Object.values(scorecard.batting).sort((a,b) => a.pos - b.pos),
          bowling: Object.values(bowlerStats),
          extras: scorecard.extras,
          total: { runs, wickets, overs: `${currentOver}.${legalBallsInOver}` }
      };
      
      // Commentary
      const commId = String(ballsBowled + (inningNumber - 1) * 120).padStart(3, "0");
      updates[`matches/${matchId}/commentary/${commId}`] = commentaryEngine.generate(matchId, {
          result, batsman: currentBatsman, bowler: currentBowler, battingTeam: battingTeamName, bowlingTeam: bowlingTeamName, venue,
          state: { 
            runs, wickets, over: currentOver, ball: legalBallsInOver, 
            target: chaseTarget, isChasing: chaseTarget !== null,
            totalOvers: oversLimit
          }
      });

      await db.ref().update(updates);
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
      
      if (result === "1" || result === "3") {
          [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
      }
    }

    // Over end
    currentOver++;
    bowlerStats[bowlerId].overs = Math.floor(bowlerStats[bowlerId].balls / 6);
    bowlerStats[bowlerId].economy = Number((bowlerStats[bowlerId].runs / (bowlerStats[bowlerId].balls / 6)).toFixed(2));
    
    // Over summary commentary
    const overSummaryCommId = String(ballsBowled + (inningNumber - 1) * 120).padStart(3, "0") + "_over";
    const overSummary = {
        result: "dot", // dummy
        isOverEnd: true,
        batsman: currentBatsman,
        bowler: currentBowler,
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
    if (wickets < wicketsLimit && strikerIdx !== -1 && runs < (chaseTarget || Infinity)) {
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
  await db.ref(`matches/${matchId}/commentary/${endCommId}`).set(
      inningNumber >= 3 ? `**SUPER OVER END!**` :
      inningNumber === 2 ? `**MATCH OVER!** ${battingTeamName} finished at ${runs}/${wickets} in ${currentOver}.${legalBallsInOver} overs.` :
      `**INNINGS OVER!** ${battingTeamName} set a target of ${runs + 1} runs.`
  );

  return finalSummary;
}

async function simulateSuperOver(matchId, battingTeam, bowlingTeam, options = {}) {
    console.log(`[SUPER OVER] ${options.battingTeamName} is batting.`);
    return simulateInnings(matchId, options.inningNum, battingTeam, bowlingTeam, {
        ...options,
        oversLimit: 1,
        wicketsLimit: 2 // Only 2 wickets allowed in Super Over
    });
}

async function startMatch(matchId, teamA, teamB, options = {}) {
  const { teamAName = "Team A", teamBName = "Team B", oversLimit = 20, delayMs = 100, venue = "International Stadium", isFinal = false, isKnockout = false } = options;
  const rng = createSeededRandom(matchId);

  const initData = {
    matchId, teamA: teamAName, teamB: teamBName, status: "running",
    oversLimit, venue, startedAt: Date.now(), isFinal, isKnockout
  };
  await db.ref(`matches/${matchId}/meta`).set(initData);
  await db.ref(`matches/list/${matchId}`).set(initData);

  // Innings 1: Team A bats
  const firstInnings = await simulateInnings(matchId, 1, teamA, teamB, {
      oversLimit, delayMs, rng, battingTeamName: teamAName, bowlingTeamName: teamBName, venue, isFinal
  });

  // Innings 2: Team B bats
  const secondInnings = await simulateInnings(matchId, 2, teamB, teamA, {
      oversLimit, delayMs, rng, chaseTarget: firstInnings.runs + 1, battingTeamName: teamBName, bowlingTeamName: teamAName, venue, isFinal
  });

  // Calculate Result
  let winner = null, margin = "", isSuperOver = false;
  if (secondInnings.runs >= firstInnings.runs + 1) {
      winner = teamBName;
      const wicketsLeft = 10 - secondInnings.wickets;
      const ballsLeft = (oversLimit * 6) - secondInnings.ballsBowled;
      margin = `${wicketsLeft} wickets (with ${ballsLeft} balls remaining)`;
  } else if (secondInnings.runs === firstInnings.runs) {
      if (isKnockout) {
          let soInning = 3;
          while (winner === null) {
              const so1 = await simulateSuperOver(matchId, teamA.slice(0,3), teamB, { 
                  inningNum: soInning++, battingTeamName: teamAName, bowlingTeamName: teamBName, venue, rng, delayMs 
              });
              const so2 = await simulateSuperOver(matchId, teamB.slice(0,3), teamA, { 
                  inningNum: soInning++, battingTeamName: teamBName, bowlingTeamName: teamAName, venue, rng, delayMs, chaseTarget: so1.runs + 1 
              });
              
              if (so2.runs > so1.runs) {
                  winner = teamBName;
                  margin = "Super Over";
              } else if (so1.runs > so2.runs) {
                  winner = teamAName;
                  margin = "Super Over";
              }
              // If still tied, loop continues for another Super Over
          }
      } else {
          winner = "Tie";
          margin = "Scores level";
      }
  } else {
      winner = teamAName;
      margin = `${firstInnings.runs - secondInnings.runs} runs`;
  }

  const result = { winner, margin, summary: `${winner} won by ${margin}`, isFinal, isSuperOver };
  await db.ref(`matches/${matchId}/result`).set(result);
  await db.ref(`matches/${matchId}/status`).set("completed");
  await db.ref(`matches/list/${matchId}`).update({ status: "completed", resultSummary: result.summary });

  return { matchId, result, firstInnings, secondInnings };
}

module.exports = { startMatch };

