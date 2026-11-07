# Immutable media operations

This implementation is prepared, not deployed. Render stays on Free. Supabase stores normalized WebP artwork and PCM WAV audio in the private `gauntlet-admin-media` bucket. Server credentials never reach the browser.

## Configure

1. Back up the existing private authoring state and release JSON. Keep these exports private.
2. Apply `20261029212907_immutable_media_library.sql` to the existing Supabase project. It adds private reservation tables, an invoker RPC and a restrictive object policy. It does not create or modify bucket metadata.
3. Run `node scripts/prepare-media-storage.js` with the existing server Supabase environment. This creates the bucket through the Storage API or verifies its configuration. It never changes an existing mismatched bucket or deletes objects.
4. Set `GAUNTLET_MEDIA_PROVIDER=supabase`. Optional `GAUNTLET_MEDIA_MAX_BYTES` sets the shared library budget; default 268435456 (256 MiB). This budget is separate from the project's storage and bandwidth quotas. No plan upgrade is required or performed by this change.
5. Deploy the compatible backend before publishing a release containing remote references. Startup checks the private bucket and hashes every packaged uploaded asset; unavailable or incompatible media refuses startup rather than serving a partially verified release.

The SQL budget is established by the first reservation. To change it, first reconcile actual objects/reservations and the project quota, stop uploads, then update the singleton budget and backend setting together. The configured value must match the database. Do not silently expand the budget after a capacity error.

## Import embedded artwork

An authorized Admin request to `POST /api/admin/authoring/assets/migrate` with the current `expectedRevision` copies retained embedded bytes to content-addressed objects, hashes each readback, then replaces only storage references in the revision-checked private state. Historical snapshots, asset/version IDs, hashes and artwork are unchanged. A stale revision leaves the authoring state untouched. Rerunning at the current revision is safe and deduplicates exact bytes. Objects left by an interrupted import are retained and counted.

Keep the pre-import private export for rollback. Do not use an old backend with reference-based authoring data or `gauntlet.asset-package.v2`. A code rollback must retain this media reader; returning to embedded storage requires a verified export/download of every referenced object first. The normal content rollback continues to select exact retained versions without altering ownership or transactions.

## Normal use and recovery

Upload in an artwork or audio field's picker, preview, choose an exact version, save the field, then validate and release. Uploading alone does not publish. PNG/JPEG/WebP input is decoded and normalized; artwork input is at most 3 MiB, output at most 1 MiB. Audio accepts PCM WAV, mono/stereo, 8–96 kHz, 8/16/24/32-bit, at most 10 MiB and ten minutes. WAV metadata is stripped. Existing manifest MP3s remain selectable; MP3 uploads are not supported.

The picker reports authoring references separately from refreshed bucket and reservation totals. Retries preserve their request identity. Reservations intentionally remain after uncertain/failed uploads to avoid capacity races; investigate orphan reservations before any manual reclamation. Archive hides a logical asset from selection without removing its versions. No destructive deletion endpoint exists. Published references are delivered by the backend only after the version appears in a retained published package; unpublished previews require the two-account Admin authorization.

Back up the private authoring state, release packages, reservation tables and actual bucket bytes together. Database exports alone do not include Storage object bytes. Restore to an isolated project first and run media integrity verification before cutover. Automated object backup scheduling is not yet included. A configuration check is not proof of disaster recovery.
