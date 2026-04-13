import React from "react";
import { createRoot } from "react-dom/client";
import TournamentApp from "./TournamentApp";

let root = null;

function injectPageScript(file) {
  if (document.getElementById("adtournament-token-injected")) return;

  const script = document.createElement("script");
  script.id = "adtournament-token-injected";
  script.src = chrome.runtime.getURL(file);
  script.type = "text/javascript";
  script.onload = () => script.remove();

  (document.head || document.documentElement).appendChild(script);
}

function persistToken(token, savedAt = Date.now()) {
  if (!token) return;

  try {
    localStorage.setItem("AdTournamentExtensionBearerToken", token);
    localStorage.setItem("AdTournamentExtensionBearerTokenSavedAT", String(savedAt));
  } catch (error) {
    console.warn("[Autodarts Tournament] localStorage write failed", error);
  }

  try {
    chrome.storage?.local?.set({
      adTourneyBearerToken: token,
      adTourneyBearerTokenSavedAt: savedAt,
    });
  } catch (error) {
    console.warn("[Autodarts Tournament] chrome.storage write failed", error);
  }
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.origin !== window.location.origin) return;

  if (event.data?.type === "AD_TOKEN_UPDATE" && event.data?.token) {
    persistToken(event.data.token, event.data.savedAt || Date.now());
  }
});

injectPageScript("src/injected.js");

function showTournament() {
  const main = document.querySelector(".css-z42oq0");
  const defaultContent = document.querySelector(".css-nfhdnc");

  if (!main) return;

  let container = document.getElementById("adtournament-root");

  if (!container) {
    container = document.createElement("div");
    container.id = "adtournament-root";
    container.style.width = "100%";
    container.style.marginTop = "20px";
    container.style.order = "9999";
    main.appendChild(container);
  }

  if (defaultContent) defaultContent.style.display = "none";
  container.style.display = "block";

  if (!root) {
    root = createRoot(container);
  }

  root.render(<TournamentApp />);
}

function hideTournament() {
  const container = document.getElementById("adtournament-root");
  const defaultContent = document.querySelector(".css-nfhdnc");

  if (container) container.style.display = "none";
  if (defaultContent) defaultContent.style.display = "block";
}

function injectNavButton() {
  if (document.getElementById("adtournament-link")) return;

  const nav = document.querySelector(".navigation");
  if (!nav) return;

  const ref = [...nav.querySelectorAll("a")].find((a) => a.href.includes("tournaments"));
  if (!ref) return;

  const btn = document.createElement("a");
  btn.id = "adtournament-link";
  btn.className = ref.className;
  btn.style.display = "flex";
  btn.style.alignItems = "center";
  btn.style.gap = "10px";

  const img = document.createElement("img");
  img.src = chrome.runtime.getURL("tournament.png");
  img.style.width = "18px";

  const text = document.createElement("span");
  text.innerText = "Dart Cup";

  btn.appendChild(img);
  btn.appendChild(text);

  btn.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    showTournament();
  };

  ref.parentNode.insertBefore(btn, ref.nextSibling);
}

function bindNav() {
  const nav = document.querySelector(".navigation");
  if (!nav || nav.dataset.adtournamentBound === "true") return;

  nav.dataset.adtournamentBound = "true";
  nav.addEventListener("click", (e) => {
    const link = e.target.closest("a");
    if (!link) return;

    if (link.id !== "adtournament-link") {
      hideTournament();
    }
  });
}

function init() {
  injectNavButton();
  bindNav();

  const observer = new MutationObserver(() => {
    injectNavButton();
    bindNav();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}