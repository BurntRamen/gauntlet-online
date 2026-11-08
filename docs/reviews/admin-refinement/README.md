# SuitFire Admin refinement review

Draft review branch: `codex/admin-refinement`, based on refreshed `main` at `d3e6f364f5ea061cb85f9156ec99049900a8fdb6`. PRs #102, #104 and #105 are included in that base. The prior worktree branch and unrelated work are preserved.

The subsequent [connected production pipelines review](../admin-pipelines/README.md) adds outcome-based creation flows and contains the newer verification and performance evidence. The measurements below describe the original refinement commit unless explicitly updated there.

## What changed

Collections use the full workspace until a record is opened. Semantic table rows open records; the gallery remains available. Content destinations sit directly beneath Content. At 1600px and above, collection, editor and preview can share the screen; at laptop widths, the collection collapses behind Back to list; below 1200px, Editor and Preview are explicit modes.

Home prioritizes common actions, recent work, release state and operational attention. Deliberately disabled capabilities appear separately. The existing account/environment-scoped Admin preferences, pins, reset and player layout boundaries remain in place.

Editors share compact identity, lifecycle and relationship sections. The saved card preview identifies its source and revision; local values are explicitly excluded. Comparisons and revert controls share one disclosure. Validation carries source/hash/revision metadata and exposes field-specific repair links, accessible errors and a return path.

Release review puts blocking issues and repair actions before the publication form, and only treats matching candidate hash **and** revision as current evidence. An older active release cannot label a pending candidate live. Publication, engine receipts, immutable assets, rollback, concurrency and operational authority remain with the existing services. Loading and failed review/production-guide requests have distinct messages and explicit retry.

## Matched visual evidence

All captures use synthetic accounts and isolated stores, with non-loopback HTTP(S) blocked. The same five surfaces are captured at each size; screenshots show the viewport after the corresponding workflow action, not an entire long page.

### 1366 × 768

| Surface | Before | After |
| --- | --- | --- |
| Home | [Before](before/home-laptop.png) | [After](after/home-laptop.png) |
| Collection | [Before](before/collection-laptop.png) | [After](after/collection-laptop.png) |
| Editor and preview | [Before](before/editor-preview-laptop.png) | [After](after/editor-preview-laptop.png) |
| Validation | [Before](before/validation-laptop.png) | [After](after/validation-laptop.png) |
| Release review | [Before](before/review-laptop.png) | [After](after/review-laptop.png) |

### 1920 × 1080

| Surface | Before | After |
| --- | --- | --- |
| Home | [Before](before/home-desktop.png) | [After](after/home-desktop.png) |
| Collection | [Before](before/collection-desktop.png) | [After](after/collection-desktop.png) |
| Editor and preview | [Before](before/editor-preview-desktop.png) | [After](after/editor-preview-desktop.png) |
| Validation | [Before](before/validation-desktop.png) | [After](after/validation-desktop.png) |
| Release review | [Before](before/review-desktop.png) | [After](after/review-desktop.png) |

### 390 × 844

| Surface | Before | After |
| --- | --- | --- |
| Home | [Before](before/home-phone.png) | [After](after/home-phone.png) |
| Collection | [Before](before/collection-phone.png) | [After](after/collection-phone.png) |
| Editor and preview | [Before](before/editor-preview-phone.png) | [After](after/editor-preview-phone.png) |
| Validation | [Before](before/validation-phone.png) | [After](after/validation-phone.png) |
| Release review | [Before](before/review-phone.png) | [After](after/review-phone.png) |

## Verification status

Check results, the nine requested journeys, timing measurements and limitations are recorded in [verification.md](verification.md). Exact measurements are in [performance.json](performance.json). Source-map comparison verified that all 51 Admin source files in the retained baseline build exactly match `d3e6f364`.

The original refinement verified 683 × 384 CSS reflow. The subsequent pipeline follow-up also verifies [actual native 200% Chromium zoom](../admin-pipelines/native-zoom/native-zoom.json) through the browser's Page zoom setting, with five captured surfaces, keyboard focus return, Axe and overflow checks. See the [current review evidence](../admin-pipelines/README.md).

## Configuration and boundaries

No migrations, database tables, runtime flags, deployment dependencies, public routing changes, or new orchestration platform are introduced. New copy travels with the existing private Home/authoring responses; ship the matching client and server together. Initial Admin, aggregate Admin and player budget values are unchanged. Home still defers catalog and workshop loading.

`client/vercel.json` disables Git-triggered deployment only for `codex/admin-refinement`, using [Vercel's branch deployment setting](https://vercel.com/docs/project-configuration/git-configuration#gitdeploymentenabled). This review is to remain a draft, unmerged and undeployed. Local fixture publish/rollback tests do not publish any production content.
