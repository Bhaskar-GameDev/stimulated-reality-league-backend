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
    const lineupAName = document.getElementById("lineupAName");
    const lineupBName = document.getElementById("lineupBName");
    const lineupACount = document.getElementById("lineupACount");
    const lineupBCount = document.getElementById("lineupBCount");
    const matchTypeSelect = document.getElementById("matchType");
    const oversInput = document.getElementById("overs");
    const submitButton = document.getElementById("submitButton");
    const genderToggle = document.getElementById("genderToggle");
    const searchA = document.getElementById("searchA");
    const searchB = document.getElementById("searchB");
    const selectionState = {
      teamA: [],
      teamB: []
    };

    let savedLineups = {};
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

      if (hours > 0) {
        return hours + "h " + minutes + "m";
      }
      if (minutes > 0) {
        return minutes + "m " + remainingSeconds + "s";
      }
      return remainingSeconds + "s";
    }

    function getTeamLabel(match, side) {
      return side === "A"
        ? (match.teamAName || match.teamA || "Team A")
        : (match.teamBName || match.teamB || "Team B");
    }

    function getSelectedMatchId() {
      return selectedActiveMatchId || null;
    }

    async function postJson(url, payload = {}) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      let data = {};
      try {
        data = await response.json();
      } catch (error) {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data.error || "Request failed.");
      }

      return data;
    }

    function updateTeamDropdowns() {
      const gender = genderToggle.value;
      const filteredTeams = teamData.filter(team => team.gender === gender);
      const html = filteredTeams.map(team =>
        '<option value="' + escapeHtml(team.name) + '">' + escapeHtml(team.name) + "</option>"
      ).join("");

      teamASelect.innerHTML = html;
      teamBSelect.innerHTML = html;
      if (filteredTeams.length > 1) {
        teamBSelect.selectedIndex = 1;
      }

      resetSelection("teamA", teamASelect.value);
      resetSelection("teamB", teamBSelect.value);
      renderLineups();
      updateFormState();
    }

    genderToggle.addEventListener("change", updateTeamDropdowns);

    function filterList(input, listId) {
      const term = input.value.toLowerCase();
      const items = document.querySelectorAll("#" + listId + " li");
      items.forEach(item => {
        const nameNode = item.querySelector(".player-name");
        if (nameNode) {
          const name = nameNode.textContent.toLowerCase();
          item.style.display = name.includes(term) ? "" : "none";
        }
      });
    }

    searchA.addEventListener("input", event => filterList(event.target, "lineupA"));
    searchB.addEventListener("input", event => filterList(event.target, "lineupB"));

    async function fetchLineups() {
      try {
        const res = await fetch("/api/lineups");
        savedLineups = await res.json();
      } catch (error) {
        console.error("Failed to load lineups");
      }
    }

    function getTeamPlayers(teamName) {
      return teamData.find(team => team.name === teamName)?.players || [];
    }

    function resetSelection(side, teamName) {
      const saved = savedLineups[teamName];
      const players = getTeamPlayers(teamName);
      const validIds = new Set(players.map(player => player.id));
      if (saved && Array.isArray(saved) && saved.length === 11 && saved.every(id => validIds.has(id))) {
        selectionState[side] = [...saved];
      } else {
        selectionState[side] = players.slice(0, 11).map(player => player.id);
      }
    }

    function sanitizeSelection(side, teamName) {
      const validIds = new Set(getTeamPlayers(teamName).map(player => player.id));
      selectionState[side] = (selectionState[side] || []).filter((id, index, arr) =>
        validIds.has(id) && arr.indexOf(id) === index
      );
    }

    function getRoleColor(role) {
      return {
        Batsman: "#1a73e8",
        Bowler: "#e53935",
        Allrounder: "#43a047",
        "Wicket-keeper": "#fb8c00"
      }[role] || "#666";
    }

    function renderOneTeam(side, teamName) {
      const players = getTeamPlayers(teamName);
      sanitizeSelection(side, teamName);
      const selected = selectionState[side];
      const selectedSet = new Set(selected);

      const nameEl = document.getElementById("lineup" + (side === "teamA" ? "A" : "B") + "Name");
      const countEl = document.getElementById("lineup" + (side === "teamA" ? "A" : "B") + "Count");
      const playEl = document.getElementById("playing" + (side === "teamA" ? "A" : "B"));
      const benchEl = document.getElementById("lineup" + (side === "teamA" ? "A" : "B"));
      const searchId = "search" + (side === "teamA" ? "A" : "B");

      nameEl.textContent = teamName || "Select a team";
      countEl.textContent = selected.length + "/11 selected";
      countEl.className = "selection-count " + (selected.length === 11 ? "valid" : "invalid");

      const playerMap = Object.fromEntries(players.map(player => [player.id, player]));
      playEl.innerHTML = selected.map((id, index) => {
        const player = playerMap[id];
        if (!player) return "";
        const meta = [player.role, player.type].filter(Boolean).join(" • ");
        const roleColor = getRoleColor(player.role);
        return (
          '<li style="display:flex;align-items:center;gap:0.5rem;padding:0.55rem 0.6rem;'
          + 'border:1px solid #e0e0e0;margin-bottom:0.3rem;border-radius:8px;background:#fff;'
          + 'box-shadow:0 1px 3px rgba(0,0,0,.06);">'
            + '<span style="font-size:0.75rem;font-weight:700;color:#888;min-width:18px;text-align:center;">' + (index + 1) + "</span>"
            + '<div style="display:flex;flex-direction:column;gap:1px;">'
              + '<button type="button" class="order-btn" data-side="' + escapeHtml(side) + '" data-dir="up" data-index="' + index + '" '
              + 'style="background:none;border:none;cursor:pointer;padding:0;line-height:1;font-size:0.85rem;" title="Move up">▲</button>'
              + '<button type="button" class="order-btn" data-side="' + escapeHtml(side) + '" data-dir="down" data-index="' + index + '" '
              + 'style="background:none;border:none;cursor:pointer;padding:0;line-height:1;font-size:0.85rem;" title="Move down">▼</button>'
            + "</div>"
            + '<div style="flex:1;overflow:hidden;">'
              + '<div class="player-name" style="font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(player.name) + "</div>"
              + '<div style="font-size:0.75rem;color:' + roleColor + ';font-weight:500;">' + escapeHtml(meta) + "</div>"
            + "</div>"
            + '<button type="button" class="remove-btn" data-side="' + escapeHtml(side) + '" data-id="' + escapeHtml(id) + '" '
            + 'style="background:#fee2e2;color:#dc2626;border:none;border-radius:6px;padding:0.2rem 0.55rem;'
            + 'font-size:0.78rem;font-weight:700;cursor:pointer;white-space:nowrap;" title="Remove from XI">✕</button>'
          + "</li>"
        );
      }).join("");

      const term = (document.getElementById(searchId)?.value || "").toLowerCase();
      const bench = players.filter(player => !selectedSet.has(player.id));
      benchEl.innerHTML = bench.map(player => {
        const meta = [player.role, player.type].filter(Boolean).join(" • ");
        const hidden = term && !player.name.toLowerCase().includes(term) ? ' style="display:none;"' : "";
        const full = selected.length >= 11;
        const roleColor = getRoleColor(player.role);
        return (
          "<li" + hidden + ' style="display:flex;align-items:center;justify-content:space-between;'
          + 'padding:0.5rem 0.6rem;border:1px solid #e0e0e0;margin-bottom:0.3rem;border-radius:8px;'
          + 'background:#fafafa;">'
            + "<div>"
              + '<div class="player-name" style="font-weight:600;font-size:0.88rem;">' + escapeHtml(player.name) + "</div>"
              + '<div style="font-size:0.75rem;color:' + roleColor + ';font-weight:500;">' + escapeHtml(meta) + "</div>"
            + "</div>"
            + '<button type="button" class="add-btn" data-side="' + escapeHtml(side) + '" data-id="' + escapeHtml(player.id) + '" '
            + (full ? "disabled " : "")
            + 'style="background:#d1fae5;color:' + (full ? "#9ca3af" : "#059669") + ";"
            + 'border:none;border-radius:6px;padding:0.2rem 0.55rem;font-size:0.78rem;font-weight:700;'
            + 'cursor:' + (full ? "not-allowed" : "pointer") + ';white-space:nowrap;" title="Add to XI">+ ADD</button>'
          + "</li>"
        );
      }).join("");
    }

    function renderLineups() {
      renderOneTeam("teamA", teamASelect.value);
      renderOneTeam("teamB", teamBSelect.value);
      bindLineupEvents();
    }

    function bindLineupEvents() {
      document.querySelectorAll(".add-btn").forEach(button => {
        button.addEventListener("click", event => {
          const { side, id } = event.currentTarget.dataset;
          if (selectionState[side].length >= 11) {
            alert("Only 11 players allowed.");
            return;
          }
          selectionState[side].push(id);
          renderLineups();
          updateFormState();
        });
      });

      document.querySelectorAll(".remove-btn").forEach(button => {
        button.addEventListener("click", event => {
          const { side, id } = event.currentTarget.dataset;
          selectionState[side] = selectionState[side].filter(playerId => playerId !== id);
          renderLineups();
          updateFormState();
        });
      });

      document.querySelectorAll(".order-btn").forEach(button => {
        button.addEventListener("click", event => {
          const { side, dir, index } = event.currentTarget.dataset;
          const arr = selectionState[side];
          const currentIndex = Number(index);
          if (dir === "up" && currentIndex > 0) {
            [arr[currentIndex - 1], arr[currentIndex]] = [arr[currentIndex], arr[currentIndex - 1]];
          }
          if (dir === "down" && currentIndex < arr.length - 1) {
            [arr[currentIndex], arr[currentIndex + 1]] = [arr[currentIndex + 1], arr[currentIndex]];
          }
          renderLineups();
        });
      });
    }

    function updateFormState() {
      const teamAName = teamASelect.value;
      const teamBName = teamBSelect.value;
      const sameTeams = teamAName === teamBName;
      const validLineups = selectionState.teamA.length === 11 && selectionState.teamB.length === 11;
      const isInvalid = sameTeams || !validLineups;
      submitButton.disabled = isInvalid;

      if (sameTeams) {
        submitButton.textContent = "Select different teams";
      } else if (!validLineups) {
        submitButton.textContent = "Select exactly 11 players for each team";
      } else {
        submitButton.textContent = "Schedule match";
      }
    }

    function buildServerBadge(activeMatches, summary) {
      if (activeMatches.length > 0) {
        return {
          statusClass: activeMatches.some(match => match.status === "running") ? "running" : "paused",
          label: activeMatches.length === 1 ? "1 live match" : activeMatches.length + " live matches"
        };
      }

      const scheduledCount = summary?.statusCounts?.scheduled || 0;
      if (scheduledCount > 0) {
        return {
          statusClass: "scheduled",
          label: scheduledCount === 1 ? "1 scheduled" : scheduledCount + " scheduled"
        };
      }

      return {
        statusClass: "idle",
        label: "idle"
      };
    }

    function syncSelectedActiveMatch(activeMatches) {
      if (!Array.isArray(activeMatches) || activeMatches.length === 0) {
        selectedActiveMatchId = null;
        return null;
      }

      const existing = activeMatches.find(match => match.matchId === selectedActiveMatchId);
      if (existing) {
        return existing;
      }

      const runningMatch = activeMatches.find(match => match.status === "running");
      const pausedMatch = activeMatches.find(match => match.status === "paused");
      const fallback = runningMatch || pausedMatch || activeMatches[0];
      selectedActiveMatchId = fallback.matchId;
      return fallback;
    }

    function renderSummary(summary) {
      if (!summary) {
        summaryGridEl.innerHTML = "";
        summaryNoteEl.textContent = "Summary is unavailable right now.";
        return;
      }

      const statusCounts = summary.statusCounts || {};
      const stats = [
        { label: "Live Matches", value: summary.activeMatchCount ?? 0 },
        { label: "Scheduled", value: statusCounts.scheduled ?? 0 },
        { label: "Completed", value: statusCounts.completed ?? 0 },
        { label: "Saved XIs", value: summary.savedLineupCount ?? 0 }
      ];

      summaryGridEl.innerHTML = stats.map(item =>
        '<div class="summary-stat">'
          + '<span class="summary-label">' + escapeHtml(item.label) + "</span>"
          + '<strong class="summary-value">' + escapeHtml(item.value) + "</strong>"
        + "</div>"
      ).join("");

      const nextMatch = summary.nextScheduledMatch;
      const nextText = nextMatch
        ? "Next: " + nextMatch.teamAName + " vs " + nextMatch.teamBName + " at " + formatDateTime(nextMatch.startAt) + "."
        : "No scheduled starts queued.";
      summaryNoteEl.textContent =
        nextText + " Uptime: " + formatDuration(summary.uptimeSeconds) + ". Teams loaded: " + (summary.teamCount || 0) + ".";
    }

    function renderActiveMatchList(activeMatches, selectedMatch) {
      if (!Array.isArray(activeMatches) || activeMatches.length === 0) {
        activeMatchListEl.innerHTML = "<p class='note'>No active matches right now.</p>";
        return;
      }

      activeMatchListEl.innerHTML = activeMatches.map(match => {
        const isSelected = match.matchId === selectedMatch?.matchId;
        const teams = getTeamLabel(match, "A") + " vs " + getTeamLabel(match, "B");
        const currentOver = match.lastBall || (match.over !== undefined && match.ball !== undefined ? (match.over + "." + match.ball) : "Awaiting first ball");
        const targetText = match.target !== null && match.target !== undefined ? "Target " + match.target : "First innings";

        return (
          '<button type="button" class="active-match-card' + (isSelected ? " selected" : "") + '" data-match-id="' + escapeHtml(match.matchId) + '">'
            + '<div class="active-match-card-header">'
              + "<div>"
                + "<h4>" + escapeHtml(match.matchId) + "</h4>"
                + "<p>" + escapeHtml(teams) + "</p>"
              + "</div>"
              + '<span class="pill ' + escapeHtml(match.status || "running") + '">' + escapeHtml(match.status || "running") + "</span>"
            + "</div>"
            + '<div class="active-match-meta">'
              + "<span>" + escapeHtml(match.matchType || "-") + "</span>"
              + "<span>Score " + escapeHtml(match.score || "0/0") + "</span>"
              + "<span>Over " + escapeHtml(currentOver) + "</span>"
              + "<span>" + escapeHtml(targetText) + "</span>"
            + "</div>"
          + "</button>"
        );
      }).join("");

      document.querySelectorAll(".active-match-card[data-match-id]").forEach(button => {
        button.addEventListener("click", event => {
          selectedActiveMatchId = event.currentTarget.dataset.matchId;
          if (lastStatusData) {
            renderStatus(lastStatusData);
          }
        });
      });
    }

    function buildInfoItem(label, value, subtle = false) {
      return (
        '<div class="match-info-item">'
          + '<span class="match-info-label">' + escapeHtml(label) + "</span>"
          + '<span class="match-info-value' + (subtle ? " subtle" : "") + '">' + escapeHtml(value) + "</span>"
        + "</div>"
      );
    }

    function renderSelectedMatch(match) {
      if (!match) {
        currentMatchPanel.innerHTML = "<p class='note'>No match is running right now.</p>";
        pauseButton.disabled = true;
        resumeButton.disabled = true;
        abortButton.disabled = true;
        return;
      }

      const teams = getTeamLabel(match, "A") + " vs " + getTeamLabel(match, "B");
      const currentOver = match.lastBall || (match.over !== undefined && match.ball !== undefined ? (match.over + "." + match.ball) : "-");
      const targetText = match.target !== null && match.target !== undefined ? match.target : "Set after innings 1";
      const updatedAt = formatDateTime(match.updatedAt || match.startedAt);

      currentMatchPanel.innerHTML =
        '<div class="match-info-grid">'
          + buildInfoItem("Match ID", match.matchId)
          + buildInfoItem("Fixture", teams, true)
          + buildInfoItem("Format", match.matchType || "-")
          + buildInfoItem("Score", match.score || "0/0")
          + buildInfoItem("Current Over", currentOver)
          + buildInfoItem("Target", targetText)
          + buildInfoItem("Status", match.status || "running")
          + buildInfoItem("Updated", updatedAt, true)
        + "</div>";

      pauseButton.disabled = match.status !== "running";
      resumeButton.disabled = match.status !== "paused";
      abortButton.disabled = match.status !== "running" && match.status !== "paused";
    }

    function renderStatus(data) {
      lastStatusData = data || null;
      const activeMatches = Array.isArray(data?.activeMatches) ? data.activeMatches : [];
      const selectedMatch = syncSelectedActiveMatch(activeMatches);
      const badge = buildServerBadge(activeMatches, data?.summary);

      renderSummary(data?.summary || null);
      renderActiveMatchList(activeMatches, selectedMatch);
      renderSelectedMatch(selectedMatch);

      serverStatus.textContent = badge.label;
      serverStatus.className = "status-badge " + badge.statusClass;
    }

    function sortByDate(items, field, direction = "desc") {
      const multiplier = direction === "asc" ? 1 : -1;
      return [...items].sort((a, b) => {
        const left = new Date(a?.[field] || a?.startAt || a?.createdAt || a?.startTime || 0).getTime();
        const right = new Date(b?.[field] || b?.startAt || b?.createdAt || b?.startTime || 0).getTime();
        return (left - right) * multiplier;
      });
    }

    function renderScheduled(scheduledData) {
      if (!Array.isArray(scheduledData) || scheduledData.length === 0) {
        scheduledListEl.innerHTML = "<p class='note'>No scheduled matches</p>";
        return;
      }

      const sorted = sortByDate(scheduledData, "startAt", "asc");
      scheduledListEl.innerHTML = sorted.map((item, index) => {
        const startText = item.startAt ? formatDateTime(item.startAt) : "Immediate";
        return (
          '<div class="match-card" style="animation-delay:' + (index * 50) + 'ms">'
            + "<div>"
              + "<h4>" + escapeHtml(item.matchId) + "</h4>"
              + "<p>" + escapeHtml((item.teamA || item.teamAName || "Team A") + " vs " + (item.teamB || item.teamBName || "Team B")) + "</p>"
              + "<p>Start: " + escapeHtml(startText) + "</p>"
            + "</div>"
            + "<div>"
              + '<span class="pill scheduled">scheduled</span>'
              + '<button data-id="' + escapeHtml(item.id) + '" class="btn btn-danger btn-sm">Cancel</button>'
            + "</div>"
          + "</div>"
        );
      }).join("");

      document.querySelectorAll(".btn-danger[data-id]").forEach(button => {
        button.addEventListener("click", async event => {
          try {
            const id = Number(event.currentTarget.dataset.id);
            await postJson("/api/cancel", { id });
            await refresh();
          } catch (error) {
            alert(error.message);
          }
        });
      });
    }

    function renderCompletedMatches(historyData) {
      if (!Array.isArray(historyData) || historyData.length === 0) {
        completedMatchesListEl.innerHTML = "<p class='note'>No finished or interrupted matches yet</p>";
        return;
      }

      const sorted = sortByDate(historyData, "updatedAt", "desc");
      completedMatchesListEl.innerHTML = sorted.map((item, index) => {
        const startText = item.startAt ? formatDateTime(item.startAt) : formatDateTime(item.startTime);
        const detail = item.resultSummary || item.errorMessage || "No result summary recorded.";
        const status = item.status || "completed";

        return (
          '<div class="match-card" style="animation-delay:' + (index * 50) + 'ms">'
            + "<div>"
              + "<h4>" + escapeHtml(item.matchId) + "</h4>"
              + "<p>" + escapeHtml((item.teamA || item.teamAName || "Team A") + " vs " + (item.teamB || item.teamBName || "Team B")) + "</p>"
              + "<p>" + escapeHtml((item.matchType || "-") + " | " + startText) + "</p>"
              + "<p>" + escapeHtml(detail) + "</p>"
            + "</div>"
            + "<div>"
              + '<span class="pill ' + escapeHtml(status) + '">' + escapeHtml(status) + "</span>"
            + "</div>"
          + "</div>"
        );
      }).join("");
    }

    function renderLog(logItems) {
      if (!Array.isArray(logItems) || logItems.length === 0) {
        liveLog.innerHTML = "<div class='log-entry'>Activity log is empty</div>";
        return;
      }

      liveLog.innerHTML = logItems.map((item, index) =>
        '<div class="log-entry" style="animation-delay:' + (index * 100) + 'ms">['
        + escapeHtml(item.timestamp) + "] " + escapeHtml(item.message) + "</div>"
      ).join("");
    }

    async function refresh() {
      try {
        const [statusRes, matchesRes] = await Promise.all([fetch("/api/status"), fetch("/api/matches")]);
        const statusData = await statusRes.json();
        const matchRegistry = await matchesRes.json();
        const entries = matchRegistry ? Object.values(matchRegistry) : [];
        const scheduledEntries = entries.filter(item => item.status === "scheduled");
        const historyEntries = entries.filter(item => !["scheduled", "running", "paused"].includes(item.status));

        renderStatus(statusData);
        renderScheduled(scheduledEntries);
        renderCompletedMatches(historyEntries);
        renderLog(statusData.liveLogs);
      } catch (error) {
        serverStatus.textContent = "offline";
        serverStatus.className = "status-badge failed";
        scheduledListEl.innerHTML = '<p class="note">Error loading data: ' + escapeHtml(error.message) + "</p>";
        completedMatchesListEl.innerHTML = '<p class="note">Error loading data: ' + escapeHtml(error.message) + "</p>";
        summaryNoteEl.textContent = "Unable to load dashboard summary right now.";
      }
    }

    document.getElementById("matchForm").addEventListener("submit", async event => {
      event.preventDefault();
      const formData = new FormData(event.target);
      const payload = {
        matchType: formData.get("matchType"),
        overs: Number(formData.get("overs")),
        teamA: formData.get("teamA"),
        teamB: formData.get("teamB"),
        teamAPlayingXI: [...selectionState.teamA],
        teamBPlayingXI: [...selectionState.teamB],
        delayMs: Number(formData.get("delayMs")),
        startAt: formData.get("startAt") || null
      };

      if (payload.teamA === payload.teamB) {
        alert("Please select two different teams.");
        return;
      }

      if (payload.teamAPlayingXI.length !== 11 || payload.teamBPlayingXI.length !== 11) {
        alert("Please select exactly 11 players for both teams.");
        return;
      }

      try {
        const result = await postJson("/api/schedule", payload);
        alert(result.message || "Match scheduled.");
        await refresh();
      } catch (error) {
        alert(error.message);
      }
    });

    pauseButton.addEventListener("click", async () => {
      try {
        await postJson("/api/pause", { matchId: getSelectedMatchId() });
        await refresh();
      } catch (error) {
        alert(error.message);
      }
    });

    resumeButton.addEventListener("click", async () => {
      try {
        await postJson("/api/resume", { matchId: getSelectedMatchId() });
        await refresh();
      } catch (error) {
        alert(error.message);
      }
    });

    abortButton.addEventListener("click", async () => {
      try {
        await postJson("/api/abort", { matchId: getSelectedMatchId() });
        await refresh();
      } catch (error) {
        alert(error.message);
      }
    });

    clearLogsButton.addEventListener("click", async () => {
      try {
        await postJson("/api/clear-logs");
        await refresh();
      } catch (error) {
        alert(error.message);
      }
    });

    teamASelect.addEventListener("change", () => {
      resetSelection("teamA", teamASelect.value);
      renderLineups();
      updateFormState();
    });

    teamBSelect.addEventListener("change", () => {
      resetSelection("teamB", teamBSelect.value);
      renderLineups();
      updateFormState();
    });

    matchTypeSelect.addEventListener("change", () => {
      const selected = matchTypes.find(item => item.key === matchTypeSelect.value);
      if (selected) {
        oversInput.value = selected.overs;
      }
    });

    document.getElementById("saveLineupA").addEventListener("click", async () => {
      if (selectionState.teamA.length !== 11) {
        alert("Select exactly 11 players to save.");
        return;
      }

      try {
        await postJson("/api/save-lineup", {
          teamName: teamASelect.value,
          lineupIds: selectionState.teamA
        });
        alert("Lineup saved for " + teamASelect.value);
        await fetchLineups();
      } catch (error) {
        alert(error.message);
      }
    });

    document.getElementById("saveLineupB").addEventListener("click", async () => {
      if (selectionState.teamB.length !== 11) {
        alert("Select exactly 11 players to save.");
        return;
      }

      try {
        await postJson("/api/save-lineup", {
          teamName: teamBSelect.value,
          lineupIds: selectionState.teamB
        });
        alert("Lineup saved for " + teamBSelect.value);
        await fetchLineups();
      } catch (error) {
        alert(error.message);
      }
    });

    async function init() {
      await fetchLineups();
      resetSelection("teamA", teamASelect.value);
      resetSelection("teamB", teamBSelect.value);
      renderLineups();
      updateFormState();
      await refresh();
      setInterval(refresh, 3000);
    }

    init();
`;
