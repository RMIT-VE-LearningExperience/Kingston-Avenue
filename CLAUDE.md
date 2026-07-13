# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running locally

GLB models are fetched over HTTP, so `file://` won't work. Serve from the repo root:

```bash
python3 -m http.server 8777
# open http://localhost:8777
```

No build step, no bundler, no dependencies to install. Everything is vanilla JS with ES module imports resolved via an importmap in `index.html` pointing at `unpkg.com`.

## Architecture

**Single-page static site** — `index.html` / `style.css` / `main.js` + GLB model files. No framework, no npm.

### Data flow

`models/stages.json` is the manifest. It lists each stage (id, label, file path, mesh count, file size, and a per-stage `excavator` offset). The viewer fetches this on load, builds the stage timeline scrubber at the bottom of the viewport, then calls `loadStage(idx)` which async-loads the corresponding GLB. Bump `ASSET_V` in `main.js` whenever `.glb` files change so browsers refetch them.

### Three.js scene structure

- Everything model-related lives under **`vrWorld`** (a `THREE.Group`), which WebXR sessions scale/rotate/reposition; it is identity outside VR. Stage roots, overlays, and hole-marker groups are all children of `vrWorld`.
- **Stage models** (`*.glb`) are loaded one at a time. The previous root is fully disposed (geometry + materials + removed from parent) before the new one is added. `currentRoot` always points to the live root.
- **Overlays** (`excavator.glb`, `neighbour.glb`, `neighbour_left.glb`) are lazy-loaded on first toggle and persist across stage changes. The excavator's `position`/`quaternion` is overwritten per stage from `stages.json`.
- **Layer system**: `root.traverse()` on load reads `o.userData.cat` from each mesh and buckets it into `groups[cat]`. `buildLayerPanel()` creates toggle rows and sets `mesh.visible` per category. The `hidden` dict persists category visibility across stage loads. `STAGE_CATEGORY_EXCLUSIONS` suppresses categories per stage id before bucketing (see SPW4 note below).
- **Soil X-ray**: soil meshes' materials are collected into `soilMats[]` during traverse and driven by the opacity slider.
- **Intro reveal**: newly appearing categories (vs the previous stage) fade in via `introReveal()`; it dedupes shared materials globally so fast scrubbing can't leave them transparent.
- **Tools**: measurement pins (SVG overlay + raycast), level plane with draggable handle, WebXR entry, onboarding tour (`kingstonViewerOnboardingSeen` in localStorage).

### Category IDs

Meshes in the GLBs must have `userData.cat` set (done in Blender before export). Current ids: `soil`, `piers`, `spw_1`…`spw_5`, `spw_wall` (legacy grouped walls), `retaining_wall`, `capping_beam`, `slab`, `shotcrete_side`, `shotcrete_back`, `excavator`, `neighbour`, `neighbour_wall`. Anything else lands in `other`.

### Drilled hole markers (carved terrain)

When a pile layer's checkbox is off, its bore holes are carved out of the terrain as true negatives: the soil mesh is CSG-subtracted with one cylinder per pile (`three-bvh-csg` + `three-mesh-bvh`, added via the importmap) and the carved copy is swapped in for the original soil mesh (`applyTerrainHoles()` in `main.js`). Everything is derived from the loaded GLB at runtime — no data is hardcoded against the current exports, so re-exported models stay correct automatically:

- Pile meshes are clustered by XZ position into one hole per physical pile (`computeHoleClusters()`; `HOLE_CLUSTER_DIST` merges duplicates/segments). Meshes with a footprint wider than `HOLE_MAX_FOOTPRINT` (1 m) are skipped — pile categories also contain non-shaft geometry (soil-cover blocks, pier caps).
- Each cutting cylinder uses the pile's own footprint radius (SPW ≈ 0.45–0.49 m, SPW4 ≈ 0.60 m, piers ≈ 0.30 m) and runs from the terrain surface (raycast; or the pile top if higher) down to the pile toe, so buried pile tops still read as surface holes.
- The cylinders for all hidden pile layers are merged into a single brush (piles never overlap, so a merge is a valid union) and subtracted in one `Evaluator.evaluate()` call; cut faces get a dark shaft-wall material. Results are cached per combination of hidden layers and rebuilt per stage.
- Carved soil shares the original soil material instance, so the Soil X-ray slider keeps working on it. Carved meshes live under `vrWorld` (world-space geometry, identity transform outside VR) and are disposed on stage change — before `disposeRoot`, since they are not children of the stage root.
- `buildLayerPanel()` re-applies mesh visibility when it rebuilds, so `applyTerrainHoles()` must run after it in `loadStage`.
- Stage gating is by manifest index in `holeCatsForStage()`: `spw_1` (SPW1 RL 6.50) holes from stage 02 (CB1/SPW5+RTW1), all other pile categories from stage 04 (CB1/SPW2+3). Stages 00–01 get none. Categories suppressed by `STAGE_CATEGORY_EXCLUSIONS` never generate holes (they don't enter `groups`).

### Deployment

GitHub Pages — push to `main`, the site deploys automatically from the repo root at `https://rmit-ve-learningexperience.github.io/Kingston-Avenue/`.

## SPW4 staging correction

Source reference:

- `Kingston_Struct Engineer_Excavation Layout.pdf`
- Drawing `S02`, `Retention Layout Plan`, revision `A`

Finding:

- `SPW4` belongs with `CB2 / SPW4`, which is represented in the web viewer as stage `05 - CB2 / SPW4`.
- `SPW4` should not appear in stage `03 - SPW1`.
- The current `models/spw1.glb` export contains 21 meshes tagged with `extras.cat = "spw_4"`.

Temporary web fix:

- `main.js` contains `STAGE_CATEGORY_EXCLUSIONS`.
- It suppresses category `spw_4` only when loading stage id `spw1`.
- This keeps `SPW4` visible from stage `05 - CB2 / SPW4` onward.

Blender/source fix needed:

- Remove or exclude the `SPW4` objects from the stage 03 / `spw1.glb` export.
- Keep those `SPW4` objects in the stage 05 / `cb2_spw4.glb` export and later cumulative stages.
- After regenerating the GLBs, remove the temporary `spw1 -> spw_4` web exclusion from `main.js`.
