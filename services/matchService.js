/**
 * MatchService: Orchestrates match initialization and player resolution
 * Breaks circular dependency between index.js and tournamentengine.js
 */
const { startMatch } = require('../matchEngine');
const dataLoader = require('./dataLoader');

function buildMatchPlayer(player, format = "T20") {
  return dataLoader.loadPlayerProfile(player, format);
}

const ROLE_PRIORITY = {
  "batsman": 1,
  "wicket-keeper": 2,
  "wicketkeeper": 2,
  "allrounder": 3,
  "all-rounder": 3,
  "bowler": 4
};

function resolvePlayingXI(teamEntry, selectedIds, format = "T20") {
  if (!teamEntry) return null;

  const squad = Array.isArray(teamEntry.players) ? teamEntry.players : [];
  if (squad.length < 11) {
    throw new Error(`${teamEntry.name} does not have enough players.`);
  }

  let requestedIds = [];
  if (Array.isArray(selectedIds) && selectedIds.length === 11) {
    requestedIds = selectedIds.map(id => String(id));
  } else {
    // Default: Sort by role to ensure batsmen are at the top
    const sortedSquad = [...squad].sort((a, b) => {
      const pA = ROLE_PRIORITY[(a.role || "").toLowerCase()] || 99;
      const pB = ROLE_PRIORITY[(b.role || "").toLowerCase()] || 99;
      return pA - pB;
    });
    requestedIds = sortedSquad.slice(0, 11).map(player => String(player.id));
  }

  const squadById = new Map(squad.map(p => [String(p.id), p]));
  
  return requestedIds.map(id => {
    const player = squadById.get(id) || squad[0];
    return buildMatchPlayer(player, format);
  });
}

module.exports = {
  startMatch,
  buildMatchPlayer,
  resolvePlayingXI,
  archiveMatchData: require('../matchEngine').archiveMatchData
};

