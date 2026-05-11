const COMMENTARY_POOL = {
    "6": [
        { text: "**SIX!** {batsman} lofts it high and handsome! That's gone all the way into the stands. *ROAR FROM THE CROWD!*", weight: 10 },
        { text: "**MASSIVE!** {batsman} has absolutely demolished that one. The stadium is erupting! ", intensity: "high", weight: 15 },
        { text: "That is out of the ground! {batsman} showing pure power here. {bowler} can only watch it fly.", weight: 10 },
        { text: "Clean as a whistle! {batsman} picks the length early and deposits it over the ropes.", weight: 10 },
        { text: "**CRACKED!** That's a monstrous hit from {batsman}. Into the second tier! ", weight: 12 },
        { text: "Incredible shot! {batsman} just stands and delivers. Straight as an arrow for six!", weight: 10 },
        { text: "Welcome to the attack! {batsman} greets {bowler} with a maximum. ", context: "first_ball_of_over", weight: 12 },
        { text: "That is huge! {batsman} is taking {bowlingTeam} to the cleaners now.", weight: 8 },
        { text: "**CLASSIC {batsman}!** He's found his range and that's a towering maximum. ", phase: "death", weight: 15 },
        { text: "The finisher in action! {batsman} clears his front leg and sends it into orbit.", playerType: "finisher", weight: 20 }
    ],
    "4": [
        { text: "**FOUR!** Exquisite timing from {batsman}. Pierces the gap perfectly. ", weight: 10 },
        { text: "Boundary! {batsman} uses the pace of {bowler} and guides it through the covers.", weight: 10 },
        { text: "That's a bullet! One bounce and into the fence. Superb shot from {batsman}.", weight: 10 },
        { text: "Short and punished! {batsman} pulls it away with authority.", phase: "death", weight: 12 },
        { text: "Classy. {batsman} just leans into the drive and it races away to the boundary.", weight: 10 },
        { text: "**CRUNCHED!** No chance for the fielder at point. {batsman} is in some touch today.", weight: 10 },
        { text: "Edged... and it's gone for four! Not where he intended, but {batsman} won't mind.", weight: 5 },
        { text: "Glorious shot. {batsman} finds the gap between mid-off and extra cover. Pure elegance.", weight: 8 },
        { text: "Textbook! {batsman} plays the perfect cover drive. That belongs in a coaching manual.", playerType: "anchor", weight: 15 }
    ],
    "W": [
        { text: "**OUT!** {bowler} gets the breakthrough! {batsman} has to walk back. ", weight: 10 },
        { text: "**GOTTEM!** A huge moment in the match. {bowler} is ecstatic! ", intensity: "high", weight: 15 },
        { text: "**WICKET!** Clean bowled! {bowler} produces a seed and the stumps are a mess.", wicketType: "bowled", weight: 12 },
        { text: "In the air... and **TAKEN!** A safe pair of hands in the deep. {batsman} is gone.", wicketType: "caught", weight: 12 },
        { text: "That's a massive blow for {battingTeam}! The set batsman {batsman} departs.", context: "set_batsman_out", weight: 15 },
        { text: "**HUGE APPEAL... and the finger goes up!** {batsman} is trapped in front. Stone dead!", wicketType: "lbw", weight: 12 },
        { text: "Stunned silence in the stadium. {batsman} is gone for a duck!", context: "duck", weight: 20 },
        { text: "A spectacular catch! {bowler} can't believe it, the fielder has pulled a blinder to remove {batsman}.", weight: 8 },
        { text: "Bowling excellence. {bowler} has set the trap and {batsman} fell right into it.", weight: 10 },
        { text: "The strike bowler strikes! {bowler} justifying his reputation with that wicket.", playerType: "strike_bowler", weight: 15 }
    ],
    "dot": [
        { text: "Good length from {bowler}, {batsman} defends it solidly.", weight: 10 },
        { text: "Beaten! {bowler} finds some movement and whistles past the edge.", weight: 8 },
        { text: "Dot ball. Pressure building on {batsman} here.", intensity: "high", weight: 12 },
        { text: "Nicely bowled. {bowler} keeping it tight in this over.", weight: 10 },
        { text: "Swing and a miss! {batsman} tries to go big but misses the line completely.", weight: 8 },
        { text: "Excellent accuracy. {bowler} is hitting the corridor of uncertainty consistently.", playerType: "workhorse", weight: 15 },
        { text: "They're building patiently. Respecting the good deliveries here.", format: "ODI", phase: "middle", weight: 12 },
        { text: "Required rate climbing. {batsman} needs to find the gaps soon.", format: "ODI", intensity: "high", weight: 10 }
    ],
    "1": [
        { text: "Just a single. {batsman} tucks it to the leg side.", weight: 10 },
        { text: "Tapped away for one. Rotating the strike is key here.", weight: 10 },
        { text: "Good running. They scramble for a quick single.", weight: 8 },
        { text: "Played with soft hands. {batsman} takes a comfortable single.", weight: 10 },
        { text: "Sensible cricket. Taking the single and keeping the scoreboard ticking.", format: "ODI", phase: "middle", weight: 15 }
    ],
    "2": [
        { text: "Two more added to the total. Good hustle between the wickets.", weight: 10 },
        { text: "Pushed into the gap, and they come back for the second. Excellent running.", weight: 10 },
        { text: "Deep into the pocket, they challenge the arm and win. Two runs for {batsman}.", weight: 8 },
        { text: "Brilliant placement, and even better running. Converting ones into twos is crucial here.", format: "ODI", phase: "middle", weight: 12 }
    ],
    "over_summary": [
        { text: "End of the over. {battingTeam} are {score}. {runs_in_over} runs from it.", weight: 10 },
        { text: "That's a tidy over from {bowler}. Just {runs_in_over} off it.", weight: 8 },
        { text: "Expensive over! {battingTeam} shifting gears here. {score} at the end of over {over}.", intensity: "high", weight: 10 },
        { text: "A momentum-shifting over. {battingTeam} looking strong at {score}.", intensity: "high", weight: 12 },
        { text: "Important partnership developing here. {battingTeam} laying a solid foundation.", format: "ODI", phase: "middle", weight: 15 },
        { text: "Time to accelerate now! The platform is set for {battingTeam}.", format: "ODI", phase: "death", weight: 15 },
        { text: "Brilliant death-over execution from {bowlingTeam}. Giving nothing away.", format: "ODI", phase: "death", weight: 12 }
    ],
    "milestone_50": [
        { text: "**RAISE THE BAT!** A brilliant half-century for {batsman}. He's been the backbone of this innings.", weight: 10 },
        { text: "50 for {batsman}! A controlled and clinical performance so far. The crowd shows their appreciation.", weight: 10 },
        { text: "**HALF-CENTURY!** {batsman} reaches the milestone in style. He looks set for a big one.", weight: 10 }
    ],
    "milestone_100": [
        { text: "**CENTURY!** Take a bow, {batsman}! A magnificent hundred. One of the finest innings we've seen.", weight: 10 },
        { text: "**UNSTOPPABLE!** {batsman} reaches triple figures. What a moment for him and {battingTeam}!", weight: 10 }
    ],
    "close_finish": [
        { text: "**CRUNCH TIME!** {battingTeam} need {runs_needed} from {balls_left} balls. Who will blink first?", weight: 10 },
        { text: "Nail-biting stuff here at {venue}! {runs_needed} required off {balls_left}. Every ball is an event!", weight: 10 }
    ],
    "consecutive_boundaries": [
        { text: "**BACK TO BACK!** {batsman} is in the zone now. {bowler} is under serious pressure.", weight: 10 },
        { text: "Another one! {batsman} is finding the gaps with ease. This is masterclass batting.", weight: 10 }
    ],
    "international_milestone": [
        { text: "What an incredible career milestone for {batsman}! He's writing history today on the international stage.", weight: 10 },
        { text: "The whole stadium is on its feet for {batsman}! A massive international career achievement.", weight: 10 }
    ],
    "series_context": [
        { text: "This is crucial for the series context! Every run counts right now for {battingTeam}.", weight: 10 },
        { text: "With the series on the line, the pressure is immense on {batsman}.", weight: 10 }
    ]
};

