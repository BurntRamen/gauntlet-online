# Admin production read pressure

PR #106 passed final-head CI at `fdcd657d` and was merged as `7304455`. Both commits have tree `9ffc9de1d7e34b1a3e2a630cf10cd307a94c3269`. Vercel production succeeded. The first Render deployment reached live, but authenticated verification exposed a 512 MiB out-of-memory restart; earlier service history contains the same failure class.

The existing Render service now starts the same application with:

```sh
node --max-old-space-size=256 --max-semi-space-size=8 index.js
```

The hosting plan, application feature flags, storage providers and database schema are unchanged. Eight synthetic rounds of four simultaneous full authoring reads peaked at 845 MiB with default local Node settings and 366 MiB with the bounded settings on the exact production Node version, 22.23.4. All 34 selected publication, Home and modular-engine regressions passed with those settings. Live catalog, private storage, existing-card editing, player preview and publication review then succeeded. No production content was edited or published.

A repeated Home read still exposed an intermittent health-read failure. Home independently requested full authoring state for its release panel, module capabilities and system catalog. Each full projection includes roughly 12 MB of editor metadata. Building those projections repeatedly also delays unrelated requests on the small production instance.

This follow-up shares one fresh authoring read within each Home request. Internal overview consumers use a compact projection that preserves the authoritative live/draft content, revision, validation, changes, publication state and privacy checks, while leaving field descriptions and asset-picker metadata to the unchanged editor response. There is no cross-request cache; failure and retry remain explicit. Existing HTTP response contracts and release gates are retained.

An isolated comparison on Node 22.23.4 with the deployed memory bounds made three sequential Home requests using synthetic source content:

| Measurement | Previous read path | Updated read path |
| --- | ---: | ---: |
| Full authoring projections | 9 | 0 |
| Compact projections | 0 | 3 |
| Request durations | 3,312 / 3,068 / 2,874 ms | 1,034 / 782 / 837 ms |
| Peak process memory | 150 MiB | 131 MiB |

These local measurements are not production timing guarantees. The initial live Home load after the memory configuration took about 30 seconds; production timing and service health must be checked again after this follow-up is deployed.

Focused verification passed 11 tests covering shared read pressure, fresh retries, compact/full response equivalence, draft hashes and revision identity, private-store failure, missing credentials, authorization, catalog, player and historical match behavior. Complete hosted CI remains the merge gate. The follow-up branch is excluded from Vercel Git deployments until verified and merged.
