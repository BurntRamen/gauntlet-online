const PLAY_SETUP_VIEWS = new Set(["tables", "practice"]);

export function usesPlayModeMusic(route = {}) {
  if (route.page === "play") return PLAY_SETUP_VIEWS.has(route.view);
  if (route.page === "compete") return route.view === "ranked";
  return route.page === "draft";
}
