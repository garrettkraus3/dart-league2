import { useState } from "react";

// Fixed leg format: 501, 501, Cricket, Cricket, Choice
export const LEG_FORMAT = ["501", "501", "cricket", "cricket", "choice"];

export default function NewMatch({ players, supabase, navigate }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startMatch = async () => {
    if (!p1 || !p2) return setError("Select both players");
    if (p1 === p2) return setError("Players must be different");
    setLoading(true);
    setError("");

    const { data: match, error: mErr } = await supabase
      .from("matches")
      .insert({
        game_type: "501", // overall match type, individual legs track their own
        legs_to_win: 5, // all 5 legs are always played
        player1_id: p1,
        player2_id: p2,
      })
      .select()
      .single();

    if (mErr) { setError(mErr.message); setLoading(false); return; }

    const { data: leg, error: lErr } = await supabase
      .from("legs")
      .insert({
        match_id: match.id,
        leg_number: 1,
        starting_score: null,
        game_type: null,
      })
      .select()
      .single();

    if (lErr) { setError(lErr.message); setLoading(false); return; }

    setLoading(false);
    navigate("active", { match, currentLeg: leg });
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigate("home")}>← Back</button>
        <h2>New Match</h2>
      </div>

      <div className="match-format-card">
        <div className="format-title">Match Format</div>
        <div className="format-sub" style={{ padding: "0.5rem 0" }}>5 legs · choose 501 or Cricket before each leg</div>
        <div className="format-sub">All 5 legs are played — most legs wins</div>
      </div>

      <div className="form-section">
        <label className="form-label">Player 1</label>
        <select className="select-input" value={p1} onChange={e => setP1(e.target.value)}>
          <option value="">— select —</option>
          {players.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="form-section">
        <label className="form-label">Player 2</label>
        <select className="select-input" value={p2} onChange={e => setP2(e.target.value)}>
          <option value="">— select —</option>
          {players.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="error-msg">{error}</div>}

      <button className="btn-primary big-btn" onClick={startMatch} disabled={loading}>
        {loading ? "Starting..." : "START MATCH ⚡"}
      </button>
    </div>
  );
}
