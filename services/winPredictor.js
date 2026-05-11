class WinPredictor {
    static calculateBaseProbability(context) {
        const { runs, wickets, over, ball, target, oversLimit, matchType } = context;
        const isODI = oversLimit === 50 || matchType === "ODI";
        
        if (target === null) {
            // 1st Innings: Heuristic based on projected score
            const totalBalls = oversLimit * 6;
            const ballsDone = (over * 6) + ball;
            const baseProjected = isODI ? 270 : 160;
            const projected = ballsDone > 0 ? (runs / ballsDone) * totalBalls : baseProjected;
            let prob = 50 + (projected - baseProjected) / (isODI ? 4 : 2.5);
            prob -= (wickets * (isODI ? 4 : 3)); 
            return prob;
        } else {
            // 2nd Innings: Based on RRR and Wickets
            const totalBalls = oversLimit * 6;
            const ballsDone = (over * 6) + ball;
            const ballsLeft = Math.max(1, totalBalls - ballsDone);
            const runsLeft = target - runs;
            
            if (runsLeft <= 0) return 100;
            
            const rrr = (runsLeft / ballsLeft) * 6;
            const wicketsLeft = 10 - wickets;
            
            const rrrFactor = isODI ? 5 : 8;
            const wktFactor = isODI ? 5 : 4;
            
            let prob = 100 - (rrr * rrrFactor) + (wicketsLeft * wktFactor) - (isODI ? 10 : 20);
            return prob;
        }
    }

    static applyBatterContext(prob, context) {
        if (!context.striker) return prob;
        
        const getSkill = (batter) => {
            if (!batter) return 50;
            const base = batter.battingSkill || 50;
            const death = batter.deathBatting || 50;
            const pressure = batter.pressureHandling || 50;
            const boundary = (batter.boundaryRate || 0.15) * 200; // normalize to ~50
            const rotation = (batter.strikeRotation || 0.5) * 100; // normalize to ~50
            
            return (base * 0.4) + (death * 0.2) + (pressure * 0.2) + (boundary * 0.1) + (rotation * 0.1);
        };
        
        const strikerSkill = getSkill(context.striker);
        const nonStrikerSkill = getSkill(context.nonStriker);
        
        const combinedSkill = (strikerSkill * 0.6) + (nonStrikerSkill * 0.4);
        const skillDiff = combinedSkill - 50;
        
        let impactMultiplier = 0.15; // base impact
        
        if (context.target !== null) { // Chasing
            const ballsLeft = context.oversLimit * 6 - (context.over * 6 + context.ball);
            if (ballsLeft < 30) impactMultiplier = 0.3; // Death overs, batter skill matters more
            
            const runsLeft = context.target - context.runs;
            const rrr = ballsLeft > 0 ? (runsLeft / ballsLeft) * 6 : 0;
            if (rrr > 10) impactMultiplier += 0.1; // High pressure
        }
        
        return prob + (skillDiff * impactMultiplier);
    }

    static applyBowlerContext(prob, context) {
        if (!context.bowler) return prob;
        
        const getSkill = (bowler) => {
            const base = bowler.bowlingSkill || 50;
            const death = bowler.deathBowling || 50;
            const dot = (bowler.dotBallRate || 0.3) * 100;
            const threat = (bowler.wicketThreat || 0.05) * 500;
            const yorker = (bowler.yorkerAccuracy || 0.5) * 100;
            
            return (base * 0.3) + (death * 0.2) + (dot * 0.2) + (threat * 0.2) + (yorker * 0.1);
        };
        
        const bowlerSkill = getSkill(context.bowler);
        const skillDiff = bowlerSkill - 50;
        
        let impactMultiplier = 0.15;
        const ballsLeft = context.oversLimit * 6 - (context.over * 6 + context.ball);
        if (context.target !== null && ballsLeft < 30) impactMultiplier = 0.3; // Death overs
        
        return prob - (skillDiff * impactMultiplier);
    }

    static applyPhaseModifier(prob, context) {
        const isODI = context.oversLimit === 50 || context.matchType === "ODI";
        const over = context.over;
        
        const isDeath = isODI ? over >= 40 : over >= 15;
        const isPowerplay = isODI ? over < 10 : over < 6;

        if (context.target !== null) {
            const ballsLeft = context.oversLimit * 6 - (context.over * 6 + context.ball);
            const runsLeft = context.target - context.runs;
            if (ballsLeft <= 0 || runsLeft <= 0) return prob;
            
            const rrr = (runsLeft / ballsLeft) * 6;
            const reqRate = isODI ? 7 : 9;
            
            if (isDeath) {
                if (rrr > reqRate) {
                    prob -= (rrr - reqRate) * 1.5; // Pressure multiplier increases heavily
                }
                prob -= context.wickets * 0.8; // Wickets become extremely valuable
            } else if (isPowerplay) {
                if (rrr > reqRate) {
                    prob += (rrr - reqRate) * 0.8; // Slightly aggressive expectation
                }
                prob += context.wickets * 0.5; // Wickets less damaging
            }
        }
        return prob;
    }

    static applyMomentumModifier(prob, context) {
        const recent = context.recentBalls || [];
        if (recent.length === 0) return prob;

        let dots = 0;
        let boundaries = 0;
        let wickets = 0;
        
        for (const ball of recent) {
            if (ball === "dot" || ball === "0") dots++;
            else if (ball === "4" || ball === "6") boundaries++;
            else if (ball === "W") wickets++;
        }
        
        let momentumScore = 0;
        momentumScore -= (wickets * 4); // Wickets in clusters heavily reduce momentum
        momentumScore += (boundaries * 1.5); // Consecutive boundaries increase momentum
        momentumScore -= (dots * 0.5); // Dot-ball pressure reduces probability
        
        // Smooth influence, cap between -10 and +10
        momentumScore = Math.max(-10, Math.min(10, momentumScore));
        
        return prob + momentumScore;
    }

    static applyPartnershipStability(prob, context) {
        const partnership = context.partnership;
        if (!partnership) return prob;
        
        const runs = partnership.runs || 0;
        const balls = partnership.balls || 0;
        
        let stabilityBonus = 0;
        
        if (runs > 30) stabilityBonus += 2;
        if (runs > 50) stabilityBonus += 3;
        if (runs > 100) stabilityBonus += 4;
        
        if (balls > 20) {
            const sr = (runs / balls) * 100;
            if (sr > 140) stabilityBonus += 2;
            if (sr < 80) stabilityBonus -= 2;
        }
        
        return prob + stabilityBonus;
    }

    static applyVenueModifier(prob, context) {
        const venue = context.venueProfile;
        if (!venue) return prob; // Optional venue profiles
        
        let modifier = 0;
        
        if (context.target !== null) {
            if (venue.averageFirstInnings) {
                if (context.target < venue.averageFirstInnings - 10) modifier += 3;
                else if (context.target > venue.averageFirstInnings + 15) modifier -= 3;
            }
            if (venue.dewFactor) {
                modifier += (venue.dewFactor - 1.0) * 15;
            }
            if (venue.spinFriendly && context.over > 6 && context.over < 15) {
                modifier -= 2;
            }
            if (venue.deathScoringBoost && context.over >= (context.oversLimit === 50 ? 40 : 15)) {
                modifier += (venue.deathScoringBoost - 1.0) * 10;
            }
        }
        
        return prob + modifier;
    }

    static applyPressureModifier(prob, context) {
        let pressureIndex = 0;
        
        if (context.target !== null) {
            const ballsLeft = context.oversLimit * 6 - (context.over * 6 + context.ball);
            const runsLeft = context.target - context.runs;
            if (ballsLeft > 0) {
                const rrr = (runsLeft / ballsLeft) * 6;
                if (rrr > 9) pressureIndex += 3;
                if (rrr > 12) pressureIndex += 4;
            }
        }
        
        pressureIndex += context.wickets * 1.2;
        
        // Ensure pressure affects probability smoothly
        const pressurePenalty = Math.min(15, pressureIndex * 0.5);
        return prob - pressurePenalty;
    }

    static finalizeProbability(prob, context) {
        // Prevent unrealistic jumps, maintain uncertainty and tension
        if (context.target === null) {
            return Math.max(15, Math.min(85, Math.round(prob)));
        } else {
            return Math.max(1, Math.min(99, Math.round(prob)));
        }
    }

    static calculate(context) {
        let prob = this.calculateBaseProbability(context);
        prob = this.applyBatterContext(prob, context);
        prob = this.applyBowlerContext(prob, context);
        prob = this.applyPhaseModifier(prob, context);
        prob = this.applyMomentumModifier(prob, context);
        prob = this.applyPartnershipStability(prob, context);
        prob = this.applyVenueModifier(prob, context);
        prob = this.applyPressureModifier(prob, context);
        return this.finalizeProbability(prob, context);
    }
}

module.exports = WinPredictor;
