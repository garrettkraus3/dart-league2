import { useState, useEffect } from "react";
import { Trophy, Crown } from "lucide-react";

export default function Leaderboard({ supabase, navigate }) {
  const [tab, setTab] = useState("501");
  const [stats501, setStats501] = useState([]);
  const [statsCricket, setStatsCricket] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [r1, r2] = await Promise.all([
        supabase.from("stats_501").select("*").order("win_pct", { ascending: false }),
        supabase.from("stats_cricket").select("*").order("win_pct", { ascending: false }),
      ]);
      if (r1.data) setStats501(r1.data);
      if (r2.data) setStatsCricket(r2.data);
      setLoading(false);
    };
    load();
  }, []);

  const rows = tab === "501" ? stats501 : statsCricket;

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigate("home")}>← Back</button>
        <h2><Trophy size={18} strokeWidth={2} style={{display:"inline",verticalAlign:"middle",marginRight:"0.4rem"}} />Leaderboard</h2>
      </div>

      <div className="button-group tabs">
        {["501", "301", "cricket"].map(g => (
          <button key={g} className={`toggle-btn ${tab === g ? "active" : ""}`} onClick={() => setTab(g)}>
            {g === "cricket" ? "Cricket" : g}
          </button>
        ))}
      </div>

      {loading ? <div className="loading">Loading...</div> : (
        <div className="leaderboard-table">
          <div className="table-header">
            <span>#</span>
            <span>Player</span>
            <span>W</span>
            <span>L</span>
            <span>Win%</span>
            {tab !== "cricket" && <span>Avg</span>}
            {tab === "cricket" && <span>MPR</span>}
          </div>
          {rows.filter(r => r.matches_played > 0).map((r, i) => (
            <div key={r.player_id} className={`table-row ${i === 0 ? "top-row" : ""}`}>
              <span className="rank">{i === 0 ? <Crown size={14} strokeWidth={2} color="#e64100" /> : i + 1}</span>
              <span className="player-cell">{r.name}</span>
              <span className="stat-cell green">{r.matches_won}</span>
              <span className="stat-cell red">{r.matches_played - r.matches_won}</span>
              <span className="stat-cell">{r.win_pct ?? 0}%</span>
              {tab !== "cricket" && <span className="stat-cell highlight">{r.three_dart_avg ?? "—"}</span>}
              {tab === "cricket" && <span className="stat-cell highlight">{r.avg_marks_per_round ?? "—"}</span>}
            </div>
          ))}
          {rows.filter(r => r.matches_played > 0).length === 0 && (
            <div className="empty-state">No matches played yet</div>
          )}
        </div>
      )}
    </div>
  );
}
