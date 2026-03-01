import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ─── Views ───────────────────────────────────────────────────────────────────
import HomeScreen from "./components/HomeScreen";
import NewMatch from "./components/NewMatch";
import ActiveMatch from "./components/ActiveMatch";
import Leaderboard from "./components/Leaderboard";
import StatsPage from "./components/StatsPage";

export default function App() {
  const [view, setView] = useState("home");
  const [activeMatch, setActiveMatch] = useState(null);
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    supabase.from("players").select("*").order("name").then(({ data }) => {
      if (data) setPlayers(data);
    });
  }, []);

  const navigate = (v, data = null) => {
    if (v === "active" && data) setActiveMatch(data);
    setView(v);
  };

  return (
    <div className="app">
      {view === "home" && <HomeScreen navigate={navigate} />}
      {view === "new" && <NewMatch players={players} supabase={supabase} navigate={navigate} />}
      {view === "active" && <ActiveMatch match={activeMatch} players={players} supabase={supabase} navigate={navigate} />}
      {view === "leaderboard" && <Leaderboard supabase={supabase} navigate={navigate} />}
      {view === "stats" && <StatsPage supabase={supabase} players={players} navigate={navigate} />}
    </div>
  );
}
