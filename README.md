# Solidify

**[solidify.studio](https://solidify.studio)**: interactive 3D cutaways of tractors and farm machinery, with live engineering calculations.

You can slice, explode and run 66 scenes across 12 systems:

- engine
- powertrain
- PTO
- hydraulics
- steering
- traction
- chassis
- implements
- machine elements
- testing
- vibration
- field operations

Cut faces are hatched by material. Moving parts stay whole, as in a museum cutaway. Every motion comes with the calculation behind it.

There are two modes:

- **Professional** (the default) shows mechanisms, sections and calculations.
- **Academic** adds worked examples and study aids.

## Stack

- Vite, React 19 and TypeScript
- @react-three/fiber and drei (three.js)
- zustand, uPlot, KaTeX and Tailwind 4
- three-bvh-csg, which builds cutaway geometry in a web worker
- vitest, which runs over 1,000 tests on the physics libraries

## Repository

| Folder | What | Deploys to |
|---|---|---|
| `web/` | The Solidify app (Vite, React, three.js) | Netlify (see `netlify.toml`) |
| `api/` | The API: accounts, progress sync, classes, shared links, feedback and the Gemini tutor (Hono on Node, Firestore, Firebase Auth) | Google Cloud Run, project `solidify-studio`, region `europe-west1` |

The two are independent packages; each has its own `package.json`.

## Develop

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm test           # physics + UI unit tests
npm run build      # type-check + production build to web/dist/

cd ../api
npm install
npm test           # API tests (in-memory database, fake sign-in and tutor)
npm run build      # compile to api/dist/
```

## App layout (`web/`)

| Path | Contents |
| --- | --- |
| `src/modules/<system>/<scene>/` | One folder per scene, holding `index.tsx` (scene and panel) and `geometry.ts` (procedural parts). Scenes are discovered automatically. |
| `src/physics/` | Typed engineering formulas with unit tests. |
| `src/tractor/` | The shared tractor, with a pose API, hitch slots and a three-point linkage solver. |
| `src/render/` | The section-cap shader, materials and soil heightfield. |
| `src/core/` | The kinematic drive-graph solver and the sim clock. |
| `docs/` | The plan, scene-builder guide and QA list. |
