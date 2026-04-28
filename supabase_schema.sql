-- ============================================================
-- DARTS APP — Supabase Schema (regenerated from live DB)
-- Run on a fresh Postgres 15+ project to recreate the schema.
-- The authoritative source of truth is the migrations folder
-- in Supabase; this file is a snapshot for reference / bootstrap.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- TABLES
-- ────────────────────────────────────────────────────────────

CREATE TABLE players (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE seasons (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  weeks       INTEGER     NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active','completed')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE season_players (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id  UUID NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  player_id  UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE (season_id, player_id)
);

CREATE TABLE matches (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type     TEXT        NOT NULL CHECK (game_type IN ('501','cricket')),
  legs_to_win   INTEGER     NOT NULL DEFAULT 3,
  player1_id    UUID        NOT NULL REFERENCES players(id),
  player2_id    UUID        NOT NULL REFERENCES players(id),
  winner_id     UUID        REFERENCES players(id),
  player1_legs  INTEGER     DEFAULT 0,
  player2_legs  INTEGER     DEFAULT 0,
  status        TEXT        NOT NULL DEFAULT 'in_progress'
                            CHECK (status IN ('pending','in_progress','completed')),
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  season_id     UUID        REFERENCES seasons(id) ON DELETE SET NULL
);

CREATE TABLE season_schedule (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id    UUID    NOT NULL REFERENCES seasons(id)  ON DELETE CASCADE,
  week_number  INTEGER NOT NULL,
  match_id     UUID    NOT NULL REFERENCES matches(id) ON DELETE CASCADE
);

CREATE TABLE legs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id         UUID        NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  leg_number       INTEGER     NOT NULL,
  winner_id        UUID        REFERENCES players(id),
  starting_score   INTEGER,                              -- 501 for 01 games, NULL for cricket
  status           TEXT        NOT NULL DEFAULT 'in_progress'
                               CHECK (status IN ('in_progress','completed')),
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  game_type        TEXT        CHECK (game_type IN ('501','cricket')),
  first_player_id  UUID        REFERENCES players(id)
);

