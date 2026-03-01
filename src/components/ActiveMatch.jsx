import { useState, useEffect } from "react";

const CRICKET_NUMBERS = [15, 16, 17, 18, 19, 20, "Bull"];

export default function ActiveMatch({ match, players, supabase, navigate }) {
  const { currentLeg: initialLeg, startingScore } = match;
  const [currentLeg, setCurrentLeg] = useState(initialLeg);
  const [matchData, setMatchData] = useState(match.match);
  const [turnNumber, setTurnNumber] = useState(1);
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0); // 0 = p1, 1 = p2
  const [scores, setScores] = useState({
    [match.match.player1_id]: startingScore,
    [match.match.player2_id]: startingScore,
  });
  const [legScores, setLegScores] = useState({
    [match.match.player1_id]: 0,
    [match.match.player2_id]: 0,
  });
  const [cricketState, setCricketState] = useState({
    [match.match.player1_id]: { 15:0,16:0,17:0,18:0,19:0,20:0,Bull:0,points:0 },
    [match.match.player2_id]: { 15:0,16:0,17:0,18:0,19:0,20:0,Bull:0,points:0 },
  });

  // Input state
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
  const currentPlayerId = playerOrder[currentPlayerIdx];
  const currentPlayer = currentPlayerId === match.match.player1_id ? p1 : p2;
  const gameType = match.match.game_type;
  const isXO1 = gameType !== "cricket";

  const resetTurnInput = () => {
    setDartScore("");
    setIsCheckoutAttempt(false);
    setIsCheckoutSuccess(false);
    setCheckoutDart(null);
    setCricketMarks({ 15:0,16:0,17:0,18:0,19:0,20:0,Bull:0 });
    setError("");
  };

  const handleCricketMark = (num, marks) => {
    setCricketMarks(prev => ({ ...prev, [num]: marks }));
  };

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
      const remaining = scores[currentPlayerId] - score;
      if (remaining < 0) {
        setError("Score exceeds remaining! (bust)");
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
      // Cricket
      const totalPoints = Object.entries(cricketMarks).reduce((sum, [num, marks]) => {
        const key = num === "Bull" ? "Bull" : parseInt(num);
        // Points scored = marks on opponent's open numbers
        const opponentId = playerOrder[1 - currentPlayerIdx];
        const opponentState = cricketState[opponentId];
        const myState = cricketState[currentPlayerId];
        if (opponentState[key] < 3 && marks > 0 && myState[key] >= 3) {
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

    // Update local state
    if (isXO1) {
      const score = parseInt(dartScore);
      const newRemaining = scores[currentPlayerId] - score;
      const newScores = { ...scores, [currentPlayerId]: newRemaining };
      setScores(newScores);

      // Check leg win
      if (newRemaining === 0 && isCheckoutSuccess) {
        await completeLeg(currentPlayerId);
        setLoading(false);
        return;
      }
    } else {
      // Update cricket state
      const newCricket = JSON.parse(JSON.stringify(cricketState));
      for (const [num, marks] of Object.entries(cricketMarks)) {
        const key = num === "Bull" ? "Bull" : parseInt(num);
        newCricket[currentPlayerId][key] = Math.min(3, newCricket[currentPlayerId][key] + marks);
      }
      setCricketState(newCricket);

      // Check cricket win: all numbers closed AND leading or tied on points
      const myState = newCricket[currentPlayerId];
      const allClosed = [15,16,17,18,19,20,"Bull"].every(n => myState[n] >= 3);
      const oppId = playerOrder[1 - currentPlayerIdx];
      if (allClosed && myState.points >= newCricket[oppId].points) {
        await completeLeg(currentPlayerId);
        setLoading(false);
        return;
      }
    }

    // Next player's turn
    setTurnNumber(prev => prev + (currentPlayerIdx === 1 ? 1 : 0));
    setCurrentPlayerIdx(1 - currentPlayerIdx);
    resetTurnInput();
    setLoading(false);
  };

  const completeLeg = async (winnerId) => {
    await supabase.from("legs").update({ winner_id: winnerId, status: "completed", completed_at: new Date().toISOString() }).eq("id", currentLeg.id);

    const newLegScores = { ...legScores, [winnerId]: legScores[winnerId] + 1 };
    setLegScores(newLegScores);

    // Update match leg counts
    const p1Legs = newLegScores[match.match.player1_id];
    const p2Legs = newLegScores[match.match.player2_id];
    await supabase.from("matches").update({ player1_legs: p1Legs, player2_legs: p2Legs }).eq("id", matchData.id);

    // Check match win
    if (p1Legs >= match.match.legs_to_win || p2Legs >= match.match.legs_to_win) {
      await supabase.from("matches").update({ winner_id: winnerId, status: "completed", completed_at: new Date().toISOString() }).eq("id", matchData.id);
      setWinner(players.find(p => p.id === winnerId));
      setMatchOver(true);
      return;
    }

    // Start new leg
    const legNum = p1Legs + p2Legs + 1;
    const { data: newLeg } = await supabase.from("legs").insert({
      match_id: matchData.id,
      leg_number: legNum,
      starting_score: startingScore,
    }).select().single();

    setCurrentLeg(newLeg);
    setTurnNumber(1);
    setCurrentPlayerIdx(0);
    setScores({
      [match.match.player1_id]: startingScore,
      [match.match.player2_id]: startingScore,
    });
    setCricketState({
      [match.match.player1_id]: { 15:0,16:0,17:0,18:0,19:0,20:0,Bull:0,points:0 },
      [match.match.player2_id]: { 15:0,16:0,17:0,18:0,19:0,20:0,Bull:0,points:0 },
    });
    resetTurnInput();
  };

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

  return (
    <div className="screen active-match">
      {/* Scoreboard */}
      <div className="scoreboard">
        <div className={`player-score ${currentPlayerIdx === 0 ? "active-player" : ""}`}>
          <div className="player-name">{p1?.name}</div>
          <div className="score-big">{isXO1 ? scores[match.match.player1_id] : cricketState[match.match.player1_id]?.points ?? 0}</div>
          <div className="legs-count">Legs: {legScores[match.match.player1_id]}</div>
        </div>
        <div className="score-divider">
          <div className="leg-label">Leg {(legScores[match.match.player1_id] + legScores[match.match.player2_id]) + 1}</div>
          <div className="vs-label">vs</div>
        </div>
        <div className={`player-score ${currentPlayerIdx === 1 ? "active-player" : ""}`}>
          <div className="player-name">{p2?.name}</div>
          <div className="score-big">{isXO1 ? scores[match.match.player2_id] : cricketState[match.match.player2_id]?.points ?? 0}</div>
          <div className="legs-count">Legs: {legScores[match.match.player2_id]}</div>
        </div>
      </div>

      {/* Turn indicator */}
      <div className="turn-indicator">
        🎯 <strong>{currentPlayer?.name}</strong>'s turn
      </div>

      {/* Input area */}
      {isXO1 ? (
        <div className="input-section">
          <label className="form-label">3-Dart Score</label>
          <input
            className="score-input"
            type="number"
            inputMode="numeric"
            placeholder="0 – 180"
            value={dartScore}
            onChange={e => {
              setDartScore(e.target.value);
              const val = parseInt(e.target.value);
              const remaining = scores[currentPlayerId];
              if (!isNaN(val) && val <= remaining && val >= 2) {
                // Could be a checkout
              }
            }}
            autoFocus
          />

          {/* Quick score buttons */}
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
        /* Cricket input */
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
                      onClick={() => handleCricketMark(num, m)}
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
