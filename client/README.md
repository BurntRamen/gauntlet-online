# Gauntlet client

Use the repository's Node 22 version (`.nvmrc`) and `npm ci` in this directory. The application uses React, Webpack, Babel, PostCSS and Jest directly. Create React App is no longer a dependency.

- `npm start` watches source files and serves development output at `http://127.0.0.1:3000`. Set `PORT` to select another loopback port. Refresh the browser after recompilation; this server has no hot reload, proxy, HTTPS certificate generator or public-network binding. Run the backend separately and set `REACT_APP_SOCKET_URL`.
- `npm test -- --watchAll=false` runs all JavaScript/JSX tests. Add `--watch` for Jest's interactive mode.
- `npm run lint` checks source errors, JSX references and React hook rules.
- `npm run test:toolchain` checks environment exposure, the reviewed YAML dependency override and development HTTP boundaries.
- `npm run build` lints, compiles production output into `build`, then prunes WebGPU-only assets. From the repository root, run `npm run check:bundle` to enforce every existing player/Admin ceiling.

Build output retains hashed classic JavaScript, named lazy Admin/player chunks, extracted CSS, an asset manifest and hidden source maps for debugging and complete budget attribution. Browser targets remain in `package.json`. Static files in `public` are copied; `public/index.html` is the HTML template. Do not place private files in `public`.

Environment precedence is the host environment, `.env.<mode>.local`, `.env.local` (except tests), `.env.<mode>`, then `.env`. References support `$NAME`, `${NAME}` and `${NAME:-fallback}`; escape a dollar sign with a backslash. Circular references fail the build. Only `REACT_APP_*`, `NODE_ENV` and `PUBLIC_URL` are exposed to browser JavaScript and HTML; never give a credential a public prefix. Restart the compiler after editing environment files.

Vercel uses the committed `vercel.json`: locked install, `npm run build`, output `build`, and the existing Admin route rewrites. Render's backend build/start commands are unchanged. A frontend preview is not proof that the corresponding backend is deployed.

The scoped `@istanbuljs/load-nyc-config` → `js-yaml` override removes the obsolete parser's `argparse`/`sprintf-js` path. Its YAML loading, inheritance and rejection behavior are tested. Remove it once that parent adopts a patched parser itself; see [the security disposition](../docs/admin-dependency-audit.md).
