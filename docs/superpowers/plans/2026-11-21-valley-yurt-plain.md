# Valley & yurt plain beyond the mountains — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the world walkable past the mountain ring: a wide plain and NE valley east of the ring, an outer mountain ring, 3 rivers, a cairn-marked pass trail, and a yurt camp — without changing anything at r < 305.

**Architecture:** All new land is added to `baseHeight`/`heightAt` in `web/js/world.js` (masked to r > 305), so the terrain mesh, collision, animals and audio all derive from it as today. Visuals/sight-content for the far world live in one new module `web/js/valley.js`, imported **last** in `main.js` so the seeded `rnd()` layout of the existing world is untouched.

**Tech Stack:** Plain ES modules in `web/`, Three.js **r128** as global `THREE` (cdnjs), no build/test tooling. Verification = node scripts with stubbed globals + headless-browser checks against a locally served `web/`.

**Spec:** `docs/superpowers/specs/2026-11-21-valley-yurt-plain-design.md` (approved). Working prototype of the new world math: `/tmp/opencode/world_prop.js`. Maps: `/tmp/opencode/map_current.png`, `/tmp/opencode/map_proposed.png`.

## Global Constraints
- Three.js r128 API only (`outputEncoding`, not `outputColorSpace`); global `THREE`, modules use `THREE.*` without importing it.
- Imports must stay in the form `from './x.js'` / `import './x.js'` (single quotes, relative, `.js`) — the deploy workflow cache-busts them with sed.
- `heightAt(x,z)` in `web/js/world.js` is the single source of truth; for r < 305 it must remain **bit-identical** to the current code (enforced by `tools/world-check.mjs` against `tools/world-baseline.json`).
- The seeded `rnd()` sequence in `util.js` is shared and order-dependent: `valley.js` is imported last in `main.js`; no `rnd()` calls may be added/removed in any earlier module. New far-world placement either lives in `valley.js` or uses `hash()` (like `props.js` mountain boulders).
- UI text is German. `isMobile` (`util.js`) must reduce instance counts/shadows for the new content too.
- Deploy publishes only `web/`; `docs/` and `tools/` never ship.
- Code style: dense compact JS, multiple statements per line, short names, `// ---------- section ----------` headers.
- Commit after each task on the current branch (`first_person_mode_improved`).

## Review Focus
1. **Existing world reshuffles** (rnd order or heightAt drift at r < 305) → Task 2's `world-check` baseline diff must be exactly 0; import order pinned in Task 7.
2. **River carve artifacts**: bed above local terrain, water surface climbing downstream, or a pit at the map edge → `world-check` assertions in Task 2.
3. **Pass not walkable** (slope > 1:2 between FAR_TRAIL points, or the river block swallowing the ford) → `world-check` slope assertion (Task 2) + browser probe of `blocked()` at the ford (Task 9).
4. **Performance**: terrain grows from 340² to 620² vertices; load time/fps must stay sane, mobile counts reduced → measured in Task 9; fallback is lowering `TSEG`.
5. **WebGL1 fallback** (no POST): `FogExp2` density .003 will fog the plain heavily — accepted, but must not crash → Task 9 if a WebGL1 context is available, otherwise noted.

---

### Task 1: Regression harness `tools/world-check.mjs` + baseline

**Files:**
- Create: `tools/world-check.mjs`
- Create: `tools/world-baseline.json` (generated)

**Interfaces:**
- Produces: `node tools/world-check.mjs` exits 0 and prints `OK` lines when the world matches the baseline and all structural assertions pass; `--write-baseline` (re)writes `tools/world-baseline.json` from the current `web/js/world.js`.

