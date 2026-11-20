# Rendered comparisons

Baseline UI: `41d8801f`. After: this branch. Captures use Chromium, reduced motion, the same isolated fixture store and a 1440×1000 viewport (phone drawer: 390×844). The card is Dividend Yield Blade; custom mechanic, recipe/product and competition records are fixture-only. No publication occurs in the capture script. The new Website image capability is separately exercised through the browser release/rollback journey.

The baseline was compiled from the original UI and shared navigation sources, then current source files were restored. The same current fixture backend serves both capture sets; these are UI comparisons, not a claim of historical production state. Representative records are seeded through existing local authoring APIs by `scripts/capture-admin-studio.cjs`. Script readiness waits for editors and actual card presentation rather than an arbitrary page-load delay.

| Surface | Before | After |
| --- | --- | --- |
| Home | [![Before Home](before/home-desktop.png)](before/home-desktop.png) | [![After Home](after/home-desktop.png)](after/home-desktop.png) |
| Navigation (phone drawer) | [![Before Navigation (phone drawer)](before/navigation-phone.png)](before/navigation-phone.png) | [![After Navigation (phone drawer)](after/navigation-phone.png)](after/navigation-phone.png) |
| Content browsing | [![Before Content browsing](before/content-desktop.png)](before/content-desktop.png) | [![After Content browsing](after/content-desktop.png)](after/content-desktop.png) |
| Card editing | [![Before Card editing](before/card-desktop.png)](before/card-desktop.png) | [![After Card editing](after/card-desktop.png)](after/card-desktop.png) |
| Mechanic editing | [![Before Mechanic editing](before/mechanic-desktop.png)](before/mechanic-desktop.png) | [![After Mechanic editing](after/mechanic-desktop.png)](after/mechanic-desktop.png) |
| Website editing | [![Before Website editing](before/website-desktop.png)](before/website-desktop.png) | [![After Website editing](after/website-desktop.png)](after/website-desktop.png) |
| Assets | [![Before Assets](before/assets-desktop.png)](before/assets-desktop.png) | [![After Assets](after/assets-desktop.png)](after/assets-desktop.png) |
| Events | [![Before Events](before/events-desktop.png)](before/events-desktop.png) | [![After Events](after/events-desktop.png)](after/events-desktop.png) |
| Commerce | [![Before Commerce](before/commerce-desktop.png)](before/commerce-desktop.png) | [![After Commerce](after/commerce-desktop.png)](after/commerce-desktop.png) |
| Release review | [![Before Release review](before/publishing-desktop.png)](before/publishing-desktop.png) | [![After Release review](after/publishing-desktop.png)](after/publishing-desktop.png) |
| Operations / player detail | [![Before Operations / player detail](before/operations-desktop.png)](before/operations-desktop.png) | [![After Operations / player detail](after/operations-desktop.png)](after/operations-desktop.png) |

## Additional matched sizes

| Surface / size | Before | After |
| --- | --- | --- |
| home / 1280×800 | [Open](before/home-laptop.png) | [Open](after/home-laptop.png) |
| home / 390×844 | [Open](before/home-phone.png) | [Open](after/home-phone.png) |
| card / 1280×800 | [Open](before/card-laptop.png) | [Open](after/card-laptop.png) |
| card / 390×844 | [Open](before/card-phone.png) | [Open](after/card-phone.png) |
| website / 1280×800 | [Open](before/website-laptop.png) | [Open](after/website-laptop.png) |
| website / 390×844 | [Open](before/website-phone.png) | [Open](after/website-phone.png) |

## Reproduce

The final [native 200% zoom measurements](native-zoom/native-zoom.json) record zero Axe violations and no horizontal overflow for Home, the collection, editor preview, validation and release review. [Editor preview](native-zoom/editor-preview-native-200-percent.png) and [release review](native-zoom/review-native-200-percent.png) were captured from the browser compositor after selecting Chrome's actual 200% Page zoom setting.

The [phone validation view](phone-validation.png) shows the first repair action within the initial viewport. The browser test asserts that position and checks the full surface with Axe.

The [actual player page after fixture publication](website-player-fixture.png) shows the authored heading and immutable header artwork. This is an isolated local release, subsequently rolled back; existing player branding and activation flags are retained.

Use a compiled client with `REACT_APP_SOCKET_URL=http://127.0.0.1:4188` and `REACT_APP_MENU_LAYOUT_CUSTOMIZATION=false`, then `node scripts/admin-studio-preview.cjs after`. The helper starts only the isolated fixture server and static build server and closes its own children afterward. `CAPTURE_FILTER=card,website` limits captures. Do not point the script at a production origin.

The separate browser suite checks responsive overflow, keyboard focus, Axe and actual native Chrome 200% zoom. A screenshot alone is not accessibility or engine evidence. See [verification.md](verification.md).
