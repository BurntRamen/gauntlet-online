import React, { useEffect, useId, useRef, useState } from "react";
import { getDestination, PRIMARY_DESTINATIONS, MOBILE_DESTINATIONS, MORE_DESTINATIONS } from "./destinations";
import { resolveVisualAsset } from "../GauntletVisuals";
import { GAUNTLET_CREST, MENU_SCENES } from "./menuArtwork";
import "./PlayerShell.css";

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

function NavigationButton({ id, current, onNavigate, mobile = false }) {
  const entry = getDestination(id);
  return (
    <button type="button" className={`cd-nav-button${current === id ? " is-current" : ""}`} aria-current={current === id ? "page" : undefined} onClick={() => onNavigate(id)}>
      <DestinationIcon name={id} />
      <span>{mobile ? entry.mobileLabel || entry.label : entry.label}</span>
    </button>
  );
}

function MoreSheet({ destination, onNavigate, onClose, onCustomize, customizable, editing, onDoneEditing, ownerAuthorized, onAdmin }) {
  const sheetRef = useRef(null);
  const headingId = useId();

  useEffect(() => {
    const sheet = sheetRef.current;
    const focusable = () => [...sheet.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex="0"]')];
    focusable()[0]?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      } else if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!elements.length) {
          event.preventDefault();
          sheet.focus();
        } else if (event.shiftKey && (document.activeElement === first || !sheet.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !sheet.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const visit = (id) => {
    onClose(false);
    onNavigate(id);
  };

  return (
    <div className="cd-sheet-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }} role="presentation">
      <section className="cd-more-sheet" role="dialog" aria-modal="true" aria-labelledby={headingId} ref={sheetRef} tabIndex={-1}>
        <header className="cd-sheet-header"><div><span className="cd-eyebrow">YOUR COMMAND DECK</span><h2 id={headingId}>More destinations</h2></div><button type="button" className="cd-sheet-close" onClick={onClose} aria-label="Close More menu">×</button></header>
        <nav className="cd-more-links" aria-label="More destinations">
          {MORE_DESTINATIONS.map((id) => {
            const entry = getDestination(id);
            return <button key={id} type="button" aria-current={destination === id ? "page" : undefined} onClick={() => visit(id)}><DestinationIcon name={id} /><span><strong>{entry.label}</strong><small>{entry.outcome}</small></span><span aria-hidden="true">→</span></button>;
          })}
        </nav>
        {(customizable || editing) && <div className="cd-sheet-layout">
          <DestinationIcon name="customize" />
          <div><strong>Your page, your way</strong><p>{editing ? "Arrange shortcuts, then finish when you are ready." : "Arrange or hide shortcuts on this page."}</p></div>
          {editing ? <button type="button" className="cd-button cd-button-primary" onClick={() => { onClose(); onDoneEditing?.(); }}>Done Editing</button> : <button type="button" className="cd-button" disabled={!customizable} onClick={() => { onClose(); onCustomize?.(); }}>Customize this page</button>}
        </div>}
        {ownerAuthorized && onAdmin && <div className="cd-admin-access"><button type="button" className="cd-button-quiet" onClick={() => { onClose(false); onAdmin(); }}>Open Admin workspace <span aria-hidden="true">↗</span></button></div>}
      </section>
    </div>
  );
}

export default function PlayerShell({ destination = "play", navigationKey = destination, pageTitle, pageDescription, pageEyebrow, pageDetail, onNavigate, account, audioMuted = false, onToggleAudio, ownerAuthorized = false, onAdmin, onCustomize, customizable = false, editing = false, onDoneEditing, children, notices }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const returnFocusRef = useRef(null);
  const titleRef = useRef(null);
  const mainRef = useRef(null);
  const previousNavigationKey = useRef(navigationKey);
  const mainId = useId();
  const current = getDestination(destination);
  const accountName = account?.name || account?.displayName || account?.display_name || account?.username;

  useEffect(() => {
    if (previousNavigationKey.current !== navigationKey) {
      previousNavigationKey.current = navigationKey;
      const heading = mainRef.current?.querySelector("[data-cd-workflow-heading]") || titleRef.current;
      heading?.focus({ preventScroll: true });
    }
  }, [navigationKey]);

  const openMore = (event) => {
    returnFocusRef.current = event.currentTarget;
    setMoreOpen(true);
  };
  const closeMore = React.useCallback((restoreFocus = true) => {
    setMoreOpen(false);
    // Wait until React removes inert from the application surface.
    window.requestAnimationFrame(() => {
      const target = restoreFocus !== false ? returnFocusRef.current : mainRef.current?.querySelector("[data-cd-workflow-heading]") || titleRef.current;
      target?.focus({ preventScroll: true });
    });
  }, []);

  return (
    <div className={`cd-shell${editing ? " is-editing" : ""}`} data-destination={current.id} style={{ "--cd-scene": `url("${resolveVisualAsset(MENU_SCENES[current.id])}")` }}>
      <div className="cd-environment" aria-hidden="true"><img key={current.id} src={resolveVisualAsset(MENU_SCENES[current.id])} alt="" decoding="async" draggable={false} /></div>
      <div className="cd-shell-surface" inert={moreOpen ? true : undefined} aria-hidden={moreOpen ? true : undefined}>
        <a className="cd-skip-link" href={`#${mainId}`}>Skip to page content</a>
        <header className="cd-topbar">
          <button className="cd-brand" type="button" onClick={() => onNavigate("play")} aria-label="Gauntlet Online — open Play"><img className="cd-brand-crest" src={resolveVisualAsset(GAUNTLET_CREST)} alt="" width="44" height="44" decoding="async" draggable={false} /><span>GAUNTLET <small>ONLINE</small></span></button>
          <span className="cd-topbar-caption">THE COMMAND DECK</span>
          <div className="cd-header-actions">
            {editing && <button type="button" className="cd-button cd-button-primary cd-done-editing" onClick={onDoneEditing}>Done Editing</button>}
            {onToggleAudio && <button type="button" className="cd-header-button cd-audio-button" aria-label="Mute menu audio" aria-pressed={audioMuted} title={audioMuted ? "Unmute menu audio" : "Mute menu audio"} onClick={onToggleAudio}><DestinationIcon name={audioMuted ? "muted" : "sound"} /><span>{audioMuted ? "Muted" : "Mute"}</span></button>}
            <button type="button" className="cd-header-button cd-profile-button" onClick={() => onNavigate("profile")} aria-label={accountName ? `Profile — ${accountName}` : "Profile"}><DestinationIcon name="profile" /><span>{accountName || "Profile"}</span></button>
            <button type="button" className="cd-header-button cd-settings-button" onClick={() => onNavigate("settings")}><DestinationIcon name="settings" /><span>Settings</span></button>
            <button type="button" className="cd-header-button cd-desktop-more" onClick={openMore} aria-haspopup="dialog" aria-expanded={moreOpen}><DestinationIcon name="more" /><span>More</span></button>
          </div>
        </header>
        <aside className="cd-rail">
          <div className="cd-rail-label">YOUR NEXT MOVE</div>
          <nav aria-label="Main navigation">{PRIMARY_DESTINATIONS.map((id) => <NavigationButton key={id} id={id} current={destination} onNavigate={onNavigate} />)}</nav>
          <div className="cd-rail-footer"><span className="cd-rail-suits" aria-hidden="true">♠ <span>♦</span> ♣ <span>♥</span></span><p>Simple to start.<br />More to master.</p>{ownerAuthorized && onAdmin && <button type="button" className="cd-button-quiet" onClick={onAdmin}>Admin workspace ↗</button>}</div>
        </aside>
        <main className="cd-main" id={mainId} ref={mainRef} tabIndex={-1}>
          <header className="cd-page-header"><div>{pageEyebrow && <span className="cd-eyebrow">{pageEyebrow}</span>}<h1 ref={titleRef} tabIndex={-1}>{pageTitle || current.title}</h1><p>{pageDescription || current.description}</p>{pageDetail && <p className="cd-authored-detail">{pageDetail}</p>}</div>{editing && <span className="cd-editing-badge">Editing page layout</span>}</header>
          {notices && <div className="cd-critical-notices">{notices}</div>}
          {children}
        </main>
        <nav className="cd-mobile-nav" aria-label="Mobile navigation">
          {MOBILE_DESTINATIONS.map((id) => <NavigationButton key={id} id={id} current={destination} onNavigate={onNavigate} mobile />)}
          <button type="button" className={`cd-nav-button${!MOBILE_DESTINATIONS.includes(destination) ? " is-current" : ""}`} onClick={openMore} aria-haspopup="dialog" aria-expanded={moreOpen}><DestinationIcon name="more" /><span>More</span></button>
        </nav>
      </div>
      {moreOpen && <MoreSheet destination={destination} onNavigate={onNavigate} onClose={closeMore} onCustomize={onCustomize} customizable={customizable} editing={editing} onDoneEditing={onDoneEditing} ownerAuthorized={ownerAuthorized} onAdmin={onAdmin} />}
    </div>
  );
}
