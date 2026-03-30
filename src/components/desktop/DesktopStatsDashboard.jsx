import React, { useState, useEffect } from "react";
// supabase passed as prop
import "./DesktopStatsDashboard.css";

function StatCard({ label, value, sub, accent, large }) {
  return (
    <div className={`stat-card ${large ? "stat-card--large" : ""}`} style={accent ? { "--accent": accent } : {}}>
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">{value ?? "—"}</span>
      {sub && <span className="stat-card__sub">{sub}</span>}
    </div>
  );
}

function MiniBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="mini-bar">
      <span className="mini-bar__label">{label}</span>
      <div className="mini-bar__track">
        <div className="mini-bar__fill" style={{ width: `${pct}%`, background: color || "#3b82f6" }} />
      </div>
      <span className="mini-bar__value">{value}</span>
    </div>
  );
}

function RadarChart({ data, size = 200 }) {
  if (!data || data.length === 0) return null;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const n = data.length;

  const points = data.map((d, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const val = Math.min(1, Math.max(0, d.value));
    return {
      x: cx + r * val * Math.cos(angle),
      y: cy + r * val * Math.sin(angle),
      lx: cx + (r + 22) * Math.cos(angle),
      ly: cy + (r + 22) * Math.sin(angle),
      label: d.label,
    };
  });

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const polyPts = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="radar-chart">
      {gridLevels.map((lvl) => {
        const gpts = data.map((_, i) => {
          const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
          return `${cx + r * lvl * Math.cos(angle)},${cy + r * lvl * Math.sin(angle)}`;
        });
        return <polygon key={lvl} points={gpts.join(" ")} fill="none" stroke="#e5e7eb" strokeWidth="1" />;
      })}
      {data.map((_, i) => {
        const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
        return (
          <line key={i} x1={cx} y1={cy} x2={cx + r * Math.cos(angle)} y2={cy + r * Math.sin(angle)} stroke="#e5e7eb" strokeWidth="1" />
        );
      })}
      <polygon points={polyPts} fill="rgba(59,130,246,0.15)" stroke="#3b82f6" strokeWidth="2" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="#3b82f6" />
          <text x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#6b7280" fontFamily="DM Mono, monospace">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

function HorizontalBar({ players, metric, label, formatter, colorFn }) {
  if (!players || players.length === 0) return null;
  const vals = players.map((p) => parseFloat(p[metric]) || 0);
  const max = Math.max(...vals);
  return (
    <div className="hbar-chart">
      <div className="hbar-chart__title">{label}</div>
      {players
        .filter((p) => (parseFloat(p[metric]) || 0) > 0)
        .sort((a, b) => (parseFloat(b[metric]) || 0) - (parseFloat(a[metric]) || 0))
        .slice(0, 9)
        .map((p, i) => {
          const val = parseFloat(p[metric]) || 0;
          const pct = max > 0 ? (val / max) * 100 : 0;
          const color = colorFn ? colorFn(i) : `hsl(${220 - i * 15}, 70%, ${55 + i * 3}%)`;
          return (
            <div className="hbar-row" key={p.player_id || p.name}>
              <span className="hbar-row__rank">#{i + 1}</span>
              <span className="hbar-row__name">{p.name}</span>
              <div className="hbar-row__track">
                <div className="hbar-row__fill" style={{ width: `${pct}%`, background: color }} />
              </div>
              <span className="hbar-row__val">{formatter ? formatter(val) : val}</span>
            </div>
          );
        })}
    </div>
  );
}

export default function DesktopStatsDashboard({ supabase, defaultTab }) {
  const [stats501, setStats501] = useState([]);
  const [statsCricket, setStatsCricket] = useState([]);
  const [h2h, setH2h] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [selectedSeason, setSelectedSeason] = useState("all");
  const [activeTab, setActiveTab] = useState(defaultTab || "overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from("stats_501").select("*"),
      supabase.from("stats_cricket").select("*"),
      supabase.from("stats_head_to_head").select("*"),
      supabase.from("seasons").select("*").order("created_at", { ascending: false }),
    ]);
    setStats501(r1.data || []);
    setStatsCricket(r2.data || []);
    setH2h(r3.data || []);
    setSeasons(r4.data || []);
    if (r1.data?.length > 0) setSelectedPlayer(r1.data[0].player_id);
    setLoading(false);
  }

  const player501 = stats501.find((p) => p.player_id === selectedPlayer);
  const playerCricket = statsCricket.find((p) => p.player_id === selectedPlayer);
  const allPlayers = stats501.length > 0 ? stats501 : statsCricket;

  // Build radar data for selected player
  const radarData = player501 && statsCricket.length > 0 ? (() => {
    const max501 = {
      three_dart_avg: Math.max(...stats501.map(p => parseFloat(p.three_dart_avg) || 0)),
      checkout_pct: 100,
      win_pct: 100,
    };
    const maxCricket = {
      avg_marks_per_round: Math.max(...statsCricket.map(p => parseFloat(p.avg_marks_per_round) || 0)),
      win_pct: 100,
    };
    const cr = statsCricket.find((p) => p.player_id === selectedPlayer);
    return [
      { label: "Avg", value: max501.three_dart_avg > 0 ? (parseFloat(player501.three_dart_avg) || 0) / max501.three_dart_avg : 0 },
      { label: "CO%", value: (parseFloat(player501.checkout_pct) || 0) / 100 },
      { label: "501W%", value: (parseFloat(player501.win_pct) || 0) / 100 },
      { label: "MPR", value: cr && maxCricket.avg_marks_per_round > 0 ? (parseFloat(cr.avg_marks_per_round) || 0) / maxCricket.avg_marks_per_round : 0 },
      { label: "CrkW%", value: cr ? (parseFloat(cr.win_pct) || 0) / 100 : 0 },
    ];
  })() : null;

  if (loading) {
    return (
      <div className="dsd-loading">
        <div className="dsd-loading__spinner" />
        <span>Loading statistics...</span>
      </div>
    );
  }

  return (
    <div className="dsd">
      {/* Header */}
      <div className="dsd__header">
        <div className="dsd__header-left">
          <h1 className="dsd__title">Statistics Dashboard</h1>
          <span className="dsd__subtitle">Sweet Release Dart League</span>
        </div>
        <div className="dsd__header-right">
          <div className="dsd__tabs">
            {["overview", "501", "cricket", "h2h"].map((t) => (
              <button key={t} className={`dsd__tab ${activeTab === t ? "dsd__tab--active" : ""}`} onClick={() => setActiveTab(t)}>
                {t === "h2h" ? "Head to Head" : t === "501" ? "501" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Player selector */}
      <div className="dsd__player-bar">
        {allPlayers.map((p) => (
          <button
            key={p.player_id}
            className={`player-chip ${selectedPlayer === p.player_id ? "player-chip--active" : ""}`}
            onClick={() => setSelectedPlayer(p.player_id)}
          >
            <span className="player-chip__avatar">{p.name?.[0]}</span>
            {p.name}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="dsd__content">
          <div className="dsd__grid dsd__grid--overview">
            {/* Left: Player deep dive */}
            <div className="dsd__panel dsd__panel--player">
              <div className="panel-title">Player Profile</div>
              {player501 && (
                <div className="player-profile">
                  <div className="player-profile__name">{player501.name}</div>
                  <div className="profile-radar">
                    {radarData && <RadarChart data={radarData} size={220} />}
                  </div>
                  <div className="profile-stats-grid">
                    <StatCard label="501 Win %" value={`${player501.win_pct}%`} accent="#3b82f6" />
                    <StatCard label="3-Dart Avg" value={player501.three_dart_avg} accent="#10b981" />
                    <StatCard label="Checkout %" value={player501.checkout_pct ? `${player501.checkout_pct}%` : "—"} accent="#f59e0b" />
                    <StatCard label="High Checkout" value={player501.high_checkout} accent="#ef4444" />
                    {(() => {
                      const cr = statsCricket.find((p) => p.player_id === selectedPlayer);
                      return cr ? (
                        <>
                          <StatCard label="Cricket Win %" value={`${cr.win_pct}%`} accent="#8b5cf6" />
                          <StatCard label="Marks/Round" value={cr.avg_marks_per_round} accent="#06b6d4" />
                        </>
                      ) : null;
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Middle: Leaderboard panels */}
            <div className="dsd__panel dsd__panel--rankings">
              <div className="panel-title">501 Rankings</div>
              <HorizontalBar
                players={stats501}
                metric="three_dart_avg"
                label="3-Dart Average"
                formatter={(v) => v.toFixed(1)}
                colorFn={(i) => `hsl(${220 - i * 18}, 75%, ${52 + i * 2}%)`}
              />
              <HorizontalBar
                players={stats501}
                metric="checkout_pct"
                label="Checkout %"
                formatter={(v) => `${v.toFixed(1)}%`}
                colorFn={(i) => `hsl(${160 - i * 12}, 65%, ${48 + i * 3}%)`}
              />
            </div>

            {/* Right: Cricket rankings */}
            <div className="dsd__panel dsd__panel--cricket-rank">
              <div className="panel-title">Cricket Rankings</div>
              <HorizontalBar
                players={statsCricket}
                metric="avg_marks_per_round"
                label="Marks Per Round"
                formatter={(v) => v.toFixed(2)}
                colorFn={(i) => `hsl(${280 - i * 15}, 65%, ${52 + i * 2}%)`}
              />
              <HorizontalBar
                players={statsCricket}
                metric="win_pct"
                label="Cricket Win %"
                formatter={(v) => `${v.toFixed(1)}%`}
                colorFn={(i) => `hsl(${30 - i * 8}, 80%, ${52 + i * 2}%)`}
              />
            </div>
          </div>
        </div>
      )}

      {/* 501 TAB */}
      {activeTab === "501" && (
        <div className="dsd__content">
          <div className="dsd__table-wrapper">
            <table className="dsd__table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Matches</th>
                  <th>Wins</th>
                  <th>Win %</th>
                  <th>Legs Won</th>
                  <th>3-Dart Avg</th>
                  <th>High Score</th>
                  <th>180s</th>
                  <th>150+</th>
                  <th>100+</th>
                  <th>Checkout %</th>
                  <th>High CO</th>
                  <th>Avg Darts/Leg</th>
                </tr>
              </thead>
              <tbody>
                {stats501
                  .sort((a, b) => (parseFloat(b.three_dart_avg) || 0) - (parseFloat(a.three_dart_avg) || 0))
                  .map((p, i) => (
                    <tr key={p.player_id} className={p.player_id === selectedPlayer ? "row--selected" : ""} onClick={() => setSelectedPlayer(p.player_id)}>
                      <td className="td-player">
                        <span className="td-rank">#{i + 1}</span>
                        <span className="td-name">{p.name}</span>
                      </td>
                      <td>{p.matches_played}</td>
                      <td>{p.matches_won}</td>
                      <td><span className="pct-badge" style={{ "--pct-color": `hsl(${p.win_pct * 1.2}, 70%, 45%)` }}>{p.win_pct}%</span></td>
                      <td>{p.legs_won}</td>
                      <td className="td-highlight">{p.three_dart_avg}</td>
                      <td>{p.high_score}</td>
                      <td>{p.scores_180 > 0 ? <span className="badge badge--gold">🎯 {p.scores_180}</span> : "—"}</td>
                      <td>{p.scores_150_plus}</td>
                      <td>{p.scores_100_plus}</td>
                      <td>{p.checkout_pct ? `${p.checkout_pct}%` : "—"}</td>
                      <td>{p.high_checkout || "—"}</td>
                      <td>{p.avg_darts_per_leg || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Deep dive for selected player */}
          {player501 && (
            <div className="dsd__deep-dive">
              <div className="deep-dive-header">{player501.name} — Deep Dive</div>
              <div className="deep-dive-cards">
                <StatCard large label="3-Dart Average" value={player501.three_dart_avg} sub="Non-bust rounds only" accent="#3b82f6" />
                <StatCard large label="High Score" value={player501.high_score} sub="Best single turn" accent="#10b981" />
                <StatCard large label="Checkout %" value={player501.checkout_pct ? `${player501.checkout_pct}%` : "—"} sub={`High: ${player501.high_checkout || "—"}`} accent="#f59e0b" />
                <StatCard large label="180s Thrown" value={player501.scores_180} sub={`150+: ${player501.scores_150_plus}`} accent="#ef4444" />
                <StatCard large label="Avg Darts/Leg" value={player501.avg_darts_per_leg} sub="Legs won only" accent="#8b5cf6" />
                <StatCard large label="Match Win %" value={`${player501.win_pct}%`} sub={`${player501.matches_won}W / ${player501.matches_played - player501.matches_won}L`} accent="#06b6d4" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* CRICKET TAB */}
      {activeTab === "cricket" && (
        <div className="dsd__content">
          <div className="dsd__table-wrapper">
            <table className="dsd__table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Matches</th>
                  <th>Wins</th>
                  <th>Win %</th>
                  <th>Marks/Round</th>
                  <th>Total Marks</th>
                  <th>Total Rounds</th>
                  <th>Points Scored</th>
                </tr>
              </thead>
              <tbody>
                {statsCricket
                  .sort((a, b) => (parseFloat(b.avg_marks_per_round) || 0) - (parseFloat(a.avg_marks_per_round) || 0))
                  .map((p, i) => (
                    <tr key={p.player_id} className={p.player_id === selectedPlayer ? "row--selected" : ""} onClick={() => setSelectedPlayer(p.player_id)}>
                      <td className="td-player">
                        <span className="td-rank">#{i + 1}</span>
                        <span className="td-name">{p.name}</span>
                      </td>
                      <td>{p.matches_played}</td>
                      <td>{p.matches_won}</td>
                      <td><span className="pct-badge" style={{ "--pct-color": `hsl(${p.win_pct * 1.2}, 70%, 45%)` }}>{p.win_pct}%</span></td>
                      <td className="td-highlight">{p.avg_marks_per_round}</td>
                      <td>{p.total_marks}</td>
                      <td>{p.total_rounds}</td>
                      <td>{p.total_points_scored}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Cricket deep dive */}
          {playerCricket && (
            <div className="dsd__deep-dive">
              <div className="deep-dive-header">{playerCricket.name} — Cricket Deep Dive</div>
              <div className="deep-dive-cards">
                <StatCard large label="Marks Per Round" value={playerCricket.avg_marks_per_round} sub="Efficiency rating" accent="#8b5cf6" />
                <StatCard large label="Total Marks" value={playerCricket.total_marks} sub={`Over ${playerCricket.total_rounds} rounds`} accent="#3b82f6" />
                <StatCard large label="Points Scored" value={playerCricket.total_points_scored} sub="When opponent closed" accent="#f59e0b" />
                <StatCard large label="Win %" value={`${playerCricket.win_pct}%`} sub={`${playerCricket.matches_won}W / ${playerCricket.matches_played - playerCricket.matches_won}L`} accent="#10b981" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* HEAD TO HEAD TAB */}
      {activeTab === "h2h" && (
        <div className="dsd__content">
          <div className="h2h-grid">
            {/* Filter by selected player */}
            <div className="h2h-filter-label">
              Showing matchups for: <strong>{allPlayers.find((p) => p.player_id === selectedPlayer)?.name || "—"}</strong>
            </div>
            {h2h
              .filter((r) => {
                const pName = allPlayers.find((p) => p.player_id === selectedPlayer)?.name;
                return r.player1 === pName || r.player2 === pName;
              })
              .map((r, i) => {
                const pName = allPlayers.find((p) => p.player_id === selectedPlayer)?.name;
                const isP1 = r.player1 === pName;
                const myWins = isP1 ? r.player1_wins : r.player2_wins;
                const theirWins = isP1 ? r.player2_wins : r.player1_wins;
                const opponent = isP1 ? r.player2 : r.player1;
                const total = myWins + theirWins;
                const myPct = total > 0 ? (myWins / total) * 100 : 50;
                return (
                  <div className="h2h-card" key={i}>
                    <div className="h2h-card__game">{r.game_type?.toUpperCase()}</div>
                    <div className="h2h-card__players">
                      <span className="h2h-me">{pName}</span>
                      <span className="h2h-vs">vs</span>
                      <span className="h2h-them">{opponent}</span>
                    </div>
                    <div className="h2h-card__score">
                      <span className="h2h-wins">{myWins}</span>
                      <span className="h2h-dash">–</span>
                      <span className="h2h-losses">{theirWins}</span>
                    </div>
                    <div className="h2h-bar">
                      <div className="h2h-bar__fill" style={{ width: `${myPct}%` }} />
                    </div>
                    <div className="h2h-played">{total} matches</div>
                  </div>
                );
              })}
            {h2h.filter((r) => {
              const pName = allPlayers.find((p) => p.player_id === selectedPlayer)?.name;
              return r.player1 === pName || r.player2 === pName;
            }).length === 0 && (
              <div className="h2h-empty">No head-to-head data yet for this player.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
