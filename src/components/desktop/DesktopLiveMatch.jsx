import React, { useState, useEffect } from "react";
// supabase passed as prop
import "./DesktopLiveMatch.css";

const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, "Bull"];

function CricketBoard({ board, scores, playerName, isActive }) {
  return (
    <div className={`cricket-board ${isActive ? "cricket-board--active" : ""}`}>
      <div className="cricket-board__name">{playerName}</div>
      <div className="cricket-board__score">{scores?.points || 0}<span className="cricket-board__pts">pts</span></div>
      <div className="cricket-board__marks">
        {CRICKET_NUMBERS.map((num) => {
          const key = num === "Bull" ? "bull" : `n${num}`;
          const marks = board?.[key] || 0;
          return (
            <div className="cricket-mark-row" key={num}>
              <span className="cricket-mark-num">{num}</span>
              <div className="cricket-mark-slots">
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`mark-slot ${marks > i ? "mark-slot--hit" : ""} ${marks === 3 ? "mark-slot--closed" : ""}`}>
                    {marks > i ? (marks === 3 ? "●" : i < 2 ? "/" : "X") : "·"}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TurnRow({ turn, players }) {
  const player = players.find((p) => p.id === turn.player_id);
  const darts = [];
  if (turn.dart1_number !== null && turn.dart1_number !== undefined) {
    const mod = turn.dart1_modifier;
    darts.push(`${mod && mod !== "single" ? mod[0].toUpperCase() : ""}${turn.dart1_number}`);
  }
  if (turn.dart2_number !== null && turn.dart2_number !== undefined) {
    const mod = turn.dart2_modifier;
    darts.push(`${mod && mod !== "single" ? mod[0].toUpperCase() : ""}${turn.dart2_number}`);
  }
  if (turn.dart3_number !== null && turn.dart3_number !== undefined) {
    const mod = turn.dart3_modifier;
    darts.push(`${mod && mod !== "single" ? mod[0].toUpperCase() : ""}${turn.dart3_number}`);
  }

  return (
    <div className="turn-row">
      <span className="turn-row__player">{player?.name?.split(" ")[0] || "?"}</span>
      <span className="turn-row__darts">{darts.join(" · ") || "—"}</span>
      <span className="turn-row__score">
        {turn.is_bust ? <span className="turn-bust">BUST</span> : turn.score !== null ? `+${turn.score}` : ""}
      </span>
      <span className="turn-row__remaining">{turn.score_remaining ?? ""}</span>
    </div>
  );
}

export default function DesktopLiveMatch({ supabase }) {
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [turns, setTurns] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadPlayers();
    loadMatches();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadMatches();
      if (selectedMatch) loadMatchDetail(selectedMatch);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedMatch]);

  useEffect(() => {
    if (selectedMatch) loadMatchDetail(selectedMatch);
  }, [selectedMatch]);

  async function loadPlayers() {
    const { data } = await supabase.from("players").select("*");
    setPlayers(data || []);
  }

  async function loadMatches() {
    const { data } = await supabase
      .from("matches")
      .select("*, player1:players!matches_player1_id_fkey(id,name), player2:players!matches_player2_id_fkey(id,name)")
      .in("status", ["in_progress", "completed"])
      .order("updated_at", { ascending: false })
      .limit(20);
    const active = data || [];
    setMatches(active);
    if (!selectedMatch && active.length > 0) {
      setSelectedMatch(active[0].id);
    }
    setLoading(false);
  }

  async function loadMatchDetail(matchId) {
    const { data: match } = await supabase
      .from("matches")
      .select("*, player1:players!matches_player1_id_fkey(id,name), player2:players!matches_player2_id_fkey(id,name)")
      .eq("id", matchId)
      .single();

    const { data: legs } = await supabase
      .from("legs")
      .select("*")
      .eq("match_id", matchId)
      .order("leg_number");

    const { data: turnData } = await supabase
      .from("turns")
      .select("*")
      .eq("match_id", matchId)
      .order("turn_number", { ascending: false })
      .limit(30);

    setMatchData({ match, legs: legs || [] });
    setTurns(turnData || []);
  }

  const match = matchData?.match;
  const legs = matchData?.legs || [];

  // Calculate leg scores
  const p1Legs = legs.filter((l) => l.winner_id === match?.player1_id).length;
  const p2Legs = legs.filter((l) => l.winner_id === match?.player2_id).length;

  // Current leg
  const currentLeg = legs.find((l) => l.status === "in_progress") || legs[legs.length - 1];
  const isCurrentCricket = currentLeg?.game_type === "cricket";

  // Build cricket board state from turns
  function buildCricketBoard(playerId) {
    const board = {};
    const scores = { points: 0 };
    const legTurns = turns.filter((t) => t.leg_id === currentLeg?.id && t.player_id === playerId);
    legTurns.forEach((turn) => {
      ["cricket_15", "cricket_16", "cricket_17", "cricket_18", "cricket_19", "cricket_20", "cricket_bull", "cricket_dbull"].forEach((key) => {
        const num = key.replace("cricket_", "").replace("bull", "bull").replace("dbull", "bull");
        if (turn[key]) {
          board[num] = Math.min(3, (board[num] || 0) + (turn[key] || 0));
        }
      });
      scores.points += turn.cricket_points || 0;
    });
    return { board, scores };
  }

  // 501 remaining
  function get501Remaining(playerId) {
    const lastTurn = turns.find((t) => t.player_id === playerId && t.leg_id === currentLeg?.id && t.score_remaining !== null);
    return lastTurn?.score_remaining ?? currentLeg?.starting_score ?? 501;
  }

  // Whose turn is it
  const lastTurn = turns[0];
  const currentTurnPlayerId = lastTurn
    ? lastTurn.player_id === match?.player1_id ? match?.player2_id : match?.player1_id
    : match?.player1_id;

  if (loading) {
    return (
      <div className="dlm-loading">
        <div className="dlm-spinner" />
        <span>Loading match data...</span>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="dlm-empty">
        <div className="dlm-empty__icon">🎯</div>
        <div className="dlm-empty__title">No Active Matches</div>
        <div className="dlm-empty__sub">Matches will appear here when players start a game.</div>
      </div>
    );
  }

  return (
    <div className="dlm">
      {/* Match selector bar */}
      <div className="dlm__selector">
        <span className="dlm__selector-label">Select Match</span>
        <div className="dlm__selector-chips">
          {matches.map((m) => (
            <button
              key={m.id}
              className={`match-chip ${selectedMatch === m.id ? "match-chip--active" : ""} ${m.status === "in_progress" ? "match-chip--live" : ""}`}
              onClick={() => setSelectedMatch(m.id)}
            >
              {m.status === "in_progress" && <span className="live-dot" />}
              {m.player1?.name?.split(" ")[0]} vs {m.player2?.name?.split(" ")[0]}
            </button>
          ))}
        </div>
        <label className="auto-refresh-toggle">
          <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
          Live refresh
        </label>
      </div>

      {match && (
        <div className="dlm__main">
          {/* Score Header */}
          <div className="dlm__scoreboard">
            <div className={`dlm__player-side ${currentTurnPlayerId === match.player1_id ? "dlm__player-side--active" : ""}`}>
              <div className="dlm__player-name">{match.player1?.name}</div>
              <div className="dlm__legs-score">{p1Legs}</div>
              {!isCurrentCricket && <div className="dlm__remaining">{get501Remaining(match.player1_id)}<span className="dlm__remaining-label">remaining</span></div>}
              {currentTurnPlayerId === match.player1_id && <div className="dlm__turn-indicator">● THROWING</div>}
            </div>

            <div className="dlm__center">
              <div className="dlm__leg-label">Leg</div>
              <div className="dlm__leg-count">{legs.length} <span className="dlm__leg-of">of 5</span></div>
              <div className="dlm__game-type">{currentLeg?.game_type?.toUpperCase() || "—"}</div>
              <div className="dlm__status-badge">{match.status === "in_progress" ? <><span className="live-dot" /> LIVE</> : "COMPLETED"}</div>
            </div>

            <div className={`dlm__player-side dlm__player-side--right ${currentTurnPlayerId === match.player2_id ? "dlm__player-side--active" : ""}`}>
              <div className="dlm__player-name">{match.player2?.name}</div>
              <div className="dlm__legs-score">{p2Legs}</div>
              {!isCurrentCricket && <div className="dlm__remaining">{get501Remaining(match.player2_id)}<span className="dlm__remaining-label">remaining</span></div>}
              {currentTurnPlayerId === match.player2_id && <div className="dlm__turn-indicator">● THROWING</div>}
            </div>
          </div>

          {/* Legs progress */}
          <div className="dlm__legs-bar">
            {[1, 2, 3, 4, 5].map((n) => {
              const leg = legs.find((l) => l.leg_number === n);
              return (
                <div key={n} className={`leg-dot ${leg?.status === "completed" ? (leg.winner_id === match.player1_id ? "leg-dot--p1" : "leg-dot--p2") : leg?.status === "in_progress" ? "leg-dot--live" : "leg-dot--pending"}`}>
                  <span>{n}</span>
                </div>
              );
            })}
          </div>

          {/* Cricket boards or throw log */}
          <div className="dlm__bottom">
            {isCurrentCricket ? (
              <div className="dlm__cricket-boards">
                <CricketBoard
                  {...buildCricketBoard(match.player1_id)}
                  playerName={match.player1?.name}
                  isActive={currentTurnPlayerId === match.player1_id}
                />
                <CricketBoard
                  {...buildCricketBoard(match.player2_id)}
                  playerName={match.player2?.name}
                  isActive={currentTurnPlayerId === match.player2_id}
                />
              </div>
            ) : (
              <div className="dlm__throw-log">
                <div className="throw-log__header">
                  <span>Player</span>
                  <span>Darts</span>
                  <span>Score</span>
                  <span>Remaining</span>
                </div>
                {turns.slice(0, 20).map((t, i) => (
                  <TurnRow key={t.id || i} turn={t} players={[match.player1, match.player2].filter(Boolean)} />
                ))}
              </div>
            )}

            {/* Leg history */}
            <div className="dlm__leg-history">
              <div className="leg-history__title">Leg Results</div>
              {legs.filter((l) => l.status === "completed").map((leg) => {
                const winner = leg.winner_id === match.player1_id ? match.player1?.name : match.player2?.name;
                return (
                  <div className="leg-result" key={leg.id}>
                    <span className="leg-result__num">Leg {leg.leg_number}</span>
                    <span className="leg-result__type">{leg.game_type}</span>
                    <span className="leg-result__winner">🏆 {winner?.split(" ")[0]}</span>
                  </div>
                );
              })}
              {legs.filter((l) => l.status === "completed").length === 0 && (
                <div className="leg-history__empty">No completed legs yet</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
