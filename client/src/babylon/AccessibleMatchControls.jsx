import { laneTargetEnabled, laneTargetSelected } from "./abilityTargets";
export default function AccessibleMatchControls({
  viewModel,
  commands,
  interactionLocked = false,
  interactionStatus = "",
  handPresentedExternally = false
}) {
  const spectator = viewModel?.perspective?.spectator;
  const hasSelection = !!(
    viewModel?.selection?.attackMode
    || viewModel?.selection?.blockMode
    || viewModel?.selection?.placementMode
    || viewModel?.selection?.abilityMode
  );
  const passDisabled = !!viewModel?.interactions?.passDisabled
    || viewModel?.phase === "gameOver"
    || hasSelection;
  const unavailableLaneReasons = (viewModel?.lanes || [])
    .map((lane) => ({
      lane: lane.index + 1,
      reason: viewModel?.interactions?.laneUnavailableReasons?.[lane.index] || ""
    }))
    .filter((entry) => entry.reason);

  return (
    <section
      className="babylon-accessible-controls"
      aria-label="Keyboard match controls"
      aria-busy={interactionLocked}
    >
      <div className="babylon-accessible-control-body">
        <strong className="babylon-keyboard-control-title">Keyboard controls</strong>
        <p role="status" aria-live="polite">
          {interactionStatus || viewModel?.instruction || "Waiting for match state."}
        </p>
        {!spectator && (
          <>
            {!!viewModel.interactions.abilities?.length && (
              <div className="babylon-accessible-control-row" aria-label="Faction abilities">
                {viewModel.interactions.abilities.map((ability) => (
                  <button
                    type="button"
                    key={ability.id}
                    data-match-zone="abilities"
                    aria-pressed={ability.active}
                    disabled={interactionLocked || ability.available === false}
                    onClick={() => commands.activateAbility?.(ability.id)}
                  >
                    {ability.label}
                  </button>
                ))}
              </div>
            )}
            <div className="babylon-accessible-control-row">
              {(!handPresentedExternally ? viewModel.hand || [] : []).map((card, index) => (
                <button
                  type="button"
                  key={card.id || index}
                  data-match-zone="hand"
                  data-card-index={index}
                  disabled={interactionLocked || card.unavailable}
                  aria-pressed={Object.values(card.selected || {}).some(Boolean)}
                  aria-label={`${card.label}, printed value ${card.value}${card.valueBreakdown?.modifiers?.length ? `, ${card.valueBreakdown.equation}` : ""}${card.selected?.attacker ? ", selected attacker" : ""}${card.selected?.blocker ? ", selected blocker" : ""}${card.selected?.payment ? ", selected payment" : ""}${card.selected?.placement ? ", selected for placement" : ""}${card.selected?.ability ? ", selected ability target" : ""}${card.selected?.paymentBonus ? ", selected payment bonus recipient" : ""}`}
                  onClick={() => commands.activateHandCard?.(index)}
                  onContextMenu={(event) => { event.preventDefault(); commands.inspectCard?.(card.raw); }}
                >
                  {card.label}
                </button>
              ))}
            </div>
            <div className="babylon-accessible-control-row">
              {viewModel.lanes.flatMap((lane) => {
                const legal = laneTargetEnabled(viewModel, lane.index, "local");
                if (viewModel.selection.abilityMode?.abilityId === "polea-peek") {
                  return [
                    lane.hasLocalCard ? (
                      <button
                        type="button"
                        key={`${lane.id}-local`}
                        data-match-zone="lanes"
                        disabled={interactionLocked || !legal}
                        aria-pressed={laneTargetSelected(viewModel, lane.index, "local")}
                        onClick={() => commands.activateLane?.(lane.index, "local")}
                      >
                        Your Lane {lane.index + 1}
                      </button>
                    ) : null,
                    lane.hasOpponentCard ? (
                      <button
                        type="button"
                        key={`${lane.id}-opponent`}
                        data-match-zone="lanes"
                        disabled={interactionLocked || !laneTargetEnabled(viewModel, lane.index, "opponent")}
                        aria-pressed={laneTargetSelected(viewModel, lane.index, "opponent")}
                        onClick={() => commands.activateLane?.(lane.index, "opponent")}
                      >
                        Opponent Lane {lane.index + 1}
                      </button>
                    ) : null
                  ].filter(Boolean);
                }
                return [(
                  <button
                    type="button"
                    key={lane.id}
                    data-match-zone="lanes"
                    disabled={interactionLocked || !legal}
                    title={!legal ? viewModel.interactions.laneUnavailableReasons?.[lane.index] || "" : ""}
                    aria-pressed={laneTargetSelected(viewModel, lane.index, "local")}
                    onClick={() => commands.activateLane?.(
                      lane.index,
                      viewModel.selection.abilityMode?.targetOwner || "local"
                    )}
                  >
                    {viewModel.selection.abilityMode?.targetOwner === "opponent" ? "Opponent " : ""}
                    Lane {lane.index + 1}
                  </button>
                )];
              })}
            </div>
            {unavailableLaneReasons.length > 0 && (
              <ul className="babylon-accessible-reasons" aria-label="Unavailable lane reasons">
                {unavailableLaneReasons.map((entry) => (
                  <li key={`lane-reason-${entry.lane}`}>
                    <strong>Lane {entry.lane}:</strong> {entry.reason}
                  </li>
                ))}
              </ul>
            )}
            {["polea-buff", "focus-buff"].includes(viewModel.selection.abilityMode?.abilityId) && (
              <div className="babylon-accessible-control-row" aria-label="Active attack targets">
                {(viewModel.attacks || [])
                  .filter((attack) => attack.owner === viewModel.perspective.player)
                  .map((attack) => (
                    <button
                      type="button"
                      key={`ability-attack-${attack.id}`}
                      aria-pressed={viewModel.selection.abilityMode?.attackId === attack.id}
                      disabled={interactionLocked}
                      onClick={() => commands.activateAttackTarget?.(attack.id)}
                    >
                      {attack.laneIndex == null ? "Hand attacker" : `Lane ${attack.laneIndex + 1} attacker`}
                    </button>
                  ))}
              </div>
            )}
            <div className="babylon-accessible-control-row">
              <button type="button" data-match-zone="actions" disabled={interactionLocked || passDisabled} onClick={() => commands.passPriority?.()}>{viewModel.interactions.passLabel || "Pass / Continue"}</button>
              <button type="button" data-match-zone="actions" disabled={interactionLocked || viewModel.interactions.confirmDisabled} onClick={() => commands.confirmCurrentAction?.()}>{viewModel.interactions.confirmLabel || "Confirm"}</button>
              <button type="button" data-match-zone="actions" disabled={interactionLocked || !hasSelection} onClick={() => commands.cancelCurrentAction?.()}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
