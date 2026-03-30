import React, { useState, useEffect } from "react";
import "./DesktopLiveMatch.css";

const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, "Bull"];

function CricketBoard({ board, points, playerName, isActive }) {
  const markSymbol = (marks) => {
    if (marks === 0) return <span className="mark-empty">·</span>;
    if (marks === 1) return <span className="mark-one">/</span>;
    if (marks === 2) return <span className="mark-two">X</span>;
    return <span className="mark-closed">●</span>;
  };

  return (
    <div className={`cricket-board ${isActive ? "cricket-board--active" : ""}`}>
      <div className="cricket-board__name">{playerName}</div>
      <div className="cricket-board__score">
        {points}<span className="cricket-board__pts">pts</span>
      </div>
      <div className="cricket-board__marks">
        {CRICKET_NUMBERS.map((num) => {
          const marks = board?.[num] || 0;
          return (
            <div className="cricket-mark-row" key={num}>
              <span className="cricket-mark-num">{num}</span>
              <div className="cricket-mark-slots">
                {markSymbol(Math.min(marks, 3))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TurnRow({ turn, p1, p2 }) {
  const player = turn.player_id === p1?.id ? p1 : p2;
  const darts = [];

  [1, 2, 3].forEach((i) => {
    const num = turn[`dart${i}_number`];
    const mod = turn[`dart${i}_modifier`];
    if (num !== null && num !== undefined) {
      if (num === "Miss") darts.push("Miss");
      else if (num === "Bull") darts.push("Bull");
      else if (num === "DBull") darts.push("D·Bull");
      else {
        const prefix = mod === "double" ? "D" : mod === "triple" ? "T" : "";
        darts.push(`${prefix}${num}`);
      }
    }
  });

  return (
    <div className="turn-row">
      <span className="turn-row__player">{player?.name?.split(" ")[0] || "?"}</span>
      <span className="turn-row__darts">{darts.join("  ") || "—"}</span>
      <span className="turn-row__score">
        {turn.is_bust
          ? <span className="turn-bust">BUST</span>
          : turn.score !== null && turn.score !== undefined
          ? `+${turn.score}`
          : ""}
      </span>
      <span className="turn-row__remaining">{turn.score_remaining ?? ""}</span>
    </div>
  );
}

export default function DesktopLiveMatch({ supabase }) {
  const [matches, setMatches] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [match, setMatch] = useState(null);
  const [legs, setLegs] = useState([]);
  const [turns, setTurns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load match list on mount + auto-refresh
  useEffect(() => {
    loadMatches();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadMatches();
      if (selectedMatchId) loadMatchDetail(selectedMatchId);
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, selectedMatchId]);

  // Load detail whenever selected match changes
  useEffect(() => {
    if (selectedMatchId) loadMatchDetail(selectedMatchId);
  }, [selectedMatchId]);

  async function loadMatches() {
    // matches has no updated_at — order by started_at desc
    const { data, error } = await supabase
      .from("matches")
      .select("id, status, game_type, player1_id, player2_id, player1_legs, player2_legs, started_at, winner_id")
      .in("status", ["in_progress", "completed"])
      .order("started_at", { ascending: false })
      .limit(20);

    if (error) { console.error("loadMatches error:", error); return; }

    // Load player names separately (avoids FK alias issues)
    const playerIds = [...new Set((data || []).flatMap(m => [m.player1_id, m.player2_id]))];
    const { data: playerRows } = await supabase.from("players").select("id, name").in("id", playerIds);
    const playerMap = Object.fromEntries((playerRows || []).map(p => [p.id, p]));

    const enriched = (data || []).map(m => ({
      ...m,
      player1: playerMap[m.player1_id] || { id: m.player1_id, name: "Player 1" },
      player2: playerMap[m.player2_id] || { id: m.player2_id, name: "Player 2" },
    }));

    setMatches(enriched);
    setLoading(false);

    // Auto-select the first in_progress match, or first overall
    if (!selectedMatchId && enriched.length > 0) {
      const live = enriched.find(m => m.status === "in_progress") || enriched[0];
      setSelectedMatchId(live.id);
    }
  }

  async function loadMatchDetail(matchId) {
    // Get match with player info
    const { data: playerIds } = await supabase
      .from("matches")
      .select("player1_id, player2_id, player1_legs, player2_legs, status, winner_id")
      .eq("id", matchId)
      .single();

    const { data: matchRow } = await supabase
      .from("matches")
      .select("*")
      .eq("id", matchId)
      .single();

    const { data: playerRows } = await supabase
      .from("players")
      .select("id, name")
      .in("id", [matchRow?.player1_id, matchRow?.player2_id].filter(Boolean));

    const playerMap = Object.fromEntries((playerRows || []).map(p => [p.id, p]));

    const enrichedMatch = matchRow ? {
      ...matchRow,
      player1: playerMap[matchRow.player1_id],
      player2: playerMap[matchRow.player2_id],
    } : null;

    const { data: legRows } = await supabase
      .from("legs")
      .select("*")
      .eq("match_id", matchId)
      .order("leg_number");

    const { data: turnRows } = await supabase
      .from("turns")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(40);

    setMatch(enrichedMatch);
    setLegs(legRows || []);
    setTurns(turnRows || []);
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const currentLeg = legs.find(l => l.status === "in_progress") || legs[legs.length - 1];
  const isCurrentCricket = currentLeg?.game_type === "cricket";

  const p1 = match?.player1;
  const p2 = match?.player2;
  const p1Legs = match?.player1_legs || 0;
  const p2Legs = match?.player2_legs || 0;

  // Build cricket board state from all turns in current leg
  function buildCricketState(playerId) {
    const legTurns = turns.filter(t => t.leg_id === currentLeg?.id && t.player_id === playerId);
    // Marks are stored cumulatively per turn — use the latest turn for each number
    // Points are stored as delta per turn — sum them
    if (legTurns.length === 0) return { board: {}, points: 0 };

    // Sort ascending to get latest
    const sorted = [...legTurns].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const latest = sorted[sorted.length - 1];

    const board = {
      20: latest.cricket_20 || 0,
      19: latest.cricket_19 || 0,
      18: latest.cricket_18 || 0,
      17: latest.cricket_17 || 0,
      16: latest.cricket_16 || 0,
      15: latest.cricket_15 || 0,
      "Bull": (latest.cricket_bull || 0) + (latest.cricket_dbull || 0) * 2,
    };

    // Cap at 3
    Object.keys(board).forEach(k => { board[k] = Math.min(3, board[k]); });

    const points = sorted.reduce((sum, t) => sum + (t.cricket_points || 0), 0);
    return { board, points };
  }

  // Get 501 remaining for a player from the current leg
  function get501Remaining(playerId) {
    const legTurns = turns.filter(t =>
      t.leg_id === currentLeg?.id &&
      t.player_id === playerId &&
      t.score_remaining !== null
    );
    if (legTurns.length === 0) return currentLeg?.starting_score ?? 501;
    // Most recent turn = lowest created_at in our DESC ordered array
    return legTurns[0].score_remaining;
  }

  // Whose turn is it — look at the most recent turn across all players in this leg
  function getCurrentTurnPlayerId() {
    const legTurns = turns.filter(t => t.leg_id === currentLeg?.id);
    if (legTurns.length === 0) return match?.player1_id; // default: p1 goes first
    const lastTurn = legTurns[0]; // turns are DESC so [0] is most recent
    // If the last turn was p1, it's now p2's turn and vice versa
    return lastTurn.player_id === match?.player1_id ? match?.player2_id : match?.player1_id;
  }

  const currentTurnPlayerId = match ? getCurrentTurnPlayerId() : null;
  const legTurnsForLog = turns.filter(t => t.leg_id === currentLeg?.id);

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
        <div className="dlm-empty__sub">Start a match on the mobile app and it will appear here automatically.</div>
      </div>
    );
  }

  return (
    <div className="dlm">
      {/* Match selector */}
      <div className="dlm__selector">
        <span className="dlm__selector-label">Select Match</span>
        <div className="dlm__selector-chips">
          {matches.map((m) => (
            <button
              key={m.id}
              className={`match-chip ${selectedMatchId === m.id ? "match-chip--active" : ""} ${m.status === "in_progress" ? "match-chip--live" : ""}`}
              onClick={() => setSelectedMatchId(m.id)}
            >
              {m.status === "in_progress" && <span className="live-dot" />}
              {m.player1?.name?.split(" ")[0]} vs {m.player2?.name?.split(" ")[0]}
            </button>
          ))}
        </div>
        <label className="auto-refresh-toggle">
          <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
          Live refresh
        </label>
      </div>

      {match && (
        <div className="dlm__main">
          {/* Big scoreboard */}
          <div className="dlm__scoreboard">
            <div className={`dlm__player-side ${currentTurnPlayerId === match.player1_id && match.status === "in_progress" ? "dlm__player-side--active" : ""}`}>
              <div className="dlm__player-name">{p1?.name}</div>
              <div className="dlm__legs-score">{p1Legs}</div>
              {!isCurrentCricket && currentLeg && (
                <div className="dlm__remaining">
                  {get501Remaining(match.player1_id)}
                  <span className="dlm__remaining-label">left</span>
                </div>
              )}
              {currentTurnPlayerId === match.player1_id && match.status === "in_progress" && (
                <div className="dlm__turn-indicator"><span className="live-dot" /> THROWING</div>
              )}
            </div>

            <div className="dlm__center">
              <div className="dlm__leg-label">Leg</div>
              <div className="dlm__leg-count">{legs.length}<span className="dlm__leg-of"> of 5</span></div>
              <div className="dlm__game-type">{currentLeg?.game_type?.toUpperCase() || "—"}</div>
              <div className="dlm__status-badge">
                {match.status === "in_progress"
                  ? <><span className="live-dot" /> LIVE</>
                  : "COMPLETED"}
              </div>
            </div>

            <div className={`dlm__player-side dlm__player-side--right ${currentTurnPlayerId === match.player2_id && match.status === "in_progress" ? "dlm__player-side--active" : ""}`}>
              <div className="dlm__player-name">{p2?.name}</div>
              <div className="dlm__legs-score">{p2Legs}</div>
              {!isCurrentCricket && currentLeg && (
                <div className="dlm__remaining">
                  {get501Remaining(match.player2_id)}
                  <span className="dlm__remaining-label">left</span>
                </div>
              )}
              {currentTurnPlayerId === match.player2_id && match.status === "in_progress" && (
                <div className="dlm__turn-indicator"><span className="live-dot" /> THROWING</div>
              )}
            </div>
          </div>

          {/* Leg dots */}
          <div className="dlm__legs-bar">
            {[1, 2, 3, 4, 5].map((n) => {
              const leg = legs.find(l => l.leg_number === n);
              let cls = "leg-dot--pending";
              if (leg?.status === "in_progress") cls = "leg-dot--live";
              else if (leg?.status === "completed") {
                cls = leg.winner_id === match.player1_id ? "leg-dot--p1" : "leg-dot--p2";
              }
              return (
                <div key={n} className={`leg-dot ${cls}`}>
                  <span>{n}</span>
                  {leg?.game_type && <span className="leg-dot__type">{leg.game_type === "501" ? "501" : "CR"}</span>}
                </div>
              );
            })}
          </div>

          {/* Bottom: boards or throw log + leg history */}
          <div className="dlm__bottom">
            {isCurrentCricket ? (
              <div className="dlm__cricket-boards">
                {[match.player1_id, match.player2_id].map((pid) => {
                  const { board, points } = buildCricketState(pid);
                  const playerObj = pid === match.player1_id ? p1 : p2;
                  return (
                    <CricketBoard
                      key={pid}
                      board={board}
                      points={points}
                      playerName={playerObj?.name}
                      isActive={currentTurnPlayerId === pid && match.status === "in_progress"}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="dlm__throw-log">
                <div className="throw-log__header">
                  <span>Player</span>
                  <span>Darts</span>
                  <span>Score</span>
                  <span>Remaining</span>
                </div>
                {legTurnsForLog.slice(0, 20).map((t) => (
                  <TurnRow key={t.id} turn={t} p1={p1} p2={p2} />
                ))}
                {legTurnsForLog.length === 0 && (
                  <div className="throw-log__empty">No throws recorded yet in this leg.</div>
                )}
              </div>
            )}

            {/* Leg history panel */}
            <div className="dlm__leg-history">
              <div className="leg-history__title">Leg Results</div>
              {legs.filter(l => l.status === "completed").length === 0 && (
                <div className="leg-history__empty">No completed legs yet</div>
              )}
              {legs.filter(l => l.status === "completed").map((leg) => {
                const winner = leg.winner_id === match.player1_id ? p1 : p2;
                return (
                  <div className="leg-result" key={leg.id}>
                    <span className="leg-result__num">Leg {leg.leg_number}</span>
                    <span className="leg-result__type">{leg.game_type?.toUpperCase()}</span>
                    <span className="leg-result__winner">🏆 {winner?.name?.split(" ")[0]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
