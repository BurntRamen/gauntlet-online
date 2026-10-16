import { useEffect, useRef, useState } from "react";

function PlayerMetadataEditor({ player, request, guard, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(player.name);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const input = useRef(null);
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  const dirty = editing && (value !== player.name || reason !== "");
  function leave() {
    if (pending.current) return false;
    if (dirty && !window.confirm("Discard unsaved player metadata changes?")) return false;
    // A single departure can pass both the Players and workshop guards before
    // React commits the reset. Do not prompt again for an accepted discard.
    guard.current = () => true;
    setEditing(false); setValue(player.name); setReason(""); setError("");
    return true;
  }
  useEffect(() => { guard.current = leave; return () => { guard.current = () => true; }; });
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  async function save(event) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      await request(`/api/admin/players/${encodeURIComponent(player.id)}/metadata`, {
        method: "PATCH", body: JSON.stringify({ expectedName: player.name, metadata: { name: value }, reason })
      });
      pending.current = false; guard.current = () => true;
      setEditing(false); onSaved();
    } catch (failure) { setError(failure.message); }
    finally { pending.current = false; setBusy(false); }
  }
  return editing ? <form className="admin-player-edit" onSubmit={save} aria-label="Edit player metadata">
    <label className="admin-search">Player name<input ref={input} value={value} disabled={busy} minLength={3} maxLength={24} pattern={"[A-Za-z0-9 _\\-]{3,24}"} required aria-describedby="player-name-help" onChange={(event) => setValue(event.target.value)} /></label>
    <p id="player-name-help" className="admin-note">This is also the name used to sign in. Changes save directly to this account.</p>
    <label className="admin-search">Correction reason<input value={reason} disabled={busy} minLength={8} maxLength={1000} required onChange={e => setReason(e.target.value)} /></label>
    {error && <p role="alert" className="admin-alert">{error}</p>}
    <div className="admin-actions"><button type="submit" disabled={busy || !dirty}>{busy ? "Saving…" : "Save player name"}</button><button type="button" disabled={busy} onClick={leave}>Cancel</button></div>
  </form> : <button onClick={() => setEditing(true)}>Edit player name</button>;
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
    <header className="admin-player-heading"><div><span className="admin-eyebrow">Player profile</span><h4 ref={heading} tabIndex={-1}>{player.name}</h4><p className="admin-note">Last seen {date(player.lastSeenAt)}</p></div></header>
    <PlayerMetadataEditor player={player} request={request} guard={guard} onSaved={onSaved} />
    <nav className="admin-subnav" aria-label="Player details">{["Summary", "Campaigns", "Collection", "Decks", "Purchases", "Support history", "Technical"].map((item) => <button key={item} aria-pressed={section === item} onClick={() => setSection(item)}>{item}</button>)}</nav>
    {section === "Purchases" && <><Facts values={{ Gold: player.commerce?.ledger?.balance ?? player.commerce?.gold, Timetwisters: player.commerce?.timetwisters }} /><p>{player.commerce?.source}</p>{(player.commerce?.receipts || []).map(receipt => <details key={receipt.requestId}><summary>{receipt.productName || receipt.template.name} · {receipt.price} {label(receipt.currency)} · {date(receipt.purchasedAt)}</summary><p>Captured recipe: {receipt.template.name}. Future prices do not change this receipt.</p><Json value={receipt} title="Original purchase terms" /></details>)}{(player.commerce?.ledger?.grants || []).map(grant => <p key={grant.id}>{grant.term.name} · {grant.state} · {grant.expiresAt ? date(grant.expiresAt) : "Permanent"}</p>)}<Json value={player.commerce?.ledger?.transactions || []} title="Currency history" /><Json value={player.commerce?.premiumReceipts || []} title="Premium receipts" /></>}
    {section === "Support history" && <>{(player.corrections || []).map(row => <article key={row.id}><h5>{date(row.at)} · {label(row.action)}</h5><p>{row.before} → {row.after}</p><p>{row.reason}</p><small>Operator {row.actorId}</small></article>)}{!player.corrections?.length && <p>No audited corrections recorded.</p>}<Json value={player.matchReferences} title="Match evidence references" /></>}
    {section === "Summary" && <><h5>At a glance</h5><Facts values={{ gamesPlayed: player.results?.gamesPlayed, wins: player.results?.gamesWon, losses: player.results?.gamesLost, draws: player.results?.gamesDrawn }} />
      <div className="admin-player-totals"><p><strong>{campaigns.reduce((sum, campaign) => sum + campaign.completedChapterIds.length, 0)}</strong> campaign chapters cleared</p><p><strong>{decks.filter((deck) => !deck.archived).length}</strong> active saved decks</p></div>
      <p className="admin-note">Joined {date(player.createdAt)}. Choose a section above to see more.</p>
    </>}
    {section === "Campaigns" && <><h5>Campaign progress</h5>{!campaigns.length && <p>No campaign progress recorded.</p>}{campaigns.map((campaign) => {
      const chapters = catalog?.domains?.campaigns?.find((item) => item.id === campaign.factionId)?.definition?.chapters;
      return <details className="admin-player-card" key={campaign.factionId}><summary><strong>{name("factions", campaign.factionId)}</strong><span>{campaign.completedChapterIds.length} / {campaign.totalChapters} chapters cleared</span></summary>
        {chapters ? <ul className="admin-player-rows">{chapters.map((chapter) => <li key={chapter.id}><span>{chapter.title}</span><small>{campaign.completedChapterIds.includes(chapter.id) ? "Cleared" : campaign.unlockedChapterIds.includes(chapter.id) ? "Available" : "Locked"}</small></li>)}</ul> : <p>Refresh admin to reload chapter names.</p>}
      </details>;
    })}</>}
    {section === "Collection" && <><h5>Collection & unlocks</h5><Facts values={{ packCredits: unlocks.packCredits, achievements: unlocks.achievementIds?.length }} />
      {[ ["Gameplay cards", Object.entries(unlocks.gameplayEntitlements || {}).map(([id, count]) => `${name("cards", id)} · ${count}`)], ["Collector variants", Object.entries(unlocks.collectorVariants || {}).map(([id, count]) => `${label(id)} · ${count}`)], ["Titles", (unlocks.titles || []).map(label)], ["Card backs", (unlocks.cardBacks || []).map(label)], ["Faction badges", (unlocks.factionBadges || []).map((id) => name("factions", id))] ].map(([title, items]) => <details className="admin-player-card" key={title}><summary>{title}<span>{items.length} recorded</span></summary>{items.length ? <ul>{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>None recorded.</p>}</details>)}
    </>}
    {section === "Decks" && <><h5>Saved decks</h5>{!decks.length && <p>No saved decks.</p>}{decks.map((deck) => {
      const current = deck.versions?.find((version) => version.id === deck.currentVersionId);
      return <details className="admin-player-card" key={deck.id}><summary><strong>{deck.name || "Untitled deck"}</strong><span>{name("factions", deck.factionId || "basic")} · {deck.archived ? "Archived" : "Active"}</span></summary><p className="admin-note">{label(deck.format || "Not recorded")} · {deck.versions?.length || 0} saved versions · Updated {date(deck.updatedAt)}</p>
        {current ? <ul className="admin-player-rows">{Object.entries(current.cardQuantities || {}).map(([id, count]) => <li key={id}><span>{name("cards", id)}</span><small>×{count}</small></li>)}</ul> : <p>Current deck version not recorded.</p>}
      </details>;
    })}</>}
    {section === "Technical" && <><h5>Account records</h5><p className="admin-note">Account identity and source records.</p><Facts values={{ accountId: player.id, source: player.source, created: date(player.createdAt), lastSeen: date(player.lastSeenAt) }} /><Json value={player} title="Complete player record" /></>}
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
  const select = (id) => { if (id === selectedId) return true; if (!guard.current()) return false; setSelectedId(id); setNotice(""); return true; };
  return <><p className="admin-lede">Open a player profile to inspect progress, collection and decks.</p>{notice && <p role="status" className="admin-good">{notice}</p>}<State state={state}>{(data) => {
    const filtered = data.players;
    const selected = data.players.find((player) => player.id === selectedId);
    return <div className={`admin-players-layout${selected ? " has-selection" : ""}`}>
      <div className="admin-player-directory"><form onSubmit={e => { e.preventDefault(); if (guard.current()) { setSelectedId(null); setOffset(0); setSearch(query.trim()); } }}><label className="admin-search">Search all players<input ref={list} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Player name or account ID" /></label><button>Search players</button></form>
        <p className="admin-note">Players {data.players.length ? offset + 1 : 0}–{offset + data.players.length} · Search covers all accounts.</p>
        {!data.players.length && <p role="status">No players match this search.</p>}
        
        <div className="admin-object-list">{filtered.map((player) => <button key={player.id} aria-label={`View player ${player.name}`} aria-pressed={selectedId === player.id} onClick={() => select(player.id)}><strong>{player.name}</strong><small>Last seen {date(player.lastSeenAt)}</small></button>)}</div>
        <div className="admin-actions"><button disabled={!offset} onClick={() => { if (guard.current()) { setSelectedId(null); setOffset(Math.max(0, offset - 25)); } }}>Previous players</button><button disabled={!data.hasMore} onClick={() => { if (guard.current()) { setSelectedId(null); setOffset(offset + 25); } }}>Next players</button></div>
      </div>
      {selected ? <PlayerProfile Facts={Facts} Json={Json} date={date} label={label} key={selected.id} player={selected} catalog={catalog} request={request} guard={guard} onSaved={() => { setNotice("Player metadata saved."); setReload((value) => value + 1); }} onBack={() => { if (select(null)) requestAnimationFrame(() => list.current?.focus()); }} /> : <div className="admin-player-empty"><h4>Select a player</h4><p>Choose a player name.</p></div>}
    </div>;
  }}</State></>;
}

