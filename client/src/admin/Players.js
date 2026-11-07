import { useEffect, useRef, useState } from "react";
import UnsavedChangesDialog from "./UnsavedChangesDialog";

const passLeave = action => { action?.(); return true; };
function PlayerMetadataEditor({ player, request, guard, onSaved, name, label }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(player.name);
  const [expectedName, setExpectedName] = useState(player.name);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(null);
  const [repair, setRepair] = useState(null);
  const retry = useRef(null);
  const [departure, setDeparture] = useState(false);
  const pendingAction = useRef(null), pending = useRef(false), input = useRef(null), form = useRef(null);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  const dirty = editing && (value !== expectedName || reason !== "");
  function reset() { setRepair(null); retry.current = null; setEditing(false); setValue(player.name); setExpectedName(player.name); setReason(""); setError(""); setConflict(null); }
  function leave(action) {
    if (pending.current) return false;
    if (dirty) { pendingAction.current = action; setDeparture(true); return false; }
    guard.current = passLeave; reset(); action?.(); return true;
  }
  useEffect(() => { guard.current = leave; return () => { guard.current = passLeave; }; });
  useEffect(() => {
    if (!dirty && !busy) return undefined;
    const warn = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  async function save(event) {
    event?.preventDefault();
    if (pending.current || conflict) return false;
    if (!form.current?.reportValidity()) { setError("Complete a valid player name and correction reason before saving. Choose Keep editing to review the fields."); return false; }
    pending.current = true; setBusy(true); setError("");
    try {
      const terms = repair ? { action: repair.action, expectedHash: repair.hash, reason } : { expectedName, metadata: { name: value }, reason };
      const signature = JSON.stringify(terms);
      if (retry.current?.signature !== signature) retry.current = { signature, key: crypto.randomUUID() };
      await request(`/api/admin/players/${encodeURIComponent(player.id)}/${repair ? "repair" : "metadata"}`, { method: repair ? "POST" : "PATCH", body: JSON.stringify({ ...terms, key: retry.current.key }) });
      pending.current = false; guard.current = passLeave;
      setEditing(false); setRepair(null); onSaved(); return true;
    } catch (failure) {
      setError(failure.message);
      if (failure.status === 409 && !repair) {
        try {
          const result = await request(`/api/admin/players?offset=0&limit=25&q=${encodeURIComponent(player.id)}`);
          const latest = result.players?.find(row => row.id === player.id);
          if (latest) setConflict(latest.name);
        } catch { /* Keep the original save error and all input when comparison cannot load. */ }
      }
      return false;
    } finally { pending.current = false; setBusy(false); }
  }
  async function inspectRepair() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { setRepair(await request(`/api/admin/players/${encodeURIComponent(player.id)}/repair`)); setEditing(true); }
    catch (failure) { setError(failure.message); }
    finally { pending.current = false; setBusy(false); }
  }
  const discard = () => { const action = pendingAction.current; pendingAction.current = null; guard.current = passLeave; setDeparture(false); reset(); action?.(); };
  const saveAndContinue = async () => { const action = pendingAction.current; if (await save()) { pendingAction.current = null; setDeparture(false); action?.(); } };
  return <>{editing ? <form ref={form} className="admin-player-edit" onSubmit={save} aria-label="Edit player metadata">
    {repair ? <section aria-label="Proposed account repair"><h4>Restore recorded progress</h4><p>{repair.boundary}</p><p>{repair.evidenceCount} saved {repair.evidenceCount === 1 ? "receipt" : "receipts"} inspected · {repair.changes.length} missing {repair.changes.length === 1 ? "fact" : "facts"}</p>{repair.changes.map((change, i) => <details key={i}><summary>{change.path.startsWith("progression.campaign.") ? "Campaign clears · " + name("factions", change.path.split(".").at(-1)) : change.path.startsWith("progression.achievements.") ? "Achievement · " + label(change.path.split(".").at(-1)) : "Earned cosmetics · " + label(change.path.split(".").at(-1))}</summary><p>Recorded in {change.receipt}</p><pre>{JSON.stringify({ field: change.path, before: change.before, after: change.after }, null, 2)}</pre></details>)}{!repair.changes.length && <p>No repair is needed from the available evidence.</p>}<p className="admin-note">Applying this repair changes the account immediately and records your reason. It does not enter the shared content draft.</p></section> : <><label className="admin-search">Player name<input ref={input} value={value} disabled={busy} minLength={3} maxLength={24} pattern={"[A-Za-z0-9 _\\-]{3,24}"} required aria-describedby="player-name-help" onChange={(event) => setValue(event.target.value)} /></label>
    <p id="player-name-help" className="admin-note">This is also the name used to sign in. Changes save directly to this account.</p></>}
    <label className="admin-search">Correction reason<input ref={repair ? input : undefined} value={reason} disabled={busy} minLength={8} maxLength={1000} required onChange={event => setReason(event.target.value)} /></label>
    {error && <p role="alert" className="admin-alert">{error}</p>}
    {conflict && <section className="admin-alert" aria-label="Player name conflict"><h4>The account changed elsewhere</h4><dl className="design-facts"><div><dt>Latest account name</dt><dd>{conflict}</dd></div><div><dt>Your correction</dt><dd>{value}</dd></div></dl><button type="button" onClick={() => { setExpectedName(conflict); setConflict(null); setError(""); }}>Use latest name as correction baseline</button><p className="admin-note">Review both names before retrying. Your correction and reason are retained.</p></section>}
    <div className="admin-actions"><button className="admin-primary" type="submit" disabled={busy || !dirty || !!conflict || (repair && !repair.changes.length)}>{busy ? "Saving…" : repair ? "Apply reviewed repair now" : "Save player name"}</button><button type="button" disabled={busy} onClick={() => leave()}>Cancel</button></div>
  </form> : <><div className="admin-actions"><button disabled={busy} onClick={() => setEditing(true)}>Edit player name</button><button disabled={busy} onClick={inspectRepair}>Review missing progress</button></div>{error && <p role="alert">{error}</p>}</>}
  {departure && <UnsavedChangesDialog onKeep={() => { setDeparture(false); pendingAction.current = null; }} onDiscard={discard} onSave={saveAndContinue} saving={busy} error={error} saveDisabledReason={conflict ? "Compare the latest account name before retrying this correction." : undefined} saveLabel={`Saves the reviewed ${repair ? "progress repair" : "name correction"} for ${player.name} immediately, with its reason. This does not create a content draft.`} />}
  </>;
}
function PurchaseEvidence({ player, Facts, Json, date, label }) {
  const commerce = player.commerce;
  if (!commerce) return <p role="status">Purchase evidence is unavailable. Refresh Admin to retry.</p>;
  const receipts = [...(commerce.receipts || []), ...(commerce.ledger?.purchases || []).filter(receipt => !receipt.deckReceipt), ...(commerce.premiumReceipts || [])];
  const transactions = commerce.ledger?.transactions || [];
  return <><Facts values={{ Gold: commerce.ledger?.balance ?? commerce.gold, Timetwisters: commerce.timetwisters }} /><p className="admin-note">{commerce.source}</p>
    <p className="admin-note">Receipts capture the product, price and grants at purchase. Current storefront changes do not rewrite these terms.</p>
    <h4>Purchase receipts</h4>{receipts.length ? receipts.map((receipt, index) => <details className="admin-player-card" key={receipt.id || receipt.requestId || index}><summary><strong>{receipt.productName || receipt.template?.name || receipt.product?.name || receipt.offer?.name || "Recorded purchase"}</strong><span>{receipt.price ?? receipt.gold ?? receipt.amount ?? "Amount not recorded"} {receipt.currency ? label(receipt.currency) : receipt.gold != null ? "Gold" : ""} · {date(receipt.purchasedAt || receipt.at)}</span></summary>
      {receipt.template?.name && <p>Captured recipe: {receipt.template.name}. Future prices do not change this receipt.</p>}{receipt.status && <p>Status: {label(receipt.status)}</p>}<Json value={receipt} title="Original purchase terms" />
    </details>) : <p>No purchase receipts were returned for this player.</p>}
    {!!commerce.ledger?.grants?.length && <><h4>Entitlements</h4><ul className="admin-player-rows">{commerce.ledger.grants.map(grant => <li key={grant.id}><span>{grant.term?.name || "Recorded entitlement"}</span><small>{grant.state} · {grant.expiresAt ? date(grant.expiresAt) : "Permanent"}</small></li>)}</ul></>}
    <h4>Currency history</h4>{transactions.length ? <div className="admin-table-wrap"><table className="design-table"><thead><tr><th>Recorded</th><th>Action</th><th>Amount</th><th>Evidence</th></tr></thead><tbody>{transactions.map((transaction, index) => <tr key={transaction.id || index}><td>{date(transaction.at || transaction.createdAt)}</td><td>{label(transaction.kind || transaction.type || "Not recorded")}</td><td>{transaction.delta ?? transaction.amount ?? "Not recorded"} {transaction.currency || ""}</td><td><Json value={transaction} title="Transaction details" /></td></tr>)}</tbody></table></div> : <p>No currency transactions were returned.</p>}
  </>;
}
function SupportEvidence({ player, Json, date, label }) {
  return <><h4>Audited corrections</h4>{player.corrections?.length ? <ol className="admin-support-timeline">{player.corrections.map(row => <li key={row.id}><strong>{label(row.action)}</strong><small>{date(row.at)}</small>{typeof row.before === "object" || typeof row.after === "object" ? <Json value={{ before: row.before, after: row.after, evidence: row.evidence }} title="Recorded correction and evidence" /> : <p>{row.before} → {row.after}</p>}<p>{row.reason}</p><details><summary>Operator identity</summary><code>{row.actorId}</code></details></li>)}</ol> : <p>No audited corrections recorded.</p>}
    <h4>Match evidence</h4>{player.matchReferences?.length ? <div className="admin-table-wrap"><table className="design-table"><thead><tr><th>Completed</th><th>Record</th><th>Evidence</th></tr></thead><tbody>{player.matchReferences.map((match, index) => <tr key={match.matchId || index}><td>{date(match.completedAt)}</td><td>{match.recordVersion ? `Version ${match.recordVersion}` : "Version not recorded"}</td><td><Json value={match} title="Match reference" />{match.matchId && <a href={`/?match=${encodeURIComponent(match.matchId)}&replay=1`} target="_blank" rel="noreferrer">Open recorded replay</a>}</td></tr>)}</tbody></table></div> : <p>No match evidence references recorded for this player.</p>}
  </>;
}
function PlayerProfile({ player, catalog, onBack, request, guard, onSaved, Facts, Json, date, label }) {
  const [section, setSection] = useState("Summary");
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, [player.id]);
  const name = (domain, id) => catalog?.domains?.[domain]?.find((item) => item.id === id)?.name || label(id);
  const unlocks = player.unlocks || {};
  const decks = player.decks || [];
  const campaigns = player.campaigns || [];
  return <section className="admin-player-profile" aria-label="Selected player">
    <button className="admin-player-back" onClick={onBack}>Back to player list</button>
    <header className="admin-player-heading"><span className="admin-player-avatar" aria-hidden="true">{player.name.slice(0, 2).toUpperCase()}</span><div><span className="admin-eyebrow">Player profile</span><h3 ref={heading} tabIndex={-1}>{player.name}</h3><p className="admin-note">Last seen {date(player.lastSeenAt)}</p></div></header>
    <p className="admin-note">Profile corrections affect this account immediately and are recorded in Support history.</p><PlayerMetadataEditor player={player} request={request} guard={guard} onSaved={onSaved} name={name} label={label} />
    <nav className="admin-subnav" aria-label="Player details">{["Summary", "Campaigns", "Collection", "Decks", "Purchases", "Support history", "Technical"].map((item) => <button key={item} aria-pressed={section === item} onClick={() => setSection(item)}>{item}</button>)}</nav>
    {section === "Purchases" && <PurchaseEvidence player={player} Facts={Facts} Json={Json} date={date} label={label} />}
    {section === "Support history" && <SupportEvidence player={player} Json={Json} date={date} label={label} />}
    {section === "Summary" && <><h4>At a glance</h4><Facts values={{ gamesPlayed: player.results?.gamesPlayed, wins: player.results?.gamesWon, losses: player.results?.gamesLost, draws: player.results?.gamesDrawn }} />
      <div className="admin-player-totals"><p><strong>{campaigns.reduce((sum, campaign) => sum + campaign.completedChapterIds.length, 0)}</strong> campaign chapters cleared</p><p><strong>{decks.filter((deck) => !deck.archived).length}</strong> active saved decks</p></div>
      <p className="admin-note">Joined {date(player.createdAt)}. Choose a section above to see more.</p>
    </>}
    {section === "Campaigns" && <><h4>Campaign progress</h4>{!campaigns.length && <p>No campaign progress recorded.</p>}{campaigns.map((campaign) => {
      const chapters = catalog?.domains?.campaigns?.find((item) => item.id === campaign.factionId)?.definition?.chapters;
      return <details className="admin-player-card" key={campaign.factionId}><summary><strong>{name("factions", campaign.factionId)}</strong><span>{campaign.completedChapterIds.length} / {campaign.totalChapters} chapters cleared</span></summary>
        {chapters ? <ul className="admin-player-rows">{chapters.map((chapter) => <li key={chapter.id}><span>{chapter.title}</span><small>{campaign.completedChapterIds.includes(chapter.id) ? "Cleared" : campaign.unlockedChapterIds.includes(chapter.id) ? "Available" : "Locked"}</small></li>)}</ul> : <p>Refresh admin to reload chapter names.</p>}
      </details>;
    })}</>}
    {section === "Collection" && <><h4>Collection & unlocks</h4><Facts values={{ packCredits: unlocks.packCredits, achievements: unlocks.achievementIds?.length }} />
      {[ ["Gameplay cards", Object.entries(unlocks.gameplayEntitlements || {}).map(([id, count]) => `${name("cards", id)} · ${count}`)], ["Collector variants", Object.entries(unlocks.collectorVariants || {}).map(([id, count]) => `${label(id)} · ${count}`)], ["Titles", (unlocks.titles || []).map(label)], ["Card backs", (unlocks.cardBacks || []).map(label)], ["Faction badges", (unlocks.factionBadges || []).map((id) => name("factions", id))] ].map(([title, items]) => <details className="admin-player-card" key={title}><summary>{title}<span>{items.length} recorded</span></summary>{items.length ? <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>None recorded.</p>}</details>)}
    </>}
    {section === "Decks" && <><h4>Saved decks</h4>{!decks.length && <p>No saved decks.</p>}{decks.map((deck) => {
      const current = deck.versions?.find((version) => version.id === deck.currentVersionId);
      return <details className="admin-player-card" key={deck.id}><summary><strong>{deck.name || "Untitled deck"}</strong><span>{name("factions", deck.factionId || "basic")} · {deck.archived ? "Archived" : "Active"}</span></summary><p className="admin-note">{label(deck.format || "Not recorded")} · {deck.versions?.length || 0} saved versions · Updated {date(deck.updatedAt)}</p>
        {current ? <ul className="admin-player-rows">{Object.entries(current.cardQuantities || {}).map(([id, count]) => <li key={id}><span>{name("cards", id)}</span><small>×{count}</small></li>)}</ul> : <p>Current deck version not recorded.</p>}
      </details>;
    })}</>}
    {section === "Technical" && <><h4>Account records</h4><p className="admin-note">Account identity and source records.</p><Facts values={{ accountId: player.id, source: player.source, created: date(player.createdAt), lastSeen: date(player.lastSeenAt) }} /><Json value={player} title="Complete player record" /></>}
  </section>;
}