- [ ] **Step 1:** Write `tools/world-check.mjs`: stub `globalThis.matchMedia=()=>({matches:false})`, `innerWidth/innerHeight`, `THREE={Vector3:class{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}}}`; then `await import('../web/js/world.js')` (path relative to the script via `new URL(...)`). Sample a polar grid (angles 0..360 step 7, r = 5..299 step 9) of `heightAt`, skipping points with `pathDist < 12` (trail blends are re-implemented unchanged and excluded from the baseline comparison).
- [ ] **Step 2:** With `--write-baseline`, write those samples to `tools/world-baseline.json`. Run `node tools/world-check.mjs` → prints `OK baseline ...`.
- [ ] **Step 3:** Structural assertions in the same script (run always; no-op until Task 2 lands): if `RIVERS`/`FAR_TRAIL`/`riverAt` are exported, assert (a) each river's water surface `bed+depth-.35` is non-increasing along its points (eps .05), (b) `bed <= heightAt(x,z)+1e-6` at every river point, (c) consecutive FAR_TRAIL points satisfy `|(h[i+1]-h[i]) / dist| <= 0.5`, (d) `heightAt` at the camp (468,16), pass (340,8) and exit (700,-30) are within sane ranges (camp 3..9, pass 8..20, exit > SEA+1). Until Task 2 they are skipped with a note.
- [ ] **Step 4:** `node tools/world-check.mjs` → exit 0. `node --input-type=module --check < tools/world-check.mjs` passes.
- [ ] **Step 5:** Commit: `git add tools/ && git commit -m "test: add world heightAt regression harness"`.

### Task 2: `world.js` — far terrain, rivers, pass trail

**Files:**
- Modify: `web/js/world.js`

**Interfaces:**
- Consumes: `clamp, smooth, fbm` from `./util.js` (unchanged usage; **no `rnd()`**).
- Produces (new exports): `RIVERS` (array of `{pts: [[x,z,bed,depth],...], w, x0,x1,z0,z1}`), `FAR_TRAIL` (`{pts: [[x,z,h],...], x0,x1,z0,z1}`), `riverDist(x,z) -> number`, `riverAt(x,z) -> [dist, waterY, depth]`. `heightAt` additionally blends FAR_TRAIL (masked to r>298) and carves rivers; `pathDist` includes FAR_TRAIL.

