# Solidify build log

A running record of problems met while building Solidify: what went wrong, why, how it was fixed,
and what to do differently. Add an entry whenever something costs real time, newest at the top of
its section.

Every entry is numbered (in the order they appear, top to bottom) and set out the same way:

- **Problem:** what was seen
- **Cause:** why it happened
- **Solution:** what fixed it (files, tests, how it was checked); "planned" if not done yet
- **Lesson:** what to do differently

---

## 3D rendering and scenes

### 1. Exploded parts on spinning shafts orbit instead of spinning (2026-10-24)
- **Problem:** in explode mode, gears and hubs on a turning shaft swung around the shaft axis instead of spinning in place.
- **Cause:** explode offsets were applied inside the part's own frame. A part inside a spinning shaft group had its "lift up" offset turning with the shaft. Parts without an explicit offset got an automatic one (added 14 Oct) that had the same problem, which made it much more visible.
- **Solution:** all offsets, explicit and automatic, are now held in the whole machine's frame (the top-level part) and converted into the part's current frame every frame (`web/src/render/Part.tsx`, `toFrame`/`toLocal`). Regression test: `web/src/render/explode.test.ts`. Verified in the gearbox scene: zero drift of any mesh while exploded and spinning.
- **Lesson:** any per-part offset must say which frame it lives in. Animated groups between a part and its assembly will carry anything expressed in local space.

### 2. Flat metal faces render almost black (2026-10-08)
- **Problem:** gear sides in the Gears scene were near-black even when well lit.
- **Cause:** fully metallic materials (metalness 1) have no diffuse light; a flat face seen from above only reflects the dark floor and backdrop.
- **Solution:** a `steelMatte` material (metalness 0.55) for broad flat machined faces; camera moved off-axis.
- **Lesson:** use the polished metals for curved parts; use `steelMatte` for large flat faces.

### 3. Positive `useFrame` priority turns the canvas black (2026-10-11)
- **Problem:** Positive `useFrame` priority turns the canvas black.
- **Cause:** in React Three Fiber, a frame callback with priority > 0 takes over rendering.
- **Lesson:** never pass a positive priority to `useFrame`/`useSimFrame`.

### 4. Floor z-fighting in several scenes (2026-10-11, 2026-10-13)
- **Problem:** Floor z-fighting in several scenes.
- **Solution:** floor overlays use polygon offset and no depth write; stacked ground layers are spaced apart.

### 5. Scenes without a default cut preset sliced the tractor in half (2026-10-13)
- **Problem:** Scenes without a default cut preset sliced the tractor in half.
- **Solution:** scenes with no `defaultPreset` open uncut.

### 6. Tractor left/right and steering sign confusion (2026-10-08, 2026-10-11)
- **Problem:** Tractor left/right and steering sign confusion.
- **Cause:** the frame comment said +Z is left; it is right, and positive steer is left.
- **Solution:** knuckles, labels and Ackermann signs corrected; comment fixed. Steering signs in costs, farmstead and autosteer fixed.
- **Lesson:** write a test for any sign convention a scene depends on.

### 7. Chrome stops repainting an element animated through `scale(0)` (promo video, 2026-10-11)
- **Problem:** **Fix/lesson:** clamp scale animations to 0.001, never exactly 0.

### 8. A full-screen 3D hero swallowed page scrolling (2026-10-25)
- **Problem:** on the redesigned home page the live scene fills the hero, and scrolling over it zoomed the camera instead of scrolling the page; a one-finger swipe on a phone orbited the model.
- **Cause:** camera-controls takes the mouse wheel and one-finger touch by default, and sets `touch-action: none` on the canvas.
- **Solution:** `Stage pageScroll` turns off wheel and one-finger actions (drag and pinch still work), and the hero overrides the canvas to `touch-action: pan-y`.

### 9. Follow-up (2026-10-26):
- **Problem:** on real phones swipes that started on the model still didn't scroll: the camera controls capture the touch regardless. On touch screens the hero is now look-only (`pointer-coarse:[&_*]:!pointer-events-none`; `!important` because R3F sets `pointer-events` inline on its wrapper), and "Open scene" is the way in.

- **Lesson:** any canvas embedded in a scrolling page needs its scroll gestures given back to the page; on touch, the reliable way is not to let it receive them at all. Headless swipe tests (`Input.synthesizeScrollGesture`) don't scroll inner containers, so check `touch-action` and `pointer-events` under the finger instead.

