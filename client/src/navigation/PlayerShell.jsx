import PlayerPageHeader from "./PlayerPageHeader";
import { brandText, useBrandPreview } from '../brand/brandPreview';
import SuitFireBrand from '../brand/SuitFireBrand';
import { PlayerAvatar } from '../ProfileAvatar';
import React, { useEffect, useId, useRef, useState } from "react";
import { getDestination, PRIMARY_DESTINATIONS, MOBILE_DESTINATIONS, MORE_DESTINATIONS } from "./destinations";
import { resolveVisualAsset } from "../GauntletVisuals";
import { GAUNTLET_CREST, MENU_SCENES } from "./menuArtwork";
import "./PlayerShell.css";
import {useWebsitePresentation} from "./WebsitePresentation";

import {DestinationIcon} from "./DestinationIcon";
export {DestinationIcon} from "./DestinationIcon";

function NavigationButton({ id, current, onNavigate, mobile = false }) {
  const presentation = useWebsitePresentation();
  const entry = {...getDestination(id), ...presentation?.navigation?.items?.find(item=>item.id===id)};
  return (
    <button type="button" className={`cd-nav-button${current === id ? " is-current" : ""}`} aria-current={current === id ? "page" : undefined} onClick={() => onNavigate(id)}>
      <DestinationIcon name={id} />
      <span>{mobile && !presentation?.navigation ? entry.mobileLabel || entry.label : entry.label}</span>
    </button>
  );
}

