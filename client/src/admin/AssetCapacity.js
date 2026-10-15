export default function AssetCapacity({ value, provider }) {
  if (!value) return null;
  const mib = bytes => (bytes / 1048576).toFixed(2);
  return <details className="admin-note"><summary>Upload capacity · {mib(value.storedBytes)} / 6 MiB · {value.versionCount} / 500 versions</summary>
    <p>{mib(value.remainingBytes)} MiB and {value.remainingVersions} versions remaining. Reusing an image on another printing costs no extra stored bytes or versions.</p>
    <p>The 6 MiB limit counts unique normalized bytes across private, archived and historical uploads. The 500 limit counts distinct version records, including versions sharing bytes. Source artwork is separate. Upload: 3 MiB maximum; processed image: 1 MiB maximum.</p>
    <p>Encoding and metadata are outside the 6 MiB allowance, but count toward the storage payload. No separate derivatives are generated; originals are not retained. At capacity, reuse an existing version or arrange a separate storage expansion. Archiving does not free retained bytes.</p>
    {provider === "github" && <p>GitHub requires a configured credential and a private repository, checked before upload. Public or unverified repositories are refused. The complete formatted storage payload also has a 16 MiB limit.</p>}
    <p>Encoded images: {mib(value.encodedBytes)} MiB · Private metadata: {mib(value.metadataBytes)} MiB · Current state payload: {mib(value.statePayloadBytes)} MiB · {value.uniqueBlobCount} unique blobs.</p>
  </details>;
}
