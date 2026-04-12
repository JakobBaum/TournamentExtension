import React from "react";
import { createRoot } from "react-dom/client";
import TournamentApp from "./TournamentApp";

let root = null;

// 🔥 CSS sauber laden
function injectCSS() {
  if (document.getElementById("adtournament-style")) return true;

  const target = document.head || document.documentElement || document.body;
  if (!target) return false;

  const link = document.createElement("link");
  link.id = "adtournament-style";
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("tournament.css");

  target.appendChild(link);
  return true;
}

// 🔥 React App mounten
function mountTournamentApp() {
  const run = () => {
    const container = document.getElementById("adtournament-root");
    if (!container) {
      console.warn("❌ adtournament-root nicht gefunden");
      return;
    }

    if (!injectCSS()) {
      window.requestAnimationFrame(run);
      return;
    }

    if (!root) {
      root = createRoot(container);
    }

    root.render(<TournamentApp />);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
    return;
  }

  run();
}

// 🔥 Event Listener (wird von content.js ausgelöst)
window.addEventListener("adtournament:open", mountTournamentApp);