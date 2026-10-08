# Scene authoring guide

How to add a scene to AgriTech 3D. **The reference implementation is
`src/modules/engine/four-stroke/`. Read all of its files before writing a scene, and match
its quality and conventions.**

## 1. Where a scene lives

Each scene sits in its own folder:

```
src/modules/<moduleId>/<sceneId>/
  index.tsx     default export: SceneDef (required)
  model.ts      constants, zustand param store, `live` object, pure helpers
  geometry.ts   OPTIONAL. Worker-safe: exports buildStatic(); no React, no DOM, no stores with side effects
  Scene3D.tsx   the 3D viewport (Parts, animation)
  Panel.tsx     the Controls tab (live readouts, sliders, charts, working, exam presets)
  *.test.ts     tests for anything scene-specific
```

- `<moduleId>` and `<sceneId>` must match `src/modules/catalog.ts` exactly. The catalog
  discovers `index.tsx` automatically; **do not edit catalog.ts**.
- Shared physics goes in `src/physics/<topic>.ts`, with `src/physics/<topic>.test.ts` beside it.
  Only create a physics file your brief assigns you.

## 2. SceneDef (`src/modules/types.ts`)

| Field | What to supply |
|---|---|
| `id` | Same as the catalog scene id. |
| `title`, `summary` | Plain, accurate text. |
| `Viewport` | The 3D component. |
| `Panel` | The Controls-tab component. |
| `camera` | `{ position, target }` in metres, framing the whole model in a near-square viewport. |
| `extent` | Model size in metres. It sizes helpers, the grid and camera limits. |
| `floorY` | The floor level, i.e. the bottom of the model. |
| `hatchScale` | About `extent / 150`. |
| `timeScale` | Slow motion. Choose it so the motion is easy to follow. |
| `cutPresets` | 2–5 meaningful sections. Normals point INTO the removed side. |
| `defaultPreset` | The preset applied on entry. |
| `cites` | Note references for the scene as a whole. |
| `reset` | Restores the default parameters. |
| `applyParams` | Used by tours. |
| `tour` | **5–9 steps**: camera pose, `select`, `cut` preset id, `explode`, `xray`, `params`, `cites`. |
| `prepare` | Only if you have `geometry.ts`. Build in the worker:<br>`prepare: () => buildGeometry('<moduleId>/<folder>', buildStatic).then((g) => { ready = g })`<br>See `engine/four-stroke/geometry.ts` (`prepareEngineGeometry`) and copy that pattern. |

## 3. Parts (`src/render/Part.tsx`)

- Wrap geometry in `<Part id name material role info cites explode>` and draw with `<PartMesh geometry material?>`.
- `id`s must be **unique within the scene**. Nest Parts to build the parts tree.
- **Roles:**

| Role | Use for | Default when cut |
|---|---|---|
| `housing` | Castings and covers | Sectioned and hatched |
| `static` | Internal stationary parts | Sectioned |
| `fluid` | Oil, coolant, gas | Sectioned, opaque fill |
| `moving` | Shafts, gears, pistons, links | Left whole (museum cutaway); "Section everything" cuts them too |

- `cut={false}` keeps a subtree whole, e.g. springs, external accessories, anything not watertight.
- `info`: `{ summary, role (its function), details? }`. Write it from the notes, short and exact.
- `cites`: use `SRC.*` or `cite(course, file, where)` from `src/content/citations.ts`.
  - Take file names and pages from `docs/notes-inventory/*.md`.
  - **Never invent a citation.**
- `beyondNotes`: mark anything not in the notes. Add standard textbook detail only when it is needed for the mechanism to make sense.
- Materials are the keys of `MATERIALS` in `src/render/materials.ts`:
  - **Metals:** castIron, steel, steelMatte (broad flat machined faces such as gear sides), steelDark, chrome, forged, aluminium, bronze, brass, copper, bearing, galvanised.
  - **Non-metals:** rubber, friction, gasket, ceramic, plastic, wood, leather, nylon, concrete.
  - **Paints:** paintGreen, paintYellow, paintRed, paintGrey, paintBlack, paintBlue, paintOrange.
  - **Fluids and transparent:** glass, oil, hydraulicOil, coolant, fuel, water.
  - **Materials in bulk:** soil, grain, crop, straw.
  - For a colour that changes every frame, use `createDynamicCutMaterial` (see the gas in four-stroke).
- **Labels:** `<PartLabel partId at={[x,y,z]} />` for the 6–12 most important parts.

## 4. Geometry rules

- **Frame:** metres, Y up. Use real dimensions from the notes where they exist; otherwise use typical values and note them in `details`.
- **Solids must be closed (watertight) and outward-facing**, or section caps break. Use the tested generators:
  - `@/geometry`: lathe, cylinder, tube, box, roundedBox, roundedRect, extrude, extrudeTwisted, gear, ringGear, gearOutline, pipe, helixSpring, cam, camOutline, csg, mat4, xform, merge.
  - `@/geometry/parts`: loft, bevelGear, bevelPair, splineShaft, sprocket, sprocketRadius, loopPath (belt/chain path with wrap angles), beltBand, chainLink, tyre, rim, hexBolt, torus.
