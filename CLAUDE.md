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

`models/stages.json` is the manifest. It lists each stage (id, label, file path, mesh count, file size, and a per-stage `excavator` offset). The viewer fetches this on load, populates the stage selector, then calls `loadStage(idx)` which async-loads the corresponding GLB.

### Three.js scene structure

- **Stage models** (`*.glb`) are loaded one at a time. The previous root is fully disposed (geometry + materials + `scene.remove`) before the new one is added. `currentRoot` always points to the live root.
- **Overlays** (`excavator.glb`, `neighbour.glb`) are lazy-loaded on first toggle and persist in the scene across stage changes. The excavator's `position`/`quaternion` is overwritten per stage from `stages.json`.
- **Layer system**: `root.traverse()` on load reads `o.userData.cat` from each mesh and buckets it into `groups[cat]`. `buildLayerPanel()` then creates toggle rows and sets `mesh.visible` per category. The `hidden` dict persists category visibility across stage loads.
- **Soil X-ray**: soil meshes' materials are collected into `soilMats[]` during traverse and their `opacity`/`depthWrite` are driven by the slider.
- **`modelBounds`** (a `THREE.Box3`) is set from the first loaded stage and used by all `frameView()` calls for camera positioning.

### Category IDs

Meshes in the GLBs must have `userData.cat` set to one of: `soil`, `piers`, `spw_wall`, `retaining_wall`, `capping_beam`, `slab`, `shotcrete`, `excavator`, `neighbour`. Anything else lands in `other`. This is set in Blender before export.

### Deployment

GitHub Pages — push to `main`, the site deploys automatically from the repo root at `https://rmit-ve-learningexperience.github.io/Kingston-Avenue/`.
