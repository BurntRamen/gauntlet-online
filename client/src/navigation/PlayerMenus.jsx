import { useEffect, useState } from "react";
import PlayerShell from "./PlayerShell";
import ActionTile from "./ActionTile";
import SetupFrame from "./SetupFrame";
import { LayoutGrid, PageLayoutSettings, usePlayerLayout } from "./PlayerLayoutStudio";
import { getDestination } from "./destinations";
import { getModePresentation } from "./modePresentation";
import "./PlayerMenus.css";

function ActionDirectory({ title, items }) {
  return <details className="cd-directory"><summary>All {title} actions</summary><div className="cd-row">
    {items.map(({ id, title: label, onClick }) => <button key={id} type="button" onClick={onClick}>{label}</button>)}
  </div><p>These actions stay available when you hide a shortcut.</p></details>;
}

function Tiles({ pageId, items, utilities = [] }) {
  const modules = items.map((item) => ({ id: item.id, label: item.title, content: <ActionTile {...item} /> }));
  return <>
    <LayoutGrid pageId={pageId} items={[...modules, ...utilities]} className="cd-grid" />
    <ActionDirectory title={getDestination(pageId).label.toLowerCase()} items={items} />
  </>;
}

function JoinTable({ code, onCodeChange, onJoin, pending }) {
  return <form className="cd-panel cd-join" onSubmit={(event) => { event.preventDefault(); if (code.trim()) onJoin(false); }}>
    <h2>Join a Table</h2><p>Use the room code from your invitation. Choose to play or watch.</p>
    <label htmlFor="command-room-code">Room code</label>
    <input id="command-room-code" autoComplete="off" autoCapitalize="characters" spellCheck="false" value={code} onChange={(event) => onCodeChange(event.target.value.toUpperCase())} placeholder="Enter room code" />
    <div className="cd-row"><button className="cd-button-primary" type="submit" disabled={!code.trim() || pending}>Join as Player</button>
      <button type="button" disabled={!code.trim() || pending} onClick={() => onJoin(true)}>Spectate</button></div>
  </form>;
}

function RankedSetup({ account, content, status, onJoin, onLeave, onProfile, onEditDeck, deck, decks, onActivateDeck, selections, onSelectionsChange, season }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const factions = (content.factions || []).filter((faction) => !faction.campaignOnly);
  const selectedFaction = factions.find((faction) => faction.id === selections.factionId) || factions[0];
  const generals = selectedFaction?.generals || (selectedFaction?.general ? [selectedFaction.general] : []);
  const selectedGeneral = generals.find((general) => general.id === selections.generalId) || selectedFaction?.general || generals[0];
  async function findMatch() {
    setBusy(true); setError("");
    try {
      if (selections.format === "factions" && selections.deckId && selections.deckId !== deck?.id) await onActivateDeck(selections.deckId);
      onJoin(selections.bestOf, {
        format: selections.format,
        factionId: selections.format === "factions" ? selectedFaction?.id || null : null,
        generalId: selections.format === "factions" ? selectedGeneral?.id || null : null,
      });
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  const update = (patch) => onSelectionsChange({ ...selections, ...patch });
  return <div className="cd-setup-columns"><section className="cd-panel">
    <h3>Choose your ranked match</h3>
    <p>{account ? `Signed in as ${account.name}.` : "Sign in to play ranked and keep your competitive record."}</p>
    <div className="cd-form-grid">
      <label>Ranked format<select value={selections.format} disabled={status.inQueue || busy} onChange={(event) => update({ format: event.target.value })}><option value="factions">Factions</option><option value="basic">Classic — core rules</option></select></label>
      <label>Match length<select value={selections.bestOf} disabled={status.inQueue} onChange={(event) => update({ bestOf: Number(event.target.value) })}><option value={1}>Best of One</option><option value={3}>Best of Three</option></select></label>
      {selections.format === "factions" && <>
        <label>Faction<select value={selectedFaction?.id || ""} disabled={status.inQueue || busy || !factions.length} onChange={(event) => { const faction = factions.find((entry) => entry.id === event.target.value); update({ factionId: event.target.value, generalId: faction?.general?.id || faction?.generals?.[0]?.id || "" }); }}>{!factions.length && <option value="">Faction content is loading</option>}{factions.map((faction) => <option key={faction.id} value={faction.id}>{faction.name || faction.id}</option>)}</select></label>
        <label>General<select value={selectedGeneral?.id || ""} disabled={status.inQueue || busy || !generals.length} onChange={(event) => update({ generalId: event.target.value })}>{!generals.length && <option value="">No General selected</option>}{generals.map((general) => <option key={general.id} value={general.id}>{general.name || general.id}</option>)}</select></label>
        <label>Active constructed deck<select value={selections.deckId || deck?.id || ""} disabled={status.inQueue || !account} onChange={(event) => update({ deckId: event.target.value })}>
          {!decks.length && <option value="">Standard 52-card deck</option>}{decks.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.factionName || item.factionId}</option>)}
        </select></label><div className="cd-row"><button type="button" onClick={onEditDeck}>Edit Deck · return here afterward</button>{deck && <button type="button" disabled={status.inQueue || busy} onClick={() => update({ factionId: deck.factionId, generalId: deck.generalId || "", deckId: deck.id || "" })}>Use Active Deck loadout</button>}</div>
      </>}
    </div>
    <p className="cd-note">{selections.format === "basic" ? "Classic Ranked uses the original standard 52-card deck. Factions, Generals, and constructed faction replacements are disabled." : "Your faction and General carry into the Faction Ranked lobby. A legal active deck matching both choices supplies your replacements; otherwise you use the standard 52-card faction deck."}</p>
    {error && <p role="alert">{error}</p>}
    {status.message && <p role="status">{status.message}</p>}
    <div className="cd-row">{status.inQueue ? <button type="button" onClick={onLeave}>Leave Queue</button> : <button type="button" className="cd-button-primary" disabled={!account || busy || (selections.format === "factions" && !selectedFaction)} onClick={findMatch}>{busy ? "Preparing deck…" : "Find Ranked Match"}</button>}
      {!account && <button type="button" onClick={onProfile}>Sign in / Create Account</button>}</div>
  </section><aside className="cd-panel"><h3>{season?.displayName || "Ranked season"}</h3><p>{season ? `Status: ${season.status}` : "Season information is loading."}</p><p>Matchmaking waits for another signed-in player. It never substitutes a bot.</p><p>BO1 scores each match. BO3 scores the completed series.</p></aside></div>;
}

