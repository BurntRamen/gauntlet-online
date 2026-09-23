# Match Replay & Broadcast

## Detailed public match history

Replay's **Match History** panel and **Export TXT** share `gauntlet.match-transcript.v1`, projected from the same validated record as JSON replay. Saved Match Library rows also offer Export TXT. The server equivalent is `GET /api/matches/:matchId/export/history`.

The transcript includes match mode/ranked status, rules/content versions, recorded deck format/version, participants, dates and result; each command's originating turn/phase, timestamp and evidence range; public card names/types/ranks/suits/text, payment/value receipts and modifier sources; all ordered typed effects; and public life, hand, deck, discard and lane state before/after commands. Clicking a play seeks and pauses the replay; playback highlights its current play. Compact and detailed views use identical evidence.

New duel-engine events retain their own turn/phase and public player totals at emission. A command that advances to another turn remains attributed to its originating turn while its refill/new-turn effects retain their event context. Local/offline recording captures the full accepted event list with the same sanitizers as online recording; undo removes those events and the corresponding frame. Recorded public card facts take precedence over later catalog wording.

This is a **public** history: hand identities, face-down identities, private peek results and draw order are obscured. Deck membership is not displayed as draw order. Private player-perspective histories are not captured by this public contract. Public counts are exact where recorded. Battlefield stepping still uses after-command frames; effect-level totals do not imply intermediate battlefield frames or independently measured event timestamps. Older gaps say “Not recorded”; existing archives are not rewritten.

Completed match replay is a projection of authoritative match record v2. The public endpoint is `GET /api/matches/:matchId/replay`, and the stable client URL is `/?match=:matchId&replay=1`.

New matches capture `gauntlet.public-replay-frame.v1` frames alongside league evidence. A frame is the exact privacy-filtered public presentation state after one accepted authoritative command. It contains public player counts, life, priority, lanes, attacks, blocks, result state, source evidence IDs, and checksums. It contains no hand cards, deck order, facedown identity, private peek result, session/reconnect token, or internal server audit state. Frames are presentation evidence only; record v2 remains canonical and the shared duel rules remain the only gameplay authority.

`ReplayMatchAdapter` exposes the update shape consumed by `ProductionMatchExperience`, but its gameplay command object and legal-action list are empty. Play, pause, step, restart, scrub, speed, and notable-moment jumps are exposed separately as replay controls.

The primary viewer timeline is a deterministic `gauntlet.replay-presentation-action.v1` projection. One action groups the contiguous league-evidence rows and public frame produced by a semantic command, retaining its command ID, evidence sequence range, evidence IDs, and frame-before/frame-after indexes. Record v2 and league evidence remain canonical. The action projection resolves only exact public runtime, gameplay-definition, and collector-variant IDs; it never derives a private identity or guesses from an instance-name string.

Replay discovery is available directly from replayable recent-match rows as well as Match Record and post-match results. The official Babylon battlefield occupies a reserved stage above a compact action transport, while a replay-only action layer presents public attackers, blockers, payments, attachments, values, and damage. Raw evidence remains available under secondary details, and the default public ending uses neutral participant-name language rather than player-relative victory/defeat copy.

Record-v2 matches that predate public frames remain replayable as grouped, structured typed actions. The UI labels their visual coverage as partial, keeps raw JSON behind an optional evidence disclosure, and never invents missing battlefield state. Corrupt ordering, duplicate evidence IDs, match-ID contradictions, unsupported versions, and checksum contradictions fail closed.

Production may report `account-only` server storage. Full records, evidence, and replay frames on that server can be process-local, while account consequences and compact references remain durable. The browser's local Match Library closes the player portability gap: once canonical JSON is saved or exported, Replay can reconstruct the timeline client-side after backend replacement. A compact reference by itself is still insufficient and is never expanded into fabricated evidence.
