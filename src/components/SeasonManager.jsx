import { useState, useEffect } from "react";

const ADMIN_PASSWORD = "dartsarelife";

// ── Schedule generator ───────────────────────────────────────────────────────
// Standard multi-week schedule: each player plays ~3 opponents per week
function buildWeeklySchedule(playerIds, numWeeks) {
  const n = playerIds.length;
  const pairCount = {};
  const pairKey = (a, b) => [a, b].sort().join("|");
  const weeks = [];

  for (let w = 0; w < numWeeks; w++) {
    const week = [];
    const slotsLeft = {};
    playerIds.forEach(p => { slotsLeft[p] = 3; });

    let madeProgress = true;
    while (madeProgress) {
      madeProgress = false;
      let bestPair = null;
      let bestCount = Infinity;
      const available = playerIds.filter(p => slotsLeft[p] > 0);
      for (let i = 0; i < available.length; i++) {
        for (let j = i + 1; j < available.length; j++) {
          const a = available[i], b = available[j];
          const alreadyThisWeek = week.some(
            ([x, y]) => (x === a && y === b) || (x === b && y === a)
          );
          if (alreadyThisWeek) continue;
          const key = pairKey(a, b);
          const cnt = pairCount[key] || 0;
          if (cnt < bestCount) { bestCount = cnt; bestPair = [a, b]; }
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

// ── Round Robin (1 week): every player vs every other player exactly once ────
function buildRoundRobinSchedule(playerIds) {
  const matches = [];
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      matches.push([playerIds[i], playerIds[j]]);
    }
  }
  // Return as a single week
  return [matches];
}

export default function SeasonManager({ supabase, players, navigate, setGlobalLoading, isAdminAuthed = false, embedded = false }) {
  const [view, setView]   = useState("list");
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(false);

  const [authed, setAuthed]         = useState(isAdminAuthed);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authInput, setAuthInput]   = useState("");
  const [authError, setAuthError]   = useState("");
  const [pendingAction, setPendingAction] = useState(null);
  const [pendingDeleteSeason, setPendingDeleteSeason] = useState(null);

  // Create form
  const [step, setStep]             = useState(1);
  const [seasonName, setSeasonName] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [numWeeks, setNumWeeks]     = useState(8);
  const [isRoundRobin, setIsRoundRobin] = useState(false);
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

  const resetCreate = () => {
    setStep(1);
    setSeasonName("");
    setSelectedPlayers([]);
    setNumWeeks(8);
    setIsRoundRobin(false);
    setPreviewCount(3);
    setCreateError("");
  };

  const togglePlayer = (id) => {
    setSelectedPlayers(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  // Build preview schedule based on mode
  const previewWeeks = selectedPlayers.length >= 2
    ? (isRoundRobin
        ? buildRoundRobinSchedule(selectedPlayers)
        : buildWeeklySchedule(selectedPlayers, numWeeks))
    : [];

  const totalMatches = previewWeeks.reduce((s, w) => s + w.length, 0);
  const displayWeeks = isRoundRobin ? 1 : numWeeks;

  const createSeason = async () => {
    if (selectedPlayers.length < 2) { setCreateError("Need at least 2 players."); return; }
    setCreating(true);
    setCreateError("");
    setGlobalLoading(true);

    const { data: season, error: sErr } = await supabase
      .from("seasons")
      .insert({ name: seasonName.trim(), weeks: displayWeeks })
      .select().single();
    if (sErr) { setCreateError(sErr.message); setCreating(false); setGlobalLoading(false); return; }

    await supabase.from("season_players").insert(
      selectedPlayers.map(pid => ({ season_id: season.id, player_id: pid }))
    );

    const weeks = isRoundRobin
      ? buildRoundRobinSchedule(selectedPlayers)
      : buildWeeklySchedule(selectedPlayers, numWeeks);

    for (let w = 0; w < weeks.length; w++) {
      for (const [p1id, p2id] of weeks[w]) {
        const { data: match } = await supabase
          .from("matches")
          .insert({ game_type: "501", legs_to_win: isRoundRobin ? 2 : 5, player1_id: p1id, player2_id: p2id, season_id: season.id })
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

  const deleteSeason = async (season) => {
    setGlobalLoading(true);
    const { data: schedRows } = await supabase
      .from("season_schedule").select("match_id").eq("season_id", season.id);
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

  const openSeason = async (season) => {
    setDetailSeason(season);
    setView("detail");
    setScheduleLoading(true);

    const { data: schedRows } = await supabase
      .from("season_schedule")
      .select(`
        week_number, match_id,
        match:match_id (
          id, status, player1_id, player2_id, player1_legs, player2_legs, winner_id, legs_to_win,
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
        .from("season_players").select("player_id, player:player_id(id, name)").eq("season_id", season.id);
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

  // Check if a match is already decided (someone reached legs_to_win) and mark it complete
  const checkAndCloseMatch = async (m) => {
    const legsToWin = m.legs_to_win || 2;
    const p1Legs = m.player1_legs || 0;
    const p2Legs = m.player2_legs || 0;
    if (p1Legs >= legsToWin || p2Legs >= legsToWin) {
      const winnerId = p1Legs >= legsToWin ? m.player1_id : m.player2_id;
      await supabase.from("matches").update({
        winner_id: winnerId,
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", m.id);
      return true; // match is over
    }
    return false;
  };

  const startSeasonMatch = async (m) => {
    if (await checkAndCloseMatch(m)) { openSeason(detailSeason); return; }
    const { data: leg } = await supabase
      .from("legs")
      .insert({ match_id: m.id, leg_number: 1, starting_score: null, game_type: null })
      .select().single();
    if (leg) navigate("active", { match: m, currentLeg: leg });
  };

  const resumeSeasonMatch = async (m) => {
    if (await checkAndCloseMatch(m)) { openSeason(detailSeason); return; }
    const { data: legs } = await supabase
      .from("legs").select("*").eq("match_id", m.id).order("leg_number", { ascending: true });
    if (!legs || legs.length === 0) { await startSeasonMatch(m); return; }
    const currentLeg = legs.find(l => l.status !== "completed") || legs[legs.length - 1];
    navigate("active", { match: m, currentLeg });
  };

  const getByesForWeek = (matches, seasonPlayerIds) => {
    const playingIds = new Set();
    for (const m of matches) {
      if (m) { playingIds.add(m.player1_id); playingIds.add(m.player2_id); }
    }
    return seasonPlayerIds
      .filter(id => !playingIds.has(id))
      .map(id => players.find(p => p.id === id)?.name || "Unknown");
  };

  const getPlayerName = (id) => players.find(p => p.id === id)?.name || "?";

  const AuthModal = () => (
    <div className="abandon-overlay">
      <div className="abandon-card">
        <h3>🔒 Admin Required</h3>
        <input
          className="score-input" type="password" placeholder="Admin password"
          value={authInput} onChange={e => setAuthInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submitAuth()} autoFocus
        />
        {authError && <div className="error-msg">{authError}</div>}
        <button className="btn-primary big-btn" onClick={submitAuth}>Enter</button>
        <button className="btn-secondary big-btn" onClick={() => setShowAuthModal(false)}>Cancel</button>
      </div>
    </div>
  );

  // ── LIST ────────────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className={embedded ? "" : "screen"}>
        {showAuthModal && <AuthModal />}
        {!embedded && (
          <div className="screen-header">
            <button className="back-btn" onClick={() => navigate("home")}>← Back</button>
            <h2>🏆 Seasons</h2>
          </div>
        )}
        <button className="btn-primary big-btn" onClick={() => requireAdmin("create")}>+ New Season</button>
        {loading && <div className="loading">Loading...</div>}
        {!loading && seasons.length === 0 && <div className="empty-state">No seasons yet.</div>}
        {seasons.map(s => (
          <div key={s.id} className="admin-match-row" style={{ cursor: "pointer" }} onClick={() => openSeason(s)}>
            <div className="admin-match-info">
              <div className="admin-match-players">{s.name}</div>
              <div className="admin-match-meta">{s.weeks === 1 ? "Round Robin" : `${s.weeks} weeks`} · {s.status}</div>
            </div>
            <div className="admin-match-actions">
              <span className={`status-badge ${s.status}`}>{s.status === "active" ? "Active" : "Completed"}</span>
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

  // ── CREATE ──────────────────────────────────────────────────────────────────
  if (view === "create") {
    // Step labels differ for round robin (no "Weeks" step)
    const stepLabels = isRoundRobin
      ? ["Name", "Players", "Confirm"]
      : ["Name", "Players", "Weeks", "Confirm"];
    const totalSteps = stepLabels.length;

    return (
      <div className={embedded ? "" : "screen"}>
        {!embedded && (
          <div className="screen-header">
            <button className="back-btn" onClick={() => setView("list")}>← Back</button>
            <h2>New Season</h2>
          </div>
        )}
        {embedded && (
          <button className="back-btn" style={{ marginBottom: "0.5rem" }} onClick={() => setView("list")}>← Back to Seasons</button>
        )}

        <div className="season-steps">
          {stepLabels.map((label, i) => (
            <div key={i} className={`season-step ${step === i+1 ? "active" : ""} ${step > i+1 ? "done" : ""}`}>
              <span className="step-num">{i+1}</span>
              <span className="step-label">{label}</span>
            </div>
          ))}
        </div>

        {/* STEP 1 — Name + Format */}
        {step === 1 && (
          <div className="form-section">
            <label className="form-label">Season Name</label>
            <input
              className="select-input" type="text" placeholder="e.g. Spring 2026"
              value={seasonName} onChange={e => setSeasonName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && seasonName.trim() && setStep(2)} autoFocus
            />

            <label className="form-label" style={{ marginTop: "1.5rem" }}>Format</label>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                className={`weeks-btn${!isRoundRobin ? " selected" : ""}`}
                style={{ flex: 1, padding: "0.85rem 0.5rem" }}
                onClick={() => setIsRoundRobin(false)}>
                📅 Multi-Week
              </button>
              <button
                className={`weeks-btn${isRoundRobin ? " selected" : ""}`}
                style={{ flex: 1, padding: "0.85rem 0.5rem" }}
                onClick={() => setIsRoundRobin(true)}>
                ⚡ Round Robin
              </button>
            </div>
            {isRoundRobin && (
              <p className="form-sub" style={{ marginTop: "0.5rem" }}>
                Everyone plays everyone else once — all in one session.
              </p>
            )}

            <button className="btn-primary big-btn" style={{ marginTop: "1rem" }}
              onClick={() => setStep(2)} disabled={!seasonName.trim()}>Next →</button>
          </div>
        )}

        {/* STEP 2 — Players */}
        {step === 2 && (
          <div className="form-section">
            <label className="form-label">Select Players ({selectedPlayers.length} selected)</label>
            {isRoundRobin && selectedPlayers.length >= 2 && (
              <p className="form-sub">
                {selectedPlayers.length} players = {(selectedPlayers.length * (selectedPlayers.length - 1)) / 2} matches
              </p>
            )}
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
              <button className="btn-primary big-btn"
                onClick={() => setStep(isRoundRobin ? 3 : 3)}
                disabled={selectedPlayers.length < 2}>Next →</button>
            </div>
          </div>
        )}

        {/* STEP 3 — Weeks (multi-week only) */}
        {step === 3 && !isRoundRobin && (
          <div className="form-section">
            <label className="form-label">Number of Weeks</label>
            <div className="weeks-grid">
              {[4,6,8,10,12,16].map(w => (
                <button key={w} className={`weeks-btn ${numWeeks === w ? "selected" : ""}`}
                  onClick={() => setNumWeeks(w)}>{w}</button>
              ))}
            </div>
            <p className="form-sub">
              {previewWeeks[0]?.length || 0} matches/week · {totalMatches} total · {selectedPlayers.length} players
            </p>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button className="btn-secondary big-btn" onClick={() => setStep(2)}>← Back</button>
              <button className="btn-primary big-btn" onClick={() => setStep(4)}>Preview →</button>
            </div>
          </div>
        )}

        {/* CONFIRM step — step 3 for round robin, step 4 for multi-week */}
        {((isRoundRobin && step === 3) || (!isRoundRobin && step === 4)) && (
          <div className="form-section">
            <div className="season-summary-card">
              <div className="season-summary-name">{seasonName}</div>
              <div className="season-summary-meta">
                {isRoundRobin
                  ? `${selectedPlayers.length} players · ${totalMatches} matches · Round Robin · Best of 3`
                  : `${selectedPlayers.length} players · ${numWeeks} weeks · ${totalMatches} total matches`}
              </div>
            </div>

            <div className="schedule-preview">
              {previewWeeks.slice(0, isRoundRobin ? 1 : previewCount).map((week, wi) => {
                const playingIds = new Set(week.flatMap(([a, b]) => [a, b]));
                const byeNames = selectedPlayers.filter(id => !playingIds.has(id)).map(id => getPlayerName(id));
                return (
                  <div key={wi} className="preview-week">
                    <div className="preview-week-label">
                      {isRoundRobin ? "All Matches" : `Week ${wi + 1}`}
                    </div>
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
              {!isRoundRobin && previewCount < numWeeks && (
                <button className="preview-more-btn"
                  onClick={() => setPreviewCount(c => Math.min(c + 1, numWeeks))}>
                  + {numWeeks - previewCount} more week{numWeeks - previewCount !== 1 ? "s" : ""}...
                </button>
              )}
            </div>

            {createError && <div className="error-msg">{createError}</div>}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button className="btn-secondary big-btn" onClick={() => setStep(isRoundRobin ? 2 : 3)}>← Back</button>
              <button className="btn-primary big-btn" onClick={createSeason} disabled={creating}>
                {creating ? "Creating..." : "🏆 Create Season"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── DETAIL ──────────────────────────────────────────────────────────────────
  if (view === "detail" && detailSeason) {
    const isRR = detailSeason.weeks === 1;
    return (
      <div className={embedded ? "" : "screen"}>
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
          <button className="btn-delete season-delete-btn" style={{ marginLeft: "auto" }}
            onClick={() => requireAdmin("delete", detailSeason)}>🗑</button>
        </div>

        {isRR && (
          <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
            <span className="status-badge active">⚡ Round Robin</span>
          </div>
        )}

        <div className="season-standings">
          <div className="standings-header">Standings</div>
          <div className="standings-row standings-label-row">
            <span>Player</span><span>W</span><span>L</span>
          </div>
          {standings.map((s, i) => (
            <div key={s.id} className={`standings-row ${i === 0 && s.wins > 0 ? "standings-leader" : ""}`}>
              <span className="standings-name">{s.name}</span>
              <span className="standings-stat">{s.wins}</span>
              <span className="standings-stat">{s.losses}</span>

            </div>
          ))}
        </div>

        {scheduleLoading && <div className="loading">Loading schedule...</div>}

        {schedule.map(({ week, matches }) => {
          const byes = getByesForWeek(matches, seasonPlayerIds);
          return (
            <div key={week} className="schedule-week">
              <div className="schedule-week-label">
                {isRR ? "All Matches" : `Week ${week}`}
              </div>
              {matches.map(m => {
                if (!m) return null;
                const legsToWin = m.legs_to_win || 2;
                const alreadyDecided = (m.player1_legs || 0) >= legsToWin || (m.player2_legs || 0) >= legsToWin;
                const done = m.status === "completed" || alreadyDecided;
                const inProg = m.status === "in_progress" && !alreadyDecided;
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
