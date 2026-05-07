const styles = require("./styles");
const clientScript = require("./client");

function serializeForInlineScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
function buildHtmlPage({ teamOptions, matchTypes }) {
  const menTeams = teamOptions.filter(t => t.gender === 'men');
  const teamOptionsHtmlA = menTeams.map((team, index) => `<option value="${team.name}"${index === 0 ? " selected" : ""}>${team.name}</option>`).join("\n");
  const teamOptionsHtmlB = menTeams.map((team, index) => `<option value="${team.name}"${index === 1 ? " selected" : ""}>${team.name}</option>`).join("\n");
  const matchTypeHtml = matchTypes.map(type => `<option value="${type.key}">${type.label}</option>`).join("\n");
  const teamData = serializeForInlineScript(teamOptions);
  const typeData = serializeForInlineScript(matchTypes);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Cricket Match Scheduler</title>
  <style>
${styles}
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-content">
        <h1>Live Cricket Match Scheduler</h1>
        <p>Professional match management and live monitoring dashboard</p>
      </div>
      <div class="status-badge idle" id="server-status">
        <span class="loading">Loading</span>
      </div>
    </header>

    <main class="dashboard">
      <div class="primary-column">
        <div class="card highlight">
          <h2 class="card-title">Create a New Match</h2>
          <p class="card-description">Select the match format, choose both teams, and schedule the game instantly or later. The dashboard will keep all active and completed matches clearly organized.</p>
          <form id="matchForm">
            <div class="form-grid">
              <div class="form-group">
                <label for="matchType">Match Type</label>
                <select id="matchType" name="matchType" class="form-control">${matchTypeHtml}</select>
              </div>

              <div class="form-group">
                <label for="overs">Overs</label>
                <input type="number" id="overs" name="overs" class="form-control" value="20" min="1" required />
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="genderToggle">Gender</label>
                  <select id="genderToggle" class="form-control">
                    <option value="men" selected>Men</option>
                    <option value="women">Women</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="teamA">Team A</label>
                  <select id="teamA" name="teamA" class="form-control">${teamOptionsHtmlA}</select>
                </div>
                <div class="form-group">
                  <label for="teamB">Team B</label>
                  <select id="teamB" name="teamB" class="form-control">${teamOptionsHtmlB}</select>
                </div>
              </div>

              <div class="form-group">
                <label for="delayMs">Ball Delay (ms)</label>
                <input type="number" id="delayMs" name="delayMs" class="form-control" value="5000" min="0" required />
              </div>

              <div class="form-group">
                <label for="startAt">Start Time (Optional)</label>
                <input type="datetime-local" id="startAt" name="startAt" class="form-control" />
              </div>
            </div>

            <button type="submit" id="submitButton" class="btn btn-primary btn-full">Schedule Match</button>
            <p class="note">Select exactly 11 players for each side. Leave start time empty to begin immediately.</p>
          </form>
        </div>

        <div class="card">
          <h2 class="card-title">Playing XIs & Batting Order</h2>
          <div class="lineups">
            <div class="lineup">
              <div class="lineup-header">
                <h3 id="lineupAName">Team A</h3>
                <span id="lineupACount" class="selection-count">0/11 selected</span>
              </div>
              <button type="button" id="saveLineupA" class="btn btn-secondary btn-sm" style="margin-bottom: 1rem; width: 100%;">Save as Default XI</button>
              <h4 style="margin: 0.5rem 0; font-size: 0.95rem; color: var(--gray-600);">Playing XI (Batting Order)</h4>
              <ul id="playingA" class="playing-list" style="margin-bottom: 1rem; min-height: 50px;"></ul>
              <h4 style="margin: 0.5rem 0; font-size: 0.95rem; color: var(--gray-600);">Bench / Squad</h4>
              <input type="text" id="searchA" class="form-control" placeholder="Search squad..." style="margin-bottom: 0.75rem;" />
              <ul id="lineupA" class="squad-list"></ul>
            </div>
            <div class="lineup">
              <div class="lineup-header">
                <h3 id="lineupBName">Team B</h3>
                <span id="lineupBCount" class="selection-count">0/11 selected</span>
              </div>
              <button type="button" id="saveLineupB" class="btn btn-secondary btn-sm" style="margin-bottom: 1rem; width: 100%;">Save as Default XI</button>
              <h4 style="margin: 0.5rem 0; font-size: 0.95rem; color: var(--gray-600);">Playing XI (Batting Order)</h4>
              <ul id="playingB" class="playing-list" style="margin-bottom: 1rem; min-height: 50px;"></ul>
              <h4 style="margin: 0.5rem 0; font-size: 0.95rem; color: var(--gray-600);">Bench / Squad</h4>
              <input type="text" id="searchB" class="form-control" placeholder="Search squad..." style="margin-bottom: 0.75rem;" />
              <ul id="lineupB" class="squad-list"></ul>
            </div>
          </div>
        </div>
      </div>

      <div class="secondary-column">
        <div class="card small-card">
          <h2 class="card-title">Dashboard Snapshot</h2>
          <div id="summaryGrid" class="summary-grid">
            <div class="summary-stat">
              <span class="summary-label">Live Matches</span>
              <strong class="summary-value">-</strong>
            </div>
            <div class="summary-stat">
              <span class="summary-label">Scheduled</span>
              <strong class="summary-value">-</strong>
            </div>
            <div class="summary-stat">
              <span class="summary-label">Completed</span>
              <strong class="summary-value">-</strong>
            </div>
            <div class="summary-stat">
              <span class="summary-label">Saved XIs</span>
              <strong class="summary-value">-</strong>
            </div>
          </div>
          <p id="summaryNote" class="note">Loading dashboard summary...</p>
        </div>

        <div class="card small-card">
          <h2 class="card-title">Active Matches</h2>
          <div id="activeMatchList" class="active-match-list">
            <p class="note">No active matches right now.</p>
          </div>
          <div id="currentMatchPanel" class="match-info">
            <p class="note">No active match in progress</p>
          </div>
          <div class="control-buttons">
            <button id="pauseButton" class="btn btn-secondary" disabled>Pause</button>
            <button id="resumeButton" class="btn btn-secondary" disabled>Resume</button>
            <button id="abortButton" class="btn btn-danger" disabled>Abort</button>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">Upcoming Matches</h2>
          <div id="scheduledList" class="match-card-list">Loading scheduled matches...</div>
        </div>

        <div class="card">
          <h2 class="card-title">Recent Match History</h2>
          <div id="completedMatchesList" class="match-card-list">Loading completed matches...</div>
        </div>

        <div class="card">
          <h2 class="card-title">Live Activity Feed</h2>
          <div class="control-buttons">
            <button id="clearLogsButton" class="btn btn-secondary">Clear Logs</button>
          </div>
          <div id="liveLog" class="log-container"></div>
        </div>
      </div>
    </main>
  </div>

  <script>
    window.__APP_DATA__ = {
      teamData: ${teamData},
      matchTypes: ${typeData}
    };
  </script>
  <script>
${clientScript}
  </script>
</body>
</html>`;
}


module.exports = { buildHtmlPage };

