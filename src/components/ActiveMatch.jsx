import { useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, "Bull"];
const NUMBERS         = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,"Bull"];

function dartValue(number, modifier) {
  if (number === null) return 0;
  if (number === "Miss") return 0;
  // Both single bull and double bull = 50 in 501
  if (number === "Bull" || number === "DBull") return 50;
  const n = parseInt(number);
  if (isNaN(n)) return 0;
  if (modifier === "triple") return n * 3;
  if (modifier === "double") return n * 2;
  return n;
}

function isBust(remaining, darts) {
  const total = darts.reduce((s, d) => s + dartValue(d.number, d.modifier), 0);
  const newRemaining = remaining - total;
  if (newRemaining < 0) return true;
  if (newRemaining === 1) return true;
  if (newRemaining === 0) {
    const last = darts[darts.length - 1];
    if (!last) return false;
    // Valid finish: any bull hit (single or double) OR a double
    const isBullFinish = last.number === "Bull" || last.number === "DBull";
    return !isBullFinish && last.modifier !== "double";
  }
  return false;
}

function canCheckout(remaining) {
  const impossible = [169,168,166,165,163,162,159];
  return remaining <= 170 && !impossible.includes(remaining);
}

// Checkout suggestions keyed by remaining score
const CHECKOUTS = {
  170:"T20 T20 Bull", 167:"T20 T19 Bull", 164:"T20 T18 Bull", 161:"T20 T17 Bull",
  160:"T20 T20 D20",  158:"T20 T20 D19",  157:"T20 T19 D20",  156:"T20 T20 D18",
  155:"T20 T19 D19",  154:"T20 T18 D20",  153:"T20 T19 D18",  152:"T20 T20 D16",
  151:"T20 T17 D20",  150:"T20 T18 D18",  149:"T20 T19 D16",  148:"T20 T16 D20",
  147:"T20 T17 D18",  146:"T20 T18 D16",  145:"T20 T19 D14",  144:"T20 T16 D18",
  143:"T20 T17 D16",  142:"T20 T18 D14",  141:"T20 T19 D12",  140:"T20 T16 D16",
  130:"T20 T18 D8",   121:"T20 T11 D14",  120:"T20 S20 D20",  100:"T20 D20",
  99:"T19 D21",       98:"T20 D19",        97:"T19 D20",        96:"T20 D18",
  95:"T19 D19",       94:"T18 D20",        93:"T19 D18",        92:"T20 D16",
  91:"T17 D20",       90:"T18 D18",        89:"T19 D16",        88:"T20 D14",
  87:"T17 D18",       86:"T18 D16",        85:"T19 D14",        84:"T20 D12",
  83:"T17 D16",       82:"T14 D20",        81:"T19 D12",        80:"T20 D10",
  79:"T19 D11",       78:"T18 D12",        77:"T19 D10",        76:"T20 D8",
  75:"T17 D12",       74:"T14 D16",        73:"T19 D8",         72:"T16 D12",
  71:"T13 D16",       70:"T18 D8",         69:"T19 D6",         68:"T20 D4",
  67:"T17 D8",        66:"T10 D18",        65:"T19 D4",         64:"T16 D8",
  63:"T13 D12",       62:"T10 D16",        61:"T15 D8",         60:"S20 D20",
  59:"S19 D20",       58:"S18 D20",        57:"S17 D20",        56:"S16 D20",
  55:"S15 D20",       54:"S14 D20",        53:"S13 D20",        52:"S12 D20",
  51:"S11 D20",       50:"Bull",           49:"S9 D20",         48:"S16 D16",
  47:"S15 D16",       46:"S14 D16",        45:"S13 D16",        44:"S12 D16",
  43:"S11 D16",       42:"S10 D16",        41:"S9 D16",         40:"D20",
  38:"D19",           36:"D18",            34:"D17",             32:"D16",
  30:"D15",           28:"D14",            26:"D13",             24:"D12",
  22:"D11",           20:"D10",            18:"D9",              16:"D8",
  14:"D7",            12:"D6",             10:"D5",              8:"D4",
  6:"D3",             4:"D2",              2:"D1",
};

