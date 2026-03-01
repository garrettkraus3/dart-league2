import { useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, "Bull"];
const LEG_SCHEDULE    = ["501", "501", "cricket", "cricket", "choice"];
const NUMBERS         = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,"Bull"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getLegGameType(legNumber, chosenLeg5) {
  const s = LEG_SCHEDULE[legNumber - 1];
  return s === "choice" ? (chosenLeg5 || null) : s;
}

function dartValue(number, modifier) {
  if (number === null) return 0;
  if (number === "Bull") return modifier === "double" ? 50 : 25;
  const n = parseInt(number);
  if (modifier === "triple") return n * 3;
  if (modifier === "double") return n * 2;
  return n;
}

function isBust(remaining, darts) {
  // remaining after this turn's darts so far
  // bust if: goes below 0, hits exactly 1, or reaches 0 on non-double
  const total = darts.reduce((s, d) => s + dartValue(d.number, d.modifier), 0);
  const newRemaining = remaining - total;
  if (newRemaining < 0) return true;
  if (newRemaining === 1) return true;
  if (newRemaining === 0) {
    const last = darts[darts.length - 1];
    if (!last) return false;
    // Must finish on double or double bull
    return last.modifier !== "double";
  }
  return false;
}

function canCheckout(remaining) {
  // Can you check out from this score? (double out, max 3 darts)
  // Rough check: possible if remaining <= 170 and not 169, 168, 166, 165, 163, 162, 159
  const impossible = [169,168,166,165,163,162,159];
  return remaining <= 170 && !impossible.includes(remaining);
}

// ─── Dartboard SVG constants ──────────────────────────────────────────────────
// Standard dartboard clockwise order starting from top
const BOARD_ORDER = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];

