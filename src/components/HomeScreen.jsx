import { Target, Zap, Trophy, TrendingUp, BarChart2, Settings } from "lucide-react";

const APP_VERSION = "V2.2026.03.29.21.34.29";

export default function HomeScreen({ navigate }) {
  return (
    <div className="home">
      <div className="home-header">
        <div className="bullseye-icon">
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
        <button className="btn-secondary big-btn" onClick={() => navigate("leaderboard")}>
          <span className="btn-icon"><TrendingUp size={18} strokeWidth={2} /></span>
          LEADERBOARD
        </button>
        <button className="btn-secondary big-btn" onClick={() => navigate("stats")}>
          <span className="btn-icon"><BarChart2 size={18} strokeWidth={2} /></span>
          STATS
        </button>
        <button className="btn-admin" onClick={() => navigate("admin")}>
          <Settings size={14} strokeWidth={2} style={{ display: "inline", verticalAlign: "middle", marginRight: "0.35rem" }} />
          Admin
        </button>
      </div>

      <div className="version-stamp">{APP_VERSION}</div>
    </div>
  );
}
