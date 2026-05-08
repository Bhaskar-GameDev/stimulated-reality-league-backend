/**
 * MatchService: Orchestrates match initialization and player resolution
 * Breaks circular dependency between index.js and tournamentengine.js
 */
const { startMatch } = require('../matchEngine');
const dataLoader = require('./dataLoader');
const lineupService = require('./lineupService');

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

  const squadById = new Map(squad.map(p => [String(p.id), p]));
  const squadBySlug = new Map(squad.map(p => [String(p.id).split('_').pop(), p])); // Fallback to name slug
  
  let requestedIds = [];
  
  const saved = lineupService.getLineup(teamEntry.name);
  if (Array.isArray(saved) && saved.length === 11) {
    requestedIds = saved.map(id => String(id));
  } else {
    const sortedSquad = [...squad].sort((a, b) => {
      const pA = ROLE_PRIORITY[(a.role || "").toLowerCase()] || 99;
      const pB = ROLE_PRIORITY[(b.role || "").toLowerCase()] || 99;
      return pA - pB;
    });
    requestedIds = sortedSquad.slice(0, 11).map(player => String(player.id));
  }

  let finalXI = [];
  const seenIds = new Set();
  
  for (const id of requestedIds) {
    // Try direct ID match
    let player = squadById.get(id);
    
    // Fallback: Try matching by the name part of the ID (last segment)
    if (!player) {
        const slug = id.split('_').pop();
        player = squadBySlug.get(slug);
    }

    if (player && !seenIds.has(String(player.id))) {
      finalXI.push(player);
      seenIds.add(String(player.id));
    }
  }

  // If still under 11, fill with best available
  if (finalXI.length < 11) {
    const sortedSquad = [...squad].sort((a, b) => {
      const pA = ROLE_PRIORITY[(a.role || "").toLowerCase()] || 99;
      const pB = ROLE_PRIORITY[(b.role || "").toLowerCase()] || 99;
      return pA - pB;
    });
    
    for (const player of sortedSquad) {
      if (!seenIds.has(String(player.id))) {
        finalXI.push(player);
        seenIds.add(String(player.id));
        if (finalXI.length === 11) break;
      }
    }
  }

  return finalXI.slice(0, 11).map(player => buildMatchPlayer(player, format));
}

function summarizePlayingXI(players) {
  return players.map(player => ({
    id: player.id,
    name: player.name,
    role: player.role,
    type: player.type
  }));
}

module.exports = {
  startMatch,
  buildMatchPlayer,
  resolvePlayingXI,
  summarizePlayingXI,
  archiveMatchData: require('../matchEngine').archiveMatchData
};