export default function Players({ request, revision, catalog, guard, useData, State, Facts, Json, date, label }) {
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState("");
  const list = useRef(null);
  const state = useData(request, `/api/admin/players?offset=${offset}&limit=25${search ? `&q=${encodeURIComponent(search)}` : ""}`, `${revision}:${reload}`);
  const select = (id, accepted) => { if (id === selectedId) { accepted?.(); return true; } return guard.current(() => { setSelectedId(id); setNotice(""); accepted?.(); }); };
  return <><p className="admin-lede">Find an account, understand its progress, and follow the original purchase or match evidence.</p>{notice && <p role="status" className="admin-good">{notice}</p>}<State state={state}>{(data) => {
    const filtered = data.players;
    const selected = data.players.find((player) => player.id === selectedId);
    return <div className={`admin-players-layout${selected ? " has-selection" : ""}`}>
      <div className="admin-player-directory"><form onSubmit={e => { e.preventDefault(); guard.current(() => { setSelectedId(null); setOffset(0); setSearch(query.trim()); }); }}><label className="admin-search">Search all players<input ref={list} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Player name or account ID" /></label><div className="admin-actions"><button>Search players</button>{(query || search) && <button type="button" onClick={() => { guard.current(() => { setSelectedId(null); setQuery(""); setSearch(""); setOffset(0); }); }}>Clear search</button>}</div></form>
        <p className="admin-note">Players {data.players.length ? offset + 1 : 0}–{offset + data.players.length} · Search covers all accounts.</p>
        {!data.players.length && <p role="status">No players match this search. Try part of the player name or their exact account ID.</p>}

        <div className="admin-object-list">{filtered.map((player) => <button key={player.id} aria-label={`View player ${player.name}`} aria-pressed={selectedId === player.id} onClick={() => select(player.id)}><strong>{player.name}</strong><small>Last seen {date(player.lastSeenAt)}</small></button>)}</div>
        <div className="admin-actions"><button disabled={!offset} onClick={() => { guard.current(() => { setSelectedId(null); setOffset(Math.max(0, offset - 25)); }); }}>Previous players</button><button disabled={!data.hasMore} onClick={() => { guard.current(() => { setSelectedId(null); setOffset(offset + 25); }); }}>Next players</button></div>
      </div>
      {selected ? <PlayerProfile Facts={Facts} Json={Json} date={date} label={label} key={selected.id} player={selected} catalog={catalog} request={request} guard={guard} onSaved={() => { setNotice("Player metadata saved."); setReload((value) => value + 1); }} onBack={() => select(null, () => requestAnimationFrame(() => list.current?.focus()))} /> : <div className="admin-player-empty"><span className="admin-eyebrow">Player support</span><h3>Select a player</h3><p>Search by name or account ID, then open a profile to inspect progress, collection, decks and captured purchase terms.</p><p className="admin-note">Viewing a profile does not change the account.</p></div>}
    </div>;
  }}</State></>;
}