### 10. Blank canvas after the loader went away (2026-10-26)
- **Problem:** "Building the model…" disappeared, then the stage sat empty (white in the light theme) for several seconds.
- **Cause:** the loader only waited for the scene's code; its parts are then generated on worker threads, and nothing tracked them.
- **Solution:** `useGeometryPending` in `geometry/build.ts` counts the builds a scene is waiting on; the stage's build cover stays up until that reaches zero and settles, then fades out. The tile capture script waits on the same signal instead of a fixed delay.
- **Lesson:** "loaded" means the thing on screen is ready, not the code behind it.

### 11. The loader covered the hero headline (2026-10-26)
- **Problem:** while a hero scene built, the headline and buttons vanished.
- **Cause:** the cover's `z-10` had no stacking context around it, so it rose above the page's later siblings.
- **Solution:** the stage renders inside its own `isolate` layer.

### 12. Switching hero scenes looked like a page reload (2026-10-26)
- **Problem:** Switching hero scenes looked like a page reload.
- **Cause:** the hero dropped the old scene before loading the new one, so the whole hero blanked.
- **Solution:** the old scene stays up while the next one's code loads; the new one builds under a frosted veil and fades in.

### 13. Tile captures could photograph the previous scene (2026-10-26)
- **Problem:** Tile captures could photograph the previous scene.
- **Cause:** moving between `#/shot/…` URLs only changes the hash, so the page never reloads and the last scene's "ready" flag was still set.
- **Solution:** the script clears the flags before each navigation; the page clears them too.

### 14. Known, open: React "synchronously unmount a root" warning on scene switch
- **Problem:** drei `Html` labels unmount while React is rendering. Harmless (no crash); listed in `web/docs/QA.md`.

## Study tools and content

### 15. Following one question link to another showed the old question (2026-10-25)
- **Problem:** while on Exam practice, opening another `/exam?q=…` link kept showing the previous question.
- **Cause:** the subject and topic filters were read from the link only when the page first opened, so the new question was filtered out.
- **Solution:** a new `?q=` re-applies the subject, topic and practice mode (`web/src/study/ui/ExamPage.tsx`).
- **Lesson:** state initialised from the URL must also react to URL changes; class assignment links depend on it.

### 16. Exam questions had fixed numbers (2026-10-24)
- **Problem:** once a student had seen an answer, the question was spent; students could share answers.
- **Solution:** parametric questions (`web/src/study/variants.ts`). Every question declares its inputs with realistic ranges and builds its statement, answers, working and 3D setup from them. All 68 questions are converted, and each is tested against 200 variants.
- **Lesson:** a test that every input value appears in the statement catches numbers left hard-coded.

### 17. Course codes and note citations showed in the UI (2026-10-24)
- **Problem:** Study mode showed codes like AEE510, and solutions printed note file names.
- **Cause:** codes and citations were authoring references that leaked into labels.
- **Solution:** subjects are shown by name (Engines, Machine design, …); citations stay in code and are never rendered.
- **Lesson:** Solidify serves many schools: no course codes, school names or source files in any visible text.

### 18. Large numbers in worked solutions printed with a comma (2026-10-24)
- **Problem:** Large numbers in worked solutions printed with a comma.
- **Cause:** a backslash was lost to shell escaping, so `\,` (LaTeX thin space) became a plain comma.
- **Solution:** corrected in `tnum()`, with a test of the exact output.

## Backend, cloud and deployment

### 19. A second paper hand-in in the same millisecond was accepted (2026-10-25)
- **Problem:** a test showed a student could submit a paper twice when both requests carried the same timestamp.
- **Cause:** "already submitted?" was decided by comparing the stored submission time with this request's time.
- **Solution:** the transaction records whether this request created the submission (`api/src/app.ts`, paper submit).
- **Lesson:** never infer "did I write this?" from timestamps; record it explicitly inside the transaction.

### 20. Firebase was added to the wrong project
- **Problem:** Firebase was added to the wrong project.
- **Cause:** the Firebase console defaulted to an auto-created "My First Project".
- **Solution:** once the Firebase terms were accepted, Firebase was added to `solidify-studio` through the API.
- **Lesson:** check the project picker; confirm with `firebase.googleapis.com/v1beta1/projects/<id>`.

### 21. The free-trial credit can't pay for Claude
- **Problem:** The free-trial credit can't pay for Claude.
- **Cause:** the $300 trial credit excludes partner models served as managed APIs.
- **Solution:** the tutor uses Gemini on Vertex AI, authenticated as the Cloud Run service account (no API key).

### 22. Gemini model IDs that don't exist on Vertex
- **Problem:** `gemini-flash-latest` (an AI Studio alias) and `gemini-2.5-flash` return 404 on Vertex for this project. `gemini-3.8-flash` works.
- **Lesson:** probe model IDs with a one-line `generateContent` call before deploying.

### 23. Cloud Run deploy failed on a new project
- **Problem:** Cloud Run deploy failed on a new project.
- **Cause:** the default compute service account that Cloud Build runs as couldn't read the uploaded source.
- **Solution:** granted it `roles/cloudbuild.builds.builder`.

