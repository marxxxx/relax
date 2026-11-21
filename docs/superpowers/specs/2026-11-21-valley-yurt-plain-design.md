# Design: Valley & yurt plain beyond the mountains (2026-11-21)

Approved in chat on 2026-11-21, visualized with top-down maps rendered from the real
`heightAt` (`/tmp/opencode/map_current.png`, `/tmp/opencode/map_proposed.png`).

## Intent
Extend the world past the existing mountain ring (r ≈ 120–300) with a walkable far
side to the **east**: a wide plain, a NE valley, an outer mountain ring, rivers, and a
yurt camp. Fully walkable from the clearing via a wide pass on the east.

## Goals
- Plain ~350 m across at r ≈ 360–620, height ~4–8 m; outer ring peaking ~50–70 m at
  r ≈ 650–760 with snow (existing `y > 34` snow rule); NE valley floor ~3 m with
  flanking ridges.
- 3 rivers carved into `heightAt` (main river exits the map through a gap in the
  outer ring due east; SE river; valley river; both join the main one), ribbon water
  meshes sharing the lake material.
- ~6 procedural yurts + pole/rope fence + 2 fire pits (one with flame + smoke +
  point light) at camp center ≈ (468, 16); one shallow ford where the pass trail
  crosses the main river.
- Plain trees and grass; cairns marking the pass trail.
- Everything walkable: walk radius 306 → ~735, pass trail slope-clamped ≤ 1:2.

## Non-goals
No yurt interiors, no bridge, no new animal species, no weather/audio changes, no
changes to anything at r < ~305 (verified bit-identical).

## Constraints
- `world.js` `heightAt` is the single source of truth (terrain mesh, collision,
  animals, audio derive from it).
- One shared seeded `rnd()` sequence: the new module (`web/js/valley.js`) must be
  imported **last** in `main.js` and by no earlier module.
- Three.js r128 global `THREE`; no build step; imports must stay `from './x.js'`
  (single quotes, relative) for the deploy cache-busting regex.
- UI text is German. `isMobile` reduces counts/shadows. Deploy publishes only `web/`.

## Approach (chosen)
**A: enlarge the single heightfield + one new far-world module.** (B: separate
floating terrain mesh — breaks the `heightAt` rule. C: just raise the walk radius —
no plain. Both rejected.)

## Design details (pinned values; prototype in /tmp/opencode/world_prop.js)
`baseHeight` changes, all masked to r > 305:
- inner ring term × `(1 - smooth(305, 395+90·east, r))`, `east = smooth(.35,1,cos(ang))`
  → the ring falls away beyond ~305, stretched into a wide pass on the east.
- far mask `far = smooth(310,355,r) · smooth(20,60,dx)` (inland only; west stays sea):
  - plain `fh = 5.5 + (fbm(x*.018+31, z*.018+13)-.5)*4`
  - NE valley: `vA = cos(ang-.62)`, `vM = smooth(380,460,r)·smooth(660,520,r)·smooth(.3,.75,vA)`,
    `fh -= 4.5·vM·(.6+.8·fbm(x*.03+17, z*.03+5))`
  - flanking ridges: `rg = smooth(400,480,r)·smooth(700,560,r)`,
    `fh += 6·rg·(smooth(.6,.95,cos(ang-1.45)) + smooth(.6,.95,cos(ang+.25)))`
  - outer ring: `fh += pow(max(0,r-615),1.4)·.05·(.55+.9·fbm(x*.013+9,z*.013+5))·gap`,
    `gap = 1-smooth(.78,.96,cos(ang))` (gap due east for the river exit)
  - `h = h·(1-far) + fh·far`
- Rivers `RIVERS`: control points (main: (500,470)…(782,-18) with ford at ctrl idx 5;
  SE: (560,-430)…(480,-6); valley: (420,560)…(446,150)); widths 4.0/3.2/2.8; densified
  ~6 m; per-point surface `s = min(baseHeight-0.2, prev-0.12)` clamped ≥ `baseHeight-1.4`;
  depth 1.1 (ford 0.35); stored as `[x, z, bed=s-depth, depth]`; water level `= bed+depth-.35`.
  Carve in `heightAt`: `k = 1-smooth(w, w+5, d)`, `h = h·(1-k) + min(h, bed)·k`.
- `FAR_TRAIL` ctrl `[[302,4],[330,8],[368,12],[408,16],[446,18],[468,16]]`, same
  densify + ≤1:2 slope-clamp machinery as `MTRAILS`, blended in `heightAt` only for
  r > 298 with blend mask `smooth(300,312,r)`, `d < 9`; included in `pathDist`.
- Exports added: `RIVERS`, `FAR_TRAIL`, `riverDist(x,z)`, `riverAt(x,z) -> [dist, waterY, depth]`.

Other files: `terrain.js` mesh 640→1600, segments 340→620 desktop / 200→280 mobile,
river bed/bank colors from `riverAt`/`riverDist`; `collision.js` walk radius → 735
(`export const WALK_R=735`) + river block where depth > .45 and `d < w·.55` (ford stays
crossable); `controls.js` `PANR` 300→700, `findGround` clamp → `WALK_R`; `animals.js`
ride-fly clamp 300→`WALK_R`; `sky.js` sphere 1200→1600; `trees.js`/`grass.js` export
their geometries/materials for reuse; `effects.js` emitter registry
(`addEmitter(type,x,y,z)`, types `'smoke'|'flame'`); new `valley.js` (yurts, fence,
fires, light, river ribbons sharing `water.material`, plain trees/grass, riverbank
rocks, cairns, `updateValley(dt,env)`) imported last in `main.js`, called after
`updateAnimals`.

## Verification
- `tools/world-check.mjs` (node, stubs THREE/matchMedia): `heightAt` at r<300 identical
  to `tools/world-baseline.json` (captured before changes); river water surface
  non-increasing downstream; bed ≤ terrain; FAR_TRAIL consecutive slope ≤ 0.5.
- Serve `web/`, headless browser: console clean, screenshots (home orbit, fp at the
  camp), probes via `window.__lichtung` + dynamic `import('./js/world.js')` (blocked() at
  river/ford, pass slopes), load time + fps.

## Calls made
East pass (not north); ford instead of bridge; one extra point light at the camp fire;
smoke/flame via effects registry; WebGL1 fallback may fog the plain heavily (accepted).