function getCheckoutHint(remaining, dartsThrown) {
  const path = CHECKOUTS[remaining];
  if (!path) return null;
  const parts = path.split(" ");
  return parts[dartsThrown] || null;
}

// ─── Dartboard (from custom design) ──────────────────────────────────────────
const BOARD_NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const CRICKET_SET   = new Set([15, 16, 17, 18, 19, 20]);

function polarToXY(angle, r, cx, cy) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Translates a board tap {segment, position, value} → ActiveMatch dart {number, modifier}
function boardDartToMatch(dart) {
  if (dart.position === "SBull") return { number: "Bull",  modifier: "single" };
  if (dart.position === "DBull") return { number: "DBull", modifier: "double" };
  const number   = parseInt(dart.position);
  const modifier = dart.segment === "triple" ? "triple"
                 : dart.segment === "double" ? "double"
                 : "single";
  return { number, modifier };
}

function DartBoard({ onScore, disabled, cricketOnly }) {
  const cx = 210, cy = 210, size = 420;
  const rings = { bull: 23, bullseye: 44, triple: 95, tripleEnd: 125, double: 155, doubleEnd: 185 };
  const [hovered, setHovered] = useState(null);

  const makeArc = (angleStart, angleEnd, r1, r2) => {
    const p1 = polarToXY(angleStart, r1, cx, cy);
    const p2 = polarToXY(angleEnd,   r1, cx, cy);
    const p3 = polarToXY(angleEnd,   r2, cx, cy);
    const p4 = polarToXY(angleStart, r2, cx, cy);
    return `M ${p1.x} ${p1.y} A ${r1} ${r1} 0 0 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${r2} ${r2} 0 0 0 ${p4.x} ${p4.y} Z`;
  };

  const handleTap = (dart) => {
    if (disabled) return;
    // For numbered segments, check cricket filter
    if (dart.position !== "SBull" && dart.position !== "DBull") {
      const num = parseInt(dart.position);
      if (cricketOnly && !CRICKET_SET.has(num)) return;
    }
    onScore(dart);
  };

  const opacity = disabled ? 0.4 : 1;

  const segments = BOARD_NUMBERS.map((num, i) => {
    const angleStart = i * 18 - 9;
    const angleEnd   = angleStart + 18;
    const isCricket  = CRICKET_SET.has(num);
    const isEven     = i % 2 === 0;
    const inactive   = cricketOnly && !isCricket;

    // In cricket-only mode, use consistent light/white colors for all active segments
    const singleColor  = inactive ? (isEven ? "#1a1a2e" : "#f5e6c8")
                       : cricketOnly ? "#e8e0d0"
                       : (isEven ? "#1a1a2e" : "#f5e6c8");
    const scoringColor = inactive ? (isEven ? "#2d6a4f" : "#e63946")
                       : cricketOnly ? "#c0392b"
                       : (isEven ? "#2d6a4f" : "#e63946");
    const hoverColor   = "#ffd60a";
    const midAngle     = angleStart + 9;
    const labelPos     = polarToXY(midAngle, 198, cx, cy);

    return (
      <g key={num} opacity={inactive ? 0.2 : 1}>
        <path d={makeArc(angleStart, angleEnd, rings.bullseye + 1, rings.triple)}
          fill={hovered === `S${num}` ? hoverColor : singleColor}
          stroke="#333" strokeWidth="0.5"
          style={{ cursor: inactive || disabled ? "default" : "pointer" }}
          onMouseEnter={() => !inactive && setHovered(`S${num}`)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => handleTap({ segment: "single", position: String(num), value: num })} />
        <path d={makeArc(angleStart, angleEnd, rings.triple, rings.tripleEnd)}
          fill={hovered === `T${num}` ? hoverColor : scoringColor}
          stroke="#333" strokeWidth="0.5"
          style={{ cursor: inactive || disabled ? "default" : "pointer" }}
          onMouseEnter={() => !inactive && setHovered(`T${num}`)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => handleTap({ segment: "triple", position: String(num), value: num * 3 })} />
        <path d={makeArc(angleStart, angleEnd, rings.tripleEnd, rings.double)}
          fill={hovered === `S2${num}` ? hoverColor : singleColor}
          stroke="#333" strokeWidth="0.5"
          style={{ cursor: inactive || disabled ? "default" : "pointer" }}
          onMouseEnter={() => !inactive && setHovered(`S2${num}`)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => handleTap({ segment: "single", position: String(num), value: num })} />
        <path d={makeArc(angleStart, angleEnd, rings.double, rings.doubleEnd)}
          fill={hovered === `D${num}` ? hoverColor : scoringColor}
          stroke="#333" strokeWidth="0.5"
          style={{ cursor: inactive || disabled ? "default" : "pointer" }}
          onMouseEnter={() => !inactive && setHovered(`D${num}`)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => handleTap({ segment: "double", position: String(num), value: num * 2 })} />
        <text x={labelPos.x} y={labelPos.y}
          textAnchor="middle" dominantBaseline="middle"
          fontSize="13" fontWeight="bold"
          fill={isCricket ? "#ffd60a" : "#ccc"}
          style={{ pointerEvents: "none", userSelect: "none" }}>
          {num}
        </text>
      </g>
    );
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`}
      style={{ width: "100%", height: "auto", display: "block", margin: "0 auto", opacity, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))", touchAction: "manipulation" }}>
      <circle cx={cx} cy={cy} r={207} fill="#111" />
      <circle cx={cx} cy={cy} r={202} fill="#1a1a1a" />
      {segments}
      <circle cx={cx} cy={cy} r={rings.bullseye}
        fill={hovered === "SBull" ? "#ffd60a" : "#2d6a4f"}
        stroke="#333" strokeWidth="1"
        style={{ cursor: disabled ? "default" : "pointer" }}
        onMouseEnter={() => setHovered("SBull")} onMouseLeave={() => setHovered(null)}
        onClick={() => handleTap({ segment: "single", position: "SBull", value: 50 })} />
      <circle cx={cx} cy={cy} r={rings.bull}
        fill={hovered === "DBull" ? "#ffd60a" : "#e63946"}
        stroke="#333" strokeWidth="1"
        style={{ cursor: disabled ? "default" : "pointer" }}
        onMouseEnter={() => setHovered("DBull")} onMouseLeave={() => setHovered(null)}
        onClick={() => handleTap({ segment: "double", position: "DBull", value: 50 })} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        fontSize="8" fontWeight="bold" fill="white"
        style={{ pointerEvents: "none" }}>BULL</text>
    </svg>
  );
}

// ─── Dart Input Component (501) ───────────────────────────────────────────────
function DartInput({ onSelect, disabled, inputMode }) {
  // Numbers in 20→1 order
  const numOrder = [20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1];
  const [modifier, setModifier] = useState("single");

  const handleMiss = () => onSelect({ number: "Miss", modifier: "miss" });

  const selectNumber = (num) => {
    if (!modifier) return;
    if (num === "Bull" && modifier === "triple") return;
    onSelect({ number: num, modifier });
  };

  // Board mode: tapping a segment directly encodes segment type, no modifier row needed
  const handleBoardScore = (dart) => {
    const { number, modifier: mod } = boardDartToMatch(dart);
    onSelect({ number, modifier: mod });
  };

  if (inputMode === "board") {
    return (
      <div className={`dart-input-panel board-mode ${disabled ? "disabled" : ""}`}>
        <div className="board-hint-text">Tap a ring — double/triple score automatically</div>
        <DartBoard onScore={handleBoardScore} disabled={disabled} cricketOnly={false} />
        <button className="modifier-btn miss board-miss" onClick={handleMiss} disabled={disabled}>
          Miss
        </button>
      </div>
    );
  }

  return (
    <div className={`dart-input-panel ${disabled ? "disabled" : ""}`}>
      <div className="modifier-row">
        {["single","double","triple"].map(m => (
          <button key={m}
            className={`modifier-btn ${modifier === m ? "active" : ""} ${m}`}
            onClick={() => !disabled && setModifier(m)}
            disabled={disabled}>
            {m === "single" ? "S" : m === "double" ? "D" : "T"}
          </button>
        ))}
        <button className="modifier-btn miss" onClick={handleMiss} disabled={disabled}>Miss</button>
      </div>
      <div className={`number-grid ${!modifier ? "locked" : ""}`}>
        {numOrder.map(n => (
          <button key={n} className="number-btn"
            onClick={() => selectNumber(n)}
            disabled={disabled || !modifier}>
            {n}
          </button>
        ))}
        {/* Single bull always available (= 50) */}
        <button className="number-btn bull-btn"
          onClick={() => !disabled && modifier && onSelect({ number: "Bull", modifier: "single" })}
          disabled={disabled || !modifier}>
          Bull
        </button>
        {/* Double bull always available (= 50) */}
        <button className="number-btn bull-btn"
          onClick={() => !disabled && modifier && onSelect({ number: "DBull", modifier: "double" })}
          disabled={disabled || !modifier}>
          D.Bull
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

  const handleBoardScore = (dart) => {
    const { number, modifier: mod } = boardDartToMatch(dart);
    onSelect({ number, modifier: mod });
  };

  if (inputMode === "board") {
    return (
      <div className={`dart-input-panel board-mode ${disabled ? "disabled" : ""}`}>
        <div className="board-hint-text" style={{ color: "#ffd60a" }}>★ Gold = cricket numbers — tap any ring</div>
        <DartBoard onScore={handleBoardScore} disabled={disabled} cricketOnly={true} />
        <button className="modifier-btn miss board-miss" onClick={handleMiss} disabled={disabled}>
          Miss
        </button>
      </div>
    );
  }

  return (
    <div className={`dart-input-panel ${disabled ? "disabled" : ""}`}>
      <div className="modifier-row">
        {["single","double","triple"].map(m => (
          <button key={m}
            className={`modifier-btn ${modifier === m ? "active" : ""} ${m}`}
            onClick={() => !disabled && setModifier(m)}
            disabled={disabled}>
            {m === "single" ? "S" : m === "double" ? "D" : "T"}
          </button>
        ))}
        <button className="modifier-btn miss" onClick={handleMiss} disabled={disabled}>Miss</button>
      </div>
      <div className={`cricket-number-grid ${!modifier ? "locked" : ""}`}>
        {[20,19,18,17,16,15].map(num => (
          <button key={num} className="cricket-num-btn"
            onClick={() => selectNumber(num)}
            disabled={disabled || !modifier}>
            {num}
          </button>
        ))}
        {/* Single bull = 1 mark */}
        <button className="cricket-num-btn"
          onClick={() => !disabled && modifier && onSelect({ number: "Bull", modifier: "single" })}
          disabled={disabled || !modifier}>
          Bull
        </button>
        {/* Double bull = 2 marks */}
        <button className="cricket-num-btn"
          onClick={() => !disabled && modifier && onSelect({ number: "DBull", modifier: "double" })}
          disabled={disabled || !modifier}>
          D.Bull
        </button>
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
  const [currentGameType, setCurrentGameType] = useState(initialLeg?.game_type || null);
  const [legGameTypes, setLegGameTypes]       = useState({}); // legNumber → "501"|"cricket"
  const [awaitingGameChoice, setAwaitingGameChoice] = useState(!initialLeg?.game_type);
  const [awaitingFirstThrow, setAwaitingFirstThrow] = useState(true);

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

  // ── Undo history stack ────────────────────────────────────────────────────
  // Snapshot taken BEFORE each dart is recorded — restores to that exact moment.
  // turnIdToDelete is set only on the 3rd-dart snapshot (when a turn was committed to DB).
  const [history, setHistory] = useState([]);

  const captureSnapshot = (currentDarts, turnIdToDelete = null) => ({
    darts: currentDarts,
    turnBust: false,
    turnWin: false,
    bustMessage: "",
    turnNumber,
    currentPlayerIdx,
    xo1Scores: { ...xo1Scores },
    cricketState: JSON.parse(JSON.stringify(cricketState)),
    legScores: { ...legScores },
    legNumber,
    currentLeg,
    currentGameType,
    legGameTypes: { ...legGameTypes },
    awaitingFirstThrow,
    awaitingGameChoice,
    turnIdToDelete,
  });

  const handleUndo = async () => {
    if (history.length === 0) return;
    const snap = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));

    // If this snapshot has a DB turn to delete, remove it and fix match leg scores
    if (snap.turnIdToDelete) {
      await supabase.from("turns").delete().eq("id", snap.turnIdToDelete);
      await supabase.from("matches").update({
        player1_legs: snap.legScores[match.match.player1_id],
        player2_legs: snap.legScores[match.match.player2_id],
      }).eq("id", matchData.id);
    }

    // Restore full game state to the snapshot moment
    setDarts(snap.darts);
    setTurnBust(snap.turnBust);
    setTurnWin(snap.turnWin);
    setBustMessage(snap.bustMessage);
    setTurnNumber(snap.turnNumber);
    setCurrentPlayerIdx(snap.currentPlayerIdx);
    setXo1Scores(snap.xo1Scores);
    setCricketState(snap.cricketState);
    setLegScores(snap.legScores);
    setLegNumber(snap.legNumber);
    setCurrentLeg(snap.currentLeg);
    setCurrentGameType(snap.currentGameType);
    setLegGameTypes(snap.legGameTypes);
    setAwaitingFirstThrow(snap.awaitingFirstThrow);
    setAwaitingGameChoice(snap.awaitingGameChoice);
  };

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

    // Snapshot BEFORE this dart so undo lands here (with current darts array)
    setHistory(prev => [...prev, captureSnapshot(darts)]);

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
      // Valid finish: double, single bull, or double bull
      const isBullFinish = dart.number === "Bull" || dart.number === "DBull";
      if (!isBullFinish && dart.modifier !== "double") {
        bust = true;
        setBustMessage("Bust! Must finish on a double or bull.");
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

    // Snapshot BEFORE this dart
    setHistory(prev => [...prev, captureSnapshot(darts)]);

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

    // Normalize: both "Bull" and "DBull" map to the cricket "Bull" slot
    const isBull = dart.number === "Bull" || dart.number === "DBull";
    const num = isBull ? "Bull" : dart.number;

    if (!CRICKET_NUMBERS.includes(num)) return { newCricket: state, win: false };

    const newCricket = JSON.parse(JSON.stringify(state));
    // Single bull = 1 mark, Double bull = 2 marks, Triple = 3 marks (numbers only)
    const marks = isBull
      ? (dart.number === "DBull" ? 2 : 1)
      : (dart.modifier === "triple" ? 3 : dart.modifier === "double" ? 2 : 1);

    const myMarks  = newCricket[myId][num];
    const oppMarks = newCricket[oppId][num];
    const pointVal = isBull ? 25 : parseInt(num);

    if (myMarks < 3) {
      const closing  = Math.min(marks, 3 - myMarks);
      const overflow = marks - closing;
      newCricket[myId][num] = myMarks + closing;
      if (overflow > 0 && oppMarks < 3) {
        newCricket[myId].points += overflow * pointVal;
      }
    } else {
      if (oppMarks < 3) {
        newCricket[myId].points += marks * pointVal;
      }
    }

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

    const { data: insertedTurn } = await supabase.from("turns").insert(turnData).select().single();

    // Tag the last history snapshot (the one before the final dart) with the DB turn ID
    // so undo across this turn boundary will delete the right row
    if (insertedTurn?.id) {
      setHistory(prev => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], turnIdToDelete: insertedTurn.id };
        return updated;
      });
    }

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
      cricket_15:   countMarks(d, 15),
      cricket_16:   countMarks(d, 16),
      cricket_17:   countMarks(d, 17),
      cricket_18:   countMarks(d, 18),
      cricket_19:   countMarks(d, 19),
      cricket_20:   countMarks(d, 20),
      cricket_bull:  countMarks(d, "Bull"),   // single bull hits
      cricket_dbull: countMarks(d, "DBull"),  // double bull hits
    };

    const { data: insertedTurn } = await supabase.from("turns").insert(turnData).select().single();

    // Tag the last history snapshot with the DB turn ID for cross-turn undo
    if (insertedTurn?.id) {
      setHistory(prev => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], turnIdToDelete: insertedTurn.id };
        return updated;
      });
    }

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

    // Always play all 5 legs — match ends only after leg 5
    if (legNumber >= 5) {
      const matchWinnerId = p1Legs > p2Legs
        ? match.match.player1_id
        : p2Legs > p1Legs
        ? match.match.player2_id
        : winnerId;
      await supabase.from("matches").update({
        winner_id: matchWinnerId,
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", matchData.id);
      setWinner(players.find(p => p.id === matchWinnerId));
      setMatchOver(true);
      return;
    }

    const nextLegNum = legNumber + 1;
    setLegNumber(nextLegNum);

    // Create the next leg in DB without a game_type — will be set when players choose
    const { data: newLeg } = await supabase.from("legs").insert({
      match_id: matchData.id,
      leg_number: nextLegNum,
      starting_score: null,
      game_type: null,
    }).select().single();
    setCurrentLeg(newLeg);

    // Reset game state
    setCurrentGameType(null);
    setTurnNumber(1);
    setDarts([]);
    setTurnBust(false);
    setTurnWin(false);
    setBustMessage("");
    setXo1Scores({ [match.match.player1_id]: 501, [match.match.player2_id]: 501 });
    setCricketState(initCricket());

    // Always ask which game to play next, then who throws first
    setAwaitingGameChoice(true);
    setAwaitingFirstThrow(true);
  };

  const abandonMatch = async () => {
    setLoading(true);
    await supabase.from("turns").delete().eq("match_id", matchData.id);
    await supabase.from("legs").delete().eq("match_id", matchData.id);
    await supabase.from("matches").delete().eq("id", matchData.id);
    setLoading(false);
    navigate("home");
  };

  const chooseGame = async (gameType) => {
    setCurrentGameType(gameType);
    setLegGameTypes(prev => ({ ...prev, [legNumber]: gameType }));
    // Update the leg in DB with chosen game type
    await supabase.from("legs").update({
      game_type: gameType,
      starting_score: gameType === "501" ? 501 : null,
    }).eq("id", currentLeg.id);
    setAwaitingGameChoice(false);
    // awaitingFirstThrow is already true, so next screen is "who throws first"
  };

  const chooseFirstThrow = (playerId) => {
    setCurrentPlayerIdx(playerOrder.indexOf(playerId));
    setAwaitingFirstThrow(false);
  };

  // ── Game choice screen (shown before every leg) ────────────────────────────
  if (awaitingGameChoice) {
    return (
      <div className="screen">
        <div className="screen-header">
          <h2>Leg {legNumber} of 5</h2>
        </div>
        <div className="leg5-choice">
          <div className="leg5-scores">
            <span>{p1?.name}: {legScores[match.match.player1_id]}</span>
            <span>{p2?.name}: {legScores[match.match.player2_id]}</span>
          </div>
          <p className="leg5-sub">What are you playing?</p>
          <button className="btn-primary big-btn" onClick={() => chooseGame("501")}>🎯 501</button>
          <button className="btn-secondary big-btn" onClick={() => chooseGame("cricket")}>🏏 Cricket</button>
        </div>
      </div>
    );
  }

  // ── Who throws first ───────────────────────────────────────────────────────
  if (awaitingFirstThrow) {
    return (
      <div className="screen">
        <div className="screen-header">
          <h2>Leg {legNumber} · {currentGameType === "501" ? "501" : "Cricket"}</h2>
        </div>
        <div className="leg5-choice">
          <p className="leg5-sub">Who throws first?</p>
          <div className="leg5-scores">
            <span>{p1?.name}: {legScores[match.match.player1_id]}</span>
            <span>{p2?.name}: {legScores[match.match.player2_id]}</span>
          </div>
          <button className="btn-primary big-btn" onClick={() => chooseFirstThrow(match.match.player1_id)}>🎯 {p1?.name}</button>
          <button className="btn-secondary big-btn" onClick={() => chooseFirstThrow(match.match.player2_id)}>🎯 {p2?.name}</button>
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
          } else if (d.number === "Bull") {
            label = "Bull";
            cls = "dart-slot filled single";
          } else if (d.number === "DBull") {
            label = "D Bull";
            cls = "dart-slot filled double";
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
      {[1,2,3,4,5].map(num => {
        const done   = num < legNumber;
        const active = num === legNumber;
        const gameType = legGameTypes[num] || (num === legNumber ? currentGameType : null);
        const typeLabel = gameType === "501" ? "501" : gameType === "cricket" ? "CR" : "?";
        return (
          <div key={num} className={`leg-pip ${done ? "done" : ""} ${active ? "active" : ""}`}>
            <span className="pip-num">{num}</span>
            <span className="pip-type">{typeLabel}</span>
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
            <h3>Leave Match?</h3>
            <p>What would you like to do?</p>
            <button className="btn-secondary big-btn" onClick={() => { setConfirmAbandon(false); navigate("home"); }}>
              💾 Save &amp; Resume Later
            </button>
            <button className="btn-danger big-btn" onClick={abandonMatch} disabled={loading}>
              {loading ? "Deleting..." : "🗑 Delete Match"}
            </button>
            <button className="btn-secondary big-btn" onClick={() => setConfirmAbandon(false)}>Cancel</button>
          </div>
        </div>
      )}

      <LegProgress />

      {isXO1 ? <XO1Scoreboard /> : <CricketScoreboard />}

      {isXO1 && (() => {
        const myScore    = xo1Scores[currentPlayerId];
        const liveRemain = turnBust ? myScore : Math.max(0, myScore - turnScore501);
        // Look up checkout for the *current* remaining score — this already accounts
        // for darts thrown this turn, so always show the full path from here
        const remainingPath = !turnBust && canCheckout(liveRemain) && liveRemain > 1
          ? CHECKOUTS[liveRemain]
          : null;
        return remainingPath ? (
          <div className="checkout-hint">
            🎯 <span className="checkout-next">{remainingPath}</span>
            <span className="checkout-remain"> — {liveRemain} left</span>
          </div>
        ) : bustMessage ? (
          <div className="checkout-hint bust-hint">{bustMessage}</div>
        ) : null;
      })()}

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
        <button
          className={`mode-btn undo-btn ${darts.length === 0 && history.length === 0 ? "disabled-btn" : ""}`}
          onClick={handleUndo}
          disabled={loading || (darts.length === 0 && history.length === 0)}
        >
          ↩ Undo
        </button>
      </div>

      {isXO1
        ? <DartInput onSelect={handleDart501} disabled={loading || turnBust || turnWin || darts.length >= 3} inputMode={inputMode} />
        : <CricketDartInput onSelect={handleDartCricket} disabled={loading || turnWin || darts.length >= 3} inputMode={inputMode} />
      }

      <button className="btn-abandon" onClick={() => setConfirmAbandon(true)}>
        Leave Match
      </button>
    </div>
  );
}
