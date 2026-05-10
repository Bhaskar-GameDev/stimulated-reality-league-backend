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
            const expectedRR = targetScore / context.totalOvers;
            const ballsDone = (context.currentOver * 6) + context.currentBallInOver;
            const currentRR = ballsDone > 0 ? (context.currentScore / (ballsDone / 6)) : expectedRR;
            
            const deviation = expectedRR - currentRR;
            if (deviation > 1) { // Scoring too slowly
                boundaryMult *= 1.5;
                singleMult *= 1.3;
                dotMult *= 0.6;
            } else if (deviation < -1) { // Scoring too fast
                dotMult *= 1.5;
                wicketMult *= 1.4;
                boundaryMult *= 0.6;
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
                    
                    if (rrr > 8) {
                        boundaryMult *= 1.6;
                        dotMult *= 0.6;
                    }
                    wicketMult *= 0.5;
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
                    wicketMult *= 1.4;
                    dotMult *= 1.3;
                    boundaryMult *= 0.7;
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
                            wicketMult *= 1.8;
                            dotMult *= 1.5;
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
                    dotMult *= 1.5;
                    wicketMult *= 1.4;
                    boundaryMult *= 0.5;
                    break;
                case "high-scoring":
                case "high scoring":
                    boundaryMult *= 1.6;
                    dotMult *= 0.5;
                    wicketMult *= 0.6;
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
