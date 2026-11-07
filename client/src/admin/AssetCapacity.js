import Help from "./AuthoringHelp";
import { useState } from "react";
export default function AssetCapacity({ value, provider, request, onMigrate, busy }) {
  const [actual, setActual] = useState(null), [error, setError] = useState(""), [pending, setPending] = useState(false);
  if (!value) return null;
  const mib = bytes => (bytes / 1048576).toFixed(2);
  const usage = actual || value, remote = value.provider === "supabase-immutable-media-v1";
  async function refresh() {
    setPending(true); setError("");
    try { setActual(await request("/api/admin/authoring/assets-usage")); }
    catch (failure) { setError(failure.message); }
    finally { setPending(false); }
  }
  return <details className="admin-note"><summary>Upload capacity · {mib(usage.storedBytes)} / {mib(usage.maxBytes)} MiB · {value.versionCount} / {value.maxVersions} versions</summary>
    <p>{mib(usage.remainingBytes)} MiB and {value.remainingVersions} versions remaining. Reusing a media version costs no extra stored bytes.</p>
    {remote ? <><p>{usage.usageSource}. {usage.scope || "The configured library budget is separate from your Supabase project quota and bandwidth."}</p>{actual && <p>{mib(actual.reservedBytes)} MiB reserved, including interrupted uploads. Old versions are retained for releases and games.</p>}<button type="button" disabled={pending || !request} onClick={refresh}>{pending ? "Reading storage…" : "Refresh storage usage"}</button>{error && <p role="alert">{error}</p>}</> : <><Help topic="AssetCapacity1" /><Help topic="AssetCapacity2" />{provider === "github" && <Help topic="AssetCapacity3" />}</>}
    {remote && value.encodedBytes > 0 && onMigrate && <p><button type="button" disabled={busy || pending} onClick={onMigrate}>Move retained embedded media to private storage</button> Exact versions and release references remain unchanged. Capacity includes imported files.</p>}
    <p>Embedded media: {mib(value.encodedBytes)} MiB · Private metadata: {mib(value.metadataBytes)} MiB · Current state payload: {mib(value.statePayloadBytes)} MiB · {value.uniqueBlobCount} unique blobs.</p>
  </details>;
}
