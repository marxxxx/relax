# Cabin Upper Floor and Branch Staging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stage every non-`main` branch on GitHub Pages (PR 1). Then grow the Lichtung cabin into a walkable two-storey house with a stair, a bedroom, a bathroom with a skylight, and a sea-facing balcony (PR 2).

**Architecture:**
- **PR 1:** a `build-site.sh` script assembles `_site/` from `main` plus every other remote branch. `deploy.yml` (main only) calls it. A tiny `staging.yml` re-dispatches `deploy.yml` on `main` whenever another branch is pushed or deleted.
- **PR 2:** a new constants module `house.js` pins the house geometry for `cabin.js`, `interior.js`, `collision.js` and `effects.js`. Collision becomes level-aware: boxes get an optional y-range, and `floorAt`, `blocked` and `tooSteep` take the player's y.

**Tech Stack:** Three.js r128 (global `THREE`), plain ES modules, GitHub Actions, bash.

**Spec:** `docs/superpowers/specs/2026-10-27-cabin-upper-floor-design.md` (ticket marxxxx/relax#1)

## Global Constraints

- Three.js **r128** API only. Modules use the global `THREE` and do not import it.
- Imports stay in the form `from './x.js'` / `import './x.js'`: single quotes, relative path, `.js`.
- **No `rnd()` calls added or removed in `cabin.js`, `interior.js` or any module evaluated before `grass.js`.** Do not reorder the imports in `main.js`. Use `Math.random()` for cosmetic jitter.
  - The one accepted change is widening the grass exclusion rectangle in `grass.js` (Task 5). It only reshuffles grass blades, because grass is the last `rnd()` consumer.
- Dense code style: several statements per line, short names, `// ---------- section ----------` headers.
- New lights cast **no shadows**. Respect `isMobile`.
- UI text stays German. No new UI is planned.
- The repo has no test suite. Checks run in a browser via the Playwright MCP tools against `python3 -m http.server -d web 8000`, as `browser_evaluate` snippets.
  - Modules are imported in-page with `await import('/js/<m>.js')`. That gives the same module instances the app uses.
  - Checks and screenshots stay **outside the repo**, in the session scratchpad.
- Branches (ticket #1):
  - `1_branch_staging` (PR 1, from `main`)
  - `1_cabin_upper_floor` (PR 2, from `main`; also carries the spec and this plan)

## House geometry (pinned values, `web/js/house.js`)

```js
export const HX=4.5,HZ=3.25,T_=.25;            // outer half-extents, wall thickness → inner faces at ±4.25 / ±3.0
export const GF=.31,WH=3,UF=3.3,UH=6,RIDGE=8.3; // ground floor, ground wall top / slab underside, upper floor, upper wall top, roof ridge
export const STAIR={x0:-2.2,x1:1.8,z0:-3,z1:-2,hx:-1.3}; // along back wall, rises +x; hx = start of slab opening
export const BALC={x0:-6,x1:-HX,hz:1.6};        // west gable, z in [-hz,hz], floor at UF
export const stairH=x=>GF+Math.min(1,Math.max(0,(x-STAIR.x0)/(STAIR.x1-STAIR.x0)))*(UF-GF);
```

Derived layout. The builder may nudge items by ≤0.3 m, but not the values above.

- **Upper partitions:**
  - bedroom|hall wall at `x=-1.4`, with a doorway near the front;
  - hall|bathroom wall at `x=2.3`, with a doorway.
- **Upper railings:**
  - along `z=-2` from `x=-1.3` to `x=1.2`;
  - across `x=-1.3`, `z∈[-3,-2]`.
  - The top end of the stair (x 1.2…1.8) is open toward +z.
- **Ground stair railing:** along `z=-2`, `x∈[-2.2,1.8]`, y `[0,3]`. The stair is entered only from its west end.
- **Fireplace on the east wall, facing −x:** fire centre `FPX=3.75, FPZ=0`. Exterior chimney at x 4.5…5.4, z −0.62…0.62, top `y≈9.1`.
- **Balcony door:** in the upper west wall, `z∈[-.5,.5]`.
- **Ground back window:** at x 2.5…3.5, clear of the stair.
- **Porch:** z 3.25…5.1, posts at x ±4.4.
- **Woodpile:** outside the east wall, north of the chimney.

## Review Focus

1. **The stair in both directions.** Going down from the upper floor must land the player on the ground floor, not leave them hovering or blocked. → Task 3 check `stairRoundTrip`.
2. **Walking under the slab / under the stair on the ground floor.** The player must not be lifted onto the upper floor when walking near the back wall east of the stair top, or near the stair's room side. → Task 3 checks `noLiftAtStairTop`, `stairSideBlocked`.
3. **Upstairs edges.** Walking into the stair opening or past the balcony railing must be blocked, not a fall. → Task 4 checks `holeRailing`, `balconyRailing`.
4. **The debug handle placing the player upstairs** (used by the e2e test, `window.__lichtung.player`). Setting `y` near `UF` must settle onto the upper floor. → Task 3 check `debugPlaceUpstairs`.
5. **Staging slugs for odd branch names** (`feature/Foo Bar`) and branches without `web/`. → Task 1 checks.

---

## Part 1 — Staging (branch `1_branch_staging`, PR 1)

### Task 1: Site build script and staging workflows

**Files:**
- Create: `.github/scripts/build-site.sh`
- Modify: `.github/workflows/deploy.yml`
- Create: `.github/workflows/staging.yml`
- Modify: `.gitignore` (add `.superpowers/`)

**Interfaces:**
- Produces: `build-site.sh <out-dir>`. Run it inside a full clone (all `refs/remotes/origin/*` fetched).
  - It writes `main`'s `web/` to `<out-dir>/`.
  - It writes every other origin branch's `web/` to `<out-dir>/staging/<slug>/`, where slug = lower-cased branch name with every char outside `[a-z0-9._-]` replaced by `-`.
  - It writes a plain `<out-dir>/staging/index.html` listing links to each staged branch.
  - Branches with no `web/` are skipped with a log line.
  - Each copy is cache-busted with **its own ref's** short SHA, using the two existing `sed` expressions moved verbatim from `deploy.yml`.

- [ ] **Step 1: Write the check script** (scratchpad, `check-build-site.sh`). It:
  - creates a scratch bare "origin" from this repo, plus branches `feature/Foo Bar` (with `web/`) and `docs-only` (with `web/` removed);
  - clones it and runs `build-site.sh out`.

  It asserts:
  - `out/index.html` exists and references `css/style.css?v=<main sha7>`;
  - `out/staging/feature-foo-bar/index.html` exists and references `?v=<that branch sha7>`;
  - `out/staging/docs-only` does not exist;
  - `out/staging/index.html` contains `feature-foo-bar/`;
  - every relative JS import under `out/staging/feature-foo-bar/js` ends in `?v=<sha7>'`.
- [ ] **Step 2: Run it.** Expected: FAIL, because `build-site.sh` is not found.
- [ ] **Step 3: Implement `build-site.sh`.** Use `git archive <ref> web | tar -x` into a temp dir, then move it into place. Use `set -euo pipefail`.
- [ ] **Step 4: Update `deploy.yml`.**
  - `actions/checkout@v4` with `fetch-depth: 0`.
  - The "Prepare site" step becomes `bash .github/scripts/build-site.sh _site`, plus the existing grep summaries.
  - Triggers stay `push: [main]` + `workflow_dispatch`.
- [ ] **Step 5: Add `staging.yml`.**
  - Triggers: `on: push: branches-ignore: [main]` and `delete`.
  - Permissions: `actions: write`, `contents: read`.
  - One step: `gh workflow run deploy.yml --ref main --repo ${{ github.repository }}` with `GH_TOKEN: ${{ github.token }}`.
- [ ] **Step 6: Run the check script.** Expected: PASS. Also run `bash -n` on the script, and `python3 -c "import yaml,sys;[yaml.safe_load(open(f)) for f in sys.argv[1:]]"` on both workflows. Expected: no output.
- [ ] **Step 7: Commit** (`Stage non-main branches under /staging/<branch>/ on Pages`). The draft PR is opened by the agent-dev close-out, not here.

---

## Part 2 — Cabin (branch `1_cabin_upper_floor`, PR 2)

### Task 2: Baseline and house constants

**Files:**
- Create: `web/js/house.js` (the block under "House geometry", verbatim)
- Commit also: the spec and this plan

- [ ] **Step 1: Record a baseline on unchanged `main` code.**
  - Serve `web/` and open it in Playwright.
  - Evaluate a layout fingerprint: walk `scene` (from `/js/renderer.js`) and, for each `InstancedMesh`, sum the matrix elements of its first 50 instances. Save the JSON to the scratchpad (`baseline.json`).
  - Take an orbit screenshot.
  - If headless WebGL fails, record that and continue: e2e becomes "not tested" in the summary.
- [ ] **Step 2: Add `house.js`.** Nothing imports it yet.
- [ ] **Step 3: Check.** The page loads with no console errors, and `(await import('/js/house.js')).stairH(1.8)===3.3`.
- [ ] **Step 4: Commit** (spec, plan, `house.js`).

### Task 3: Level-aware collision and walking

**Files:**
- Modify: `web/js/collision.js`
- Modify: `web/js/controls.js:66-74` (pass `player.y`)

**Interfaces:**
- Consumes: `house.js` constants, `stairH`.
- Produces:
  - `BOXES` entries `[x0,x1,z0,z1,y0?,y1?]`. With no y-range a box blocks at every height. With a y-range it blocks only when the body span `[y+.1, y+1.75]` overlaps `[y0,y1]`.
  - `blocked(x,z,y=0)`
  - `floorAt(x,z,y=0)`
  - `tooSteep(x0,z0,x1,z1,y=0)`
  - `isInside(x,z)`: inner rect `|x|<4.2 && |z|<2.95`, both floors; the balcony is outside.

`floorAt` rules, in order:
1. Inside the stair footprint (`STAIR.x0<x<STAIR.x1 && z0<z<z1`) and (`x>STAIR.hx || y<2.3`) → `stairH(x)`.
2. `|x|<HX && |z|<HZ` → `y>1.8 ? UF : GF`.
3. Balcony rect (`BALC.x0<x<=BALC.x1`, `|z|<BALC.hz`) and `y>2` → `UF`.
4. Porch (`|x|<4.6`, `HZ<=z<5.2`) → `.41`.
5. Plinth margin and terrain, as today, with the extents scaled to the new size.

`tooSteep`:
- Any rise of more than `.45` between samples is steep, checked before the cabin exemption.
- The exemption box widens to `|x1|<6.5 && z1>-4.5 && z1<6.5`.

- [ ] **Step 1: Write the browser checks** (scratchpad, `checks-collision.js`, one async function returning `{name:pass}`):
  - `floorAt(0,0,0)===GF`
  - `floorAt(0,0,3.3)===UF`
  - `floorAt(-2.2+2,-2.5,1.8)` ≈ `stairH(-0.2)`
  - `floorAt(-2,-2.5,3.3)===UF` (over the stair, outside the opening)
  - `floorAt(-5,0,3.3)===UF`, and `floorAt(-5,0,0)` = terrain height
  - **`stairRoundTrip`:** simulate stepping x from −3.0 to 2.1 at z=−2.5 in 0.04 steps. Feed y = previous floor, and check `!tooSteep` for every step. Then do the reverse from the top at y=UF. Both pass, the floors are monotonic, and they end at GF / UF.
  - **`noLiftAtStairTop`:** from (2.3,−2.5,GF), `tooSteep(2.3,-2.5,1.75,-2.5,GF)===true`.
  - **`stairSideBlocked`:** `blocked(0,-1.8,GF)===true`.
  - **`debugPlaceUpstairs`:** set `player.x=3,player.z=1,player.y=3.4`, switch to walk mode, wait 0.5 s. `player.y` ≈ `UF` ±0.05.
  - `isInside(0,0) && !isInside(-5,0)`
- [ ] **Step 2: Run the checks.** Expected: most FAIL, since there are no y params or stair yet.
- [ ] **Step 3: Implement the collision changes and pass `player.y` in `controls.js`.** Push the ground stair railing box `[STAIR.x0,STAIR.x1,-2.05,-1.95,0,3]` from `collision.js`.
- [ ] **Step 4: Run the checks.** Expected: PASS. The existing ground-floor walk (porch → door → room) still works: `blocked` is false along x=0 from z=8 to z=0 at GF.
- [ ] **Step 5: Commit.**

### Task 4: Two-storey shell, stair, roof with skylight, balcony

**Files:**
- Modify: `web/js/cabin.js`. Import the dimensions from `house.js` and remove the local `T_,HX,HZ,WH`.

**Interfaces:**
- Consumes: `house.js`; `BOXES` with y-ranges (Task 3).
- Produces:
  - `export const SKY={x0,x1,z0,z1}`: the skylight's footprint on the front roof slope over the bathroom (x within 2.5…4.1).
  - `export function windowAt`: the existing helper, now exported. Task 6 uses it for the upper window frames and glow panes.
  - `wallBox(x0,x1,y0,y1,z0,z1,collide)` now always pushes `[x0,x1,z0,z1,y0,y1]` when `collide!==false`.

Build:
1. **Ground walls** at the new size. Openings:
   - front door centre, with front windows at `1.45<|x|<2.55`;
   - back window at x 2.5…3.5;
   - east wall solid (the fireplace goes there);
   - west wall solid.
2. **Upper slab** from y 3.0 to 3.3, with an opening over `x∈[STAIR.hx,STAIR.x1]`, `z∈[-3,-2]`. Planks on top (reuse a plank texture via a new export in Task 6, or `std(0x6b4a2e)` for now) and beams underneath.
3. **Upper walls** from y 3.0 to 6. Openings:
   - bedroom front window at x −3.2…−2.0;
   - hall front window at x 0…1.1;
   - balcony door (west, `z∈[-.5,.5]`, height to y 5.4).

   The two partitions have doorways.
4. **Stair:** 13 boxed steps with `stairH` rises, plus a stringer. Ground railing along `z=-2` and the upper railings per "Derived layout", as meshes plus `BOXES` with `[3,4.5]` y-ranges.
5. **Roof:**
   - Drop the solid gable prism. Add thin gable-end triangles (log material) at both ends from `UH` to `RIDGE`, and two roof slopes.
   - The upstairs ceiling is vaulted: plank boards under each slope, plus 2–3 tie beams.
   - The front slope is built from boxes around a hole at `SKY`. Put a glass pane (`std(0x9fc4d8,{transparent:true,opacity:.35,roughness:.1,metalness:.1})`) and a frame in the hole.
6. **Balcony:**
   - deck at UF over `BALC`;
   - two posts to the ground (`CIRCLES`);
   - railings on three sides (`BOXES` y `[3,4.5]`).
7. **Porch** moved to z 3.25…5.1, with posts at x ±4.4 and bench and door positions shifted. Remove the old outside woodpile (Task 5 re-adds it).

- [ ] **Step 1: Add checks** (scratchpad, `checks-shell.js`):
  - **`holeRailing`:** `blocked(0,-1.8,UF)===true`.
  - **`balconyRailing`:** `blocked(-6.1,0,UF)===true`, and `blocked(-5.2,0,UF)===false`.
  - **`balconyDoor`:** `blocked(-4.4,0,UF)===false`, and `blocked(-4.4,1.5,UF)===true`.
  - **`groundDoor`:** `blocked(0,3.1,GF)===false`.
  - **`upperWallsNotGround`:** `blocked(-4.4,1.5,GF)` matches the ground wall only (true), and `blocked(-1.4,-1,GF)===false` (an upper partition does not block the ground floor).
  - Screenshots: orbit by day; walk-mode views from (−3.6,−2.5) looking +x up the stair, and from the hall at UF looking at the stair opening.
- [ ] **Step 2: Run the checks.** Expected: FAIL.
- [ ] **Step 3: Implement the build list above.**
- [ ] **Step 4: Run all checks** (collision + shell). Expected: PASS, with no console errors. Look at the screenshots: no z-fighting at the slab, walls meet at the corners, the skylight hole shows the sky from inside.
- [ ] **Step 5: Commit.**

### Task 5: Ground floor rearrangement, fireplace and chimney on the east wall

**Files:**
- Modify: `web/js/interior.js`
- Modify: `web/js/effects.js:29,43` (hearth particles, smoke spawn)
- Modify: `web/js/terrain.js:22` (dirt patch → `smooth(4.5,7,…)`)
- Modify: `web/js/grass.js:29` (exclusion → `Math.abs(x)<5.6&&z>-4&&z<5.6`)
- Modify: `web/js/controls.js` (orbit `target` → `(2,4.6,2.5)` in both places, min dist 7 → 9)

**Interfaces:**
- Produces from `interior.js`:
  - `FPX=3.75, FPZ=0`
  - `CHIMNEY_TOP={x:4.95,y:9.1,z:0}`
  - the hearth spreads along z: in `effects.js` the hearth uses `FPX+f.oz`, `FPZ+f.ox`, so the long axis is z.
  - `plankTex` exported for the upper floor.
  - `hearthLight` at `(FPX-.4,1.0,0)`.

Build:
- The fireplace (hearth, cheeks, lintel, opening, mantel, decorations, candle) is rotated to face −x on the east wall, centred z=0. The exterior stone chimney follows `CHIMNEY_TOP`.
- The couch stays on the west wall at z −1.6…1.2. Shift its x so it sits against the new inner wall at −4.25, and move the wall pelts with it.
- Side table and lantern in the front-west corner. Shelf on the back wall, east of the stair. Rug between the couch and the fireplace. Firewood basket beside the fireplace.
- Sun-shaft `makeBeam` quads match the new ground back window (normal `[0,0,-1]`). `makeBeam` takes a floor y (default `GF`).
- The outside woodpile is re-added at x≈5.1, z −2.8…−1.2.
- **All interior `BOXES` get y `[0,3]`.**

- [ ] **Step 1: Add checks:**
  - **`couchOppositeFire`:** the couch box's z-centre is within 0.6 of `FPZ`, and the couch is on the west wall while `FPX>3`.
  - **`interiorBoxesLevelled`:** every `BOXES` entry inside `|x|<4.5,|z|<3.25` has length 6.
  - **`upperFreeOverCouch`:** `blocked(-3.8,0,UF)===false`.
  - Screenshot from the ground floor at (−2,1) looking east at the fireplace.
- [ ] **Step 2: Run the checks.** Expected: FAIL.
- [ ] **Step 3: Implement.** Before committing, confirm with `git diff main -- web/js | grep -E '^[+-].*\brnd\('` that only the `grass.js` exclusion line shows up.
- [ ] **Step 4: Run all checks.** Expected: PASS. The night screenshot shows hearth particles inside the fireplace and smoke rising from the new chimney top.
- [ ] **Step 5: Commit.**

### Task 6: Upper floor furnishing, candles, window glow

**Files:**
- Create: `web/js/upstairs.js`. Imported from `main.js` **directly after `./interior.js`**; it must not call `rnd()`.
- Modify: `web/js/environment.js` (candle flicker)
- Modify: `web/js/main.js` (one import line)

**Interfaces:**
- Consumes: `cabin`, `add`, `windowAt` (export it from `cabin.js`), `plankTex`, `house.js`.
- Produces: `export const candleLight` (a PointLight `0xffb35a`, distance 5, decay 2, no shadow), placed over the tub candles.
  - `environment.js` sets `candleLight.intensity=(.35+glow*.5)*(.85+.15*Math.sin(state.T*13)*Math.sin(state.T*7.3))`.

Build:
- **Bedroom:**
  - bed (frame, mattress, blanket, pillows, a fur throw using the `pelt` helper; export `pelt` and `FUR_*` from `interior.js`) against the back or west wall;
  - small desk and chair under the front window;
  - a rug.
- **Bathroom:**
  - freestanding tub (rounded box or a lathe shape, white enamel) under `SKY`;
  - 4–6 candles on the tub rim or a stool, each with a small `MeshBasicMaterial` flame;
  - a towel rack.
- **Hall:** a small chest or a lamp.
- **Windows:** `windowAt` frames and `glowMat` panes for every upper window, so they glow at night. The balcony door gets a frame.
- **Collision:** BOXES for the furniture, y `[3,4.5]`.

- [ ] **Step 1: Add checks:**
  - **`bedBlocksUpstairsOnly`:** the bed box is blocked at UF and not at GF.
  - **`candleLight`:** exists, `castShadow===false`, and intensity > 0 at `state.hour=22`.
  - **`glowPanes`:** the count of meshes using `glowMat` ≥ 6.
- [ ] **Step 2: Run the checks.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run all checks.** Expected: PASS. Screenshots of the bedroom, and of the bathroom by night (candles) and by day (skylight).
- [ ] **Step 5: Commit.**

### Task 7: End-to-end verification

**Files:** none in the repo. Evidence goes to the scratchpad.

- [ ] **Step 1: Run all check files.** Expected: every check passes.
- [ ] **Step 2: Compare the layout fingerprint with `baseline.json`.** Every `InstancedMesh` except the grass is identical.
- [ ] **Step 3: Do the walkthrough in walk mode with simulated key presses** (`W`, `A`, `D` via `browser_press_key` hold, or `keydown`/`keyup` dispatch). Go from the spawn through the door, to the stair foot, up the stair, into the hall, the bedroom, and out to the balcony. Then go to the bathroom and back down. Screenshot each spec viewpoint:
  - exterior day and night;
  - ground floor (fireplace opposite the couch, the stair);
  - on the stair;
  - bedroom;
  - bathroom with candles and skylight;
  - balcony view to the sea.
- [ ] **Step 4: Emulate a mobile viewport and coarse pointer** (`browser_resize` 390×844 + reload). It loads with no console errors.
- [ ] **Step 5: Stop the server.** List the evidence paths for the implementation summary.
