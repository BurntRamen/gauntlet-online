# Match renderer emergency fallback

`ProductionMatchExperience` is the default active-match interface for supported two-player Basic and Faction matches. React continues to own lobby, account, matchmaking, deck-selection, and post-match navigation.

To force the temporary legacy match renderer for diagnosis, open the application with:

```text
?renderer=react
```

Deployments may also set `REACT_APP_MATCH_RENDERER=react` as an emergency build-time override. `?renderer=react` takes precedence for an individual browser session.

Babylon/WebGL initialization or runtime failure triggers the same fallback only after the client freezes renderer commands and requests the latest sanitized authoritative snapshot. Activation is logged with the `[MatchRendererFallback]` prefix and persisted only for the affected match ID to prevent a crash loop. Ordinary gameplay rejection or an unavailable action must never activate fallback.

Remove the legacy renderer and these overrides after one stabilization release in which supported matches meet the agreed renderer-failure, reconnect, privacy, and completion thresholds.