function MoreSheet({ moreDestinations = MORE_DESTINATIONS, destination, onNavigate, onClose, onCustomize, customizable, editing, onDoneEditing, ownerAuthorized, onAdmin }) {
  const presentation = useWebsitePresentation();
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
          {moreDestinations.map((id) => {
  const entry = {...getDestination(id), ...presentation?.navigation?.items?.find(item=>item.id===id)};
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

export default function PlayerShell({ embedded = false, serverUrl, destination = "play", navigationKey = destination, pageTitle, pageDescription, pageImage, pageEyebrow, pageDetail, onNavigate, account, audioMuted = false, onToggleAudio, ownerAuthorized = false, onAdmin, onCustomize, customizable = false, editing = false, onDoneEditing, children, notices }) {
  const Main=embedded?"div":"main", Rail=embedded?"div":"aside";
  const presentation = useWebsitePresentation();
  const publishedNav = presentation?.navigation?.items;
  const primary = publishedNav ? publishedNav.filter(item=>PRIMARY_DESTINATIONS.includes(item.id)).map(item=>item.id) : PRIMARY_DESTINATIONS;
  const mobile = publishedNav ? primary.slice(0,4) : MOBILE_DESTINATIONS;
  const more = publishedNav ? publishedNav.map(item=>item.id).filter(id=>!mobile.includes(id)) : MORE_DESTINATIONS;
  const pageLayout = presentation?.pages?.[destination];
  const label = id => publishedNav?.find(item=>item.id===id)?.label || getDestination(id).label;
  const preview = useBrandPreview();
  const [moreOpen, setMoreOpen] = useState(false);
  const returnFocusRef = useRef(null);
  const titleRef = useRef(null);
  const mainRef = useRef(null);
  const previousNavigationKey = useRef(navigationKey);
  const mainId = useId();
  const current = {...getDestination(destination), label:label(destination)};
  const accountName = account?.name || account?.displayName || account?.display_name || account?.username;

  useEffect(() => {
    if (!embedded && previousNavigationKey.current !== navigationKey) {
      previousNavigationKey.current = navigationKey;
      const heading = mainRef.current?.querySelector("[data-cd-workflow-heading]") || titleRef.current;
      heading?.focus({ preventScroll: true });
    }
  }, [navigationKey, embedded]);

  const openMore = (event) => {
    returnFocusRef.current = event.currentTarget;
    setMoreOpen(true);
  };
  const closeMore = React.useCallback((restoreFocus = true) => {
    setMoreOpen(false);
    // Wait until React removes inert from the application surface.
    window.requestAnimationFrame(() => {
      // A newly revealed control may already own focus before this frame.
      // Restore only when closing the sheet left focus unclaimed.
      const active = document.activeElement;
      if (active && active !== document.body && active !== document.documentElement) return;
      const target = restoreFocus !== false ? returnFocusRef.current : mainRef.current?.querySelector("[data-cd-workflow-heading]") || titleRef.current;
      target?.focus({ preventScroll: true });
    });
  }, []);

  return (
    <div className={`cd-shell${preview ? " is-suitfire" : ""}${editing ? " is-editing" : ""}`} data-destination={current.id} data-typography={pageLayout?.typography || "standard"} data-arrangement={pageLayout?.arrangement || "tiles"} style={{ "--cd-scene": `url("${resolveVisualAsset(pageLayout?.visuals?.background || MENU_SCENES[current.id])}")` }}>
      <div className="cd-environment" aria-hidden="true"><img key={current.id} src={resolveVisualAsset(pageLayout?.visuals?.background || MENU_SCENES[current.id])} alt="" decoding="async" draggable={false} /></div>
      <div className="cd-shell-surface" inert={moreOpen ? true : undefined} aria-hidden={moreOpen ? true : undefined}>
        {!embedded && <a className="cd-skip-link" href={`#${mainId}`}>Skip to page content</a>}
        <header className="cd-topbar">
          <button className="cd-brand" type="button" onClick={() => onNavigate("play")} aria-label={brandText("SuitFire — open Play", "Gauntlet Online — open Play")}>{preview ? <SuitFireBrand /> : <><img className="cd-brand-crest" src={resolveVisualAsset(GAUNTLET_CREST)} alt="" width="44" height="44" decoding="async" draggable={false} /><span>GAUNTLET <small>ONLINE</small></span></>}</button>
          <span className="cd-topbar-caption"><small>Current location</small><strong>{current.label}</strong></span>
          <div className="cd-header-actions">
            {editing && <button type="button" className="cd-button cd-button-primary cd-done-editing" onClick={onDoneEditing}>Done Editing</button>}
            {onToggleAudio && <button type="button" className="cd-header-button cd-audio-button" aria-label="Mute menu audio" aria-pressed={audioMuted} title={audioMuted ? "Unmute menu audio" : "Mute menu audio"} onClick={onToggleAudio}><DestinationIcon name={audioMuted ? "muted" : "sound"} /><span>{audioMuted ? "Muted" : "Mute"}</span></button>}
            <button type="button" className="cd-header-button cd-profile-button" onClick={() => onNavigate("profile")} aria-label={accountName ? `Profile — ${accountName}` : "Profile"}>{account ? <PlayerAvatar serverUrl={serverUrl} subject={account} name={accountName || "Guest"} size="large" decorative /> : <DestinationIcon name="profile" />}<span>{accountName || "Profile"}</span></button>
            <button type="button" className="cd-header-button cd-settings-button" onClick={() => onNavigate("settings")}><DestinationIcon name="settings" /><span>{label("settings")}</span></button>
            <button type="button" className="cd-header-button cd-desktop-more" onClick={openMore} aria-haspopup="dialog" aria-expanded={moreOpen}><DestinationIcon name="more" /><span>More</span></button>
          </div>
        </header>
        <Rail className="cd-rail">
          <div className="cd-rail-label">YOUR NEXT MOVE</div>
          <nav aria-label="Main navigation">{primary.map((id) => <NavigationButton key={id} id={id} current={destination} onNavigate={onNavigate} />)}</nav>
          <div className="cd-rail-footer"><span className="cd-rail-suits" aria-hidden="true">♠ <span>♦</span> ♣ <span>♥</span></span><p>Simple to start.<br />More to master.</p>{ownerAuthorized && onAdmin && <button type="button" className="cd-button-quiet" onClick={onAdmin}>Admin workspace ↗</button>}</div>
        </Rail>
        <Main className="cd-main" id={mainId} ref={mainRef} tabIndex={-1}>
          <PlayerPageHeader title={pageTitle || current.title} description={pageDescription || current.description} eyebrow={pageEyebrow} detail={pageDetail} image={pageImage} headingRef={titleRef}>{editing && <span className="cd-editing-badge">Editing page layout</span>}</PlayerPageHeader>
          {notices && <div className="cd-critical-notices">{notices}</div>}
          {children}
        </Main>
        <nav className="cd-mobile-nav" aria-label="Mobile navigation">
          {mobile.map((id) => <NavigationButton key={id} id={id} current={destination} onNavigate={onNavigate} mobile />)}
          <button type="button" className={`cd-nav-button${!mobile.includes(destination) ? " is-current" : ""}`} onClick={openMore} aria-haspopup="dialog" aria-expanded={moreOpen}><DestinationIcon name="more" /><span>More</span></button>
        </nav>
      </div>
      {moreOpen && <MoreSheet moreDestinations={more} destination={destination} onNavigate={onNavigate} onClose={closeMore} onCustomize={onCustomize} customizable={customizable} editing={editing} onDoneEditing={onDoneEditing} ownerAuthorized={ownerAuthorized} onAdmin={onAdmin} />}
    </div>
  );
}
