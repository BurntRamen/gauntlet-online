import React from "react";
const ICON_PATHS = {
  play: "M8 5v14l11-7L8 5Z",
  campaign: "M4 5l5-2 6 3 5-2v15l-5 2-6-3-5 2V5Zm5-2v15m6-12v15",
  decks: "M5 4h11v16H5V4Zm4-3h11v16M9 9l2.5-2L14 9l-2.5 3L9 9Z",
  draft: "M12 3l9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5",
  compete: "M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-4 1h8",
  matches: "M6 3h12v18H6V3Zm4 5h4m-4 4h4m-4 4h4",
  community: "M16 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m18 0v-2a4 4 0 0 0-3-4M13 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm4-3a3.5 3.5 0 0 1 0 7",
  learn: "M12 6C9 3 5 3 3 4v15c3-1 6-1 9 2m0-15c3-3 7-3 9-2v15c-3-1-6-1-9 2V6Z",
  profile: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  settings: "M4 7h16M4 17h16M8 4v6m8 4v6",
  sound: "M3 9h4l5-4v14l-5-4H3V9Zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14",
  muted: "M3 9h4l5-4v14l-5-4H3V9Zm13 0 6 6m0-6-6 6",
  more: "M5 12h1m5 0h1m5 0h1",
  customize: "M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z",
};

export function DestinationIcon({ name, className = "" }) {
  return <svg className={`cd-icon ${className}`.trim()} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON_PATHS[name] || ICON_PATHS.play} /></svg>;
}
