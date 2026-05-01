import { useEffect, useState } from "react";
import { Target, Zap, Trophy, BarChart2 } from "lucide-react";
import DesktopHomeScreen from "./DesktopHomeScreen";

const APP_VERSION = "V2.2026.03.29.21.34.29";
const DESKTOP_QUERY = "(min-width: 1024px)";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e) => setIsDesktop(e.matches);
    // Safari < 14 falls back to addListener
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else mq.addListener(onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", onChange);
      else mq.removeListener(onChange);
    };
  }, []);
  return isDesktop;
}

export default function HomeScreen({ navigate }) {
  const isDesktop = useIsDesktop();
  if (isDesktop) return <DesktopHomeScreen navigate={navigate} />;

  // ── Mobile / tablet — original layout, unchanged ───────────────
  return (
    <div className="home">
      <div className="home-header">
        <div className="bullseye-icon" onClick={() => navigate("admin")} style={{ cursor: "pointer" }}>
          <Target size={56} strokeWidth={1.5} color="#e8a020" />
        </div>
        <h1>SWEET RELEASE</h1>
        <p className="subtitle">Track. Compete. Dominate.</p>
      </div>

      <div className="home-buttons">
        <button className="btn-primary big-btn" onClick={() => navigate("new")}>
          <span className="btn-icon"><Zap size={18} strokeWidth={2} /></span>
          NEW MATCH
        </button>
        <button className="btn-secondary big-btn" onClick={() => navigate("seasons")}>
          <span className="btn-icon"><Trophy size={18} strokeWidth={2} /></span>
          SEASONS
        </button>
        <button className="btn-secondary big-btn" onClick={() => navigate("stats")}>
          <span className="btn-icon"><BarChart2 size={18} strokeWidth={2} /></span>
          STATS
        </button>
      </div>

      <div className="version-stamp">{APP_VERSION}</div>
    </div>
  );
}
