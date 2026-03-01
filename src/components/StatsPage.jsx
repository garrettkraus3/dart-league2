import { useState, useEffect } from "react";

export default function StatsPage({ supabase, players, navigate }) {
  const [selectedPlayer, setSelectedPlayer] = useState("");
  const [stats, setStats] = useState(null);
  const [h2h, setH2h] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadStats = async (playerId) => {
    setLoading(true);
    const [r1, r2, r3] = await Promise.all([
      supabase.from("stats_501").select("*").eq("player_id", playerId).single(),
      supabase.from("stats_cricket").select("*").eq("player_id", playerId).single(),
      supabase.from("stats_head_to_head").select("*").or(`player1.eq.${players.find(p=>p.id===playerId)?.name},player2.eq.${players.find(p=>p.id===playerId)?.name}`),
    ]);
    setStats({ xo1: r1.data, cricket: r2.data });
    setH2h(r3.data || []);
    setLoading(false);
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
      t.turn_number,
      t.matches?.game_type,
      players.find(p => p.id === t.player_id)?.name,
      t.legs?.leg_number,
      t.score ?? "",
      t.score_remaining ?? "",
      t.is_checkout_attempt ? "Y" : "N",
      t.is_checkout_success ? "Y" : "N",
      t.cricket_15, t.cricket_16, t.cricket_17, t.cricket_18, t.cricket_19, t.cricket_20, t.cricket_bull,
      t.cricket_points,
      new Date(t.created_at).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dart_stats.csv";
    a.click();
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigate("home")}>← Back</button>
        <h2>📊 Player Stats</h2>
      </div>

      <div className="form-section">
        <select className="select-input" value={selectedPlayer} onChange={e => {
          setSelectedPlayer(e.target.value);
          if (e.target.value) loadStats(e.target.value);
        }}>
          <option value="">— Select a player —</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading && <div className="loading">Loading...</div>}

      {stats && !loading && (
        <div className="stats-sections">
          {/* 501 Stats */}
          <div className="stats-card">
            <h3>501 / 301 Stats</h3>
            <div className="stats-grid">
              <div className="stat-item"><span className="stat-label">Matches</span><span className="stat-val">{stats.xo1?.matches_played ?? 0}</span></div>
              <div className="stat-item"><span className="stat-label">Wins</span><span className="stat-val green">{stats.xo1?.matches_won ?? 0}</span></div>
              <div className="stat-item"><span className="stat-label">Win %</span><span className="stat-val">{stats.xo1?.win_pct ?? 0}%</span></div>
              <div className="stat-item"><span className="stat-label">3-Dart Avg</span><span className="stat-val highlight">{stats.xo1?.three_dart_avg ?? "—"}</span></div>
              <div className="stat-item"><span className="stat-label">High Score</span><span className="stat-val">{stats.xo1?.high_score ?? "—"}</span></div>
              <div className="stat-item"><span className="stat-label">180s</span><span className="stat-val">{stats.xo1?.scores_180 ?? 0}</span></div>
              <div className="stat-item"><span className="stat-label">140+</span><span className="stat-val">{stats.xo1?.scores_140_plus ?? 0}</span></div>
              <div className="stat-item"><span className="stat-label">100+</span><span className="stat-val">{stats.xo1?.scores_100_plus ?? 0}</span></div>
              <div className="stat-item"><span className="stat-label">Checkout %</span><span className="stat-val highlight">{stats.xo1?.checkout_pct ?? "—"}%</span></div>
              <div className="stat-item"><span className="stat-label">High Checkout</span><span className="stat-val">{stats.xo1?.high_checkout ?? "—"}</span></div>
            </div>
          </div>

          {/* Cricket Stats */}
          <div className="stats-card">
            <h3>Cricket Stats</h3>
            <div className="stats-grid">
              <div className="stat-item"><span className="stat-label">Matches</span><span className="stat-val">{stats.cricket?.matches_played ?? 0}</span></div>
              <div className="stat-item"><span className="stat-label">Wins</span><span className="stat-val green">{stats.cricket?.matches_won ?? 0}</span></div>
              <div className="stat-item"><span className="stat-label">Win %</span><span className="stat-val">{stats.cricket?.win_pct ?? 0}%</span></div>
              <div className="stat-item"><span className="stat-label">Marks/Round</span><span className="stat-val highlight">{stats.cricket?.avg_marks_per_round ?? "—"}</span></div>
              <div className="stat-item"><span className="stat-label">Points Scored</span><span className="stat-val">{stats.cricket?.total_points_scored ?? 0}</span></div>
            </div>
          </div>

          {/* Head to Head */}
          {h2h.length > 0 && (
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
