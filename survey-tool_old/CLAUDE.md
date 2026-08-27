# survey-tool/CLAUDE.md

Guidance for the survey tool UI. See the root `CLAUDE.md` for architecture; this file records the
UI review from 2026-08-27 and the direction agreed for de-cluttering it. The direction below was implemented as `survey-tool_v3/` on 2026-08-27; this folder is
the original UI, kept unchanged for comparison.

## UI review (2026-08-27) — why it feels busy

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
8. ~~A vestigial control at top-right (blue dot under the view cube)~~ — correction: this is the
   working Iso-view button of the orientation gizmo; kept.

## Direction for de-cluttering — implemented in `survey-tool_v3/` (2026-08-27)

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

- Changes in `survey-tool/` must never touch the main viewer (root `index.html`/`main.js`/`style.css`).
- Verify visually: serve from repo root (`python3 -m http.server 8777`), open
  `http://localhost:8777/survey-tool/`, check both the default load and the "everything on" state
  (level plane + gizmo + all staffs) at ~1440×900 and a phone-width layout.
