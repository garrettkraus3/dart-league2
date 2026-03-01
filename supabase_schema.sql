-- ============================================================
-- DARTS APP - Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Players table (you manage this manually)
CREATE TABLE players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Matches table
CREATE TABLE matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_type TEXT NOT NULL CHECK (game_type IN ('501', '301', 'cricket')),
  legs_to_win INTEGER NOT NULL DEFAULT 2,
  player1_id UUID REFERENCES players(id) NOT NULL,
  player2_id UUID REFERENCES players(id) NOT NULL,
  winner_id UUID REFERENCES players(id),
  player1_legs INTEGER DEFAULT 0,
  player2_legs INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Legs table (one row per leg within a match)
CREATE TABLE legs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  leg_number INTEGER NOT NULL,
  winner_id UUID REFERENCES players(id),
  starting_score INTEGER, -- 501 or 301, null for cricket
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Turns table (one row per 3-dart turn)
CREATE TABLE turns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  leg_id UUID REFERENCES legs(id) ON DELETE CASCADE NOT NULL,
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES players(id) NOT NULL,
  turn_number INTEGER NOT NULL,
  
  -- For 501/301
  score INTEGER,                    -- total score for this turn (0-180)
  score_remaining INTEGER,          -- score remaining after this turn
  is_checkout_attempt BOOLEAN DEFAULT FALSE,
  is_checkout_success BOOLEAN DEFAULT FALSE,
  checkout_dart INTEGER,            -- which dart finished it (1, 2, or 3)
  
  -- For Cricket (marks per number: 0-3 marks each)
  cricket_15 INTEGER DEFAULT 0,
  cricket_16 INTEGER DEFAULT 0,
  cricket_17 INTEGER DEFAULT 0,
  cricket_18 INTEGER DEFAULT 0,
  cricket_19 INTEGER DEFAULT 0,
  cricket_20 INTEGER DEFAULT 0,
  cricket_bull INTEGER DEFAULT 0,
  cricket_points INTEGER DEFAULT 0, -- points scored on opponent's open numbers
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED YOUR PLAYERS HERE - edit names as needed
-- ============================================================
INSERT INTO players (name) VALUES
  ('Player One'),
  ('Player Two'),
  ('Player Three'),
  ('Player Four'),
  ('Player Five');

-- ============================================================
-- STATS VIEWS
-- ============================================================

-- 501/301 overall stats per player
CREATE VIEW stats_501 AS
SELECT
  p.id AS player_id,
  p.name,
  COUNT(DISTINCT m.id) AS matches_played,
  COUNT(DISTINCT CASE WHEN m.winner_id = p.id THEN m.id END) AS matches_won,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN m.winner_id = p.id THEN m.id END) / NULLIF(COUNT(DISTINCT m.id), 0), 1) AS win_pct,
  COUNT(DISTINCT l.id) AS legs_played,
  COUNT(DISTINCT CASE WHEN l.winner_id = p.id THEN l.id END) AS legs_won,
  COUNT(t.id) AS total_turns,
  ROUND(AVG(t.score)::numeric, 1) AS three_dart_avg,
  MAX(t.score) AS high_score,
  COUNT(CASE WHEN t.score >= 100 THEN 1 END) AS scores_100_plus,
  COUNT(CASE WHEN t.score >= 140 THEN 1 END) AS scores_140_plus,
  COUNT(CASE WHEN t.score = 180 THEN 1 END) AS scores_180,
  COUNT(CASE WHEN t.is_checkout_attempt THEN 1 END) AS checkout_attempts,
  COUNT(CASE WHEN t.is_checkout_success THEN 1 END) AS checkout_hits,
  ROUND(100.0 * COUNT(CASE WHEN t.is_checkout_success THEN 1 END) / NULLIF(COUNT(CASE WHEN t.is_checkout_attempt THEN 1 END), 0), 1) AS checkout_pct,
  MAX(CASE WHEN t.is_checkout_success THEN t.score END) AS high_checkout
FROM players p
LEFT JOIN matches m ON (m.player1_id = p.id OR m.player2_id = p.id) AND m.game_type IN ('501', '301') AND m.status = 'completed'
LEFT JOIN legs l ON l.match_id = m.id
LEFT JOIN turns t ON t.leg_id = l.id AND t.player_id = p.id AND t.score IS NOT NULL
GROUP BY p.id, p.name;

-- Cricket stats per player
CREATE VIEW stats_cricket AS
SELECT
  p.id AS player_id,
  p.name,
  COUNT(DISTINCT m.id) AS matches_played,
  COUNT(DISTINCT CASE WHEN m.winner_id = p.id THEN m.id END) AS matches_won,
  ROUND(100.0 * COUNT(DISTINCT CASE WHEN m.winner_id = p.id THEN m.id END) / NULLIF(COUNT(DISTINCT m.id), 0), 1) AS win_pct,
  COUNT(t.id) AS total_turns,
  ROUND(AVG(
    t.cricket_15 + t.cricket_16 + t.cricket_17 + t.cricket_18 + 
    t.cricket_19 + t.cricket_20 + t.cricket_bull
  )::numeric, 2) AS avg_marks_per_round,
  SUM(t.cricket_points) AS total_points_scored,
  COUNT(CASE WHEN t.cricket_bull > 0 THEN 1 END) AS turns_with_bull
FROM players p
LEFT JOIN matches m ON (m.player1_id = p.id OR m.player2_id = p.id) AND m.game_type = 'cricket' AND m.status = 'completed'
LEFT JOIN legs l ON l.match_id = m.id
LEFT JOIN turns t ON t.leg_id = l.id AND t.player_id = p.id
GROUP BY p.id, p.name;

-- Head to head record
CREATE VIEW stats_head_to_head AS
SELECT
  p1.name AS player1,
  p2.name AS player2,
  m.game_type,
  COUNT(*) AS matches_played,
  COUNT(CASE WHEN m.winner_id = p1.id THEN 1 END) AS player1_wins,
  COUNT(CASE WHEN m.winner_id = p2.id THEN 1 END) AS player2_wins
FROM matches m
JOIN players p1 ON m.player1_id = p1.id
JOIN players p2 ON m.player2_id = p2.id
WHERE m.status = 'completed'
GROUP BY p1.name, p2.name, m.game_type;

-- ============================================================
-- ROW LEVEL SECURITY (allow public read/write for simplicity)
-- If you want to lock it down later, add auth here
-- ============================================================
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON players FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON matches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON legs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON turns FOR ALL USING (true) WITH CHECK (true);
