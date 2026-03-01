import { useState } from "react";

const CRICKET_NUMBERS = [15, 16, 17, 18, 19, 20, "Bull"];
const LEG_SCHEDULE = ["501", "501", "cricket", "cricket", "choice"];

function getLegGameType(legNumber, chosenLeg5) {
  const scheduled = LEG_SCHEDULE[legNumber - 1];
  if (scheduled === "choice") return chosenLeg5 || null;
  return scheduled;
}

export default function ActiveMatch({ match, players, supabase, navigate }) {
  const { currentLeg: initialLeg } = match;
  const [currentLeg, setCurrentLeg] = useState(initialLeg);
  const [matchData] = useState(match.match);
  const [legNumber, setLegNumber] = useState(1);
  const [turnNumber, setTurnNumber] = useState(1);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(null); // null = not yet chosen
  const [legScores, setLegScores] = useState({
    [match.match.player1_id]: 0,
    [match.match.player2_id]: 0,
  });
  const [chosenLeg5Type, setChosenLeg5Type] = useState(null);
  const [awaitingLeg5Choice, setAwaitingLeg5Choice] = useState(false);
  const [awaitingFirstThrow, setAwaitingFirstThrow] = useState(true); // leg 1 starts with prompt

  const currentGameType = getLegGameType(legNumber, chosenLeg5Type);
  const isXO1 = currentGameType === "501" || currentGameType === "301";

  const [xo1Scores, setXo1Scores] = useState({
    [match.match.player1_id]: 501,
    [match.match.player2_id]: 501,
  });
  const [cricketState, setCricketState] = useState({
    [match.match.player1_id]: { 15:0,16:0,17:0,18:0,19:0,20:0,Bull:0,points:0 },
    [match.match.player2_id]: { 15:0,16:0,17:0,18:0,19:0,20:0,Bull:0,points:0 },
  });

  const [dartScore, setDartScore] = useState("");
  const [isCheckoutAttempt, setIsCheckoutAttempt] = useState(false);
  const [isCheckoutSuccess, setIsCheckoutSuccess] = useState(false);
  const [checkoutDart, setCheckoutDart] = useState(null);
  const [cricketMarks, setCricketMarks] = useState({ 15:0,16:0,17:0,18:0,19:0,20:0,Bull:0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [matchOver, setMatchOver] = useState(false);
  const [winner, setWinner] = useState(null);

  const p1 = players.find(p => p.id === match.match.player1_id);
  const p2 = players.find(p => p.id === match.match.player2_id);
  const playerOrder = [match.match.player1_id, match.match.player2_id];
  const currentPlayerId = currentPlayerIdx !== null ? playerOrder[currentPlayerIdx] : null;
  const currentPlayer = currentPlayerId ? (currentPlayerId === match.match.player1_id ? p1 : p2) : null;

  const resetTurnInput = () => {
    setDartScore("");
    setIsCheckoutAttempt(false);
    setIsCheckoutSuccess(false);
    setCheckoutDart(null);
    setCricketMarks({ 15:0,16:0,17:0,18:0,19:0,20:0,Bull:0 });
    setError("");
  };

  const chooseFirstThrow = (playerId) => {
    const idx = playerOrder.indexOf(playerId);
    setCurrentPlayerIdx(idx);
    setAwaitingFirstThrow(false);
  };

  // ── Who throws first? prompt ─────────────────────────────────────────────
  if (awaitingFirstThrow) {
    const isLeg5 = legNumber === 5;
    return (
      <div className="screen">
        <div className="screen-header">
          <h2>{isLeg5 ? "⚡ Leg 5 — Decider" : "Leg 1"}</h2>
        </div>
        <div className="leg5-choice">
          <p className="leg5-sub">Who throws first?</p>
          {isLeg5 && (
            <div className="leg5-scores">
              <span>{p1?.name}: {legScores[match.match.player1_id]}</span>
              <span>{p2?.name}: {legScores[match.match.player2_id]}</span>
            </div>
          )}
          <button className="btn-primary big-btn" onClick={() => chooseFirstThrow(match.match.player1_id)}>
            🎯 {p1?.name}
          </button>
          <button className="btn-secondary big-btn" onClick={() => chooseFirstThrow(match.match.player2_id)}>
            🎯 {p2?.name}
          </button>
        </div>
      </div>
    );
  }

  // ── Leg 5 game type choice ───────────────────────────────────────────────
  if (awaitingLeg5Choice) {
    return (
      <div className="screen">
        <div className="screen-header">
          <h2>⚡ Leg 5 — Choose Game</h2>
        </div>
        <div className="leg5-choice">
          <p className="leg5-sub">What are you playing?</p>
          <div className="leg5-scores">
            <span>{p1?.name}: {legScores[match.match.player1_id]}</span>
            <span>{p2?.name}: {legScores[match.match.player2_id]}</span>
          </div>
          <button className="btn-primary big-btn" onClick={() => { setChosenLeg5Type("501"); setAwaitingLeg5Choice(false); setAwaitingFirstThrow(true); }}>
            🎯 501
          </button>
          <button className="btn-secondary big-btn" onClick={() => { setChosenLeg5Type("cricket"); setAwaitingLeg5Choice(false); setAwaitingFirstThrow(true); }}>
            🏏 Cricket
          </button>
        </div>
      </div>
    );
  }

  // ── Match over ───────────────────────────────────────────────────────────
  if (matchOver) {
    return (
      <div className="screen winner-screen">
        <div className="winner-content">
          <div className="winner-trophy">🏆</div>
          <h1 className="winner-name">{winner?.name}</h1>
          <p className="winner-sub">WINS THE MATCH!</p>
          <div className="final-score">
            {legScores[match.match.player1_id]} — {legScores[match.match.player2_id]}
          </div>
          <button className="btn-primary big-btn" onClick={() => navigate("home")}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ── Submit turn ──────────────────────────────────────────────────────────
  const submitTurn = async () => {
    setLoading(true);
    setError("");

    let turnData = {
      leg_id: currentLeg.id,
      match_id: matchData.id,
      player_id: currentPlayerId,
      turn_number: turnNumber,
    };

    if (isXO1) {
      const score = parseInt(dartScore);
      if (isNaN(score) || score < 0 || score > 180) {
        setError("Enter a score between 0 and 180");
        setLoading(false);
        return;
      }
      const remaining = xo1Scores[currentPlayerId] - score;
      if (remaining < 0) {
        setError("Score exceeds remaining — that's a bust!");
        setLoading(false);
        return;
      }
      turnData = {
        ...turnData,
        score,
        score_remaining: remaining,
        is_checkout_attempt: isCheckoutAttempt,
        is_checkout_success: isCheckoutSuccess && isCheckoutAttempt,
        checkout_dart: isCheckoutSuccess ? checkoutDart : null,
      };
    } else {
      const totalPoints = Object.entries(cricketMarks).reduce((sum, [num, marks]) => {
        const key = num === "Bull" ? "Bull" : parseInt(num);
        const opponentId = playerOrder[1 - currentPlayerIdx];
        const myState = cricketState[currentPlayerId];
        const oppState = cricketState[opponentId];
        if (myState[key] >= 3 && oppState[key] < 3 && marks > 0) {
          return sum + marks * (key === "Bull" ? 25 : key);
        }
        return sum;
      }, 0);

      turnData = {
        ...turnData,
        cricket_15: cricketMarks[15],
        cricket_16: cricketMarks[16],
        cricket_17: cricketMarks[17],
        cricket_18: cricketMarks[18],
        cricket_19: cricketMarks[19],
        cricket_20: cricketMarks[20],
        cricket_bull: cricketMarks["Bull"],
        cricket_points: totalPoints,
      };
    }

    const { error: tErr } = await supabase.from("turns").insert(turnData);
    if (tErr) { setError(tErr.message); setLoading(false); return; }

    if (isXO1) {
      const score = parseInt(dartScore);
      const newRemaining = xo1Scores[currentPlayerId] - score;
      setXo1Scores(prev => ({ ...prev, [currentPlayerId]: newRemaining }));
      if (newRemaining === 0 && isCheckoutSuccess) {
        await completeLeg(currentPlayerId);
        setLoading(false);
        return;
      }
    } else {
      const newCricket = JSON.parse(JSON.stringify(cricketState));
      for (const [num, marks] of Object.entries(cricketMarks)) {
        const key = num === "Bull" ? "Bull" : parseInt(num);
        newCricket[currentPlayerId][key] = Math.min(3, newCricket[currentPlayerId][key] + marks);
      }
      setCricketState(newCricket);
      const myState = newCricket[currentPlayerId];
      const allClosed = [15,16,17,18,19,20,"Bull"].every(n => myState[n] >= 3);
      const oppId = playerOrder[1 - currentPlayerIdx];
      if (allClosed && myState.points >= newCricket[oppId].points) {
        await completeLeg(currentPlayerId);
        setLoading(false);
        return;
      }
    }

    setTurnNumber(prev => prev + (currentPlayerIdx === 1 ? 1 : 0));
    setCurrentPlayerIdx(1 - currentPlayerIdx);
    resetTurnInput();
    setLoading(false);
  };

  // ── Complete leg ─────────────────────────────────────────────────────────
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

    // Loser throws first for legs 2-4; leg 5 gets its own prompt after game choice
    const loserId = playerOrder.find(id => id !== winnerId);
    const loserIdx = playerOrder.indexOf(loserId);

    if (nextLegNum === 5) {
      const { data: newLeg } = await supabase.from("legs").insert({
        match_id: matchData.id,
        leg_number: 5,
        starting_score: null,
        game_type: null,
      }).select().single();
      setCurrentLeg(newLeg);
      setCurrentPlayerIdx(loserIdx); // set but will be overridden by throw choice
      setAwaitingLeg5Choice(true);
    } else {
      const nextGameType = LEG_SCHEDULE[nextLegNum - 1];
      const { data: newLeg } = await supabase.from("legs").insert({
        match_id: matchData.id,
        leg_number: nextLegNum,
        starting_score: nextGameType === "501" ? 501 : null,
        game_type: nextGameType,
      }).select().single();
      setCurrentLeg(newLeg);
      // Loser goes first — no prompt needed
      setCurrentPlayerIdx(loserIdx);
    }

    setTurnNumber(1);
    setXo1Scores({
      [match.match.player1_id]: 501,
      [match.match.player2_id]: 501,
    });
    setCricketState({
      [match.match.player1_id]: { 15:0,16:0,17:0,18:0,19:0,20:0,Bull:0,points:0 },
      [match.match.player2_id]: { 15:0,16:0,17:0,18:0,19:0,20:0,Bull:0,points:0 },
    });
    resetTurnInput();
  };

  const legLabel = `Leg ${legNumber} — ${currentGameType === "501" ? "501" : "Cricket"}`;

  // ── Main match UI ────────────────────────────────────────────────────────
  return (
    <div className="screen active-match">
      <div className="scoreboard">
        <div className={`player-score ${currentPlayerIdx === 0 ? "active-player" : ""}`}>
          <div className="player-name">{p1?.name}</div>
          <div className="score-big">
            {isXO1 ? xo1Scores[match.match.player1_id] : (cricketState[match.match.player1_id]?.points ?? 0)}
          </div>
          <div className="legs-count">Legs: {legScores[match.match.player1_id]}</div>
        </div>
        <div className="score-divider">
          <div className="leg-label">{legLabel}</div>
          <div className="vs-label">vs</div>
        </div>
        <div className={`player-score ${currentPlayerIdx === 1 ? "active-player" : ""}`}>
          <div className="player-name">{p2?.name}</div>
          <div className="score-big">
            {isXO1 ? xo1Scores[match.match.player2_id] : (cricketState[match.match.player2_id]?.points ?? 0)}
          </div>
          <div className="legs-count">Legs: {legScores[match.match.player2_id]}</div>
        </div>
      </div>

      <div className="leg-progress">
        {LEG_SCHEDULE.map((type, i) => {
          const num = i + 1;
          const done = num < legNumber;
          const active = num === legNumber;
          return (
            <div key={i} className={`leg-pip ${done ? "done" : ""} ${active ? "active" : ""}`}>
              <span className="pip-num">{num}</span>
              <span className="pip-type">{type === "choice" ? "?" : type === "501" ? "501" : "CR"}</span>
            </div>
          );
        })}
      </div>

      <div className="turn-indicator">
        🎯 <strong>{currentPlayer?.name}</strong>'s turn
      </div>

      {isXO1 ? (
        <div className="input-section">
          <label className="form-label">3-Dart Score</label>
          <input
            className="score-input"
            type="number"
            inputMode="numeric"
            placeholder="0 – 180"
            value={dartScore}
            onChange={e => setDartScore(e.target.value)}
            autoFocus
          />
          <div className="quick-scores">
            {[26, 41, 45, 60, 81, 85, 100, 121, 140, 180].map(s => (
              <button key={s} className="quick-btn" onClick={() => setDartScore(String(s))}>{s}</button>
            ))}
          </div>
          <div className="checkbox-row">
            <label className="check-label">
              <input type="checkbox" checked={isCheckoutAttempt} onChange={e => {
                setIsCheckoutAttempt(e.target.checked);
                if (!e.target.checked) { setIsCheckoutSuccess(false); setCheckoutDart(null); }
              }} />
              Checkout attempt?
            </label>
          </div>
          {isCheckoutAttempt && (
            <div className="checkout-section">
              <label className="check-label">
                <input type="checkbox" checked={isCheckoutSuccess} onChange={e => setIsCheckoutSuccess(e.target.checked)} />
                Checked out! 🎯
              </label>
              {isCheckoutSuccess && (
                <div className="checkout-dart-row">
                  <span>Which dart?</span>
                  {[1, 2, 3].map(d => (
                    <button key={d} className={`dart-btn ${checkoutDart === d ? "active" : ""}`} onClick={() => setCheckoutDart(d)}>
                      Dart {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="input-section">
          <label className="form-label">Marks This Turn</label>
          <div className="cricket-grid">
            {CRICKET_NUMBERS.map(num => (
              <div key={num} className="cricket-row">
                <span className="cricket-num">{num}</span>
                <div className="mark-buttons">
                  {[0, 1, 2, 3].map(m => (
                    <button
                      key={m}
                      className={`mark-btn ${cricketMarks[num] === m ? "active" : ""}`}
                      onClick={() => setCricketMarks(prev => ({ ...prev, [num]: m }))}
                    >
                      {m === 0 ? "—" : "✕".repeat(m)}
                    </button>
                  ))}
                </div>
                <div className="cricket-status">
                  <span className="my-marks">{Math.min(3, (cricketState[currentPlayerId][num] || 0) + cricketMarks[num])}/3</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      <button className="btn-primary big-btn submit-btn" onClick={submitTurn} disabled={loading}>
        {loading ? "Saving..." : "SUBMIT TURN →"}
      </button>
    </div>
  );
}
