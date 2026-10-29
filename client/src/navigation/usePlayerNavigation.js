import { useCallback, useEffect, useRef, useState } from "react";

const aliases = { journey: "campaign", build: "decks", identity: "profile" };
const pages = new Set(["play", "campaign", "decks", "draft", "compete", "matches", "community", "learn", "profile", "settings", "studio"]);
const views = {
  play: ["tables", "practice"], campaign: ["lore"], decks: ["library"],
  draft: ["live", "bot", "sealed", "league"], compete: ["ranked", "events", "para", "standings"],
  matches: ["recent", "replays"], community: ["friends", "challenges", "messages", "invitations"],
  learn: ["rulebook", "formats", "lore"], profile: ["record", "library"],
};

export function readPlayerRoute(location = window.location) {
  const params = new URLSearchParams(location.search);
  if (/^\/admin\/gauntlet(?:\/|$)/.test(location.pathname) || params.get("studio") === "1" || params.get("admin") === "1") return { page: "studio", view: "" };
  const requested = params.get("page");
  const page = pages.has(requested) ? requested : (!requested && params.get("resetToken")?.trim() ? "profile" : "play");
  const view = views[page]?.includes(params.get("view")) ? params.get("view") : (!requested && page === "play" && params.get("join") ? "tables" : "");
  return { page, view };
}

export default function usePlayerNavigation({ beforeNavigate } = {}) {
  const [route, setRoute] = useState(readPlayerRoute);
  const guard = useRef(beforeNavigate);
  const currentLocation = useRef({ url: window.location.href, state: window.history.state });
  guard.current = beforeNavigate;
  useEffect(() => {
    const onPop = (event) => {
      const next = readPlayerRoute();
      if (guard.current && guard.current(next) === false) {
        event.preventDefault();
        // Native popstate is not cancelable. Keep later workflow listeners from
        // discarding the editor while restoring its prior URL and history state.
        event.stopImmediatePropagation();
        const previous = currentLocation.current;
        if (window.location.href !== previous.url) window.history.pushState(previous.state, "", previous.url);
        return;
      }
      currentLocation.current = { url: window.location.href, state: window.history.state };
      setRoute(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const navigate = useCallback((requested, view = "") => {
    const page = aliases[requested] || requested;
    if (!pages.has(page)) return;
    const next = { page, view: views[page]?.includes(view) ? view : "" };
    const url = new URL(window.location.href);
    if (page !== "studio") {
      url.searchParams.delete("admin");
      url.searchParams.delete("studio");
      if (/^\/admin\/gauntlet(?:\/|$)/.test(url.pathname)) url.pathname = "/";
    }
    url.searchParams.set("page", next.page);
    if (next.view) url.searchParams.set("view", next.view); else url.searchParams.delete("view");
    // Invitation, recovery, claim and public record parameters are never consumed here.
    if (url.href !== window.location.href) window.history.pushState({ gauntletPage: next }, "", url);
    currentLocation.current = { url: window.location.href, state: window.history.state };
    setRoute(next);
  }, []);
  return { route, navigate };
}
