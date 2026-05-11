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
    <div id="summaryNote" class="note" style="margin-bottom: 0.5rem; text-align: center; opacity: 0.8;">
      Initializing system...
    </div>

    <div id="worldStateBanner" style="margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; background: linear-gradient(90deg, rgba(30,64,175,0.2) 0%, rgba(30,64,175,0.05) 100%); border: 1px solid rgba(30,64,175,0.3); border-radius: 12px; padding: 0.75rem 1.5rem; font-size: 0.85rem; color: var(--gray-200);">
      <span style="font-weight: 800; color: #60a5fa; font-size: 1rem; text-transform: uppercase; letter-spacing: 1px;">Season 2027</span>
      <span style="display: flex; gap: 0.5rem; align-items: center;"><span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #10b981;"></span> Active Tours: <strong id="bannerActiveTours" style="color: white;">4</strong></span>
      <span style="display: flex; gap: 0.5rem; align-items: center;"><span style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%; display: inline-block; box-shadow: 0 0 8px #ef4444;"></span> Live Matches: <strong id="bannerLiveMatches" style="color: white;">2</strong></span>
      <span>ODI #1: <strong id="bannerOdiTop" style="color: white;">India</strong></span>
      <span>T20I #1: <strong id="bannerT20Top" style="color: white;">Australia</strong></span>
    </div>

    <nav class="nav-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 2rem; padding: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); box-shadow: var(--shadow-lg); overflow-x: auto;">
      <button class="btn tab-btn active" data-tab="matches" style="flex: 1; border-radius: 8px; font-size: 0.85rem; min-width: 120px;">Match Management</button>
      <button class="btn tab-btn" data-tab="tournaments" style="flex: 1; border-radius: 8px; font-size: 0.85rem; min-width: 120px; background: transparent; box-shadow: none;">Tournament Engine</button>
      <button class="btn tab-btn" data-tab="international" style="flex: 1; border-radius: 8px; font-size: 0.85rem; min-width: 120px; background: transparent; box-shadow: none;">International Cricket</button>
      <button class="btn tab-btn" data-tab="rankings" style="flex: 1; border-radius: 8px; font-size: 0.85rem; min-width: 130px; background: transparent; box-shadow: none;">Rankings & Careers</button>
      <button class="btn tab-btn" data-tab="world" style="flex: 1; border-radius: 8px; font-size: 0.85rem; min-width: 130px; background: transparent; box-shadow: none;">World Management</button>
      <button class="btn tab-btn" data-tab="maintenance" style="flex: 1; border-radius: 8px; font-size: 0.85rem; min-width: 100px; background: transparent; box-shadow: none;">Maintenance</button>
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

              <!-- GUIDED SIMULATION -->
              <div class="card" style="margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.02); border: 1px solid var(--gray-200);">
                <div class="form-group" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0;">
                  <input type="checkbox" id="guidedSimToggle" style="width: 18px; height: 18px; cursor: pointer;">
                  <label for="guidedSimToggle" style="font-weight: 700; cursor: pointer; margin: 0; color: var(--primary);">Enable Guided Match Simulation</label>
                </div>
                
                <div id="guidedSimOptions" style="display: none; margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--gray-300);">
                  <div class="form-row">
                    <div class="form-group">
                      <label for="preferredWinner">Preferred Winner</label>
                      <select id="preferredWinner" class="form-control">
                        <option value="">None (Random)</option>
                        <option value="teamA">Team A</option>
                        <option value="teamB">Team B</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="targetScore">Target 1st Innings Score</label>
                      <input type="number" id="targetScore" class="form-control" placeholder="e.g. 185" />
                    </div>
                  </div>
                  <div class="form-row">
                    <div class="form-group">
                      <label for="narrativeType">Match Narrative</label>
                      <select id="narrativeType" class="form-control">
                        <option value="random">Random</option>
                        <option value="thriller">Thriller</option>
                        <option value="one-sided">One-sided</option>
                        <option value="comeback">Comeback</option>
                        <option value="low-scoring">Low Scoring</option>
                        <option value="high-scoring">High Scoring</option>
                        <option value="last-over-finish">Last Over Finish</option>
                      </select>
                    </div>
                    <div class="form-group">
                      <label for="intensity">Intensity: <span id="intensityVal">0.5</span></label>
                      <input type="range" id="intensity" class="form-control" min="0" max="1" step="0.05" value="0.5" />
                      <small class="note" style="display: block; margin-top: 0.25rem;">0 = Random, 1 = Heavily Scripted</small>
                    </div>
                  </div>
                </div>
              </div>
              <!-- END GUIDED SIMULATION -->

              <div class="form-group" style="margin-top: 1rem;">
                <label for="startAt">Start Time (Optional)</label>
                <input type="datetime-local" id="startAt" name="startAt" class="form-control" />
              </div>
            </div>

            <button type="submit" id="submitButton" class="btn btn-primary btn-full">Schedule Match</button>
          </form>
        </div>

        <!-- Lineup management removed as per user request. Lineups are fetched automatically from Firebase. -->

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

              <div class="form-group" style="margin-top: 1rem; display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
                <input type="checkbox" id="autoSimTournament" style="width: 20px; height: 20px; cursor: pointer;">
                <label for="autoSimTournament" style="font-weight: 700; color: var(--primary); cursor: pointer; margin: 0;">Enable Automated Simulation (Run matches one after another)</label>
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

        <div class="card small-card">
          <h2 class="card-title">Tournament Leaders</h2>
          <div id="leadersContainer" class="leaders-view">
            <p class="note">Select a tournament to view Orange & Purple caps.</p>
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

    <!-- NEW: INTERNATIONAL CRICKET DASHBOARD -->
    <main class="dashboard" id="internationalSection" style="display: none;">
      <div class="primary-column">
        <div class="card highlight">
          <h2 class="card-title">International Tour Manager</h2>
          <p class="card-description">Create and schedule bilateral tours with multiple series formats.</p>
          <form id="tourForm">
            <div class="form-grid">
              <div class="form-row">
                <div class="form-group">
                  <label for="tourName">Tour Name</label>
                  <input type="text" id="tourName" class="form-control" placeholder="e.g. India Tour of Australia 2027" />
                </div>
                <div class="form-group">
                  <label for="tourSeason">Season Year</label>
                  <input type="number" id="tourSeason" class="form-control" value="2027" />
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="tourHost">Host Nation</label>
                  <select id="tourHost" class="form-control"><option>Australia</option><option>India</option><option>England</option></select>
                </div>
                <div class="form-group">
                  <label for="tourVisitor">Visiting Nation</label>
                  <select id="tourVisitor" class="form-control"><option>India</option><option>England</option><option>Australia</option></select>
                </div>
              </div>
              <div class="form-row" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.1);">
                <div class="form-group">
                  <label for="odiCount">ODI Series Matches</label>
                  <input type="number" id="odiCount" class="form-control" value="3" min="0" max="7" />
                </div>
                <div class="form-group">
                  <label for="t20Count">T20I Series Matches</label>
                  <input type="number" id="t20Count" class="form-control" value="5" min="0" max="7" />
                </div>
              </div>
              <div class="form-group" style="margin-top: 1rem; display: grid; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px;">
                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;"><input type="checkbox" checked /> Auto Generate Venues</label>
                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;"><input type="checkbox" checked /> Auto Generate Schedule & Rest Days</label>
                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer; color: var(--primary);"><input type="checkbox" id="autoSimTour" /> Enable Automated Simulation</label>
              </div>
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
              <button type="button" class="btn btn-secondary" style="flex: 1;">Save Draft</button>
              <button type="submit" class="btn btn-primary" style="flex: 2;">Generate Tour Fixtures</button>
            </div>
          </form>
        </div>
        
        <div class="card" style="margin-top: 1.5rem;">
          <h2 class="card-title">Live International Series</h2>
          <div id="liveSeriesContainer" class="match-card-list" style="display: grid; gap: 1rem;">
            <div class="match-card" style="background: linear-gradient(145deg, var(--gray-900) 0%, var(--dark) 100%);">
              <div style="width: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <h4 style="color: var(--primary-light);">ODI Series: AUS vs IND</h4>
                  <span class="pill running">LIVE</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span style="font-size: 1.2rem; font-weight: 700;">Australia lead 2-1</span>
                  <span style="color: var(--gray-400); font-size: 0.85rem;">Match 4 of 5</span>
                </div>
                <div style="margin-top: 1rem; padding-top: 0.5rem; border-top: 1px solid var(--gray-800); display: flex; justify-content: space-between; font-size: 0.8rem;">
                  <span>Player of Series Race: <strong>S. Smith (210 runs)</strong></span>
                  <span style="color: #f59e0b;">Momentum: AUS 🔥</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="secondary-column">
        <div class="card small-card">
          <h2 class="card-title">Active Tours</h2>
          <div id="activeToursList" class="match-card-list">
            <div class="match-card" style="border-left: 4px solid var(--primary);">
              <div>
                <h4 style="margin-bottom: 0.2rem;">India Tour of Australia</h4>
                <p style="color: var(--gray-400); font-size: 0.8rem;">ODI: AUS lead 2-1 | T20I: Upcoming</p>
              </div>
            </div>
            <div class="match-card" style="border-left: 4px solid var(--success);">
              <div>
                <h4 style="margin-bottom: 0.2rem;">England Tour of West Indies</h4>
                <p style="color: var(--gray-400); font-size: 0.8rem;">T20I Series Tied 1-1</p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="card">
          <h2 class="card-title">Global Calendar</h2>
          <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
            <button class="btn btn-sm btn-secondary">Timeline</button>
            <button class="btn btn-sm btn-secondary">Monthly</button>
          </div>
          <div class="calendar-timeline" style="border-left: 2px solid var(--gray-700); padding-left: 1rem; margin-left: 0.5rem;">
            <div style="position: relative; margin-bottom: 1.5rem;">
              <div style="position: absolute; left: -1.35rem; top: 0.2rem; width: 10px; height: 10px; background: var(--primary); border-radius: 50%;"></div>
              <strong style="color: var(--gray-200);">March 2027</strong>
              <p style="color: var(--gray-400); font-size: 0.85rem; margin-top: 0.2rem;">ICC T20 World Cup</p>
            </div>
            <div style="position: relative; margin-bottom: 1.5rem;">
              <div style="position: absolute; left: -1.35rem; top: 0.2rem; width: 10px; height: 10px; background: var(--gray-500); border-radius: 50%;"></div>
              <strong style="color: var(--gray-200);">April 2027</strong>
              <p style="color: var(--gray-400); font-size: 0.85rem; margin-top: 0.2rem;">South Africa Tour of New Zealand</p>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- NEW: RANKINGS & CAREERS DASHBOARD -->
    <main class="dashboard" id="rankingsSection" style="display: none;">
      <div class="primary-column">
        <div class="card highlight">
          <h2 class="card-title">Player Career Center</h2>
          <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem;">
            <input type="text" id="playerSearchInput" class="form-control" placeholder="Search player (e.g. Virat Kohli)..." style="flex: 1;" />
            <button id="playerSearchBtn" class="btn btn-primary">Search</button>
          </div>
          
          <div id="careerCardContainer" style="background: rgba(0,0,0,0.2); border-radius: 12px; padding: 1.5rem; border: 1px solid rgba(255,255,255,0.05); display: none;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
              <div>
                <h3 style="font-size: 1.5rem; margin: 0; color: white;">Virat Kohli</h3>
                <span style="color: var(--gray-400); font-size: 0.9rem;">India • Top Order Batter</span>
              </div>
              <span class="pill" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid #10b981;">Form: HOT 🔥</span>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
              <div style="background: var(--dark); padding: 1rem; border-radius: 8px; text-align: center;">
                <div style="color: var(--gray-400); font-size: 0.8rem; text-transform: uppercase;">Matches</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: white; margin-top: 0.25rem;">292</div>
              </div>
              <div style="background: var(--dark); padding: 1rem; border-radius: 8px; text-align: center;">
                <div style="color: var(--gray-400); font-size: 0.8rem; text-transform: uppercase;">Runs</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: white; margin-top: 0.25rem;">13,848</div>
              </div>
              <div style="background: var(--dark); padding: 1rem; border-radius: 8px; text-align: center;">
                <div style="color: var(--gray-400); font-size: 0.8rem; text-transform: uppercase;">Average</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: white; margin-top: 0.25rem;">58.67</div>
              </div>
              <div style="background: var(--dark); padding: 1rem; border-radius: 8px; text-align: center;">
                <div style="color: var(--gray-400); font-size: 0.8rem; text-transform: uppercase;">100s/50s</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: white; margin-top: 0.25rem;">50 / 72</div>
              </div>
            </div>
            
            <div>
              <h4 style="margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--gray-300);">Recent Timeline</h4>
              <div style="display: flex; gap: 0.5rem;">
                <span style="padding: 0.25rem 0.5rem; background: var(--success); color: white; border-radius: 4px; font-size: 0.8rem; font-weight: 700;">103</span>
                <span style="padding: 0.25rem 0.5rem; background: var(--gray-600); color: white; border-radius: 4px; font-size: 0.8rem; font-weight: 700;">44</span>
                <span style="padding: 0.25rem 0.5rem; background: var(--success); color: white; border-radius: 4px; font-size: 0.8rem; font-weight: 700;">91</span>
                <span style="padding: 0.25rem 0.5rem; background: var(--success); color: white; border-radius: 4px; font-size: 0.8rem; font-weight: 700;">82</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top: 1.5rem;">
          <h2 class="card-title">Form & Fatigue Monitor</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 1rem;">
              <h3 style="font-size: 1rem; color: #ef4444; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem;">⚠ High Fatigue Alerts</h3>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
                <span>Jasprit Bumrah</span><strong style="color: #ef4444;">88%</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Pat Cummins</span><strong style="color: #f59e0b;">76%</strong>
              </div>
            </div>
            <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 1rem;">
              <h3 style="font-size: 1rem; color: #10b981; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem;">🔥 Hot Form Watch</h3>
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
                <span>Travis Head</span><strong style="color: #10b981;">94 Conf</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Virat Kohli</span><strong style="color: #10b981;">92 Conf</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="secondary-column">
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h2 class="card-title" style="margin: 0;">ICC Team Rankings</h2>
            <select class="form-control" style="width: auto; padding: 0.2rem 0.5rem; font-size: 0.8rem;"><option>ODI</option><option>T20I</option></select>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead><tr style="color: var(--gray-400); text-align: left; border-bottom: 1px solid var(--gray-700);"><th style="padding-bottom: 0.5rem;">Rank</th><th>Team</th><th>Rating</th></tr></thead>
            <tbody>
              <tr style="border-bottom: 1px solid var(--gray-800);"><td style="padding: 0.75rem 0;">1 <span style="color: #10b981;">▲</span></td><td><strong>India</strong></td><td>121</td></tr>
              <tr style="border-bottom: 1px solid var(--gray-800);"><td style="padding: 0.75rem 0;">2 <span style="color: #ef4444;">▼</span></td><td><strong>Australia</strong></td><td>118</td></tr>
              <tr style="border-bottom: 1px solid var(--gray-800);"><td style="padding: 0.75rem 0;">3 <span style="color: var(--gray-500);">-</span></td><td><strong>England</strong></td><td>114</td></tr>
              <tr><td style="padding: 0.75rem 0;">4 <span style="color: #10b981;">▲</span></td><td><strong>South Africa</strong></td><td>110</td></tr>
            </tbody>
          </table>
        </div>
        
        <div class="card" style="margin-top: 1.5rem;">
          <h2 class="card-title">Recent Milestones</h2>
          <div class="match-card-list">
            <div class="match-card" style="padding: 0.75rem;">
              <p style="font-size: 0.85rem; margin: 0;"><strong>Rohit Sharma</strong> crossed 10,000 ODI runs.</p>
              <span style="font-size: 0.7rem; color: var(--gray-500);">2 days ago</span>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- NEW: WORLD MANAGEMENT DASHBOARD -->
    <main class="dashboard" id="worldSection" style="display: none;">
      <div class="primary-column">
        <div class="card highlight">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h2 class="card-title" style="color: #ef4444; display: flex; align-items: center; gap: 0.5rem;"><span style="width:10px;height:10px;background:#ef4444;border-radius:50%;box-shadow:0 0 10px #ef4444;display:inline-block;"></span> Live Match Operations Center</h2>
              <p class="card-description">Broadcast-level control room for inspecting AI decisions, momentum, and venue intelligence in real-time.</p>
            </div>
            <span class="pill running" style="font-size: 0.9rem; padding: 0.4rem 1rem;">MATCH IN PROGRESS</span>
          </div>
          
          <div style="margin-top: 1.5rem; background: var(--dark); border-radius: 12px; padding: 1.5rem; border: 1px solid var(--gray-800);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
              <div style="text-align: center;">
                <h3 style="margin: 0; color: var(--gray-300);">IND</h3>
                <span style="font-size: 2rem; font-weight: 800; color: white;">245/4</span>
                <div style="color: var(--gray-400); font-size: 0.9rem;">42.3 Overs</div>
              </div>
              <div style="flex: 1; margin: 0 2rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.5rem; font-weight: 700;">
                  <span style="color: #60a5fa;">IND 68%</span>
                  <span style="color: var(--gray-400);">Win Probability</span>
                  <span style="color: #f59e0b;">AUS 32%</span>
                </div>
                <div style="height: 8px; background: #f59e0b; border-radius: 4px; overflow: hidden; display: flex;">
                  <div style="width: 68%; background: #60a5fa; height: 100%;"></div>
                </div>
              </div>
              <div style="text-align: center; opacity: 0.5;">
                <h3 style="margin: 0; color: var(--gray-300);">AUS</h3>
                <span style="font-size: 1.2rem; font-weight: 800; color: white;">Yet to bat</span>
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
              <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
                <div style="color: var(--gray-400); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.5rem;">Pressure Index</div>
                <div style="font-size: 1.25rem; font-weight: 700; color: #ef4444;">High (8.5/10)</div>
              </div>
              <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
                <div style="color: var(--gray-400); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.5rem;">Venue Impact</div>
                <div style="font-size: 1.25rem; font-weight: 700; color: #10b981;">Spin +30%</div>
              </div>
              <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
                <div style="color: var(--gray-400); font-size: 0.75rem; text-transform: uppercase; margin-bottom: 0.5rem;">Fatigue Modifier</div>
                <div style="font-size: 1.25rem; font-weight: 700; color: #f59e0b;">Bowler -15%</div>
              </div>
            </div>
            
            <div style="margin-top: 1.5rem; display: flex; gap: 1rem;">
              <button class="btn btn-secondary" style="flex: 1;"><svg style="width:16px;height:16px;fill:currentColor;vertical-align:middle;margin-right:0.2rem" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> Pause Simulation</button>
              <button class="btn btn-secondary" style="flex: 1;">1x Speed</button>
              <button class="btn btn-secondary" style="flex: 1;">Inspect AI</button>
            </div>
          </div>
        </div>

        <div class="card" style="margin-top: 1.5rem;">
          <h2 class="card-title">Venue Intelligence</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div style="border: 1px solid var(--gray-800); border-radius: 8px; padding: 1rem;">
              <h4 style="margin: 0 0 1rem 0; color: white;">Wankhede Stadium</h4>
              <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.85rem; color: var(--gray-300); display: grid; gap: 0.5rem;">
                <li style="display: flex; justify-content: space-between;"><span>Avg 1st Innings (ODI)</span><strong>310</strong></li>
                <li style="display: flex; justify-content: space-between;"><span>Pace Assist</span><strong style="color: #f59e0b;">High</strong></li>
                <li style="display: flex; justify-content: space-between;"><span>Dew Factor</span><strong style="color: #60a5fa;">Heavy (2nd Inn)</strong></li>
              </ul>
              <button class="btn btn-sm btn-secondary" style="width: 100%; margin-top: 1rem;">Edit Conditions</button>
            </div>
            <div style="border: 1px solid var(--gray-800); border-radius: 8px; padding: 1rem;">
              <h4 style="margin: 0 0 1rem 0; color: white;">Lord's</h4>
              <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.85rem; color: var(--gray-300); display: grid; gap: 0.5rem;">
                <li style="display: flex; justify-content: space-between;"><span>Avg 1st Innings (ODI)</span><strong>280</strong></li>
                <li style="display: flex; justify-content: space-between;"><span>Pace Assist</span><strong style="color: #10b981;">Very High</strong></li>
                <li style="display: flex; justify-content: space-between;"><span>Dew Factor</span><strong style="color: var(--gray-500);">None</strong></li>
              </ul>
              <button class="btn btn-sm btn-secondary" style="width: 100%; margin-top: 1rem;">Edit Conditions</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="secondary-column">
        <div class="card">
          <h2 class="card-title">World History Timeline</h2>
          <div class="calendar-timeline" style="border-left: 2px solid var(--gray-700); padding-left: 1rem; margin-left: 0.5rem;">
            <div style="position: relative; margin-bottom: 1.5rem;">
              <div style="position: absolute; left: -1.35rem; top: 0.2rem; width: 10px; height: 10px; background: var(--primary); border-radius: 50%;"></div>
              <strong style="color: var(--gray-200);">2026</strong>
              <p style="color: var(--gray-400); font-size: 0.85rem; margin-top: 0.2rem;">India won ICC T20 World Cup</p>
            </div>
            <div style="position: relative; margin-bottom: 1.5rem;">
              <div style="position: absolute; left: -1.35rem; top: 0.2rem; width: 10px; height: 10px; background: var(--primary); border-radius: 50%;"></div>
              <strong style="color: var(--gray-200);">2025</strong>
              <p style="color: var(--gray-400); font-size: 0.85rem; margin-top: 0.2rem;">Australia won ICC Champions Trophy</p>
            </div>
          </div>
          <button class="btn btn-sm btn-secondary btn-full" style="margin-top: 1rem;">Browse Archives</button>
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
