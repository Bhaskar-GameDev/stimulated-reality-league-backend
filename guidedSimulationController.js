class GuidedSimulationSettings {
    constructor(data = {}) {
        this.enabled = !!data.enabled;
        this.preferredWinner = data.preferredWinner || null;
        this.targetScore = Number(data.targetScore) || null;
        this.intensity = Number(data.intensity) || 0;
        this.narrativeType = data.narrativeType || "random";
    }
}

class SteeringModifierCalculator {
    static lerp(start, end, amt) {
        return (1 - amt) * start + amt * end;
    }

    static calculate(context) {
        const settings = context.guidedSimulationSettings;
        if (!settings || !settings.enabled) return null;

        const intensity = settings.intensity;
        if (intensity <= 0) return null;

        const { preferredWinner, targetScore, narrativeType } = settings;

        let boundaryMult = 1.0;
        let dotMult = 1.0;
        let wicketMult = 1.0;
        let singleMult = 1.0;

        // TARGET SCORE STEERING
        if (targetScore && !context.isChasing) {
            const ballsDone = (context.currentOver * 6) + context.currentBallInOver;
            const ballsLeft = (context.totalOvers * 6) - ballsDone;
            
            if (ballsLeft > 0) {
                const runsNeeded = Math.max(0, targetScore - context.currentScore);
                const reqRR = (runsNeeded / ballsLeft) * 6;
                const baseRR = targetScore / context.totalOvers;
                
                const urgency = reqRR - baseRR;

                // Protect against early collapse if target is high
                if (runsNeeded > ballsLeft * 0.8 && context.wicketsFallen >= 3) {
                    wicketMult *= 0.1;
                }

                if (urgency > 2.0) { // Falling way behind
                    boundaryMult *= 2.5;
                    singleMult *= 1.5;
                    dotMult *= 0.2;
                    wicketMult *= 0.15;
                } else if (urgency > 0.5) { // Falling behind
                    boundaryMult *= 1.5;
                    singleMult *= 1.2;
                    dotMult *= 0.5;
                    wicketMult *= 0.3;
                } else if (urgency < -2.0) { // Scoring way too fast
                    dotMult *= 2.5;
                    wicketMult *= 2.5;
                    boundaryMult *= 0.2;
                } else if (urgency < -0.5) { // Scoring fast
                    dotMult *= 1.5;
                    wicketMult *= 1.5;
                    boundaryMult *= 0.6;
                }
                
                // Final over exact target forcing
                if (ballsLeft <= 12 && Math.abs(runsNeeded) <= 15) {
                    if (runsNeeded <= 2) {
                        dotMult *= 3.0;
                        wicketMult *= 2.0;
                        boundaryMult *= 0.01;
                    } else if (runsNeeded > ballsLeft) {
                        boundaryMult *= 3.0;
                        wicketMult *= 0.05;
                    }
                }
            }
        }

        // WINNER STEERING
        if (preferredWinner) {
            const isBattingPreferred = context.battingTeamName === preferredWinner;
            const isChasing = context.isChasing;
            
            if (isBattingPreferred) {
                if (isChasing) {
                    const ballsRemaining = (context.totalOvers * 6) - ((context.currentOver * 6) + context.currentBallInOver);
                    const runsRemaining = Math.max(0, context.target - context.currentScore);
                    const rrr = ballsRemaining > 0 ? (runsRemaining / ballsRemaining) * 6 : 0;
                    
                    if (rrr > 10) {
                        boundaryMult *= 2.0;
                        dotMult *= 0.3;
                        wicketMult *= 0.1;
                    } else if (rrr > 7) {
                        boundaryMult *= 1.4;
                        dotMult *= 0.6;
                        wicketMult *= 0.3;
                    }
                    wicketMult *= 0.4; // Base protection for preferred chaser
                } else {
                    boundaryMult *= 1.3;
                    wicketMult *= 0.7;
                }
            } else {
                if (isChasing) {
                    wicketMult *= 1.6;
                    dotMult *= 1.5;
                    boundaryMult *= 0.5;
                } else {
                    // Only penalize the first innings if there is NO specific target score we are trying to reach
                    if (!targetScore) {
                        wicketMult *= 1.4;
                        dotMult *= 1.3;
                        boundaryMult *= 0.7;
                    }
                }
            }
        }

        // MATCH NARRATIVE TYPES
        if (narrativeType) {
            switch(narrativeType.toLowerCase()) {
                case "thriller":
                    if (context.isChasing) {
                        const ballsRemaining = (context.totalOvers * 6) - ((context.currentOver * 6) + context.currentBallInOver);
                        if (ballsRemaining <= 18) {
                            boundaryMult *= 1.5;
                            wicketMult *= 1.5;
                        } else {
                            dotMult *= 1.2;
                            wicketMult *= 0.8;
                        }
                    }
                    break;
                case "one-sided":
                    if (preferredWinner) {
                        if (context.battingTeamName === preferredWinner) {
                            boundaryMult *= 1.6;
                            wicketMult *= 0.4;
                        } else {
                            if (!targetScore || context.isChasing) {
                                wicketMult *= 1.8;
                                dotMult *= 1.5;
                            }
                        }
                    }
                    break;
                case "comeback":
                    if (context.wicketsFallen >= 3 && context.currentOver < (context.totalOvers / 2)) {
                        wicketMult *= 0.3;
                        singleMult *= 1.5;
                        boundaryMult *= 1.2;
                    }
                    break;
                case "low-scoring":
                case "low scoring":
                    if (!targetScore || context.isChasing) {
                        dotMult *= 1.5;
                        wicketMult *= 1.4;
                        boundaryMult *= 0.5;
                    }
                    break;
                case "high-scoring":
                case "high scoring":
                    if (!targetScore || context.isChasing) {
                        boundaryMult *= 1.6;
                        dotMult *= 0.5;
                        wicketMult *= 0.6;
                    }
                    break;
                case "last-over-finish":
                case "last over finish":
                    if (context.isChasing) {
                        const ballsRemaining = (context.totalOvers * 6) - ((context.currentOver * 6) + context.currentBallInOver);
                        const runsRemaining = Math.max(0, context.target - context.currentScore);
                        if (ballsRemaining > 6 && runsRemaining <= 10) {
                            dotMult *= 2.0;
                            boundaryMult *= 0.2;
                        } else if (ballsRemaining <= 6 && runsRemaining > 0) {
                            boundaryMult *= 2.0;
                        }
                    }
                    break;
            }
        }

        return {
            boundaryMult: this.lerp(1, boundaryMult, intensity),
            dotMult: this.lerp(1, dotMult, intensity),
            wicketMult: this.lerp(1, wicketMult, intensity),
            singleMult: this.lerp(1, singleMult, intensity)
        };
    }
}

class GuidedSimulationController {
    static applySteering(probs, context) {
        if (!context.guidedSimulationSettings || !context.guidedSimulationSettings.enabled) {
            return probs;
        }

        const settings = new GuidedSimulationSettings(context.guidedSimulationSettings);
        context.guidedSimulationSettings = settings;

        const modifiers = SteeringModifierCalculator.calculate(context);
        if (!modifiers) return probs;

        let newProbs = { ...probs };
        newProbs["4"] *= modifiers.boundaryMult;
        newProbs["6"] *= modifiers.boundaryMult;
        newProbs["dot"] *= modifiers.dotMult;
        newProbs["wicket"] *= modifiers.wicketMult;
        newProbs["1"] *= modifiers.singleMult;
        newProbs["2"] *= modifiers.singleMult;
        newProbs["3"] *= modifiers.singleMult;

        const total = Object.values(newProbs).reduce((a, b) => a + b, 0);
        if (total > 0) {
            Object.keys(newProbs).forEach(k => newProbs[k] /= total);
        }
        
        return newProbs;
    }
}

module.exports = GuidedSimulationController;
