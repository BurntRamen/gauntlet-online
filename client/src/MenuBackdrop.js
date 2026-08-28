import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveVisualAsset } from "./GauntletVisuals";

function loadDecodedImage(source) {
  if (typeof window === "undefined" || !window.Image) return Promise.resolve();
  return new Promise((resolve) => {
    const image = new window.Image();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (typeof image.decode === "function") image.decode().catch(() => {}).finally(resolve);
      else resolve();
    };
    image.decoding = "async";
    image.onload = finish;
    image.onerror = resolve;
    image.src = source;
    if (image.complete) finish();
  });
}

export default function MenuBackdrop({ activeArea, backgrounds }) {
  const sources = useMemo(() => [...new Set(Object.values(backgrounds || {}).map(resolveVisualAsset))], [backgrounds]);
  const activeSource = resolveVisualAsset(backgrounds?.[activeArea] || backgrounds?.journey || sources[0] || "");
  const [visibleSource, setVisibleSource] = useState(activeSource);
  const [readySources, setReadySources] = useState(() => new Set(activeSource ? [activeSource] : []));
  const cacheRef = useRef(new Map());
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const prepareSource = useCallback((source) => {
    if (!source) return Promise.resolve();
    if (!cacheRef.current.has(source)) cacheRef.current.set(source, loadDecodedImage(source));
    return cacheRef.current.get(source).then(() => {
      if (!mountedRef.current) return;
      setReadySources((current) => {
        if (current.has(source)) return current;
        return new Set([...current, source]);
      });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    prepareSource(activeSource).then(() => {
      if (!cancelled) setVisibleSource(activeSource);
    });
    return () => { cancelled = true; };
  }, [activeSource, prepareSource]);

  useEffect(() => {
    const warmRemaining = () => sources.forEach((source) => prepareSource(source));
    const idleId = typeof window !== "undefined" && window.requestIdleCallback
      ? window.requestIdleCallback(warmRemaining, { timeout: 1200 })
      : window.setTimeout(warmRemaining, 260);
    return () => {
      if (typeof window !== "undefined" && window.cancelIdleCallback) window.cancelIdleCallback(idleId);
      else window.clearTimeout(idleId);
    };
  }, [prepareSource, sources]);

  return (
    <div className="menu-backdrop-stack" aria-hidden="true">
      {sources.map((source) => readySources.has(source) && (
        <span
          key={source}
          className={`menu-backdrop-layer${source === visibleSource ? " is-visible" : ""}`}
          style={{ "--menu-backdrop-image": `url(${source})` }}
        />
      ))}
    </div>
  );
}