- [ ] **Step 1:** In `baseHeight`, wrap the mountain term: `h += pow(max(0,r-120),1.45)*.017*(.5+fbm(x*.018+4,z*.018))*smooth(-30,40,dx) * (1-smooth(305,395+90*east,r))` with `east=smooth(.35,1,Math.cos(ang))`, `ang=Math.atan2(z,x)`. Then, after the lake blend and before the cliff return, add the far layer exactly as in the spec (plain / NE valley / ridges / outer ring with east gap), blended by `far=smooth(310,355,r)*smooth(20,60,dx)`: `h = h*(1-far)+fh*far`. Copy the formulas from the spec/prototype verbatim.
- [ ] **Step 2:** Add `RIVERS` (ctrl points + widths + ford index from the spec), the densify/bed-height builder (`s=min(baseHeight-0.2, prev-0.12)` clamped ≥ `baseHeight-1.4`, depth 1.1, ford 0.35; water = `bed+depth-.35`), `riverDist`, `riverAt`, and the carve in `heightAt` (`k=1-smooth(w,w+5,d)`, `h=h*(1-k)+min(h,bh)*k`, bbox check). Reuse the existing `onPoly` (extend it to also interpolate a 4th element `depth`, default 1.1).
- [ ] **Step 3:** Add `FAR_TRAIL` from ctrl `[[302,4],[330,8],[368,12],[408,16],[446,18],[468,16]]` using the same densify + 2-pass smoothing + 3-pass slope clamp as `MTRAILS` (factor that shared logic into a helper if clean, without changing MTRAILS' output); blend in `heightAt` only when `r>298`: `if(d<9) h=hp+(h-hp)*smooth(2,8,d)*smooth(300,312,r)`; add it to `pathDist`.
- [ ] **Step 4:** Run `node tools/world-check.mjs` → baseline diff exactly 0 for r<300, all structural assertions `OK` (camp/pass/exit ranges per Task 1). Also print sample heights and eyeball against the map expectations (pass ≈ 13 at (340,8), plain ≈ 6 at (470,16), ring ≈ 26 at (0,700), exit ≈ 4 at (700,-30)).
- [ ] **Step 5:** `node --input-type=module --check < web/js/world.js` passes.
- [ ] **Step 6:** Commit: `git add web/js/world.js && git commit -m "feat: far world heightfield — plain, valley, outer ring, rivers, pass trail"`.

### Task 3: `terrain.js` — bigger mesh + river colors

**Files:**
- Modify: `web/js/terrain.js`

**Interfaces:**
- Consumes: `riverDist, riverAt, heightAt, pathDist` from `./world.js`.

- [ ] **Step 1:** `const TS=1600, TSEG=isMobile?280:620;` (was 640 / 200:340).
- [ ] **Step 2:** In the vertex color loop, add river coloring: `const [rd,rw,dep]=riverAt(x,z);` — if `y < rw` (under water) lerp toward a gravel/sand bed color by `smooth(rw-.5, rw+.3, y)` inverse… concretely: bed color where `rw-y>0` → lerp SAND→DIRT by depth; banks: wet sand band for `rd < w+3` via `riverDist`: `c.lerp(WETSAND, (1-smooth(2,5,rd))*.8*(y<rw+1.5?1:.3))`. Keep the existing snow/rock/path rules; they already cover the outer ring.
- [ ] **Step 3:** `node --input-type=module --check < web/js/terrain.js` passes. Visual check happens in Task 9.
- [ ] **Step 4:** Commit.

### Task 4: Walk limits + river collision — `collision.js`, `controls.js`, `animals.js`

**Files:**
- Modify: `web/js/collision.js`, `web/js/controls.js`, `web/js/animals.js`

**Interfaces:**
- Produces: `export const WALK_R=735` in `collision.js`; `blocked(x,z,y)` also returns true when `riverAt(x,z)` gives `d < R.w*0.55`-ish and `depth > .45` (the ford, depth .35, stays crossable) — implement via `riverAt`: `const [rd,rw,dep]=riverAt(x,z); if(dep>.45 && rd<3.2) return true;` (use the per-river width via a small loop over RIVERS or just the 3.2–4.0 range; keep it cheap with bbox pre-check inside riverAt).
- `controls.js`: import `WALK_R` from `./collision.js`; `PANR=300` → `PANR=700`; `findGround` clamp `r>300` → `r>WALK_R`.
- `animals.js`: `rideFly` clamp `r>300` → `r>WALK_R` (import it).

- [ ] **Step 1:** Make the three edits.
- [ ] **Step 2:** `node --input-type=module --check` on all three files passes; `node tools/world-check.mjs` still OK (untouched).
- [ ] **Step 3:** Commit.

### Task 5: Reuse exports in `trees.js` / `grass.js`

**Files:**
- Modify: `web/js/trees.js`, `web/js/grass.js`

**Interfaces:**
- Produces: `export const treeCrown=crown, treeTrunk=trunk, treeCrownMat=crownMat;` in `trees.js` (rename locals or export aliases — do not change existing behavior); `export const grassBlade=blade, grassMat` in `grass.js` (grassMat is currently a `const` local — export it).

- [ ] **Step 1:** Add the export aliases; no other changes.
- [ ] **Step 2:** Syntax-check both files; commit.

### Task 6: Emitter registry in `effects.js`

**Files:**
- Modify: `web/js/effects.js`

**Interfaces:**
- Produces: `export function addEmitter(type,x,y,z)` with `type` `'smoke' | 'flame'`. It creates its own `particles(...)` points cloud + data array (smoke: 26 particles, size 2.2, opacity .3; flame: 24 particles, size .6, additive) and pushes `{type,x,y,z,pts,data}` into an exported-or-module-level `emitters` array; `updateEffects` loops `emitters` after the existing hardcoded blocks using the same math as the chimney-smoke / campfire-flame loops (smoke: rise `dt*(1.1-cur.wind*.4)`, drift `dt*(.2+cur.wind*2.4)`, fade `sin(life*PI)*sLight`; flame: `dt*(1.4+rand*.6)`, up `.25+l*1.5*fireScale`, color `(1-l)*fireScale*.55` ramp). Existing emitters unchanged.

- [ ] **Step 1:** Implement `addEmitter` + the loop in `updateEffects`.
- [ ] **Step 2:** Syntax check; commit.

### Task 7: New module `web/js/valley.js` — yurts, camp, rivers' water, plain flora

**Files:**
- Create: `web/js/valley.js`

**Interfaces:**
- Consumes: `rnd, hash, isMobile, smooth, clamp` from `./util.js`; `RIVERS, FAR_TRAIL, riverDist, riverAt, heightAt, pathDist, SEA` from `./world.js`; `scene` from `./renderer.js`; `std, weatherize` from `./materials.js`; `BOXES, CIRCLES` from `./collision.js`; `add, logMat` from `./cabin.js`; `canvasTex` from `./textures.js`; `water` from `./terrain.js` (to share its material); `treeCrown, treeTrunk, treeCrownMat` from `./trees.js`; `grassBlade, grassMat` from `./grass.js`; `addEmitter` from `./effects.js`; `cur` from `./state.js`.
- Produces: `export function updateValley(dt,env)` — flickers the camp point light like `fireLight` in `environment.js`: `intensity=(1.3+env.night*1.6)*(1-cur.rain*.55)*(.85+.15*sin(state.T*13)*sin(state.T*7.3)+...)` (import `state` too).

Content (all placement via `rnd()` — this module is imported last, so the existing world's sequence is unaffected):
- [ ] **Step 1:** Yurts: 6 positions on a ring around camp center `(468,16)` (angles `k/6*2π+.35`, radius `13+(k%2)*6`), each a `THREE.Group` with: lattice wall `CylinderGeometry(3,3,2.2,24,1,true)` + `canvasTex` diamond-lattice texture (DoubleSide), felt roof `ConeGeometry(3.6,2.2,24,1,true)` (off-white `std`), crown `CylinderGeometry(.35,.35,.5,12)` at roof top, door box on the camp-facing side; `CIRCLES.push([x,z,3.3])` per yurt; group at `heightAt`.
- [ ] **Step 2:** Fence: posts every ~2.2 m on a circle r=30 around the camp + two `THREE.Line` rope rings at heights .7/1.1; `CIRCLES` for posts (r .1).
- [ ] **Step 3:** Two fire pits (9-stone ring + 3 charred logs, like `campfire.js`); the central one gets `addEmitter('flame',x,y+.3,z)`, `addEmitter('smoke',x,y+1.2,z)`, and a `PointLight(0xff8a3a, 2, 22, 2)` (castShadow false) stored for `updateValley`; `CIRCLES` for the pits.
- [ ] **Step 4:** River water: for each `RIVERS`, build a ribbon `BufferGeometry` — two vertices per polyline point, lateral offset ±w perpendicular, `y = waterY = bed+depth-.35` — with `water.material` (shared with the lake, so `environment.js` colors it), `frustumCulled=false`, added to `scene`.
- [ ] **Step 5:** Plain trees: `InstancedMesh(treeCrown, treeCrownMat, N)` + trunks, `N=isMobile?150:320`; sample `r=360+rnd()*280` angles all around (skip `dx<60` i.e. sea side via `x-coastEdge(z)` — import `coastEdge`), reject `riverDist<7`, `pathDist<4.5`, `y<SEA+2 || y>30`, slope via `heightAt` finite diff > .55, within 34 of camp; per-instance color like `trees.js` (`c.setHSL(...)`); `CIRCLES.push([x,z,.35*s])`; `castShadow=true`, `frustumCulled=false`.
- [ ] **Step 6:** Plain grass: `InstancedMesh(grassBlade, grassMat, G)`, `G=isMobile?6000:14000`, `r=355+rnd()*295`, reject `riverDist<2.2`, `pathDist<1`, camp radius 32, `x-coastEdge(z)<60`; same matrix/color pattern as `grass.js`.
- [ ] **Step 7:** Riverbank rocks: walk each river's points every ~7 m, place `DodecahedronGeometry` (hash-based sizes/rotations like `props.js`) at lateral offset `w+hash*4`, `y=heightAt`, skip if underwater or `pathDist<4`; `CIRCLES` only for rocks within r<200 of camp.
- [ ] **Step 8:** Cairns along `FAR_TRAIL` every 7th point (same pattern as `props.js` MTRAILS cairns), offset ±2.6 alternating, skip r<24.
- [ ] **Step 9:** `updateValley(dt,env)` with the light flicker; export it.
- [ ] **Step 10:** `node --input-type=module --check < web/js/valley.js` passes. Commit.

### Task 8: Wiring — `main.js`, `sky.js`

**Files:**
- Modify: `web/js/main.js`, `web/js/sky.js`

- [ ] **Step 1:** In `main.js`, after `import {updateAnimals,animals} from './animals.js';` add `import {updateValley} from './valley.js';` (must stay the **last** import), and in `frame()` after `updateAnimals(dt,env);` add `updateValley(dt,env);`.
- [ ] **Step 2:** In `sky.js`, sky sphere radius `1200` → `1600`.
- [ ] **Step 3:** Syntax-check both; `node tools/world-check.mjs` still OK; commit.

### Task 9: Browser verification

**Files:**
- None (verification only); screenshots to `/tmp/opencode/shot_*.png`.

- [ ] **Step 1:** Serve: `python3 -m http.server -d web 8123` (background). Drive with the headless browser (playwright tools / OpenChamber web panel): open `http://localhost:8123`, wait for the loader to hide, collect console errors — must be none.
- [ ] **Step 2:** Screenshot 1: home orbit view (world unchanged at the clearing — compare with a pre-change screenshot if desired).
- [ ] **Step 3:** In-page probes via `page.evaluate`: `const w=await import('/js/world.js'); const c=await import('/js/collision.js');` then assert: `c.blocked(...river center...)` true, `c.blocked(...ford at ~(482,22)...)` false, `c.blocked(800,0,0)` true (beyond WALK_R), pass walkable: for consecutive `w.FAR_TRAIL.pts` assert `!c.tooSteep(...)` between them. Print results.
- [ ] **Step 4:** Screenshot 2: first-person at the yurt camp — `__lichtung.player.x=468; player.z=16; player.y=w.heightAt(468,16); __lichtung.setMode('fp')`, wait ~2 s (drop animation), screenshot; also an orbit shot looking at the camp from the pass (`setMode('orbit')` then pan is not exposed — instead set player position, `setMode('fp')`, then `setMode('orbit')` which targets the player). Screenshot 3: from the plain looking at the outer ring.
- [ ] **Step 5:** Perf: measure load-to-first-frame (performance.now around loader hide) and fps over 3 s (`requestAnimationFrame` counter) at the camp and at home; log both. If fps < ~30 on desktop, lower `TSEG` in Task 3 and re-measure.
- [ ] **Step 6:** Show the screenshots (openchamber_render with the PNG paths) and fix anything visually broken (river ribbons floating/sunken, yurt sinking, trail gaps) in the owning task, then commit fixes.

---

## Execution handoff
Plan saved. Review it, then pick an execution approach (subagent-driven per task, or native in this session) — tasks 2→9 are sequential and interface-tight, so I recommend **native**.