### 24. gcloud split an environment variable at the email's `@`
- **Problem:** gcloud split an environment variable at the email's `@`.
- **Cause:** `--set-env-vars "^@^…"` used `@` as the separator, and `ADMIN_EMAILS` contains an `@`. **Fix/lesson:** use `^;^` as the separator.

### 25. `/healthz` returned Google's 404
- **Problem:** `/healthz` returned Google's 404.
- **Cause:** Cloud Run reserves some paths ending in `z`.
- **Solution:** the health check is `/health`.

### 26. The API couldn't be made public
- **Problem:** The API couldn't be made public.
- **Cause:** the `solidify.studio` organization has Domain Restricted Sharing, which blocks `allUsers`. Separately, Claude's auto mode refuses to make services public.
- **Solution:** the owner ran `gcloud run services update solidify-api … --no-invoker-iam-check`. The API itself checks Firebase sign-in on every route that touches user data.

### 27. Moving the app into `web/` would have broken Netlify
- **Problem:** Moving the app into `web/` would have broken Netlify.
- **Cause:** Netlify built from the repo root.
- **Solution:** root `netlify.toml` (`base = "web"`) committed in the same commit as the move; a clean checkout was built before pushing.

### 28. Sign-in from the live site needs an authorized domain
- **Problem:** Sign-in from the live site needs an authorized domain.
- **Solution:** `solidify.studio` and `www.solidify.studio` added to Firebase Auth's authorized domains.

## Tooling and process

### 29. Usage limits stopped parallel builders mid-task (several times)
- **Problem:** half-built scene folders, and agents that "failed" partway through. **Fix/lesson:** before resuming, re-read what's on disk instead of trusting the agent's memory. Keep to about 5 builders at a time. Each builder owns its own files.

### 30. Two Claude sessions building in the same folder
- **Problem:** Two Claude sessions building in the same folder.

### 31. Risk:
- **Problem:** both write the same files, and one overwrites the other.

- **Lesson:** only one session builds at a time. Check `ListAgents` and recent file changes before starting.

### 32. Claude attribution in commit messages
- **Problem:** Claude attribution in commit messages.
- **Cause:** some sessions added `Co-Authored-By: Claude` despite the owner's rule.
- **Solution:** history rewritten on both branches and force-pushed (contents verified identical commit by commit; backups kept locally). A `.git/hooks/commit-msg` hook now strips attribution lines.

### 33. A cloud session's branch was named `claude/…`
- **Problem:** A cloud session's branch was named `claude/…`.
- **Solution:** renamed to `promo-video-v1`.

### 34. The dev server couldn't start on 5173 or 5180
- **Problem:** The dev server couldn't start on 5173 or 5180.
- **Cause:** Windows (Hyper-V) reserves TCP ports 5077–5276, and another project was already serving on 5173.
- **Solution:** run the app with `npx vite --host 127.0.0.1 --port 4173`. The API allows that origin.
- **Lesson:** `netsh int ipv4 show excludedportrange protocol=tcp` lists reserved ports.

### 35. Shell layers mangle backslashes and newlines
- **Problem:** a `\n` written through a Python one-liner became a real line break inside a TypeScript string (parse error), and `\\,` collapsed to `\,`.
- **Lesson:** use the file editor (not shell heredocs or inline scripts) for code containing backslashes, and test the exact output.

### 36. Local Google credentials expired
- **Problem:** `invalid_grant` when testing Vertex from this computer.
- **Solution:** for one-off checks, use `gcloud auth print-access-token`. Deployed code uses its service account and is unaffected.

### 37. Heavy geometry tests time out under the full parallel run
- **Problem:** `steering/boxes` and `traction/tyre` geometry tests occasionally time out under full load and pass when run alone. Rerun alone before treating them as failures.

### 38. Browser checks raced with hot reload
- **Problem:** a click landed just as an edit hot-reloaded the page, resetting UI state.
- **Lesson:** reload the page before measuring or testing behaviour in the browser.

## Live test rollout and thermal lab (2026-11-01)

### 39. Rail test logged one temperature
- **Problem:** every row read 15 °C and the chart was empty.
- **Cause:** the default target equalled the laying temperature, so the test had no range.
- **Solution:** default target 45 °C.
- **Lesson:** when a slider becomes a test's end point, check its default differs from the start.

### 40. Governor test seemed to hang
- **Problem:** Governor test seemed to hang.
- **Cause:** the driver runs on sim time and that scene runs at 1/20 speed, so a 7.5 s test took 150 s.
- **Solution:** shorter steps.
- **Lesson:** set test lengths against the scene's `timeScale`.

