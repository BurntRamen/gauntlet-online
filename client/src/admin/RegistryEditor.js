import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorSession } from "./EditorSession";

const EMPTY = {};
const snapshot = state => state?.draft?.snapshot || state?.live;
const clone = value => structuredClone(value);

/** A registry owns its mutation contract; this hook owns its local edit session. */
export function useRegistryEditor({ state, act, registry, domain, action, scope, onDirty, initialId, initialTarget, onTarget, fieldId, onSelect, label, validate, localBaseline = false, serverIds = true, copy = clone, adjust }) {
  const config = snapshot(state)?.[registry] || EMPTY, rows = config[domain] || [];
  const [buffer, setBuffer] = useState(() => {
    const row = rows.find(row => row.id === initialId);
    return row ? { row, original: row } : null;
  });
  const [query, setQuery] = useState(""), [filter, setFilter] = useState("all");
  const editing = buffer?.row, saved = rows.find(row => row.id === editing?.id);
  const original = buffer?.original, dirty = !!editing && JSON.stringify(editing) !== JSON.stringify(localBaseline ? original : saved);
  const errors = editing && validate ? validate(editing) : [];
  const select = useCallback((row, isNew = false) => setBuffer(row ? { row: copy(row), original: isNew ? null : copy(row) } : null), [copy]);
  const setValue = value => setBuffer(current => ({ ...current, row: typeof value === "function" ? value(current.row) : value }));
  const update = (key, value) => setBuffer(current => {
    const row = { ...current.row, [key]: value };
    adjust?.(row, key, value);
    return { ...current, row };
  });
  const mutate = async input => {
    const body = { ...scope, ...input }, result = await act(action, body);
    if (!result) return false;
    const savedRows = snapshot(result)?.[registry]?.[body.domain || domain] || [];
    select(serverIds && ["create", "duplicate"].includes(body.operation) ? savedRows.at(-1) : savedRows.find(row => row.id === body.id));
    return true;
  };
  const save = () => errors.length ? false : mutate({ operation: localBaseline && !original ? "create" : "update", id: editing.id, value: editing });
  const leave = useEditorSession({ dirty, label: `${label}: ${editing?.name || "New definition"}`, local: editing, saved,
    save, discard: () => select(localBaseline ? null : saved) });
  useEffect(() => { onDirty(dirty); return () => onDirty(false); }, [dirty, onDirty]);
  useEffect(() => { if (!dirty && editing?.id && editing.id !== initialId) onSelect?.(editing.id); }, [dirty, editing?.id, initialId, onSelect]);
  const opened = useRef(null);
  useEffect(() => {
    if (!initialTarget || opened.current === initialTarget) return;
    if (initialTarget.id == null) {
      if (onTarget?.(initialTarget) === false) return;
      opened.current = initialTarget; select(null);
      requestAnimationFrame(() => document.querySelector('.para-workspace button[aria-pressed="true"]')?.focus());
      return;
    }
    const row = config[initialTarget.domain]?.find(row => row.id === initialTarget.id);
    if (!row || onTarget?.(initialTarget) === false) return;
    opened.current = initialTarget; select(row);
    requestAnimationFrame(() => { const control = document.getElementById(fieldId(initialTarget)); control?.scrollIntoView?.({ block: "center" }); control?.focus(); });
  }, [initialTarget, config, onTarget, fieldId, select]);
  return { config, rows, buffer, editing, original, saved, dirty, errors, query, setQuery, filter, setFilter, select, setValue, update, mutate, save, leave,
    open: row => leave(() => { select(row); onSelect?.(row.id); }),
    submit: event => { event.preventDefault(); save(); } };
}

export function RegistrySearch({ editor, label, className = "admin-search" }) {
  return <label className={className}>{label}<input value={editor.query} onChange={event => editor.setQuery(event.target.value)} /></label>;
}

export function RegistryWorkspace({ editor, summary, searchIds = false, pressed = true, children }) {
  const { rows, editing, query, filter, open } = editor;
  const visible = rows.filter(row => (searchIds ? `${row.id} ${row.name}` : row.name).toLowerCase().includes(query.toLowerCase()) && (filter === "all" || (row.status === "archived") === (filter === "archived")));
  return <div className="admin-authoring-layout"><div className="admin-object-list">{visible.map(row => <button key={row.id} aria-pressed={pressed ? editing?.id === row.id : undefined} onClick={() => open(row)}><strong>{row.name}</strong><small>{summary(row)}</small></button>)}</div>{children}</div>;
}

export function RegistryForm({ editor, children, className = "admin-editor admin-contract-fields" }) {
  return <form className={className} onSubmit={editor.submit}>{children}</form>;
}
