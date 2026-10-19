# AGENTS.md

This file provides guidance to Coding Agents when working with code in this repository.

## Project

"Lichtung" — a browser-only Three.js scene of a forest cabin on a clearing (lake, campfire, cliff coast with beach and sea) with a day/night cycle, weather presets, orbit and first-person walk modes, post-processing and procedural audio. UI text is German.

## Development

There is no build step, package manager, linter or test suite. Everything that ships lives in `web/` and runs as plain ES modules in the browser.

- Run locally: serve `web/` over HTTP (ES modules don't load from `file://`), e.g. `python3 -m http.server -d web 8000`, then open http://localhost:8000.
- Three.js **r128** is loaded as a global `THREE` from cdnjs in `web/index.html` — modules use `THREE.*` without importing it. Stick to the r128 API (e.g. `outputEncoding`/`sRGBEncoding`, not `outputColorSpace`).
- Debug handle: `window.__lichtung` exposes `{player, setMode}` in the console.

## Deployment

`.github/workflows/deploy.yml` publishes only `web/` to GitHub Pages on every push to `main`. It cache-busts by appending `?v=<short sha>` to local `.css`/`.js` references in HTML and to relative imports in JS via `sed`. Keep imports in the form `from './x.js'` / `import './x.js'` (single quotes, relative path, `.js` extension) so the regex matches them.

## Architecture

- **Side-effect modules build the scene at import time.** `web/js/main.js` imports the scene modules (`sky`, `lights`, `terrain`, `cabin`, `interior`, `campfire`, `trees`, `props`, `grass`, …) which add their meshes to `scene` when evaluated. Placement uses the seeded `rnd()` from `util.js`, a single shared sequence — **changing the import order, or adding/removing `rnd()` calls in an earlier module, reshuffles the world layout.**
- **Main loop** (`main.js`): advances `state.hour`, then calls per-frame updaters in a fixed order: `updateWeather` → `updateEnvironment` (returns `env`: sun direction/colour, sky colours, `sy`) → `updateSea/Effects/Precipitation(env)` → `updateCamera` → `updateAudio` → `updateUI` → `renderFrame`.
- **Shared mutable state** lives in `state.js` (`state`, weather presets `W`, and `cur` — the current weather, blended toward the selected preset each frame by `weather.js`). Since imported bindings are read-only, anything written by multiple modules goes on these objects.
- **World geometry** (`world.js`): `heightAt(x,z)` is the single source of truth for terrain height, plus landmarks (`LAKE`, `FIRE`, `SEA`, `coastEdge`, trail/`GULLY` path, `pathDist`). Terrain mesh, tree/prop/grass placement, collision and audio all derive from it.
- **Collision** (`collision.js`): modules push obstacles into `BOXES`/`CIRCLES` while building; `controls.js` uses `blocked`, `tooSteep`, `floorAt`, `isInside` for walk mode.
- **Weather in shaders** (`materials.js`): `WU` holds global uniforms (time, wind, snow, wetness, sun). `weatherize(mat, key)` patches built-in materials via `onBeforeCompile` to add snow cover, wetness, wind sway; `key` (`'terrain'`, `'grass'`, …) selects extra shader code and the program cache key.
- **Rendering paths** (`renderer.js`, `post.js`): on WebGL2 (`POST` true) the scene renders to a float target and `post.js` does height fog, sun shafts, bloom, ACES tone mapping and colour grade ("Filmlook" toggle); on WebGL1 it falls back to built-in tone mapping and `FogExp2`. `environment.js` drives both paths' fog/grade uniforms via `PP`.
- **Mobile**: `isMobile` (`util.js`) reduces pixel ratio, shadows and instance counts throughout; keep that in mind when adding geometry or lights.

## Code style

Dense, compact JS (multiple statements per line, short names, minimal comments with a `// ---------- section ----------` header style). Match it when editing.
