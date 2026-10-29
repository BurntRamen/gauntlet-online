import { useCallback, useEffect, useRef, useState } from 'react';
import {
  emptyLayoutPreferences, hasSavedLayout, moveLayoutModule, normalizeLayoutPreferences,
  readGuestLayout, resetLayoutPage, sameLayoutPreferences, setLayoutModuleHidden, writeGuestLayout,
} from './layoutPreferences';

const initialRecord = (scope) => ({ scope, preferences: emptyLayoutPreferences(), ready: false, status: 'Loading page layouts…', saveState: 'loading', conflict: null, guestChoice: null });

function readEnvelope(data) {
  if (!data || !Number.isSafeInteger(data.revision) || data.revision < 0 || data.preferences?.version !== 1) {
    throw new Error('The layout service returned an invalid response.');
  }
  return { preferences: normalizeLayoutPreferences(data.preferences), revision: data.revision };
}

export function useLayoutPreferences({ account, authToken = '', serverUrl = '' } = {}) {
  const accountId = account?.id ? String(account.id) : '';
  const scope = accountId ? `account:${accountId}` : 'guest';
  const [record, setRecord] = useState(() => initialRecord(scope));
  const [loadAttempt, setLoadAttempt] = useState(0);
  const scopeRef = useRef(scope);
  const recordRef = useRef(record);
  const generationRef = useRef(0);
  const saveSessionRef = useRef(null);
  const guestSessionRef = useRef(null);
  scopeRef.current = scope;
  recordRef.current = record;
  const endpoint = `${serverUrl.replace(/\/$/, '')}/api/account/layouts`;

  const updateRecord = useCallback((patch) => {
    if (scopeRef.current !== scope || recordRef.current.scope !== scope) return;
    const next = { ...recordRef.current, ...patch };
    recordRef.current = next;
    setRecord(next);
  }, [scope]);

  useEffect(() => {
    const generation = ++generationRef.current;
    const controller = new AbortController();
    const saveSession = { scope, revision: 0, pending: null, busy: false, active: true };
    saveSessionRef.current = saveSession;
    const dispose = () => {
      controller.abort();
      saveSession.active = false;
      if (generationRef.current === generation) generationRef.current += 1;
    };
    const guest = readGuestLayout();
    if (guestSessionRef.current) guest.preferences = guestSessionRef.current;
    else guestSessionRef.current = guest.preferences;
    const next = accountId ? initialRecord(scope) : {
      ...initialRecord(scope), preferences: guest.preferences, ready: true,
      status: guest.available ? 'Guest layouts stay in this browser on this device.' : 'Browser storage is unavailable. Layouts will last for this session.',
      saveState: guest.available ? 'local' : 'session',
    };
    recordRef.current = next;
    setRecord(next);
    if (!accountId) return dispose;
    if (!authToken) {
      updateRecord({ status: 'Sign in again to load your account layouts.', saveState: 'load-error' });
      return dispose;
    }
    async function load() {
      try {
        const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${authToken}` }, signal: controller.signal });
        if (!response.ok) throw new Error('Unable to load account layouts.');
        const result = readEnvelope(await response.json());
        if (controller.signal.aborted || generation !== generationRef.current || scopeRef.current !== scope) return;
        saveSession.revision = result.revision;
        const guestChoice = hasSavedLayout(guest.preferences) && !sameLayoutPreferences(guest.preferences, result.preferences) ? guest.preferences : null;
        updateRecord({
          preferences: result.preferences, ready: true, guestChoice,
          status: guestChoice ? 'Choose which layout to use for this account.' : 'Account layouts loaded.', saveState: 'synced',
        });
      } catch (error) {
        if (controller.signal.aborted || generation !== generationRef.current || scopeRef.current !== scope) return;
        updateRecord({ status: 'Could not load account layouts. Retry before editing.', saveState: 'load-error' });
      }
    }
    load();
    return dispose;
  }, [accountId, authToken, endpoint, loadAttempt, scope, updateRecord]);

  const saveAccount = useCallback(async (preferences) => {
    const session = saveSessionRef.current;
    if (!session || session.scope !== scope || !session.active) return;
    session.pending = preferences;
    if (session.busy) return;
    session.busy = true;
    const isCurrent = () => session.active && saveSessionRef.current === session && scopeRef.current === scope;
    // Each scope owns its queue and credentials. Finish authorized edits even if
    // entering gameplay unmounts the menu; never paint those results into a new account.
    while (session.pending) {
      const requested = session.pending;
      session.pending = null;
      if (isCurrent()) updateRecord({ status: 'Saving account layout…', saveState: 'saving' });
      try {
        const response = await fetch(endpoint, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ preferences: requested, revision: session.revision }),
        });
        if (response.status === 409) {
          const remote = readEnvelope(await response.json());
          session.pending = null;
          if (isCurrent()) updateRecord({ conflict: remote, status: 'Your layout changed on another device. Choose which version to keep.', saveState: 'conflict' });
          break;
        }
        if (!response.ok) throw new Error('Unable to save account layouts.');
        const result = readEnvelope(await response.json());
        session.revision = result.revision;
        // Never replace more recent local operations with an older response.
        if (isCurrent()) updateRecord({ status: session.pending ? 'Saving account layout…' : 'Layout saved to your account.', saveState: session.pending ? 'saving' : 'synced' });
      } catch (error) {
        session.pending = null;
        if (isCurrent()) updateRecord({ status: 'Layout changes are only in this session. Retry saving to your account.', saveState: 'save-error' });
        break;
      }
    }
    session.busy = false;
  }, [authToken, endpoint, scope, updateRecord]);

  const commit = useCallback((preferences) => {
    const current = recordRef.current;
    if (scopeRef.current !== scope || current.scope !== scope || !current.ready || current.conflict || current.guestChoice) return;
    const clean = normalizeLayoutPreferences(preferences);
    updateRecord({ preferences: clean });
    if (accountId) saveAccount(clean);
    else {
      guestSessionRef.current = clean;
      const saved = writeGuestLayout(clean);
      updateRecord({ status: saved ? 'Layout saved in this browser.' : 'Browser storage is unavailable. Layout changes are saved for this session only.', saveState: saved ? 'local' : 'session' });
    }
  }, [accountId, saveAccount, scope, updateRecord]);

  const chooseGuestLayout = useCallback((useGuest) => {
    const current = recordRef.current;
    if (current.scope !== scope || !current.guestChoice) return;
    const guest = current.guestChoice;
    updateRecord({ guestChoice: null, status: 'Account layouts loaded.' });
    if (useGuest) commit(guest);
  }, [commit, scope, updateRecord]);

  const resolveConflict = useCallback((keepLocal) => {
    const current = recordRef.current;
    if (current.scope !== scope || !current.conflict) return;
    saveSessionRef.current.revision = current.conflict.revision;
    const preferences = keepLocal ? current.preferences : current.conflict.preferences;
    updateRecord({ preferences, conflict: null, status: 'Account layouts loaded.', saveState: 'synced' });
    if (keepLocal) saveAccount(preferences);
  }, [saveAccount, scope, updateRecord]);

  // Derive safe defaults synchronously on scope changes, before effects run.
  const visible = record.scope === scope ? record : initialRecord(scope);
  return {
    ...visible, scope, isAccount: !!accountId,
    canEdit: visible.ready && !visible.conflict && !visible.guestChoice,
    moveModule: (pageId, id, index) => commit(moveLayoutModule(recordRef.current.preferences, pageId, id, index)),
    hideModule: (pageId, id, hidden) => commit(setLayoutModuleHidden(recordRef.current.preferences, pageId, id, hidden)),
    resetPagePreferences: (pageId) => commit(resetLayoutPage(recordRef.current.preferences, pageId)),
    resetAllPreferences: () => commit(emptyLayoutPreferences()),
    retry: () => visible.saveState === 'load-error' ? setLoadAttempt((value) => value + 1) : commit(recordRef.current.preferences),
    chooseGuestLayout, resolveConflict,
  };
}
