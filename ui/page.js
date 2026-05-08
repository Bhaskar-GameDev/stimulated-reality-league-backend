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
  <title>SRL | Professional Cricket Dashboard</title>
  <style>
${styles}
  </style>
</head>
<body>
  <div class="container">
    <header class="header">
      <div class="header-content">
        <h1>Simulated Reality League</h1>
        <p>Professional cricket simulation dashboard & tournament engine</p>
      </div>
      <div id="summaryGrid" class="summary-grid">
        <!-- Stats injected via JS -->
      </div>
      <div class="status-badge idle" id="server-status">
        <span class="loading">Connecting</span>
      </div>
    </header>
    <div id="summaryNote" class="note" style="margin-bottom: 1.5rem; text-align: center; opacity: 0.8;">
      Initializing system...
    </div>

    <nav class="nav-tabs" style="display: flex; gap: 1rem; margin-bottom: 2rem; padding: 0.65rem; background: rgba(255,255,255,0.05); border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); box-shadow: var(--shadow-lg);">
      <button class="btn tab-btn active" data-tab="matches" style="flex: 1; border-radius: 10px; font-size: 0.9rem;">Match Management</button>
      <button class="btn tab-btn" data-tab="tournaments" style="flex: 1; border-radius: 10px; font-size: 0.9rem; background: transparent; box-shadow: none;">Tournament Engine</button>
      <button class="btn tab-btn" data-tab="maintenance" style="flex: 1; border-radius: 10px; font-size: 0.9rem; background: transparent; box-shadow: none;">Maintenance</button>
    </nav>

    <main class="dashboard" id="matchSection">
      <div class="primary-column">
        <div class="card highlight">
          <h2 class="card-title">Create a New Match</h2>
          <p class="card-description">Select format, teams, and schedule instantly. Manage player lineups and batting orders below.</p>
          <form id="matchForm">
            <div class="form-grid">
              <div class="form-row">
                <div class="form-group">
                  <label for="matchType">Match Type</label>
                  <select id="matchType" name="matchType" class="form-control">${matchTypeHtml}</select>
                </div>
                <div class="form-group">
                  <label for="overs">Overs</label>
                  <input type="number" id="overs" name="overs" class="form-control" value="20" min="1" required />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="genderToggle">Gender</label>
                  <select id="genderToggle" class="form-control">
                    <option value="men" selected>Men</option>
                    <option value="women">Women</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="delayMs">Ball Delay (ms)</label>
                  <input type="number" id="delayMs" name="delayMs" class="form-control" value="5000" min="0" required />
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
                <label for="startAt">Start Time (Optional)</label>
                <input type="datetime-local" id="startAt" name="startAt" class="form-control" />
              </div>
            </div>

            <button type="submit" id="submitButton" class="btn btn-primary btn-full">Schedule Match</button>
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
              <button type="button" id="saveLineupA" class="btn btn-secondary btn-sm" style="margin-bottom: 1rem; width: 100%; font-size: 0.8rem;">Save Default XI</button>
              <h4 style="margin: 0.5rem 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-500);">Batting Order</h4>
              <ul id="playingA" class="playing-list" style="margin-bottom: 1.5rem; min-height: 50px;"></ul>
              <h4 style="margin: 0.5rem 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-500);">Squad Selection</h4>
              <input type="text" id="searchA" class="form-control" placeholder="Search..." style="margin-bottom: 0.75rem; padding: 0.6rem;" />
              <ul id="lineupA" class="squad-list"></ul>
            </div>
            <div class="lineup">
              <div class="lineup-header">
                <h3 id="lineupBName">Team B</h3>
                <span id="lineupBCount" class="selection-count">0/11 selected</span>
              </div>
              <button type="button" id="saveLineupB" class="btn btn-secondary btn-sm" style="margin-bottom: 1rem; width: 100%; font-size: 0.8rem;">Save Default XI</button>
              <h4 style="margin: 0.5rem 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-500);">Batting Order</h4>
              <ul id="playingB" class="playing-list" style="margin-bottom: 1.5rem; min-height: 50px;"></ul>
              <h4 style="margin: 0.5rem 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-500);">Squad Selection</h4>
              <input type="text" id="searchB" class="form-control" placeholder="Search..." style="margin-bottom: 0.75rem; padding: 0.6rem;" />
              <ul id="lineupB" class="squad-list"></ul>
            </div>
          </div>
        </div>
      </div>

      <div class="secondary-column">
        <div class="card small-card">
          <h2 class="card-title">Live Match Activity</h2>
          <div id="activeMatchList" class="active-match-list">
            <p class="note">No active matches.</p>
          </div>
          <div id="currentMatchPanel" class="match-info">
            <p class="note">Select a match to monitor</p>
          </div>
          <div class="control-buttons">
            <button id="pauseButton" class="btn btn-secondary" disabled>Pause</button>
            <button id="resumeButton" class="btn btn-secondary" disabled>Resume</button>
            <button id="abortButton" class="btn btn-danger" disabled>Abort</button>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">Upcoming Schedule</h2>
          <div id="scheduledList" class="match-card-list">Loading...</div>
        </div>

        <div class="card">
          <h2 class="card-title">Recent History</h2>
          <div id="completedMatchesList" class="match-card-list">Loading...</div>
        </div>

        <div class="card">
          <h2 class="card-title">System Logs</h2>
          <button id="clearLogsButton" class="btn btn-secondary btn-sm" style="margin-bottom: 1rem;">Clear</button>
          <div id="liveLog" class="log-container" style="height: 250px;"></div>
        </div>
      </div>
    </main>

    <main class="dashboard" id="tournamentSection" style="display: none;">
      <div class="primary-column">
        <div class="card highlight">
          <h2 class="card-title">Automated Tournament Engine</h2>
          <p class="card-description">Create full season simulations. The engine handles all fixtures, standings, and automated stage transitions.</p>
          
          <form id="tournamentForm">
            <div class="form-grid">
              <div class="form-group">
                <label for="tournamentTemplate">Tournament Template</label>
                <select id="tournamentTemplate" class="form-control">
                  <option value="IPL">Indian Premier League (IPL Style)</option>
                  <option value="WORLD_CUP">ICC T20 World Cup</option>
                  <option value="BBL">Big Bash League</option>
                  <option value="CHAMPIONS_TROPHY">ICC Champions Trophy</option>
                </select>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="tournamentSeason">Season Year</label>
                  <input type="number" id="tournamentSeason" class="form-control" value="2026" />
                </div>
                <div class="form-group">
                  <label for="tournamentNameInput">Custom Name (Optional)</label>
                  <input type="text" id="tournamentNameInput" class="form-control" placeholder="e.g. My Private League" />
                </div>
              </div>

              <div class="form-group">
                <label>Participating Teams</label>
                <div id="tournamentTeamList" class="team-selection-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.65rem; max-height: 300px; overflow-y: auto; padding: 1rem; background: var(--gray-100); border-radius: 12px; border: 1px solid var(--gray-200);">
                  <!-- Teams injected via JS -->
                </div>
                <p id="teamCountLabel" class="note" style="font-weight: 700; color: var(--primary);">0 teams selected</p>
              </div>
            </div>

            <button type="button" id="generateTournamentBtn" class="btn btn-primary btn-full" style="margin-top: 1rem;">Generate Season Fixtures</button>
          </form>
        </div>

        <div id="tournamentFixturesCard" class="card" style="display: none; margin-top: 2rem;">
          <h2 class="card-title">Season Fixtures</h2>
          <p class="card-description">Review and edit the generated schedule before committing to the database.</p>
          <div id="fixturesList" class="match-card-list" style="max-height: 500px; overflow-y: auto; padding-right: 0.5rem; border: 1px solid var(--gray-200); border-radius: 12px; padding: 1rem; background: var(--gray-50);"></div>
          <button id="saveTournamentBtn" class="btn btn-success btn-full" style="margin-top: 1.5rem; background: var(--success); color: white;">Finalize & Schedule Tournament</button>
        </div>
      </div>

      <div class="secondary-column">
        <div class="card small-card">
          <h2 class="card-title">Tournament Standings</h2>
          <div id="standingsContainer" class="standings-view">
            <p class="note">Select a tournament to view points table.</p>
          </div>
        </div>

        <div class="card">
          <h2 class="card-title">Recent Tournaments</h2>
          <div id="activeTournamentList" class="match-card-list">
            <p class="note">No tournaments found.</p>
          </div>
        </div>
      </div>
    </main>

    <main class="dashboard" id="maintenanceSection" style="display: none;">
      <div class="primary-column">
        <div class="card highlight">
          <h2 class="card-title">Database Cleanup & Maintenance</h2>
          <p class="card-description">Choose the data nodes and date range you wish to clear from Firebase. This action cannot be undone.</p>
          
          <div class="form-group" style="margin-top: 2rem;">
            <label style="font-weight: 700; color: var(--gray-800);">Select Data to Clear</label>
            <div style="display: flex; gap: 2rem; margin-top: 0.5rem; padding: 1rem; background: rgba(0,0,0,0.03); border-radius: 12px; border: 1px solid rgba(0,0,0,0.05);">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" id="cleanupMatches" checked /> Matches
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" id="cleanupTournaments" checked /> Tournaments
              </label>
            </div>
          </div>

          <div class="form-row" style="margin-top: 1.5rem;">
            <div class="form-group">
              <label for="cleanupRange">Filter by Date</label>
              <select id="cleanupRange" class="form-control">
                <option value="today">Created Today</option>
                <option value="yesterday">Created Yesterday</option>
                <option value="custom">Custom Date Range</option>
                <option value="all">All Time (Careful!)</option>
              </select>
            </div>
          </div>

          <div id="customDateRange" class="form-row" style="display: none; margin-top: 1rem;">
            <div class="form-group">
              <label for="cleanupStart">Start Date</label>
              <input type="date" id="cleanupStart" class="form-control" />
            </div>
            <div class="form-group">
              <label for="cleanupEnd">End Date</label>
              <input type="date" id="cleanupEnd" class="form-control" />
            </div>
          </div>

          <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid rgba(0,0,0,0.05);">
            <button id="executeCleanup" class="btn btn-primary btn-full" style="background: linear-gradient(135deg, #e53935 0%, #b71c1c 100%);">
              Execute Cleanup
            </button>
          </div>
        </div>
      </div>
      <div class="secondary-column">
        <div class="card">
          <h2 class="card-title">Cleanup Logs</h2>
          <div id="cleanupLogs" class="log-container" style="height: 400px; background: #1a1a1a; color: #4caf50; font-family: monospace; font-size: 0.85rem; padding: 1rem; border-radius: 12px; overflow-y: auto;">
            <div class="note" style="color: #888;">Cleanup activity will be logged here...</div>
          </div>
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
