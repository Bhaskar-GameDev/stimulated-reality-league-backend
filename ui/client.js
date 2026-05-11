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
      submitButton.textContent = sameTeams ? "Select different teams" : "Schedule match";
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
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        [document.getElementById("matchSection"), 
         document.getElementById("tournamentSection"), 
         internationalSection, rankingsSection, worldSection, maintenanceSection].forEach(s => { if (s) s.style.display = "none"; });

        const target = document.getElementById(tab + "Section");
        if (target) {
          target.style.display = "grid";
          if (tab === "international") updateInternationalDashboard();
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

    // --- Setup & Initial Load ---
    async function init() {
      updateTeamDropdowns();
      if (tourForm) tourForm.addEventListener("submit", handleTourSubmit);
      genderToggle.addEventListener("change", updateTeamDropdowns);
      matchTypeSelect.addEventListener("change", updateTeamDropdowns);
      
      await refresh();
      updateInternationalDashboard();
      setInterval(refresh, 5000);
      setInterval(updateInternationalDashboard, 60000);
    }

    init();
`;
