import Help from "./AuthoringHelp";
export default function AssetCapacity({ value, provider }) {
  if (!value) return null;
  const mib = bytes => (bytes / 1048576).toFixed(2);
  return <details className="admin-note"><summary>Upload capacity · {mib(value.storedBytes)} / 6 MiB · {value.versionCount} / 500 versions</summary>
    <p>{mib(value.remainingBytes)} MiB and {value.remainingVersions} versions remaining. Reusing an image on another printing costs no extra stored bytes or versions.</p>
    <Help topic="AssetCapacity1" />
    <Help topic="AssetCapacity2" />
    {provider === "github" && <Help topic="AssetCapacity3" />}
    <p>Encoded images: {mib(value.encodedBytes)} MiB · Private metadata: {mib(value.metadataBytes)} MiB · Current state payload: {mib(value.statePayloadBytes)} MiB · {value.uniqueBlobCount} unique blobs.</p>
  </details>;
}
