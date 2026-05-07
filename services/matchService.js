/**
 * MatchService: Orchestrates match initialization and player resolution
 * Breaks circular dependency between index.js and tournamentengine.js
 */
const { startMatch } = require('../matchEngine');
const dataLoader = require('./dataLoader');

function buildMatchPlayer(player, format = "T20") {
  return dataLoader.loadPlayerProfile(player, format);
}

function resolvePlayingXI(teamEntry, selectedIds, format = "T20") {
  if (!teamEntry) return null;

  const squad = Array.isArray(teamEntry.players) ? teamEntry.players : [];
  if (squad.length < 11) {
    throw new Error(`${teamEntry.name} does not have enough players.`);
  }

  const fallbackIds = squad.slice(0, 11).map(player => String(player.id));
  const requestedIds = Array.isArray(selectedIds) && selectedIds.length === 11
    ? selectedIds.map(id => String(id))
    : fallbackIds;

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

