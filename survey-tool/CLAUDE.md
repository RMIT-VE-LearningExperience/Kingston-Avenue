# survey-tool/CLAUDE.md

Guidance for the survey tool UI (the V2 mode-based redesign, promoted to `survey-tool/` on 2026-08-27; the original UI is kept in `survey-tool_old/`). See the root `CLAUDE.md` for architecture.

Keep changes scoped to `survey-tool/` unless explicitly asked otherwise.

## V2 direction

Implemented in this fork:

- Mode-based sidebar: `Survey`, `Display`, and `Measure`.
- Survey-first default view with one primary action: move the dumpy level.
- Compact staff rows with a sticky readability summary above the list.
- E-staff notation moved out of the always-visible content and into a help button.
- Level plane, boundary, and setout grid split into separate display toggles.
- Title boundary uses the primary S02 parcel dimensions (29.57 m north, 16.76 m east,
  33.53 m south) instead of the soil convex hull; setout axes are clipped to that parcel.
- Measurement moved into its own panel rather than duplicated in the viewport toolbar.
- Tripod transform gizmo hides while the scope inset is open.

Remaining design rule: keep the 3D canvas dominant and avoid showing every training tool at once.

## UI review of the original tool (2026-08-27) — why it felt busy

Observed on a 1440×900 desktop viewport, default load and with level plane + gizmo + all staffs on.

### Sidebar (the main culprit)

1. **Three competing "primary" buttons stacked at the top** in two accent colours: blue
   "Show Level Plane", orange "Move dumpy level", orange-filled "Move" toggle. Orange is used for
   both *hover border* and *active state*, so "this is on" and "this is important" look the same.
   "Show all" in the staff group is also orange-active by default → four highlighted controls
   before the user has done anything.
2. **Staff list is 8 tall cards** (~42 px + gaps ≈ 400 px), each with checkbox, name, two-line
   status and a Read button — most Read buttons disabled/greyed. ~24 interactive-looking elements
   for what is essentially a checklist. The panel overflows at 900 px height and the summary line
   ("2 of 8 readable — relocate the tripod…") is pushed off-screen — the one line a student most
   needs.
3. **Redundancy**: level plane is both the big sidebar button and the layers icon in the viewport
   stack; "Move dumpy level" is a toggle + Move/Rotate sub-buttons + a hint paragraph; the
   "E-staff notation" callout is permanent reference text that steals list space every session.
4. **Flat, tiny type scale**: most of the panel is 10–11 px (subtitles, legend, readings, Read
   buttons, hint). Uniform size = no hierarchy = reads as dense rather than organised.
5. **Nested chrome**: bordered `details` group → tinted subsection → tinted card → button. Three
   layers of boxes around each control.

### Viewport

6. With the level plane on, everything draws at once: blue plane, white dashed boundary, slab
   outline, five dashed setout grid lines with lettered bubbles, orange contour, eight staffs +
   sight lines, and a full RGB translate gizmo. The gizmo's red/blue arrows are the loudest thing on
   screen even though the staff readings are the point.
7. Setout grid, title boundary and slab outline share the same dashed-white weight/colour — three
   meanings, one visual style.
8. The Iso dot on the orientation gizmo rotated with the axes, was unlabelled, and Reset framed a
   different (un-rotated, zoomed-out) view than the opening one. Fixed: a fixed labelled ISO pill
   below the axes, and `frameView('iso')` always reproduces the opening view.

## Direction for de-cluttering

- **One accent for "active"**; a different treatment (filled, not bordered) for the single primary
  action of the current step. Default "Show all" to a neutral state.
- **Compact staff rows** (~28 px): checkbox · code · reading in colour. Move "Read" to a single
  button that acts on the selected row (or make the row itself the trigger). Fold the E-staff
  legend into the help tour / a tooltip.
- **Make the "N of 8 readable" summary sticky** at the top of the staff group, not at the bottom.
- **Separate toggles** for level plane, title boundary and setout grid inside "Model display";
  off by default except the plane. Give the grid a distinct lighter/thinner style than the boundary.
- **Hide the transform gizmo while the scope inset is open**; consider a smaller gizmo scale.
- **Bump base panel type to 12–13 px** and drop one level of box nesting.

## Working rules for UI changes here

- Changes in `survey-tool/` must never touch the main viewer or `survey-tool_old/`.
- Verify visually: serve from repo root (`python3 -m http.server 8777`), open
  `http://localhost:8777/survey-tool/`, check both the default load and the "everything on" state
  (level plane + gizmo + all staffs) at ~1440×900 and a phone-width layout.
