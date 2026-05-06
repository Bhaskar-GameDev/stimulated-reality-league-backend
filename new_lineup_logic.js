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

    /* ── RENDER ONE TEAM'S LINEUP ── */
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

      /* ── Playing XI (ordered draft) ── */
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

      /* ── Bench / Squad (searchable checklist) ── */
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
