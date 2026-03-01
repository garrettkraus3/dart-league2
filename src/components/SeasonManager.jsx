import { useState, useEffect } from "react";

const ADMIN_PASSWORD = "dartsarelife";

// ── Schedule generator ───────────────────────────────────────────────────────
// Each week: every player plays exactly 3 opponents (or 2 if odd player count).
// We build weeks greedily, always pairing players who have played each other least.
function buildWeeklySchedule(playerIds, numWeeks) {
  const n = playerIds.length;
  // Track how many times each pair has played
  const pairCount = {};
  const pairKey = (a, b) => [a, b].sort().join("|");

  const weeks = [];

  for (let w = 0; w < numWeeks; w++) {
    const week = [];
    // Each player should play 3 matches this week; track remaining slots
    const slotsLeft = {};
    playerIds.forEach(p => { slotsLeft[p] = 3; });

    // Build matches greedily: repeatedly find the pair with fewest historical
    // meetings that both still have slots open, until no valid pairs remain.
    let madeProgress = true;
    while (madeProgress) {
      madeProgress = false;
      // Find all valid pairs (both have slots left > 0)
      let bestPair = null;
      let bestCount = Infinity;

      const available = playerIds.filter(p => slotsLeft[p] > 0);
      for (let i = 0; i < available.length; i++) {
        for (let j = i + 1; j < available.length; j++) {
          const a = available[i], b = available[j];
          // Don't play same opponent twice in same week
          const alreadyThisWeek = week.some(
            ([x, y]) => (x === a && y === b) || (x === b && y === a)
          );
          if (alreadyThisWeek) continue;
          const key = pairKey(a, b);
          const cnt = pairCount[key] || 0;
          if (cnt < bestCount) {
            bestCount = cnt;
            bestPair = [a, b];
          }
        }
      }

      if (bestPair) {
        const [a, b] = bestPair;
        week.push([a, b]);
        slotsLeft[a]--;
        slotsLeft[b]--;
        const key = pairKey(a, b);
        pairCount[key] = (pairCount[key] || 0) + 1;
        madeProgress = true;
      }
    }

    weeks.push(week);
  }
  return weeks;
}

