import React, { createContext, useContext, useEffect, useId, useRef, useState } from 'react';
import { getPageLayout } from './layoutPreferences';
import { getLayoutModuleIds, isCustomizablePage, LAYOUT_PAGE_LABELS, registerCampaignLayoutModules } from './layoutRegistry';
import { useLayoutPreferences } from './useLayoutPreferences';
import './PlayerLayoutStudio.css';

const LayoutContext = createContext(null);

export function usePlayerLayout() {
  const value = useContext(LayoutContext);
  if (!value) throw new Error('Player layout controls require PlayerLayoutProvider.');
  return value;
}

function ResetConfirmation({ pageId, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    cancelRef.current?.focus();
    return () => previous?.isConnected && previous.focus();
  }, []);
  function onKeyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
    if (event.key !== 'Tab') return;
    const buttons = dialogRef.current.querySelectorAll('button:not(:disabled)');
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  return (
    <div className="layout-confirm-backdrop">
      <div ref={dialogRef} className="layout-confirm" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} onKeyDown={onKeyDown}>
        <h2 id={titleId}>{pageId ? `Reset ${LAYOUT_PAGE_LABELS[pageId]} layout?` : 'Reset all page layouts?'}</h2>
        <p id={descriptionId}>Restore the default order and show all panels {pageId ? 'on this page' : 'on every customizable page'}. Your decks, progress and account data stay as they are.</p>
        <div className="layout-confirm-actions"><button ref={cancelRef} type="button" onClick={onCancel}>Cancel</button><button type="button" onClick={onConfirm}>Confirm reset</button></div>
      </div>
    </div>
  );
}

export function PlayerLayoutProvider({ children, account, authToken, serverUrl, factionIds }) {
  // Registration is derived from actual published content before storage is read.
  if (factionIds) registerCampaignLayoutModules(factionIds);
  const layout = useLayoutPreferences({ account, authToken, serverUrl });
  const [editingScope, setEditingScope] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  useEffect(() => {
    setEditingScope(null);
    setConfirmation(null);
  }, [layout.scope]);
  const editing = editingScope === layout.scope;
  const setEditing = (enabled) => setEditingScope(enabled ? layout.scope : null);
  const resetPage = (pageId) => isCustomizablePage(pageId) && setConfirmation({ pageId, scope: layout.scope });
  const resetAll = () => setConfirmation({ pageId: null, scope: layout.scope });
  const confirmReset = () => {
    if (confirmation?.scope === layout.scope) {
      if (confirmation.pageId) layout.resetPagePreferences(confirmation.pageId);
      else layout.resetAllPreferences();
    }
    setConfirmation(null);
  };
  const needsRecovery = ['save-error', 'load-error', 'conflict'].includes(layout.saveState);
  return (
    <LayoutContext.Provider value={{ ...layout, editing, setEditing, resetPage, resetAll }}>
      {layout.guestChoice && <section className="layout-choice" aria-label="Choose page layouts">
        <div><strong>Choose your page layouts</strong><p>This browser has guest layouts. Use them for this account, or keep the saved account layouts.</p></div>
        <button type="button" onClick={() => layout.chooseGuestLayout(false)}>Use account layouts</button>
        <button type="button" onClick={() => layout.chooseGuestLayout(true)}>Use guest layouts</button>
      </section>}
      {layout.conflict && <section className="layout-choice" aria-label="Resolve page layout conflict">
        <div><strong>A newer layout is saved on your account</strong><p>Load the other device’s version, or save the arrangement currently shown here.</p></div>
        <button type="button" onClick={() => layout.resolveConflict(false)}>Load account version</button>
        <button type="button" onClick={() => layout.resolveConflict(true)}>Save this version</button>
      </section>}
      <div className={editing || needsRecovery ? 'layout-save-status' : 'layout-sr-only'} role="status" aria-live="polite" aria-atomic="true">
        <span>{layout.status}</span>
        {(layout.saveState === 'save-error' || layout.saveState === 'load-error') && <button type="button" onClick={layout.retry}>{layout.saveState === 'load-error' ? 'Retry loading layouts' : 'Retry saving layouts'}</button>}
      </div>
      {children}
      {confirmation?.scope === layout.scope && <ResetConfirmation pageId={confirmation.pageId} onCancel={() => setConfirmation(null)} onConfirm={confirmReset} />}
    </LayoutContext.Provider>
  );
}

