# Cabin upper floor, stairway and branch staging — design

Ticket: marxxxx/relax#1 (https://github.com/marxxxx/relax/issues/1)

## Intent

The cabin in "Lichtung" gets a full second storey you can walk through in first-person mode. Upstairs
there is a bedroom with a bed and a small desk, a bathroom with a candle-lit bathtub under a
skylight, and a balcony facing the sea. An indoor stairway connects the two floors. To make all of
it fit, the cabin gets bigger. The user also wants a staging page, so they can try feature branches
like this one in the browser before they are merged.

## Goals

1. **Bigger cabin, two full storeys.** The footprint grows from about 7 × 5.5 m to about
   **9 × 6.5 m**, with the porch and front door still facing the clearing (+z). Both storeys use
   the existing log-wall style. The gable roof keeps its ridge running east–west (along x) and sits
   one storey higher.
2. **Ground floor (user's decisions).**
   - The couch with furs stays on the **left (west) wall**.
   - The **fireplace moves to the right (east) wall, directly opposite the couch**, facing west into
     the room. Its stone chimney runs up the outside of the east gable, past the upper floor, to
     above the roof.
   - A **straight stair runs along the back wall** (−z). It starts near the west end, behind the
     end of the couch, and rises eastward to the middle of the cabin. This is option A in the
     agreed sketch: https://claude.ai/artifact/1Nf7hzMVWuWk8SRFJPMybf.
3. **Upper floor (user's decisions).**
   - **Bedroom on the west side:** a bed, a small desk, a window, and a door in the west gable out
     to the balcony.
   - **Small hall in the middle**, where the stair arrives, with a railing around the stair
     opening.
   - **Bathroom on the east side:** a bathtub with candles and a **skylight in the roof** above or
     near the tub.
   - **Balcony on the west gable, facing the sea** (−x), with a railing.
4. **Walkable.** In walk mode ("Hineingehen") the player can:
   - climb the stair and go down it again,
   - walk through the hall, the bedroom and the bathroom,
   - step out onto the balcony.

   Walls, furniture, railings, the stair opening and the balcony edge block movement on their own
   level only. Nothing upstairs blocks the ground floor, and nothing downstairs blocks the upper
   floor. You cannot fall off the balcony or into the stair opening.
5. **Indoor feel upstairs.** `state.indoor` (indoor audio and lighting blend) is 1 in all upstairs
   rooms and 0 on the balcony, as it is now for the ground floor and porch.
6. **Night.**
   - The new windows glow warm from outside at night, like the existing ones.
   - The bath candles flicker and give a small warm light.
   - The hearth fire, its particles and the chimney smoke move with the fireplace and chimney.
7. **Staging page.** Every pushed branch other than `main` is published on the existing GitHub
   Pages site at `/staging/<branch>/`. It updates automatically on each push, and drops off once
   the branch is deleted. `main` stays at the site root, unchanged. The user accepted that staging
   URLs are public, like the live site.
8. **End-to-end check.** The agent tests the feature in the running app with Playwright:
   - Start the local server (`python3 -m http.server -d web`).
   - Check the browser console for errors.
   - Take screenshots, kept outside the repo:
     - the exterior in orbit mode, by day and at night (glowing upper windows);
     - the ground floor, showing the fireplace opposite the couch, and the stair;
     - climbing the stair in walk mode (`window.__lichtung.player` can be used to position the
       player);
     - the bedroom (bed, desk, window);
     - the bathroom (tub, candles, skylight);
     - the view from the balcony toward the sea.
   - Confirm that collision stops you at the balcony railing and at the stair opening.
   - Shut the server down afterwards.

   If headless WebGL does not work, report that instead of blocking.

## Delivery (user's decision: two pull requests)

1. **Staging PR first.** Contains only the workflow changes for goal 7 and the `.gitignore` entry.
   The user merges it to `main`, after which every pushed branch is staged.
2. **Cabin PR second.** Contains everything else, on its own branch. Once PR 1 is on `main`, a
   push to this branch publishes it at `/staging/<branch>/` for the user to test.

Both PRs belong to the same ticket. The agent's call on naming: branches `<n>_branch_staging` and
`<n>_cabin_upper_floor`, with PR titles `<n>: Branch staging` and `<n>: Cabin upper floor`.

## Non-goals

- No new UI, buttons, or interactions (no opening doors, no light switches, no water in the tub).
- No change to the day/night, weather, audio or post-processing systems beyond what the new
  geometry needs.
- No other world changes: trees, lake, coast and trail stay where they are.

## Anti-goals (failure even if it technically works)

- **The world layout reshuffles.** Placement uses the shared seeded `rnd()` sequence (see
  `AGENTS.md`). Cabin and interior code must not add or remove `rnd()` calls, and the import
  order must not change. `Math.random()` is fine for cosmetic jitter, as `interior.js` already
  does.
- **The ground floor feels cramped or broken.** For example, the stair blocks a window or the
  door, or furniture clips into walls.
- **The stair is unwalkable or jerky in walk mode,** or the player snaps between floors.
- **A noticeably heavier frame on mobile.** New lights cast no shadows, and `isMobile` reductions
  are respected.
- **A staging setup that touches or breaks the `main` deployment at the site root.**

## Constraints

- Three.js **r128**, global `THREE`, plain ES modules in `web/`, no build step. Imports stay in
  the form `from './x.js'` so the deploy cache-busting regex still matches.
- Match the dense code style of the existing modules.
- Collision today is 2D (`BOXES`/`CIRCLES` in `collision.js`; `floorAt(x,z)` ignores height). It
  must become level-aware so the two floors and the stair work together.
- Code that depends on the old cabin's dimensions or fireplace position must follow the new
  layout:
  - `HX`/`HZ` and wall openings in `cabin.js`;
  - `floorAt`, `isInside` and the `tooSteep` exemption box in `collision.js`;
  - `FPX`/`FPZ`, beams, sun-shaft window quads, `hearthLight` and the chimney in `interior.js`;
  - hearth fire and chimney smoke particles in `effects.js`, which currently assume a fireplace
    facing +z and a fixed chimney top at `y=6.45, z=-3.17`;
  - the window glow light `winLight`;
  - the dirt patch around the cabin in `terrain.js`;
  - the orbit camera target and minimum distance in `controls.js`, so the taller cabin still
    frames well.
- The porch has to stay clear of the campfire at `FIRE = (5.5, 0, 7)`. The firewood stack
  currently outside the east wall must move, since the chimney now goes there.
- **GitHub Pages deploys only from the default branch by default** (the `github-pages`
  environment's branch protection). The staging design must work without loosening that
  setting. Suggested approach: keep `deploy.yml` running on `main` (push plus
  `workflow_dispatch`), and have it build the site root from `main` and `/staging/<branch>/`
  from every other remote branch. A small second workflow, triggered by pushes to non-`main`
  branches and by branch deletion, dispatches `deploy.yml` on `main` using `GITHUB_TOKEN` (which
  is allowed to trigger `workflow_dispatch`). The existing cache-busting `sed` steps apply to
  every copy.

## Settled during review (agent's calls unless marked)

- **Upper storey is full height:** full walls, about the same height as the ground floor, with the
  gable roof on top. There is no knee wall or attic slope. The user asked for a "full second
  storey".
- **The cabin stays centred on the origin** and grows symmetrically (`HX`≈4.5, `HZ`≈3.25). The
  walk-mode spawn at (0, 8.5) stays unchanged.
- **The skylight is a glass pane** set into the roof. Precipitation does not fall through it.
- **The ground floor keeps a back window,** moved to the east half of the back wall clear of the
  stair, or another position the builder picks.
- **The floor level is derived from the player's y**, not stored as a separate field. A
  positioned `player` (debug handle) settles onto the floor below it. The stair has a
  rise/run of about 0.6–0.75.
- **Staging branch paths:** the branch name is lower-cased, and `/` and other non `[a-z0-9._-]`
  characters become `-`.
- **Staging versions:** each staged copy is cache-busted with its own branch head's short SHA.
- **Staging is eventually consistent:** each deploy rebuilds root + all branches from scratch, so
  the latest run wins.

## Left to the builder

- Exact dimensions, step count and rise of the stair. It must be walkable at a comfortable,
  cabin-like steepness.
- Exact placement of furniture, windows (including where the back window moves), the balcony
  door, the candles and the skylight. It must fit the agreed layout.
- New spots for the side table with the lantern, the shelf, the rug and the firewood basket.
- Materials and textures. Reuse the existing ones (`logTex`, `plankTex`, `stoneTex`, furs,
  `frameMat`, `glowMat`).
- How the collision data model is extended (for example, a y-range per box).
- Whether the skylight pane takes on the rain or snow look.
- Adding `.superpowers/` to `.gitignore`. This is the agent's call: brainstorming mockups landed
  there.