### 41. `tyre/build.test.ts` fails under load
- **Problem:** It asserts a wall-clock limit of 1.5 s, and reads 1.5 to 1.7 s when the machine is busy. It passes alone. Not a logic failure, but it makes the full run unreliable.

### 42. Source error
- **Problem:** The heat exchanger tutorial's first answer, 2.07 m², works out at 2.03 m²; that question is left out of Exam Practice.

## Notes to 3D review (2026-11-04)

### 43. Figures showed the rig's defaults, not the document's values
- **Problem:** Figures showed the rig's defaults, not the document's values.
- **Cause:** the samples and the vision prompt used their own names (`span`, `l2`, `mainR`), and `applyParams` passed them straight into the stores.
- **Solution:** `web/src/note3d/catalogTargets.ts` turns a figure's values into each rig's real settings, with aliases and unit factors. The API prompt lists the same rigs and keys (`api/src/noteCatalog.ts`), and a test keeps the two in step.
- **Lesson:** a test that only checks a figure "renders" can't catch this; check the values that reach the store.

### 44. Hiding in-scene readings behind the Labels toggle removed them from the main app
- **Problem:** Labels are off by default, so the steam plant, beam and torsion readouts disappeared.
- **Solution:** reverted, with a patch kept in the scratchpad.
- **Lesson:** a reader-only need belongs in the reader, not in shared scene code.

### 45. The client called the live API from unit tests
- **Problem:** `generateOrEdit3DScene` would have sent real Gemini requests during `vitest`.
- **Solution:** the backend call returns early outside a browser.

### 46. "Low confidence stays 2D" never fired
- **Problem:** A missing confidence defaulted to 0.92, and the prompt never asked for one.
- **Solution:** missing means 0, and the prompt requires it.

## Creation Lab (2026-11-06)

### 47. Unknown shapes crashed Create in 3D
- **Problem:** `Cannot read properties of undefined (reading 'clone')`.
- **Cause:** the API's Create prompt was four lines with no field list, so Gemini invented shape kinds; the client passed a spec that failed validation through anyway, and the builder returned `undefined` for an unknown kind.
- **Solution:** the full prompt now lives in `api/src/createPrompt.ts` (fields, units, axes, and only these kinds), the client drops unusable shapes, the builder falls back to a small box, and a web test keeps the API's shape and material lists equal to the builder's.
- **Lesson:** a list in a prompt is a request, not a guarantee; validate what comes back and never pass an invalid result on "as is".

### 48. Updates were blocked in the browser
- **Problem:** renaming, slider autosave and card pictures never saved; the console showed a CORS error for `PUT`.
- **Cause:** the API's CORS `allowMethods` listed GET, POST, PATCH and DELETE only.
- **Solution:** added PUT, with a preflight test.
- **Lesson:** server tests call the app directly and skip CORS; test a new HTTP method through a real browser (or a preflight test) before shipping.

### 49. Every update wiped the slider values and history
- **Problem:** Every update wiped the slider values and history.
- **Cause:** the update schema was `creationInput.partial()`, and zod `.default()` values still apply in a partial schema, so a thumbnail-only update reset `params` and `history` to empty.
- **Solution:** a separate update schema with no defaults, and a test that a one-field update leaves the rest alone.
- **Lesson:** never build a PATCH/PUT schema from a create schema that has defaults.

## Model workspace and live builds (2026-11-06)

### 50. The first build never started in development
- **Problem:** The first build never started in development.
- **Cause:** StrictMode mounts, unmounts and remounts each page; the workspace's "stop the stream when leaving" clean-up aborted the build that had just started, and a guard stopped it restarting.
- **Solution:** abort only if the page has not come straight back (checked a tick later).
- **Lesson:** a clean-up that cancels work must survive StrictMode's simulated unmount.

### 51. `destroy is not a function` on opening the workspace
- **Problem:** `destroy is not a function` on opening the workspace.
- **Cause:** an effect written as `() => el.scrollIntoView({ behavior: 'smooth' })` returned a promise, because recent Chromium returns one from smooth scrolling.
- **Solution:** effects with block bodies.
- **Lesson:** never let an arrow effect return a call's result.

### 52. The loading cover hid the live assembly
- **Problem:** Each streamed part makes a new scene, and the viewer's build cover is keyed on the scene, so it reappeared on every part.
- **Solution:** no cover while a build streams, or after one has streamed in that workspace.

## Generated mechanisms that move wrongly (2026-11-08)

