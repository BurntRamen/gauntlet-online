import { useCallback, useEffect, useRef, useState } from "react";
import "./EconomyConsole.css";

export default function EconomyConsole({ request, serverUrl = "", authToken, admin = false }) {
  const [view, setView] = useState(null), [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState(false), [query, setQuery] = useState("");
  const keys = useRef(new Map());
  const base = admin ? "/api/admin/economy" : "/api/economy";
  const call = useCallback(async (action = "", body) => {
    const route = base + (action ? "/" + action : "");
    const options = body ? { method: "POST", body: JSON.stringify(body) } : {};
    if (request) return request(route, options);
    const response = await fetch(serverUrl + route, { ...options, headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" } });
    const data = await response.json(); if (!response.ok) throw new Error(data.error); return data;
  }, [request, serverUrl, authToken, base]);
  const refresh = async () => { setBusy(true); try { setView((await call()).view); setError(""); setQuery(""); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  useEffect(() => { let live = true; setView(null); setError(""); call().then((data) => { if (live) setView(data.view); }).catch((e) => { if (live) setError(e.message); }); return () => { live = false; }; }, [call]);
  async function submit(event, form) {
    event.preventDefault();
    if (admin && !window.confirm(`${form.label}? This changes the account ledger immediately.`)) return;
    const values = { ...form.values, ...Object.fromEntries(new FormData(event.currentTarget)) };
    for (const f of form.fields) if (f.type === "number") values[f.name] = Number(values[f.name]);
    const signature = JSON.stringify([form.action, values]);
    if (!keys.current.has(signature)) keys.current.set(signature, crypto.randomUUID());
    setBusy(true); setError(""); setNotice("");
    try { const data = await call(form.action, { ...values, key: keys.current.get(signature) }); setView(data.view); setNotice(data.notice || ""); setQuery(""); keys.current.delete(signature); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <section className="economy-console" aria-label={admin ? "Economy operations" : "Gold & Library"}>
    <button disabled={busy} onClick={refresh}>Refresh Gold & Library</button>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {view && <><h3>{view.title}</h3><p>{view.summary}</p><p>{view.note}</p>
      <div className="economy-actions">{view.forms?.map((form, i) => <form key={form.action + JSON.stringify(form.values) + i} onSubmit={(e) => submit(e, form)}>{form.fields.map(({ name, label, options, ...props }) => <label key={name}>{label}{options ? <select name={name} required={props.required} disabled={busy}><option value="">Choose…</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select> : <input name={name} {...props} disabled={busy} />}</label>)}<button disabled={busy}>{form.label}</button></form>)}</div>
      {!!view.tables?.length && <label>Search economy records<input value={query} onChange={(e) => setQuery(e.target.value)} /></label>}
      {view.tables?.map((table) => <details open={!admin || !!query || ["Player balances", "Purchase receipts"].includes(table.title)} key={table.title}><summary>{table.title} · {table.rows.length}</summary><div className="economy-table" tabIndex={0} role="region" aria-label={table.title}><table><thead><tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{table.rows.filter((r) => r.join(" ").toLowerCase().includes(query.toLowerCase())).map((r, i) => <tr key={i}>{r.map((c, n) => <td key={n}>{c ?? "—"}</td>)}</tr>)}</tbody></table></div></details>)}
      {view.media && <><p>{view.media.name}</p>{view.media.kind === "audio" ? <audio controls src={view.media.url} /> : view.media.kind === "image" ? <img src={view.media.url} alt={view.media.name} /> : <a href={view.media.url} download>Download owned publication</a>}</>}
    </>}
  </section>;
}
