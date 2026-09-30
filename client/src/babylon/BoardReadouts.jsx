import { useLayoutEffect, useRef, useState } from "react";
import { BOARD_LAYOUT_PROFILES, boardModuleDescriptors, getBoardLayoutProfile } from "./boardStage";
import { projectBoardPresentation, primaryPresentationCue } from "./boardPresentation";
import { getTableCameraProjection } from "./matchLayout";
import "./BoardReadouts.css";

// Positions follow the board; typography stays in CSS pixels, independent of GPU resolution.
export function boardReadoutLayout(width, height, profileId, ledger) {
  if (!width || !height) return null;
  const profile = BOARD_LAYOUT_PROFILES[profileId] || getBoardLayoutProfile(width, height);
  const camera = getTableCameraProjection(width, height, profile);
  const { cameraTargetZ, projectedDepthFactor, projectedElevationFactor } = camera.tableProjection;
  const scale = height / (camera.top - camera.bottom);
  const project = (x, z, y = 0.5) => ({
    left: (x - camera.left) * scale,
    top: (camera.top - (z - cameraTargetZ) * projectedDepthFactor - y * projectedElevationFactor) * scale
  });
  const compact = width < 700 || profile.id === "short-landscape";
  const modules = Object.fromEntries(boardModuleDescriptors(profile).map((module) => [module.id, module]));
  const combat = profile.modules["hand-combat-dais"];
  const payment = modules["payment-tray"];
  const short = profile.id === "short-landscape";
  const board = modules["board-base"];
  const leftGutter = project(board.bounds.left, 0).left / 2;
  const rightGutter = (width + project(board.bounds.right, 0).left) / 2;
  const combatCenter = short ? { left: leftGutter, top: height * 0.28 }
    : compact ? project(combat.x, combat.z - 2.5 * combat.scaleZ)
      : project(combat.x - 5.8 * combat.scaleX, combat.z);
  const piles = Object.fromEntries(Object.entries(profile.anchors.piles).map(([id, position]) => {
    const moduleId = `pile-${id.replace(/([A-Z])/, "-$1").toLowerCase()}`;
    return [id, project(position.x, modules[moduleId].bounds.bottom - 0.3)];
  }));
  for (const owner of ["local", "opponent"]) {
    const deck = piles[`${owner}Deck`], discard = piles[`${owner}Discard`];
    if (short) {
      const center = owner === "local" ? leftGutter : rightGutter;
      Object.assign(deck, { left: center - 39, top: height * (owner === "local" ? 0.77 : 0.28) });
      Object.assign(discard, { left: center + 39, top: deck.top });
    } else if (Math.abs(deck.left - discard.left) < 1) {
      const center = (deck.top + discard.top) / 2;
      deck.top = Math.max(26, center - 27); discard.top = deck.top + 54;
    } else if (Math.abs(deck.left - discard.left) < 78) {
      const center = (deck.left + discard.left) / 2, direction = Math.sign(deck.left - discard.left);
      deck.left = center + direction * 39; discard.left = center - direction * 39;
    }
  }
  for (const owner of ["local", "opponent"]) {
    const pair = [piles[`${owner}Deck`], piles[`${owner}Discard`]];
    const covered = ledger ? pair.filter((point) => point.left + 36 > ledger.left
      && point.left - 36 < ledger.right && point.top - 28 < ledger.bottom) : [];
    if (covered.length) {
      const shift = Math.max(...covered.map((point) => ledger.bottom + 32 - point.top));
      pair.forEach((point) => { point.top += shift; });
      // A taller log can push counters into lane three. Use the outer gutter
      // when it has room for the pair, keeping the tactical lanes clear.
      if (!compact && owner === "opponent" && width - project(board.bounds.right, 0).left >= 164) {
        pair[0].left = rightGutter + 39; pair[1].left = rightGutter - 39;
      }
    }
  }
  return {
    compact, short,
    lanes: profile.anchors.laneX.map((x) => project(
      x + (short ? 2.6 : compact ? 0 : 2.05) * profile.modules["lane-0"].scaleX, profile.anchors.lane.center
    )),
    combat: { attack: { ...combatCenter, left: combatCenter.left - 39 }, block: { ...combatCenter, left: combatCenter.left + 39 } },
    payment: { ...(short ? { left: rightGutter, top: height * 0.77 } : project(payment.mount.x, payment.bounds.bottom + 0.48)),
      width: Math.max(150, Math.min(232, (payment.bounds.right - payment.bounds.left) * scale - 12)) },
    piles
  };
}