### 53. The 3D view spun parts at 1 rad/s whenever their speed used a calculation (2026-11-08)
- **Problem:** in library drafts, meshed gears turned at the wrong ratio and often the wrong way (helical pair, compound train, differential), though the model's own formulas were right (`-rpm1 / (60 * u)`, `n_in / (60 * ratio_total)`).
- **Cause:** the renderer gave each part only the slider values; a speed (or size) naming a calculation result (`u`, `ratio_total`, `n_left`) could not be evaluated and silently fell back to the default 1 rad/s, while the assembly solver already used sliders and results together.
- **Solution:** every part gets the full set (`NoteSceneRenderer`, `params={scope}`), so the rendered sizes also match what the assembly measured. Verified on the downloaded drafts by measuring each part's spin frame by frame: the compound train now runs 4 : 1 then 3 : 1 (12 : 1 overall) with each stage reversing; the helical pair exactly 2 : 1, opposite.
- **Lesson:** a value that can't be evaluated must never quietly become a plausible default; and one place that evaluates expressions should not see different names from another.

### 54. Gears and shafts wobbled about the wrong line (2026-11-08)
- **Problem:** in the differential, rack and pinion and sleeve coupling, round parts swung round instead of spinning in place.
- **Cause:** each part's `motion.axis` was a bare x / y / z in the part's own frame, and the model often named x or z for a shape standing along y.
- **Solution:** a turning round part (gear, shaft, pulley) spins about its own shape's axis, through that shape's centre, whatever letter was given (`NoteSceneRenderer`, `spin`).
- **Lesson:** take an axis from the geometry, never from a label the model can get wrong.

### 55. The helical gear pair drew nothing (2026-11-08)
- **Problem:** a blank 3D view, and every part reported as floating.
- **Cause:** the gears gave `"helixAngle": "beta"` (the helix-angle slider) where the builder expected a number; the twist became NaN and so did every vertex of both gears.
- **Solution:** gear angles may be formulas (`schema.ts`), are evaluated like any size and kept to a sane range with a fallback (`builder.ts`, `angleIn`); tests in `note3d/gearAngles.test.ts`.
- **Lesson:** any field the model fills may be an expression; evaluate it and range-check it, and never let NaN reach geometry.

### 56. The library page crashed on an unexpected answer (2026-11-08)
- **Problem:** "Cannot read properties of undefined (reading 'length')" on the whole page, met while testing with a stub API.
- **Cause:** it read `items.length` from the answer without checking.
- **Solution:** anything but a list is treated as an empty library.
- **Lesson:** a page should survive a malformed answer from its own API as well as from the model.

### 57. Every generated gear sat 90 degrees off its shaft (2026-11-08)
- **Problem:** gears looked edge-on to the shafts they were mounted on, meshed pairs did not line up, and gears spun about the wrong line; the main reason drafts "don't mate properly".
- **Cause:** the prompt, the assembly solver and the motion all treat every round shape as standing along its local Y axis (as cylinders, tubes and pulleys are built), but the gear generator (`geometry/gear`) and three.js's torus build theirs along Z. So a gear's axis was misread everywhere: coaxial mounting turned it edge-on, mesh alignment and spin used the wrong axis. Gemini followed the prompt (rotating gears as if they stood on Y), which made it worse.
- **Solution:** the builder stands gears, bevel gears, sprockets and tori up onto Y (`builder.ts`, `standUp`), so every round shape agrees with the prompt and the assembly; `note3d/roundAxis.test.ts` checks each round kind is a disc across X–Z, thin in Y. Checked on the downloaded compound-train and worm-reducer drafts: gears now stand on their shafts, in mesh.
- **Lesson:** when several pieces share a convention (here "round shapes turn about Y"), test it against the actual geometry each one produces; a comment saying "axis along Z" was there all along.