function DraftSetup({ view, onNavigate, account, content, actions, status, savedDecks, draftSetId }) {
  const [draftType, setDraftType] = useState("player");
  const [bestOf, setBestOf] = useState(1);
  const selectedDeck = savedDecks.find((deck) => (deck.draftType || "player") === draftType);
  const sets = Array.isArray(content.draftSets) ? content.draftSets : [];
  const selectedSet = sets.find((set) => set.id === draftSetId);
  const availabilityKey = view === "sealed" ? "sealedAvailable" : "draftAvailable";
  const available = selectedSet?.[availabilityKey] === true;
  const draftLabel = draftType === "sealed" ? "Sealed" : draftType === "bot" ? "Bot Draft" : "Live Draft";
  return <>
    <nav className="cd-format-nav" aria-label="Limited formats">{[["live", "Live Draft"], ["bot", "Bot Draft"], ["sealed", "Sealed"], ["league", "Limited League"]].map(([id, label]) => <button type="button" aria-current={(view || "live") === id ? "page" : undefined} key={id} onClick={() => onNavigate("draft", id)}>{label}</button>)}</nav>
    <section className="cd-panel">
      {view !== "league" && <div className="cd-limited-set"><label>Limited set<select value={draftSetId || ""} onChange={(event) => actions.setDraftSet(event.target.value)}>{!selectedSet && <option value="">Choose an available set</option>}{sets.map((set) => <option key={set.id} value={set.id} disabled={!set[availabilityKey]}>Set {set.number}: {set.name}{set[availabilityKey] ? "" : " — unavailable for this format"}</option>)}</select></label>
        {selectedSet?.factionIds?.length > 0 && <p>Includes {selectedSet.factionIds.map((id) => content.factions?.find((faction) => faction.id === id)?.name || id).join(", ")}.</p>}
        {!available && <p role="status">{selectedSet?.unavailableReason || (sets.length ? "Choose a set available for this format." : "No published limited sets are available yet.")}</p>}
      </div>}
      {(!view || view === "live") && <><h2>Live Draft</h2><p>Create an eight-seat table. Start drafting after at least two players join; unfilled seats use bots.</p><button className="cd-button-primary" disabled={!available || actions.pending} onClick={actions.createDraft}>Create Draft Room</button></>}
      {view === "bot" && <><h2>Bot Draft</h2><p>Draft at your own pace against seven bots. Save a completed one-faction deck for Bot Draft League.</p><button className="cd-button-primary" disabled={!available || actions.pending} onClick={actions.createBotDraft}>Start Bot Draft</button></>}
      {view === "sealed" && <><h2>Sealed</h2><p>Open six packs from the selected set in a private pool, then build your deck immediately.</p><button className="cd-button-primary" disabled={!available || actions.pending} onClick={actions.createSealed}>Open Sealed Pool</button></>}
      {view === "league" && <><h2>Limited League</h2><p>Use a saved one-faction deck. Live Draft, Bot Draft, and Sealed have separate queues.</p><div className="cd-form-grid">
        <label>Deck source<select value={draftType} disabled={status.inQueue} onChange={(event) => setDraftType(event.target.value)}><option value="player">Live Draft</option><option value="bot">Bot Draft</option><option value="sealed">Sealed</option></select></label>
        <label>Match length<select value={bestOf} disabled={status.inQueue} onChange={(event) => setBestOf(Number(event.target.value))}><option value={1}>Best of One</option><option value={3}>Best of Three</option></select></label>
      </div><p>{selectedDeck ? `Active deck: ${selectedDeck.name || `Saved ${draftLabel} deck`}` : `No active ${draftLabel} deck. Save or activate one in your Draft Deck Library.`}</p>
        {status.message && <p role="status">{status.message}</p>}<div className="cd-row">{status.inQueue ? <button onClick={actions.leaveDraftQueue}>Leave Draft Queue</button> : <button className="cd-button-primary" onClick={() => actions.joinDraftQueue(draftType, bestOf)} disabled={!account || !selectedDeck}>Find Limited Match</button>}<button onClick={() => onNavigate("decks", "library")}>Open Draft Deck Library</button></div></>}
      <p className="cd-note">{account ? "Saved decks stay with your account." : "Guests can play Draft and Sealed as practice. Sign in to save a deck and enter Limited League."}</p>
      {!account && <button type="button" onClick={actions.signInForDraft}>Sign in to save your deck</button>}
    </section>
    <JoinTable code={actions.roomCode} onCodeChange={actions.setRoomCode} onJoin={actions.joinRoom} pending={actions.pending} />
  </>;
}

