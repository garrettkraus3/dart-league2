import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";

import HomeScreen from "./components/HomeScreen";
import NewMatch from "./components/NewMatch";
import ActiveMatch from "./components/ActiveMatch";
import Leaderboard from "./components/Leaderboard";
import StatsPage from "./components/StatsPage";
import AdminPanel from "./components/AdminPanel";
import SeasonManager from "./components/SeasonManager";

function GlobalSpinner() {
  return (
    <div className="global-spinner-overlay">
      <div className="global-spinner-box">
        <div className="spinner-ring" />
        <div className="spinner-label">Please wait...</div>
      </div>
    </div>
  );
}

// Read ?match=<id> from the URL on load
function getMatchIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("match") || null;
}

// Update the URL bar without reloading the page
function setMatchInUrl(matchId) {
  const url = matchId
    ? `${window.location.pathname}?match=${matchId}`
    : window.location.pathname;
  window.history.replaceState({}, "", url);
}

export default function App() {
  const [view, setView]               = useState("home");
  const [activeMatch, setActiveMatch] = useState(null);
  const [players, setPlayers]         = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);

  // Load players once
  useEffect(() => {
    supabase.from("players").select("*").order("name").then(({ data }) => {
      if (data) setPlayers(data);
    });
  }, []);

  // On first load: if there's a ?match= in the URL, jump straight into that match
  useEffect(() => {
    const matchId = getMatchIdFromUrl();
    if (!matchId) return;

    const load = async () => {
      setGlobalLoading(true);

      const { data: match } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId)
        .single();

      if (!match || match.status === "completed") {
        setMatchInUrl(null);
        setGlobalLoading(false);
        return;
      }

      // Find the current active leg
      const { data: legs } = await supabase
        .from("legs")
        .select("*")
        .eq("match_id", matchId)
        .order("leg_number", { ascending: false });

      const currentLeg = legs?.find(l => l.status === "in_progress") || legs?.[0] || null;

      setActiveMatch({ match, currentLeg });
      setView("active");
      setGlobalLoading(false);
    };

    load();
  }, []);

  const navigate = (v, data = null) => {
    if (v === "active" && data) {
      setActiveMatch(data);
      setMatchInUrl(data.match?.id || null);
    } else if (v === "home") {
      setMatchInUrl(null);
    }
    setView(v);
  };

  return (
    <div className="app">
      {globalLoading && <GlobalSpinner />}
      {view === "home"        && <HomeScreen navigate={navigate} supabase={supabase} />}
      {view === "new"         && <NewMatch players={players} supabase={supabase} navigate={navigate} />}
      {view === "active"      && <ActiveMatch match={activeMatch} players={players} supabase={supabase} navigate={navigate} />}
      {view === "leaderboard" && <Leaderboard supabase={supabase} navigate={navigate} />}
      {view === "stats"       && <StatsPage supabase={supabase} players={players} navigate={navigate} />}
      {view === "admin"       && <AdminPanel supabase={supabase} players={players} setPlayers={setPlayers} navigate={navigate} setGlobalLoading={setGlobalLoading} />}
      {view === "seasons"     && <SeasonManager supabase={supabase} players={players} navigate={navigate} setGlobalLoading={setGlobalLoading} />}
    </div>
  );
}
