const seedrandom = require("seedrandom");

function createSeededRandom(seed) {
    const rng = seedrandom(seed);

    return {
        next() {
            return rng();
        }
    };
}

module.exports = {
    createSeededRandom
};