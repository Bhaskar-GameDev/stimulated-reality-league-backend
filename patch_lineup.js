const fs = require('fs');

let index = fs.readFileSync('index.js', 'utf8');
const replacement = fs.readFileSync('new_lineup_logic.js', 'utf8');

// Find the start marker: "    let savedLineups = {};" or "    function getTeamPlayers"
// We need to replace from "let savedLineups" all the way to the closing of "bindLineupEvents"
// Identify bounds precisely
const startMarker = '    let savedLineups = {};';
const endMarker   = '    }'; // we'll find the right one by locating "function bindLineupEvents" block end

// Strategy: find line numbers manually
const lines = index.split('\n');

let startLine = -1;
let endLine   = -1;
let inBind    = false;
let braceDepth = 0;

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (startLine === -1 && (l.includes('let savedLineups = {}') || l.includes('function getTeamPlayers'))) {
    startLine = i;
  }
  if (startLine !== -1 && l.includes('function bindLineupEvents')) {
    inBind = true;
  }
  if (inBind) {
    for (const ch of l) {
      if (ch === '{') braceDepth++;
      if (ch === '}') braceDepth--;
    }
    if (braceDepth === 0) {
      endLine = i;
      break;
    }
  }
}

if (startLine === -1 || endLine === -1) {
  console.error('Could not find replacement bounds. startLine=' + startLine + ' endLine=' + endLine);
  process.exit(1);
}

console.log('Replacing lines', startLine, 'to', endLine);

lines.splice(startLine, endLine - startLine + 1, ...replacement.split('\n'));
fs.writeFileSync('index.js', lines.join('\n'));
console.log('Done.');
