import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { createGauntletScene } from "./createGauntletScene";
import AccessibleMatchControls from "./AccessibleMatchControls";
import { renderMatchFrame } from "./rendererLifecycle";
import "./GauntletMatchCanvas.css";

export default function GauntletMatchCanvas({
  viewModel,
  commands = {},
  onRendererError,
  onSceneMetrics
}) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const engineRef = useRef(null);
  const rendererFailedRef = useRef(false);
  const commandsRef = useRef(commands);
  const onRendererErrorRef = useRef(onRendererError);
  const onSceneMetricsRef = useRef(onSceneMetrics);
  const initializationMsRef = useRef(null);
  const [rendererError, setRendererError] = useState("");
  commandsRef.current = commands;
  onRendererErrorRef.current = onRendererError;
  onSceneMetricsRef.current = onSceneMetrics;

  const reportRendererFailure = (error, fallbackMessage) => {
    if (rendererFailedRef.current) return;
    rendererFailedRef.current = true;
    engineRef.current?.stopRenderLoop?.();
    const resolved = error instanceof Error ? error : new Error(fallbackMessage);
    setRendererError(resolved.message || fallbackMessage);
    onRendererErrorRef.current?.(resolved);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let engine;
    try {
      const initializationStartedAt = performance.now();
      if (canvas.clientWidth < 2 || canvas.clientHeight < 2) {
        throw new Error("The Babylon match canvas has no visible width or height.");
      }
      engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false, doNotHandleContextLost: false });
      engineRef.current = engine;
      const renderer = createGauntletScene(engine, canvas, {
        activateHandCard: (...args) => commandsRef.current.activateHandCard?.(...args),
        activateLane: (...args) => commandsRef.current.activateLane?.(...args),
        activateAttackTarget: (...args) => commandsRef.current.activateAttackTarget?.(...args),
        activateAbility: (...args) => commandsRef.current.activateAbility?.(...args),
        passPriority: (...args) => commandsRef.current.passPriority?.(...args),
        confirmCurrentAction: (...args) => commandsRef.current.confirmCurrentAction?.(...args),
        cancelCurrentAction: (...args) => commandsRef.current.cancelCurrentAction?.(...args),
        inspectCard: (...args) => commandsRef.current.inspectCard?.(...args),
        previewCard: (...args) => commandsRef.current.previewCard?.(...args),
        openDiscard: (...args) => commandsRef.current.openDiscard?.(...args),
        loadPresentationModule: (...args) => commandsRef.current.loadPresentationModule?.(...args),
        presentationCue: (...args) => commandsRef.current.presentationCue?.(...args)
      });
      if (!renderer.scene.activeCamera) {
        throw new Error("The Babylon match scene did not assign an active camera.");
      }
      rendererRef.current = renderer;
      if (process.env.NODE_ENV !== "production") {
        const captureMetrics = () => ({
          ...renderer.getMetrics?.(),
          initializationMs: initializationMsRef.current
        });
        canvas.__gauntletCaptureControl = {
          pause: () => ({
            depth: renderer.setCapturePaused?.(true) || 0,
            metrics: captureMetrics()
          }),
          snapshot: captureMetrics,
          resume: () => renderer.setCapturePaused?.(false) || 0
        };
      }
      renderer.scene.render();
      initializationMsRef.current = performance.now() - initializationStartedAt;
      const emitMetrics = () => onSceneMetricsRef.current?.({
        ...renderer.getMetrics?.(),
        initializationMs: initializationMsRef.current
      });
      emitMetrics();
      engine.runRenderLoop(() => {
        if (rendererFailedRef.current) return;
        renderMatchFrame(renderer, (error) => {
          reportRendererFailure(error, "The Babylon renderer stopped while drawing the match.");
        });
      });
      const metricsInterval = onSceneMetricsRef.current
        ? window.setInterval(emitMetrics, 1000)
        : null;

      const resize = () => engine.resize();
      const contextLost = (event) => {
        event.preventDefault();
        reportRendererFailure(
          new Error("The Babylon WebGL context was lost."),
          "The Babylon WebGL context was lost."
        );
      };
      window.addEventListener("resize", resize);
      canvas.addEventListener("webglcontextlost", contextLost);
      resize();
      return () => {
        window.removeEventListener("resize", resize);
        canvas.removeEventListener("webglcontextlost", contextLost);
        if (metricsInterval) window.clearInterval(metricsInterval);
        engine.stopRenderLoop();
        delete canvas.__gauntletCaptureControl;
        renderer.dispose();
        rendererRef.current = null;
        engineRef.current = null;
        initializationMsRef.current = null;
        engine.dispose();
      };
    } catch (error) {
      reportRendererFailure(error, "The Babylon renderer could not start.");
      engine?.dispose?.();
      engineRef.current = null;
      return undefined;
    }
  }, []);

  useEffect(() => {
    try {
      rendererRef.current?.update(viewModel);
      onSceneMetricsRef.current?.({
        ...rendererRef.current?.getMetrics?.(),
        initializationMs: initializationMsRef.current
      });
    } catch (error) {
      reportRendererFailure(error, "The Babylon renderer could not update.");
    }
  }, [viewModel]);

  if (rendererError) {
    return (
      <div className="babylon-renderer-error" role="alert">
        <strong>Returning to the standard match screen.</strong>
        <span>{rendererError}</span>
      </div>
    );
  }

  return (
    <section
      className="babylon-match-shell"
      aria-label={`${viewModel?.mode === "factions" ? "Faction" : "Basic Gauntlet"} match rendered with Babylon.js`}
    >
      <canvas ref={canvasRef} className="babylon-match-canvas" aria-label="Gauntlet game table. Press H, L, F, or A to enter keyboard card, lane, faction, or action controls." />
      <AccessibleMatchControls viewModel={viewModel} commands={commands} />
    </section>
  );
}
