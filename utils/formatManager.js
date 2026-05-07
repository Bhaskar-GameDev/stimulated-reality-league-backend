/**
 * FormatManager: Defines behavior models for different cricket formats
 */

const FORMAT_CONFIGS = {
  T20: {
    baseAggression: 1.0,
    wicketRisk: 1.0,
    strikeRotation: 1.0,
    powerplayOvers: 6,
    deathOversStart: 16,
    pacingCurve: [1.2, 0.9, 1.5], // [Powerplay, Middle, Death] multipliers
    description: "High aggression, high risk, boundary-focused."
  },
  ODI: {
    baseAggression: 0.75,
    wicketRisk: 0.7,
    strikeRotation: 1.2,
    powerplayOvers: 10,
    deathOversStart: 41,
    pacingCurve: [0.9, 0.7, 1.3], // [Powerplay, Middle, Death] multipliers
    description: "Innings building, strike rotation, late acceleration."
  },
  TEST: {
    baseAggression: 0.4,
    wicketRisk: 0.3,
    strikeRotation: 0.6,
    powerplayOvers: 0,
    deathOversStart: 999, // No death overs in Test
    pacingCurve: [0.5, 0.5, 0.5],
    description: "Patience, defensive skill, long-term survival."
  }
};

/**
 * Category Modifiers: Adjusts pacing based on competition level
 * Note: teams.json is currently T20 International data, so it is the baseline.
 */
const CATEGORY_CONFIGS = {
  international: {
    aggressionMultiplier: 1.0,
    pressureImpact: 1.2,
    description: "High pressure, tactical, standard pacing."
  },
  franchise: {
    aggressionMultiplier: 1.15, // Franchise cricket is generally higher scoring
    pressureImpact: 0.9,
    description: "High aggression, fan-driven, flatter pitches."
  }
};

/**
 * Returns the behavior modifiers for a specific format
 */
function getFormatModifiers(format) {
  return FORMAT_CONFIGS[format] || FORMAT_CONFIGS.T20;
}

/**
 * Returns the behavior modifiers for a specific category
 */
function getCategoryModifiers(category) {
  return CATEGORY_CONFIGS[category] || CATEGORY_CONFIGS.international;
}

/**
 * Calculates a dynamic multiplier for a player's probability based on format, category, and phase
 */
function getPhaseMultiplier(format, currentOver, category = "international") {
  const formatConfig = getFormatModifiers(format);
  const categoryConfig = getCategoryModifiers(category);
  
  let baseMultiplier = formatConfig.pacingCurve[1]; // Middle overs default
  if (currentOver <= formatConfig.powerplayOvers) baseMultiplier = formatConfig.pacingCurve[0];
  if (currentOver >= formatConfig.deathOversStart) baseMultiplier = formatConfig.pacingCurve[2];
  
  return baseMultiplier * categoryConfig.aggressionMultiplier;
}

module.exports = { getFormatModifiers, getCategoryModifiers, getPhaseMultiplier, FORMAT_CONFIGS, CATEGORY_CONFIGS };

