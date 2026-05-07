/**
 * DataLoader: Format-Aware Player & Team Data Loader Service
 */
const fs = require('fs');
const path = require('path');
const formatManager = require('./formatManager');

/**
 * Loads and normalizes a player profile based on the requested format
 */
function loadPlayerProfile(rawPlayer, format) {
  // If the player already has format-specific profiles, use them
  if (rawPlayer.profiles && rawPlayer.profiles[format.toLowerCase()]) {
    return {
      ...rawPlayer,
      ...rawPlayer.profiles[format.toLowerCase()],
      activeFormat: format
    };
  }

  // FALLBACK LOGIC: Use base data and apply format-based modifiers
  const modifiers = formatManager.getFormatModifiers(format);
  
  return {
    ...rawPlayer,
    batting: {
      ...rawPlayer.batting,
      aggression: {
        ...rawPlayer.batting.aggression,
        // Scale T20 aggression down for ODI/Test if using fallback
        powerplay: rawPlayer.batting.aggression.powerplay * modifiers.baseAggression,
        middle: rawPlayer.batting.aggression.middle * modifiers.baseAggression,
        death: rawPlayer.batting.aggression.death * modifiers.baseAggression
      }
    },
    bowling: {
      ...rawPlayer.bowling,
      wicketTaking: rawPlayer.bowling.wicketTaking * modifiers.wicketRisk
    },
    activeFormat: format,
    isFallback: true
  };
}

/**
 * Normalizes a team squad for a specific format
 */
function loadTeamSquad(teamEntry, format) {
  if (!teamEntry || !teamEntry.players) return null;

  return {
    ...teamEntry,
    players: teamEntry.players.map(p => loadPlayerProfile(p, format))
  };
}

module.exports = { loadPlayerProfile, loadTeamSquad };
