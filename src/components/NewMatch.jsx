import { useState } from "react";

export default function NewMatch({ players, supabase, navigate }) {
  const [gameType, setGameType] = useState("501");
  const [legsToWin, setLegsToWin] = useState(2);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const startMatch = async () => {
    if (!p1 || !p2) return setError("Select both players");
    if (p1 === p2) return setError("Players must be different");
    setLoading(true);
    setError("");

    const startingScore = gameType === "cricket" ? null : parseInt(gameType);

    // Create match
    const { data: match, error: mErr } = await supabase
      .from("matches")
      .insert({ game_type: gameType, legs_to_win: legsToWin, player1_id: p1, player2_id: p2 })
      .select()
      .single();

    if (mErr) { setError(mErr.message); setLoading(false); return; }

    // Create first leg
    const { data: leg, error: lErr } = await supabase
      .from("legs")
      .insert({ match_id: match.id, leg_number: 1, starting_score: startingScore })
      .select()
      .single();

    if (lErr) { setError(lErr.message); setLoading(false); return; }

    setLoading(false);
    navigate("active", { match, currentLeg: leg, startingScore });
  };

  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigate("home")}>← Back</button>
        <h2>New Match</h2>
      </div>

      <div className="form-section">
        <label className="form-label">Game Type</label>
        <div className="button-group">
          {["501", "301", "cricket"].map(g => (
            <button
              key={g}
              className={`toggle-btn ${gameType === g ? "active" : ""}`}
              onClick={() => setGameType(g)}
            >
              {g === "cricket" ? "Cricket" : g}
            </button>
          ))}
        </div>
      </div>

      <div className="form-section">
        <label className="form-label">First to Win (Legs)</label>
        <div className="button-group">
          {[1, 2, 3, 5].map(n => (
            <button
              key={n}
              className={`toggle-btn ${legsToWin === n ? "active" : ""}`}
              onClick={() => setLegsToWin(n)}
            >
              {n}
            </button>
          ))}
        </div>
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

      <button
        className="btn-primary big-btn"
        onClick={startMatch}
        disabled={loading}
      >
        {loading ? "Starting..." : "START MATCH ⚡"}
      </button>
    </div>
  );
}
