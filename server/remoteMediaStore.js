"use strict";
const crypto = require("node:crypto");
const BUCKET = "gauntlet-admin-media", PROVIDER = "supabase-immutable-media-v1";
const sha256 = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const reference = row => ({ provider: PROVIDER, bucket: BUCKET, key: `media/${row.sha256}`, sha256: row.sha256, bytes: row.bytes, mediaType: row.mediaType });
const validReference = (value, row) => !!value && typeof value === "object" && Object.keys(value).sort().join() === "bucket,bytes,key,mediaType,provider,sha256"
  && value.provider === PROVIDER && value.bucket === BUCKET && value.key === `media/${row.sha256}` && value.sha256 === row.sha256 && value.bytes === row.bytes && value.mediaType === row.mediaType;
function createRemoteMediaStore({ request, storageRequest, maxBytes = 256 * 1024 * 1024, imageUploadBytes = 3*1024*1024, audioUploadBytes = 10*1024*1024 }) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1048576 || maxBytes > 1099511627776) throw new Error("Invalid media-library capacity.");
  if(!Number.isSafeInteger(imageUploadBytes)||imageUploadBytes<1024||imageUploadBytes>3*1024*1024||!Number.isSafeInteger(audioUploadBytes)||audioUploadBytes<1024||audioUploadBytes>10*1024*1024)throw new Error("Upload limits must fit the supported image and audio decoders.");
  async function ensurePrivate() {
    const bucket = await storageRequest(`bucket/${BUCKET}`);
    if (bucket?.public !== false) throw Object.assign(new Error("Configure the private gauntlet-admin-media bucket before uploading."), { status: 503 });
  }
  async function get(row, ref) {
    if (!validReference(ref, row)) throw Object.assign(new Error("Invalid immutable media reference."), { status: 422 });
    await ensurePrivate();
    const body = await storageRequest(`object/authenticated/${BUCKET}/${ref.key}`, { raw: true });
    if (body.length !== row.bytes || sha256(body) !== row.sha256) throw Object.assign(new Error("Stored media failed its integrity check."), { status: 503 });
    return body;
  }
  return {
    provider: PROVIDER, maxBytes, ensurePrivate, uploadLimits:{imageUploadBytes,audioUploadBytes},
    async put(row, body) {
      if (body.length !== row.bytes || sha256(body) !== row.sha256) throw new Error("Invalid upload bytes.");
      await ensurePrivate();
      try { await request("rpc/reserve_gauntlet_media", { method: "POST", body: JSON.stringify({ p_sha256: row.sha256, p_bytes: row.bytes, p_media_type: row.mediaType, p_limit: maxBytes }) }); }
      catch (error) { throw Object.assign(new Error(error.code === "54000" ? "The media-library budget is full. Existing releases and images were retained." : "Media capacity could not be reserved. Check the migration and configured library budget."), { status: error.code === "54000" ? 422 : 503 }); }
      const ref = reference(row);
      try { await storageRequest(`object/${BUCKET}/${ref.key}`, { method: "POST", body, headers: { "Content-Type": row.mediaType, "x-upsert": "false" } }); }
      catch (error) {
        // A duplicate or lost upload response is resolved by exact readback.
        // Never overwrite bytes at an existing content-addressed path.
        try { await get(row, ref); return ref; } catch { throw Object.assign(new Error("Upload was not confirmed. Retry the same file; reserved capacity and prior versions are retained."), { status: 503 }); }
      }
      await get(row, ref); return ref;
    },
    get,
    async verify(versions, blobs) { for (const row of versions) if (validReference(blobs[row.sha256], row)) await get(row, blobs[row.sha256]); },
    async capacity() {
      await ensurePrivate();
      const budgets = await request("gauntlet_media_capacity?id=eq.library&select=max_bytes");
      let reservedBytes = 0, storedBytes = 0, count = 0;
      for (let offset = 0; ; offset += 1000) {
        const rows = await request(`gauntlet_media_objects?select=bytes&order=sha256&limit=1000&offset=${offset}`);
        if (!Array.isArray(rows)) throw new Error("Media usage unavailable.");
        reservedBytes += rows.reduce((sum, row) => sum + Number(row.bytes), 0);
        if (rows.length < 1000) break;
      }
      for (let offset = 0; ; offset += 100) {
        const rows = await storageRequest(`object/list/${BUCKET}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefix: "media", limit: 100, offset, sortBy: { column: "name", order: "asc" } }) });
        if (!Array.isArray(rows) || rows.some(row => !Number.isSafeInteger(Number(row.metadata?.size)))) throw new Error("Stored-media usage unavailable.");
        storedBytes += rows.reduce((sum, row) => sum + Number(row.metadata.size), 0); count += rows.length;
        if (rows.length < 100) break;
      }
      return { provider: PROVIDER, storedBytes, reservedBytes, uniqueBlobCount: count, maxBytes: Number(budgets[0]?.max_bytes || maxBytes), remainingBytes: Math.max(0, Number(budgets[0]?.max_bytes || maxBytes) - Math.max(storedBytes, reservedBytes)), usageSource: "Private bucket objects and database reservations", scope: "This media library; project-wide quota and bandwidth are separate" };
    }
  };
}
module.exports = { createRemoteMediaStore, validReference, reference, BUCKET, PROVIDER };
