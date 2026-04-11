import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import { Target, Trophy, TrendingUp, Download } from "lucide-react";

// ─── Colour tokens (mirrors CSS vars) ───────────────────────────────────────
const C = {
  accent:  "#e64100",
  accent2: "#ff6a35",
  green:   "#3ddc84",
  blue:    "#4fa3f7",
  purple:  "#a78bfa",
  muted:   "#8899bb",
  surface: "#0f1f3d",
  surface2:"#162848",
  border:  "#1e3460",
  text:    "#ffffff",
};

// ─── Tiny helpers ────────────────────────────────────────────────────────────
const fmt1 = v => (v == null ? "—" : Number(v).toFixed(1));
const fmtPct = v => (v == null ? "—" : `${Number(v).toFixed(1)}%`);
const fmtNum = v => (v == null ? "—" : v);

// ─── Custom tooltip skin ─────────────────────────────────────────────────────
function DarkTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0d1f3c", border: `1px solid ${C.border}`,
      borderRadius: 8, padding: "8px 12px", fontSize: 13,
    }}>
      <p style={{ color: C.muted, marginBottom: 4, fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || C.accent }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ─── Stat tile ───────────────────────────────────────────────────────────────
function StatTile({ label, value, color, sub }) {
  return (
    <div className="sp-tile">
      <span className="sp-tile-label">{label}</span>
      <span className="sp-tile-val" style={{ color: color || C.text }}>{value}</span>
      {sub && <span className="sp-tile-sub">{sub}</span>}
    </div>
  );
}

// ─── Section card ────────────────────────────────────────────────────────────
function Card({ title, accent, children }) {
  return (
    <div className="sp-card">
      <div className="sp-card-header" style={{ borderColor: accent || C.accent }}>
        <span className="sp-card-title" style={{ color: accent || C.accent }}>{title}</span>
        <div className="sp-card-line" style={{ background: accent || C.accent }} />
      </div>
      {children}
    </div>
  );
}

// ─── computeSeasonStats (unchanged logic, pulled out for reuse) ───────────────
async function computeSeasonStats(supabase, playerId, seasonId) {
  const { data: schedRows } = await supabase
    .from("season_schedule").select("match_id").eq("season_id", seasonId);
  const matchIds = (schedRows || []).map(r => r.match_id);
  if (!matchIds.length) return { xo1: null, cricket: null };

  const { data: matches } = await supabase
    .from("matches")
    .select("id, game_type, player1_id, player2_id, winner_id, player1_legs, player2_legs, status")
    .in("id", matchIds).eq("status", "completed")
    .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
  if (!matches?.length) return { xo1: null, cricket: null };

  const allMatchIds = matches.map(m => m.id);
  const { data: legs } = await supabase
    .from("legs").select("id, match_id, winner_id, game_type")
    .in("match_id", allMatchIds).eq("status", "completed");

  const matchesWith501     = new Set((legs || []).filter(l => l.game_type === "501" || l.game_type === "301").map(l => l.match_id));
  const matchesWithCricket = new Set((legs || []).filter(l => l.game_type === "cricket").map(l => l.match_id));
  const xo1Matches     = matches.filter(m => matchesWith501.has(m.id));
  const cricketMatches = matches.filter(m => matchesWithCricket.has(m.id));
  const legIds = (legs || []).map(l => l.id);

  let turns = [];
  if (legIds.length) {
    const { data: t } = await supabase.from("turns").select("*").in("leg_id", legIds).eq("player_id", playerId);
    turns = t || [];
  }

  // 01
  const xo1Legs   = (legs || []).filter(l => l.game_type === "501" || l.game_type === "301");
  const xo1LegIds = new Set(xo1Legs.map(l => l.id));
  const xo1Turns  = turns.filter(t => t.leg_id && xo1LegIds.has(t.leg_id) && t.score !== null);
  const roundMap  = {};
  for (const t of xo1Turns) {
    const key = `${t.leg_id}-${t.turn_number}`;
    if (!roundMap[key]) roundMap[key] = { score: 0, isBust: false, isCheckout: false };
    roundMap[key].score += t.score || 0;
    if (t.is_bust) roundMap[key].isBust = true;
    if (t.is_checkout_success) roundMap[key].isCheckout = true;
  }
  const rounds          = Object.values(roundMap);
  const nonBust         = rounds.filter(r => !r.isBust);
  const checkoutRounds  = rounds.filter(r => r.isCheckout);
  const bustOrCheckout  = rounds.filter(r => r.isBust || r.isCheckout);
  const xo1Wins     = xo1Matches.filter(m => m.winner_id === playerId).length;
  const xo1LegsWon  = xo1Legs.filter(l => l.winner_id === playerId).length;
  const xo1Stats = {
    matches_played: xo1Matches.length,
    matches_won: xo1Wins,
    win_pct: xo1Matches.length ? ((xo1Wins / xo1Matches.length) * 100).toFixed(1) : 0,
    legs_played: xo1Legs.length,
    legs_won: xo1LegsWon,
    leg_win_pct: xo1Legs.length ? ((xo1LegsWon / xo1Legs.length) * 100).toFixed(1) : null,
    three_dart_avg: nonBust.length ? (nonBust.reduce((s, r) => s + r.score, 0) / nonBust.length).toFixed(1) : null,
    high_score: nonBust.length ? Math.max(...nonBust.map(r => r.score)) : null,
    scores_180:      nonBust.filter(r => r.score === 180).length,
    scores_high_ton: nonBust.filter(r => r.score >= 150 && r.score < 180).length,
    scores_low_ton:  nonBust.filter(r => r.score >= 100 && r.score < 150).length,
    checkout_pct: bustOrCheckout.length ? ((checkoutRounds.length / bustOrCheckout.length) * 100).toFixed(1) : null,
    high_checkout: checkoutRounds.length ? Math.max(...checkoutRounds.map(r => r.score)) : null,
  };

  // Cricket
  const cricketLegIds = new Set((legs || []).filter(l => l.game_type === "cricket").map(l => l.id));
  const cricketTurns  = turns.filter(t => t.leg_id && cricketLegIds.has(t.leg_id));
  const cRoundMap = {};
  for (const t of cricketTurns) {
    const key = `${t.leg_id}-${t.turn_number}`;
    if (!cRoundMap[key]) cRoundMap[key] = { marks: 0, points: 0 };
    cRoundMap[key].marks += (t.cricket_15||0)+(t.cricket_16||0)+(t.cricket_17||0)+
                            (t.cricket_18||0)+(t.cricket_19||0)+(t.cricket_20||0)+
                            (t.cricket_bull||0)+(t.cricket_dbull||0)*2;
    cRoundMap[key].points += (t.cricket_points||0);
  }
  const cRounds     = Object.values(cRoundMap);
  const cricketWins = cricketMatches.filter(m => m.winner_id === playerId).length;
  const cricketStats = {
    matches_played: cricketMatches.length,
    matches_won: cricketWins,
    win_pct: cricketMatches.length ? ((cricketWins / cricketMatches.length) * 100).toFixed(1) : 0,
    avg_marks_per_round: cRounds.length ? (cRounds.reduce((s,r)=>s+r.marks,0)/cRounds.length).toFixed(2) : null,
    total_points_scored: cRounds.reduce((s,r)=>s+r.points,0),
  };

  return { xo1: xo1Stats, cricket: cricketStats };
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1 — PLAYER
// ════════════════════════════════════════════════════════════════════════════
function PlayerTab({ supabase, players }) {
  const [selectedPlayer, setSelectedPlayer]   = useState("");
  const [selectedSeason, setSelectedSeason]   = useState("all");
  const [seasons, setSeasons]                 = useState([]);
  const [playerSeasons, setPlayerSeasons]     = useState([]);
  const [stats, setStats]                     = useState(null);
  const [h2h, setH2h]                         = useState([]);
  const [loading, setLoading]                 = useState(false);

  useEffect(() => {
    supabase.from("seasons").select("id, name").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setSeasons(data); });
  }, []);

  const handlePlayerChange = async (pid) => {
    setSelectedPlayer(pid); setSelectedSeason("all");
    setStats(null); setH2h([]); setPlayerSeasons([]);
    if (!pid) return;
    const { data: sp } = await supabase.from("season_players").select("season_id").eq("player_id", pid);
    const ids = (sp||[]).map(r=>r.season_id);
    setPlayerSeasons(seasons.filter(s=>ids.includes(s.id)));
    load(pid, "all");
  };

  const handleSeasonChange = (sid) => {
    setSelectedSeason(sid);
    if (selectedPlayer) load(selectedPlayer, sid);
  };

  const load = async (pid, sid) => {
    setLoading(true);
    if (sid === "all") {
      const [r1, r2, r3] = await Promise.all([
        supabase.from("stats_501").select("*").eq("player_id", pid).single(),
        supabase.from("stats_cricket").select("*").eq("player_id", pid).single(),
        supabase.from("stats_head_to_head").select("*").or(
          `player1.eq.${players.find(p=>p.id===pid)?.name},player2.eq.${players.find(p=>p.id===pid)?.name}`
        ),
      ]);
      setStats({ xo1: r1.data, cricket: r2.data, isComputed: false });
      setH2h(r3.data||[]);
    } else {
      const computed = await computeSeasonStats(supabase, pid, sid);
      setStats({ ...computed, isComputed: true });
      setH2h([]);
    }
    setLoading(false);
  };

  const playerName = players.find(p=>p.id===selectedPlayer)?.name || "";
  const seasonLabel = selectedSeason==="all" ? "All Time" : seasons.find(s=>s.id===selectedSeason)?.name||"";

  return (
    <div className="sp-tab-content">
      {/* Controls */}
      <div className="sp-controls">
        <select className="sp-select" value={selectedPlayer} onChange={e=>handlePlayerChange(e.target.value)}>
          <option value="">— Select Player —</option>
          {players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {selectedPlayer && playerSeasons.length > 0 && (
          <select className="sp-select" value={selectedSeason} onChange={e=>handleSeasonChange(e.target.value)}>
            <option value="all">All Time</option>
            {playerSeasons.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {loading && <div className="sp-loading"><div className="sp-spinner"/><span>Loading stats...</span></div>}

      {!selectedPlayer && !loading && (
        <div className="sp-empty">
          <div className="sp-empty-icon"><Target size={48} strokeWidth={1} color="#8899bb" /></div>
          <p>Select a player to view their stats</p>
        </div>
      )}

      {stats && !loading && (
        <>
          <div className="sp-player-hero">
            <div className="sp-player-avatar">{playerName.charAt(0)}</div>
            <div>
              <div className="sp-player-name">{playerName}</div>
              <div className="sp-player-season">{seasonLabel}</div>
            </div>
          </div>

          {/* 01 stats */}
          <Card title="01 GAME STATS" accent={C.accent}>
            {stats.xo1 && (stats.xo1.matches_played > 0 || !stats.isComputed) ? (
              <>
                <div className="sp-tiles">
                  <StatTile label="Matches" value={fmtNum(stats.xo1?.matches_played)} />
                  <StatTile label="Wins" value={fmtNum(stats.xo1?.matches_won)} color={C.green} />
                  <StatTile label="Win % - Matches" value={fmtPct(stats.xo1?.win_pct)} color={C.accent} />
                  <StatTile label="Win % - Legs" value={fmtPct(stats.xo1?.leg_win_pct ?? (stats.xo1?.legs_played ? ((stats.xo1.legs_won / stats.xo1.legs_played) * 100).toFixed(1) : null))} color={C.accent} />
                  <StatTile label="3-Dart Avg" value={fmt1(stats.xo1?.three_dart_avg)} color={C.accent2} sub="per round" />
                  <StatTile label="High Score" value={fmtNum(stats.xo1?.high_score)} color={C.blue} />
                  <StatTile label="180s" value={fmtNum(stats.xo1?.scores_180)} color={C.purple} />
                  <StatTile label="High Ton" value={fmtNum(stats.xo1?.scores_high_ton)} />
                  <StatTile label="Low Ton" value={fmtNum(stats.xo1?.scores_low_ton)} />
                  <StatTile label="Checkout %" value={fmtPct(stats.xo1?.checkout_pct)} color={C.green} />
                  <StatTile label="High Checkout" value={fmtNum(stats.xo1?.high_checkout)} color={C.accent} />
                </div>
                {/* mini score distribution bar */}
                {(stats.xo1.scores_180 > 0 || stats.xo1.scores_high_ton > 0 || stats.xo1.scores_low_ton > 0) && (
                  <div className="sp-chart-wrap" style={{ height: 120 }}>
                    <ResponsiveContainer>
                      <BarChart data={[{
                        name:"Scores",
                        "180s":     stats.xo1.scores_180||0,
                        "High Ton": stats.xo1.scores_high_ton||0,
                        "Low Ton":  stats.xo1.scores_low_ton||0,
                      }]} layout="vertical" margin={{left:0,right:0}}>
                        <CartesianGrid horizontal={false} stroke={C.border} />
                        <XAxis type="number" tick={{fill:C.muted,fontSize:10}} axisLine={false} tickLine={false}/>
                        <YAxis type="category" dataKey="name" hide />
                        <Tooltip content={<DarkTooltip/>}/>
                        <Bar dataKey="180s"     stackId="a" fill={C.purple} radius={[0,0,0,0]}/>
                        <Bar dataKey="High Ton" stackId="a" fill={C.accent}/>
                        <Bar dataKey="Low Ton"  stackId="a" fill={C.blue} radius={[0,4,4,0]}/>
                        <Legend wrapperStyle={{fontSize:11, color:C.muted}}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            ) : <div className="sp-no-data">No 01 matches in this period</div>}
          </Card>

          {/* Cricket stats */}
          <Card title="CRICKET STATS" accent={C.green}>
            {stats.cricket && (stats.cricket.matches_played > 0 || !stats.isComputed) ? (
              <div className="sp-tiles">
                <StatTile label="Matches" value={fmtNum(stats.cricket?.matches_played)} />
                <StatTile label="Wins" value={fmtNum(stats.cricket?.matches_won)} color={C.green} />
                <StatTile label="Win %" value={fmtPct(stats.cricket?.win_pct)} color={C.accent} />
                <StatTile label="Marks/Round" value={fmt1(stats.cricket?.avg_marks_per_round)} color={C.accent} />
                <StatTile label="Points Scored" value={fmtNum(stats.cricket?.total_points_scored)} color={C.blue} />
              </div>
            ) : <div className="sp-no-data">No Cricket matches in this period</div>}
          </Card>

          {/* Head to Head */}
          {selectedSeason === "all" && h2h.length > 0 && (
            <Card title="HEAD TO HEAD" accent={C.blue}>
              <div className="sp-h2h-table">
                <div className="sp-h2h-head">
                  <span>Opponent</span><span>Type</span><span>Record</span>
                </div>
                {h2h.map((r, i) => {
                  const isP1 = r.player1 === playerName;
                  const myW  = isP1 ? r.player1_wins : r.player2_wins;
                  const thW  = isP1 ? r.player2_wins : r.player1_wins;
                  const opp  = isP1 ? r.player2 : r.player1;
                  const won  = myW > thW;
                  return (
                    <div key={i} className="sp-h2h-row">
                      <span className="sp-h2h-opp">{opp}</span>
                      <span className="sp-h2h-type">{r.game_type}</span>
                      <span className="sp-h2h-record" style={{ color: won ? C.green : myW === thW ? C.muted : C.accent2 }}>
                        {myW}–{thW}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2 — SEASON
// ════════════════════════════════════════════════════════════════════════════
function SeasonTab({ supabase, players }) {
  const [seasons, setSeasons]       = useState([]);
  const [selectedSeason, setSeason] = useState("");
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(false);
  const [sort01, setSort01]         = useState("win_pct");
  const [sortCr, setSortCr]         = useState("win_pct");

  useEffect(() => {
    supabase.from("seasons").select("id, name").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setSeasons(data); });
  }, []);

  const load = async (sid) => {
    setSeason(sid); setData(null);
    if (!sid) return;
    setLoading(true);

    // All players in this season
    const { data: sp } = await supabase.from("season_players").select("player_id").eq("season_id", sid);
    const pids = (sp||[]).map(r=>r.player_id);

    // Compute stats for every player in parallel
    const results = await Promise.all(pids.map(pid => computeSeasonStats(supabase, pid, sid)));
    const rows = pids.map((pid, i) => ({
      player: players.find(p=>p.id===pid)?.name || pid,
      xo1: results[i].xo1,
      cricket: results[i].cricket,
    }));
    setData(rows);
    setLoading(false);
  };

  const xo1Rows = (data||[]).filter(r=>r.xo1?.matches_played>0).sort((a,b) => {
    const va = parseFloat(a.xo1[sort01])||0;
    const vb = parseFloat(b.xo1[sort01])||0;
    return vb - va;
  });
  const crRows  = (data||[]).filter(r=>r.cricket?.matches_played>0).sort((a,b)=>{
    const va = parseFloat(a.cricket[sortCr])||0;
    const vb = parseFloat(b.cricket[sortCr])||0;
    return vb - va;
  });

  // chart data
  const avgChartData = xo1Rows.map(r=>({ name: r.player, avg: parseFloat(r.xo1.three_dart_avg)||0 }));
  const winChartData = xo1Rows.map(r=>({ name: r.player, pct: parseFloat(r.xo1.win_pct)||0 }));
  const scoreDistData = xo1Rows.map(r=>({
    name: r.player,
    "180s":     r.xo1.scores_180||0,
    "High Ton": r.xo1.scores_high_ton||0,
    "Low Ton":  r.xo1.scores_low_ton||0,
  }));

  const SeasonSortBtn = ({ field, current, set, label }) => (
    <button className={`sp-sort-btn ${current===field?"active":""}`} onClick={()=>set(field)}>{label}</button>
  );

  return (
    <div className="sp-tab-content">
      <div className="sp-controls">
        <select className="sp-select" value={selectedSeason} onChange={e=>load(e.target.value)}>
          <option value="">— Select Season —</option>
          {seasons.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {loading && <div className="sp-loading"><div className="sp-spinner"/><span>Computing season stats...</span></div>}

      {!selectedSeason && !loading && (
        <div className="sp-empty">
          <div className="sp-empty-icon"><Trophy size={48} strokeWidth={1} color="#8899bb" /></div>
          <p>Select a season to compare players</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* 01 charts */}
          {xo1Rows.length > 0 && (
            <>
              <Card title="3-DART AVERAGE COMPARISON" accent={C.accent}>
                <div className="sp-chart-wrap" style={{ height: Math.max(200, xo1Rows.length * 44) }}>
                  <ResponsiveContainer>
                    <BarChart data={avgChartData} layout="vertical" margin={{left:8, right:24, top:4, bottom:4}}>
                      <CartesianGrid horizontal={false} stroke={C.border} />
                      <XAxis type="number" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} domain={[0,'auto']}/>
                      <YAxis type="category" dataKey="name" tick={{fill:C.text,fontSize:12}} width={80} axisLine={false} tickLine={false}/>
                      <Tooltip content={<DarkTooltip/>} cursor={{fill:"rgba(255,255,255,0.04)"}}/>
                      <Bar dataKey="avg" name="3-Dart Avg" fill="url(#gradAccent)" radius={[0,6,6,0]} label={{position:"right",fill:C.accent2,fontSize:12,fontWeight:700}}/>
                      <defs>
                        <linearGradient id="gradAccent" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#e64100" stopOpacity={0.7}/>
                          <stop offset="100%" stopColor="#ff9a6c" stopOpacity={1}/>
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="WIN % COMPARISON (MATCHES)" accent={C.green}>
                <div className="sp-chart-wrap" style={{ height: Math.max(200, xo1Rows.length * 44) }}>
                  <ResponsiveContainer>
                    <BarChart data={winChartData} layout="vertical" margin={{left:8,right:36,top:4,bottom:4}}>
                      <CartesianGrid horizontal={false} stroke={C.border}/>
                      <XAxis type="number" domain={[0,100]} tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`}/>
                      <YAxis type="category" dataKey="name" tick={{fill:C.text,fontSize:12}} width={80} axisLine={false} tickLine={false}/>
                      <Tooltip content={<DarkTooltip/>} cursor={{fill:"rgba(255,255,255,0.04)"}} formatter={v=>`${v}%`}/>
                      <Bar dataKey="pct" name="Win %" fill="url(#gradGreen)" radius={[0,6,6,0]} label={{position:"right",fill:C.green,fontSize:12,fontWeight:700,formatter:v=>`${v}%`}}/>
                      <defs>
                        <linearGradient id="gradGreen" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#3ddc84" stopOpacity={0.5}/>
                          <stop offset="100%" stopColor="#3ddc84" stopOpacity={1}/>
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card title="SCORING DISTRIBUTION" accent={C.purple}>
                <div className="sp-chart-wrap" style={{ height: Math.max(200, xo1Rows.length * 44) }}>
                  <ResponsiveContainer>
                    <BarChart data={scoreDistData} layout="vertical" margin={{left:8,right:8,top:4,bottom:4}}>
                      <CartesianGrid horizontal={false} stroke={C.border}/>
                      <XAxis type="number" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                      <YAxis type="category" dataKey="name" tick={{fill:C.text,fontSize:12}} width={80} axisLine={false} tickLine={false}/>
                      <Tooltip content={<DarkTooltip/>} cursor={{fill:"rgba(255,255,255,0.04)"}}/>
                      <Legend wrapperStyle={{color:C.muted,fontSize:12}}/>
                      <Bar dataKey="180s"     stackId="a" fill={C.purple}/>
                      <Bar dataKey="High Ton" stackId="a" fill={C.accent}/>
                      <Bar dataKey="Low Ton"  stackId="a" fill={C.blue} radius={[0,4,4,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* 01 leaderboard table */}
              <Card title="01 LEADERBOARD" accent={C.accent}>
                <div className="sp-sort-row">
                  <SeasonSortBtn field="win_pct" current={sort01} set={setSort01} label="Win % (M)" />
                  <SeasonSortBtn field="leg_win_pct" current={sort01} set={setSort01} label="Win % (L)" />
                  <SeasonSortBtn field="three_dart_avg" current={sort01} set={setSort01} label="Avg" />
                  <SeasonSortBtn field="scores_180" current={sort01} set={setSort01} label="180s" />
                  <SeasonSortBtn field="checkout_pct" current={sort01} set={setSort01} label="CKO %" />
                </div>
                <div className="sp-data-table">
                  <div className="sp-dt-head">
                    <span>#</span><span>Player</span><span>W</span><span>L</span>
                    <span>Win%(M)</span><span>Win%(L)</span>
                    <span>Avg</span><span>180s</span><span>CKO%</span><span>Hi</span>
                  </div>
                  {xo1Rows.map((r, i) => (
                    <div key={r.player} className={`sp-dt-row ${i%2===0?"even":""}`}>
                      <span className="sp-rank">{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</span>
                      <span className="sp-dt-player">{r.player}</span>
                      <span style={{color:C.green}}>{r.xo1.matches_won}</span>
                      <span style={{color:C.accent2}}>{r.xo1.matches_played-r.xo1.matches_won}</span>
                      <span style={{color:C.accent}}>{fmtPct(r.xo1.win_pct)}</span>
                      <span style={{color:C.accent}}>{fmtPct(r.xo1.leg_win_pct)}</span>
                      <span>{fmt1(r.xo1.three_dart_avg)}</span>
                      <span style={{color:C.purple}}>{r.xo1.scores_180||0}</span>
                      <span>{fmtPct(r.xo1.checkout_pct)}</span>
                      <span>{r.xo1.high_score||"—"}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {/* Cricket leaderboard */}
          {crRows.length > 0 && (
            <Card title="CRICKET LEADERBOARD" accent={C.green}>
              <div className="sp-sort-row">
                <SeasonSortBtn field="win_pct" current={sortCr} set={setSortCr} label="Win %" />
                <SeasonSortBtn field="avg_marks_per_round" current={sortCr} set={setSortCr} label="Marks/Rnd" />
                <SeasonSortBtn field="total_points_scored" current={sortCr} set={setSortCr} label="Points" />
              </div>
              <div className="sp-data-table">
                <div className="sp-dt-head">
                  <span>#</span><span>Player</span><span>W</span><span>L</span>
                  <span>Win%</span><span>Marks/Rnd</span><span>Points</span>
                </div>
                {crRows.map((r,i)=>(
                  <div key={r.player} className={`sp-dt-row ${i%2===0?"even":""}`}>
                    <span className="sp-rank">{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</span>
                    <span className="sp-dt-player">{r.player}</span>
                    <span style={{color:C.green}}>{r.cricket.matches_won}</span>
                    <span style={{color:C.accent2}}>{r.cricket.matches_played-r.cricket.matches_won}</span>
                    <span style={{color:C.accent}}>{fmtPct(r.cricket.win_pct)}</span>
                    <span style={{color:C.accent}}>{fmt1(r.cricket.avg_marks_per_round)}</span>
                    <span style={{color:C.blue}}>{r.cricket.total_points_scored}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {xo1Rows.length === 0 && crRows.length === 0 && (
            <div className="sp-empty"><p>No completed matches found in this season.</p></div>
          )}
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 3 — SEASON VS SEASON
// ════════════════════════════════════════════════════════════════════════════
function SeasonCompareTab({ supabase, players }) {
  const [seasons, setSeasons]   = useState([]);
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);

  useEffect(() => {
    supabase.from("seasons").select("id, name").order("created_at", { ascending: true })
      .then(({ data }) => { if (data) { setSeasons(data); if (data.length >= 2) fetchAll(data); } });
  }, []);

  const fetchAll = async (allSeasons) => {
    setLoading(true);
    const seasonResults = await Promise.all(allSeasons.map(async (s) => {
      const { data: sp } = await supabase.from("season_players").select("player_id").eq("season_id", s.id);
      const pids = (sp||[]).map(r=>r.player_id);
      if (!pids.length) return { season: s.name, avg: null, winPct: null, s180s: 0, avgCricket: null };

      const results = await Promise.all(pids.map(pid=>computeSeasonStats(supabase, pid, s.id)));
      const xo1s = results.map(r=>r.xo1).filter(Boolean).filter(r=>r.matches_played>0);
      const crs  = results.map(r=>r.cricket).filter(Boolean).filter(r=>r.matches_played>0);

      const avgAll = xo1s.length ? (xo1s.reduce((sum,r)=>sum+(parseFloat(r.three_dart_avg)||0),0)/xo1s.length).toFixed(1) : null;
      const wpAll  = xo1s.length ? (xo1s.reduce((sum,r)=>sum+(parseFloat(r.win_pct)||0),0)/xo1s.length).toFixed(1) : null;
      const total180 = xo1s.reduce((sum,r)=>sum+(r.scores_180||0),0);
      const avgMPR = crs.length ? (crs.reduce((sum,r)=>sum+(parseFloat(r.avg_marks_per_round)||0),0)/crs.length).toFixed(2) : null;

      return { season: s.name, avg: parseFloat(avgAll), winPct: parseFloat(wpAll), s180s: total180, avgCricket: parseFloat(avgMPR) };
    }));
    setData(seasonResults);
    setLoading(false);
  };

  return (
    <div className="sp-tab-content">
      {loading && <div className="sp-loading"><div className="sp-spinner"/><span>Analysing all seasons...</span></div>}

      {!loading && seasons.length < 2 && (
        <div className="sp-empty">
          <div className="sp-empty-icon"><TrendingUp size={48} strokeWidth={1} color="#8899bb" /></div>
          <p>You need at least 2 seasons of data for season comparison.</p>
        </div>
      )}

      {data && !loading && (
        <>
          <Card title="LEAGUE 3-DART AVERAGE BY SEASON" accent={C.accent}>
            <p className="sp-chart-sub">Average 3-dart score across all players, per season</p>
            <div className="sp-chart-wrap" style={{height:220}}>
              <ResponsiveContainer>
                <LineChart data={data} margin={{left:0,right:16,top:8,bottom:8}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                  <XAxis dataKey="season" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} domain={['auto','auto']}/>
                  <Tooltip content={<DarkTooltip/>}/>
                  <Line type="monotone" dataKey="avg" name="Avg" stroke={C.accent} strokeWidth={2.5}
                    dot={{fill:C.accent,r:4,strokeWidth:0}} activeDot={{r:6,fill:C.accent2}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="LEAGUE WIN % TREND" accent={C.green}>
            <p className="sp-chart-sub">Average win % for 01 games per season (reflects competitiveness balance)</p>
            <div className="sp-chart-wrap" style={{height:220}}>
              <ResponsiveContainer>
                <LineChart data={data} margin={{left:0,right:16,top:8,bottom:8}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                  <XAxis dataKey="season" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} domain={[0,100]} tickFormatter={v=>`${v}%`}/>
                  <Tooltip content={<DarkTooltip/>} formatter={v=>`${v}%`}/>
                  <Line type="monotone" dataKey="winPct" name="Win %" stroke={C.green} strokeWidth={2.5}
                    dot={{fill:C.green,r:4,strokeWidth:0}} activeDot={{r:6}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="TOTAL 180s PER SEASON" accent={C.purple}>
            <p className="sp-chart-sub">Total 180s thrown across the entire league each season</p>
            <div className="sp-chart-wrap" style={{height:220}}>
              <ResponsiveContainer>
                <BarChart data={data} margin={{left:0,right:8,top:8,bottom:8}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                  <XAxis dataKey="season" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                  <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<DarkTooltip/>}/>
                  <Bar dataKey="s180s" name="180s" fill={C.purple} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {data.some(d=>d.avgCricket) && (
            <Card title="CRICKET MARKS/ROUND BY SEASON" accent={C.blue}>
              <p className="sp-chart-sub">League-wide average cricket marks per round — higher is better</p>
              <div className="sp-chart-wrap" style={{height:220}}>
                <ResponsiveContainer>
                  <LineChart data={data} margin={{left:0,right:16,top:8,bottom:8}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                    <XAxis dataKey="season" tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fill:C.muted,fontSize:11}} axisLine={false} tickLine={false} domain={['auto','auto']}/>
                    <Tooltip content={<DarkTooltip/>}/>
                    <Line type="monotone" dataKey="avgCricket" name="Marks/Rnd" stroke={C.blue} strokeWidth={2.5}
                      dot={{fill:C.blue,r:4,strokeWidth:0}} activeDot={{r:6}}/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Summary table */}
          <Card title="SEASON SUMMARY TABLE" accent={C.muted}>
            <div className="sp-data-table">
              <div className="sp-dt-head">
                <span>Season</span><span>Avg</span><span>Win%(M)</span><span>180s</span><span>Mks/Rnd</span>
              </div>
              {data.map((d,i)=>(
                <div key={d.season} className={`sp-dt-row ${i%2===0?"even":""}`}>
                  <span className="sp-dt-player">{d.season}</span>
                  <span style={{color:C.accent}}>{d.avg ?? "—"}</span>
                  <span>{d.winPct != null ? `${d.winPct}%` : "—"}</span>
                  <span style={{color:C.purple}}>{d.s180s}</span>
                  <span style={{color:C.blue}}>{d.avgCricket ?? "—"}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN StatsPage
// ════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: "player",  label: "Player",  Icon: Target },
  { id: "season",  label: "Season",  Icon: Trophy },
  { id: "compare", label: "Seasons", Icon: TrendingUp },
];

export default function StatsPage({ supabase, players, navigate }) {
  const [activeTab, setActiveTab] = useState("player");

  const exportCSV = async () => {
    const { data: turns } = await supabase
      .from("turns")
      .select("*, matches(game_type, player1_id, player2_id), legs(leg_number)")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (!turns) return;
    const headers = ["Turn #","Game Type","Player","Leg","Score","Remaining","Checkout Attempt","Checkout Success","Cricket 15","Cricket 16","Cricket 17","Cricket 18","Cricket 19","Cricket 20","Cricket Bull","Points","Date"];
    const rows = turns.map(t=>[
      t.turn_number, t.matches?.game_type, players.find(p=>p.id===t.player_id)?.name,
      t.legs?.leg_number, t.score??"", t.score_remaining??"",
      t.is_checkout_attempt?"Y":"N", t.is_checkout_success?"Y":"N",
      t.cricket_15, t.cricket_16, t.cricket_17, t.cricket_18, t.cricket_19, t.cricket_20,
      t.cricket_bull, t.cricket_points, new Date(t.created_at).toLocaleDateString(),
    ]);
    const csv = [headers,...rows].map(r=>r.join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download="dart_stats.csv"; a.click();
  };

  return (
    <div className="screen sp-page">
      {/* Header */}
      <div className="sp-header">
        <button className="back-btn sp-back" onClick={()=>navigate("home")}>← Back</button>
        <div className="sp-header-center">
          <span className="sp-header-icon"><Target size={22} strokeWidth={1.5} color="#e64100" /></span>
          <h2 className="sp-header-title">STATISTICS</h2>
        </div>
        <button className="sp-export-btn" onClick={exportCSV} title="Export CSV">
          <Download size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="sp-tab-bar">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`sp-tab ${activeTab===t.id?"active":""}`}
            onClick={()=>setActiveTab(t.id)}
          >
            <t.Icon size={13} strokeWidth={2} style={{display:"inline",verticalAlign:"middle",marginRight:"0.3rem"}} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="sp-panels">
        {activeTab === "player"  && <PlayerTab  supabase={supabase} players={players} />}
        {activeTab === "season"  && <SeasonTab  supabase={supabase} players={players} />}
        {activeTab === "compare" && <SeasonCompareTab supabase={supabase} players={players} />}
      </div>
    </div>
  );
}
