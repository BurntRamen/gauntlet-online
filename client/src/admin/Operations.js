import { useEffect, useRef, useState } from "react";
import MatchInspector from "./MatchInspector";
import useAdminData from "./useAdminData";

function Issues({ issues = [] }) {
  return issues.length > 0 ? <ul className="admin-alert">{issues.map((issue, i) => <li key={i}>{issue}</li>)}</ul> : <p className="admin-good">These checks reported no failures.</p>;
}

function System({ request, revision, operations, State, Facts, Json, date, label }) {
  const state = useAdminData(request, "/api/admin/system", revision);
  const guide = state.data?.guide || {};
  return <><State state={state}>{(data) => <><Facts values={{ applicationVersion: data.applicationVersion, backendCommit: data.backendCommit, environment: data.environment, checkedAt: date(data.checkedAt) }} /><h3>{guide.label1}</h3><Issues issues={data.issues} /><p>{data.validation.message}</p><div className="admin-cards">{Object.entries(data.storage).map(([name, storage]) => <article key={name}><h4>{label(name)}</h4><Facts values={Object.fromEntries(Object.entries(storage).filter(([, value]) => typeof value !== "object"))} />{storage.capabilities && <Json value={storage.capabilities} title={guide.label2} />}</article>)}</div><details className="admin-json"><summary>{guide.label3}</summary><Facts values={data.versions} /></details><details className="admin-json"><summary>{guide.label4}</summary>{data.sources.map((source) => <article className="admin-source" key={source.domain}><h5>{source.domain}</h5><code>{source.source}</code><p>{source.boundary}</p></article>)}<ul className="admin-note">{data.boundaries.map((boundary) => <li key={boundary}>{boundary}</li>)}</ul></details></>}</State>
    <section className="admin-operations-tools" aria-label={guide.label5}><h3>{guide.label6}</h3><p className="admin-note">{guide.label7}</p>{operations}</section>
  </>;
}


function MatchList({ guide, records, onInspect, date }) {
  if (!records.length) return <p>{guide.matchNote22}</p>;
  return <div className="admin-table-wrap"><table><thead><tr><th>Match / time</th><th>{guide.matchNote23}</th><th>{guide.matchNote24}</th><th>Evidence</th>{onInspect && <th>Action</th>}</tr></thead><tbody>{records.map((record) => <tr key={record.matchId}><td>{date(record.completedAt)}<details><summary>Match ID</summary><code>{record.matchId}</code></details></td><td>{(record.participants || []).map((player) => <div key={player.playerNum}>{player.displayName} · {player.faction?.name || "Basic"} · {player.result || "Not recorded"}</div>)}</td><td>{record.mode}<small>{record.campaign?.title || record.campaign?.chapterId || "—"}</small></td><td>{record.provenance?.integrity || "Not checked"}<details><summary>{guide.matchNote25}</summary><small>Record v{record.recordVersion} · {record.contentVersion || "No content version"}</small></details></td>{onInspect && <td><button aria-label={`Inspect match ${record.matchId}`} onClick={() => onInspect(record.matchId)}>Inspect</button></td>}</tr>)}</tbody></table></div>;
}

function MatchDetail({ request, id, revision, onInspectContent, State }) {
  const state = useAdminData(request, `/api/admin/matches/${encodeURIComponent(id)}`, revision);
  const detailRef = useRef(null);
  useEffect(() => { detailRef.current?.scrollIntoView?.({ block: "start" }); }, [id]);
  return <section ref={detailRef} className="admin-detail"><State state={state}>{data => <MatchInspector {...data} onInspect={onInspectContent} />}</State></section>;
}

function Matches({ request, revision, onInspectContent, State, date }) {
  const state = useAdminData(request, "/api/admin/matches", revision);
  const guide = state.data?.guide || {};
  const [query, setQuery] = useState("");
  const [id, setId] = useState("");
  const [lookup, setLookup] = useState("");
  return <><p className="admin-lede">{guide.matchNote26}</p>
    <form className="admin-actions" onSubmit={(event) => { event.preventDefault(); setId(lookup.trim()); }}><label className="admin-search">{guide.matchNote27}<input value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder={guide.matchNote28} required /></label><button type="submit">Look up match</button></form>
    <label className="admin-search">{guide.matchNote29}<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={guide.matchNote30} /></label>
    <State state={state}>{(data) => <><p className="admin-note">{data.scope}</p><Issues issues={data.issues} /><MatchList guide={guide} date={date} records={data.matches.filter((record) => [record.matchId, record.mode, record.campaign?.title, record.campaign?.chapterId, ...(record.participants || []).flatMap((player) => [player.displayName, player.faction?.name])].join(" ").toLowerCase().includes(query.toLowerCase()))} onInspect={setId} /></>}</State>
    {id && <MatchDetail State={State} key={id} request={request} id={id} revision={revision} onInspectContent={onInspectContent} />}
  </>;
}



export default function Operations({ active, workspace, matchesOpened, ...props }) {
  return <>{matchesOpened && <div hidden={!active || workspace !== "Match evidence"}><Matches {...props} /></div>}{active && workspace === "Health" && <System {...props} />}</>;
}
