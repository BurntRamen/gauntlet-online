# Admin player profiles

Players opens with a compact, page-filtered directory. Selecting a player shows
one profile with Summary, Campaigns, Collection, Decks and Technical sections.
Campaigns use chapter names and cleared/available/locked states. Raw projections
and account identifiers are in Technical. On phones, the profile replaces the
directory and Back to player list returns focus to its filter.

## Metadata editing

The Edit metadata action currently supports the **player name**, which is also
the account's sign-in name. Save applies directly to the account; there is no
content draft or GitHub publishing step for account metadata.

`PATCH /api/admin/players/:accountId/metadata` accepts only:

```json
{"expectedName":"Current name","metadata":{"name":"New name"}}
```

The existing server middleware permits only the two configured, stable admin
account identities. Display names do not confer access. The endpoint rejects
additional fields, invalid names, duplicates and stale name revisions. It never
accepts account identities, credentials, results, credits, entitlements or decks.
Existing player cosmetic-selection controls retain their established behavior;
this change introduces no new cosmetic editor or public player-ID system.

Supabase saves update only `name` and `name_key`, using the expected name as an
atomic condition and the existing unique constraint for duplicate protection.
No schema migration, new storage or new hosting credential is needed. Local
saves use the existing synchronous account file. Neither path updates activity
timestamps or rewrites match evidence. The frontend keeps typed values on failure
and protects page refresh, account switching, Admin navigation and exit while
changes are unsaved or a save is pending.

## Validation

- Server coverage: unauthenticated/ordinary/forged/expired access denial; both
  admins saving; changed-name sign-in; stable identity and session preservation;
  protected fields, duplicate names, stale writes, narrow hosted patches and
  sanitized storage errors.
- Client coverage: navigation/exit/refresh protection and typed-value retention
  after save failure.
- Browser coverage: desktop/phone profile browsing, keyboard focus, accessibility,
  direct non-admin write denial, hidden content-editor guard coexistence and
  persistence across reload.
- Admin-only JavaScript increases from about 17.7 to 19.4 KiB gzip. Its explicit
  budget is 20 KiB; initial-load and player JavaScript limits remain unchanged.

Screenshots in `artifacts/admin-players-*.png` use isolated test accounts.
