# Admin production UI evidence

Captured from the compiled application on 7 November 2026 using isolated browser fixtures. These screenshots contain synthetic accounts/content, not production edits. Source: `e2e/admin-production.spec.js`.

- [Desktop production path and real card preview](admin-production-desktop.png): related editing steps, player destination, access boundaries and the selected card.
- [390px production workspace](admin-production-phone.png): the same path and editor stack without horizontal overflow; navigation preserves the selected card, filter and section.
- [Audited player repair on a phone](admin-production-progress-repair.png): evidence-based campaign repair, required reason, immediate-action wording and focused player tabs.

The browser tests also verify guarded departure, cancellation, resumption after refresh, mobile accessibility, website prose reaching the actual player menu and rollback, unauthorized API denials, repair audit history and refusal to apply an already-complete repair.
