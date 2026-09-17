import { useState } from "react";
import GauntletMatchCanvas from "./GauntletMatchCanvas";
import AccessibleMatchControls from "./AccessibleMatchControls";
import "./RecoverableMatchCanvas.css";

// Keep the live adapter, HUD and campaign flow mounted when WebGL fails.
// Only the visual table is replaced; commands still use the same live session.
export default function RecoverableMatchCanvas(props) {
  const [failed, setFailed] = useState(false);
  if (!failed) {
    return <GauntletMatchCanvas {...props} onRendererError={(error) => {
      console.error("Gauntlet table rendering failed", error);
      setFailed(true);
    }} />;
  }
  const { viewModel, commands, interactionLocked, interactionStatus } = props;
  return (
    <section className="production-table-recovery" aria-label="Gauntlet game table">
      <div className="production-table-recovery-notice" role="status">
        <span>The animated table is unavailable. You can keep playing here.</span>
        <button type="button" onClick={() => setFailed(false)}>Retry animated table</button>
      </div>
      <div className="production-table-recovery-lanes">
        {viewModel.lanes.map((lane) => (
          <section key={lane.id} aria-label={`Lane ${lane.index + 1} cards`}>
            <strong>Lane {lane.index + 1}</strong>
            <p>Opponent: {lane.hasOpponentCard ? "Face-down card" : "Empty"}</p>
            <p>Your card: {lane.hasLocalCard ? lane.localCard.label : "Empty"}</p>
            {lane.attack && <p>Attack: {lane.attack.card.label} · {lane.attack.value}</p>}
            {lane.blocks.map((block) => <p key={block.id}>Block: {block.card.label} · {block.value}</p>)}
          </section>
        ))}
      </div>
      <div aria-label="Active attacks">
        {(viewModel.attacks || []).filter((attack) => attack.laneIndex == null).map((attack) => (
          <p key={attack.id}>
            Player {attack.owner} attacks: {attack.card.label} · {attack.value}
            {attack.blocks?.map((block) => <span key={block.id}> · Block: {block.card.label} ({block.value})</span>)}
          </p>
        ))}
      </div>
      <AccessibleMatchControls viewModel={viewModel} commands={commands}
        interactionLocked={interactionLocked} interactionStatus={interactionStatus} />
    </section>
  );
}