class CommentaryEngine {
    constructor() {
        this.history = new Map(); // matchId -> Array of recently used template texts
        this.matchState = new Map(); // matchId -> object tracking milestones, streaks etc.
        this.maxHistory = 30;
    }

    _getMatchState(matchId) {
        if (!this.matchState.has(matchId)) {
            this.matchState.set(matchId, {
                milestones: new Set(),
                lastResult: null,
                streak: 0,
                streakType: null,
                batsmanScores: {},
                partnerships: {}
            });
        }
        return this.matchState.get(matchId);
    }

    analyzeContext(state, mState) {
        if (!state) return { phase: "middle", intensity: "normal" };

        const { runs, wickets, over, ball, totalOvers, target, isChasing } = state;
        const totalBalls = (totalOvers || 20) * 6;
        const currentBalls = (over || 0) * 6 + (ball || 0);
        const ballsRemaining = totalBalls - currentBalls;

        let phase = "middle";
        const progress = currentBalls / totalBalls;
        if (progress < 0.3) phase = "powerplay";
        else if (progress > 0.8) phase = "death";

        let intensity = "normal";
        let isCloseFinish = false;

        if (isChasing && target) {
            const runsNeeded = target - runs;
            if (ballsRemaining > 0) {
                const rrr = (runsNeeded / (ballsRemaining / 6));
                const criticalRRR = (totalOvers === 50) ? 9 : 12;
                if (rrr > criticalRRR || (ballsRemaining < 18 && runsNeeded < 25)) {
                    intensity = "high";
                    if (ballsRemaining < 12) isCloseFinish = true;
                }
            }
        } else if (wickets > 7 || (progress > 0.8 && runs > 160)) {
            intensity = "high";
        }

        const isODI = totalOvers === 50;
        return { phase, intensity, isChasing, ballsRemaining, isCloseFinish, format: isODI ? "ODI" : "T20" };
    }