const LANE_STATES = { idle: "", legal: "Available", active: "Selected", opposed: "Attacking", blocked: "Blocked", resolving: "Resolving" };

export default function BoardReadouts({ viewModel, layoutProfile, commands }) {
  const rootRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const root = rootRef.current;
    const ledgerHost = root.closest(".production-match-experience")?.querySelector(".production-card-and-log");
    const measure = () => {
      const bounds = root.getBoundingClientRect(), log = ledgerHost?.querySelector(".production-match-ledger")?.getBoundingClientRect();
      setSize({ width: root.clientWidth, height: root.clientHeight,
        ledger: log?.height ? { left: log.left - bounds.left, right: log.right - bounds.left, bottom: log.bottom - bounds.top } : null });
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(root);
    if (ledgerHost) observer?.observe(ledgerHost);
    measure();
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  const layout = boardReadoutLayout(size.width, size.height, layoutProfile, size.ledger);
  const board = projectBoardPresentation(viewModel, { activeCue: primaryPresentationCue(viewModel?.presentationCues) });
  const payment = board.payment;
  const paying = payment.state !== "idle";
  const handCombat = (viewModel?.handAttacks || []).length > 0;
  const playerColor = (player) => Number(player?.id) === 1 ? "blue" : "red";
  const handAttack = viewModel?.handAttacks?.[0];
  const attackPlayer = viewModel?.players?.[handAttack?.owner];

  return <div ref={rootRef} className="board-readouts" data-compact={layout?.compact || false} data-short={layout?.short || false} aria-label="Battlefield indicators">
    {layout && <>
      {board.lanes.map((lane) => {
        const attack = (viewModel?.attacks || []).find((entry) => entry.laneIndex != null && Number(entry.laneIndex) === lane.index);
        return <div key={lane.index} className="board-readout board-lane-readout" style={layout.lanes[lane.index]}
          data-state={lane.state} data-lane-readout={lane.index}>
          <span><span className="board-lane-word">Lane </span><b>{lane.index + 1}</b></span>
          {LANE_STATES[lane.state] && <small>{LANE_STATES[lane.state]}</small>}
          {attack && <small className="board-lane-values">Attack <b>{attack.value}</b><br />Block <b>{(attack.blocks || []).reduce((sum, block) => sum + Number(block.value || 0), 0)}</b></small>}
        </div>;
      })}
      {handCombat && ["attack", "block"].map((role) => <div key={role}
        className="board-readout board-combat-readout" data-combat-readout={role}
        data-player-color={attackPlayer ? (role === "attack" ? playerColor(attackPlayer) : playerColor(viewModel.players?.[Number(attackPlayer.id) === 1 ? 2 : 1])) : undefined}
        style={layout.combat[role]}>
        <span>{role === "attack" ? "Attack" : "Block"}</span><strong>{board.combat[`${role}Value`]}</strong>
      </div>)}
      {Object.entries(board.piles).map(([id, count]) => {
        const discard = id.endsWith("Discard");
        const player = id.startsWith("local") ? viewModel?.bottom : viewModel?.top;
        const Tag = discard ? "button" : "div";
        return <Tag key={id} className="board-readout board-pile-readout" style={layout.piles[id]}
          data-pile-readout={id} data-player-color={playerColor(player)}
          aria-label={`${player?.name || "Player"} ${discard ? "discard pile" : "deck"}: ${count} cards`}
          {...(discard ? { type: "button", onClick: () => commands?.openDiscard?.(player?.id) } : {})}>
          <span>{discard ? "Discard" : "Deck"}</span><strong>{count}</strong>
        </Tag>;
      })}
      <div className="board-readout board-payment-readout" style={layout.payment} data-state={payment.state} data-cost-met={paying && payment.remaining === 0}>
        <span>Payment</span><strong>{paying ? `${payment.total} / ${payment.required}` : "Ready"}</strong>
        {paying && <small>{payment.state === "active" ? (payment.remaining > 0 ? `${payment.remaining} more needed` : "Cost met") : "Committed"}</small>}
      </div>
    </>}
  </div>;
}
