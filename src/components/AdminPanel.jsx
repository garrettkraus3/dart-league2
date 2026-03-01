import { useState, useEffect } from "react";
import SeasonManager from "./SeasonManager";

const ADMIN_PASSWORD = "dartsarelife";

export default function AdminPanel({ supabase, players, setPlayers, navigate, setGlobalLoading }) {
  const [authed, setAuthed] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [tab, setTab] = useState("matches");

  // Matches state
  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [resumeLoading, setResumeLoading] = useState(null);

  // Players state
  const [newPlayerName, setNewPlayerName] = useState("");
  const [playerError, setPlayerError] = useState("");
  const [playerLoading, setPlayerLoading] = useState(false);
  const [confirmDeletePlayer, setConfirmDeletePlayer] = useState(null);

  const login = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setAuthed(true);
      setPasswordError("");
    } else {
      setPasswordError("Wrong password. Try again.");
      setPasswordInput("");
    }
  };

  const loadMatches = async () => {
    setMatchesLoading(true);
    const { data } = await supabase
      .from("matches")
      .select("*, p1:player1_id(name), p2:player2_id(name), winner:winner_id(name)")
      .order("started_at", { ascending: false });
    if (data) setMatches(data);
    setMatchesLoading(false);
  };

  useEffect(() => {
    if (authed && tab === "matches") loadMatches();
  }, [authed, tab]);

  const deleteMatch = async (match) => {
    setGlobalLoading(true);
    await supabase.from("turns").delete().eq("match_id", match.id);
    await supabase.from("legs").delete().eq("match_id", match.id);
    await supabase.from("matches").delete().eq("id", match.id);
    setGlobalLoading(false);
    setConfirmDelete(null);
    loadMatches();
  };

  const resumeMatch = async (match) => {
    setResumeLoading(match.id);

    // Fetch all legs for this match ordered by leg_number
    const { data: legs } = await supabase
      .from("legs")
      .select("*")
      .eq("match_id", match.id)
      .order("leg_number", { ascending: true });

    if (!legs || legs.length === 0) {
      setResumeLoading(null);
      return;
    }

    // Find the most recent incomplete leg (status != completed), or last leg if all done
    const currentLeg = legs.find(l => l.status !== "completed") || legs[legs.length - 1];

    navigate("active", { match, currentLeg });
    setResumeLoading(null);
  };

  const addPlayer = async () => {
    const name = newPlayerName.trim();
    if (!name) return setPlayerError("Enter a name");
    setPlayerLoading(true);
    setGlobalLoading(true);
    setPlayerError("");
    const { error } = await supabase.from("players").insert({ name });
    if (error) {
      setPlayerError(error.message.includes("unique") ? "That name already exists" : error.message);
    } else {
      setNewPlayerName("");
      const { data } = await supabase.from("players").select("*").order("name");
      if (data) setPlayers(data);
    }
    setPlayerLoading(false);
    setGlobalLoading(false);
  };

  const deletePlayer = async (player) => {
    setGlobalLoading(true);
    const { error } = await supabase.from("players").delete().eq("id", player.id);
    if (error) {
      setPlayerError("Can't delete — player has match history. Remove their matches first.");
    } else {
      const { data } = await supabase.from("players").select("*").order("name");
      if (data) setPlayers(data);
    }
    setGlobalLoading(false);
    setConfirmDeletePlayer(null);
  };

  const formatDate = (ts) => {
    if (!ts) return "—";
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const matchLabel = (m) => {
    const score = m.status === "completed"
      ? `${m.player1_legs}–${m.player2_legs}`
      : `${m.player1_legs}–${m.player2_legs} in progress`;
    const winner = m.winner?.name ? ` · ${m.winner.name} wins` : "";
    return { score, winner };
  };

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="screen">
        <div className="screen-header">
          <button className="back-btn" onClick={() => navigate("home")}>← Back</button>
          <h2>🔒 Admin</h2>
        </div>
        <div className="admin-login">
          <p className="admin-login-sub">Enter the admin password to continue.</p>
          <input
            className="score-input"
            type="password"
            placeholder="Password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && login()}
            autoFocus
          />
          {passwordError && <div className="error-msg">{passwordError}</div>}
          <button className="btn-primary big-btn" onClick={login}>
            ENTER
          </button>
        </div>
      </div>
    );
  }

  // ── Admin panel ───────────────────────────────────────────────────────────
  return (
    <div className="screen">
      <div className="screen-header">
        <button className="back-btn" onClick={() => navigate("home")}>← Back</button>
        <h2>⚙️ Admin</h2>
      </div>

      <div className="button-group tabs">
        <button className={`toggle-btn ${tab === "matches" ? "active" : ""}`} onClick={() => setTab("matches")}>
          Matches
        </button>
        <button className={`toggle-btn ${tab === "players" ? "active" : ""}`} onClick={() => setTab("players")}>
          Players
        </button>
        <button className={`toggle-btn ${tab === "seasons" ? "active" : ""}`} onClick={() => setTab("seasons")}>
          🏆 Seasons
        </button>
      </div>

      {/* ── Seasons tab ── */}
      {tab === "seasons" && (
        <SeasonManager
          supabase={supabase}
          players={players}
          navigate={navigate}
          setGlobalLoading={setGlobalLoading}
          isAdminAuthed={authed}
          embedded={true}
        />
      )}

      {/* ── Matches tab ── */}
      {tab === "matches" && (
        <div className="admin-list">
          {matchesLoading && <div className="loading">Loading...</div>}
          {!matchesLoading && matches.length === 0 && (
            <div className="empty-state">No matches recorded yet.</div>
          )}
          {matches.map(m => {
            const { score, winner } = matchLabel(m);
            const isInProgress = m.status !== "completed";
            return (
              <div key={m.id} className="admin-match-row">
                <div className="admin-match-info">
                  <div className="admin-match-players">
                    {m.p1?.name} <span className="vs-small">vs</span> {m.p2?.name}
                  </div>
                  <div className="admin-match-meta">
                    {formatDate(m.started_at)} · {score}{winner}
                  </div>
                  <div className="admin-match-status">
                    <span className={`status-badge ${m.status}`}>
                      {isInProgress ? "In Progress" : "Completed"}
                    </span>
                  </div>
                </div>
                <div className="admin-match-actions">
                  {isInProgress && (
                    <button
                      className="btn-resume"
                      onClick={() => resumeMatch(m)}
                      disabled={resumeLoading === m.id}
                    >
                      {resumeLoading === m.id ? "..." : "▶ Resume"}
                    </button>
                  )}
                  <button className="btn-delete" onClick={() => setConfirmDelete(m)}>
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Players tab ── */}
      {tab === "players" && (
        <div className="admin-list">
          <div className="add-player-row">
            <input
              className="select-input"
              type="text"
              placeholder="New player name"
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addPlayer()}
            />
            <button className="btn-primary add-btn" onClick={addPlayer} disabled={playerLoading}>
              {playerLoading ? "..." : "Add"}
            </button>
          </div>
          {playerError && <div className="error-msg">{playerError}</div>}

          {players.map(p => (
            <div key={p.id} className="admin-match-row">
              <div className="admin-match-info">
                <div className="admin-match-players">{p.name}</div>
              </div>
              <button className="btn-delete" onClick={() => setConfirmDeletePlayer(p)}>
                🗑
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Confirm delete match ── */}
      {confirmDelete && (
        <div className="abandon-overlay">
          <div className="abandon-card">
            <h3>Delete Match?</h3>
            <p>
              <strong>{confirmDelete.p1?.name} vs {confirmDelete.p2?.name}</strong>
              <br />{formatDate(confirmDelete.started_at)} · {confirmDelete.player1_legs}–{confirmDelete.player2_legs}
              <br /><br />All turns and legs for this match will be permanently deleted.
            </p>
            <button className="btn-danger big-btn" onClick={() => deleteMatch(confirmDelete)}>
              Yes, Delete It
            </button>
            <button className="btn-secondary big-btn" onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm delete player ── */}
      {confirmDeletePlayer && (
        <div className="abandon-overlay">
          <div className="abandon-card">
            <h3>Remove Player?</h3>
            <p>
              Remove <strong>{confirmDeletePlayer.name}</strong> from the roster?
              <br /><br />This will fail if they have match history — delete their matches first.
            </p>
            <button className="btn-danger big-btn" onClick={() => deletePlayer(confirmDeletePlayer)}>
              Yes, Remove
            </button>
            <button className="btn-secondary big-btn" onClick={() => setConfirmDeletePlayer(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