    generate(matchId, eventData) {
        const { result, batsman, bowler, battingTeam, bowlingTeam, state, venue, isOverEnd, runsInOver, wicketType } = eventData;
        const mState = this._getMatchState(matchId);
        const context = this.analyzeContext(state, mState);

        let templates = [];
        let category = "dot";
        let specificContext = null;

        // 1. Check for milestones
        if (batsman && !isOverEnd) {
            const bKey = batsman.id || batsman.name;
            const currentRuns = (mState.batsmanScores[bKey] || 0) + (parseInt(result) || 0);
            
            if (currentRuns >= 100 && !mState.milestones.has(`${bKey}_100`)) {
                category = "milestone_100";
                mState.milestones.add(`${bKey}_100`);
            } else if (currentRuns >= 50 && !mState.milestones.has(`${bKey}_50`)) {
                category = "milestone_50";
                mState.milestones.add(`${bKey}_50`);
            }
            
            mState.batsmanScores[bKey] = currentRuns;
        }

        // 2. Check for close finish
        if (category === "dot" && context.isCloseFinish && !isOverEnd) {
            if (Math.random() > 0.7) {
                category = "close_finish";
            }
        }

        // 3. Check for streaks (consecutive boundaries)
        if (category === "dot" && !isOverEnd) {
            if (result === "4" || result === "6") {
                if (mState.streakType === "boundary") {
                    mState.streak++;
                    if (mState.streak >= 2 && Math.random() > 0.5) category = "consecutive_boundaries";
                } else {
                    mState.streak = 1;
                    mState.streakType = "boundary";
                }
            } else {
                mState.streak = 0;
                mState.streakType = null;
            }
        }

        // 4. Default categories
        if (category === "dot") {
            if (isOverEnd) {
                category = "over_summary";
            } else {
                category = result === "W" ? "W" : (COMMENTARY_POOL[result] ? result : "dot");
            }
        }

        templates = COMMENTARY_POOL[category] || COMMENTARY_POOL["dot"];

        // Special context flags
        if (result === "W") {
            const bKey = batsman?.id || batsman?.name;
            if (mState.batsmanScores[bKey] === 0) {
                specificContext = "duck";
            }
        }
        if (state?.ball === 1) {
            specificContext = "first_ball_of_over";
        }

        // Filter by context
        const eligible = templates.filter(t => {
            if (t.phase && t.phase !== context.phase) return false;
            if (t.intensity && t.intensity !== context.intensity) return false;
            if (t.context && t.context !== specificContext) return false;
            if (t.wicketType && t.wicketType !== wicketType) return false;
            if (t.format && t.format !== context.format) return false;
            if (t.playerType && batsman?.type && !batsman.type.toLowerCase().includes(t.playerType)) return false;
            return true;
        });

        const pool = eligible.length > 0 ? eligible : templates;

        // Prevent repetition
        if (!this.history.has(matchId)) this.history.set(matchId, []);
        const matchHistory = this.history.get(matchId);
        const fresh = pool.filter(t => !matchHistory.includes(t.text));
        const finalSelectionPool = fresh.length > 0 ? fresh : pool;

        const totalWeight = finalSelectionPool.reduce((sum, t) => sum + (t.weight || 10), 0);
        let random = Math.random() * totalWeight;
        let selected = finalSelectionPool[0];

        for (const t of finalSelectionPool) {
            random -= (t.weight || 10);
            if (random <= 0) {
                selected = t;
                break;
            }
        }

        matchHistory.push(selected.text);
        if (matchHistory.length > this.maxHistory) matchHistory.shift();

        let text = selected.text;
        const runsNeeded = (state?.target || 0) - (state?.runs || 0);
        const ballsLeft = ((state?.totalOvers || 20) * 6) - (((state?.over || 0) * 6) + (state?.ball || 0));

        text = text.replace(/{batsman}/g, batsman?.name || "The batsman");
        text = text.replace(/{bowler}/g, bowler?.name || "The bowler");
        text = text.replace(/{battingTeam}/g, battingTeam || "batting team");
        text = text.replace(/{bowlingTeam}/g, bowlingTeam || "bowling team");
        text = text.replace(/{score}/g, `${state?.runs || 0}/${state?.wickets || 0}`);
        text = text.replace(/{over}/g, state?.over !== undefined ? state.over + 1 : "");
        text = text.replace(/{runs_in_over}/g, runsInOver || 0);
        text = text.replace(/{venue}/g, venue || "the stadium");
        text = text.replace(/{runs_needed}/g, runsNeeded);
        text = text.replace(/{balls_left}/g, ballsLeft);

        return text;
    }
}

module.exports = new CommentaryEngine();
