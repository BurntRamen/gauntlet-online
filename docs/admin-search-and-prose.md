# Admin search and website prose

In Gauntlet Admin, choose **Search Admin** or press **Ctrl+K / ⌘K**. Search for a menu name, content name, ID, or phrase. Select **Menus** for destinations or **Editable prose** for text fields. Results show the saved draft when available, otherwise live content. Local unsaved typing is not indexed. Selecting a result opens its owning object and focuses the field; the existing departure guard still protects unsaved edits.

**Design → Other content → Website prose** contains mode names and descriptions, plus page overlines, headings, introductions and menu descriptions for:

- Play → Practice
- Play → Tables (owned by Free-For-All)
- Play → Ranked
- Play → Draft
- Journey (owned by Enter the commander archives; no menu-description override)

Campaign introductions, encounter story/dialogue, character descriptions, card wording and deck descriptions remain in their existing editors and can all be found through the same search. Routing, navigation labels, Events copy, button labels and help text remain source-controlled in this release.

Save each field to the shared draft, inspect **Preview saved draft**, then review and publish through **Publishing**. Text-only changes require the existing exact saved-hash preview; mechanical changes retain their engine-action gate. Revert restores the current live field; rollback restores an immutable release. All edits remain restricted server-side to the two approved administrator IDs.

## Compatibility

Page prose is a bounded, optional text override on existing game-mode records. Missing overrides use shipped defaults. Existing snapshots retain their hashes, domain identities, compatibility hash and release history; no migration or automatic copy publication occurs. Only declared mode owners accept overrides. HTML is displayed as text. The public content projection exposes effective text; editor comparisons and release review use the same defaults. Reverting an override absent from live removes the key.

Search uses a private, read-only `/api/admin/workshops/search` endpoint with bounded queries and 24 results per page. It indexes declared prose fields and finite menu/effect references, not player records or arbitrary snapshot properties. The browser ignores responses from superseded queries. Draft-provider failures use an explicitly labeled deployed-content fallback when available.
