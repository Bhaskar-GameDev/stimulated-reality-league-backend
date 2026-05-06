module.exports = `
    const { teamData, matchTypes } = window.__APP_DATA__;
    const scheduledListEl = document.getElementById("scheduledList");
    const completedMatchesListEl = document.getElementById("completedMatchesList");
    const currentMatchPanel = document.getElementById("currentMatchPanel");
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
    const selectionState = {
      teamA: [],
      teamB: []
    };

    const genderToggle = document.getElementById("genderToggle");
    const searchA = document.getElementById("searchA");
    const searchB = document.getElementById("searchB");

    function updateTeamDropdowns() {
      const gender = genderToggle.value;
      const filteredTeams = teamData.filter(t => t.gender === gender);
      
      const html = filteredTeams.map((team, index) => 
        '<option value="' + team.name + '">' + team.name + '</option>'
      ).join('');
      
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

    searchA.addEventListener("input", (e) => filterList(e.target, "lineupA"));
    searchB.addEventListener("input", (e) => filterList(e.target, "lineupB"));

    let savedLineups = {};

    async function fetchLineups() {
      try {
        const res = await fetch("/api/lineups");
        savedLineups = await res.json();
      } catch (e) { console.error("Failed to load lineups"); }
    }

    function getTeamPlayers(teamName) {
      return teamData.find(team => team.name === teamName)?.players || [];
    }

    function resetSelection(side, teamName) {
      const saved = savedLineups[teamName];
      const players = getTeamPlayers(teamName);
      const validIds = new Set(players.map(p => p.id));
      if (saved && Array.isArray(saved) && saved.length === 11 && saved.every(id => validIds.has(id))) {
        selectionState[side] = [...saved];
      } else {
        selectionState[side] = players.slice(0, 11).map(p => p.id);
      }
    }

    function sanitizeSelection(side, teamName) {
      const validIds = new Set(getTeamPlayers(teamName).map(p => p.id));
      selectionState[side] = (selectionState[side] || []).filter((id, idx, arr) =>
        validIds.has(id) && arr.indexOf(id) === idx
      );
    }

    /* RENDER ONE TEAM'S LINEUP */
    function renderOneTeam(side, teamName) {
      const players   = getTeamPlayers(teamName);
      sanitizeSelection(side, teamName);
      const selected  = selectionState[side];       // ordered array of IDs in playing XI
      const selectedSet = new Set(selected);

      const nameEl  = document.getElementById("lineup" + (side === "teamA" ? "A" : "B") + "Name");
      const countEl = document.getElementById("lineup" + (side === "teamA" ? "A" : "B") + "Count");
      const playEl  = document.getElementById("playing" + (side === "teamA" ? "A" : "B"));
      const benchEl = document.getElementById("lineup"  + (side === "teamA" ? "A" : "B"));
      const searchId = "search" + (side === "teamA" ? "A" : "B");

      nameEl.textContent  = teamName || "Select a team";
      countEl.textContent = selected.length + "/11 selected";
      countEl.className   = "selection-count " + (selected.length === 11 ? "valid" : "invalid");

      /* Playing XI (ordered draft) */
      const playerMap = Object.fromEntries(players.map(p => [p.id, p]));
      playEl.innerHTML = selected.map((id, idx) => {
        const p    = playerMap[id];
        if (!p) return "";
        const meta = [p.role, p.type].filter(Boolean).join(" \u2022 ");
        const roleColor = {
          Batsman: "#1a73e8", Bowler: "#e53935", Allrounder: "#43a047", "Wicket-keeper": "#fb8c00"
        }[p.role] || "#666";
        return (
          '<li style="display:flex;align-items:center;gap:0.5rem;padding:0.55rem 0.6rem;'
          + 'border:1px solid #e0e0e0;margin-bottom:0.3rem;border-radius:8px;background:#fff;'
          + 'box-shadow:0 1px 3px rgba(0,0,0,.06);">'
            + '<span style="font-size:0.75rem;font-weight:700;color:#888;min-width:18px;text-align:center;">' + (idx+1) + '</span>'
            + '<div style="display:flex;flex-direction:column;gap:1px;">'
              + '<button type="button" class="order-btn" data-side="' + side + '" data-dir="up" data-index="' + idx + '" '
              + 'style="background:none;border:none;cursor:pointer;padding:0;line-height:1;font-size:0.85rem;" title="Move up">\u25b2</button>'
              + '<button type="button" class="order-btn" data-side="' + side + '" data-dir="down" data-index="' + idx + '" '
              + 'style="background:none;border:none;cursor:pointer;padding:0;line-height:1;font-size:0.85rem;" title="Move down">\u25bc</button>'
            + '</div>'
            + '<div style="flex:1;overflow:hidden;">'
              + '<div class="player-name" style="font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + p.name + '</div>'
              + '<div style="font-size:0.75rem;color:' + roleColor + ';font-weight:500;">' + meta + '</div>'
            + '</div>'
            + '<button type="button" class="remove-btn" data-side="' + side + '" data-id="' + id + '" '
            + 'style="background:#fee2e2;color:#dc2626;border:none;border-radius:6px;padding:0.2rem 0.55rem;'
            + 'font-size:0.78rem;font-weight:700;cursor:pointer;white-space:nowrap;" title="Remove from XI">\u2715</button>'
          + '</li>'
        );
      }).join('');

      /* Bench / Squad (searchable checklist) */
      const term  = (document.getElementById(searchId)?.value || "").toLowerCase();
      const bench = players.filter(p => !selectedSet.has(p.id));
      benchEl.innerHTML = bench.map(p => {
        const meta = [p.role, p.type].filter(Boolean).join(" \u2022 ");
        const hidden = term && !p.name.toLowerCase().includes(term) ? ' style="display:none;"' : '';
        const full   = selected.length >= 11;
        const roleColor = {
          Batsman: "#1a73e8", Bowler: "#e53935", Allrounder: "#43a047", "Wicket-keeper": "#fb8c00"
        }[p.role] || "#666";
        return (
          '<li' + hidden + ' style="display:flex;align-items:center;justify-content:space-between;'
          + 'padding:0.5rem 0.6rem;border:1px solid #e0e0e0;margin-bottom:0.3rem;border-radius:8px;'
          + 'background:#fafafa;">'
            + '<div>'
              + '<div class="player-name" style="font-weight:600;font-size:0.88rem;">' + p.name + '</div>'
              + '<div style="font-size:0.75rem;color:' + roleColor + ';font-weight:500;">' + meta + '</div>'
            + '</div>'
            + '<button type="button" class="add-btn" data-side="' + side + '" data-id="' + p.id + '" '
            + (full ? 'disabled ' : '')
            + 'style="background:' + (full ? '#d1fae5' : '#d1fae5') + ';color:' + (full ? '#9ca3af' : '#059669') + ';'
            + 'border:none;border-radius:6px;padding:0.2rem 0.55rem;font-size:0.78rem;font-weight:700;'
            + 'cursor:' + (full ? 'not-allowed' : 'pointer') + ';white-space:nowrap;" title="Add to XI">+ ADD</button>'
          + '</li>'
        );
      }).join('');
    }

    function renderLineups() {
      renderOneTeam("teamA", teamASelect.value);
      renderOneTeam("teamB", teamBSelect.value);
      bindLineupEvents();
    }

    function bindLineupEvents() {
      document.querySelectorAll(".add-btn").forEach(btn => {
        btn.addEventListener("click", e => {
          const { side, id } = e.currentTarget.dataset;
          if (selectionState[side].length >= 11) { alert("Only 11 players allowed."); return; }
          selectionState[side].push(id);
          renderLineups();
          updateFormState();
        });
      });

      document.querySelectorAll(".remove-btn").forEach(btn => {
        btn.addEventListener("click", e => {
          const { side, id } = e.currentTarget.dataset;
          selectionState[side] = selectionState[side].filter(pid => pid !== id);
          renderLineups();
          updateFormState();
        });
      });

      document.querySelectorAll(".order-btn").forEach(btn => {
        btn.addEventListener("click", e => {
          const { side, dir, index } = e.currentTarget.dataset;
          const arr = selectionState[side];
          const i   = Number(index);
          if (dir === "up"   && i > 0)              { [arr[i-1], arr[i]] = [arr[i], arr[i-1]]; }
          if (dir === "down" && i < arr.length - 1) { [arr[i], arr[i+1]] = [arr[i+1], arr[i]]; }
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

    function renderStatus(data) {
      const match = data?.currentMatch;
      if (!match) {
        currentMatchPanel.innerHTML = "<p class='note'>No match is running right now.</p>";
        serverStatus.textContent = "idle";
        serverStatus.className = "badge idle";
        pauseButton.disabled = true;
        resumeButton.disabled = true;
        abortButton.disabled = true;
        return;
      }

      const statusClass = match.status || "idle";
      serverStatus.textContent = match.status || "idle";
      serverStatus.className = "badge " + statusClass + (statusClass === "running" ? " glow" : "");
      currentMatchPanel.innerHTML =
        '<p><strong>' + match.matchId + '</strong></p>' +
        '<p>' + (match.teamAName || match.teamA || "Team A") + ' vs ' + (match.teamBName || match.teamB || "Team B") + '</p>' +
        '<p>Type: ' + (match.matchType || "-") + '</p>' +
        '<p>Overs: ' + (match.overs || "-") + ' | Delay: ' + (match.delayMs || "-") + 'ms</p>' +
        '<p>Score: ' + (match.score || "0/0") + '</p>' +
        '<p>Target: ' + (match.target ?? "-") + '</p>' +
        '<p>Last ball: ' + (match.lastBall || "-") + '</p>' +
        '<p>Started at: ' + (match.startedAt || "-") + '</p>';
      pauseButton.disabled = match.status !== "running";
      resumeButton.disabled = match.status !== "paused";
      abortButton.disabled = match.status !== "running" && match.status !== "paused";
    }

    async function refresh() {
      try {
        const [statusRes, matchesRes] = await Promise.all([fetch("/api/status"), fetch("/api/matches")]);
        const statusData = await statusRes.json();
        const matchRegistry = await matchesRes.json();
        const entries = matchRegistry ? Object.values(matchRegistry) : [];
        renderStatus(statusData);
        renderScheduled(entries.filter(item => item.status === "scheduled"));
        renderCompletedMatches(entries.filter(item => item.status === "completed"));
        renderLog(statusData.liveLogs);
      } catch (error) {
        scheduledListEl.innerHTML = '<p class="note">Error loading data: ' + error.message + '</p>';
        completedMatchesListEl.innerHTML = '<p class="note">Error loading data: ' + error.message + '</p>';
      }
    }

    function renderScheduled(scheduledData) {
      if (!Array.isArray(scheduledData) || scheduledData.length === 0) {
        scheduledListEl.innerHTML = "<p class='note'>No scheduled matches</p>";
        return;
      }

      scheduledListEl.innerHTML = scheduledData.map((item, index) => {
        const startText = item.startAt ? new Date(item.startAt).toLocaleString() : "Immediate";
        const button = item.status === "scheduled"
          ? '<button data-id="' + item.id + '" class="btn btn-danger btn-sm">Cancel</button>'
          : '';

        return (
          '<div class="match-card" style="animation-delay:' + (index * 50) + 'ms">' +
            '<div>' +
              '<h4>' + item.matchId + '</h4>' +
              '<p>' + (item.teamA || item.teamAName || "Team A") + ' vs ' + (item.teamB || item.teamBName || "Team B") + '</p>' +
              '<p>Start: ' + startText + '</p>' +
            '</div>' +
            '<div>' +
              '<span class="pill scheduled">' + item.status + '</span>' +
              button +
            '</div>' +
          '</div>'
        );
      }).join("");

      document.querySelectorAll(".btn-danger[data-id]").forEach(button => {
        button.addEventListener("click", async event => {
          const id = Number(event.currentTarget.dataset.id);
          await fetch("/api/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
          });
          refresh();
        });
      });
    }

    function renderCompletedMatches(completedData) {
      if (!Array.isArray(completedData) || completedData.length === 0) {
        completedMatchesListEl.innerHTML = "<p class='note'>No completed matches</p>";
        return;
      }

      completedMatchesListEl.innerHTML = completedData.map((item, index) => {
        const startText = item.startAt ? new Date(item.startAt).toLocaleString() : "Immediate";
        return (
          '<div class="match-card" style="animation-delay:' + (index * 50) + 'ms">' +
            '<div>' +
              '<h4>' + item.matchId + '</h4>' +
              '<p>' + (item.teamA || item.teamAName || "Team A") + ' vs ' + (item.teamB || item.teamBName || "Team B") + '</p>' +
              '<p>' + item.matchType + ' | ' + startText + '</p>' +
            '</div>' +
            '<div>' +
              '<span class="pill completed">Completed</span>' +
            '</div>' +
          '</div>'
        );
      }).join("");
    }

    function renderLog(logItems) {
      if (!Array.isArray(logItems) || logItems.length === 0) {
        liveLog.innerHTML = "<div class='log-entry'>Activity log is empty</div>";
        return;
      }
      liveLog.innerHTML = logItems.map((item, index) =>
        '<div class="log-entry" style="animation-delay:' + (index * 100) + 'ms">[' +
        item.timestamp + '] ' + item.message + '</div>'
      ).join('');
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

      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (!response.ok) {
        alert(result.error || "Unable to schedule match.");
        return;
      }
      alert(result.message);
      refresh();
    });

    pauseButton.addEventListener("click", async () => {
      await fetch("/api/pause", { method: "POST" });
      refresh();
    });

    resumeButton.addEventListener("click", async () => {
      await fetch("/api/resume", { method: "POST" });
      refresh();
    });

    abortButton.addEventListener("click", async () => {
      await fetch("/api/abort", { method: "POST" });
      refresh();
    });

    clearLogsButton.addEventListener("click", async () => {
      await fetch("/api/clear-logs", { method: "POST" });
      refresh();
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
      if (selected) oversInput.value = selected.overs;
    });

    document.getElementById("saveLineupA").addEventListener("click", async () => {
      if (selectionState.teamA.length !== 11) return alert("Select exactly 11 players to save.");
      await fetch("/api/save-lineup", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ teamName: teamASelect.value, lineupIds: selectionState.teamA })
      });
      alert("Lineup saved for " + teamASelect.value);
      fetchLineups();
    });

    document.getElementById("saveLineupB").addEventListener("click", async () => {
      if (selectionState.teamB.length !== 11) return alert("Select exactly 11 players to save.");
      await fetch("/api/save-lineup", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ teamName: teamBSelect.value, lineupIds: selectionState.teamB })
      });
      alert("Lineup saved for " + teamBSelect.value);
      fetchLineups();
    });

    async function init() {
      await fetchLineups();
      resetSelection("teamA", teamASelect.value);
      resetSelection("teamB", teamBSelect.value);
      renderLineups();
      updateFormState();
      refresh();
      setInterval(refresh, 3000);
    }
    
    init();
`;