- **Lathe profiles** are (r, y) pairs in **counter-clockwise** order: solid on the left as you walk the outline. See the piston in four-stroke.
- **CSG** (`csg`) is slow, so use it **only inside `buildStatic()`** in `geometry.ts`, which runs in the web worker.
- Cheap geometry can be built in `useMemo` on the main thread.
- **Budget:** about 150k triangles per scene. Use `<instancedMesh>` for repeated items (chain links, balls, rollers, particles).
- New generic generators belong in your own scene folder unless your brief says otherwise. If you write one, add a watertightness test (copy `openEdges` and `volume` from `src/geometry/geometry.test.ts`).

## 5. Animation

- Use `useSimFrame((dt, t) => …)` from `@/core/sim`, where `dt` is scaled sim time. Mutate refs; **never set React state per frame**.
- **Gear trains and drivelines:** `DriveGraph` from `@/core/drive` with `gearMesh`, `beltDrive`, `coupling` (clutch, dog), `brake`, `differential`, `planetary`, `hookeJoint`. It handles locked members and coasting.
- **Gear meshing:** phase gears so the teeth interlock on the line of centres. See `CAM_GEAR_PHASE` in four-stroke/Engine3D.tsx.
- **Flow particles:** `<Flow curve count radius color intensity speed />` from `@/render/Flow`, for oil, fuel, air, coolant, crop, etc.
- **Driving the panel:** write live values into a plain mutable `live` object in `model.ts`. The panel reads it with `useLive(() => …)`.

## 6. Panel

Build it from the components in `@/ui/controls`:

- **`Section`** blocks, typically in this order: **Live** (Readouts), then controls (`Slider`, `Segmented`, `Toggle`), then **Exam presets**, then charts, then **Working**.
- **`Chart`** from `@/ui/Chart`: x array plus y arrays and an optional live `marker`. Use it for the curves the notes discuss.
- **`Working`** from `@/ui/Working`: each step is a symbolic formula, then the same formula with numbers substituted (use `n()` to format), then the result. Each step carries a `cite`.
  - `beyond: true` for formulas not in the notes.
  - `errata: '…'` where the notes or marking guide disagree with the computed value.
- **Exam presets:** load the data from past questions or worked examples (see the inventories), so a student can check an answer.

## 7. Accuracy, tests and verification

- **Physics** lives in pure, typed functions in SI units. **Test them against worked examples and marking-guide answers from the notes**, with the source quoted in the test name. Use tolerances that match the notes' rounding.
- **Errata:** if the notes are wrong, the test asserts the *correct* value and the scene shows the errata badge. Report these errata in your final message, and do not edit `src/content/errata.ts`.
- **Verify before finishing:**
  - `npx tsc --noEmit -p .`: fix every error in YOUR files (ignore other folders' in-progress errors).
  - `npx vitest run <your test files>`: all must pass.
- **Do not** install packages, start the dev server, or use the browser. The lead does visual QA.

## 7b. Shared tractor & soil

- **Tractor** — `src/tractor/` (`Tractor.tsx`, `dims.ts`, `geometry.ts`, `linkage.ts`):
  - `<Tractor pose={createTractorPose()} mounted={<Implement/>} trailed={<Trailer/>} … />`
  - Frame: +X forward, Y up, +Z right, origin on the ground under the rear axle.
  - `mounted` children sit in the hitch frame: origin at the midpoint of the lower hitch balls, +Y up the mast, −X rearward. They follow the solved three-point linkage.
  - `trailed` children sit at the drawbar pin.
  - Mutate the pose every frame: `rearAngle`, `frontAngle`, `steer`, `engineAngle`, `ptoAngle`, `hitchHeight`. `pose.linkage` returns the solved four-bar, including the virtual hitch point.
  - Dimensions are the Farmland tractor (Macmillan App. II).
  - Physics: `src/physics/tractor.ts` (Macmillan Ch 2), `chassis.ts` (Ch 6), `traction.ts` (Zoz & Grisso).
- **Soil** — `src/render/soil.ts` + `<SoilSurface grid>`:
  - A deformable heightfield: `createSoil`, `roughen`, `stampRun` with `PROFILES` (mouldboard, ridge, tilth, slot), `pressPrint` (wheel/track prints) and `heightAt`.
  - Use it for anything that works the ground.
- Shared physics files may be **extended append-only** (new exports at the end, with a comment). Never change or remove existing exports.

## 8. Shared files are read-only

Do not edit anything under:
- `src/core`, `src/render`, `src/ui`, `src/geometry`, `src/content`, `src/parts`, `src/tractor`;
- `src/modules/catalog.ts` or `src/modules/types.ts`;
- another scene's folder;
- any config file.

If you need a change there, put it in your report (what, and why) and work around it locally.

## 9. Final report (≤ 350 words)

- Scenes built, and the files in each.
- Physics functions and the tests that pin them, citing the notes.
- Errata found.
- Content marked "beyond notes".
- Requested shared changes.
- Known limitations.

## 10. Audiences and wording (Solidify)

- The product is **Solidify** (solidify.studio). It has two audiences: **Professional**, the default, and **Academic**.
- **Never show course codes (AEE5xx) or note/source citations in visible text.** Keep `cites`/`cite()` as data only.
- Put exam drills (past-question presets, marking-scheme tables, exam point lists) in a `Section` whose title **starts with "Exam"**. It is then hidden for professionals automatically.
- Scene summaries, tours, part info and general notes must be audience-neutral: engineering facts, with no mention of exams or "the notes".