function DartboardSVG({ onSelect, disabled, modifier, cricketOnly }) {
  const cx = 160, cy = 160, r = 155;
  const segments = BOARD_ORDER.length;
  const segAngle = (2 * Math.PI) / segments;
  const startOffset = -Math.PI / 2 - segAngle / 2;

  // Radii for each ring
  const R = {
    bullseye: 12,
    bull:     22,
    inner:    60,
    triple:   72,
    outer:    110,
    double:   122,
  };

  const polarToXY = (angle, radius) => ({
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  });

  const arcPath = (r1, r2, a1, a2) => {
    const p1 = polarToXY(a1, r1);
    const p2 = polarToXY(a2, r1);
    const p3 = polarToXY(a2, r2);
    const p4 = polarToXY(a1, r2);
    return `M ${p1.x} ${p1.y} A ${r1} ${r1} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${r2} ${r2} 0 0 0 ${p4.x} ${p4.y} Z`;
  };

  const handleSegmentClick = (num, ring) => {
    if (disabled) return;
    if (cricketOnly && !CRICKET_NUMBERS.includes(num)) return;
    // ring: "single", "double", "triple"
    const mod = modifier || "single";
    if (num === "Bull") {
      onSelect({ number: "Bull", modifier: mod === "triple" ? "double" : mod });
    } else {
      onSelect({ number: num, modifier: mod });
    }
  };

  const isActive = (num) => !cricketOnly || CRICKET_NUMBERS.includes(num);
  const dimmed = disabled ? 0.4 : 1;

  return (
    <svg
      viewBox="0 0 320 320"
      width="100%"
      style={{ maxWidth: 320, opacity: dimmed, touchAction: "manipulation" }}
    >
      {/* Outer miss ring */}
      <circle cx={cx} cy={cy} r={r} fill="#111" />

      {BOARD_ORDER.map((num, i) => {
        const a1 = startOffset + i * segAngle;
        const a2 = a1 + segAngle;
        const even = i % 2 === 0;
        const baseColor = even ? "#1a1a1a" : "#e8c840";
        const altColor  = even ? "#c0392b" : "#1a1a1a";
        const faded = !isActive(num) ? 0.25 : 1;

        // Label position — middle of outer single ring
        const labelAngle = a1 + segAngle / 2;
        const labelR = (R.double + r) / 2;
        const lp = polarToXY(labelAngle, labelR);

        return (
          <g key={num} opacity={faded}>
            {/* Single inner */}
            <path
              d={arcPath(R.triple, R.inner, a1, a2)}
              fill={baseColor}
              stroke="#333" strokeWidth="0.5"
              onClick={() => handleSegmentClick(num, "single")}
              style={{ cursor: disabled || !isActive(num) ? "default" : "pointer" }}
            />
            {/* Triple ring */}
            <path
              d={arcPath(R.double, R.triple, a1, a2)}
              fill={altColor}
              stroke="#333" strokeWidth="0.5"
              onClick={() => !disabled && isActive(num) && modifier === "triple"
                ? handleSegmentClick(num, "triple")
                : handleSegmentClick(num, "single")}
              style={{ cursor: disabled || !isActive(num) ? "default" : "pointer" }}
            />
            {/* Single outer */}
            <path
              d={arcPath(R.outer, R.double, a1, a2)}
              fill={baseColor}
              stroke="#333" strokeWidth="0.5"
              onClick={() => handleSegmentClick(num, "single")}
              style={{ cursor: disabled || !isActive(num) ? "default" : "pointer" }}
            />
            {/* Double ring */}
            <path
              d={arcPath(r - 10, R.outer, a1, a2)}
              fill={altColor}
              stroke="#333" strokeWidth="0.5"
              onClick={() => !disabled && isActive(num) && modifier === "double"
                ? handleSegmentClick(num, "double")
                : handleSegmentClick(num, "single")}
              style={{ cursor: disabled || !isActive(num) ? "default" : "pointer" }}
            />
            {/* Number label */}
            <text
              x={lp.x} y={lp.y}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="10" fontWeight="bold"
              fill={isActive(num) ? "#fff" : "#555"}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              {num}
            </text>
          </g>
        );
      })}

      {/* Bull outer (25) */}
      <circle
        cx={cx} cy={cy} r={R.bull}
        fill="#c0392b" stroke="#333" strokeWidth="0.5"
        onClick={() => !disabled && onSelect({ number: "Bull", modifier: "single" })}
        style={{ cursor: disabled ? "default" : "pointer" }}
      />
      {/* Bullseye (50) */}
      <circle
        cx={cx} cy={cy} r={R.bullseye}
        fill="#1a7a1a" stroke="#333" strokeWidth="0.5"
        onClick={() => !disabled && onSelect({ number: "Bull", modifier: "double" })}
        style={{ cursor: disabled ? "default" : "pointer" }}
      />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        fontSize="7" fill="#fff" style={{ pointerEvents: "none", userSelect: "none" }}>
        🎯
      </text>

      {/* Modifier ring overlays — highlight active ring */}
      {modifier === "double" && (
        <circle cx={cx} cy={cy} r={r - 5} fill="none" stroke="#e8c840" strokeWidth="3" opacity="0.5" />
      )}
      {modifier === "triple" && (
        <>
          <circle cx={cx} cy={cy} r={R.double}  fill="none" stroke="#e8c840" strokeWidth="3" opacity="0.5" />
          <circle cx={cx} cy={cy} r={R.triple}  fill="none" stroke="#e8c840" strokeWidth="3" opacity="0.5" />
        </>
      )}
    </svg>
  );
}

// ─── Shared Modifier Row ───────────────────────────────────────────────────────
function ModifierRow({ modifier, setModifier, onMiss, disabled }) {
  return (
    <div className="modifier-row">
      {["single","double","triple"].map(m => (
        <button
          key={m}
          className={`modifier-btn ${modifier === m ? "active" : ""} ${m}`}
          onClick={() => !disabled && setModifier(modifier === m ? null : m)}
          disabled={disabled}
        >
          {m === "single" ? "S" : m === "double" ? "D" : "T"}
        </button>
      ))}
      <button className="modifier-btn miss" onClick={() => !disabled && onMiss()} disabled={disabled}>
        Miss
      </button>
    </div>
  );
}

