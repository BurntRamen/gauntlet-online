export default function FactionLoadoutPicker({ factions = [], factionId, generalId, onChange, disabled = false, showFaction = true }) {
  const faction = factions.find((entry) => entry.id === factionId);
  const generals = faction?.generals || (faction?.general ? [faction.general] : []);
  const general = generals.find((entry) => entry.id === generalId) || faction?.general;
  return <fieldset disabled={disabled} style={{ border: "1px solid #64748b", borderRadius: 10, padding: 16, color: "#e2e8f0", background: "#12232d", minWidth: 0 }}>
    <legend>Your faction deck</legend>
    {showFaction && <label style={{ display: "block", marginBottom: 12 }}>Faction
      <select aria-label="Ranked faction" value={factionId} onChange={(event) => {
        const next = factions.find((entry) => entry.id === event.target.value);
        onChange(next.id, next.general?.id || null);
      }} style={{ display: "block", width: "100%", padding: 10 }}>
        {factions.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}{entry.draftRules ? " · Legacies draft" : ""}</option>)}
      </select>
    </label>}
    {faction?.generals ? <label style={{ display: "block" }}>General — choose exactly one
      <select aria-label="Deck General" value={general?.id || "monti"} onChange={(event) => onChange(factionId, event.target.value)} style={{ display: "block", width: "100%", padding: 10 }}>
        {generals.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </select>
    </label> : <p>General: {general?.name || "Select a faction"}</p>}
    {general?.text && <p>{general.text}</p>}
    {faction?.id === "mekan" && <p>Use faction actions during your priority to mark discarded cards as Guests and invite them. Celebrate rewards matching attacks and blocks.</p>}
  </fieldset>;
}