### 58. Gears and linkages in library drafts move wrongly or don't mate (2026-11-08) (in progress)
- **Problem:** in the review queue most mechanism drafts struggle with motion: a shaft turns differently from the gear on it, meshed gears turn at the wrong ratio or the same way, gears wobble about the wrong line, teeth run through each other, and linked parts (a slotted lever and its crank, a scotch yoke, a rack and its pinion) each swing on their own; some layouts float (the helical pair stands above its base plate). Examples: "Universal (Hooke's) joint at 30° deflection", "Three-shaft compound gear train (12 : 1)", "Crank & slotted-lever quick-return mechanism", "Stepped transmission shaft & gear assembly", "Scotch yoke", "Rack and pinion".
- **Cause:** every moving part's spin is Gemini's own guess (`motion: { kind, axis, speed }` per part, played as written). Nothing ties a part's speed, direction or axis to the gear it meshes with or the shaft it sits on; meshed gears start at whatever angle, so teeth can sit in teeth. Two kinds can't be right at all with per-part motion: a Hooke's joint's output turns at a varying speed (ω₂/ω₁ = cos β / (1 − sin²β cos²θ)) and a slotted lever swings unevenly (θ = atan(r sin φ / (d + r cos φ))), which a constant `rotate` or a sine `oscillate` cannot express. The quality checks only looked at whether moving parts were mounted, not whether they move consistently, so these drafts scored well. Entries 53, 54, 55 and 57 were further causes found on the way.
- **Solution:** entries 53, 54, 55 and 57, then motion from the mounts (`note3d/kinematics.ts`): one part drives each mechanism (the part named like a motor, input, crank or handwheel, else the first given a speed) and every other part follows by its relation, on one clock for the whole machine (it also steps with the step button). On a shaft: the same angle; external mesh: θ₂ = −(T₁/T₂)·θ₁ + φ; inside a ring gear the same way round; a rack slides r·θ; a part fixed off its carrier's axis (a pin, a sliding block) is carried round that axis; a part given a clearly different speed runs free on a bearing (a differential's side gears) and, off the axis, is carried round as well. New mounts (`schema.ts`, `assembly.ts`): a slotted lever (points from its pivot through the crank pin), a follower (a ram or scotch-yoke slide moving with a pin or lever tip along its guide) and a universal joint (exact Hooke's law, θ₂ = atan2(sin θ₁, cos θ₁ cos β), kept continuous); cranks, sliders, links, levers and followers are re-placed by the assembly solver every frame from the crank's real angle. Driven gears start with their teeth interleaved (φ = ψₚ − π/Tₚ − k·ψₜ). Tests: `note3d/kinematics.test.ts` (ratio and sense, one driver, interleave, rack, piston, lever and ram, Hooke, bored gear vs ring gear, carried block, free gear). Checked on the downloaded drafts in Edge, part by part, frame by frame: compound train 12 : 1, helical pair 2 : 1 opposite, worm reducer 30 : 1, the differential keeps its 270 / 330 rpm split. The prompt now asks for one driver and the new mounts (`api/src/createPrompt.ts`, live after the next API deploy). A new check, "mechanism moves right" (`mechanismProblems`), fails a draft whose meshed gears differ in tooth size, whose rack is not meshed, whose gear is driven by nothing, whose lever, ram or yoke is animated on its own, or whose universal joint, quick return or scotch yoke lacks its mount; the review queue runs it again on every draft with today's rules, shows what is wrong, and has **Rebuild all flagged** (a background task, confirmed first since each is a Gemini build). On the downloaded drafts it flags exactly the quick return, scotch yoke and rack (never mounted to each other) and passes the gear trains. Five mechanism requests (compound train, rack and pinion, quick return, scotch yoke, universal joint) joined the nightly tests (35 cases). Still to do: a sweep through a turn for parts passing through each other.
- **Lesson:** never let the model state a quantity the mechanism already determines; derive it. And a check of "is it connected" is not a check of "does it move right".

### 59. A helical gear with a bore turned the same way as its pinion (2026-11-08)
- **Problem:** while deriving motion, the helical pair's driven gear turned the same way as the pinion it meshes with.
- **Cause:** a gear was taken for a ring gear (whose mate turns the same way) whenever it was "hollow", and hollow included any round hole cut through it; nearly every real gear has a bore.
- **Solution:** a ring gear is told by geometry: the mate's centre sits inside it (closer than the bigger pitch radius). The mesh mount also places a gear inside a part named like a ring gear or annulus (at the difference of the radii) instead of always outside. Test: a bored gear runs opposite, a planet in a ring the same way; the helical draft measured 2 : 1 opposite in Edge.
- **Lesson:** decide what a part is by where it sits and how it is shaped as a whole, not by one feature (a hole) many parts share.

### 60. Parts on a crank pin spun on the spot instead of going round with the crank (2026-11-08)
- **Problem:** the quick-return's sliding block (mounted on the bull gear's pin) and the differential's spider gears turned about their own centres while the crank or carrier went round.
- **Cause:** "fixed to a turning part" was modelled as turning by the same angle about the part's own axis, which is only the same thing when that axis is the carrier's axis.
- **Solution:** a part fixed off its carrier's axis is carried round the carrier's line (P₀⁻¹ · R · P₀); a non-round part (a block, a cam) fixed to a turning part is carried too. Test: a block on a crank pin keeps its distance from the crank centre and moves round it.
- **Lesson:** a rigid joint means the whole pose follows, not just the angle.

### 61. The quick-return lever whipped round at 70 rad/s (2026-11-08)
- **Problem:** the slotted lever of the quick-return draft swung wildly.
- **Cause:** its swing was written `asin(r / c) * 180 / pi`: degrees, where radians are expected, so 22 degrees became 22 radians.
- **Solution:** a swing of more than half a turn each way is read as degrees (`NoteSceneRenderer`); measured afterwards at a sane rate. New drafts use the lever mount, which needs no swing at all.
- **Lesson:** check units at the boundary where the model's numbers come in; a value outside any sensible range in one unit is usually another unit.


