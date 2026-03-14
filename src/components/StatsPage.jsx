import { useState, useEffect } from "react";

export default function StatsPage({ supabase, players, navigate }) {
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [selectedSeason, setSelectedSeason] = useState("all"); // "all" | season.id
  const [seasons, setSeasons] = useState([]);
  const [playerSeasons, setPlayerSeasons] = useState([]); // seasons this player is in
  const [stats, setStats] = useState(null);
  const [h2h, setH2h] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load all seasons on mount for the dropdown
  useEffect(() => {
    supabase.from("seasons").select("id, name").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setSeasons(data); });
  }, []);

  // When player changes, load their seasons and stats
  const handlePlayerChange = async (playerId) => {
    setSelectedPlayer(playerId);
    setSelectedSeason("all");
    setStats(null);
    setH2h([]);
    setPlayerSeasons([]);
    if (!playerId) return;

    // Find which seasons this player is in
    const { data: spRows } = await supabase
      .from("season_players")
      .select("season_id")
      .eq("player_id", playerId);
    const seasonIds = (spRows || []).map(r => r.season_id);
    setPlayerSeasons(seasons.filter(s => seasonIds.includes(s.id)));

    loadStats(playerId, "all");
  };

  // When season filter changes
  const handleSeasonChange = (seasonId) => {
    setSelectedSeason(seasonId);
    if (selectedPlayer) loadStats(selectedPlayer, seasonId);
  };

  const loadStats = async (playerId, seasonFilter) => {
    setLoading(true);

    if (seasonFilter === "all") {
      // Use existing views for all-time stats
      const [r1, r2, r3] = await Promise.all([
        supabase.from("stats_501").select("*").eq("player_id", playerId).single(),
        supabase.from("stats_cricket").select("*").eq("player_id", playerId).single(),
        supabase.from("stats_head_to_head").select("*").or(
          `player1.eq.${players.find(p => p.id === playerId)?.name},player2.eq.${players.find(p => p.id === playerId)?.name}`
        ),
      ]);
      setStats({ xo1: r1.data, cricket: r2.data, isComputed: false });
      setH2h(r3.data || []);
    } else {
      // Compute season-specific stats from raw data
      const computed = await computeSeasonStats(playerId, seasonFilter);
      setStats({ ...computed, isComputed: true });
      setH2h([]);
    }

    setLoading(false);
  };

  const computeSeasonStats = async (playerId, seasonId) => {
    // Get all match IDs in this season
    const { data: schedRows } = await supabase
      .from("season_schedule")
      .select("match_id")
      .eq("season_id", seasonId);
    const matchIds = (schedRows || []).map(r => r.match_id);
    if (matchIds.length === 0) return { xo1: null, cricket: null };

    // Get completed matches involving this player in this season
    const { data: matches } = await supabase
      .from("matches")
      .select("id, game_type, player1_id, player2_id, winner_id, player1_legs, player2_legs, status")
      .in("id", matchIds)
      .eq("status", "completed")
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);

    if (!matches || matches.length === 0) return { xo1: null, cricket: null };

    // Get all completed legs for these matches
    const allMatchIds = matches.map(m => m.id);
    const { data: legs } = await supabase
      .from("legs")
      .select("id, match_id, winner_id, game_type")
      .in("match_id", allMatchIds)
      .eq("status", "completed");

    // Derive which matches had 501 or cricket legs (game type lives on the leg)
    const matchesWith501 = new Set((legs || []).filter(l => l.game_type === "501" || l.game_type === "301").map(l => l.match_id));
    const matchesWithCricket = new Set((legs || []).filter(l => l.game_type === "cricket").map(l => l.match_id));
    const xo1Matches = matches.filter(m => matchesWith501.has(m.id));
    const cricketMatches = matches.filter(m => matchesWithCricket.has(m.id));

    const legIds = (legs || []).map(l => l.id);

    // Get turns for this player
    let turns = [];
    if (legIds.length > 0) {
      const { data: t } = await supabase
        .from("turns")
        .select("*")
        .in("leg_id", legIds)
        .eq("player_id", playerId);
      turns = t || [];
    }

    // ── Compute 01 stats ────────────────────────────────────────────────────
    const xo1LegIds = new Set((legs || []).filter(l => l.game_type === "501" || l.game_type === "301").map(l => l.id));

    const xo1Turns = turns.filter(t => t.leg_id && xo1LegIds.has(t.leg_id) && t.value !== null);

    // Group turns by (leg_id, turn_number) to get per-round totals
    const roundMap = {};
    for (const t of xo1Turns) {
      const key = `${t.leg_id}-${t.turn_number}`;
      if (!roundMap[key]) roundMap[key] = { score: 0, isBust: false, isCheckout: false, remaining: null };
      roundMap[key].score += t.value || 0;
      if (t.is_bust) roundMap[key].isBust = true;
      if (t.is_checkout) roundMap[key].isCheckout = true;
      if (t.score_remaining !== null) roundMap[key].remaining = t.score_remaining;
    }
    const rounds = Object.values(roundMap);
    const nonBustRounds = rounds.filter(r => !r.isBust);
    const checkoutRounds = rounds.filter(r => r.isCheckout);
    const bustOrCheckout = rounds.filter(r => r.isBust || r.isCheckout);
    const avg = nonBustRounds.length > 0
      ? (nonBustRounds.reduce((s, r) => s + r.score, 0) / nonBustRounds.length).toFixed(1)
      : null;
    const highScore = nonBustRounds.length > 0 ? Math.max(...nonBustRounds.map(r => r.score)) : null;

    const xo1Wins = xo1Matches.filter(m => m.winner_id === playerId).length;

    const xo1Stats = {
      matches_played: xo1Matches.length,
      matches_won: xo1Wins,
      win_pct: xo1Matches.length > 0 ? ((xo1Wins / xo1Matches.length) * 100).toFixed(1) : 0,
      three_dart_avg: avg,
      high_score: highScore,
      scores_180: nonBustRounds.filter(r => r.score === 180).length,
      scores_150_plus: nonBustRounds.filter(r => r.score >= 150).length,
      scores_100_plus: nonBustRounds.filter(r => r.score >= 100).length,
      checkout_pct: bustOrCheckout.length > 0
        ? ((checkoutRounds.length / bustOrCheckout.length) * 100).toFixed(1)
        : null,
      high_checkout: checkoutRounds.length > 0 ? Math.max(...checkoutRounds.map(r => r.score)) : null,
    };

    // ── Compute cricket stats ───────────────────────────────────────────────
    const cricketLegIds = new Set((legs || []).filter(l => l.game_type === "cricket").map(l => l.id));

    const cricketTurns = turns.filter(t => t.leg_id && cricketLegIds.has(t.leg_id));

    // Group cricket turns by (leg_id, turn_number)
    const cRoundMap = {};
    for (const t of cricketTurns) {
      const key = `${t.leg_id}-${t.turn_number}`;
      if (!cRoundMap[key]) cRoundMap[key] = { marks: 0, points: 0 };
      cRoundMap[key].marks += (t.cricket_15 || 0) + (t.cricket_16 || 0) + (t.cricket_17 || 0) +
                               (t.cricket_18 || 0) + (t.cricket_19 || 0) + (t.cricket_20 || 0) +
                               (t.cricket_bull || 0) + (t.cricket_dbull || 0) * 2;
      cRoundMap[key].points += (t.cricket_points || 0);
    }
    const cRounds = Object.values(cRoundMap);
    const avgMarks = cRounds.length > 0
      ? (cRounds.reduce((s, r) => s + r.marks, 0) / cRounds.length).toFixed(2)
      : null;
    const totalPoints = cRounds.reduce((s, r) => s + r.points, 0);
    const cricketWins = cricketMatches.filter(m => m.winner_id === playerId).length;

    const cricketStats = {
      matches_played: cricketMatches.length,
      matches_won: cricketWins,
      win_pct: cricketMatches.length > 0 ? ((cricketWins / cricketMatches.length) * 100).toFixed(1) : 0,
      avg_marks_per_round: avgMarks,
      total_points_scored: totalPoints,
    };

    return { xo1: xo1Stats, cricket: cricketStats };
  };

  const exportCSV = async () => {
    const { data: turns } = await supabase
      .from("turns")
      .select("*, matches(game_type, player1_id, player2_id), legs(leg_number)")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (!turns) return;
    const headers = ["Turn #", "Game Type", "Player", "Leg", "Score", "Remaining", "Checkout Attempt", "Checkout Success", "Cricket 15", "Cricket 16", "Cricket 17", "Cricket 18", "Cricket 19", "Cricket 20", "Cricket Bull", "Points", "Date"];
    const rows = turns.map(t => [
      t.turn_number, t.matches?.game_type,
      players.find(p => p.id === t.player_id)?.name,
      t.legs?.leg_number, t.score ?? "", t.score_remaining ?? "",
      t.is_checkout_attempt ? "Y" : "N", t.is_checkout_success ? "Y" : "N",
      t.cricket_15, t.cricket_16, t.cricket_17, t.cricket_18, t.cricket_19, t.cricket_20, t.cricket_bull,
      t.cricket_points, new Date(t.created_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "dart_stats.csv"; a.click();
  };

  const seasonLabel = selectedSeason === "all"
    ? "All Time"
    : seasons.find(s => s.id === selectedSeason)?.name || "";

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigate("home")}>← Back</button>
        <h2>📊 Player Stats</h2>
      </div>

      <div className="form-section">
        <select className="select-input" value={selectedPlayer} onChange={e => handlePlayerChange(e.target.value)}>
          <option value="">— Select a player —</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {/* Season filter — only show if player is selected and in at least one season */}
      {selectedPlayer && playerSeasons.length > 0 && (
        <div className="form-section">
          <select className="select-input" value={selectedSeason} onChange={e => handleSeasonChange(e.target.value)}>
            <option value="all">📊 All Time</option>
            {playerSeasons.map(s => (
              <option key={s.id} value={s.id}>🏆 {s.name}</option>
            ))}
          </select>
        </div>
      )}

      {loading && <div className="loading">Loading...</div>}

      {stats && !loading && (
        <div className="stats-sections">
          {selectedSeason !== "all" && (
            <div className="season-filter-label">Showing stats for: <strong>{seasonLabel}</strong></div>
          )}

          {/* 01 Stats */}
          <div className="stats-card">
            <h3>01 Stats</h3>
            {stats.xo1 && (stats.xo1.matches_played > 0 || !stats.isComputed) ? (
              <div className="stats-grid">
                <div className="stat-item"><span className="stat-label">Matches</span><span className="stat-val">{stats.xo1?.matches_played ?? 0}</span></div>
                <div className="stat-item"><span className="stat-label">Wins</span><span className="stat-val green">{stats.xo1?.matches_won ?? 0}</span></div>
                <div className="stat-item"><span className="stat-label">Win %</span><span className="stat-val">{stats.xo1?.win_pct ?? 0}%</span></div>
                <div className="stat-item"><span className="stat-label">3-Dart Avg</span><span className="stat-val highlight">{stats.xo1?.three_dart_avg ?? "—"}</span></div>
                <div className="stat-item"><span className="stat-label">High Score</span><span className="stat-val">{stats.xo1?.high_score ?? "—"}</span></div>
                <div className="stat-item"><span className="stat-label">180s</span><span className="stat-val">{stats.xo1?.scores_180 ?? 0}</span></div>
                <div className="stat-item"><span className="stat-label">150+</span><span className="stat-val">{stats.xo1?.scores_150_plus ?? 0}</span></div>
                <div className="stat-item"><span className="stat-label">100+</span><span className="stat-val">{stats.xo1?.scores_100_plus ?? 0}</span></div>
                <div className="stat-item"><span className="stat-label">Checkout %</span><span className="stat-val highlight">{stats.xo1?.checkout_pct ?? "—"}%</span></div>
                <div className="stat-item"><span className="stat-label">High Checkout</span><span className="stat-val">{stats.xo1?.high_checkout ?? "—"}</span></div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: "0.75rem" }}>No 01 matches in this season.</div>
            )}
          </div>

          {/* Cricket Stats */}
          <div className="stats-card">
            <h3>Cricket Stats</h3>
            {stats.cricket && (stats.cricket.matches_played > 0 || !stats.isComputed) ? (
              <div className="stats-grid">
                <div className="stat-item"><span className="stat-label">Matches</span><span className="stat-val">{stats.cricket?.matches_played ?? 0}</span></div>
                <div className="stat-item"><span className="stat-label">Wins</span><span className="stat-val green">{stats.cricket?.matches_won ?? 0}</span></div>
                <div className="stat-item"><span className="stat-label">Win %</span><span className="stat-val">{stats.cricket?.win_pct ?? 0}%</span></div>
                <div className="stat-item"><span className="stat-label">Marks/Round</span><span className="stat-val highlight">{stats.cricket?.avg_marks_per_round ?? "—"}</span></div>
                <div className="stat-item"><span className="stat-label">Points Scored</span><span className="stat-val">{stats.cricket?.total_points_scored ?? 0}</span></div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: "0.75rem" }}>No Cricket matches in this season.</div>
            )}
          </div>

          {/* Head to Head — all-time only */}
          {selectedSeason === "all" && h2h.length > 0 && (
            <div className="stats-card">
              <h3>Head to Head</h3>
              {h2h.map((r, i) => {
                const playerName = players.find(p => p.id === selectedPlayer)?.name;
                const isP1 = r.player1 === playerName;
                const myWins = isP1 ? r.player1_wins : r.player2_wins;
                const theirWins = isP1 ? r.player2_wins : r.player1_wins;
                const opponent = isP1 ? r.player2 : r.player1;
                return (
                  <div key={i} className="h2h-row">
                    <span className="h2h-opponent">{opponent} <em>({r.game_type})</em></span>
                    <span className="h2h-record">{myWins}–{theirWins}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="export-section">
        <button className="btn-secondary big-btn" onClick={exportCSV}>
          ⬇️ Export All Data (CSV)
        </button>
      </div>
    </div>
  );
}
