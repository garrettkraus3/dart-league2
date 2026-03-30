import React from "react";
import "./DesktopNav.css";

const NAV_ITEMS = [
  { id: "dashboard", icon: "⬡", label: "Dashboard" },
  { id: "live", icon: "◉", label: "Live Match" },
  { id: "seasons", icon: "🏆", label: "Seasons" },
  { id: "stats", icon: "◈", label: "Statistics" },
  { id: "h2h", icon: "⇌", label: "Head to Head" },
  { id: "admin", icon: "⚙", label: "Admin" },
];

export default function DesktopNav({ active, onNavigate }) {
  return (
    <nav className="desktop-nav">
      <div className="desktop-nav__brand">
        <div className="desktop-nav__logo">
          <span className="logo-sr">SR</span>
          <span className="logo-dart">🎯</span>
        </div>
        <div className="desktop-nav__title">
          <span className="brand-name">Sweet Release</span>
          <span className="brand-sub">Dart League</span>
        </div>
      </div>

      <ul className="desktop-nav__items">
        {NAV_ITEMS.map((item) => (
          <li key={item.id}>
            <button
              className={`nav-item ${active === item.id ? "nav-item--active" : ""}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-item__icon">{item.icon}</span>
              <span className="nav-item__label">{item.label}</span>
              {active === item.id && <span className="nav-item__indicator" />}
            </button>
          </li>
        ))}
      </ul>

      <div className="desktop-nav__footer">
        <span className="nav-version">Sweet Release Dart League 💦</span>
      </div>
    </nav>
  );
}