export default function PlayerMenus({ route, onNavigate, account, ownerAuthorized, content, actions, state, slots, workflow }) {
  const { editing, setEditing } = usePlayerLayout();
  const { page, view } = route;
  const [rankedSelections, setRankedSelections] = useState({ format: "factions", bestOf: 1, factionId: "", generalId: "", deckId: "" });
  useEffect(() => setRankedSelections({ format: "factions", bestOf: 1, factionId: "", generalId: "", deckId: "" }), [account?.id]);
  const focused = !!workflow || !!view || ["draft", "settings"].includes(page);
  const customizable = !focused;
  const nav = (destination, nextView = "") => onNavigate(destination, nextView);
  const profile = () => nav("profile");
  const draftPresentation = getModePresentation("draft", content.modeMetadata, getDestination("draft"));
  const action = (id, title, description, outcome, onClick, icon) => ({ id, title, description, outcome, onClick, icon });
  const playItems = [
    action("basic-ai", "Basic vs AI", "Start a solo core-rules match.", "Start game", actions.basicAi, "play"),
    action("faction-ai", "Factions vs AI", "Practice with faction powers and a general.", "Open faction setup", actions.factionAi, "campaign"),
    action("private-duel", "Private Duel", "Create a two-player private room.", "Create room", actions.createDuel, "community"),
    action("join-table", "Join a Table", "Enter a code to join or spectate.", "Open room entry", () => nav("play", "tables"), "matches"),
    action("ranked", "Ranked Match", "Choose a format and find an opponent.", state.ranked.inQueue ? "View current queue" : "Open ranked setup", () => nav("compete", "ranked"), "compete"),
    action("draft", "Draft & Sealed", "Live Draft, Bot Draft, and limited formats.", "Choose format", () => nav("draft"), "draft"),
    action("campaign", "Campaign", "Choose or continue a faction story.", "Open campaigns", () => nav("campaign"), "campaign"),
    action("competition", "Official Competition", "Browse events and Para League.", "Open competition", () => nav("compete"), "compete"),
  ];
  let body;
  if (workflow) body = workflow;
  else if (page === "play" && view === "tables") body = <SetupFrame {...getModePresentation("freeForAll", content.modeMetadata, { title: "Private Tables", description: "Create a private room or enter an invitation code." })} onBack={() => nav("play")} backLabel="Back to Play">
    <div className="cd-grid"><ActionTile title="Create Duel" description="Two players. Choose Classic or Factions in the lobby." outcome="Create room" onClick={actions.createDuel} /><ActionTile title="Create Free-for-All" description="The existing multiplayer faction format, for two to four players." outcome="Create multiplayer room" onClick={actions.createFreeForAll} /></div>
    <JoinTable code={actions.roomCode} onCodeChange={actions.setRoomCode} onJoin={actions.joinRoom} pending={actions.pending} />
  </SetupFrame>;
  else if (page === "play" && view === "practice") body = <SetupFrame {...getModePresentation("practice", content.modeMetadata, { title: "Practice", description: "Start with core rules, or choose a faction in the AI lobby." })} onBack={() => nav("play")}><div className="cd-grid">{playItems.slice(0, 2).map((item) => <ActionTile key={item.id} {...item} />)}</div></SetupFrame>;
  else if (page === "play") body = <>
    <section className="cd-context" aria-label="Suggested next action"><div><span className="cd-eyebrow">{state.hasSavedRoom ? "Your table is waiting" : actions.roomCode ? "Table invitation" : state.completedChapters > 0 && state.nextCampaign ? "Continue your story" : "Ready when you are"}</span>
      <h2>{state.hasSavedRoom ? `Resume room ${state.savedRoomCode}` : actions.roomCode ? `Invitation to ${actions.roomCode}` : state.completedChapters > 0 && state.nextCampaign ? state.nextCampaign.chapter.title : "Your first match is one click away."}</h2>
      <p>{state.hasSavedRoom ? "Return to your saved player seat or spectator view." : actions.roomCode ? "Choose to join as a player or watch the table." : state.completedChapters > 0 && state.nextCampaign ? "Open your next chapter and its briefing." : "A standard 52-card deck. Learn the core game against AI."}</p></div>
      <button className="cd-button-primary" onClick={state.hasSavedRoom ? actions.resume : actions.roomCode ? () => nav("play", "tables") : state.completedChapters > 0 && state.nextCampaign ? () => actions.campaign(state.nextCampaign.factionId, state.nextCampaign.chapter.id) : actions.basicAi}>{state.hasSavedRoom ? "Resume Match" : actions.roomCode ? "Open Invitation" : state.completedChapters > 0 && state.nextCampaign ? "Continue Campaign" : "Start Basic vs AI"}</button>
    </section>
    <div className="cd-section-line"><h2>Choose your next game</h2><button type="button" onClick={() => nav("play", "tables")}>Private tables & Free-for-All →</button></div>
    <Tiles pageId="play" items={playItems} utilities={[
      { id: "active-deck", label: "Active Deck", content: <section className="cd-utility"><div><span>Active deck</span><strong>{state.deck?.name || "Standard 52-card deck"}</strong><small>{state.deck ? `${state.deck.factionName || state.deck.factionId} · Constructed` : "Ready to play. Customization is optional."}</small></div><button onClick={() => actions.collection("decks")}>{state.deck ? "Edit Deck" : "Open Decks"}</button></section> },
      { id: "recent-matches", label: "Recent Matches", content: slots.recentMatch || <section className="cd-utility"><div><span>Match records</span><strong>Review your games</strong><small>Results and available replays, including device saves.</small></div><button onClick={() => nav("matches")}>Open Matches</button></section> },
    ]} />
  </>;
  else if (page === "campaign" && view === "lore") body = slots.lore || <SetupFrame title="Faction Lore" description="Explore the published commanders and their stories." onBack={() => nav("campaign")} backLabel="Back to Campaign">{Object.entries(content.campaigns || {}).map(([id, campaign]) => <article className="cd-panel" key={id}><h3>{campaign.factionName}: {campaign.commanderName}</h3><p>{campaign.pitch}</p><button onClick={() => actions.campaign(id)}>Open {campaign.factionName} story</button></article>)}</SetupFrame>;
  else if (page === "campaign") {
    const campaignPresentation = getModePresentation("campaign", content.modeMetadata, { title: state.completedChapters ? "Continue Campaign" : "Choose a Faction", description: "" });
    const items = Object.entries(content.campaigns || {}).map(([id, campaign]) => {
      const completed = account?.progression?.campaign?.[id] || [];
      const faction = content.factions?.find((entry) => entry.id === id);
      return { ...action(`faction-${id}`, campaign.factionName || id, `${completed.length} of ${campaign.chapters.length} chapters cleared · ${campaign.commanderName}`, "Open chapter selection", () => actions.campaign(id), "campaign"), artwork: campaign.coverImage || faction?.commander?.image || faction?.cardImage };
    });
    items.push(action("tutorial", "Tutorial", "Learn one complete turn.", "Open tutorial", actions.tutorial, "learn"), action("lore", "Faction Lore", "Meet the published commanders.", "Read faction stories", () => nav("campaign", "lore"), "campaign"), action("rulebook", "Rulebook", "The full rules reference.", "Read rules", () => nav("learn", "rulebook"), "learn"));
    body = <><section className="cd-context"><div>{campaignPresentation.eyebrow && <span className="cd-eyebrow">{campaignPresentation.eyebrow}</span>}<h2>{campaignPresentation.title}</h2><p>{campaignPresentation.description && <>{campaignPresentation.description} </>}{account ? `${state.completedChapters} chapters cleared. Progress and earned packs stay with your account.` : "Guests can play every published campaign. Sign in to retain chapter progress and rewards."}</p>{campaignPresentation.detail && <p className="cd-authored-detail">{campaignPresentation.detail}</p>}</div>{state.nextCampaign && <button className="cd-button-primary" onClick={() => actions.campaign(state.nextCampaign.factionId, state.nextCampaign.chapter.id)}>{state.completedChapters ? "Continue next chapter" : "Open first chapter"}</button>}</section>
      <nav className="cd-campaign-references" aria-label="Campaign references"><button type="button" onClick={actions.tutorial}>Open Tutorial</button><button type="button" onClick={() => nav("campaign", "lore")}>Read Faction Lore</button><button type="button" onClick={() => nav("learn", "rulebook")}>Open Rulebook</button></nav>
      <Tiles pageId="campaign" items={items} /></>;
  }
  else if (page === "decks" && view === "library") body = <SetupFrame title="Draft Deck Library" description="Saved decks, versions, activation, and format restrictions." onBack={() => nav("decks")} backLabel="Back to Decks & Cards">{slots.draftLibrary}</SetupFrame>;
  else if (page === "decks") body = <><p className="cd-note">The standard 52-card deck is playable immediately. Faction-card replacements and collector presentation are optional.</p>
    <Tiles pageId="decks" items={[
      action("editor", state.deck ? "Edit Active Deck" : "Create Deck", state.deck?.name || "Build and save a constructed deck.", account ? "Open deck editor" : "Open sign-in and deck information", () => actions.collection("decks"), "decks"),
      action("collection", "Browse Collection", "Owned cards, legality, and collector variants.", account ? "Open card catalog" : "Open sign-in and collection information", () => actions.collection("catalog"), "decks"),
      action("packs", state.packCredits ? `Open Earned Packs · ${state.packCredits}` : "Earned Packs", state.packCredits ? `${state.packCredits} pack credits ready to use.` : "Campaign victories earn gameplay packs.", account ? "Open packs" : "Open sign-in and pack information", () => actions.collection("packs"), "decks"),
      action("draft-library", "Draft Deck Library", "Manage saved Live Draft, Bot Draft, and Sealed decks.", "Open saved decks", () => nav("decks", "library"), "draft"),
    ]} /><section className="cd-panel"><h2>Current deck</h2><p>{state.deck ? `${state.deck.name} · ${state.deck.factionName || state.deck.factionId}` : "Standard deck · no custom replacements required"}</p>{!account && <button onClick={profile}>Sign in to save decks and rewards</button>}</section></>;
  else if (page === "draft") body = <DraftSetup view={view} onNavigate={nav} account={account} content={content} actions={actions} status={state.draftQueue} savedDecks={state.savedDraftDecks} draftSetId={state.draftSetId} />;
  else if (page === "compete" && view === "ranked") body = <SetupFrame {...getModePresentation("ranked", content.modeMetadata, { title: "Ranked Match", description: "Review your setup. Queue only when you choose Find Ranked Match." })} onBack={() => nav("compete")} backLabel="Back to Compete"><RankedSetup account={account} content={content} status={state.ranked} onJoin={actions.joinRanked} onLeave={actions.leaveRanked} onProfile={profile} onEditDeck={() => actions.collection("decks")} deck={state.deck} decks={state.constructedDecks} onActivateDeck={actions.activateDeck} selections={rankedSelections} onSelectionsChange={setRankedSelections} season={state.season} /></SetupFrame>;
  else if (page === "compete" && ["events", "para"].includes(view)) body = <SetupFrame title={view === "events" ? "Official Events" : "Para League"} description="Published events, eligibility, official runs, and Prestige." onBack={() => nav("compete")} backLabel="Back to Compete">{!account && <button onClick={profile}>Sign in to view eligibility and enter</button>}{slots.events}</SetupFrame>;
  else if (page === "compete" && view === "standings") body = <SetupFrame title="Standings" description="Actual season results and live ranked tables." onBack={() => nav("compete")} backLabel="Back to Compete">{slots.standings}{slots.liveMatches}</SetupFrame>;
  else if (page === "compete") body = <><p className="cd-note">{account ? `Signed in as ${account.name}. Official event eligibility is checked by the server.` : "Sign in to enter ranked queues and official events. Standings are public."}</p><Tiles pageId="compete" items={[
    action("ranked", "Ranked", "Choose your setup and search for an opponent.", "Open ranked setup", () => nav("compete", "ranked"), "compete"),
    action("events", "Events", "See published events, schedules, and eligibility.", "Browse official events", () => nav("compete", "events"), "compete"),
    action("para", "Para League", "Your free membership, Prestige, and official runs.", "Open Para League", () => nav("compete", "para"), "compete"),
    action("standings", "Standings", "Season scores, lifetime records, and live games.", "View standings", () => nav("compete", "standings"), "matches"),
  ]} /></>;
  else if (page === "matches") body = <>{!view && <Tiles pageId="matches" items={[
    action("recent", "Recent Matches", "Opponents, formats, results, and dates.", "Browse match records", () => nav("matches", "recent"), "matches"),
    action("replays", "Replay Library", "Watch available replays or import a match file.", "Open replay library", () => nav("matches", "replays"), "matches"),
    action("record", "Competitive Record", "Your account’s competitive history.", "Open player record", () => nav("profile", "record"), "profile"),
  ]} />}{view && <button className="cd-back-link" onClick={() => nav("matches")}>← All match actions</button>}{slots.matches}</>;
  else if (page === "community") body = <>
    {state.invitations.length > 0 && <section className="cd-panel" aria-label="Actionable invitations"><h2>Invitations</h2>{state.invitations.map((invitation) => <div className="cd-row" key={invitation.id}><p>{invitation.fromName} · room {invitation.roomCode}</p><button onClick={() => actions.joinChallenge(invitation)}>Join Invitation</button><button onClick={() => actions.declineChallenge(invitation.id)}>Decline</button></div>)}</section>}
    {!view && <Tiles pageId="community" items={[
      action("friends", "Friends", "Find a player, start a conversation, or challenge.", "Open friends", () => nav("community", "friends"), "community"),
      action("challenges", "Challenges", "Send a duel challenge or review invitations.", "Open challenges", () => nav("community", "challenges"), "compete"),
      action("messages", "Messages", state.unread ? `${state.unread} unread messages.` : "Read conversations and send a message.", "Open messages", () => nav("community", "messages"), "community"),
    ]} />}
    <nav className="cd-format-nav" aria-label="Community actions">{["friends", "challenges", "messages", "invitations"].map((name) => <button key={name} aria-current={view === name ? "page" : undefined} onClick={() => nav("community", name)}>{name[0].toUpperCase() + name.slice(1)}</button>)}</nav>
    {!account && <button onClick={profile}>Sign in to use Community</button>}{slots.community}
  </>;
  else if (page === "learn" && view === "rulebook") body = <SetupFrame title="Rulebook" description="Complete rules reference." onBack={() => nav("learn")} backLabel="Back to Learn & Rules">{slots.rulebook}</SetupFrame>;
  else if (page === "learn" && view === "formats") body = <SetupFrame title="Format Guide" description="Choose the kind of game you want to play." onBack={() => nav("learn")} backLabel="Back to Learn & Rules"><div className="cd-reference-grid">{playItems.map((item) => <article className="cd-panel" key={item.id}><h3>{item.title}</h3><p>{item.description}</p><button onClick={item.onClick}>{item.outcome}</button></article>)}</div></SetupFrame>;
  else if (page === "learn") body = <Tiles pageId="learn" items={[
    action("tutorial", "Tutorial", "Learn priority, attacking, defending, and lanes.", "Read the guided tutorial", actions.tutorial, "learn"),
    action("rulebook", "Rulebook", "The complete rules, ready to reference.", "Open rulebook", () => nav("learn", "rulebook"), "learn"),
    action("practice", "Practice", "Choose Basic or Factions before entering AI play.", "Open practice choices", () => nav("play", "practice"), "play"),
    action("formats", "Format Guide", "Understand solo, multiplayer, and limited play.", "Compare game formats", () => nav("learn", "formats"), "learn"),
    action("lore", "Faction Lore", "Stories from every published campaign.", "Read faction stories", () => nav("campaign", "lore"), "campaign"),
  ]} />;
  else if (page === "profile" && view === "record") body = <SetupFrame title="Competitive Record" description="Your public account record and completed matches." onBack={profile} backLabel="Back to Profile">{slots.record}</SetupFrame>;
  else if (page === "profile" && view === "library") body = <SetupFrame title="Gold & Library" description="Your existing balances, entitlements, and library." onBack={profile} backLabel="Back to Profile">{slots.economy}</SetupFrame>;
  else if (page === "profile") body = <>
    <div className="cd-profile-top"><section className="cd-panel"><h2>{account?.name || "Guest player"}</h2><p>{account ? "Your account, saved progression, and player identity." : "Start playing as a guest, or sign in to keep your progress across devices."}</p>{slots.account}</section><PageLayoutSettings /></div>
    <Tiles pageId="profile" items={[
      action("record", "Competitive Record", "Wins, losses, and match history.", "View player record", () => nav("profile", "record"), "matches"),
      action("library", "Gold & Library", "Balances and existing earned entitlements.", "Open account library", () => nav("profile", "library"), "decks"),
    ]} />{slots.profileExtras}
  </>;
  else if (page === "settings") body = slots.settings;

  const notices = <>
    {state.error && <p className="cd-notice is-error" role="alert">{state.error}</p>}
    {state.ranked.inQueue && <section className="cd-notice" aria-label="Ranked queue"><strong>Ranked queue active</strong><span>{state.ranked.message}</span><button onClick={() => nav("compete", "ranked")}>View Queue</button><button onClick={actions.leaveRanked}>Leave Queue</button></section>}
    {state.draftQueue.inQueue && <section className="cd-notice" aria-label="Limited queue"><strong>Limited queue active</strong><span>{state.draftQueue.message}</span><button onClick={actions.leaveDraftQueue}>Leave Draft Queue</button></section>}
    {state.hasSavedRoom && !(page === "play" && !view && !workflow) && <section className="cd-notice" aria-label="Saved match recovery"><span>Saved room {state.savedRoomCode}</span><button onClick={actions.resume}>Resume Match</button></section>}
    {actions.roomCode && !(page === "play" && view === "tables" && !workflow) && !(page === "play" && !view && !workflow && !state.hasSavedRoom) && <section className="cd-notice" aria-label="Room invitation"><span>Room invitation: {actions.roomCode}</span><button onClick={() => nav("play", "tables")}>Open Invitation</button></section>}
  </>;
  return <PlayerShell destination={page} navigationKey={`${page}:${view}:${workflow ? "workflow" : "landing"}`} onNavigate={nav} account={account} ownerAuthorized={ownerAuthorized} onAdmin={() => nav("studio")}
    pageTitle={page === "draft" ? draftPresentation.title : undefined} pageDescription={page === "draft" ? draftPresentation.description : undefined}
    pageEyebrow={page === "draft" ? draftPresentation.eyebrow : undefined} pageDetail={page === "draft" ? draftPresentation.detail : undefined}
    onCustomize={() => setEditing(true)} customizable={customizable} editing={editing} onDoneEditing={() => setEditing(false)} notices={notices}>
    <div className={focused ? "cd-focused-workflow" : "cd-landing"}>{body}</div>
  </PlayerShell>;
}
