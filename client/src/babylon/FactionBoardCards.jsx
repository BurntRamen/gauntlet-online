import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { factionBoardCards, factionBoardScreenLayout } from "./factionBoard";
import "./FactionBoardCards.css";

export default function FactionBoardCards({ faction, viewModel, commands, layoutProfile, locked = false }) {
  const rootRef = useRef(null);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [selectedRole, setSelectedRole] = useState(null);
  const readOnly = locked || viewModel?.perspective?.spectator || viewModel?.phase === "gameOver";
  const cards = factionBoardCards(faction, viewModel?.interactions?.abilities);
  const layout = factionBoardScreenLayout(size.width, size.height, layoutProfile);
  const selected = cards.find((card) => card.role === selectedRole);
  const selectedPosition = layout[cards.indexOf(selected)];
  const close = () => { setSelectedRole(null); openerRef.current?.focus(); };

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const measure = () => setSize({ width: root.clientWidth, height: root.clientHeight });
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(root);
    measure();
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  useEffect(() => {
    if (!selectedRole) return undefined;
    dialogRef.current?.querySelector("button")?.focus();
    const dismiss = (event) => {
      if (event.type === "keydown" && event.key === "Escape") {
        event.preventDefault(); event.stopPropagation();
        setSelectedRole(null); openerRef.current?.focus();
      } else if (event.type === "pointerdown" && !rootRef.current?.contains(event.target)) {
        setSelectedRole(null);
      }
    };
    document.addEventListener("keydown", dismiss, true);
    document.addEventListener("pointerdown", dismiss);
    return () => {
      document.removeEventListener("keydown", dismiss, true);
      document.removeEventListener("pointerdown", dismiss);
    };
  }, [selectedRole]);

  return (
    <div ref={rootRef} className="faction-board-cards" aria-label="Your faction cards">
      {layout.length > 0 && cards.map((card, index) => {
        const available = !readOnly && card.abilities.some((ability) => ability.available !== false);
        const active = card.abilities.some((ability) => ability.active);
        const status = active ? "Selected" : available ? "Ready" : card.activated ? "Unavailable" : "Passive";
        return (
          <button key={card.role} type="button"
            className={`faction-board-card${available ? " is-ready" : ""}${active ? " is-active" : ""}`}
            style={layout[index]} data-match-zone="abilities" data-faction-role={card.role}
            aria-label={`${card.role}: ${card.name} · ${status}`} aria-expanded={selectedRole === card.role}
            aria-haspopup="dialog"
            onClick={(event) => { openerRef.current = event.currentTarget; setSelectedRole(card.role); }}>
            {card.image && <img src={card.image.startsWith("/") ? `${process.env.PUBLIC_URL || ""}${card.image}` : card.image} alt="" draggable="false" />}
            <span className="faction-board-role">{card.role}</span>
            <span className="faction-board-caption"><strong>{card.name}</strong><small>{status}</small></span>
          </button>
        );
      })}
      {selected && selectedPosition && (
        <section ref={dialogRef} className="faction-board-choices" role="dialog"
          aria-label={`${selected.name} abilities`}
          style={{ left: Math.max(180, Math.min(size.width - 180, selectedPosition.left)),
            bottom: size.height - selectedPosition.top + selectedPosition.height / 2 + 8 }}>
          <header><div><span>{selected.role}</span><strong>{selected.name}</strong></div>
            <button type="button" onClick={close} aria-label="Close faction card">×</button></header>
          {selected.text && <p>{selected.text}</p>}
          <p className="faction-board-note">{selected.activated
            ? "Optional activation · choose an action, review its targets and cost, then confirm."
            : /^(sheen:commander|gracus:general|indela:city)$/.test(`${faction.id}:${selected.role}`)
              ? "Always active · applies while its stated conditions hold."
              : "Automatic trigger · no activation needed. Watch the stated condition and turn progress."}</p>
          {selected.abilities.length ? selected.abilities.map((ability) => (
            <button type="button" key={ability.id} disabled={readOnly || ability.available === false}
              aria-pressed={Boolean(ability.active)}
              onClick={() => { commands.activateAbility?.(ability.id); close(); }}>
              <strong>{ability.label}</strong>
              {(readOnly || ability.available === false || ability.intent !== ability.label) &&
                <span>{readOnly ? "Actions are unavailable right now." : ability.available === false ? ability.reason : ability.intent}</span>}
            </button>
          )) : <p className="faction-board-note">{selected.activated
            ? "No ability is available right now. This card lights up when you can use it."
            : "Passive ability · applies automatically when its conditions are met."}</p>}
        </section>
      )}
    </div>
  );
}
