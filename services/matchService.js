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
  let requestedIds = [];
  
  // 1. Priority: Explicitly selected 11 IDs
  if (Array.isArray(selectedIds) && selectedIds.length === 11) {
    requestedIds = selectedIds.map(id => String(id));
  } 
  // 2. Priority: Saved lineup from lineupService
  else {
    const saved = lineupService.getLineup(teamEntry.name);
    if (Array.isArray(saved) && saved.length === 11) {
      requestedIds = saved.map(id => String(id));
    } 
    // 3. Fallback: Role-based default selection
    else {
      const sortedSquad = [...squad].sort((a, b) => {
        const pA = ROLE_PRIORITY[(a.role || "").toLowerCase()] || 99;
        const pB = ROLE_PRIORITY[(b.role || "").toLowerCase()] || 99;
        return pA - pB;
      });
      requestedIds = sortedSquad.slice(0, 11).map(player => String(player.id));
    }
  }

  // Resolve players and filter out invalid ones
  let finalXI = [];
  const seenIds = new Set();
  
  for (const id of requestedIds) {
    const player = squadById.get(id);
    if (player && !seenIds.has(String(player.id))) {
      finalXI.push(player);
      seenIds.add(String(player.id));
    }
  }

  // If we don't have 11 (e.g. invalid IDs or duplicates in saved lineup), fill from squad
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

