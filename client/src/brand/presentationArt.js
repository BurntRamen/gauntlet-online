import { useEffect, useSyncExternalStore } from "react";
import { brandText, useBrandPreview } from "./brandPreview";

// Presentation only. Never write resolved paths into a printing, replay or account.
let registry = null, request = null, artModule = null;
const listeners = new Set();
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const snapshot = () => registry;
export function loadPresentationRegistry() {
  if (typeof fetch !== "function") return Promise.resolve(null);
  if (!request) request = import(/* webpackChunkName: "suitfire-art-preview" */ "./presentationRegistry")
    .then(async module => {
      const data = await module.loadRegistry();
      artModule = module;
      registry = data;
      listeners.forEach(fn => fn());
      return data;
    })
    .catch(() => { request = null; return null; });
  return request;
}
export const usePresentationRegistry = () => useSyncExternalStore(subscribe, snapshot, () => null);
export function usePresentationArt() {
  const active = useBrandPreview();
  usePresentationRegistry();
  useEffect(() => { if (active) loadPresentationRegistry(); }, [active]);
  return active;
}
export function resolvePresentationArt(request = {}, options = {}) {
  return artModule
    ? artModule.resolvePresentationArt(request, { preview: brandText(true, false), registry, ...options })
    : { src: request.source || "", status: "original", kind: "image" };
}
export function presentationArt(source, context = {}) {
  return resolvePresentationArt({ source, ...context }).src;
}
export function presentationCard(...args) {
  return brandText(true, false) && artModule ? artModule.presentationCard(registry, ...args) : args[0];
}
export function presentationFace(...args) {
  return brandText(true, false) && artModule ? artModule.presentationFace(registry, ...args) : args[0];
}