// ─── Dart Input Component (501) ───────────────────────────────────────────────
function DartInput({ onSelect, disabled, inputMode }) {
  const [modifier, setModifier] = useState("single");

  const handleMiss = () => onSelect({ number: "Miss", modifier: "miss" });

  const selectNumber = (num) => {
    if (!modifier) return;
    if (num === "Bull" && modifier === "triple") return;
    onSelect({ number: num, modifier });
  };

  // Numbers in 20→1 order
  const numOrder = [20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1];

  if (inputMode === "board") {
    return (
      <div className={`dart-input-panel ${disabled ? "disabled" : ""}`}>
        <ModifierRow modifier={modifier} setModifier={setModifier} onMiss={handleMiss} disabled={disabled} />
        <div style={{ padding: "0 0.5rem" }}>
          <DartboardSVG onSelect={onSelect} disabled={disabled} modifier={modifier} cricketOnly={false} />
        </div>
      </div>
    );
  }

  return (
    <div className={`dart-input-panel ${disabled ? "disabled" : ""}`}>
      <ModifierRow modifier={modifier} setModifier={setModifier} onMiss={handleMiss} disabled={disabled} />
      <div className={`number-grid ${!modifier ? "locked" : ""}`}>
        {numOrder.map(n => (
          <button
            key={n}
            className="number-btn"
            onClick={() => selectNumber(n)}
            disabled={disabled || !modifier}
          >
            {n}
          </button>
        ))}
        <button
          className="number-btn bull-btn"
          onClick={() => selectNumber("Bull")}
          disabled={disabled || !modifier || modifier === "triple"}
        >
          Bull
        </button>
      </div>
    </div>
  );
}