CREATE TABLE turns (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id                UUID        NOT NULL REFERENCES legs(id)    ON DELETE CASCADE,
  match_id              UUID        NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id             UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  turn_number           INTEGER     NOT NULL,

  -- 01 (501) scoring
  score                 INTEGER,                       -- total scored this turn (0–180)
  score_remaining       INTEGER,                       -- score remaining after this turn
  is_bust               BOOLEAN     DEFAULT FALSE,
  is_checkout_attempt   BOOLEAN     DEFAULT FALSE,
  is_checkout_success   BOOLEAN     DEFAULT FALSE,
  checkout_dart         INTEGER,                       -- which dart finished it (1, 2, or 3)
  darts_thrown          INTEGER,                       -- dart count this turn (1, 2, or 3)

  -- Per-dart breakdown (for both 01 and cricket)
  dart1_number   TEXT,  dart1_modifier TEXT,  dart1_value INTEGER,
  dart2_number   TEXT,  dart2_modifier TEXT,  dart2_value INTEGER,
  dart3_number   TEXT,  dart3_modifier TEXT,  dart3_value INTEGER,

  -- Cricket: marks per number this turn (each capped at 3)
  cricket_15     INTEGER DEFAULT 0,
  cricket_16     INTEGER DEFAULT 0,
  cricket_17     INTEGER DEFAULT 0,
  cricket_18     INTEGER DEFAULT 0,
  cricket_19     INTEGER DEFAULT 0,
  cricket_20     INTEGER DEFAULT 0,
  cricket_bull   INTEGER DEFAULT 0,
  cricket_dbull  INTEGER DEFAULT 0,
  cricket_points INTEGER DEFAULT 0,                    -- points scored on opponent's open numbers

  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────
-- INDEXES (covering every foreign key)
-- ────────────────────────────────────────────────────────────

CREATE INDEX idx_legs_match_id              ON legs(match_id);
CREATE INDEX idx_legs_winner_id             ON legs(winner_id);
CREATE INDEX idx_legs_first_player_id       ON legs(first_player_id);
CREATE INDEX idx_matches_player1_id         ON matches(player1_id);
CREATE INDEX idx_matches_player2_id         ON matches(player2_id);
CREATE INDEX idx_matches_winner_id          ON matches(winner_id);
CREATE INDEX idx_matches_season_id          ON matches(season_id);
CREATE INDEX idx_season_players_player_id   ON season_players(player_id);
CREATE INDEX idx_season_schedule_season_id  ON season_schedule(season_id);
CREATE INDEX idx_season_schedule_match_id   ON season_schedule(match_id);
CREATE INDEX idx_turns_leg_id               ON turns(leg_id);
CREATE INDEX idx_turns_match_id             ON turns(match_id);
CREATE INDEX idx_turns_player_id            ON turns(player_id);

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
--   Read: open to anon + authenticated.
--   Write on game tables (matches/legs/turns): open so live scoring works without login.
--   Players + seasons + season_* tables: write requires auth (admin sign-in).
-- ────────────────────────────────────────────────────────────

ALTER TABLE players         ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons         ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_players  ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches         ENABLE ROW LEVEL SECURITY;
ALTER TABLE legs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE turns           ENABLE ROW LEVEL SECURITY;

-- players (admin-only writes)
CREATE POLICY "Public read players"  ON players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin insert players" ON players FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin update players" ON players FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin delete players" ON players FOR DELETE TO authenticated USING (true);

-- seasons (admin-only writes)
CREATE POLICY "Public read seasons"  ON seasons FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin insert seasons" ON seasons FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin update seasons" ON seasons FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin delete seasons" ON seasons FOR DELETE TO authenticated USING (true);

-- season_players (admin-only writes)
CREATE POLICY "Public read season_players"  ON season_players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin insert season_players" ON season_players FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin delete season_players" ON season_players FOR DELETE TO authenticated USING (true);

-- season_schedule (admin-only writes)
CREATE POLICY "Public read season_schedule"  ON season_schedule FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin insert season_schedule" ON season_schedule FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin delete season_schedule" ON season_schedule FOR DELETE TO authenticated USING (true);

-- matches (public read/write for live scoring; admin-only delete)
CREATE POLICY "Public read matches"   ON matches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert matches" ON matches FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update matches" ON matches FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin delete matches"  ON matches FOR DELETE TO authenticated USING (true);

-- legs (public read/write for live scoring; admin-only delete)
CREATE POLICY "Public read legs"   ON legs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert legs" ON legs FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update legs" ON legs FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin delete legs"  ON legs FOR DELETE TO authenticated USING (true);

-- turns (public read/write for live scoring; admin-only delete)
CREATE POLICY "Public read turns"   ON turns FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert turns" ON turns FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update turns" ON turns FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin delete turns"  ON turns FOR DELETE TO authenticated USING (true);

-- ────────────────────────────────────────────────────────────
-- HELPER FUNCTION (auto-enables RLS on newly created public tables;
-- exists in the live project but is not currently bound to an event
-- trigger here, kept for parity)
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
    IF cmd.schema_name IS NOT NULL
       AND cmd.schema_name IN ('public')
       AND cmd.schema_name NOT IN ('pg_catalog','information_schema')
       AND cmd.schema_name NOT LIKE 'pg_toast%'
       AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
    ELSE
      RAISE LOG 'rls_auto_enable: skip % (system schema or not enforced)', cmd.object_identity;
    END IF;
  END LOOP;
END;
$function$;

-- Lock down the function — must not be callable via PostgREST.
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated, public;

-- ────────────────────────────────────────────────────────────
-- STATS VIEWS (security_invoker = true so RLS is enforced as the caller,
-- not the view owner)
-- ────────────────────────────────────────────────────────────

CREATE VIEW stats_501
  WITH (security_invoker = true)
AS
WITH leg_turns AS (
  SELECT t.player_id, t.leg_id, t.turn_number, t.score, t.score_remaining,
         t.is_bust, t.is_checkout_success, t.darts_thrown,
         l.winner_id AS leg_winner
  FROM turns t
  JOIN legs  l ON l.id = t.leg_id
  WHERE l.game_type = '501' AND t.score IS NOT NULL
),
rounds AS (
  SELECT player_id, leg_id, turn_number,
         SUM(score)                         AS round_score,
         BOOL_OR(is_bust)                   AS busted,
         BOOL_OR(is_checkout_success)       AS checked_out,
         MIN(score_remaining)               AS remaining
  FROM leg_turns
  GROUP BY player_id, leg_id, turn_number
),
leg_stats AS (
  SELECT t.player_id, t.leg_id, l.winner_id,
         COUNT(DISTINCT t.turn_number) AS rounds_played,
         SUM(t.darts_thrown)           AS darts_thrown
  FROM turns t
  JOIN legs  l ON l.id = t.leg_id
  WHERE l.game_type = '501'
  GROUP BY t.player_id, t.leg_id, l.winner_id
),
player_legs AS (
  SELECT player_id,
         COUNT(*)                                                AS legs_played,
         SUM(CASE WHEN winner_id = player_id THEN 1 ELSE 0 END)  AS legs_won,
         SUM(darts_thrown)                                       AS total_darts,
         SUM(rounds_played)                                      AS total_rounds
  FROM leg_stats
  GROUP BY player_id
),
non_bust AS (
  SELECT player_id,
         AVG(round_score)                                                            AS three_dart_avg,
         MAX(round_score)                                                            AS high_score,
         SUM(CASE WHEN round_score = 180                          THEN 1 ELSE 0 END) AS scores_180,
         SUM(CASE WHEN round_score >= 150 AND round_score < 180   THEN 1 ELSE 0 END) AS scores_high_ton,
         SUM(CASE WHEN round_score >= 100 AND round_score < 150   THEN 1 ELSE 0 END) AS scores_low_ton
  FROM rounds
  WHERE NOT busted
  GROUP BY player_id
),
checkout_stats AS (
  SELECT player_id,
         SUM(CASE WHEN checked_out             THEN 1 ELSE 0 END) AS checkouts,
         SUM(CASE WHEN busted OR checked_out   THEN 1 ELSE 0 END) AS checkout_chances,
         MAX(CASE WHEN checked_out THEN round_score ELSE 0 END)   AS high_checkout
  FROM rounds
  GROUP BY player_id
),
match_stats AS (
  SELECT p.id AS player_id,
         COUNT(DISTINCT m.id)                                                   AS matches_played,
         COUNT(DISTINCT CASE WHEN m.winner_id = p.id THEN m.id END)             AS matches_won
  FROM players p
  JOIN matches m ON m.player1_id = p.id OR m.player2_id = p.id
  JOIN legs    l ON l.match_id  = m.id AND l.game_type = '501'
  WHERE m.status = 'completed'
  GROUP BY p.id
)
SELECT
  p.id                                                AS player_id,
  p.name,
  COALESCE(ms.matches_played, 0)                      AS matches_played,
  COALESCE(ms.matches_won, 0)                         AS matches_won,
  CASE WHEN COALESCE(ms.matches_played,0) > 0
       THEN ROUND(ms.matches_won::numeric / ms.matches_played::numeric * 100, 1)
       ELSE 0 END                                     AS win_pct,
  COALESCE(pl.legs_played, 0)                         AS legs_played,
  COALESCE(pl.legs_won, 0)                            AS legs_won,
  ROUND(nb.three_dart_avg, 1)                         AS three_dart_avg,
  nb.high_score,
  COALESCE(nb.scores_180, 0)                          AS scores_180,
  COALESCE(nb.scores_high_ton, 0)                     AS scores_high_ton,
  COALESCE(nb.scores_low_ton, 0)                      AS scores_low_ton,
  CASE WHEN COALESCE(cs.checkout_chances,0) > 0
       THEN ROUND(cs.checkouts::numeric / cs.checkout_chances::numeric * 100, 1)
       ELSE NULL END                                  AS checkout_pct,
  cs.high_checkout,
  CASE WHEN COALESCE(pl.legs_won,0) > 0
       THEN ROUND(pl.total_darts / pl.legs_won::numeric, 1)
       ELSE NULL END                                  AS avg_darts_per_leg
FROM players p
LEFT JOIN match_stats    ms ON ms.player_id = p.id
LEFT JOIN player_legs    pl ON pl.player_id = p.id
LEFT JOIN non_bust       nb ON nb.player_id = p.id
LEFT JOIN checkout_stats cs ON cs.player_id = p.id;

CREATE VIEW stats_cricket
  WITH (security_invoker = true)
AS
WITH cricket_turns AS (
  SELECT t.player_id, t.leg_id, t.turn_number,
         COALESCE(t.cricket_15,0) + COALESCE(t.cricket_16,0) + COALESCE(t.cricket_17,0)
       + COALESCE(t.cricket_18,0) + COALESCE(t.cricket_19,0) + COALESCE(t.cricket_20,0)
       + COALESCE(t.cricket_bull,0) + COALESCE(t.cricket_dbull,0) AS marks_this_turn,
         COALESCE(t.cricket_points, 0) AS points_this_turn
  FROM turns t
  JOIN legs  l ON l.id = t.leg_id
  WHERE l.game_type = 'cricket'
),
round_totals AS (
  SELECT player_id,
         SUM(marks_this_turn)  AS total_marks,
         SUM(points_this_turn) AS total_points,
         COUNT(*)              AS total_rounds
  FROM cricket_turns
  GROUP BY player_id
),
cricket_leg_stats AS (
  SELECT player_id,
         COUNT(*)                                                       AS legs_played,
         SUM(CASE WHEN winner_id = player_id THEN 1 ELSE 0 END)         AS legs_won
  FROM (
    SELECT DISTINCT t.player_id, t.leg_id, l.winner_id
    FROM turns t
    JOIN legs  l ON l.id = t.leg_id
    WHERE l.game_type = 'cricket'
  ) sub
  GROUP BY player_id
),
match_stats AS (
  SELECT p.id AS player_id,
         COUNT(DISTINCT m.id)                                            AS matches_played,
         COUNT(DISTINCT CASE WHEN m.winner_id = p.id THEN m.id END)      AS matches_won
  FROM players p
  JOIN matches m ON m.player1_id = p.id OR m.player2_id = p.id
  JOIN legs    l ON l.match_id  = m.id AND l.game_type = 'cricket'
  WHERE m.status = 'completed'
  GROUP BY p.id
)
SELECT
  p.id   AS player_id,
  p.name,
  COALESCE(ms.matches_played, 0) AS matches_played,
  COALESCE(ms.matches_won, 0)    AS matches_won,
  CASE WHEN COALESCE(ms.matches_played,0) > 0
       THEN ROUND(ms.matches_won::numeric / ms.matches_played::numeric * 100, 1)
       ELSE 0 END                AS win_pct,
  COALESCE(cl.legs_played, 0)    AS legs_played,
  COALESCE(cl.legs_won, 0)       AS legs_won,
  CASE WHEN COALESCE(cl.legs_played,0) > 0
       THEN ROUND(cl.legs_won::numeric / cl.legs_played::numeric * 100, 1)
       ELSE NULL END             AS leg_win_pct,
  CASE WHEN COALESCE(rt.total_rounds,0) > 0
       THEN ROUND(rt.total_marks::numeric / rt.total_rounds::numeric, 2)
       ELSE NULL END             AS avg_marks_per_round,
  COALESCE(rt.total_points, 0)   AS total_points_scored,
  COALESCE(rt.total_marks, 0)    AS total_marks,
  COALESCE(rt.total_rounds, 0)   AS total_rounds
FROM players p
LEFT JOIN match_stats       ms ON ms.player_id = p.id
LEFT JOIN cricket_leg_stats cl ON cl.player_id = p.id
LEFT JOIN round_totals      rt ON rt.player_id = p.id;

CREATE VIEW stats_head_to_head
  WITH (security_invoker = true)
AS
SELECT
  p1.name        AS player1,
  p2.name        AS player2,
  m.game_type,
  COUNT(*)                                                          AS matches_played,
  COUNT(CASE WHEN m.winner_id = p1.id THEN 1 END)                   AS player1_wins,
  COUNT(CASE WHEN m.winner_id = p2.id THEN 1 END)                   AS player2_wins
FROM matches m
JOIN players p1 ON m.player1_id = p1.id
JOIN players p2 ON m.player2_id = p2.id
WHERE m.status = 'completed'
GROUP BY p1.name, p2.name, m.game_type;

-- ────────────────────────────────────────────────────────────
-- REALTIME — publish the live-scoring tables
-- ────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE matches;
ALTER PUBLICATION supabase_realtime ADD TABLE legs;
ALTER PUBLICATION supabase_realtime ADD TABLE turns;

-- ────────────────────────────────────────────────────────────
-- OPTIONAL: seed a few players (uncomment to use)
-- ────────────────────────────────────────────────────────────
-- INSERT INTO players (name) VALUES
--   ('Player One'),
--   ('Player Two'),
--   ('Player Three');
