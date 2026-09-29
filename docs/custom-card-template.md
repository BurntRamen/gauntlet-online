# Official custom faction card template

The user approved `generated-assets/card-proofs/raincall-mender-v6-full-art.png` as the official template in this task: “this is the official templated design. proceed with full card design and implementation”.

The local implementation uses a 500 × 700 full-art face, rounded corners and a thin ivory perimeter. Each custom card has a distinct illustration; a shared faction portrait is not a completed custom card. Existing Rumin and Bizi illustrations are retained. Raincall Mender is the approved Sheen reference; earlier rejected Sheen artwork is excluded.

Ranks use 150px Times New Roman bold, horizontally scaled 0.9 (0.6 for two digits). Suit pips use 144px Georgia bold. Both appear at upper left and rotated 180° at lower right. Black suits use `#20252c`; red suits use `#a32430`. Soft ivory washes and fine ivory outlines preserve contrast over the art. Names, concise ability text, faction and card type are rendered by code, never by image generation.

Abilities use 24px Arial with 29px line spacing, increased from 13px. Actual font measurements wrap text within 326px, clear of the lower-right index. Generation fails if a caption would exceed six lines or start above y=410. Concise DOM fallbacks use the same 24px-equivalent font; legacy snapshots without concise metadata retain the smaller full-rule fallback if a face fails to load. `server/cardWording.js` owns the display-only lexicon and all 72 concise abilities; original `text` remains the full rules authority. The guide and preview preserve access to the full rules. See [the lexicon](card-lexicon.md).

The same face assets appear in the collection, pack reveals, deck workshop, card inspection, live match and replay. The workshop preview follows the selected replacement suit and can be enlarged. The replacement matrix remains available in a collapsible panel.

## Rebuild

```sh
node scripts/build-custom-card-faces.js
node scripts/build-card-keyword-guide.js
node scripts/report-constructed-card-art.js
node scripts/build-custom-card-review.js
```

Build one card by passing its ID, or one faction with `--faction sheen`. The generator fails if an illustration is missing; it never substitutes another card's art. All-card builds also refresh `client/src/customCardArt.json`.

Illustrations live in `client/public/assets/gauntlet/constructed/<faction>/<card-id>.webp`; each gets four suit faces in `constructed/faces/`. Card facts come unchanged from `server/gameContent.js`. `generated-assets/full-art-card-plan-2026-09-29.json` records prompts, reference roles, generation sources and imported asset hashes.

This records the user's local design approval and implementation. It does not modify Drive authorities or game mechanics.
