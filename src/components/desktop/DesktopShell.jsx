import React, { useState } from "react";
import DesktopNav from "./DesktopNav";
import DesktopStatsDashboard from "./DesktopStatsDashboard";
import DesktopLiveMatch from "./DesktopLiveMatch";
import "./DesktopShell.css";

const APP_VERSION = "V2.2026.03.29.21.15.00";

export default function DesktopShell({ supabase, players }) {
  const [activePage, setActivePage] = useState("dashboard");

  return (
    <div className="desktop-shell">
      <DesktopNav active={activePage} onNavigate={setActivePage} />

      <main className="desktop-shell__main">
        {activePage === "dashboard" && <DesktopDashboardHome onNavigate={setActivePage} />}
        {activePage === "live"      && <DesktopLiveMatch supabase={supabase} />}
        {activePage === "stats"     && <DesktopStatsDashboard supabase={supabase} />}
        {activePage === "h2h"       && <DesktopStatsDashboard supabase={supabase} defaultTab="h2h" />}
        {activePage === "seasons"   && <DesktopInfoPanel icon="🏆" title="Seasons" desc="Season management is optimized for mobile. Open the app on your phone to manage seasons, start matches, and track schedules." />}
        {activePage === "admin"     && <DesktopInfoPanel icon="⚙️" title="Admin Panel" desc="Admin functions are optimized for mobile. Open the app on your phone to manage players, reset data, and configure settings." />}
      </main>

      <div className="desktop-shell__version">{APP_VERSION}</div>
    </div>
  );
}

function DesktopDashboardHome({ onNavigate }) {
  return (
    <div className="desktop-home">
      <div className="desktop-home__header">
        <div className="desktop-home__eyebrow">Welcome back</div>
        <h1 className="desktop-home__title">Sweet Release Dart League 💦</h1>
        <p className="desktop-home__subtitle">Admin &amp; Spectator Dashboard — use your phone to enter scores during play</p>
      </div>
      <div className="desktop-home__cards">
        <QuickCard icon="◉" title="Live Match" desc="Watch active matches update in real time with throw-by-throw logs and cricket mark boards." color="#22c55e" onClick={() => onNavigate("live")} />
        <QuickCard icon="◈" title="Statistics" desc="Deep dive into 501 averages, checkout %, cricket MPR, high scores, and more." color="#3b82f6" onClick={() => onNavigate("stats")} />
        <QuickCard icon="⇌" title="Head to Head" desc="Compare any two players' win/loss records across both game types." color="#8b5cf6" onClick={() => onNavigate("h2h")} />
        <QuickCard icon="🏆" title="Seasons" desc="Seasons are managed on mobile — open your phone to view schedules and start matches." color="#f59e0b" onClick={() => onNavigate("seasons")} />
      </div>
    </div>
  );
}

function QuickCard({ icon, title, desc, color, onClick }) {
  return (
    <button className="quick-card" onClick={onClick} style={{ "--card-accent": color }}>
      <div className="quick-card__icon">{icon}</div>
      <div className="quick-card__title">{title}</div>
      <div className="quick-card__desc">{desc}</div>
      <div className="quick-card__arrow">→</div>
    </button>
  );
}

function DesktopInfoPanel({ icon, title, desc }) {
  return (
    <div className="desktop-passthrough">
      <div className="desktop-passthrough__icon">{icon}</div>
      <div className="desktop-passthrough__title">{title}</div>
      <div className="desktop-passthrough__sub">{desc}</div>
    </div>
  );
}