export function LayoutGrid({ pageId, items = [], className = '' }) {
  const layout = usePlayerLayout();
  const [dragged, setDragged] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const optionRefs = useRef(new Map());
  const allowedIds = getLayoutModuleIds(pageId);
  const registeredItems = items.filter((item) => allowedIds.includes(item.id));
  const itemMap = new Map(registeredItems.map((item) => [item.id, item]));
  const page = getPageLayout(layout.preferences, pageId);
  const ordered = page.order.filter((id) => itemMap.has(id));
  const visible = layout.editing ? ordered : ordered.filter((id) => !page.hidden.includes(id));
  // Unknown modules remain visible and functional, but can never be customized.
  const unmanaged = items.filter((item) => !allowedIds.includes(item.id));
  const editing = layout.editing && isCustomizablePage(pageId);

  function restoreFocus(id) {
    requestAnimationFrame(() => optionRefs.current.get(id)?.focus());
  }
  function move(id, targetIndex) {
    const targetId = ordered[Math.max(0, Math.min(ordered.length - 1, targetIndex))];
    const fullIndex = page.order.indexOf(targetId);
    layout.moveModule(pageId, id, fullIndex);
    setAnnouncement(`${itemMap.get(id)?.label || id} moved to position ${targetIndex + 1} of ${ordered.length}.`);
    restoreFocus(id);
  }
  function handleOption(id, action) {
    const index = ordered.indexOf(id);
    if (action === 'earlier') move(id, index - 1);
    else if (action === 'later') move(id, index + 1);
    else if (action === 'first') move(id, 0);
    else if (action === 'hide' || action === 'show') {
      layout.hideModule(pageId, id, action === 'hide');
      setAnnouncement(`${itemMap.get(id)?.label || id} ${action === 'hide' ? 'hidden. It can be restored here while editing.' : 'shown.'}`);
      restoreFocus(id);
    }
  }
  function dragStart(event, id) {
    if (!layout.canEdit) { event.preventDefault(); return; }
    setDragged(id);
    if (event.dataTransfer) { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', id); }
    setAnnouncement(`Moving ${itemMap.get(id)?.label}. Drop on another panel to change its position.`);
  }
  function drop(event, targetId) {
    event.preventDefault();
    if (dragged && dragged !== targetId && layout.canEdit) move(dragged, ordered.indexOf(targetId));
    setDragged(null);
    setDropTarget(null);
  }
  return <section className={`player-layout ${editing ? 'is-editing' : ''}`} aria-label={`${LAYOUT_PAGE_LABELS[pageId] || 'Page'} panels`}>
    {editing && <div className="layout-edit-toolbar">
      <div><strong>Customize {LAYOUT_PAGE_LABELS[pageId]}</strong><span>Drag a handle or use Panel options. Hidden shortcuts remain available in navigation.</span></div>
      <button type="button" disabled={!layout.canEdit} onClick={() => layout.resetPage(pageId)}>Reset this page</button>
      <button type="button" className="layout-done" onClick={() => layout.setEditing(false)}>Done Editing</button>
    </div>}
    <div className="layout-sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
    <div className={`player-layout-grid ${className}`}>
      {visible.map((id, index) => {
        const item = itemMap.get(id);
        const hidden = page.hidden.includes(id);
        return <div key={id} data-layout-module={id} className={`layout-module ${hidden ? 'is-hidden' : ''} ${dragged === id ? 'is-dragging' : ''} ${dropTarget === id ? 'is-drop-target' : ''}`}
          onDragOver={editing ? (event) => { if (dragged) { event.preventDefault(); setDropTarget(id); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'; } } : undefined}
          onDrop={editing ? (event) => drop(event, id) : undefined}>
          {editing && <div className="layout-module-controls">
            <button className="layout-drag-handle" type="button" draggable={layout.canEdit} disabled={!layout.canEdit} aria-label={`Drag ${item.label} to reorder. Panel options also offers movement controls.`}
              onDragStart={(event) => dragStart(event, id)} onDragEnd={() => { setDragged(null); setDropTarget(null); }}><span aria-hidden="true">⠿</span></button>
            <span className="layout-position">{index + 1} / {ordered.length}</span>
            <select ref={(node) => { if (node) optionRefs.current.set(id, node); else optionRefs.current.delete(id); }} value="" disabled={!layout.canEdit} aria-label={`Panel options for ${item.label}`} onChange={(event) => handleOption(id, event.target.value)}>
              <option value="" disabled>Panel options</option>
              <option value="earlier" disabled={index === 0}>Move Earlier</option>
              <option value="later" disabled={index === ordered.length - 1}>Move Later</option>
              <option value="first" disabled={index === 0}>Move to First</option>
              <option value={hidden ? 'show' : 'hide'}>{hidden ? 'Show panel' : 'Hide panel'}</option>
            </select>
          </div>}
          {editing && hidden ? <div className="layout-hidden-placeholder"><strong>{item.label}</strong><span>Hidden in normal view</span><button type="button" disabled={!layout.canEdit} onClick={() => handleOption(id, 'show')}>Show panel</button></div> :
            <div className="layout-module-content" inert={editing ? true : undefined} onClickCapture={editing ? (event) => { event.preventDefault(); event.stopPropagation(); } : undefined}>{item.content}</div>}
        </div>;
      })}
      {unmanaged.map((item) => <div className="layout-module" key={item.id}>{item.content}</div>)}
    </div>
    {!editing && visible.length === 0 && unmanaged.length === 0 && <div className="layout-empty"><p>All shortcuts on this page are hidden.</p><button type="button" onClick={() => layout.setEditing(true)}>Customize this page to restore shortcuts</button></div>}
  </section>;
}

export function PageLayoutSettings() {
  const layout = usePlayerLayout();
  return <section className="page-layout-settings" aria-labelledby="page-layout-settings-title">
    <h2 id="page-layout-settings-title">Page Layouts</h2>
    <p>Reorder or hide optional shortcuts on Play, Campaign, Decks & Cards, Compete, Matches, Community, Learn & Rules, and Profile.</p>
    <label className="layout-customize-toggle"><input type="checkbox" role="switch" checked={layout.editing} onChange={(event) => layout.setEditing(event.target.checked)} /><span>Customize Mode</span></label>
    <p>{layout.isAccount ? 'Your layouts save to your account and follow you across devices.' : 'Guest layouts stay in this browser on this device. Sign in to save layouts across devices.'}</p>
    <div className="layout-settings-actions"><button type="button" disabled={!layout.canEdit} onClick={layout.resetAll}>Reset all page layouts</button>{layout.editing && <button type="button" onClick={() => layout.setEditing(false)}>Done Editing</button>}</div>
  </section>;
}
