import { useState, useEffect } from "react";
import { Target, Zap, Trophy, TrendingUp, BarChart2, Settings, Radio } from "lucide-react";

const APP_VERSION = "V2.2026.03.29.21.34.29";

export default function HomeScreen({ navigate, supabase }) {
  const [liveMatches, setLiveMatches] = useState([]);

  // Load in-progress matches and subscribe to changes
  useEffect(() => {
    const fetchLive = async () => {
      const { data } = await supabase
        .from("matches")
        .select("id, player1_id, player2_id, player1_legs, player2_legs, started_at, players!matches_player1_id_fkey(name), players!matches_player2_id_fkey(name)")
        .eq("status", "in_progress")
        .order("started_at", { ascending: false });
      if (data) setLiveMatches(data);
    };

    fetchLive();

    // Realtime: re-fetch whenever a match row changes
    const channel = supabase
      .channel("home-live-matches")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, fetchLive)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const joinMatch = async (matchId) => {
    const { data: match } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (!match) return;

    const { data: legs } = await supabase
      .from("legs")
      .select("*")
      .eq("match_id", matchId)
      .order("leg_number", { ascending: false });

    const currentLeg = legs?.find(l => l.status === "in_progress") || legs?.[0] || null;
    navigate("active", { match, currentLeg });
  };

  return (
    <div className="home">
      <div className="home-header">
        <div className="bullseye-icon">
          <Target size={56} strokeWidth={1.5} color="#e64100" />
        </div>
        <h1>SWEET RELEASE</h1>
        <p className="subtitle">Track. Compete. Dominate.</p>
      </div>

      {/* Live matches */}
      {liveMatches.length > 0 && (
        <div className="live-matches-section">
          <div className="live-matches-header">
            <Radio size={14} strokeWidth={2} style={{ color: "#e64100" }} />
            <span>LIVE</span>
          </div>
          {liveMatches.map(m => {
            const p1 = m["players!matches_player1_id_fkey"]?.name || "P1";
            const p2 = m["players!matches_player2_id_fkey"]?.name || "P2";
            return (
              <button key={m.id} className="live-match-card" onClick={() => joinMatch(m.id)}>
                <span className="live-match-names">{p1} vs {p2}</span>
                <span className="live-match-score">{m.player1_legs} – {m.player2_legs}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="home-buttons">
        <button className="btn-primary big-btn" onClick={() => navigate("new")}>
          <span className="btn-icon"><Zap size={18} strokeWidth={2} /></span>
          NEW MATCH
        </button>
        <button className="btn-secondary big-btn" onClick={() => navigate("seasons")}>
          <span className="btn-icon"><Trophy size={18} strokeWidth={2} /></span>
          SEASONS
        </button>
        <button className="btn-secondary big-btn" onClick={() => navigate("leaderboard")}>
          <span className="btn-icon"><TrendingUp size={18} strokeWidth={2} /></span>
          LEADERBOARD
        </button>
        <button className="btn-secondary big-btn" onClick={() => navigate("stats")}>
          <span className="btn-icon"><BarChart2 size={18} strokeWidth={2} /></span>
          STATS
        </button>
        <button className="btn-admin" onClick={() => navigate("admin")}>
          <Settings size={14} strokeWidth={2} style={{ display: "inline", verticalAlign: "middle", marginRight: "0.35rem" }} />
          Admin
        </button>
      </div>

      <div className="version-stamp">{APP_VERSION}</div>
    </div>
  );
}