### 62. Deriving motion locked a differential's side gears to the carrier (2026-11-08)
- **Problem:** with motion derived from the mounts, the open differential's side gears turned exactly with the carrier, wiping out its 270 / 330 rpm wheel split; its spider gears then spun on the spot instead of riding round with the carrier.
- **Cause:** the first rule treated every coaxial mount on a turning part as a rigid joint. In a differential (and for any gear on a bearing) the side gears share the carrier's axis but turn freely on it. Parts that run free but sit off the carrier's axis (spiders, planets) must both spin and be carried round, and the rule did neither.
- **Solution:** a part written a clearly different speed (more than 2 %) from the part it sits on runs free at its own speed. Off the carrier's axis it is also carried round the carrier's line, with its own spin applied on top (`kinematics.ts`, `freeOn` and `carrier`). Tests: a free side gear keeps its own speed, and a free gear off the axis both spins and orbits. Measured in Edge: side gears 4.78 and 5.84 rad/s against a carrier at 5.31 (the 270 : 330 split). That draft's spiders still don't orbit because its cross pin lies along the carrier's axis, a layout fault fixed by rebuilding.
- **Lesson:** "mounted on" is not "fixed to"; check a new rule against every kind of machine in the queue (the differential), not just the one it was written for.

### 63. The part panel said "Does not move" for gears driven through their mounts (2026-11-08)
- **Problem:** once only the driver carries a speed, the part panel showed "Does not move" for every gear it drives. For drafts that still write a speed on every part, the panel quoted that speed, which the 3D view no longer uses.
- **Cause:** the panel read each part's own `motion` field, not the motion actually shown.
- **Solution:** the panel works the mechanism out the same way the 3D view does (`PartInspector`, `buildKinematics`). It says "Drives the mechanism, N rev/min" for the driver, "Turns at N rev/min, driven through the …" for a follower, and "Moves with the …" for a carried part. Checked in Edge on the compound train: 191, 47.7 and 15.9 rev/min (12 : 1).
- **Lesson:** when the source of a value moves, look for every place that shows it (here the panel as well as the view).

### 64. Review-queue scores were stale: broken mechanisms showed 75 to 86 (2026-11-08)
- **Problem:** the quick return, scotch yoke and rack drafts, whose parts were never joined, sat in the queue with respectable scores and nothing saying they move wrongly.
- **Cause:** a draft's score and checks are worked out once, when it is drafted, and stored; newer checks never reach older drafts.
- **Solution:** each card runs the mechanism check again with today's rules and shows "Moves wrongly: rebuild it" with the reasons. The queue counts the flagged drafts and offers Rebuild all flagged (`AdminPage.tsx`, `draftMechanism`, `RebuildFlagged`). Checked in Edge at 1366 and 390 px: 3 flagged, the gear trains clear. A stubbed rebuild run went through all 3 as a background task and updated the cards.
- **Lesson:** a stored score is a snapshot; a check that can run in the browser should be run again when the item is shown.

### 65. The universal-joint test expected a wrapped angle (2026-11-08)
- **Problem:** the new Hooke's-law test failed by exactly 2π at larger angles.
- **Cause:** the test took its expected output angle straight from atan2, which wraps at half a turn, while the code (correctly) keeps the output turning continuously.
- **Solution:** the test unwraps its expected value to within half a turn of the input, as the code does (`kinematics.test.ts`).
- **Lesson:** when a test and the code disagree, check which is right before changing either; here it was the test.

### 66. A shell heredoc died on an apostrophe and lost two changes (2026-11-08)
- **Problem:** one command, meant to patch the mechanism clock and write the kinematics tests, failed with "unexpected EOF while looking for matching `'`"; neither change was made.
- **Cause:** the text contained "Hooke's", whose apostrophe closed the shell quoting partway through.
- **Solution:** the test file was written with the file editor and the patch made with Edit; scripts with free text go in files, not inline.
- **Lesson:** never pass prose or code through shell quoting; use the editor, or a script file (see entry 35).

### 67. Checking the push failed after switching back to the owner's account (2026-11-08)
- **Problem:** after pushing commit by commit as HectorGitt and switching back, `git fetch` said "Repository not found", which looked like a failed push.
- **Cause:** the repository is reachable only from HectorGitt's account; the fetch ran after switching to Ola-Den.
- **Solution:** fetch and compare (`git status -sb`) before switching back; the pushes had landed.
- **Lesson:** do every remote check under the account that can see the remote, then switch.

