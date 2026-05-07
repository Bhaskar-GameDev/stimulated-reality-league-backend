const COMMENTARY_POOL = {
    "6": [
        { text: "SIX! {batsman} lofts it high and handsome! That's gone all the way into the stands. *ROAR FROM THE CROWD!*", phase: "powerplay", weight: 10 },
        { text: "MASSIVE! {batsman} has absolutely demolished that one. The stadium is erupting! ", intensity: "high", weight: 15 },
        { text: "That is out of the ground! {batsman} showing pure power here. {bowler} can only watch it fly.", weight: 10 },
        { text: "Clean as a whistle! {batsman} picks the length early and deposits it over the ropes.", weight: 10 },
        { text: "CRACKED! That's a monstrous hit from {batsman}. Into the second tier! ", playerType: "aggressive", weight: 12 },
        { text: "Incredible shot! {batsman} just stands and delivers. Straight as an arrow for six!", weight: 10 },
        { text: "ONE HANDED! {batsman} loses his balance but still manages to clear the fence. Freaky power!", weight: 5 },
        { text: "The noise that made! {batsman} has connected perfectly and it's disappeared over the mid-wicket boundary.", weight: 10 },
        { text: "Welcome to the attack! {batsman} greets {bowler} with a maximum. ", momentum: "batting_dominance", weight: 12 },
        { text: "That is huge! {batsman} is taking {bowlingTeam} to the cleaners now.", weight: 8 },
        { text: "Classic {batsman}! He's found his range and that's a towering maximum. ", playerType: "finisher", phase: "death", weight: 15 }
    ],
    "4": [
        { text: "FOUR! Exquisite timing from {batsman}. Pierces the gap perfectly. ", weight: 10 },
        { text: "Boundary! {batsman} uses the pace of {bowler} and guides it through the covers.", weight: 10 },
        { text: "That's a bullet! One bounce and into the fence. Superb shot from {batsman}.", weight: 10 },
        { text: "Short and punished! {batsman} pulls it away with authority.", phase: "death", weight: 12 },
        { text: "Classy. {batsman} just leans into the drive and it races away to the boundary.", weight: 10 },
        { text: "CRUNCHED! No chance for the fielder at point. {batsman} is in some touch today.", weight: 10 },
        { text: "Edged... and it's gone for four! Not where he intended, but {batsman} won't mind.", weight: 5 },
        { text: "Glorious shot. {batsman} finds the gap between mid-off and extra cover. Pure elegance.", weight: 8 },
        { text: "{batsman} is just toy-ing with the field now. Another boundary to the collection.", playerType: "anchor", weight: 10 }
    ],
    "W": [
        { text: "OUT! {bowler} gets the breakthrough! {batsman} has to walk back. ", weight: 10 },
        { text: "GOTTEM! A huge moment in the match. {bowler} is ecstatic! ", intensity: "high", weight: 15 },
        { text: "WICKET! Clean bowled! {bowler} produces a seed and the stumps are a mess.", wicketType: "bowled", weight: 12 },
        { text: "In the air... and TAKEN! A safe pair of hands in the deep. {batsman} is gone.", wicketType: "caught", weight: 12 },
        { text: "That's a massive blow for {battingTeam}! The set batsman {batsman} departs.", context: "set_batsman_out", weight: 15 },
        { text: "HUGE APPEAL... and the finger goes up! {batsman} is trapped in front. Stone dead!", wicketType: "lbw", weight: 12 },
        { text: "Stunned silence in the stadium. {batsman} is gone for a duck!", runs: 0, weight: 10 },
        { text: "A spectacular catch! {bowler} can't believe it, the fielder has pulled a blinder to remove {batsman}.", weight: 8 },
        { text: "Bowling excellence. {bowler} has set the trap and {batsman} fell right into it.", weight: 10 },
        { text: "The strike bowler delivers! {bowler} comes back and strikes immediately.", playerType: "strike_bowler", weight: 15 },
        { text: "Perfectly executed yorker! {bowler} finishes off {batsman} in style.", playerType: "death_specialist", phase: "death", weight: 15 }
    ],
    "dot": [
        { text: "Good length from {bowler}, {batsman} defends it solidly.", weight: 10 },
        { text: "Beaten! {bowler} finds some movement and whistles past the edge.", weight: 8 },
        { text: "Dot ball. Pressure building on {batsman} here.", intensity: "high", weight: 12 },
        { text: "Nicely bowled. {bowler} keeping it tight in this over.", weight: 10 },
        { text: "Swing and a miss! {batsman} tries to go big but misses the line completely.", weight: 8 },
        { text: "Quick and accurate. {bowler} is giving nothing away to {batsman} right now.", weight: 10 },
        { text: "Solid defense. {batsman} is taking his time to settle in.", phase: "middle", weight: 10 },
        { text: "Another dot. {bowler} is strangling the run flow here.", playerType: "death_specialist", weight: 12 }
    ],
    "1": [
        { text: "Just a single. {batsman} tucks it to the leg side.", weight: 10 },
        { text: "Tapped away for one. Rotating the strike is key here.", weight: 10 },
        { text: "Good running. They scramble for a quick single.", weight: 8 },
        { text: "Played with soft hands. {batsman} takes a comfortable single.", weight: 10 },
        { text: "Dabbed to third man for a single. Intelligent cricket from {batsman}.", weight: 10 },
        { text: "{batsman} keeps the scoreboard ticking. Just what the anchor does best.", playerType: "anchor", weight: 12 }
    ],
    "2": [
        { text: "Two more added to the total. Good hustle between the wickets.", weight: 10 },
        { text: "Pushed into the gap, and they come back for the second. Excellent running.", weight: 10 },
        { text: "Deep into the pocket, they challenge the arm and win. Two runs for {batsman}.", weight: 8 }
    ],
    "over_summary": [
        { text: "End of the over. {battingTeam} are {score}. {runs_in_over} runs from it.", weight: 10 },
        { text: "That's a tidy over from {bowler}. Just {runs_in_over} off it.", weight: 8 },
        { text: "Expensive over! {battingTeam} shifting gears here. {score} at the end of over {over}.", weight: 10 },
        { text: "A momentum-shifting over. {battingTeam} looking strong at {score}.", intensity: "high", weight: 12 }
    ]
};

