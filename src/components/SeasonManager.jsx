import { useState, useEffect } from "react";

// ── Round-robin schedule generator ────────────────────────────────────────────
// Returns array of rounds, each round is array of [playerA, playerB] matchups.
// Uses the standard "rotate" algorithm for balanced round-robin.
// With N players (even), each round has N/2 matches.
// With N players (odd), add a "bye" player, each round has (N-1)/2 matches.
function generateRoundRobin(playerIds) {
  const ids = [...playerIds];
  const hasBye = ids.length % 2 !== 0;
  if (hasBye) ids.push("BYE");
  const n = ids.length;
  const rounds = [];

  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i];
      const b = ids[n - 1 - i];
      if (a !== "BYE" && b !== "BYE") {
        round.push([a, b]);
      }
    }
    rounds.push(round);
    // Rotate all except ids[0]
    ids.splice(1, 0, ids.pop());
  }
  return rounds;
}

// Distribute rounds into weeks of exactly 3 matches each.
// Repeats the round-robin cycle as needed to fill all weeks.
// Returns: array of weeks, each week is array of [p1, p2] pairs (exactly 3).
function buildWeeklySchedule(playerIds, numWeeks) {
  // Generate one full cycle of round-robin rounds
  const rounds = generateRoundRobin(playerIds);

  // Flatten all matchups across rounds, cycling as needed
  const allMatchups = [];
  let cycleCount = 0;
  while (allMatchups.length < numWeeks * 3) {
    const round = rounds[cycleCount % rounds.length];
    // Spread round matchups into allMatchups one by one
    for (const pair of round) {
      allMatchups.push(pair);
      if (allMatchups.length >= numWeeks * 3) break;
    }
    cycleCount++;
  }

  // Chunk into weeks of 3
  const weeks = [];
  for (let w = 0; w < numWeeks; w++) {
    weeks.push(allMatchups.slice(w * 3, w * 3 + 3));
  }
  return weeks;
}

