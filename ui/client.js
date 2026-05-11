module.exports = `
    const { teamData, matchTypes } = window.__APP_DATA__;
    const scheduledListEl = document.getElementById("scheduledList");
    const completedMatchesListEl = document.getElementById("completedMatchesList");
    const currentMatchPanel = document.getElementById("currentMatchPanel");
    const activeMatchListEl = document.getElementById("activeMatchList");
    const summaryGridEl = document.getElementById("summaryGrid");
    const summaryNoteEl = document.getElementById("summaryNote");
    const liveLog = document.getElementById("liveLog");
    const serverStatus = document.getElementById("server-status");
    const pauseButton = document.getElementById("pauseButton");
    const resumeButton = document.getElementById("resumeButton");
    const abortButton = document.getElementById("abortButton");
    const clearLogsButton = document.getElementById("clearLogsButton");
    const teamASelect = document.getElementById("teamA");
    const teamBSelect = document.getElementById("teamB");
    const lineupA = document.getElementById("lineupA");
    const lineupB = document.getElementById("lineupB");
    const matchTypeSelect = document.getElementById("matchType");
    const oversInput = document.getElementById("overs");
    const submitButton = document.getElementById("submitButton");
    const genderToggle = document.getElementById("genderToggle");
    const searchA = document.getElementById("searchA");
    const searchB = document.getElementById("searchB");

    // International Selectors
    const tourForm = document.getElementById("tourForm");
    const tourHostSelect = document.getElementById("tourHost");
    const tourVisitorSelect = document.getElementById("tourVisitor");
    const internationalSection = document.getElementById("internationalSection");
    const rankingsSection = document.getElementById("rankingsSection");
    const worldSection = document.getElementById("worldSection");
    const liveSeriesContainer = document.getElementById("liveSeriesContainer");
    const bannerActiveTours = document.getElementById("bannerActiveTours");
    const bannerLiveMatches = document.getElementById("bannerLiveMatches");
    const bannerOdiTop = document.getElementById("bannerOdiTop");
    const bannerT20Top = document.getElementById("bannerT20Top");
    
    // Maintenance Selectors
    const maintenanceSection = document.getElementById("maintenanceSection");
    const cleanupRangeSelect = document.getElementById("cleanupRange");
    const customDateRangeEl = document.getElementById("customDateRange");
    const executeCleanupBtn = document.getElementById("executeCleanup");
    const cleanupLogsEl = document.getElementById("cleanupLogs");
    const cleanupMatchesCb = document.getElementById("cleanupMatches");
    const cleanupTournamentsCb = document.getElementById("cleanupTournaments");
    const cleanupStartInput = document.getElementById("cleanupStart");
    const cleanupEndInput = document.getElementById("cleanupEnd");
    
    // Guided Simulation Selectors
    const guidedSimToggle = document.getElementById("guidedSimToggle");
    const guidedSimOptions = document.getElementById("guidedSimOptions");
    const intensityInput = document.getElementById("intensity");
    const intensityVal = document.getElementById("intensityVal");
    const matchForm = document.getElementById("matchForm");

    let selectedActiveMatchId = null;
    let lastStatusData = null;

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function formatDateTime(value) {
      if (!value) return "Immediate";
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "Invalid date" : date.toLocaleString();
    }

    function formatDuration(totalSeconds) {
      const seconds = Math.max(0, Number(totalSeconds) || 0);
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;
      if (hours > 0) return hours + "h " + minutes + "m";
      if (minutes > 0) return minutes + "m " + remainingSeconds + "s";
      return remainingSeconds + "s";
    }

    function getTeamLabel(match, side) {
      return side === "A"
        ? (match.teamAName || match.teamA || "Team A")
        : (match.teamBName || match.teamB || "Team B");
    }

    async function postJson(url, payload = {}) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      let data = {};
      try { data = await response.json(); } catch (e) {}
      if (!response.ok) throw new Error(data.error || "Request failed.");
      return data;
    }

    function updateTeamDropdowns() {
      const gender = genderToggle.value;
      const matchType = matchTypeSelect.value;
      let targetGender = gender;
      if (gender === "men" && matchType === "ODI") targetGender = "ODI Men";

      const filteredTeams = teamData.filter(team => team.gender === targetGender);
      const html = filteredTeams.map(team =>
        '<option value="' + escapeHtml(team.name) + '">' + escapeHtml(team.name) + "</option>"
      ).join("");

      teamASelect.innerHTML = html;
      teamBSelect.innerHTML = html;
      if (filteredTeams.length > 1) teamBSelect.selectedIndex = 1;
      
      if (tourHostSelect && tourVisitorSelect) {
        tourHostSelect.innerHTML = html;
        tourVisitorSelect.innerHTML = html;
        if (filteredTeams.length > 1) tourVisitorSelect.selectedIndex = 1;
      }

      updateFormState();
    }

    function updateFormState() {
      const sameTeams = teamASelect.value === teamBSelect.value;
      submitButton.disabled = sameTeams;
      submitButton.textContent = sameTeams ? "Select different teams" : "SCHEDULE MATCH";
    }

    // --- International Logic ---
    async function updateInternationalDashboard() {
      try {
        const response = await fetch("/api/international/status");
        if (!response.ok) return;
        const data = await response.json();
        
        if (bannerActiveTours) bannerActiveTours.textContent = data.activeTours || 0;
        if (data.rankings) {
          if (bannerOdiTop) bannerOdiTop.textContent = data.rankings.ODI?.[0]?.team || "---";
          if (bannerT20Top) bannerT20Top.textContent = data.rankings.T20?.[0]?.team || "---";
        }

        // Render Active Tours List
        const activeToursListEl = document.getElementById("activeToursList");
        if (activeToursListEl && data.activeToursData) {
           activeToursListEl.innerHTML = data.activeToursData.map(t => 
             '<div class="match-card" style="border-left: 4px solid var(--primary);"><div><h4>' + escapeHtml(t.name) + '</h4><p class="note">' + t.status + '</p></div></div>'
           ).join("") || "<p class='note'>No active tours</p>";
        }

        // Render Live Series
        if (liveSeriesContainer && data.liveSeries) {
          liveSeriesContainer.innerHTML = data.liveSeries.map(s => 
            '<div class="match-card" style="background: linear-gradient(145deg, var(--gray-900) 0%, var(--dark) 100%); width: 100%;">'
            + '<div style="width: 100%;"><div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">'
            + '<h4 style="color: var(--primary-light);">' + s.format + ' Series: ' + s.teamA + ' vs ' + s.teamB + '</h4>'
            + '<span class="pill running">LIVE</span></div>'
            + '<div style="display: flex; justify-content: space-between; align-items: center;">'
            + '<span style="font-size: 1.2rem; font-weight: 700;">' + s.scoreText + '</span>'
            + '<span style="color: var(--gray-400); font-size: 0.85rem;">Match ' + (s.matchesPlayed + 1) + ' of ' + s.totalMatches + '</span>'
            + '</div></div></div>'
          ).join("") || "<p class='note'>No live series matches</p>";
        }
      } catch (e) { console.error("Failed to update international dashboard", e); }
    }

    const playerSearchBtn = document.getElementById("playerSearchBtn");
    if (playerSearchBtn) {
      playerSearchBtn.addEventListener("click", async () => {
        const input = document.getElementById("playerSearchInput").value.trim();
        if (!input) return;
        
        try {
          playerSearchBtn.disabled = true;
          playerSearchBtn.textContent = "Searching...";
          const res = await fetch("/api/international/career?playerId=" + encodeURIComponent(input));
          const data = await res.json();
          
          if (data.error || !data.matches) {
            alert("Player not found in international database.");
            return;
          }
          
          document.getElementById("careerCardContainer").style.display = "block";
          document.getElementById("careerCardContainer").innerHTML = 
            '<div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">'
            + '<div><h3 style="font-size: 1.5rem; margin: 0; color: white;">' + escapeHtml(input) + '</h3>'
            + '<span style="color: var(--gray-400); font-size: 0.9rem;">International Player</span></div>'
            + '<span class="pill" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid #10b981;">Form: ACTIVE</span>'
            + '</div>'
            + '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">'
            + '<div style="background: var(--dark); padding: 1rem; border-radius: 8px; text-align: center;"><div style="color: var(--gray-400); font-size: 0.8rem; text-transform: uppercase;">Matches</div><div style="font-size: 1.5rem; font-weight: 700; color: white; margin-top: 0.25rem;">' + (data.matches || 0) + '</div></div>'
            + '<div style="background: var(--dark); padding: 1rem; border-radius: 8px; text-align: center;"><div style="color: var(--gray-400); font-size: 0.8rem; text-transform: uppercase;">Runs</div><div style="font-size: 1.5rem; font-weight: 700; color: white; margin-top: 0.25rem;">' + (data.runs || 0) + '</div></div>'
            + '<div style="background: var(--dark); padding: 1rem; border-radius: 8px; text-align: center;"><div style="color: var(--gray-400); font-size: 0.8rem; text-transform: uppercase;">Wickets</div><div style="font-size: 1.5rem; font-weight: 700; color: white; margin-top: 0.25rem;">' + (data.wickets || 0) + '</div></div>'
            + '<div style="background: var(--dark); padding: 1rem; border-radius: 8px; text-align: center;"><div style="color: var(--gray-400); font-size: 0.8rem; text-transform: uppercase;">High Score</div><div style="font-size: 1.5rem; font-weight: 700; color: white; margin-top: 0.25rem;">' + (data.highScore || 0) + '</div></div>'
            + '</div>';
            
        } catch (err) {
          alert("Failed to fetch player stats.");
        } finally {
          playerSearchBtn.disabled = false;
          playerSearchBtn.textContent = "Search";
        }
      });
    }

    async function handleTourSubmit(e) {
      e.preventDefault();
      const btn = e.target.querySelector('.btn-primary');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="loading">Generating...</span>';
      }

      try {
        const payload = {
          host: tourHostSelect.value,
          visitor: tourVisitorSelect.value,
          season: document.getElementById("tourSeason").value,
          seriesConfigs: []
        };

        const odiCount = parseInt(document.getElementById("odiCount").value);
        const t20Count = parseInt(document.getElementById("t20Count").value);

        if (odiCount > 0) payload.seriesConfigs.push({ format: "ODI", matches: odiCount });
        if (t20Count > 0) payload.seriesConfigs.push({ format: "T20", matches: t20Count });

        if (payload.seriesConfigs.length === 0) throw new Error("Please add at least one series to the tour.");

        const result = await postJson("/api/international/tour/create", payload);
        alert(result.message);
        updateInternationalDashboard();
      } catch (err) {
        alert("Tour generation failed: " + err.message);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = "Generate Tour Fixtures";
        }
      }
    }

    async function handleSubmit(e) {
      e.preventDefault();
      
      const btn = submitButton;
      btn.disabled = true;
      btn.textContent = "Scheduling...";

      try {
        const payload = {
          teamA: teamASelect.value,
          teamB: teamBSelect.value,
          matchType: matchTypeSelect.value,
          overs: oversInput.value,
          delayMs: document.getElementById("delayMs").value,
          startAt: document.getElementById("startAt").value || null
        };

        // Add Guided Simulation settings if enabled
        if (guidedSimToggle && guidedSimToggle.checked) {
          payload.guidedSimulationSettings = {
            enabled: true,
            preferredWinner: document.getElementById("preferredWinner").value || null,
            targetScore: parseInt(document.getElementById("targetScore").value) || null,
            narrativeType: document.getElementById("narrativeType").value || "random",
            intensity: parseFloat(intensityInput.value) || 0.5
          };
        }

        const result = await postJson("/api/schedule", payload);
        alert(result.message);
        refresh();
      } catch (err) {
        alert("Scheduling failed: " + err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "Schedule Match";
      }
    }

    // --- Main Dashboard Logic ---
    async function refresh() {
      try {
        const [statusRes, matchesRes] = await Promise.all([fetch("/api/status"), fetch("/api/matches")]);
        const statusData = await statusRes.json();
        const matchRegistry = await matchesRes.json();
        
        renderStatus(statusData);
        renderLog(statusData.liveLogs);
        
        const entries = Object.values(matchRegistry || {});
        renderScheduled(entries.filter(i => i.status === "scheduled"));
        renderCompletedMatches(entries.filter(i => !["scheduled", "running", "paused"].includes(i.status)));
      } catch (e) { console.error("Refresh failed", e); }
    }

    function renderStatus(data) {
      if (!data) return;
      lastStatusData = data;
      const activeMatches = data.activeMatches || [];
      const summary = data.summary || {};
      
      // Update Summary Stats
      summaryGridEl.innerHTML = [
        { label: "Live Matches", value: summary.activeMatchCount || 0 },
        { label: "Scheduled", value: summary.statusCounts?.scheduled || 0 },
        { label: "Completed", value: summary.statusCounts?.completed || 0 }
      ].map(s => '<div class="summary-stat"><span class="summary-label">' + s.label + '</span><strong class="summary-value">' + s.value + '</strong></div>').join("");

      // Update Active Match List
      activeMatchListEl.innerHTML = activeMatches.map(m => {
        const isSelected = m.matchId === selectedActiveMatchId;
        return '<button type="button" class="active-match-card ' + (isSelected ? "selected" : "") + '" onclick="selectMatch(\\'' + m.matchId + '\\')">'
          + '<h4>' + m.matchId + '</h4><p>' + m.score + ' | ' + m.status + '</p></button>';
      }).join("") || "<p class='note'>No active matches</p>";

      // Update Badge
      serverStatus.className = "status-badge " + (activeMatches.length > 0 ? "running" : "idle");
      serverStatus.textContent = activeMatches.length > 0 ? activeMatches.length + " live" : "idle";
    }

    window.selectMatch = (id) => {
      selectedActiveMatchId = id;
      refresh();
    };

    function renderLog(logs) {
      liveLog.innerHTML = (logs || []).map(l => '<div class="log-entry">[' + l.timestamp.split("T")[1].split(".")[0] + '] ' + l.message + '</div>').join("");
    }

    function renderScheduled(matches) {
      scheduledListEl.innerHTML = matches.map(m => '<div class="match-card"><div><h4>' + m.matchId + '</h4><p>' + formatDateTime(m.startAt) + '</p></div><button class="btn btn-danger btn-sm" onclick="cancelMatch(\\'' + m.id + '\\')">Cancel</button></div>').join("") || "<p class='note'>None</p>";
    }

    window.cancelMatch = async (id) => {
      if (confirm("Cancel this match?")) {
        await postJson("/api/cancel", { id });
        refresh();
      }
    };

    function renderCompletedMatches(matches) {
      completedMatchesListEl.innerHTML = matches.slice(0, 10).map(m => '<div class="match-card"><div><h4>' + m.matchId + '</h4><p>' + (m.resultSummary || "Completed") + '</p></div></div>').join("") || "<p class='note'>None</p>";
    }

    // --- Tab Switching ---
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        
        // Fix active styling discrepancy by resetting inline styles from HTML
        document.querySelectorAll(".tab-btn").forEach(b => {
          b.classList.remove("active");
          b.style.background = "transparent";
          b.style.boxShadow = "none";
          b.style.color = "var(--gray-400)";
        });
        
        btn.classList.add("active");
        btn.style.background = "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)";
        btn.style.color = "white";
        btn.style.boxShadow = "0 4px 14px rgba(30, 64, 175, 0.3)";

        const sectionMap = {
          "matches": "matchSection",
          "tournaments": "tournamentSection",
          "international": "internationalSection",
          "rankings": "rankingsSection",
          "world": "worldSection",
          "maintenance": "maintenanceSection"
        };

        const targetId = sectionMap[tab];

        [
          document.getElementById("matchSection"), 
          document.getElementById("tournamentSection"), 
          document.getElementById("internationalSection"), 
          document.getElementById("rankingsSection"), 
          document.getElementById("worldSection"), 
          document.getElementById("maintenanceSection")
        ].forEach(s => { if (s) s.style.display = "none"; });

        const target = document.getElementById(targetId);
        if (target) {
          target.style.display = "grid";
          if (tab === "international") updateInternationalDashboard();
          if (tab === "tournaments") {
            renderTournamentTeamSelection();
            refreshTournaments();
          }
        }
      });
    });

    // --- Tournament Engine Logic ---
    let selectedTournamentTeams = new Set();
    function renderTournamentTeamSelection() {
      const tournamentTeamListEl = document.getElementById("tournamentTeamList");
      const filteredTeams = teamData.filter(team => team.gender === "men" || team.gender === "ODI Men");
      tournamentTeamListEl.innerHTML = filteredTeams.map(team => {
        const isSelected = selectedTournamentTeams.has(team.name);
        return '<label class="player-option"><input type="checkbox" onchange="toggleTournamentTeam(\\'' + team.name + '\\')" ' + (isSelected ? "checked" : "") + '><span>' + team.name + '</span></label>';
      }).join("");
    }

    window.toggleTournamentTeam = (name) => {
      if (selectedTournamentTeams.has(name)) selectedTournamentTeams.delete(name);
      else selectedTournamentTeams.add(name);
      document.getElementById("teamCountLabel").textContent = selectedTournamentTeams.size + " teams selected";
    };

    let generatedFixtures = [];
    
    const generateTournamentBtn = document.getElementById("generateTournamentBtn");
    if (generateTournamentBtn) {
      generateTournamentBtn.addEventListener("click", async () => {
        if (selectedTournamentTeams.size < 2) {
          alert("Please select at least 2 teams.");
          return;
        }

        const template = document.getElementById("tournamentTemplate").value;
        const season = document.getElementById("tournamentSeason").value;
        const name = document.getElementById("tournamentNameInput").value;

        try {
          generateTournamentBtn.disabled = true;
          generateTournamentBtn.textContent = "Generating...";
          
          const result = await postJson("/api/tournaments/generate", {
            templateKey: template,
            season: Number(season),
            tournamentName: name,
            teams: Array.from(selectedTournamentTeams).map(name => ({ id: name, name }))
          });

          generatedFixtures = result.fixtures;
          document.getElementById("fixturesList").innerHTML = generatedFixtures.map((f, i) => (
            '<div class="match-card" style="margin-bottom: 0.5rem; background: white; border: 1px solid var(--gray-200);">'
              + '<div><strong style="color: var(--primary); font-size: 0.8rem; text-transform: uppercase;">' + (f.stage === "league" ? "Round " + f.round : f.stage) + '</strong>'
              + '<p style="margin: 0.2rem 0; font-weight: 700; color: var(--dark);">' + escapeHtml(f.teamA.name) + ' vs ' + escapeHtml(f.teamB.name) + '</p></div>'
              + '<div><span class="pill scheduled">Pending</span></div>'
            + '</div>'
          )).join("");
          document.getElementById("tournamentFixturesCard").style.display = "block";
          document.getElementById("tournamentFixturesCard").scrollIntoView({ behavior: "smooth" });
        } catch (error) {
          alert(error.message);
        } finally {
          generateTournamentBtn.disabled = false;
          generateTournamentBtn.textContent = "Generate Season Fixtures";
        }
      });
    }

    const saveTournamentBtn = document.getElementById("saveTournamentBtn");
    if (saveTournamentBtn) {
      saveTournamentBtn.addEventListener("click", async () => {
        if (!generatedFixtures.length) return;

        try {
          saveTournamentBtn.disabled = true;
          saveTournamentBtn.textContent = "Finalizing...";

          const template = document.getElementById("tournamentTemplate").value;
          const season = document.getElementById("tournamentSeason").value;
          const name = document.getElementById("tournamentNameInput").value;
          const autoMode = document.getElementById("autoSimTournament")?.checked || false;

          await postJson("/api/tournaments/save", {
            templateKey: template,
            season: Number(season),
            tournamentName: name,
            autoMode: autoMode,
            teams: Array.from(selectedTournamentTeams).map(name => ({ id: name, name })),
            fixtures: generatedFixtures
          });

          alert("Tournament scheduled successfully!");
          document.getElementById("tournamentFixturesCard").style.display = "none";
          selectedTournamentTeams.clear();
          renderTournamentTeamSelection();
          refreshTournaments();
        } catch (error) {
          alert(error.message);
        } finally {
          saveTournamentBtn.disabled = false;
          saveTournamentBtn.textContent = "Finalize & Schedule Tournament";
        }
      });
    }

    async function refreshTournaments() {
      try {
        const res = await fetch("/api/tournaments/list");
        const tournaments = await res.json();
        
        document.getElementById("activeTournamentList").innerHTML = tournaments.map(t => (
          '<button type="button" class="active-match-card" onclick="selectTournament(\\'' + escapeHtml(t.id) + '\\')">'
            + '<div class="active-match-card-header">'
              + '<h4>' + escapeHtml(t.name) + '</h4>'
              + '<span class="pill ' + (t.status === "completed" ? "completed" : "running") + '">' + escapeHtml(t.status) + '</span>'
            + '</div>'
            + '<div class="active-match-meta">'
              + '<span>Season ' + escapeHtml(t.season) + '</span>'
              + '<span>' + escapeHtml(t.format) + '</span>'
            + '</div>'
          + '</button>'
        )).join("") || "<p class='note'>No tournaments found.</p>";
      } catch (err) {
        console.error("Failed to load tournaments");
      }
    }

    window.selectTournament = (tid) => {
      fetchStandings(tid);
      fetchLeaders(tid);
    };

    async function fetchStandings(tid) {
      const container = document.getElementById("standingsContainer");
      try {
        container.innerHTML = "<p class='note'>Loading points table...</p>";
        const res = await fetch("/api/tournaments/standings/" + tid);
        const standings = await res.json();

        container.innerHTML = (
          '<table class="schedule-table" style="font-size: 0.8rem; width: 100%; border-collapse: collapse;">'
            + '<thead style="background: var(--gray-50);"><tr><th style="padding: 0.5rem;">Team</th><th style="padding: 0.5rem;">P</th><th style="padding: 0.5rem;">Pts</th><th style="padding: 0.5rem;">NRR</th></tr></thead>'
            + '<tbody>'
              + standings.map(s => (
                '<tr style="border-bottom: 1px solid var(--gray-100);">'
                  + '<td style="padding: 0.6rem 0.5rem;"><strong>' + escapeHtml(s.teamName) + '</strong></td>'
                  + '<td style="padding: 0.6rem 0.5rem;">' + s.played + '</td>'
                  + '<td style="padding: 0.6rem 0.5rem;"><strong>' + s.points + '</strong></td>'
                  + '<td style="padding: 0.6rem 0.5rem;">' + (s.nrr >= 0 ? "+" : "") + s.nrr.toFixed(3) + '</td>'
                + '</tr>'
              )).join("")
            + '</tbody>'
          + '</table>'
        );
      } catch (err) {
        container.innerHTML = "<p class='note'>Failed to load standings.</p>";
      }
    }

    async function fetchLeaders(tid) {
      const container = document.getElementById("leadersContainer");
      try {
        container.innerHTML = "<p class='note'>Loading stats...</p>";
        const res = await fetch("/api/tournaments/leaders/" + tid);
        const data = await res.json();

        const orangeHtml = data.orangeCap.map((p, i) => 
          '<tr><td style="padding: 0.4rem;">' + (i+1) + '. ' + escapeHtml(p.name) + '</td><td style="padding: 0.4rem; text-align:right;"><strong>' + p.runs + '</strong></td></tr>'
        ).join("");

        const purpleHtml = data.purpleCap.map((p, i) => 
          '<tr><td style="padding: 0.4rem;">' + (i+1) + '. ' + escapeHtml(p.name) + '</td><td style="padding: 0.4rem; text-align:right;"><strong>' + p.wickets + '</strong></td></tr>'
        ).join("");

        container.innerHTML = (
          '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">'
            + '<div><h4 style="color: #f59e0b; margin-bottom: 0.5rem; font-size: 0.8rem;">Orange Cap</h4><table style="width:100%; font-size: 0.75rem;">' + orangeHtml + '</table></div>'
            + '<div><h4 style="color: #8b5cf6; margin-bottom: 0.5rem; font-size: 0.8rem;">Purple Cap</h4><table style="width:100%; font-size: 0.75rem;">' + purpleHtml + '</table></div>'
          + '</div>'
        );
      } catch (err) {
        container.innerHTML = "<p class='note'>Failed to load stats.</p>";
      }
    }

    // --- Setup & Initial Load ---
    async function init() {
      // Parse URL parameters to pre-fill the form
      const params = new URLSearchParams(window.location.search);
      if (params.has("matchType")) matchTypeSelect.value = params.get("matchType");
      if (params.has("overs")) oversInput.value = params.get("overs");
      if (params.has("delayMs")) document.getElementById("delayMs").value = params.get("delayMs");
      if (params.has("teamA")) {
        // We'll set this after the dropdown is built in updateTeamDropdowns
      }

      updateTeamDropdowns();
      
      // Secondary pass for team selection after updateTeamDropdowns builds the options
      if (params.has("teamA")) teamASelect.value = params.get("teamA");
      if (params.has("teamB")) teamBSelect.value = params.get("teamB");

      if (tourForm) tourForm.addEventListener("submit", handleTourSubmit);
      if (matchForm) matchForm.addEventListener("submit", handleSubmit);
      
      if (guidedSimToggle) {
        guidedSimToggle.addEventListener("change", () => {
          guidedSimOptions.style.display = guidedSimToggle.checked ? "block" : "none";
        });
      }
      
      if (intensityInput) {
        intensityInput.addEventListener("input", () => {
          intensityVal.textContent = intensityInput.value;
        });
      }

      genderToggle.addEventListener("change", updateTeamDropdowns);
      matchTypeSelect.addEventListener("change", updateTeamDropdowns);
      
      await refresh();
      updateInternationalDashboard();
      
      // Auto-schedule if params are complete
      if (params.has("teamA") && params.has("teamB") && params.has("auto")) {
        submitButton.click();
      }

      setInterval(refresh, 5000);
      setInterval(updateInternationalDashboard, 60000);
    }

    init();
`;
