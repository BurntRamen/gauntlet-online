import { useEffect, useRef, useState } from "react";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { createGauntletScene } from "./createGauntletScene";
import AccessibleMatchControls from "./AccessibleMatchControls";
import {
  matchHardwareScalingLevel,
  createAdaptiveResolutionController,
  normalizeGraphicsQuality,
  renderMatchFrame,
  shouldRenderMatchFrame
} from "./rendererLifecycle";
import "./GauntletMatchCanvas.css";

export default function GauntletMatchCanvas({
  viewModel,
  commands = {},
  interactionLocked = false,
  interactionStatus = "",
  graphicsQuality = "balanced",
  battlefieldTheme = "basic",
  cardBackAsset = "",
  handRailPresentation = null,
  capturePlaybackControl = null,
  onRendererError,
  onSceneMetrics
}) {
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);
  const engineRef = useRef(null);
  const rendererFailedRef = useRef(false);
  const commandsRef = useRef(commands);
  const battlefieldThemeRef = useRef(battlefieldTheme);
  const cardBackAssetRef = useRef(cardBackAsset);
  const handRailPresentationRef = useRef(handRailPresentation);
  const graphicsQualityRef = useRef(normalizeGraphicsQuality(graphicsQuality));
  const baseScalingRef = useRef(1);
  const capturePlaybackControlRef = useRef(capturePlaybackControl);
  const onRendererErrorRef = useRef(onRendererError);
  const onSceneMetricsRef = useRef(onSceneMetrics);
  const initializationMsRef = useRef(null);
  const [rendererError, setRendererError] = useState("");
  commandsRef.current = commands;
  battlefieldThemeRef.current = battlefieldTheme;
  cardBackAssetRef.current = cardBackAsset;
  handRailPresentationRef.current = handRailPresentation;
  graphicsQualityRef.current = normalizeGraphicsQuality(graphicsQuality);
  capturePlaybackControlRef.current = capturePlaybackControl;
  onRendererErrorRef.current = onRendererError;
  onSceneMetricsRef.current = onSceneMetrics;

  const reportRendererFailure = (error, fallbackMessage) => {
    if (rendererFailedRef.current) return;
    rendererFailedRef.current = true;
    engineRef.current?.stopRenderLoop?.();
    const resolved = error instanceof Error ? error : new Error(typeof error === "string" && error ? error : fallbackMessage);
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
      engine.setHardwareScalingLevel(matchHardwareScalingLevel(
        canvas.clientWidth,
        canvas.clientHeight,
        graphicsQualityRef.current
      ));
      engineRef.current = engine;
      baseScalingRef.current = engine.getHardwareScalingLevel();
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
        presentationCue: (...args) => commandsRef.current.presentationCue?.(...args),
        cardBackAsset: cardBackAssetRef.current,
        battlefieldTheme: battlefieldThemeRef.current,
        getHandRailPresentation: () => handRailPresentationRef.current?.current
      });
      if (!renderer.scene.activeCamera) {
        throw new Error("The Babylon match scene did not assign an active camera.");
      }
      rendererRef.current = renderer;
      if (process.env.NODE_ENV !== "production") {
        let ownedCaptureDepth = 0;
        const captureMetrics = () => ({
          ...renderer.getMetrics?.(),
          initializationMs: initializationMsRef.current
        });
        const releaseCaptureLease = () => {
          if (ownedCaptureDepth <= 0) return { depth: 0, playbackDepth: 0 };
          let depth = 0;
          let playbackDepth = 0;
          let releaseError = null;
          try {
            depth = renderer.setCapturePaused?.(false) || 0;
          } catch (error) {
            releaseError = error;
          }
          try {
            playbackDepth = capturePlaybackControlRef.current?.resume?.() || 0;
          } catch (error) {
            releaseError ||= error;
          } finally {
            ownedCaptureDepth = Math.max(0, ownedCaptureDepth - 1);
          }
          if (releaseError) throw releaseError;
          return { depth, playbackDepth };
        };
        canvas.__gauntletCaptureControl = {
          pause: () => {
            if (ownedCaptureDepth > 0) {
              throw new Error("The Babylon capture control already owns an active lease.");
            }
            const playbackDepth = capturePlaybackControlRef.current?.pause?.() || 0;
            if (playbackDepth !== 1) {
              if (playbackDepth > 0) capturePlaybackControlRef.current?.resume?.();
              throw new Error("The presentation playback queue could not acquire an exclusive capture lease.");
            }
            let depth = 0;
            let rendererAcquired = false;
            try {
              depth = renderer.setCapturePaused?.(true) || 0;
              rendererAcquired = depth > 0;
              if (depth !== 1) {
                throw new Error("The Babylon renderer could not acquire an exclusive capture lease.");
              }
              const metrics = captureMetrics();
              ownedCaptureDepth = 1;
              return { depth, playbackDepth, metrics };
            } catch (error) {
              let rollbackError = null;
              try {
                if (rendererAcquired) renderer.setCapturePaused?.(false);
              } catch (releaseError) {
                rollbackError = releaseError;
              }
              try {
                capturePlaybackControlRef.current?.resume?.();
              } catch (releaseError) {
                rollbackError ||= releaseError;
              }
              throw rollbackError || error;
            }
          },
          snapshot: captureMetrics,
          resume: releaseCaptureLease,
          releaseAll: () => {
            let depth = 0;
            let playbackDepth = 0;
            let releaseError = null;
            while (ownedCaptureDepth > 0) {
              try {
                ({ depth, playbackDepth } = releaseCaptureLease());
              } catch (error) {
                releaseError ||= error;
              }
            }
            if (releaseError) throw releaseError;
            return { depth, playbackDepth };
          }
        };
      }
      renderer.scene.render();
      initializationMsRef.current = performance.now() - initializationStartedAt;
      const emitMetrics = () => onSceneMetricsRef.current?.({
        ...renderer.getMetrics?.(),
        initializationMs: initializationMsRef.current
      });
      emitMetrics();
      let lastRenderedAt = Number.NEGATIVE_INFINITY;
      const adaptResolution = createAdaptiveResolutionController();
      engine.runRenderLoop(() => {
        if (rendererFailedRef.current) return;
        const now = performance.now();
        const currentScaling = engine.getHardwareScalingLevel();
        const nextScaling = adaptResolution({ now, hidden: document.hidden,
          quality: graphicsQualityRef.current, currentScaling,
          baseScaling: baseScalingRef.current });
        if (nextScaling > currentScaling + 0.01) {
          engine.setHardwareScalingLevel(nextScaling);
          engine.resize();
          lastRenderedAt = Number.NEGATIVE_INFINITY;
        }
        if (!shouldRenderMatchFrame({
          now,
          lastRenderedAt,
          animationActive: renderer.isAnimationActive?.() !== false,
          hidden: document.hidden
        })) return;
        lastRenderedAt = now;
        renderMatchFrame(renderer, (error) => {
          reportRendererFailure(error, "The Babylon renderer stopped while drawing the match.");
        });
      });
      const metricsInterval = onSceneMetricsRef.current
        ? window.setInterval(emitMetrics, 2000)
        : null;

      const resize = () => {
        baseScalingRef.current = matchHardwareScalingLevel(
          canvas.clientWidth,
          canvas.clientHeight,
          graphicsQualityRef.current
        );
        engine.setHardwareScalingLevel(baseScalingRef.current);
        engine.resize();
        // Resizing clears WebGL's drawing buffer. ResizeObserver runs after
        // animation callbacks, so waiting for the capped loop exposes a blank
        // table when selecting a card changes the action panel's height.
        if (!rendererFailedRef.current && Number.isFinite(lastRenderedAt)) {
          lastRenderedAt = performance.now();
          renderMatchFrame(renderer, (error) => {
            reportRendererFailure(error, "The Babylon renderer could not resize the match.");
          });
        }
      };
      const contextLost = (event) => {
        event.preventDefault();
        reportRendererFailure(
          new Error("The Babylon WebGL context was lost."),
          "The Babylon WebGL context was lost."
        );
      };
      window.addEventListener("resize", resize);
      const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
      resizeObserver?.observe(canvas);
      canvas.addEventListener("webglcontextlost", contextLost);
      resize();
      return () => {
        window.removeEventListener("resize", resize);
        resizeObserver?.disconnect();
        canvas.removeEventListener("webglcontextlost", contextLost);
        if (metricsInterval) window.clearInterval(metricsInterval);
        engine.stopRenderLoop();
        try {
          canvas.__gauntletCaptureControl?.releaseAll?.();
        } catch (error) {
          console.error("The Babylon capture lease could not be fully released during cleanup.", error);
        } finally {
          delete canvas.__gauntletCaptureControl;
        }
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
      rendererRef.current?.updatePresentation({ battlefieldTheme, cardBackAsset });
    } catch (error) {
      reportRendererFailure(error, "The Babylon presentation could not update.");
    }
  }, [battlefieldTheme, cardBackAsset]);

  useEffect(() => {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;
    const scalingLevel = matchHardwareScalingLevel(
      canvas.clientWidth,
      canvas.clientHeight,
      graphicsQuality
    );
    baseScalingRef.current = scalingLevel;
    if (engine.getHardwareScalingLevel() !== scalingLevel) {
      engine.setHardwareScalingLevel(scalingLevel);
      engine.resize();
      if (rendererRef.current && !rendererFailedRef.current) {
        renderMatchFrame(rendererRef.current, (error) => {
          reportRendererFailure(error, "The Babylon renderer could not change match quality.");
        });
      }
    }
    onSceneMetricsRef.current?.({
      ...rendererRef.current?.getMetrics?.(),
      initializationMs: initializationMsRef.current
    });
  }, [graphicsQuality]);

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
        <strong>Recovering the game table…</strong>
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
      <AccessibleMatchControls
        viewModel={viewModel}
        commands={commands}
        interactionLocked={interactionLocked}
        interactionStatus={interactionStatus}
        handPresentedExternally={Boolean(handRailPresentation)}
      />
    </section>
  );
}
