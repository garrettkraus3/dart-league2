# 🎯 Dart League App — Setup Guide

## What You're Deploying

A mobile-first web app where your crew logs dart matches in real time.  
Per-turn score entry → full stats → leaderboard. Works on any phone via a URL.

**Stack:** React (Vite) + Supabase (database) + Vercel (hosting)  
**Cost:** $0 on free tiers for typical friend-group usage  
**Time to deploy:** ~45 minutes

---

## PART 1 — Set Up Your Database (Supabase)

### Step 1: Create a Supabase account
1. Go to https://supabase.com and click **Start your project**
2. Sign up with GitHub (easiest) or email
3. Click **New project**
4. Name it `dart-league`, set a database password (save this somewhere), pick any region close to you
5. Wait ~2 minutes for it to spin up

### Step 2: Run the database schema
1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase_schema.sql` from this folder
4. Copy the entire contents and paste it into the SQL editor
5. **BEFORE running:** scroll down and edit the player names in the INSERT block:
   ```sql
   INSERT INTO players (name) VALUES
     ('Player One'),   -- ← change these to real names
     ('Player Two'),
     ...
   ```
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. You should see "Success. No rows returned"

### Step 3: Get your API keys
1. In Supabase, click **Project Settings** (gear icon, bottom left)
2. Click **API**
3. Copy two values — you'll need them soon:
   - **Project URL** (looks like `https://abcxyz.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

---

## PART 2 — Get the Code on GitHub

### Step 4: Create a GitHub account (if you don't have one)
Go to https://github.com and sign up. Free.

### Step 5: Create a new repository
1. Click the **+** icon top right → **New repository**
2. Name it `dart-league`
3. Keep it **Private** (recommended — your stats stay private)
4. Click **Create repository**

### Step 6: Upload the code
**Option A — Drag and drop (easiest):**
1. On your new repo page, click **uploading an existing file**
2. Drag the entire `darts-app` folder contents into the browser window
3. Scroll down, click **Commit changes**

**Option B — GitHub Desktop (slightly cleaner):**
1. Download GitHub Desktop from https://desktop.github.com
2. Clone your new repo to your computer
3. Copy all files from `darts-app` into the cloned folder
4. In GitHub Desktop, write a commit message like "Initial commit" and click **Commit to main**
5. Click **Push origin**

---

## PART 3 — Deploy to Vercel

### Step 7: Create a Vercel account
1. Go to https://vercel.com
2. Click **Sign Up** → **Continue with GitHub** (easiest — links your repos automatically)

### Step 8: Import your project
1. On your Vercel dashboard, click **Add New... → Project**
2. Find `dart-league` in the list and click **Import**
3. Vercel will auto-detect it as a Vite project — leave all settings as-is
4. **Before clicking Deploy**, click **Environment Variables** and add:
   - Name: `VITE_SUPABASE_URL` → Value: your Supabase Project URL
   - Name: `VITE_SUPABASE_ANON_KEY` → Value: your Supabase anon key
5. Click **Deploy**
6. Wait ~1 minute. You'll get a live URL like `dart-league-abc123.vercel.app`

**That's it. Your app is live.**

---

## PART 4 — Share It With Your Group

### Step 9: Make it easy to access
Your app URL will be something like `dart-league-abc123.vercel.app`  
Share this in your group chat. On iPhones, people can tap **Share → Add to Home Screen** and it'll act like an app icon.

**Optional — get a custom domain:**
- In Vercel, go to your project → **Settings → Domains**
- You can add something like `darts.yourdomain.com` if you own a domain
- Or buy a cheap domain at https://namecheap.com (~$10/year) and connect it

---

## PART 5 — Add or Change Players

Since the player list is "fixed and you control it," here's how to manage it:

### Adding players
1. Go to your Supabase project → **Table Editor** → **players** table
2. Click **Insert row**
3. Type the name, leave `id` and `created_at` blank (auto-filled)
4. Click **Save**

### Removing players
In the **players** table, find the row and click the trash icon.  
Note: This will fail if they have match history (by design — protects your data).  
To "retire" a player without deleting history, just stop selecting them in new matches.

---

## PART 6 — Viewing Stats

### In the app
- **Leaderboard** — sorted by win % for each game type
- **Player Stats** — full breakdown per player including 3-dart averages, checkout %, head-to-head
- **Export CSV** — downloads all raw turn data as a spreadsheet

### In Supabase directly
1. Go to **SQL Editor** → **New query**
2. You can run any SQL you want. Examples:

```sql
-- Full leaderboard for 501
SELECT * FROM stats_501 ORDER BY win_pct DESC;

-- Who has the highest 3-dart average?
SELECT name, three_dart_avg FROM stats_501 ORDER BY three_dart_avg DESC;

-- All 180s thrown
SELECT p.name, COUNT(*) as count_180s
FROM turns t JOIN players p ON t.player_id = p.id
WHERE t.score = 180
GROUP BY p.name ORDER BY count_180s DESC;

-- Head to head between two specific players
SELECT * FROM stats_head_to_head
WHERE (player1 = 'Mike' AND player2 = 'Dave')
   OR (player1 = 'Dave' AND player2 = 'Mike');

-- Checkout percentage per player (501 only)
SELECT name, checkout_attempts, checkout_hits, checkout_pct
FROM stats_501
ORDER BY checkout_pct DESC;
```

---

## Ongoing Maintenance

**If something breaks:** Check your Supabase dashboard → **Logs** for database errors,  
or check Vercel → **Deployments** for build errors.

**To update the app:** Make changes to the code files, commit and push to GitHub.  
Vercel auto-deploys within ~60 seconds every time you push.

**Backups:** Supabase automatically backs up your database on paid plans.  
On free tier, you can manually export via **Table Editor → Export**.

---

## Stats You Get Out of This

### 501 / 301
| Stat | How it's calculated |
|------|---------------------|
| 3-Dart Average | Mean score across all turns |
| High Score | Best single turn |
| 180s / 140+ / 100+ | Count of turns at each threshold |
| Checkout % | Checkout hits ÷ checkout attempts |
| High Checkout | Highest score on a successful checkout |
| Win % | Match wins ÷ matches played |
| Head-to-Head | Win/loss record vs each opponent |

### Cricket
| Stat | How it's calculated |
|------|---------------------|
| Marks Per Round | Avg marks (0-9 possible) per turn |
| Points Scored | Total points put on board |
| Win % | Match wins ÷ matches played |
| Bull Frequency | Turns where bull was hit |

---

## Troubleshooting

**"Failed to fetch" or data not loading:**  
Double-check your environment variables in Vercel. They must start with `VITE_`.

**Players not showing in dropdown:**  
Check the players table in Supabase — make sure your INSERT ran correctly.

**Cricket score logic seems wrong:**  
The app calculates points scored when you have a number closed (3+ marks) and  
your opponent does not. Points are calculated client-side and stored per turn.

**Want to reset everything and start fresh:**  
In Supabase SQL Editor: `TRUNCATE matches, legs, turns CASCADE;`  
This deletes all match data but keeps players.
