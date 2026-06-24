# Kingston Avenue — Excavation Stage Viewer

An interactive 3D web viewer for the Kingston Avenue excavation sequence, built with [Three.js](https://threejs.org/). Models are exported from Blender as glTF/GLB.

## Features

- **8 construction stages** (NGL → Slab) selectable via dropdown or Prev/Next
- **Per-element layer toggles** — show/hide soil, bored piers, SPW pile walls, retaining walls, capping beams, slab, shotcrete (selection persists across stages)
- **Soil X-ray slider** — fade the terrain from solid to transparent to reveal the piles and walls embedded in the ground
- **Overlays:**
  - **Excavator** — repositions per stage (sits on the surface at NGL, follows the dig down; hidden in stages with no excavator)
  - **Neighbour + Walls** — the neighbouring house, its ground, and the boundary/retaining walls
- **Preset views** (Iso / Top / Front / Side) plus orbit / pan / zoom

## Running locally

The viewer loads `.glb` models via `fetch`, so it must be served over HTTP (opening `index.html` directly with `file://` will not work).

```bash
python3 -m http.server 8777
# then open http://localhost:8777
```

## Hosting (GitHub Pages)

This is a static site. Enable **Settings → Pages → Deploy from branch → `main` / root**, and it will be served at `https://rmit-ve-learningexperience.github.io/Kingston-Avenue/`.

## Project structure

```
index.html        UI layout
style.css         styling
main.js           Three.js viewer + controls
models/
  stages.json     stage manifest (labels, files, per-stage excavator offsets)
  *.glb           per-stage geometry + excavator + neighbour overlays
```

## Notes

- The excavator is exported once and repositioned per stage via offsets in `stages.json` (keeps the download small).
- The neighbour house uses flat representative colours because its source materials are procedural (glTF cannot carry procedural node materials).
- Excavator meshes use Draco compression; the decoder is loaded from a CDN.