class CommentaryEngine {
    constructor() {
        this.history = new Map(); // matchId -> Array of recently used template texts
        this.maxHistory = 20;
    }

    analyzeContext(state) {
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
        if (isChasing && target) {
            const rrr = ballsRemaining > 0 ? ((target - runs) / (ballsRemaining / 6)) : 0;
            if (rrr > 10 || (ballsRemaining < 24 && Math.abs(target - runs) < 30)) {
                intensity = "high";
            }
        } else if (wickets > 7 || (progress > 0.8 && runs > 160)) {
            intensity = "high";
        }

        return { phase, intensity, isChasing, ballsRemaining };
    }

    generate(matchId, eventData) {
        const { result, batsman, bowler, battingTeam, bowlingTeam, state, wicketType, isOverEnd, runsInOver } = eventData;
        const context = this.analyzeContext(state);

        let templates;
        if (isOverEnd) {
            templates = COMMENTARY_POOL["over_summary"];
        } else {
            templates = COMMENTARY_POOL[result] || COMMENTARY_POOL["dot"];
        }

        const eligible = templates.filter(t => {
            if (t.phase && t.phase !== context.phase) return false;
            if (t.intensity && t.intensity !== context.intensity) return false;
            if (t.wicketType && t.wicketType !== wicketType) return false;
            if (t.playerType && batsman?.type && !batsman.type.toLowerCase().includes(t.playerType)) return false;
            return true;
        });

        const pool = eligible.length > 0 ? eligible : templates;

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
        text = text.replace(/{batsman}/g, batsman?.name || "The batsman");
        text = text.replace(/{bowler}/g, bowler?.name || "The bowler");
        text = text.replace(/{battingTeam}/g, battingTeam || "batting team");
        text = text.replace(/{bowlingTeam}/g, bowlingTeam || "bowling team");
        text = text.replace(/{score}/g, `${state?.runs || 0}/${state?.wickets || 0}`);
        text = text.replace(/{over}/g, state?.over !== undefined ? state.over + 1 : "");
        text = text.replace(/{runs_in_over}/g, runsInOver || 0);

        return text;
    }
}

module.exports = new CommentaryEngine();
