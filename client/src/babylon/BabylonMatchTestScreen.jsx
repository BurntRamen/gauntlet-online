import { useEffect, useMemo, useState } from "react";
import ProductionMatchExperience from "./ProductionMatchExperience";
import { createLocalDuelAdapter } from "./matchAdapters";
import "./BabylonMatchTestScreen.css";

function queryFlag(name) {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get(name) === "1";
}

function queryValue(name) {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) || "";
}

export default function BabylonMatchTestScreen() {
  const developerMode = queryFlag("babylon-dev") || queryFlag("dev");
  const reviewMode = queryFlag("review");
  const initialFixture = queryValue("fixture") || "default";
  const requestedMode = queryValue("mode");
  const fixtureRequiresFactions = ["faction-ability", "constructed-choice"].includes(initialFixture);
  const initialMode = requestedMode
    ? requestedMode === "factions" ? "factions" : "basic"
    : fixtureRequiresFactions ? "factions" : "basic";
  const initialPlayerOneFaction = queryValue("p1") || (fixtureRequiresFactions ? "frumo" : "rumin");
  const initialPlayerTwoFaction = queryValue("p2") || "sheen";
  const initialSeed = queryValue("seed") || "gauntlet-demo-01";
  const startDisconnected = queryValue("connection") === "disconnected";
  const [seedInput, setSeedInput] = useState(initialSeed);
  const [gameMode, setGameMode] = useState(initialMode);
  const [playerOneFaction, setPlayerOneFaction] = useState(initialPlayerOneFaction);
  const [playerTwoFaction, setPlayerTwoFaction] = useState(initialPlayerTwoFaction);
  const [fixtureName, setFixtureName] = useState(initialFixture);
  const adapter = useMemo(() => createLocalDuelAdapter({
    seed: initialSeed,
    gameMode: initialMode,
    initialFixture,
    factions: {
      1: { id: initialPlayerOneFaction, name: initialPlayerOneFaction[0].toUpperCase() + initialPlayerOneFaction.slice(1) },
      2: { id: initialPlayerTwoFaction, name: initialPlayerTwoFaction[0].toUpperCase() + initialPlayerTwoFaction.slice(1) }
    }
  }), [
    initialFixture,
    initialMode,
    initialPlayerOneFaction,
    initialPlayerTwoFaction,
    initialSeed
  ]);
  const [diagnostics, setDiagnostics] = useState(() => adapter.createUpdate().diagnostics);
  const [sceneMetrics, setSceneMetrics] = useState(null);

  useEffect(() => adapter.subscribe((update) => {
    setDiagnostics(update.diagnostics || {});
  }), [adapter]);

  useEffect(() => () => adapter.dispose(), [adapter]);

  useEffect(() => {
    if (!startDisconnected) return undefined;
    const timer = window.setTimeout(() => adapter.setConnectionState(false), 0);
    return () => window.clearTimeout(timer);
  }, [adapter, startDisconnected]);

  function startMatch() {
    adapter.newMatch({
      seed: seedInput.trim() || "gauntlet-local",
      gameMode,
      factions: {
        1: { id: playerOneFaction, name: playerOneFaction[0].toUpperCase() + playerOneFaction.slice(1) },
        2: { id: playerTwoFaction, name: playerTwoFaction[0].toUpperCase() + playerTwoFaction.slice(1) }
      }
    });
  }

  return (
    <div
      className={`babylon-test-harness${developerMode ? " developer-mode" : ""}${reviewMode ? " review-mode" : ""}`}
      data-testid="babylon-test-sandbox"
    >
      <ProductionMatchExperience adapter={adapter} onSceneMetrics={setSceneMetrics} />

      {developerMode && !reviewMode && (
        <details className="babylon-developer-drawer">
          <summary>
            <span>Developer tools</span>
            <small>Seed · state · fixtures</small>
          </summary>
          <div className="babylon-developer-body">
            <section className="babylon-developer-controls" aria-label="Local simulator controls">
              <label>
                Seed
                <input
                  value={seedInput}
                  onChange={(event) => setSeedInput(event.target.value)}
                />
              </label>
              <label>
                Rules profile
                <select value={gameMode} onChange={(event) => setGameMode(event.target.value)}>
                  <option value="basic">Basic Gauntlet</option>
                  <option value="factions">Faction duel</option>
                </select>
              </label>
              {gameMode === "factions" && (
                <>
                  <label>
                    Player 1 faction
                    <select value={playerOneFaction} onChange={(event) => setPlayerOneFaction(event.target.value)}>
                      <option value="rumin">Rumin</option>
                      <option value="sheen">Sheen</option>
                      <option value="frumo">Frumo</option>
                      <option value="bizi">Bizi</option>
                    </select>
                  </label>
                  <label>
                    Player 2 faction
                    <select value={playerTwoFaction} onChange={(event) => setPlayerTwoFaction(event.target.value)}>
                      <option value="rumin">Rumin</option>
                      <option value="sheen">Sheen</option>
                      <option value="frumo">Frumo</option>
                      <option value="bizi">Bizi</option>
                    </select>
                  </label>
                </>
              )}
              <button type="button" className="primary" onClick={startMatch}>New Match</button>
              <button type="button" className="reset-default" onClick={() => adapter.loadFixture("default")}>
                Reset Default Match
              </button>
              <button
                type="button"
                disabled={!diagnostics.canUndo}
                onClick={() => adapter.undo()}
              >
                Rewind
              </button>
              <span className="developer-divider" />
              <label>
                Visual fixture
                <select value={fixtureName} onChange={(event) => setFixtureName(event.target.value)}>
                  <option value="default">Opening deal</option>
                  <option value="populated-priority">Populated priority</option>
                  <option value="select-attacker">Selecting attacker</option>
                  <option value="select-payment">Selecting payment</option>
                  <option value="incoming-hand">Incoming hand attack</option>
                  <option value="select-blockers">Selecting hand blockers</option>
                  <option value="lane-attack">Lane attack</option>
                  <option value="same-lane-block">Same-lane block</option>
                  <option value="end-placement">End placement</option>
                  <option value="damage-resolution">Damage resolution</option>
                  <option value="card-draw">Card draw</option>
                  <option value="priority-change">Priority change</option>
                  <option value="faction-ability">Faction ability selection</option>
                  <option value="constructed-choice">Constructed-card choices</option>
                  <option value="victory">Victory</option>
                  <option value="defeat">Defeat</option>
                  <option value="draw">Match draw</option>
                </select>
              </label>
              <button type="button" onClick={() => adapter.loadFixture(fixtureName)}>Load Fixture</button>
              <span className="developer-divider" />
              <button
                type="button"
                className={diagnostics.controller === 1 ? "is-active" : ""}
                onClick={() => adapter.setController(1, { requirePrivacy: false })}
              >
                Control P1
              </button>
              <button
                type="button"
                className={diagnostics.controller === 2 ? "is-active" : ""}
                onClick={() => adapter.setController(2, { requirePrivacy: false })}
              >
                Control P2
              </button>
            </section>

            <section className="babylon-developer-status">
              <span>Revision <strong>{diagnostics.revision ?? 0}</strong></span>
              <span>Rules <strong>{diagnostics.rulesVersion || "unknown"}</strong></span>
              <span>Mode <strong>{diagnostics.gameMode || "basic"}</strong></span>
              <span>Perspective <strong>P{diagnostics.perspective || "—"}</strong></span>
              {sceneMetrics && (
                <>
                  <span>Meshes <strong>{sceneMetrics.meshes}</strong></span>
                  <span>Materials <strong>{sceneMetrics.materials}</strong></span>
                  <span>Textures <strong>{sceneMetrics.textures}</strong></span>
                  <span>Active cards <strong>{sceneMetrics.activeCards}</strong></span>
                  <span>Active meshes <strong>{sceneMetrics.activeMeshes}</strong></span>
                  <span>FPS <strong>{sceneMetrics.fps}</strong></span>
                  <span>Initialization <strong>{Math.round(sceneMetrics.initializationMs || 0)} ms</strong></span>
                  <span>Scenes <strong>{sceneMetrics.engineScenes}</strong></span>
                  <span>Pickable <strong>{sceneMetrics.pickableMeshes}</strong></span>
                  <span>Render <strong>{sceneMetrics.renderSize}</strong></span>
                  <span>Canvas <strong>{sceneMetrics.canvasSize}</strong></span>
                  <span>Last pick <strong>{sceneMetrics.lastPointerPick
                    ? `${sceneMetrics.lastPointerPick.mesh} · ${sceneMetrics.lastPointerPick.metadataType} @ ${sceneMetrics.lastPointerPick.x},${sceneMetrics.lastPointerPick.y}`
                    : "none"}</strong></span>
                </>
              )}
            </section>

            <div className="babylon-developer-inspectors">
              <details open>
                <summary>Legal actions · {diagnostics.legalActions?.length || 0}</summary>
                <ul>
                  {(diagnostics.legalActions || []).slice(0, 20).map((action, index) => (
                    <li key={`${action.type}-${action.cardId || action.laneIndex || index}`}>
                      {action.label || action.type}
                    </li>
                  ))}
                </ul>
              </details>
              <details>
                <summary>Command history · {diagnostics.actionHistory?.length || 0}</summary>
                <ol>
                  {(diagnostics.actionHistory || []).slice(-20).reverse().map((entry) => (
                    <li key={entry.id}><b>T{entry.turn}</b> {entry.label}</li>
                  ))}
                </ol>
              </details>
              <details>
                <summary>State snapshot</summary>
                <pre>{JSON.stringify(diagnostics.game, null, 2)}</pre>
              </details>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
