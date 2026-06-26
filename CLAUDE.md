# Kingston Viewer Notes

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
