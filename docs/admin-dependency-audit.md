# Dependency security disposition — connected Admin suite

## Security remediation — 14 October 2026

The actual replacement client lockfile reports **zero critical, high, moderate or low findings**, including development dependencies. Root and server are audited independently. The earlier 99-package client result below is retained as historical evidence, not the current disposition.

Removed `react-scripts` and its obsolete compiler/dev-server/test graph. The client now declares Webpack 5, Babel 7, Jest 30/jsdom, ESLint 9 and PostCSS tools directly, with reviewed configuration in `client/config` and `client/scripts`. React, browser targets, public URLs, source maps, static assets, named lazy chunks, CSS extraction and WebGL pruning are retained. The Vercel file explicitly selects locked installation and the existing static build output. Render configuration and production content are unchanged. ESLint 9 remains pinned for the React plugin's supported peer range; npm reports its deprecation, along with transitive glob/encoding deprecations, but the audited lock has no reported vulnerabilities. Future lint-major upgrades must verify plugin compatibility.

There is one narrow override: `@istanbuljs/load-nyc-config` uses `js-yaml` 5.4.3 instead of its obsolete 3.x parser, removing `argparse` 1 / `sprintf-js`. Inspection confirmed that the parent calls only `load`; executable regression checks exercise YAML inheritance, arrays, option names, malformed YAML and rejection of JavaScript tags. Remove this override when the parent adopts a patched parser. This is a dependency replacement, not an advisory suppression. No audit threshold was lowered and no `--force` upgrade was used.

The replacement development server binds only to loopback, validates Host/Origin, rejects traversal and hidden files, restricts methods and serves only compiled output. It uses Webpack watch with manual browser refresh; it does not retain the old dev server's proxy/TLS/HMR features. Environment loading preserves precedence and exposes only public-prefixed values plus NODE_ENV/PUBLIC_URL. Tests check that service credentials do not enter browser configuration.

Initial integration verification: all **99 client suites / 738 tests** pass; **4 toolchain security/compatibility tests** pass; the production build succeeds. Measured gzip: main **172.7 KiB**, player **712.6 KiB**, initial Admin **17.5 KiB**, total Admin **55.9 KiB**, largest async **274.2 KiB**. All existing ceilings remain unchanged. Raw results and subsequent clean-install/browser verification are in `artifacts/security/`; release readiness still requires the complete CI/browser results and Case's separate migration.

Main `e1ef70a` was subsequently integrated to preserve the concurrent Para League/Gold release. Its normal four-pass compression and stricter shared-Economy accounting are retained in the replacement toolchain. Navigation, references and review share a small Admin chunk to avoid duplicated overhead. The combined strict CI build passes: main 168.4 KiB, player 716.5, initial Admin 17.6, total Admin 60.9 and largest async 274.2. No dependency lockfile or budget ceiling changed during that merge; full combined regression results are tracked in release PR #72.

## Historical audit before toolchain remediation

Audited 12 October 2026 against the root, server and client npm lockfiles, before and after compatible updates. Raw audit JSON, original lockfiles, update logs and npm explain output are in `artifacts/printings/`. No forced upgrade, override or advisory suppression was applied. Counts are npm affected-package totals (including propagated findings), not counts of distinct exploitable vulnerabilities.

| Lockfile | Before critical/high/moderate/low | After critical/high/moderate/low | Result |
|---|---|---|---|
| package-lock.json (root) | 0/1/0/0 | 0/0/0/0 | No reported advisories after update |
| server/package-lock.json | 1/4/2/1 | 0/0/0/0 | No reported advisories after update |
| client/package-lock.json | 3/78/18/4 | 0/63/33/3 | BLOCKED for production readiness |

## Exposure and remediation decisions

The critical `proxy-addr` advisory GHSA-jqcg-44mw-7w3h was fixed to 2.0.8 in server and CRA dev-server paths. The application uses one-hop `trust proxy` and `req.ip` for rate limiting. The malformed mapped-IPv6 CIDR example is not the configured trust rule, but real deployment routing has not been verified; it is not treated as unreachable. A regression checks the advisory subnet and normal IPv4 trust behavior. Other critical client findings (`shell-quote` and `websocket-driver`) were cleared by compatible updates.

Root Sharp is now exactly 0.35.5, matching the upload decoder. Root scripts process artwork/SVG; the authenticated server upload path accepts only decoded PNG/JPEG/WebP, never SVG. Both contexts matter. The librsvg finding GHSA-wq5f-xc86-pv6w is cleared in both lockfiles. Express/Socket.IO public JSON/WebSocket paths received compatible updates to their parser, address and transport dependencies; HTTP/auth/socket and upload regressions accompany the full suite.

Client leaf and compatible parent updates leave 13 directly advised packages, propagated to 99 package findings. CRA 5 constrains several old major versions. `npm audit fix --force` proposes react-scripts 0.0.0 for many findings; removing working build tooling is not a remediation. Remaining serialisation code injection, source-map file reads, SVG sanitisation, dev-server cross-origin exposure and denial-of-service findings are material **production-readiness blockers**, including the release build supply chain. Do not expose the CRA development server to untrusted networks. Local browser verification uses the compiled build and loopback fixture server. This reduces that run’s exposure; it is not an audit exemption.

The next security work is a controlled build/test toolchain migration (or individually reviewed upstream backports), followed by clean-install, full regression, bundle and audit verification. Exact exploitability against every plugin option and CI trust boundary has not been proven or disproven. The GitHub CI workflow installs locked dependencies and runs compiler/test code; untrusted source or asset processing can reach vulnerable tools. No external service or production audit was performed.

## Remaining underlying advisories

### @tootallnate/once

Severity: low. Context: CRA Jest/jsdom/ESLint or build utility; executes on developer/CI host.

- Installed: `node_modules/@tootallnate/once` @ 1.1.2. Dependency path: client@ → react-scripts@5.0.1 → jest-watch-typeahead@1.1.0 → jest@27.5.1 → jest-cli@27.5.1 → jest-config@27.5.1 → jest-environment-jsdom@27.5.1 → jsdom@16.7.0 → http-proxy-agent@4.0.1 → @tootallnate/once@1.1.2.

