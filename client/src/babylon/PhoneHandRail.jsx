import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { visibleCardIdentity } from "./presentationSnapshot";
import "./PhoneHandRail.css";

export function usesPhoneHandRail(width, height) {
  return (width <= 600 && height >= width)
    || (width <= 950 && height <= 520 && width > height);
}

export function usePhoneHandLayout() {
  const read = () => typeof window !== "undefined"
    && usesPhoneHandRail(window.innerWidth, window.innerHeight);
  const [enabled, setEnabled] = useState(read);
  useEffect(() => {
    const resize = () => setEnabled(read());
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  return enabled;
}

export default function PhoneHandRail({ viewModel, commands, presentationRef, interactionLocked }) {
  const railRef = useRef(null);
  const gestureRef = useRef(null);
  const selectedRef = useRef(new Set());
  const [failedArt, setFailedArt] = useState({});
  const hand = viewModel?.hand || [];
  const selectedIds = hand.filter((card) => Object.values(card.selected || {}).some(Boolean))
    .map((card) => card.id);
  const selectionKey = JSON.stringify(selectedIds);

  const measure = () => {
    const rail = railRef.current;
    if (!rail) return;
    const viewport = rail.getBoundingClientRect();
    const anchors = presentationRef.current.anchors;
    rail.querySelectorAll("[data-hand-actor-id]").forEach((button) => {
      const rect = button.getBoundingClientRect();
      anchors.set(button.dataset.handActorId, {
        x: Math.max(viewport.left + rect.width / 2, Math.min(viewport.right - rect.width / 2, rect.left + rect.width / 2)),
        y: rect.top + rect.height / 2,
        width: rect.width
      });
    });
    presentationRef.current.version += 1;
  };

  useLayoutEffect(() => {
    measure();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    if (railRef.current) observer?.observe(railRef.current);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  });

  useEffect(() => {
    const newlySelected = selectedIds.find((id) => !selectedRef.current.has(id));
    selectedRef.current = new Set(selectedIds);
    if (newlySelected) {
      const index = hand.findIndex((card) => card.id === newlySelected);
      railRef.current?.querySelector(`[data-card-index="${index}"]`)
        ?.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" });
      measure();
    }
    // Card IDs, rather than indexes, retain selection across hand updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  const trackGesture = (event) => {
    const gesture = gestureRef.current;
    if (gesture && (Math.abs(event.clientX - gesture.x) > 8 || Math.abs(event.clientY - gesture.y) > 8)) {
      gesture.moved = true;
    }
  };

  return (
    <section className="phone-hand-panel" aria-label="Your hand">
      <header><strong>Your hand · {hand.length}</strong><span>Swipe to browse · tap to select</span></header>
      <div ref={railRef} className="phone-hand-rail" data-testid="phone-hand-rail"
        onPointerDown={(event) => { gestureRef.current = { x: event.clientX, y: event.clientY, moved: false }; }}
        onPointerMove={trackGesture} onPointerUp={trackGesture}
        onPointerCancel={() => { if (gestureRef.current) gestureRef.current.moved = true; }}
        onScroll={() => { if (gestureRef.current) gestureRef.current.moved = true; measure(); }}>
        {hand.map((card, index) => {
          const selected = Object.values(card.selected || {}).some(Boolean);
          const role = Object.keys(card.selected || {}).find((key) => card.selected[key]);
          const visible = card.visible !== false;
          return (
            <button type="button" key={card.id || index} className="phone-hand-card"
              data-match-zone="hand" data-card-index={index}
              data-hand-actor-id={visibleCardIdentity(card, `player-${viewModel.perspective?.player}:hand:${index}`)}
              data-selection-role={role || ""}
              aria-label={visible ? `${card.label}, value ${card.value}${role ? ", selected " + role : ""}` : "Face-down card"}
              aria-pressed={selected} disabled={interactionLocked || card.unavailable || !visible}
              onFocus={(event) => { event.currentTarget.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "instant" }); measure(); }}
              onClick={(event) => {
                if (event.detail !== 0 && gestureRef.current?.moved) { event.preventDefault(); return; }
                measure();
                commands.activateHandCard?.(index);
              }}
              onContextMenu={(event) => { event.preventDefault(); if (visible) commands.inspectCard?.(card.raw); }}>
              {visible && card.artPath && !failedArt[card.artPath] && (
                <img src={card.artPath} alt="" draggable="false"
                  onError={() => setFailedArt((current) => ({ ...current, [card.artPath]: true }))} />
              )}
              <span className="phone-hand-rank" aria-hidden="true">{visible
                ? (card.rank || card.label) + ({ hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" }[card.suit] || (card.rank ? card.suit : ""))
                : "?"}</span>
              {selected && <span className="phone-hand-selection" aria-hidden="true">{role}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
