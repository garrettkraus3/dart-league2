const APP_VERSION = "V2.2026.02.28.22.47.15";

export default function HomeScreen({ navigate }) {
  return (
    <div className="home">
      <div className="home-header">
        <div className="bullseye-icon">🎯</div>
        <h1>SWEET RELEASE</h1>
        <p className="subtitle">Track. Compete. Dominate.</p>
      </div>

      <div className="home-buttons">
        <button className="btn-primary big-btn" onClick={() => navigate("new")}>
          <span className="btn-icon">⚡</span>
          NEW MATCH
        </button>
        <button className="btn-secondary big-btn" onClick={() => navigate("leaderboard")}>
          <span className="btn-icon">🏆</span>
          LEADERBOARD
        </button>
        <button className="btn-secondary big-btn" onClick={() => navigate("stats")}>
          <span className="btn-icon">📊</span>
          PLAYER STATS
        </button>
        <button className="btn-admin" onClick={() => navigate("admin")}>
          ⚙️ Admin
        </button>
      </div>

      <div className="version-stamp">{APP_VERSION}</div>
    </div>
  );
}