export default function SeasonManager({ supabase, players, navigate, setGlobalLoading }) {
  const [view, setView]   = useState("list");
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(false);

  // Auth for creating/deleting
  const [authed, setAuthed]         = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInput, setAuthInput]   = useState("");
  const [authError, setAuthError]   = useState("");
  const [pendingAction, setPendingAction] = useState(null); // "create" | "delete"
  const [pendingDeleteSeason, setPendingDeleteSeason] = useState(null);

  // Create form
  const [step, setStep]             = useState(1);
  const [seasonName, setSeasonName] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [numWeeks, setNumWeeks]     = useState(8);
  const [previewCount, setPreviewCount] = useState(3);
  const [creating, setCreating]     = useState(false);
  const [createError, setCreateError] = useState("");

  // Detail view
  const [detailSeason, setDetailSeason]   = useState(null);
  const [schedule, setSchedule]           = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [standings, setStandings]         = useState([]);
  const [seasonPlayerIds, setSeasonPlayerIds] = useState([]);
  const [confirmDeleteSeason, setConfirmDeleteSeason] = useState(null);

  useEffect(() => { loadSeasons(); }, []);

  const loadSeasons = async () => {
    setLoading(true);
    const { data } = await supabase.from("seasons").select("*").order("created_at", { ascending: false });
    if (data) setSeasons(data);
    setLoading(false);
  };

  // ── Auth modal ─────────────────────────────────────────────────────────────
  const requireAdmin = (action, deleteTarget = null) => {
    if (authed) {
      if (action === "create") { resetCreate(); setView("create"); }
      if (action === "delete") setConfirmDeleteSeason(deleteTarget);
      return;
    }
    setPendingAction(action);
    setPendingDeleteSeason(deleteTarget);
    setShowAuthModal(true);
    setAuthInput("");
    setAuthError("");
  };

  const submitAuth = () => {
    if (authInput === ADMIN_PASSWORD) {
      setAuthed(true);
      setShowAuthModal(false);
      if (pendingAction === "create") { resetCreate(); setView("create"); }
      if (pendingAction === "delete") setConfirmDeleteSeason(pendingDeleteSeason);
    } else {
      setAuthError("Wrong password.");
      setAuthInput("");
    }
  };

  // ── Create season ──────────────────────────────────────────────────────────
  const resetCreate = () => {
    setStep(1);
    setSeasonName("");
    setSelectedPlayers([]);
    setNumWeeks(8);
    setPreviewCount(3);
    setCreateError("");
  };

  const togglePlayer = (id) => {
    setSelectedPlayers(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const previewWeeks = selectedPlayers.length >= 2
    ? buildWeeklySchedule(selectedPlayers, numWeeks)
    : [];

  const matchesPerWeek = previewWeeks[0]?.length || 0;
  const totalMatches   = previewWeeks.reduce((s, w) => s + w.length, 0);

  const createSeason = async () => {
    if (selectedPlayers.length < 2) { setCreateError("Need at least 2 players."); return; }
    setCreating(true);
    setCreateError("");
    setGlobalLoading(true);

    const { data: season, error: sErr } = await supabase
      .from("seasons")
      .insert({ name: seasonName.trim(), weeks: numWeeks })
      .select().single();
    if (sErr) { setCreateError(sErr.message); setCreating(false); return; }

    await supabase.from("season_players").insert(
      selectedPlayers.map(pid => ({ season_id: season.id, player_id: pid }))
    );

    const weeks = buildWeeklySchedule(selectedPlayers, numWeeks);

    for (let w = 0; w < weeks.length; w++) {
      for (const [p1id, p2id] of weeks[w]) {
        const { data: match } = await supabase
          .from("matches")
          .insert({ game_type: "501", legs_to_win: 5, player1_id: p1id, player2_id: p2id, season_id: season.id })
          .select().single();
        if (match) {
          await supabase.from("season_schedule").insert({
            season_id: season.id, week_number: w + 1, match_id: match.id,
          });
        }
      }
    }

    setCreating(false);
    setGlobalLoading(false);
    resetCreate();
    setView("list");
    loadSeasons();
  };

  // ── Delete season ──────────────────────────────────────────────────────────
  const deleteSeason = async (season) => {
    setGlobalLoading(true);
    // Cascade via DB: season_schedule and season_players delete automatically.
    // Matches linked to this season: delete turns, legs, then matches.
    const { data: schedRows } = await supabase
      .from("season_schedule")
      .select("match_id")
      .eq("season_id", season.id);

    if (schedRows) {
      for (const row of schedRows) {
        await supabase.from("turns").delete().eq("match_id", row.match_id);
        await supabase.from("legs").delete().eq("match_id", row.match_id);
        await supabase.from("matches").delete().eq("id", row.match_id);
      }
    }

    await supabase.from("seasons").delete().eq("id", season.id);
    setGlobalLoading(false);
    setConfirmDeleteSeason(null);
    if (view === "detail") setView("list");
    loadSeasons();
  };

  // ── Load season detail ─────────────────────────────────────────────────────
  const openSeason = async (season) => {
    setDetailSeason(season);
    setView("detail");
    setScheduleLoading(true);

    const { data: schedRows } = await supabase
      .from("season_schedule")
      .select(`
        week_number, match_id,
        match:match_id (
          id, status, player1_id, player2_id, player1_legs, player2_legs, winner_id,
          p1:player1_id(id, name), p2:player2_id(id, name), winner:winner_id(name)
        )
      `)
      .eq("season_id", season.id)
      .order("week_number", { ascending: true });

    if (schedRows) {
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

      // Build standings
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
      const { data: spRows } = await supabase
        .from("season_players")
        .select("player_id, player:player_id(id, name)")
        .eq("season_id", season.id);
      if (spRows) {
        setSeasonPlayerIds(spRows.map(sp => sp.player_id));
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

  // ── Start / resume match ───────────────────────────────────────────────────
  const startSeasonMatch = async (m) => {
    const { data: leg } = await supabase
      .from("legs")
      .insert({ match_id: m.id, leg_number: 1, starting_score: null, game_type: null })
      .select().single();
    if (leg) navigate("active", { match: m, currentLeg: leg });
  };

  const resumeSeasonMatch = async (m) => {
    const { data: legs } = await supabase
      .from("legs").select("*").eq("match_id", m.id).order("leg_number", { ascending: true });

    // If no legs exist yet, start fresh (match was in_progress but legs were never created)
    if (!legs || legs.length === 0) {
      await startSeasonMatch(m);
      return;
    }

    const currentLeg = legs.find(l => l.status !== "completed") || legs[legs.length - 1];
    navigate("active", { match: m, currentLeg });
  };

  // ── Compute byes for a week ────────────────────────────────────────────────
  // Returns array of player names who have no match in that week
  const getByesForWeek = (matches, seasonPlayerIds) => {
    const playingIds = new Set();
    for (const m of matches) {
      if (m) {
        playingIds.add(m.player1_id);
        playingIds.add(m.player2_id);
      }
    }
    return seasonPlayerIds
      .filter(id => !playingIds.has(id))
      .map(id => players.find(p => p.id === id)?.name || "Unknown");
  };

  const getPlayerName = (id) => players.find(p => p.id === id)?.name || "?";

  // ── Renders ────────────────────────────────────────────────────────────────

  // Auth modal overlay
  const AuthModal = () => (
    <div className="abandon-overlay">
      <div className="abandon-card">
        <h3>🔒 Admin Required</h3>
        <input
          className="score-input"
          type="password"
          placeholder="Admin password"
          value={authInput}
          onChange={e => setAuthInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submitAuth()}
          autoFocus
        />
        {authError && <div className="error-msg">{authError}</div>}
        <button className="btn-primary big-btn" onClick={submitAuth}>Enter</button>
        <button className="btn-secondary big-btn" onClick={() => setShowAuthModal(false)}>Cancel</button>
      </div>
    </div>
  );

  // LIST
  if (view === "list") {
    return (
      <div className="screen">
        {showAuthModal && <AuthModal />}
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigate("home")}>← Back</button>
          <h2>🏆 Seasons</h2>
        </div>

        <button className="btn-primary big-btn" onClick={() => requireAdmin("create")}>
          + New Season
        </button>

        {loading && <div className="loading">Loading...</div>}
        {!loading && seasons.length === 0 && (
          <div className="empty-state">No seasons yet.</div>
        )}

        {seasons.map(s => (
          <div key={s.id} className="admin-match-row" style={{ cursor: "pointer" }}
            onClick={() => openSeason(s)}>
            <div className="admin-match-info">
              <div className="admin-match-players">{s.name}</div>
              <div className="admin-match-meta">{s.weeks} weeks · {s.status}</div>
            </div>
            <div className="admin-match-actions">
              <span className={`status-badge ${s.status}`}>
                {s.status === "active" ? "Active" : "Completed"}
              </span>
              <button className="btn-delete season-delete-btn" onClick={e => { e.stopPropagation(); requireAdmin("delete", s); }}>🗑</button>
            </div>
          </div>
        ))}

        {confirmDeleteSeason && (
          <div className="abandon-overlay">
            <div className="abandon-card">
              <h3>Delete Season?</h3>
              <p><strong>{confirmDeleteSeason.name}</strong><br /><br />This will permanently delete all matches, legs, and turns in this season.</p>
              <button className="btn-danger big-btn" onClick={() => deleteSeason(confirmDeleteSeason)}>Yes, Delete It</button>
              <button className="btn-secondary big-btn" onClick={() => setConfirmDeleteSeason(null)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // CREATE
  if (view === "create") {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => setView("list")}>← Back</button>
          <h2>New Season</h2>
        </div>

        <div className="season-steps">
          {["Name","Players","Weeks","Confirm"].map((label, i) => (
            <div key={i} className={`season-step ${step === i+1 ? "active" : ""} ${step > i+1 ? "done" : ""}`}>
              <span className="step-num">{i+1}</span>
              <span className="step-label">{label}</span>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="form-section">
            <label className="form-label">Season Name</label>
            <input
              className="select-input" type="text" placeholder="e.g. Spring 2026"
              value={seasonName} onChange={e => setSeasonName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && seasonName.trim() && setStep(2)} autoFocus
            />
            <button className="btn-primary big-btn" style={{ marginTop: "1rem" }}
              onClick={() => setStep(2)} disabled={!seasonName.trim()}>Next →</button>
          </div>
        )}

        {step === 2 && (
          <div className="form-section">
            <label className="form-label">Select Players ({selectedPlayers.length} selected)</label>
            <div className="player-select-grid">
              {players.map(p => (
                <button key={p.id}
                  className={`player-select-btn ${selectedPlayers.includes(p.id) ? "selected" : ""}`}
                  onClick={() => togglePlayer(p.id)}>
                  {selectedPlayers.includes(p.id) ? "✓ " : ""}{p.name}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button className="btn-secondary big-btn" onClick={() => setStep(1)}>← Back</button>
              <button className="btn-primary big-btn" onClick={() => setStep(3)} disabled={selectedPlayers.length < 2}>Next →</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="form-section">
            <label className="form-label">Number of Weeks</label>
            <div className="weeks-grid">
              {[4,6,8,10,12,16].map(w => (
                <button key={w} className={`weeks-btn ${numWeeks === w ? "selected" : ""}`}
                  onClick={() => setNumWeeks(w)}>{w}</button>
              ))}
            </div>
            <p className="form-sub">
              {matchesPerWeek} matches/week · {totalMatches} total matches · {selectedPlayers.length} players
            </p>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button className="btn-secondary big-btn" onClick={() => setStep(2)}>← Back</button>
              <button className="btn-primary big-btn" onClick={() => setStep(4)}>Preview →</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="form-section">
            <div className="season-summary-card">
              <div className="season-summary-name">{seasonName}</div>
              <div className="season-summary-meta">
                {selectedPlayers.length} players · {numWeeks} weeks · {totalMatches} total matches
              </div>
            </div>

            <div className="schedule-preview">
              {previewWeeks.slice(0, previewCount).map((week, wi) => {
                // Compute byes: selected players not appearing in any match this week
                const playingIds = new Set(week.flatMap(([a, b]) => [a, b]));
                const byeNames = selectedPlayers
                  .filter(id => !playingIds.has(id))
                  .map(id => getPlayerName(id));
                return (
                  <div key={wi} className="preview-week">
                    <div className="preview-week-label">Week {wi + 1}</div>
                    {week.map(([a, b], mi) => (
                      <div key={mi} className="preview-match">
                        {getPlayerName(a)} <span className="vs-small">vs</span> {getPlayerName(b)}
                      </div>
                    ))}
                    {byeNames.length > 0 && (
                      <div className="preview-bye">
                        <span className="schedule-bye-label">Bye:</span> {byeNames.join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}
              {previewCount < numWeeks && (
                <button className="preview-more-btn"
                  onClick={() => setPreviewCount(c => Math.min(c + 1, numWeeks))}>
                  + {numWeeks - previewCount} more week{numWeeks - previewCount !== 1 ? "s" : ""}...
                </button>
              )}
            </div>

            {createError && <div className="error-msg">{createError}</div>}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button className="btn-secondary big-btn" onClick={() => setStep(3)}>← Back</button>
              <button className="btn-primary big-btn" onClick={createSeason} disabled={creating}>
                {creating ? "Creating..." : "🏆 Create Season"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // DETAIL
  if (view === "detail" && detailSeason) {
    return (
      <div className="screen">
        {showAuthModal && <AuthModal />}
        {confirmDeleteSeason && (
          <div className="abandon-overlay">
            <div className="abandon-card">
              <h3>Delete Season?</h3>
              <p><strong>{confirmDeleteSeason.name}</strong><br /><br />All matches, legs, and turns will be permanently deleted.</p>
              <button className="btn-danger big-btn" onClick={() => deleteSeason(confirmDeleteSeason)}>Yes, Delete It</button>
              <button className="btn-secondary big-btn" onClick={() => setConfirmDeleteSeason(null)}>Cancel</button>
            </div>
          </div>
        )}
        <div className="screen-header">
          <button className="back-btn" onClick={() => { setView("list"); loadSeasons(); }}>← Back</button>
          <h2>{detailSeason.name}</h2>
          {authed && (
            <button className="btn-delete season-delete-btn" style={{ marginLeft: "auto" }}
              onClick={() => requireAdmin("delete", detailSeason)}>🗑</button>
          )}
        </div>

        <div className="season-standings">
          <div className="standings-header">Standings</div>
          <div className="standings-row standings-label-row">
            <span>Player</span><span>W</span><span>L</span><span>Legs</span>
          </div>
          {standings.map((s, i) => (
            <div key={s.id} className={`standings-row ${i === 0 && s.wins > 0 ? "standings-leader" : ""}`}>
              <span className="standings-name">{s.name}</span>
              <span className="standings-stat">{s.wins}</span>
              <span className="standings-stat">{s.losses}</span>
              <span className="standings-stat">{s.legs_for}–{s.legs_against}</span>
            </div>
          ))}
        </div>

        {scheduleLoading && <div className="loading">Loading schedule...</div>}

        {schedule.map(({ week, matches }) => {
          const byes = getByesForWeek(matches, seasonPlayerIds);
          return (
          <div key={week} className="schedule-week">
            <div className="schedule-week-label">Week {week}</div>
            {matches.map(m => {
              if (!m) return null;
              const done = m.status === "completed";
              const inProg = m.status === "in_progress";
              return (
                <div key={m.id} className={`schedule-match-row ${done ? "done" : ""}`}>
                  <div className="schedule-match-players">
                    <span className={m.winner_id === m.player1_id ? "schedule-winner" : ""}>{m.p1?.name}</span>
                    <span className="vs-small">vs</span>
                    <span className={m.winner_id === m.player2_id ? "schedule-winner" : ""}>{m.p2?.name}</span>
                  </div>
                  <div className="schedule-match-right">
                    {done && <span className="schedule-score">{m.player1_legs}–{m.player2_legs}</span>}
                    {!done && (
                      <button
                        className={inProg ? "btn-resume" : "btn-play"}
                        onClick={() => inProg ? resumeSeasonMatch(m) : startSeasonMatch(m)}>
                        {inProg ? "▶ Resume" : "▶ Play"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {byes.length > 0 && (
              <div className="schedule-bye-row">
                <span className="schedule-bye-label">Bye:</span>
                <span className="schedule-bye-names">{byes.join(", ")}</span>
              </div>
            )}
          </div>
          );
        })}
      </div>
    );
  }

  return null;
}