- [GHSA-vpq2-c234-7xj6](https://github.com/advisories/GHSA-vpq2-c234-7xj6): @tootallnate/once vulnerable to Incorrect Control Flow Scoping; affected range `<2.0.1`.

Disposition: remains in locked compatible dependency graph. Requires an upstream compatible fix or reviewed parent/toolchain migration; not suppressed. Exposure is potential, not a claim of demonstrated exploitation.

### braces

Severity: high. Context: CRA compiler, CSS/SVG optimizer, globbing or worker serialization; executes in build/CI.

- Installed: `node_modules/braces` @ 3.0.3. Dependency path: client@ → react-scripts@5.0.1 → react-dev-utils@12.0.1 → fork-ts-checker-webpack-plugin@6.5.3 → chokidar@3.6.0 → braces@3.0.3.

- [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm): braces vulnerable to stack-exhaustion denial of service through deeply nested patterns; affected range `<=3.0.3`.

Disposition: remains in locked compatible dependency graph. Requires an upstream compatible fix or reviewed parent/toolchain migration; not suppressed. Exposure is potential, not a claim of demonstrated exploitation.

### node-forge

Severity: high. Context: Development HTTP server, proxy or local TLS. Public production server audited separately.

- Installed: `node_modules/node-forge` @ 1.4.0. Dependency path: client@ → react-scripts@5.0.1 → webpack-dev-server@4.15.2 → selfsigned@2.4.1 → node-forge@1.4.0.

- [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv): node-forge RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements; affected range `<=1.4.0`.

Disposition: remains in locked compatible dependency graph. Requires an upstream compatible fix or reviewed parent/toolchain migration; not suppressed. Exposure is potential, not a claim of demonstrated exploitation.

### nth-check

Severity: high. Context: CRA compiler, CSS/SVG optimizer, globbing or worker serialization; executes in build/CI.

- Installed: `node_modules/svgo/node_modules/nth-check` @ 1.0.2. Dependency path: client@ → react-scripts@5.0.1 → @svgr/webpack@5.5.0 → @svgr/plugin-svgo@5.5.0 → svgo@1.3.2 → css-select@2.1.0 → nth-check@1.0.2.

- [GHSA-rp65-9cf3-cjxr](https://github.com/advisories/GHSA-rp65-9cf3-cjxr): Inefficient Regular Expression Complexity in nth-check; affected range `<2.0.1`.

Disposition: remains in locked compatible dependency graph. Requires an upstream compatible fix or reviewed parent/toolchain migration; not suppressed. Exposure is potential, not a claim of demonstrated exploitation.

### postcss

Severity: high. Context: CRA compiler, CSS/SVG optimizer, globbing or worker serialization; executes in build/CI.

- Installed: `node_modules/resolve-url-loader/node_modules/postcss` @ 7.0.39. Dependency path: client@ → react-scripts@5.0.1 → resolve-url-loader@4.0.0 → postcss@7.0.39.

- [GHSA-7fh5-64p2-3v2j](https://github.com/advisories/GHSA-7fh5-64p2-3v2j): PostCSS line return parsing error; affected range `<8.4.31`.
- [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93): PostCSS has XSS via Unescaped </style> in its CSS Stringify Output; affected range `<8.5.10`.
- [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q): PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments; affected range `<=8.5.11`.
- [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp): PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset; affected range `<=8.5.22`.
- [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849): PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure; affected range `<=8.5.17`.

Disposition: remains in locked compatible dependency graph. Requires an upstream compatible fix or reviewed parent/toolchain migration; not suppressed. Exposure is potential, not a claim of demonstrated exploitation.

### postcss-selector-parser

Severity: moderate. Context: CRA compiler, CSS/SVG optimizer, globbing or worker serialization; executes in build/CI.

- Installed: `node_modules/postcss-selector-parser` @ 6.1.4. Dependency path: client@ → react-scripts@5.0.1 → postcss-preset-env@7.8.3 → css-blank-pseudo@3.0.3 → postcss-selector-parser@6.1.4.

- [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf): PostCSS: Quadratic complexity in flat selector parsing allows CPU exhaustion; affected range `<7.1.6`.

Disposition: remains in locked compatible dependency graph. Requires an upstream compatible fix or reviewed parent/toolchain migration; not suppressed. Exposure is potential, not a claim of demonstrated exploitation.

### serialize-javascript

Severity: high. Context: CRA compiler, CSS/SVG optimizer, globbing or worker serialization; executes in build/CI.

- Installed: `node_modules/rollup-plugin-terser/node_modules/serialize-javascript` @ 4.0.0. Dependency path: client@ → react-scripts@5.0.1 → workbox-webpack-plugin@6.6.0 → workbox-build@6.6.0 → rollup-plugin-terser@7.0.2 → serialize-javascript@4.0.0.
- Installed: `node_modules/serialize-javascript` @ 6.0.2. Dependency path: client@ → react-scripts@5.0.1 → css-minimizer-webpack-plugin@3.4.1 → serialize-javascript@6.0.2.

- [GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq): Serialize JavaScript is Vulnerable to RCE via RegExp.flags and Date.prototype.toISOString(); affected range `<=7.0.2`.
- [GHSA-qj8w-gfj5-8c6v](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v): Serialize JavaScript has CPU Exhaustion Denial of Service via crafted array-like objects; affected range `>=5.0.0 <7.0.5`.

Disposition: remains in locked compatible dependency graph. Requires an upstream compatible fix or reviewed parent/toolchain migration; not suppressed. Exposure is potential, not a claim of demonstrated exploitation.

### sprintf-js

Severity: moderate. Context: CRA Jest/jsdom/ESLint or build utility; executes on developer/CI host.

- Installed: `node_modules/sprintf-js` @ 1.0.3. Dependency path: client@ → react-scripts@5.0.1 → @svgr/webpack@5.5.0 → @svgr/plugin-svgo@5.5.0 → svgo@1.3.2 → js-yaml@3.15.2 → argparse@1.0.10 → sprintf-js@1.0.3.

- [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c): sprintf-js vulnerable to denial of service through unbounded precision specifiers; affected range `<=1.1.3`.

Disposition: remains in locked compatible dependency graph. Requires an upstream compatible fix or reviewed parent/toolchain migration; not suppressed. Exposure is potential, not a claim of demonstrated exploitation.

### svgo

Severity: high. Context: CRA compiler, CSS/SVG optimizer, globbing or worker serialization; executes in build/CI.

- Installed: `node_modules/svgo` @ 1.3.2. Dependency path: client@ → react-scripts@5.0.1 → @svgr/webpack@5.5.0 → @svgr/plugin-svgo@5.5.0 → svgo@1.3.2.

- [GHSA-2p49-hgcm-8545](https://github.com/advisories/GHSA-2p49-hgcm-8545): SVGO removeScripts plugin leaves some executable scripts intact; affected range `>=1.0.0 <2.8.3`.
- [GHSA-w27v-7q3p-w38r](https://github.com/advisories/GHSA-w27v-7q3p-w38r): SVGO: removeScripts allows executable links through namespace and control-character bypasses; affected range `>=1.0.0 <2.8.4`.
- [GHSA-4vpr-x523-8j87](https://github.com/advisories/GHSA-4vpr-x523-8j87): SVGO: removeScripts incompletely sanitizes executable HTML in SVG foreignObject elements; affected range `>=1.0.0 <2.8.4`.

Disposition: remains in locked compatible dependency graph. Requires an upstream compatible fix or reviewed parent/toolchain migration; not suppressed. Exposure is potential, not a claim of demonstrated exploitation.

### underscore

Severity: high. Context: CRA Jest/jsdom/ESLint or build utility; executes on developer/CI host.

- Installed: `node_modules/underscore` @ 1.13.6. Dependency path: client@ → react-scripts@5.0.1 → bfj@7.1.0 → jsonpath@1.3.0 → underscore@1.13.6.

- [GHSA-qpx9-hpmf-5gmw](https://github.com/advisories/GHSA-qpx9-hpmf-5gmw): Underscore has unlimited recursion in _.flatten and _.isEqual, potential for DoS attack; affected range `<=1.13.7`.

Disposition: remains in locked compatible dependency graph. Requires an upstream compatible fix or reviewed parent/toolchain migration; not suppressed. Exposure is potential, not a claim of demonstrated exploitation.

### uuid

Severity: moderate. Context: CRA Jest/jsdom/ESLint or build utility; executes on developer/CI host.

- Installed: `node_modules/uuid` @ 8.3.2. Dependency path: client@ → react-scripts@5.0.1 → webpack-dev-server@4.15.2 → sockjs@0.3.24 → uuid@8.3.2.

- [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq): uuid: Missing buffer bounds check in v3/v5/v6 when buf is provided; affected range `<11.1.1`.

Disposition: remains in locked compatible dependency graph. Requires an upstream compatible fix or reviewed parent/toolchain migration; not suppressed. Exposure is potential, not a claim of demonstrated exploitation.

### webpack-dev-middleware

Severity: high. Context: Development HTTP server, proxy or local TLS. Public production server audited separately.

- Installed: `node_modules/webpack-dev-middleware` @ 5.3.4. Dependency path: client@ → react-scripts@5.0.1 → webpack-dev-server@4.15.2 → webpack-dev-middleware@5.3.4.

- [GHSA-g84c-rxfj-3j2c](https://github.com/advisories/GHSA-g84c-rxfj-3j2c): webpack-dev-middleware vulnerable to Path Traversal via non-slash-terminated publicPath; affected range `<7.4.5`.

Disposition: remains in locked compatible dependency graph. Requires an upstream compatible fix or reviewed parent/toolchain migration; not suppressed. Exposure is potential, not a claim of demonstrated exploitation.

### webpack-dev-server

Severity: high. Context: Development HTTP server, proxy or local TLS. Public production server audited separately.

- Installed: `node_modules/webpack-dev-server` @ 4.15.2. Dependency path: client@ → react-scripts@5.0.1 → webpack-dev-server@4.15.2.

- [GHSA-9jgg-88mc-972h](https://github.com/advisories/GHSA-9jgg-88mc-972h): webpack-dev-server users' source code may be stolen when they access a malicious web site with non-Chromium based browser; affected range `<=5.2.0`.
- [GHSA-4v9v-hfq4-rm2v](https://github.com/advisories/GHSA-4v9v-hfq4-rm2v): webpack-dev-server users' source code may be stolen when they access a malicious web site; affected range `<=5.2.0`.
- [GHSA-79cf-xcqc-c78w](https://github.com/advisories/GHSA-79cf-xcqc-c78w): webpack-dev-server vulnerable to cross-origin source code exposure on non-HTTPS origins; affected range `<=5.2.3`.
- [GHSA-mx8g-39q3-5c79](https://github.com/advisories/GHSA-mx8g-39q3-5c79): webpack-dev-server vulnerable to HMR WebSocket interception via permissive user proxies; affected range `<5.2.5`.
- [GHSA-f5vj-f2hx-8m93](https://github.com/advisories/GHSA-f5vj-f2hx-8m93): webpack-dev-server vulnerable to cross-site request forgery via internal developer endpoints; affected range `<=5.2.5`.
- [GHSA-m28w-2pqf-7qgj](https://github.com/advisories/GHSA-m28w-2pqf-7qgj): webpack-dev-server vulnerable to denial of service via a malformed Host or Origin header; affected range `<=5.2.5`.

Disposition: remains in locked compatible dependency graph. Requires an upstream compatible fix or reviewed parent/toolchain migration; not suppressed. Exposure is potential, not a claim of demonstrated exploitation.

## Complete reported-package ledger

Each directly reported advisory is linked below. Wrapper entries inherit the listed dependency findings; their execution context follows those dependencies. Installed paths are relative to the named project. Before and final versions are exact lockfile values. A removed entry has no final occurrence at that path.

### root

| Package / installed path | Before → final version | Advisory / inherited path | Disposition |
|---|---|---|---|
| sharp: `node_modules/sharp` | 0.35.4 → 0.35.5 | [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w) | Cleared by compatible locked update; regressions required |
### server

| Package / installed path | Before → final version | Advisory / inherited path | Disposition |
|---|---|---|---|
| body-parser: `node_modules/body-parser` | 2.2.2 → 2.3.0 | [GHSA-v422-hmwv-36x6](https://github.com/advisories/GHSA-v422-hmwv-36x6) | Cleared by compatible locked update; regressions required |
| engine.io: `node_modules/engine.io` | 6.6.5 → 6.6.11 | [GHSA-r635-g3xr-vw7x](https://github.com/advisories/GHSA-r635-g3xr-vw7x), [GHSA-gr94-w7qr-f4j3](https://github.com/advisories/GHSA-gr94-w7qr-f4j3), [GHSA-2gc4-cqfq-p2gv](https://github.com/advisories/GHSA-2gc4-cqfq-p2gv), ws | Cleared by compatible locked update; regressions required |
| path-to-regexp: `node_modules/path-to-regexp` | 8.3.0 → 8.4.2 | [GHSA-j3q9-mxjg-w52f](https://github.com/advisories/GHSA-j3q9-mxjg-w52f), [GHSA-27v5-c462-wpq7](https://github.com/advisories/GHSA-27v5-c462-wpq7) | Cleared by compatible locked update; regressions required |
| proxy-addr: `node_modules/proxy-addr` | 2.0.7 → 2.0.8 | [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) | Cleared by compatible locked update; regressions required |
| qs: `node_modules/qs` | 6.14.1 → 6.16.0 | [GHSA-w7fw-mjwx-w883](https://github.com/advisories/GHSA-w7fw-mjwx-w883), [GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26), [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) | Cleared by compatible locked update; regressions required |
| socket.io-adapter: `node_modules/socket.io-adapter` | 2.5.6 → 2.5.8 | ws | Cleared by compatible locked update; regressions required |
| socket.io-parser: `node_modules/socket.io-parser` | 4.2.5 → 4.2.7 | [GHSA-677m-j7p3-52f9](https://github.com/advisories/GHSA-677m-j7p3-52f9), [GHSA-2m8v-j782-fhvr](https://github.com/advisories/GHSA-2m8v-j782-fhvr) | Cleared by compatible locked update; regressions required |
| ws: `node_modules/ws` | 8.18.3 → 8.21.3 | [GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx), [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) | Cleared by compatible locked update; regressions required |
### client

| Package / installed path | Before → final version | Advisory / inherited path | Disposition |
|---|---|---|---|
| @babel/core: `node_modules/@babel/core` | 7.28.6 → 7.29.7 | [GHSA-4x5r-pxfx-6jf8](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8) | Cleared by compatible locked update; regressions required |
| @babel/plugin-transform-modules-systemjs: `node_modules/@babel/plugin-transform-modules-systemjs` | 7.28.5 → 7.29.8 | [GHSA-fv7c-fp4j-7gwp](https://github.com/advisories/GHSA-fv7c-fp4j-7gwp) | Cleared by compatible locked update; regressions required |
| @csstools/postcss-cascade-layers: `node_modules/@csstools/postcss-cascade-layers` | 1.1.1 → 1.1.1 | @csstools/selector-specificity, postcss-selector-parser | Open; client context and migration above |
| @csstools/postcss-is-pseudo-class: `node_modules/@csstools/postcss-is-pseudo-class` | 2.0.7 → 2.0.7 | @csstools/selector-specificity, postcss-selector-parser | Open; client context and migration above |
| @csstools/selector-specificity: `node_modules/@csstools/selector-specificity` | 2.2.0 → 2.2.0 | postcss-selector-parser | Open; client context and migration above |
| @istanbuljs/load-nyc-config: `node_modules/@istanbuljs/load-nyc-config` | 1.1.0 → 1.1.0 | js-yaml | Open; client context and migration above |
| @jest/console: `node_modules/@jest/console` | 27.5.1 → 27.5.1 | jest-message-util | Open; client context and migration above |
| @jest/console: `node_modules/jest-watch-typeahead/node_modules/@jest/console` | 28.1.3 → 28.1.3 | jest-message-util | Open; client context and migration above |
| @jest/core: `node_modules/@jest/core` | 27.5.1 → 27.5.1 | @jest/console, @jest/reporters, @jest/test-result, @jest/transform, jest-config, jest-haste-map, jest-message-util, jest-resolve, jest-resolve-dependencies, jest-runner, jest-runtime, jest-snapshot, jest-watcher, micromatch | Open; client context and migration above |
| @jest/environment: `node_modules/@jest/environment` | 27.5.1 → 27.5.1 | @jest/fake-timers | Open; client context and migration above |
| @jest/fake-timers: `node_modules/@jest/fake-timers` | 27.5.1 → 27.5.1 | jest-message-util | Open; client context and migration above |
| @jest/globals: `node_modules/@jest/globals` | 27.5.1 → 27.5.1 | @jest/environment, expect | Open; client context and migration above |
| @jest/reporters: `node_modules/@jest/reporters` | 27.5.1 → 27.5.1 | @jest/console, @jest/test-result, @jest/transform, jest-haste-map, jest-resolve | Open; client context and migration above |
| @jest/test-result: `node_modules/@jest/test-result` | 27.5.1 → 27.5.1 | @jest/console | Open; client context and migration above |
| @jest/test-result: `node_modules/jest-watch-typeahead/node_modules/@jest/test-result` | 28.1.3 → 28.1.3 | @jest/console | Open; client context and migration above |
| @jest/test-sequencer: `node_modules/@jest/test-sequencer` | 27.5.1 → 27.5.1 | @jest/test-result, jest-haste-map, jest-runtime | Open; client context and migration above |
| @jest/transform: `node_modules/@jest/transform` | 27.5.1 → 27.5.1 | jest-haste-map, micromatch, babel-plugin-istanbul | Open; client context and migration above |
| @svgr/plugin-svgo: `node_modules/@svgr/plugin-svgo` | 5.5.0 → 5.5.0 | svgo | Open; client context and migration above |
| @svgr/webpack: `node_modules/@svgr/webpack` | 5.5.0 → 5.5.0 | @svgr/plugin-svgo | Open; client context and migration above |
| @tootallnate/once: `node_modules/@tootallnate/once` | 1.1.2 → 1.1.2 | [GHSA-vpq2-c234-7xj6](https://github.com/advisories/GHSA-vpq2-c234-7xj6) | Open; client context and migration above |
| @typescript-eslint/eslint-plugin: `node_modules/@typescript-eslint/eslint-plugin` | 5.62.0 → 5.62.0 | @typescript-eslint/parser, @typescript-eslint/type-utils, @typescript-eslint/utils | Open; client context and migration above |
| @typescript-eslint/experimental-utils: `node_modules/@typescript-eslint/experimental-utils` | 5.62.0 → 5.62.0 | @typescript-eslint/utils | Open; client context and migration above |
| @typescript-eslint/parser: `node_modules/@typescript-eslint/parser` | 5.62.0 → 5.62.0 | @typescript-eslint/typescript-estree | Open; client context and migration above |
| @typescript-eslint/type-utils: `node_modules/@typescript-eslint/type-utils` | 5.62.0 → 5.62.0 | @typescript-eslint/typescript-estree, @typescript-eslint/utils | Open; client context and migration above |
| @typescript-eslint/typescript-estree: `node_modules/@typescript-eslint/typescript-estree` | 5.62.0 → 5.62.0 | globby | Open; client context and migration above |
| @typescript-eslint/utils: `node_modules/@typescript-eslint/utils` | 5.62.0 → 5.62.0 | @typescript-eslint/typescript-estree | Open; client context and migration above |
| ajv: `node_modules/ajv` | 6.12.6 → 6.15.0 | [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) | Cleared by compatible locked update; regressions required |
| ajv: `node_modules/ajv-formats/node_modules/ajv` | 8.17.1 → 8.20.0 | [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) | Cleared by compatible locked update; regressions required |
| ajv: `node_modules/schema-utils/node_modules/ajv` | 8.17.1 → 8.20.0 | [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) | Cleared by compatible locked update; regressions required |
| ajv: `node_modules/workbox-build/node_modules/ajv` | 8.17.1 → 8.20.0 | [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) | Cleared by compatible locked update; regressions required |
| argparse: `node_modules/argparse` | 1.0.10 → 1.0.10 | sprintf-js | Open; client context and migration above |
| babel-jest: `node_modules/babel-jest` | 27.5.1 → 27.5.1 | @jest/transform, babel-plugin-istanbul | Open; client context and migration above |
| babel-plugin-istanbul: `node_modules/babel-plugin-istanbul` | 6.1.1 → 6.1.1 | @istanbuljs/load-nyc-config | Open; client context and migration above |
| baseline-browser-mapping: `node_modules/baseline-browser-mapping` | 2.9.19 → 2.11.28 | [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) | Cleared by compatible locked update; regressions required |
| bfj: `node_modules/bfj` | 7.1.0 → 7.1.0 | jsonpath | Open; client context and migration above |
| body-parser: `node_modules/body-parser` | 1.20.4 → 1.20.8 | [GHSA-v422-hmwv-36x6](https://github.com/advisories/GHSA-v422-hmwv-36x6), qs | Cleared by compatible locked update; regressions required |
| brace-expansion: `node_modules/brace-expansion` | 1.1.12 → 1.1.21 | [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v), [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp), [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg), [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895), [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr), [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | Cleared by compatible locked update; regressions required |
| brace-expansion: `node_modules/filelist/node_modules/brace-expansion` | 2.0.2 → 2.1.7 | [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v), [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp), [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg), [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895), [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr), [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7), [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | Cleared by compatible locked update; regressions required |
| braces: `node_modules/braces` | 3.0.3 → 3.0.3 | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Open; client context and migration above |
| browserslist: `node_modules/browserslist` | 4.28.1 → 4.29.3 | [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx), [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) | Cleared by compatible locked update; regressions required |
| chokidar: `node_modules/chokidar` | 3.6.0 → 3.6.0 | braces | Open; client context and migration above |
| colord: `node_modules/colord` | 2.9.3 → 2.10.0 | [GHSA-2wm5-q62r-hmrv](https://github.com/advisories/GHSA-2wm5-q62r-hmrv) | Cleared by compatible locked update; regressions required |
| compression: `node_modules/compression` | 1.8.1 → 1.8.2 | [GHSA-vc2v-76pw-4v95](https://github.com/advisories/GHSA-vc2v-76pw-4v95) | Cleared by compatible locked update; regressions required |
| css-blank-pseudo: `node_modules/css-blank-pseudo` | 3.0.3 → 3.0.3 | postcss-selector-parser | Open; client context and migration above |
| css-has-pseudo: `node_modules/css-has-pseudo` | 3.0.4 → 3.0.4 | postcss-selector-parser | Open; client context and migration above |
| css-minimizer-webpack-plugin: `node_modules/css-minimizer-webpack-plugin` | 3.4.1 → 3.4.1 | serialize-javascript, cssnano | Open; client context and migration above |
| css-select: `node_modules/svgo/node_modules/css-select` | 2.1.0 → 2.1.0 | nth-check | Open; client context and migration above |
| cssnano: `node_modules/cssnano` | 5.1.15 → 5.1.15 | cssnano-preset-default | Open; client context and migration above |
| cssnano-preset-default: `node_modules/cssnano-preset-default` | 5.2.14 → 5.2.14 | postcss-calc, postcss-merge-longhand, postcss-merge-rules, postcss-minify-selectors, postcss-unique-selectors | Open; client context and migration above |
| engine.io-client: `node_modules/engine.io-client` | 6.6.4 → 6.6.7 | ws | Cleared by compatible locked update; regressions required |
| eslint-config-react-app: `node_modules/eslint-config-react-app` | 7.0.1 → 7.0.1 | @typescript-eslint/parser | Open; client context and migration above |
| eslint-plugin-testing-library: `node_modules/eslint-plugin-testing-library` | 5.11.1 → 5.11.1 | @typescript-eslint/utils | Open; client context and migration above |
| eslint-webpack-plugin: `node_modules/eslint-webpack-plugin` | 3.2.0 → 3.2.0 | micromatch | Open; client context and migration above |
| expect: `node_modules/expect` | 27.5.1 → 27.5.1 | jest-message-util | Open; client context and migration above |
| express: `node_modules/express` | 4.22.1 → 4.22.3 | qs | Cleared by compatible locked update; regressions required |
| fast-glob: `node_modules/fast-glob` | 3.3.3 → 3.3.3 | micromatch | Open; client context and migration above |
| fast-uri: `node_modules/fast-uri` | 3.1.0 → 3.1.8 | [GHSA-v2hh-gcrm-f6hx](https://github.com/advisories/GHSA-v2hh-gcrm-f6hx), [GHSA-7p8r-x3mc-p8w7](https://github.com/advisories/GHSA-7p8r-x3mc-p8w7), [GHSA-q3j6-qgpj-74h6](https://github.com/advisories/GHSA-q3j6-qgpj-74h6), [GHSA-v39h-62p7-jpjc](https://github.com/advisories/GHSA-v39h-62p7-jpjc), [GHSA-f65p-4m7j-42xc](https://github.com/advisories/GHSA-f65p-4m7j-42xc), [GHSA-jqff-g426-hqxp](https://github.com/advisories/GHSA-jqff-g426-hqxp), [GHSA-4c8g-83qw-93j6](https://github.com/advisories/GHSA-4c8g-83qw-93j6), [GHSA-qw65-cvwx-89v3](https://github.com/advisories/GHSA-qw65-cvwx-89v3), [GHSA-hrr3-gc8f-f4qj](https://github.com/advisories/GHSA-hrr3-gc8f-f4qj) | Cleared by compatible locked update; regressions required |
| flatted: `node_modules/flatted` | 3.3.3 → 3.4.4 | [GHSA-25h7-pfq9-p65f](https://github.com/advisories/GHSA-25h7-pfq9-p65f), [GHSA-rf6f-7fwh-wjgh](https://github.com/advisories/GHSA-rf6f-7fwh-wjgh) | Cleared by compatible locked update; regressions required |
| follow-redirects: `node_modules/follow-redirects` | 1.15.11 → 1.16.1 | [GHSA-r4q5-vmmm-2653](https://github.com/advisories/GHSA-r4q5-vmmm-2653) | Cleared by compatible locked update; regressions required |
| fork-ts-checker-webpack-plugin: `node_modules/fork-ts-checker-webpack-plugin` | 6.5.3 → 6.5.3 | chokidar | Open; client context and migration above |
| form-data: `node_modules/form-data` | 3.0.4 → 3.0.5 | [GHSA-hmw2-7cc7-3qxx](https://github.com/advisories/GHSA-hmw2-7cc7-3qxx) | Cleared by compatible locked update; regressions required |
| globby: `node_modules/globby` | 11.1.0 → 11.1.0 | fast-glob | Open; client context and migration above |
| http-proxy-agent: `node_modules/http-proxy-agent` | 4.0.1 → 4.0.1 | @tootallnate/once | Open; client context and migration above |
| http-proxy-middleware: `node_modules/http-proxy-middleware` | 2.0.9 → 2.0.10 | [GHSA-64mm-vxmg-q3vj](https://github.com/advisories/GHSA-64mm-vxmg-q3vj), micromatch | Open; client context and migration above |
| jest: `node_modules/jest` | 27.5.1 → 27.5.1 | @jest/core, jest-cli | Open; client context and migration above |
| jest-circus: `node_modules/jest-circus` | 27.5.1 → 27.5.1 | @jest/environment, @jest/test-result, expect, jest-message-util, jest-runtime, jest-snapshot | Open; client context and migration above |
| jest-cli: `node_modules/jest-cli` | 27.5.1 → 27.5.1 | @jest/core, @jest/test-result, jest-config | Open; client context and migration above |
| jest-config: `node_modules/jest-config` | 27.5.1 → 27.5.1 | @jest/test-sequencer, babel-jest, jest-circus, jest-environment-jsdom, jest-environment-node, jest-jasmine2, jest-resolve, jest-runner, micromatch | Open; client context and migration above |
| jest-environment-jsdom: `node_modules/jest-environment-jsdom` | 27.5.1 → 27.5.1 | @jest/environment, @jest/fake-timers, jsdom | Open; client context and migration above |
| jest-environment-node: `node_modules/jest-environment-node` | 27.5.1 → 27.5.1 | @jest/environment, @jest/fake-timers | Open; client context and migration above |
| jest-haste-map: `node_modules/jest-haste-map` | 27.5.1 → 27.5.1 | micromatch | Open; client context and migration above |
| jest-jasmine2: `node_modules/jest-jasmine2` | 27.5.1 → 27.5.1 | @jest/environment, @jest/test-result, expect, jest-message-util, jest-runtime, jest-snapshot | Open; client context and migration above |
| jest-message-util: `node_modules/jest-message-util` | 27.5.1 → 27.5.1 | micromatch | Open; client context and migration above |
| jest-message-util: `node_modules/jest-watch-typeahead/node_modules/jest-message-util` | 28.1.3 → 28.1.3 | micromatch | Open; client context and migration above |
| jest-resolve: `node_modules/jest-resolve` | 27.5.1 → 27.5.1 | jest-haste-map | Open; client context and migration above |
| jest-resolve-dependencies: `node_modules/jest-resolve-dependencies` | 27.5.1 → 27.5.1 | jest-snapshot | Open; client context and migration above |
| jest-runner: `node_modules/jest-runner` | 27.5.1 → 27.5.1 | @jest/console, @jest/environment, @jest/test-result, @jest/transform, jest-environment-jsdom, jest-environment-node, jest-haste-map, jest-message-util, jest-resolve, jest-runtime | Open; client context and migration above |
| jest-runtime: `node_modules/jest-runtime` | 27.5.1 → 27.5.1 | @jest/environment, @jest/fake-timers, @jest/globals, @jest/test-result, @jest/transform, jest-haste-map, jest-message-util, jest-resolve, jest-snapshot | Open; client context and migration above |
| jest-snapshot: `node_modules/jest-snapshot` | 27.5.1 → 27.5.1 | @jest/transform, expect, jest-haste-map, jest-message-util | Open; client context and migration above |
| jest-watch-typeahead: `node_modules/jest-watch-typeahead` | 1.1.0 → 1.1.0 | jest, jest-watcher | Open; client context and migration above |
| jest-watcher: `node_modules/jest-watch-typeahead/node_modules/jest-watcher` | 28.1.3 → 28.1.3 | @jest/test-result | Open; client context and migration above |
| jest-watcher: `node_modules/jest-watcher` | 27.5.1 → 27.5.1 | @jest/test-result | Open; client context and migration above |
| js-yaml: `node_modules/@eslint/eslintrc/node_modules/js-yaml` | 4.1.1 → 4.3.2 | [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68), [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m), [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj), [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh), argparse | Open; client context and migration above |
| js-yaml: `node_modules/eslint/node_modules/js-yaml` | 4.1.1 → 4.3.2 | [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68), [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m), [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj), [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh), argparse | Open; client context and migration above |
| js-yaml: `node_modules/js-yaml` | 3.14.2 → 3.15.2 | [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68), [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m), [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj), [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh), argparse | Open; client context and migration above |
| jsdom: `node_modules/jsdom` | 16.7.0 → 16.7.0 | http-proxy-agent | Open; client context and migration above |
| jsonpath: `node_modules/jsonpath` | 1.1.1 → 1.3.0 | [GHSA-6c59-mwgh-r2x6](https://github.com/advisories/GHSA-6c59-mwgh-r2x6), [GHSA-87r5-mp6g-5w5j](https://github.com/advisories/GHSA-87r5-mp6g-5w5j), underscore | Open; client context and migration above |
| launch-editor: `node_modules/launch-editor` | 2.12.0 → 2.14.2 | [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) | Cleared by compatible locked update; regressions required |
| lodash: `node_modules/lodash` | 4.17.23 → 4.18.1 | [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc), [GHSA-f23m-r3pf-42rh](https://github.com/advisories/GHSA-f23m-r3pf-42rh) | Cleared by compatible locked update; regressions required |
| micromatch: `node_modules/micromatch` | 4.0.8 → 4.0.8 | braces | Open; client context and migration above |
| minimatch: `node_modules/filelist/node_modules/minimatch` | 5.1.6 → 5.1.9 | [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26), [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj), [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) | Cleared by compatible locked update; regressions required |
| minimatch: `node_modules/minimatch` | 3.1.2 → 3.1.5 | [GHSA-3ppc-4f35-3m26](https://github.com/advisories/GHSA-3ppc-4f35-3m26), [GHSA-7r86-cg39-jmmj](https://github.com/advisories/GHSA-7r86-cg39-jmmj), [GHSA-23c5-xmqv-rm74](https://github.com/advisories/GHSA-23c5-xmqv-rm74) | Cleared by compatible locked update; regressions required |
| nanoid: `node_modules/nanoid` | 3.3.11 → 3.3.20 | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv), [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8), [GHSA-xwg4-73v4-xw9w](https://github.com/advisories/GHSA-xwg4-73v4-xw9w) | Cleared by compatible locked update; regressions required |
| node-forge: `node_modules/node-forge` | 1.3.3 → 1.4.0 | [GHSA-2328-f5f3-gj25](https://github.com/advisories/GHSA-2328-f5f3-gj25), [GHSA-q67f-28xg-22rw](https://github.com/advisories/GHSA-q67f-28xg-22rw), [GHSA-5m6q-g25r-mvwx](https://github.com/advisories/GHSA-5m6q-g25r-mvwx), [GHSA-ppp5-5v6c-4jwp](https://github.com/advisories/GHSA-ppp5-5v6c-4jwp), [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | Open; client context and migration above |
| nth-check: `node_modules/svgo/node_modules/nth-check` | 1.0.2 → 1.0.2 | [GHSA-rp65-9cf3-cjxr](https://github.com/advisories/GHSA-rp65-9cf3-cjxr) | Open; client context and migration above |
| path-to-regexp: `node_modules/path-to-regexp` | 0.1.12 → 0.1.13 | [GHSA-37ch-88jc-xwx2](https://github.com/advisories/GHSA-37ch-88jc-xwx2) | Cleared by compatible locked update; regressions required |
| picomatch: `node_modules/picomatch` | 2.3.1 → 2.3.2 | [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p), [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) | Cleared by compatible locked update; regressions required |
| picomatch: `node_modules/tinyglobby/node_modules/picomatch` | 4.0.3 → 4.0.7 | [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p), [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) | Cleared by compatible locked update; regressions required |
| postcss: `node_modules/postcss` | 8.5.6 → 8.5.30 | [GHSA-7fh5-64p2-3v2j](https://github.com/advisories/GHSA-7fh5-64p2-3v2j), [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93), [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q), [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) | Open; client context and migration above |
| postcss: `node_modules/resolve-url-loader/node_modules/postcss` | 7.0.39 → 7.0.39 | [GHSA-7fh5-64p2-3v2j](https://github.com/advisories/GHSA-7fh5-64p2-3v2j), [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93), [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q), [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) | Open; client context and migration above |
| postcss-attribute-case-insensitive: `node_modules/postcss-attribute-case-insensitive` | 5.0.2 → 5.0.2 | postcss-selector-parser | Open; client context and migration above |
| postcss-calc: `node_modules/postcss-calc` | 8.2.4 → 8.2.4 | postcss-selector-parser | Open; client context and migration above |
| postcss-custom-selectors: `node_modules/postcss-custom-selectors` | 6.0.3 → 6.0.3 | postcss-selector-parser | Open; client context and migration above |
| postcss-dir-pseudo-class: `node_modules/postcss-dir-pseudo-class` | 6.0.5 → 6.0.5 | postcss-selector-parser | Open; client context and migration above |
| postcss-focus-visible: `node_modules/postcss-focus-visible` | 6.0.4 → 6.0.4 | postcss-selector-parser | Open; client context and migration above |
| postcss-focus-within: `node_modules/postcss-focus-within` | 5.0.4 → 5.0.4 | postcss-selector-parser | Open; client context and migration above |
| postcss-merge-longhand: `node_modules/postcss-merge-longhand` | 5.1.7 → 5.1.7 | stylehacks | Open; client context and migration above |
| postcss-merge-rules: `node_modules/postcss-merge-rules` | 5.1.4 → 5.1.4 | postcss-selector-parser | Open; client context and migration above |
| postcss-minify-selectors: `node_modules/postcss-minify-selectors` | 5.2.1 → 5.2.1 | postcss-selector-parser | Open; client context and migration above |
| postcss-nested: `node_modules/postcss-nested` | 6.2.0 → 6.2.0 | postcss-selector-parser | Open; client context and migration above |
| postcss-nesting: `node_modules/postcss-nesting` | 10.2.0 → 10.2.0 | @csstools/selector-specificity, postcss-selector-parser | Open; client context and migration above |
| postcss-preset-env: `node_modules/postcss-preset-env` | 7.8.3 → 7.8.3 | @csstools/postcss-cascade-layers, @csstools/postcss-is-pseudo-class, css-blank-pseudo, css-has-pseudo, postcss-attribute-case-insensitive, postcss-custom-selectors, postcss-dir-pseudo-class, postcss-focus-visible, postcss-focus-within, postcss-nesting, postcss-pseudo-class-any-link, postcss-selector-not | Open; client context and migration above |
| postcss-pseudo-class-any-link: `node_modules/postcss-pseudo-class-any-link` | 7.1.6 → 7.1.6 | postcss-selector-parser | Open; client context and migration above |
| postcss-selector-not: `node_modules/postcss-selector-not` | 6.0.1 → 6.0.1 | postcss-selector-parser | Open; client context and migration above |
| postcss-selector-parser: `node_modules/postcss-modules-local-by-default/node_modules/postcss-selector-parser` | 7.1.1 → 7.1.6 | [GHSA-w9m9-85wc-3x92](https://github.com/advisories/GHSA-w9m9-85wc-3x92), [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | Open; client context and migration above |
| postcss-selector-parser: `node_modules/postcss-modules-scope/node_modules/postcss-selector-parser` | 7.1.1 → 7.1.6 | [GHSA-w9m9-85wc-3x92](https://github.com/advisories/GHSA-w9m9-85wc-3x92), [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | Open; client context and migration above |
| postcss-selector-parser: `node_modules/postcss-selector-parser` | 6.1.2 → 6.1.4 | [GHSA-w9m9-85wc-3x92](https://github.com/advisories/GHSA-w9m9-85wc-3x92), [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | Open; client context and migration above |
| postcss-unique-selectors: `node_modules/postcss-unique-selectors` | 5.1.1 → 5.1.1 | postcss-selector-parser | Open; client context and migration above |
| proxy-addr: `node_modules/proxy-addr` | 2.0.7 → 2.0.8 | [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) | Cleared by compatible locked update; regressions required |
| qs: `node_modules/qs` | 6.14.1 → 6.16.0 | [GHSA-w7fw-mjwx-w883](https://github.com/advisories/GHSA-w7fw-mjwx-w883), [GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26), [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) | Cleared by compatible locked update; regressions required |
| react-dev-utils: `node_modules/react-dev-utils` | 12.0.1 → 12.0.1 | fork-ts-checker-webpack-plugin, globby | Open; client context and migration above |
| react-scripts: `node_modules/react-scripts` | 5.0.1 → 5.0.1 | @svgr/webpack, babel-jest, css-minimizer-webpack-plugin, eslint-config-react-app, eslint-webpack-plugin, jest, jest-resolve, jest-watch-typeahead, react-dev-utils, resolve-url-loader, webpack-dev-server, workbox-webpack-plugin, tailwindcss | Open; client context and migration above |
| resolve-url-loader: `node_modules/resolve-url-loader` | 4.0.0 → 4.0.0 | postcss | Open; client context and migration above |
| rollup: `node_modules/rollup` | 2.79.2 → 2.80.0 | [GHSA-mw96-cpmx-2vgc](https://github.com/advisories/GHSA-mw96-cpmx-2vgc) | Cleared by compatible locked update; regressions required |
| rollup-plugin-terser: `node_modules/rollup-plugin-terser` | 7.0.2 → 7.0.2 | serialize-javascript | Open; client context and migration above |
| selfsigned: `node_modules/selfsigned` | 2.4.1 → 2.4.1 | node-forge | Open; client context and migration above |
| serialize-javascript: `node_modules/rollup-plugin-terser/node_modules/serialize-javascript` | 4.0.0 → 4.0.0 | [GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq), [GHSA-qj8w-gfj5-8c6v](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v) | Open; client context and migration above |
| serialize-javascript: `node_modules/serialize-javascript` | 6.0.2 → 6.0.2 | [GHSA-5c6j-r48x-rmvq](https://github.com/advisories/GHSA-5c6j-r48x-rmvq), [GHSA-qj8w-gfj5-8c6v](https://github.com/advisories/GHSA-qj8w-gfj5-8c6v) | Open; client context and migration above |
| shell-quote: `node_modules/shell-quote` | 1.8.3 → 1.12.0 | [GHSA-w7jw-789q-3m8p](https://github.com/advisories/GHSA-w7jw-789q-3m8p), [GHSA-395f-4hp3-45gv](https://github.com/advisories/GHSA-395f-4hp3-45gv) | Cleared by compatible locked update; regressions required |
| socket.io-parser: `node_modules/socket.io-parser` | 4.2.5 → 4.2.7 | [GHSA-677m-j7p3-52f9](https://github.com/advisories/GHSA-677m-j7p3-52f9), [GHSA-2m8v-j782-fhvr](https://github.com/advisories/GHSA-2m8v-j782-fhvr) | Cleared by compatible locked update; regressions required |
| sockjs: `node_modules/sockjs` | 0.3.24 → 0.3.24 | uuid | Open; client context and migration above |
| source-map-js: `node_modules/source-map-js` | 1.2.1 → 1.2.2 | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) | Cleared by compatible locked update; regressions required |
| sprintf-js: `node_modules/sprintf-js` | 1.0.3 → 1.0.3 | [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) | Open; client context and migration above |
| stylehacks: `node_modules/stylehacks` | 5.1.1 → 5.1.1 | postcss-selector-parser | Open; client context and migration above |
| svgo: `node_modules/postcss-svgo/node_modules/svgo` | 2.8.0 → 2.8.4 | [GHSA-xpqw-6gx7-v673](https://github.com/advisories/GHSA-xpqw-6gx7-v673), [GHSA-2p49-hgcm-8545](https://github.com/advisories/GHSA-2p49-hgcm-8545), [GHSA-w27v-7q3p-w38r](https://github.com/advisories/GHSA-w27v-7q3p-w38r), [GHSA-4vpr-x523-8j87](https://github.com/advisories/GHSA-4vpr-x523-8j87), css-select, js-yaml | Open; client context and migration above |
| svgo: `node_modules/svgo` | 1.3.2 → 1.3.2 | [GHSA-xpqw-6gx7-v673](https://github.com/advisories/GHSA-xpqw-6gx7-v673), [GHSA-2p49-hgcm-8545](https://github.com/advisories/GHSA-2p49-hgcm-8545), [GHSA-w27v-7q3p-w38r](https://github.com/advisories/GHSA-w27v-7q3p-w38r), [GHSA-4vpr-x523-8j87](https://github.com/advisories/GHSA-4vpr-x523-8j87), css-select, js-yaml | Open; client context and migration above |
| tailwindcss: `node_modules/tailwindcss` | 3.4.19 → 3.4.19 | chokidar, fast-glob, micromatch, postcss-nested, postcss-selector-parser | Open; client context and migration above |
| terser-webpack-plugin: `node_modules/terser-webpack-plugin` | 5.3.16 → 5.6.1 | serialize-javascript | Cleared by compatible locked update; regressions required |
| underscore: `node_modules/underscore` | 1.12.1 → 1.13.6 | [GHSA-qpx9-hpmf-5gmw](https://github.com/advisories/GHSA-qpx9-hpmf-5gmw) | Open; client context and migration above |
| uuid: `node_modules/uuid` | 8.3.2 → 8.3.2 | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Open; client context and migration above |
| webpack-dev-middleware: `node_modules/webpack-dev-middleware` | 5.3.4 → 5.3.4 | [GHSA-g84c-rxfj-3j2c](https://github.com/advisories/GHSA-g84c-rxfj-3j2c) | Open; client context and migration above |
| webpack-dev-server: `node_modules/webpack-dev-server` | 4.15.2 → 4.15.2 | [GHSA-9jgg-88mc-972h](https://github.com/advisories/GHSA-9jgg-88mc-972h), [GHSA-4v9v-hfq4-rm2v](https://github.com/advisories/GHSA-4v9v-hfq4-rm2v), [GHSA-79cf-xcqc-c78w](https://github.com/advisories/GHSA-79cf-xcqc-c78w), [GHSA-mx8g-39q3-5c79](https://github.com/advisories/GHSA-mx8g-39q3-5c79), [GHSA-f5vj-f2hx-8m93](https://github.com/advisories/GHSA-f5vj-f2hx-8m93), [GHSA-m28w-2pqf-7qgj](https://github.com/advisories/GHSA-m28w-2pqf-7qgj), chokidar, sockjs, webpack-dev-middleware, http-proxy-middleware, selfsigned | Open; client context and migration above |
| websocket-driver: `node_modules/websocket-driver` | 0.7.4 → 0.7.5 | [GHSA-mp7j-qc5w-4988](https://github.com/advisories/GHSA-mp7j-qc5w-4988), [GHSA-xv26-6w52-cph6](https://github.com/advisories/GHSA-xv26-6w52-cph6) | Cleared by compatible locked update; regressions required |
| workbox-build: `node_modules/workbox-build` | 6.6.0 → 6.6.0 | rollup-plugin-terser | Open; client context and migration above |
| workbox-webpack-plugin: `node_modules/workbox-webpack-plugin` | 6.6.0 → 6.6.0 | workbox-build | Open; client context and migration above |
| ws: `node_modules/engine.io-client/node_modules/ws` | 8.18.3 → 8.21.3 | [GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx), [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) | Cleared by compatible locked update; regressions required |
| ws: `node_modules/webpack-dev-server/node_modules/ws` | 8.19.0 → 8.22.0 | [GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx), [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) | Cleared by compatible locked update; regressions required |
| ws: `node_modules/ws` | 7.5.10 → 7.5.13 | [GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx), [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) | Cleared by compatible locked update; regressions required |
| yaml: `node_modules/yaml` | 1.10.2 → 1.10.3 | [GHSA-48c2-rrv3-qjmp](https://github.com/advisories/GHSA-48c2-rrv3-qjmp) | Cleared by compatible locked update; regressions required |

## Patched server dependency paths

- undefined@undefined → express@5.2.1 → body-parser@2.3.0 (`node_modules/body-parser`).
- undefined@undefined → socket.io@4.8.3 → engine.io@6.6.11 (`node_modules/engine.io`).
- undefined@undefined → express@5.2.1 → router@2.2.0 → path-to-regexp@8.4.2 (`node_modules/path-to-regexp`).
- undefined@undefined → express@5.2.1 → proxy-addr@2.0.8 (`node_modules/proxy-addr`).
- undefined@undefined → express@5.2.1 → body-parser@2.3.0 → qs@6.16.0 (`node_modules/qs`).
- undefined@undefined → socket.io@4.8.3 → socket.io-adapter@2.5.8 (`node_modules/socket.io-adapter`).
- undefined@undefined → socket.io@4.8.3 → socket.io-parser@4.2.7 (`node_modules/socket.io-parser`).
- undefined@undefined → socket.io@4.8.3 → engine.io@6.6.11 → ws@8.21.3 (`node_modules/ws`).

## Purpose-connected pass refresh (14 October 2026)

Audits were rerun against all three actual lockfiles after the PostgreSQL test dependency, compatible refresh and npm 10 lockfile repair. Root and server remain zero findings. Client remains 99 affected packages (63 high, 33 moderate, 3 low; zero critical), representing 25 unique advisory URLs and 13 directly advised packages. Latest raw results: `artifacts/purpose/audit-root-resume.json`, `audit-server-resume.json`, `audit-client-resume.json`. Targeted compatible refresh of braces, node-forge, postcss, sprintf-js and underscore reported up to date; it did not resolve these findings. The repaired lockfile passed CI clean install and all 734 client tests at `74fd6e7`. No forced upgrade, override, suppression or threshold reduction was applied.

The user authorized deployment, but that does not supply evidence to clear this production-readiness blocker. The PR audit job checks all three committed lockfiles independently of regression/browser jobs; failing tests can no longer hide its result. New deck purchases independently remain fail-closed until Case applies the account concurrency migration. The production repository was read-only checked and is public; private GitHub uploads/notes are therefore blocked, with visibility unchanged.

### Bounded next security workstream

Replace CRA-owned build/dev/test tooling in a separately reviewable change, retaining React, engine, application behavior and public URLs. Preserve environment substitution, static asset paths, source maps, WebGL pruning, CSS handling, module aliases, named lazy Admin/Matches/replay chunks, Jest mocks/jsdom behavior and existing supported browser targets. Do not expose a development server publicly during migration.

Acceptance: clean installs from committed locks; zero high/critical audit findings across root/server/client (and explicit review of any remaining severity); full server/client and JSX suites; content validation; all current browser gates including private uploads, printings and purchase/restart; production-build visual equivalence; unchanged existing bundle ceilings with complete attribution; Vercel/Render build and routing parity. Keep original compatible build available until that evidence passes; do not deploy the replacement or silently waive findings to make feature work appear complete. No application rules or production content changes are part of this security workstream.