// ─── Cricket Dart Input ───────────────────────────────────────────────────────
function CricketDartInput({ onSelect, disabled, inputMode }) {
  const [modifier, setModifier] = useState("single");

  const handleMiss = () => onSelect({ number: "Miss", modifier: "miss" });

  const selectNumber = (num) => {
    if (!modifier) return;
    if (num === "Bull" && modifier === "triple") return;
    onSelect({ number: num, modifier });
  };

  if (inputMode === "board") {
    return (
      <div className={`dart-input-panel ${disabled ? "disabled" : ""}`}>
        <ModifierRow modifier={modifier} setModifier={setModifier} onMiss={handleMiss} disabled={disabled} />
        <div style={{ padding: "0 0.5rem" }}>
          <DartboardSVG onSelect={onSelect} disabled={disabled} modifier={modifier} cricketOnly={true} />
        </div>
      </div>
    );
  }

  return (
    <div className={`dart-input-panel ${disabled ? "disabled" : ""}`}>
      <ModifierRow modifier={modifier} setModifier={setModifier} onMiss={handleMiss} disabled={disabled} />
      <div className={`cricket-number-grid ${!modifier ? "locked" : ""}`}>
        {CRICKET_NUMBERS.map(num => (
          <button
            key={num}
            className="cricket-num-btn"
            onClick={() => selectNumber(num)}
            disabled={disabled || !modifier || (modifier === "triple" && num === "Bull")}
          >
            {num}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ActiveMatch({ match, players, supabase, navigate }) {
  const { currentLeg: initialLeg } = match;
  const [currentLeg, setCurrentLeg]     = useState(initialLeg);
  const [matchData]                      = useState(match.match);
  const [legNumber, setLegNumber]        = useState(1);
  const [turnNumber, setTurnNumber]      = useState(1);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(null);
  const [legScores, setLegScores]        = useState({
    [match.match.player1_id]: 0,
    [match.match.player2_id]: 0,
  });
  const [chosenLeg5Type, setChosenLeg5Type]       = useState(null);
  const [awaitingLeg5Choice, setAwaitingLeg5Choice] = useState(false);
  const [awaitingFirstThrow, setAwaitingFirstThrow] = useState(true);

  const currentGameType = getLegGameType(legNumber, chosenLeg5Type);
  const isXO1 = currentGameType === "501";

  // 501 state
  const [xo1Scores, setXo1Scores] = useState({
    [match.match.player1_id]: 501,
    [match.match.player2_id]: 501,
  });

  // Cricket state: marks per number, points
  const initCricket = () => ({
    [match.match.player1_id]: { 20:0,19:0,18:0,17:0,16:0,15:0,Bull:0,points:0 },
    [match.match.player2_id]: { 20:0,19:0,18:0,17:0,16:0,15:0,Bull:0,points:0 },
  });
  const [cricketState, setCricketState] = useState(initCricket());

  // Current turn darts: array of up to 3 { number, modifier }
  const [darts, setDarts]           = useState([]);
  const [turnBust, setTurnBust]     = useState(false);
  const [turnWin, setTurnWin]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [matchOver, setMatchOver]   = useState(false);
  const [winner, setWinner]         = useState(null);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const [bustMessage, setBustMessage] = useState("");
  const [inputMode, setInputMode]   = useState("list"); // "list" | "board"

  const p1 = players.find(p => p.id === match.match.player1_id);
  const p2 = players.find(p => p.id === match.match.player2_id);
  const playerOrder   = [match.match.player1_id, match.match.player2_id];
  const currentPlayerId = currentPlayerIdx !== null ? playerOrder[currentPlayerIdx] : null;
  const currentPlayer   = currentPlayerId === match.match.player1_id ? p1 : p2;
  const opponentId      = currentPlayerId ? playerOrder[1 - currentPlayerIdx] : null;

  // ── Live score calculations ────────────────────────────────────────────────
  const turnScore501 = darts.reduce((s, d) => s + dartValue(d.number, d.modifier), 0);
  const remaining501 = currentPlayerId ? Math.max(0, xo1Scores[currentPlayerId] - turnScore501) : 501;

  // ── Dart entry handlers ────────────────────────────────────────────────────
  const handleDart501 = (dart) => {
    if (darts.length >= 3 || turnBust || turnWin) return;

    const newDarts = [...darts, dart];
    const totalSoFar = newDarts.reduce((s, d) => s + dartValue(d.number, d.modifier), 0);
    const newRemaining = xo1Scores[currentPlayerId] - totalSoFar;

    let bust = false;
    let win  = false;

    if (dart.number === "Miss") {
      // Miss — no score, no bust
    } else if (newRemaining < 0 || newRemaining === 1) {
      bust = true;
      setBustMessage(newRemaining < 0 ? "Bust! Score exceeded." : "Bust! Can't finish on 1.");
    } else if (newRemaining === 0) {
      if (dart.modifier !== "double") {
        bust = true;
        setBustMessage("Bust! Must finish on a double.");
      } else {
        win = true;
      }
    }

    setDarts(newDarts);
    if (bust) setTurnBust(true);
    if (win)  setTurnWin(true);

    // Auto-submit after 3 darts, bust, or win
    if (newDarts.length === 3 || bust || win) {
      setTimeout(() => submitTurn501(newDarts, bust, win, currentPlayerId), 400);
    }
  };

  const handleDartCricket = (dart) => {
    if (darts.length >= 3 || turnWin) return;
    const newDarts = [...darts, dart];
    setDarts(newDarts);

    // Apply marks to cricket state and check win
    const { newCricket, win } = applyCricketDart(dart, cricketState, currentPlayerId, opponentId);
    setCricketState(newCricket);
    if (win) setTurnWin(true);

    if (newDarts.length === 3 || win) {
      setTimeout(() => submitTurnCricket(newDarts, newCricket, win, currentPlayerId), 400);
    }
  };

  const applyCricketDart = (dart, state, myId, oppId) => {
    if (dart.number === "Miss") return { newCricket: state, win: false };

    const num = dart.number;
    if (!CRICKET_NUMBERS.includes(num)) return { newCricket: state, win: false };

    const newCricket = JSON.parse(JSON.stringify(state));
    const marks = dart.modifier === "triple" ? 3 : dart.modifier === "double" ? 2 : 1;
    const myMarks  = newCricket[myId][num];
    const oppMarks = newCricket[oppId][num];
    const pointVal = num === "Bull" ? 25 : parseInt(num);

    if (myMarks < 3) {
      // Still closing — some marks close, overflow scores points
      const closing   = Math.min(marks, 3 - myMarks);
      const overflow  = marks - closing;
      newCricket[myId][num] = myMarks + closing;
      if (overflow > 0 && oppMarks < 3) {
        newCricket[myId].points += overflow * pointVal;
      }
    } else {
      // Already closed — score points if opponent hasn't closed
      if (oppMarks < 3) {
        newCricket[myId].points += marks * pointVal;
      }
    }

    // Check win: all numbers closed AND my points >= opponent points
    const allClosed = CRICKET_NUMBERS.every(n => newCricket[myId][n] >= 3);
    const win = allClosed && newCricket[myId].points >= newCricket[oppId].points;
    return { newCricket, win };
  };

  // ── Submit 501 turn ────────────────────────────────────────────────────────
  const submitTurn501 = async (submittedDarts, bust, win, playerId) => {
    setLoading(true);
    const scored = bust ? 0 : submittedDarts.reduce((s, d) => s + dartValue(d.number, d.modifier), 0);
    const prevRemaining = xo1Scores[playerId];
    const newRemaining  = bust ? prevRemaining : prevRemaining - scored;

    const d = submittedDarts;
    const turnData = {
      leg_id:    currentLeg.id,
      match_id:  matchData.id,
      player_id: playerId,
      turn_number: turnNumber,
      score:     scored,
      score_remaining: newRemaining,
      is_bust:   bust,
      is_checkout_attempt: canCheckout(prevRemaining) && prevRemaining <= 170,
      is_checkout_success: win,
      checkout_dart: win ? d.length : null,
      darts_thrown: d.length,
      dart1_number:   d[0]?.number || null,
      dart1_modifier: d[0]?.modifier || null,
      dart1_value:    d[0] ? dartValue(d[0].number, d[0].modifier) : null,
      dart2_number:   d[1]?.number || null,
      dart2_modifier: d[1]?.modifier || null,
      dart2_value:    d[1] ? dartValue(d[1].number, d[1].modifier) : null,
      dart3_number:   d[2]?.number || null,
      dart3_modifier: d[2]?.modifier || null,
      dart3_value:    d[2] ? dartValue(d[2].number, d[2].modifier) : null,
    };

    await supabase.from("turns").insert(turnData);

    if (!bust) {
      setXo1Scores(prev => ({ ...prev, [playerId]: newRemaining }));
    }

    if (win) {
      await completeLeg(playerId);
    } else {
      advanceTurn();
    }
    setLoading(false);
  };

  // ── Submit Cricket turn ────────────────────────────────────────────────────
  const submitTurnCricket = async (submittedDarts, finalCricket, win, playerId) => {
    setLoading(true);
    const d = submittedDarts;

    // Calculate total marks and points this turn
    const turnPoints = finalCricket[playerId].points - cricketState[playerId].points;

    const turnData = {
      leg_id:    currentLeg.id,
      match_id:  matchData.id,
      player_id: playerId,
      turn_number: turnNumber,
      cricket_points: turnPoints,
      darts_thrown: d.length,
      dart1_number:   d[0]?.number || null,
      dart1_modifier: d[0]?.modifier || null,
      dart1_value:    d[0] && d[0].number !== "Miss" ? (CRICKET_NUMBERS.includes(d[0].number) ? 1 : 0) : 0,
      dart2_number:   d[1]?.number || null,
      dart2_modifier: d[1]?.modifier || null,
      dart2_value:    d[1] && d[1].number !== "Miss" ? (CRICKET_NUMBERS.includes(d[1].number) ? 1 : 0) : 0,
      dart3_number:   d[2]?.number || null,
      dart3_modifier: d[2]?.modifier || null,
      dart3_value:    d[2] && d[2].number !== "Miss" ? (CRICKET_NUMBERS.includes(d[2].number) ? 1 : 0) : 0,
      // Cricket mark columns
      cricket_15:   countMarks(d, 15),
      cricket_16:   countMarks(d, 16),
      cricket_17:   countMarks(d, 17),
      cricket_18:   countMarks(d, 18),
      cricket_19:   countMarks(d, 19),
      cricket_20:   countMarks(d, 20),
      cricket_bull: countMarks(d, "Bull"),
    };

    await supabase.from("turns").insert(turnData);

    if (win) {
      await completeLeg(playerId);
    } else {
      advanceTurn();
    }
    setLoading(false);
  };

  const countMarks = (darts, num) => {
    return darts.reduce((s, d) => {
      if (d.number !== num) return s;
      return s + (d.modifier === "triple" ? 3 : d.modifier === "double" ? 2 : 1);
    }, 0);
  };

  const advanceTurn = () => {
    setDarts([]);
    setTurnBust(false);
    setTurnWin(false);
    setBustMessage("");
    const nextIdx = 1 - currentPlayerIdx;
    setCurrentPlayerIdx(nextIdx);
    setTurnNumber(prev => prev + (nextIdx === 0 ? 1 : 0));
  };

  // ── Complete leg ───────────────────────────────────────────────────────────
  const completeLeg = async (winnerId) => {
    await supabase.from("legs").update({
      winner_id: winnerId,
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", currentLeg.id);

    const newLegScores = { ...legScores, [winnerId]: legScores[winnerId] + 1 };
    setLegScores(newLegScores);

    const p1Legs = newLegScores[match.match.player1_id];
    const p2Legs = newLegScores[match.match.player2_id];
    await supabase.from("matches").update({ player1_legs: p1Legs, player2_legs: p2Legs }).eq("id", matchData.id);

    if (p1Legs >= 3 || p2Legs >= 3) {
      await supabase.from("matches").update({
        winner_id: winnerId,
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", matchData.id);
      setWinner(players.find(p => p.id === winnerId));
      setMatchOver(true);
      return;
    }

    const nextLegNum = legNumber + 1;
    setLegNumber(nextLegNum);
    const loserId  = playerOrder.find(id => id !== winnerId);
    const loserIdx = playerOrder.indexOf(loserId);

    if (nextLegNum === 5) {
      const { data: newLeg } = await supabase.from("legs").insert({
        match_id: matchData.id, leg_number: 5, starting_score: null, game_type: null,
      }).select().single();
      setCurrentLeg(newLeg);
      setAwaitingLeg5Choice(true);
    } else {
      const nextType = LEG_SCHEDULE[nextLegNum - 1];
      const { data: newLeg } = await supabase.from("legs").insert({
        match_id: matchData.id,
        leg_number: nextLegNum,
        starting_score: nextType === "501" ? 501 : null,
        game_type: nextType,
      }).select().single();
      setCurrentLeg(newLeg);
      setCurrentPlayerIdx(loserIdx);
    }

    setTurnNumber(1);
    setDarts([]);
    setTurnBust(false);
    setTurnWin(false);
    setBustMessage("");
    setXo1Scores({ [match.match.player1_id]: 501, [match.match.player2_id]: 501 });
    setCricketState(initCricket());
  };

  const abandonMatch = async () => {
    setLoading(true);
    await supabase.from("turns").delete().eq("match_id", matchData.id);
    await supabase.from("legs").delete().eq("match_id", matchData.id);
    await supabase.from("matches").delete().eq("id", matchData.id);
    setLoading(false);
    navigate("home");
  };

  const chooseFirstThrow = (playerId) => {
    setCurrentPlayerIdx(playerOrder.indexOf(playerId));
    setAwaitingFirstThrow(false);
  };

  // ── Who throws first ───────────────────────────────────────────────────────
  if (awaitingFirstThrow) {
    return (
      <div className="screen">
        <div className="screen-header"><h2>{legNumber === 5 ? "⚡ Leg 5 — Decider" : "Leg 1"}</h2></div>
        <div className="leg5-choice">
          <p className="leg5-sub">Who throws first?</p>
          {legNumber === 5 && (
            <div className="leg5-scores">
              <span>{p1?.name}: {legScores[match.match.player1_id]}</span>
              <span>{p2?.name}: {legScores[match.match.player2_id]}</span>
            </div>
          )}
          <button className="btn-primary big-btn" onClick={() => chooseFirstThrow(match.match.player1_id)}>🎯 {p1?.name}</button>
          <button className="btn-secondary big-btn" onClick={() => chooseFirstThrow(match.match.player2_id)}>🎯 {p2?.name}</button>
        </div>
      </div>
    );
  }

  // ── Leg 5 game choice ──────────────────────────────────────────────────────
  if (awaitingLeg5Choice) {
    return (
      <div className="screen">
        <div className="screen-header"><h2>⚡ Leg 5 — Choose Game</h2></div>
        <div className="leg5-choice">
          <p className="leg5-sub">What are you playing?</p>
          <div className="leg5-scores">
            <span>{p1?.name}: {legScores[match.match.player1_id]}</span>
            <span>{p2?.name}: {legScores[match.match.player2_id]}</span>
          </div>
          <button className="btn-primary big-btn" onClick={() => { setChosenLeg5Type("501"); setAwaitingLeg5Choice(false); setAwaitingFirstThrow(true); }}>🎯 501</button>
          <button className="btn-secondary big-btn" onClick={() => { setChosenLeg5Type("cricket"); setAwaitingLeg5Choice(false); setAwaitingFirstThrow(true); }}>🏏 Cricket</button>
        </div>
      </div>
    );
  }

  // ── Match over ─────────────────────────────────────────────────────────────
  if (matchOver) {
    return (
      <div className="screen winner-screen">
        <div className="winner-content">
          <div className="winner-trophy">🏆</div>
          <h1 className="winner-name">{winner?.name}</h1>
          <p className="winner-sub">WINS THE MATCH!</p>
          <div className="final-score">{legScores[match.match.player1_id]} — {legScores[match.match.player2_id]}</div>
          <button className="btn-primary big-btn" onClick={() => navigate("home")}>Back to Home</button>
        </div>
      </div>
    );
  }

  // ── Dart display strip ─────────────────────────────────────────────────────
  const DartStrip = () => (
    <div className="dart-strip">
      {[0, 1, 2].map(i => {
        const d = darts[i];
        const isCurrent = i === darts.length && !turnBust && !turnWin;
        let label = "·";
        let cls = "dart-slot empty";
        if (d) {
          if (d.number === "Miss") {
            label = "Miss";
            cls = "dart-slot miss";
          } else {
            const prefix = d.modifier === "double" ? "D" : d.modifier === "triple" ? "T" : "";
            label = `${prefix}${d.number}`;
            cls = `dart-slot filled ${d.modifier}`;
          }
        }
        if (isCurrent) cls += " current";
        return <div key={i} className={cls}>{d ? label : isCurrent ? `Dart ${i+1}` : "·"}</div>;
      })}
    </div>
  );

  // ── 501 scoreboard ─────────────────────────────────────────────────────────
  const XO1Scoreboard = () => {
    const myScore    = xo1Scores[currentPlayerId];
    const oppScore   = xo1Scores[opponentId];
    const liveRemain = turnBust ? myScore : Math.max(0, myScore - turnScore501);

    return (
      <div className="scoreboard xo1-board">
        <div className={`player-score active-player`}>
          <div className="player-name">{currentPlayer?.name}</div>
          <div className={`score-big ${turnBust ? "bust-score" : ""}`}>{liveRemain}</div>
          <div className="legs-count">Legs: {legScores[currentPlayerId]}</div>
          {turnBust && <div className="bust-label">BUST</div>}
          {canCheckout(myScore) && !turnBust && myScore > 1 && <div className="checkout-label">Checkout!</div>}
        </div>
        <div className="score-divider">
          <div className="leg-label">Leg {legNumber} · 501</div>
          <div className="vs-label">vs</div>
        </div>
        <div className="player-score">
          <div className="player-name">{(opponentId === match.match.player1_id ? p1 : p2)?.name}</div>
          <div className="score-big">{oppScore}</div>
          <div className="legs-count">Legs: {legScores[opponentId]}</div>
        </div>
      </div>
    );
  };

  // ── Cricket scoreboard ─────────────────────────────────────────────────────
  const CricketScoreboard = () => {
    const myState  = cricketState[currentPlayerId];
    const oppState = cricketState[opponentId];
    const markSymbol = (n) => {
      const m = myState[n];
      if (m === 0) return "○";
      if (m === 1) return "/";
      if (m === 2) return "X";
      return "✓";
    };
    const oppMarkSymbol = (n) => {
      const m = oppState[n];
      if (m === 0) return "○";
      if (m === 1) return "/";
      if (m === 2) return "X";
      return "✓";
    };

    return (
      <div className="cricket-board">
        <div className="cricket-header">
          <span>{currentPlayer?.name}</span>
          <span></span>
          <span>{(opponentId === match.match.player1_id ? p1 : p2)?.name}</span>
        </div>
        <div className="cricket-points-row">
          <span className="cricket-pts">{myState.points}</span>
          <span className="cricket-pts-label">pts</span>
          <span className="cricket-pts">{oppState.points}</span>
        </div>
        {CRICKET_NUMBERS.map(n => (
          <div key={n} className="cricket-score-row">
            <span className={`mark-cell ${myState[n] >= 3 ? "closed" : ""}`}>{markSymbol(n)}</span>
            <span className="cricket-num-label">{n}</span>
            <span className={`mark-cell ${oppState[n] >= 3 ? "closed" : ""}`}>{oppMarkSymbol(n)}</span>
          </div>
        ))}
        <div className="cricket-leg-row">
          <span>Legs: {legScores[currentPlayerId]}</span>
          <span>Leg {legNumber} · Cricket</span>
          <span>Legs: {legScores[opponentId]}</span>
        </div>
      </div>
    );
  };

  // ── Leg progress ───────────────────────────────────────────────────────────
  const LegProgress = () => (
    <div className="leg-progress">
      {LEG_SCHEDULE.map((type, i) => {
        const num    = i + 1;
        const done   = num < legNumber;
        const active = num === legNumber;
        return (
          <div key={i} className={`leg-pip ${done ? "done" : ""} ${active ? "active" : ""}`}>
            <span className="pip-num">{num}</span>
            <span className="pip-type">{type === "choice" ? "?" : type === "501" ? "501" : "CR"}</span>
          </div>
        );
      })}
    </div>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="screen active-match">
      {confirmAbandon && (
        <div className="abandon-overlay">
          <div className="abandon-card">
            <h3>Abandon Match?</h3>
            <p>This will permanently delete all data for this match. It cannot be undone.</p>
            <button className="btn-danger big-btn" onClick={abandonMatch} disabled={loading}>
              {loading ? "Deleting..." : "Yes, Delete It"}
            </button>
            <button className="btn-secondary big-btn" onClick={() => setConfirmAbandon(false)}>Cancel</button>
          </div>
        </div>
      )}

      <LegProgress />

      {isXO1 ? <XO1Scoreboard /> : <CricketScoreboard />}

      <div className="turn-indicator">
        🎯 <strong>{currentPlayer?.name}</strong>'s turn
        {bustMessage && <span className="bust-msg"> — {bustMessage}</span>}
      </div>

      <DartStrip />

      <div className="input-mode-toggle">
        <button
          className={`mode-btn ${inputMode === "list" ? "active" : ""}`}
          onClick={() => setInputMode("list")}
        >
          📋 List
        </button>
        <button
          className={`mode-btn ${inputMode === "board" ? "active" : ""}`}
          onClick={() => setInputMode("board")}
        >
          🎯 Board
        </button>
      </div>

      {isXO1
        ? <DartInput onSelect={handleDart501} disabled={loading || turnBust || turnWin || darts.length >= 3} inputMode={inputMode} />
        : <CricketDartInput onSelect={handleDartCricket} disabled={loading || turnWin || darts.length >= 3} inputMode={inputMode} />
      }

      <button className="btn-abandon" onClick={() => setConfirmAbandon(true)}>
        Abandon Match
      </button>
    </div>
  );
}
