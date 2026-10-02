import { useEffect, useMemo, useRef, useState } from "react";
import SpecialCardFace from "./SpecialCardFace";
import { CardBackArt } from "./CardBackArt";
import "./PackOpening.css";

export const PACK_PACING = [
  { id: "quick", label: "Quick", detail: "Fast flips", delay: 650 },
  { id: "medium", label: "Medium / light", detail: "A little anticipation", delay: 1400 },
  { id: "theatrical", label: "Theatrical", detail: "Give every card a moment", delay: 2400 }
];
export function readPackPacing() {
  try { const saved = localStorage.getItem("gauntlet_pack_pacing"); return PACK_PACING.some((entry) => entry.id === saved) ? saved : "medium"; } catch { return "medium"; }
}
export function sortPackForReveal(cards) {
  const order = { uncommon: 0, rare: 1, mythic: 2, common: 3 };
  return [...cards].sort((a, b) => (order[a.rarity] ?? 3) - (order[b.rarity] ?? 3));
}
export function PackPacingPicker({ value, onChange }) {
  return <fieldset className="pack-pacing"><legend>Opening style</legend>{PACK_PACING.map((pace) => <label key={pace.id}><input type="radio" name="pack-pacing" value={pace.id} checked={value === pace.id} onChange={() => { onChange(pace.id); try { localStorage.setItem("gauntlet_pack_pacing", pace.id); } catch { /* Keep the current session preference. */ } }} /><span><strong>{pace.label}</strong><small>{pace.detail}</small></span></label>)}</fieldset>;
}

export default function PackOpening({ cards, pacing = "medium", autoPlay = true, visible = true }) {
  const ordered = useMemo(() => sortPackForReveal(cards), [cards]);
  const [revealed, setRevealed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [dismissed, setDismissed] = useState(!autoPlay);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false);
  const dialog = useRef(null);
  const pace = PACK_PACING.find((entry) => entry.id === pacing) || PACK_PACING[1];
  const complete = revealed >= ordered.length;
  const current = ordered[Math.max(0, revealed - 1)];
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const change = () => setReducedMotion(query.matches);
    query?.addEventListener?.("change", change);
    return () => query?.removeEventListener?.("change", change);
  }, []);
  useEffect(() => {
    const node = dialog.current;
    if (!node || dismissed) return undefined;
    const previousFocus = document.activeElement;
    if (node.showModal) node.showModal(); else node.setAttribute("open", "");
    return () => { node.close?.(); previousFocus?.focus?.(); };
  }, [dismissed]);
  useEffect(() => {
    if (paused || complete || dismissed) return undefined;
    const rareHold = pacing === "theatrical" && revealed > 0 && ["rare", "mythic"].includes(current?.rarity) ? 1.5 : 1;
    const timer = setTimeout(() => setRevealed((count) => Math.min(count + 1, ordered.length)), pace.delay * rareHold);
    return () => clearTimeout(timer);
  }, [paused, complete, dismissed, revealed, pace.delay, pacing, ordered.length, current?.rarity]);
  const dismiss = () => { setRevealed(ordered.length); setDismissed(true); };
  if (!ordered.length) return null;
  return <>
    {!dismissed && <dialog ref={dialog} className={`pack-reveal-dialog pace-${pacing}${reducedMotion ? " reduced-motion" : ""}`} aria-labelledby="pack-reveal-title" onCancel={(event) => { event.preventDefault(); dismiss(); }}>
      <header><span className="pack-reveal-eyebrow">Your earned pack</span><h2 id="pack-reveal-title">{complete ? "The whole hand is yours." : "Meet your new cards."}</h2><p>Uncommons → rares → commons</p></header>
      <div className={`pack-reveal-stage rarity-${revealed ? current.rarity : "sealed"}`}>
        <div className="pack-reveal-halo" aria-hidden="true" />
        <div key={revealed} className={`pack-reveal-card ${revealed ? "is-face-up" : "is-sealed"}`}>
          {revealed ? <SpecialCardFace card={current} presentation={current.collector || (current.paid ? current : null)} /> : <CardBackArt cardBackId="classic" decorative />}
        </div>
      </div>
      <div className="pack-reveal-caption" role="status" aria-live="polite" aria-atomic="true"><span>{revealed ? `${current.rarity} · ${revealed} of ${ordered.length}` : `${ordered.length} cards inside`}</span><h3>{revealed ? current.name : "Breaking the seal…"}</h3><p>{revealed ? (current.displayText || current.text) : "One card at a time."}</p></div>
      <div className="pack-reveal-progress" aria-label={`${revealed} of ${ordered.length} cards revealed`}>{ordered.map((card, index) => <span className={index < revealed ? `is-revealed rarity-${card.rarity}` : ""} key={index} />)}</div>
      <div className="pack-reveal-controls">{complete ? <button type="button" className="pack-reveal-primary" autoFocus onClick={dismiss}>View all cards</button> : <><button type="button" onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? "Resume" : "Pause"}</button><button type="button" className="pack-reveal-primary" onClick={() => setRevealed((count) => Math.min(count + 1, ordered.length))}>Next card</button><button type="button" onClick={dismiss}>Reveal all</button></>}</div>
      <small className="pack-reveal-note">Already added to your collection.</small>
    </dialog>}
    {dismissed && visible && <section className="pack-opened-summary" aria-label="Last opened pack"><div><span className="pack-reveal-eyebrow">Added to your collection</span><h4>Your latest pack</h4></div><div className="pack-opened-cards">{ordered.map((card, index) => <article className={`rarity-${card.rarity}`} key={`${card.id}-${index}`}><SpecialCardFace card={card} presentation={card.collector || (card.paid ? card : null)} /><span>{card.rarity}</span><strong>{card.name}</strong></article>)}</div></section>}
  </>;
}