### 68. Browser checks gave false answers: a click timed out and a count read 0 (2026-11-08)
- **Problem:** selecting a part by clicking its name in the Parts list timed out. Counting the "Moves wrongly" notes on the phone reported 0 when there were 3.
- **Cause:** the Parts list was folded, so the name was in the page but not visible. The text locator's count did not match the notes reliably at phone width.
- **Solution:** select parts through the app's own store (`useView.select`). Count from the page text (`document.body.innerText`), then scroll to the element and look at the screenshot (`scripts/look32.mjs`, `look33.mjs`).
- **Lesson:** when a browser check says something is missing, confirm it with a screenshot before believing it.
## Nightly tests, admin and labs pages (2026-11-06)

### 69. A propped-cantilever model crashed the whole workspace
- **Problem:** `Cannot read properties of undefined (reading '0')`, blank page.
- **Cause:** Gemini sent a `recommendedCut` without a `normal`; the cleaner passed the object through unchecked and an effect read `normal[0]`.
- **Solution:** `cleanCut` in `note3d/sanitize.ts` checks every field (also applied when opening saved models and in the notes reader), and error boundaries round the 3D view, the side panel and each page.
- **Lesson:** validate every nested field of model output, not just its presence; and no page should be one bad value away from blank.

### 70. Nightly builds failed with "Something went wrong on the server" (500)
- **Problem:** Nightly builds failed with "Something went wrong on the server" (500).
- **Cause:** Gemini answered 429 RESOURCE_EXHAUSTED when three builds ran at once, and the API gave up on the first refusal.
- **Solution:** `api/src/retry.ts` waits and retries (2, 6, 15 s) on 429/503, streamed builds retry if refused before their first word, the final failure says the model is busy (503), and the runner tries once more after 30 s.
- **Lesson:** treat rate limits as normal for a hosted model; read the service's logs before guessing.

### 71. A draft scored 100 while visibly broken
- **Problem:** (rods not reaching the crank, a tilted flywheel through the casing, labels on top of each other).
- **Cause:** the checks only covered layout overlap, drawability and calculations.
- **Solution:** checks for moving parts joined by relation and for overlapping labels, and the prompt states the same rules.
- **Lesson:** a score is only as good as its checks; look at high scorers before trusting the number.

### 72. Deploy failed: "Build failed; check build logs"
- **Problem:** Deploy failed: "Build failed; check build logs".
- **Cause:** `gcloud run deploy --source .` run from the repo root, which has no Dockerfile.
- **Solution:** run it from `api/`.
- **Lesson:** `--source .` uploads the current folder; check where you are.

### 73. Rig thumbnails came out blank, and with a stray `_` in their names
- **Problem:** Rig thumbnails came out blank, and with a stray `_` in their names.
- **Cause:** two scenes photographed before they had drawn in a reused tab; and the rig list written by Python on Windows had CRLF line endings, so each id ended in `\r`.
- **Solution:** retook those two in a fresh tab (`SHOT_COLD=1`); renamed the files and strip `\r` when reading lists.
- **Lesson:** check the smallest output files of a batch capture, and strip `\r` from lists made on Windows.

### 74. Inline scripts lost their backslashes
- **Problem:** A `node -e` / heredoc script through the shell turned `C:\Program Files` into `C:\Program Files`, so the browser path was not found.
- **Solution:** forward slashes in Windows paths in scripts, and the editor rather than the shell for code containing escapes.
- **Lesson:** don't pass escape-heavy code through the shell.

### 75. Prettier reformatted a file into another style
- **Problem:** With no project config it used its defaults (double quotes, semicolons).
- **Solution:** re-run with the project's settings (`--no-semi --single-quote --print-width 220`).
- **Lesson:** don't run a formatter the project doesn't configure.

### 76. The Labs page was wider than a phone
- **Problem:** The Labs page was wider than a phone.
- **Cause:** one-line rig names in a grid item set its minimum width.
- **Solution:** `min-w-0` on the card.
- **Lesson:** any `truncate` text inside a grid or flex child needs `min-w-0` on that child.

### 77. Gearbox levers hung in the air, and the reverse idler had no shaft
- **Problem:** Gearbox levers hung in the air, and the reverse idler had no shaft.
- **Cause:** the cut-away removed the half of the casing the lever towers stood on (moving parts are not cut, so the levers stayed); the idler's shaft was defined but never drawn, and a full-length pin would have run through third gear and the range gears.
- **Solution:** a shift cover the towers stand on; a stub shaft and wall boss for the idler; and the cut now removes the other half, with the cameras moved to that side, so everything kept is attached to something.
- **Lesson:** a cut-away must keep whatever holds up the parts it leaves whole; check every part has a visible support, in every cut, not only the opening view. I missed this twice by checking the framing instead of the model.