export default function SeasonManager({ supabase, players, navigate }) {
  const [view, setView]       = useState("list");  // "list" | "create" | "detail"
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSeason, setActiveSeason] = useState(null);

  // Create form state
  const [step, setStep]             = useState(1); // 1=name, 2=players, 3=weeks, 4=confirm
  const [seasonName, setSeasonName] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [numWeeks, setNumWeeks]     = useState(8);
  const [creating, setCreating]     = useState(false);
  const [createError, setCreateError] = useState("");

  // Detail view state
  const [detailSeason, setDetailSeason]   = useState(null);
  const [schedule, setSchedule]           = useState([]); // [{week, matches:[{id,p1,p2,status,winner}]}]
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [standings, setStandings]         = useState([]);

  useEffect(() => {
    loadSeasons();
  }, []);

  const loadSeasons = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("seasons")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setSeasons(data);
    setLoading(false);
  };

  // ── Create season ──────────────────────────────────────────────────────────
  const resetCreate = () => {
    setStep(1);
    setSeasonName("");
    setSelectedPlayers([]);
    setNumWeeks(8);
    setCreateError("");
  };

  const togglePlayer = (id) => {
    setSelectedPlayers(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const createSeason = async () => {
    if (selectedPlayers.length < 2) {
      setCreateError("Need at least 2 players.");
      return;
    }
    setCreating(true);
    setCreateError("");

    // 1. Insert season
    const { data: season, error: sErr } = await supabase
      .from("seasons")
      .insert({ name: seasonName.trim(), weeks: numWeeks })
      .select()
      .single();
    if (sErr) { setCreateError(sErr.message); setCreating(false); return; }

    // 2. Insert season_players
    await supabase.from("season_players").insert(
      selectedPlayers.map(pid => ({ season_id: season.id, player_id: pid }))
    );

    // 3. Generate weekly schedule
    const weeks = buildWeeklySchedule(selectedPlayers, numWeeks);

    // 4. Create matches and schedule rows for each week
    for (let w = 0; w < weeks.length; w++) {
      const weekMatches = weeks[w];
      for (const [p1id, p2id] of weekMatches) {
        const { data: match } = await supabase
          .from("matches")
          .insert({
            game_type: "501", // placeholder — actual game type chosen at play time
            legs_to_win: 3,
            player1_id: p1id,
            player2_id: p2id,
            season_id: season.id,
          })
          .select()
          .single();

        if (match) {
          await supabase.from("season_schedule").insert({
            season_id: season.id,
            week_number: w + 1,
            match_id: match.id,
          });
        }
      }
    }

    setCreating(false);
    resetCreate();
    setView("list");
    loadSeasons();
  };

  // ── Load season detail ─────────────────────────────────────────────────────
  const openSeason = async (season) => {
    setDetailSeason(season);
    setView("detail");
    setScheduleLoading(true);

    // Load schedule with match + player details
    const { data: schedRows } = await supabase
      .from("season_schedule")
      .select(`
        week_number,
        match_id,
        match:match_id (
          id, status, player1_id, player2_id, player1_legs, player2_legs, winner_id,
          p1:player1_id(id, name),
          p2:player2_id(id, name),
          winner:winner_id(name)
        )
      `)
      .eq("season_id", season.id)
      .order("week_number", { ascending: true });

    if (schedRows) {
      // Group by week
      const weekMap = {};
      for (const row of schedRows) {
        const w = row.week_number;
        if (!weekMap[w]) weekMap[w] = [];
        weekMap[w].push(row.match);
      }
      const built = Object.entries(weekMap)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([week, matches]) => ({ week: Number(week), matches }));
      setSchedule(built);

      // Build standings from completed matches
      const playerMap = {};
      for (const { matches } of built) {
        for (const m of matches) {
          if (!m || m.status !== "completed") continue;
          [m.player1_id, m.player2_id].forEach(pid => {
            if (!playerMap[pid]) playerMap[pid] = { wins: 0, losses: 0, legs_for: 0, legs_against: 0, name: "" };
          });
          playerMap[m.player1_id].name = m.p1?.name || "";
          playerMap[m.player2_id].name = m.p2?.name || "";
          const p1won = m.winner_id === m.player1_id;
          playerMap[m.player1_id].wins      += p1won ? 1 : 0;
          playerMap[m.player1_id].losses    += p1won ? 0 : 1;
          playerMap[m.player1_id].legs_for  += m.player1_legs || 0;
          playerMap[m.player1_id].legs_against += m.player2_legs || 0;
          playerMap[m.player2_id].wins      += p1won ? 0 : 1;
          playerMap[m.player2_id].losses    += p1won ? 1 : 0;
          playerMap[m.player2_id].legs_for  += m.player2_legs || 0;
          playerMap[m.player2_id].legs_against += m.player1_legs || 0;
        }
      }

      // Also include players who haven't played yet
      const { data: spRows } = await supabase
        .from("season_players")
        .select("player_id, player:player_id(id, name)")
        .eq("season_id", season.id);
      if (spRows) {
        for (const sp of spRows) {
          if (!playerMap[sp.player_id]) {
            playerMap[sp.player_id] = { wins: 0, losses: 0, legs_for: 0, legs_against: 0, name: sp.player?.name || "" };
          }
          if (!playerMap[sp.player_id].name) playerMap[sp.player_id].name = sp.player?.name || "";
        }
      }

      const sorted = Object.entries(playerMap)
        .map(([id, s]) => ({ id, ...s }))
        .sort((a, b) => b.wins - a.wins || (b.legs_for - b.legs_against) - (a.legs_for - a.legs_against));
      setStandings(sorted);
    }

    setScheduleLoading(false);
  };

  const startSeasonMatch = async (match) => {
    // Create the first leg for this match
    const { data: leg } = await supabase
      .from("legs")
      .insert({
        match_id: match.id,
        leg_number: 1,
        starting_score: null,
        game_type: null,
      })
      .select()
      .single();

    if (leg) navigate("active", { match, currentLeg: leg });
  };

  const resumeSeasonMatch = async (match) => {
    const { data: legs } = await supabase
      .from("legs")
      .select("*")
      .eq("match_id", match.id)
      .order("leg_number", { ascending: true });
    const currentLeg = legs?.find(l => l.status !== "completed") || legs?.[legs.length - 1];
    if (currentLeg) navigate("active", { match, currentLeg });
  };

  // ── Preview schedule ───────────────────────────────────────────────────────
  const previewWeeks = selectedPlayers.length >= 2
    ? buildWeeklySchedule(selectedPlayers, numWeeks)
    : [];

  const getPlayerName = (id) => players.find(p => p.id === id)?.name || id;

  // ── Render ─────────────────────────────────────────────────────────────────

  // LIST
  if (view === "list") {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigate("admin")}>← Back</button>
          <h2>🏆 Seasons</h2>
        </div>

        <button className="btn-primary big-btn" onClick={() => { resetCreate(); setView("create"); }}>
          + New Season
        </button>

        {loading && <div className="loading">Loading...</div>}

        {!loading && seasons.length === 0 && (
          <div className="empty-state">No seasons yet. Create one to get started.</div>
        )}

        {seasons.map(s => (
          <div key={s.id} className="admin-match-row" style={{ cursor: "pointer" }}
            onClick={() => openSeason(s)}>
            <div className="admin-match-info">
              <div className="admin-match-players">{s.name}</div>
              <div className="admin-match-meta">{s.weeks} weeks · {s.status}</div>
            </div>
            <span className={`status-badge ${s.status}`}>
              {s.status === "active" ? "Active" : "Completed"}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // CREATE — multi-step
  if (view === "create") {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setView("list")}>← Back</button>
          <h2>New Season</h2>
        </div>

        {/* Step indicators */}
        <div className="season-steps">
          {["Name","Players","Weeks","Confirm"].map((label, i) => (
            <div key={i} className={`season-step ${step === i+1 ? "active" : ""} ${step > i+1 ? "done" : ""}`}>
              <span className="step-num">{i+1}</span>
              <span className="step-label">{label}</span>
            </div>
          ))}
        </div>

        {/* Step 1: Name */}
        {step === 1 && (
          <div className="form-section">
            <label className="form-label">Season Name</label>
            <input
              className="select-input"
              type="text"
              placeholder="e.g. Spring 2026"
              value={seasonName}
              onChange={e => setSeasonName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && seasonName.trim() && setStep(2)}
              autoFocus
            />
            <button
              className="btn-primary big-btn"
              style={{ marginTop: "1rem" }}
              onClick={() => setStep(2)}
              disabled={!seasonName.trim()}
            >
              Next →
            </button>
          </div>
        )}

        {/* Step 2: Players */}
        {step === 2 && (
          <div className="form-section">
            <label className="form-label">Select Players ({selectedPlayers.length} selected)</label>
            <div className="player-select-grid">
              {players.map(p => (
                <button
                  key={p.id}
                  className={`player-select-btn ${selectedPlayers.includes(p.id) ? "selected" : ""}`}
                  onClick={() => togglePlayer(p.id)}
                >
                  {selectedPlayers.includes(p.id) ? "✓ " : ""}{p.name}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button className="btn-secondary big-btn" onClick={() => setStep(1)}>← Back</button>
              <button
                className="btn-primary big-btn"
                onClick={() => setStep(3)}
                disabled={selectedPlayers.length < 2}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Weeks */}
        {step === 3 && (
          <div className="form-section">
            <label className="form-label">Number of Weeks</label>
            <div className="weeks-grid">
              {[4,6,8,10,12,16].map(w => (
                <button
                  key={w}
                  className={`weeks-btn ${numWeeks === w ? "selected" : ""}`}
                  onClick={() => setNumWeeks(w)}
                >
                  {w}
                </button>
              ))}
            </div>
            <p className="form-sub">
              {numWeeks * 3} total matches · {selectedPlayers.length} players
            </p>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button className="btn-secondary big-btn" onClick={() => setStep(2)}>← Back</button>
              <button className="btn-primary big-btn" onClick={() => setStep(4)}>Preview →</button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm + preview */}
        {step === 4 && (
          <div className="form-section">
            <div className="season-summary-card">
              <div className="season-summary-name">{seasonName}</div>
              <div className="season-summary-meta">
                {selectedPlayers.length} players · {numWeeks} weeks · {numWeeks * 3} matches
              </div>
            </div>

            <div className="schedule-preview">
              {previewWeeks.slice(0, 3).map((week, wi) => (
                <div key={wi} className="preview-week">
                  <div className="preview-week-label">Week {wi + 1}</div>
                  {week.map(([a, b], mi) => (
                    <div key={mi} className="preview-match">
                      {getPlayerName(a)} <span className="vs-small">vs</span> {getPlayerName(b)}
                    </div>
                  ))}
                </div>
              ))}
              {numWeeks > 3 && (
                <div className="preview-more">+ {numWeeks - 3} more weeks...</div>
              )}
            </div>

            {createError && <div className="error-msg">{createError}</div>}

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button className="btn-secondary big-btn" onClick={() => setStep(3)}>← Back</button>
              <button
                className="btn-primary big-btn"
                onClick={createSeason}
                disabled={creating}
              >
                {creating ? "Creating..." : "🏆 Create Season"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // DETAIL — season schedule + standings
  if (view === "detail" && detailSeason) {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => { setView("list"); loadSeasons(); }}>← Back</button>
          <h2>{detailSeason.name}</h2>
        </div>

        {/* Standings */}
        <div className="season-standings">
          <div className="standings-header">Standings</div>
          <div className="standings-row standings-label-row">
            <span>Player</span>
            <span>W</span>
            <span>L</span>
            <span>Legs</span>
          </div>
          {standings.map((s, i) => (
            <div key={s.id} className={`standings-row ${i === 0 ? "standings-leader" : ""}`}>
              <span className="standings-name">{s.name}</span>
              <span className="standings-stat">{s.wins}</span>
              <span className="standings-stat">{s.losses}</span>
              <span className="standings-stat">{s.legs_for}–{s.legs_against}</span>
            </div>
          ))}
        </div>

        {/* Schedule */}
        {scheduleLoading && <div className="loading">Loading schedule...</div>}

        {schedule.map(({ week, matches }) => (
          <div key={week} className="schedule-week">
            <div className="schedule-week-label">Week {week}</div>
            {matches.map(m => {
              if (!m) return null;
              const done = m.status === "completed";
              const inProg = m.status === "in_progress";
              return (
                <div key={m.id} className={`schedule-match-row ${done ? "done" : ""}`}>
                  <div className="schedule-match-players">
                    <span className={m.winner_id === m.player1_id ? "schedule-winner" : ""}>
                      {m.p1?.name}
                    </span>
                    <span className="vs-small">vs</span>
                    <span className={m.winner_id === m.player2_id ? "schedule-winner" : ""}>
                      {m.p2?.name}
                    </span>
                  </div>
                  <div className="schedule-match-right">
                    {done && (
                      <span className="schedule-score">
                        {m.player1_legs}–{m.player2_legs}
                      </span>
                    )}
                    {!done && (
                      <button
                        className={inProg ? "btn-resume" : "btn-play"}
                        onClick={() => inProg ? resumeSeasonMatch(m) : startSeasonMatch(m)}
                      >
                        {inProg ? "▶ Resume" : "▶ Play"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  return null;
}
