import { useLayoutEffect, useSyncExternalStore } from 'react';

// Eligibility comes only from the authenticated server response. A saved
// choice never grants access and is keyed to the authenticated account ID.
const PUBLIC = { accountId: null, eligible: false, active: false };
let current = PUBLIC;
const listeners = new Set();
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
const snapshot = () => current;
const key = id => 'gauntlet_brand_preference:' + id;
function update(next) {
  if (next.accountId === current.accountId && next.eligible === current.eligible && next.active === current.active) return;
  current = next;
  for (const listener of listeners) listener();
}
export const brandText = (suitfire, gauntlet) => current.active ? suitfire : gauntlet;
export const useBrandState = () => useSyncExternalStore(subscribe, snapshot, () => PUBLIC);
export const useBrandPreview = () => useBrandState().active;
export function setAccountBrand(account) {
  const eligible = Boolean(account?.id && account.brandPreview === 'suitfire');
  let active = false;
  try { active = eligible && localStorage.getItem(key(account.id)) === 'suitfire'; } catch {}
  update({ accountId: account?.id || null, eligible, active });
}
export function chooseBrand(brand) {
  if (!current.eligible || !['gauntlet', 'suitfire'].includes(brand)) return;
  try { localStorage.setItem(key(current.accountId), brand); } catch {}
  update({ ...current, active: brand === 'suitfire' });
}
export function useAccountBrand(account) {
  const accountId = account?.id, eligibility = account?.brandPreview;
  useLayoutEffect(() => {
    setAccountBrand({ id: accountId, brandPreview: eligibility });
    return () => setAccountBrand(null);
  }, [accountId, eligibility]);
  const active = useBrandPreview();
  useLayoutEffect(() => {
    const base = process.env.PUBLIC_URL || '';
    document.title = active ? 'SuitFire' : 'Gauntlet Online';
    for (const [rel, file] of [
      ['icon', active ? '/brand/suitfire-v14/favicon.png' : '/favicon.ico'],
      ['apple-touch-icon', active ? '/brand/suitfire-v14/icon-192.png' : '/logo192.png'],
      ['manifest', active ? '/brand/suitfire-v14/manifest.json' : '/manifest.json']
    ]) document.querySelector('link[rel="' + rel + '"]')?.setAttribute('href', base + file);
    document.querySelector('meta[name="description"]')?.setAttribute('content', (active ? 'SuitFire' : 'Gauntlet Online') + ' — tactical card battles, faction campaigns, and multiplayer tables.');
  }, [active]);
}
