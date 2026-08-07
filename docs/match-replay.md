# Match Replay & Broadcast

Completed match replay is a projection of authoritative match record v2. The public endpoint is `GET /api/matches/:matchId/replay`, and the stable client URL is `/?match=:matchId&replay=1`.

New matches capture `gauntlet.public-replay-frame.v1` frames alongside league evidence. A frame is the exact privacy-filtered public presentation state after one accepted authoritative command. It contains public player counts, life, priority, lanes, attacks, blocks, result state, source evidence IDs, and checksums. It contains no hand cards, deck order, facedown identity, private peek result, session/reconnect token, or internal server audit state. Frames are presentation evidence only; record v2 remains canonical and the shared duel rules remain the only gameplay authority.

`ReplayMatchAdapter` exposes the update shape consumed by `ProductionMatchExperience`, but its gameplay command object and legal-action list are empty. Play, pause, step, restart, scrub, speed, and notable-moment jumps are exposed separately as replay controls.

Record-v2 matches that predate public frames remain replayable as ordered typed events. The UI labels their visual coverage as partial and never invents missing battlefield state. Corrupt ordering, duplicate evidence IDs, match-ID contradictions, unsupported versions, and checksum contradictions fail closed.

Production currently reports `account-only` match storage. Full records, evidence, and replay frames are process-local. Account consequences and compact match references survive backend replacement, but a replay cannot be recreated from those compact references after the complete record is gone.
