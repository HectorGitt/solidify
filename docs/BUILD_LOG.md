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

### 69. In the rebuilt quick return, the lever swung a quarter turn away from its die block (2026-11-08)
- **Problem:** the first draft built with the new prompt used the lever and follower mounts correctly, yet looked wrong as it turned: the slotted lever swung while the die block went round outside its slot, and the block tumbled with the gear.
- **Cause:** the lever aimed at a crank pin worked out from its mount's numbers (`throw`, `angle: 0`, meaning straight up from the crank centre). The model drew the pin, and the block on it, at +x, a quarter turn away. The block was carried round with the gear, so it also turned with the gear rather than with the lever whose slot it slides in.
- **Solution:** the crank pin is taken from the drawing when there is one: a part mounted on the crank off its axis (a die or slide block), else an off-axis round shape on the crank (the pin itself). That point is turned with the crank, and the mount's throw and angle are only a fallback. Sliders, links, levers and pin followers all use it (`assembly.ts`, `drawnPin`). A block on the pin of a crank that drives a lever is carried round with the pin but turns with the lever (`kinematics.ts`, `dieBlocks`). Test: a lever whose mount says angle 0 still passes through a block drawn at +x, at every crank angle. Checked in Edge frame by frame: the lever's x tracks the block's to the millimetre, the block stays in the slot, and the ram strokes ±0.15 m (calculated stroke 0.3 m).
- **Lesson:** when the model states a quantity twice (a pin it drew and an angle it wrote), trust the geometry it drew; it is what the student sees.

### 70. A fixed pivot pin was flagged "not a lever on its crank" (2026-11-08)
- **Problem:** the rebuilt quick return, correct in every mount, was flagged "Moves wrongly: Rocker pivot pin is not a lever on its crank".
- **Cause:** the check looked for levers by name, and "rocker" matched the rocker's fixed pivot pin.
- **Solution:** only moving parts can be levers, and pins, pivots, bearings, bushes, brackets, shafts, frames, guides and bases are never taken for one (`mechanismProblems`). The draft now passes, and the old drafts are still flagged.
- **Lesson:** a check that goes by names must exclude the parts named after what they hold; test it on a good draft as well as on bad ones.

### 71. A motion axis given as a vector reached the renderer uncleaned (2026-11-08)
- **Problem:** the rebuilt quick return gave its bull gear `"axis": [0, 1, 0]` where the schema says "x", "y" or "z".
- **Cause:** the cleaning step checked each part's mount but passed `motion` through untouched; the fallback animation would have read `rotation["0,1,0"]`.
- **Solution:** `cleanMotion` (`sanitize.ts`): an axis given as a vector or a signed letter becomes its main letter, a missing speed becomes 1, and an unknown kind drops the motion. Tests in `cleanMotion.test.ts`.
- **Lesson:** "clean every field the model returns" includes the fields that usually come back right.

### 72. A draft's card and its workspace disagreed about what was wrong (2026-11-08)
- **Problem:** some drafts showed no error on their review card until opened (then "parts look out of place"); others showed an error on the card that was gone once opened.
- **Cause:** the card showed the checks stored when the draft was made, plus the live mechanism check. The workspace ran only its own live layout check. Each showed problems the other didn't.
- **Solution:** both run the same checks live. The card runs the draft's full check set again (keeping only the stored build time) and shows that score, with the score when drafted on hover (`AdminPage.tsx`, `draftLive`). The workspace strip lists layout and mechanism problems together, and its button asks Gemini to fix both (`ModelLab.tsx`). Checked in Edge: the rebuilt quick return is clear on both, and the three broken drafts are flagged on both.
- **Lesson:** one question ("is this draft right?") should have one answer, computed by one function, wherever it is shown.

### 73. "Rebuild all flagged" only counted drafts that move wrongly (2026-11-08)
- **Problem:** the queue said "1 draft moves wrongly" while other drafts had parts floating in mid-air (the scotch yoke's crank) or moving parts not joined, and those were left out of the rebuild.
- **Cause:** the flag was built for the motion check alone, when every engineering fault deserves a rebuild.
- **Solution:** a draft is flagged when any engineering check fails today: builds, every shape drawable, layout (floating or buried parts), moving parts connected, mechanism moves right, calculations work. The bar names how many of each ("5 drafts fail today's checks (4 parts out of place, 1 moving parts not connected, 3 move wrongly)"). Overlapping labels, build time and the like still show on the card but don't call for a rebuild (`AdminPage.tsx`, `SERIOUS`, `draftFaults`). Checked in Edge at desktop and phone width on the downloaded drafts. On the way, an edit by line number overwrote a closing `</button>` in the form above (the file had shifted); the type-check caught it and it was restored before commit.
- **Lesson:** a flag for "needs work" must cover every way the work is broken; and never edit by line number after the file has changed.

### 74. A change asked of Gemini while reviewing a draft never reached the draft (2026-11-08)
- **Problem:** opening a draft from the review queue (Open in 3D) and asking for a change there (the chat box, Fix it, Fix the layout) built the change, but the draft in the queue stayed as it was.
- **Cause:** the workspace treated an opened draft as an unsaved preview with no model of its own, so the build was saved as a brand-new model in the reviewer's My models and the page moved to it, losing its link to the draft. Only changes by hand could go back, through Save changes to the draft. The header also said "Preview, not saved" either way.
- **Solution:** while a draft is open, a change asked of Gemini goes back into that draft: the new model, its explanation, score and checks are saved to it, then a fresh picture once it has drawn. Nothing is saved to My models, and the page stays on the draft (`ModelLab.tsx`, `send`). The header says "Draft under review: saved" or "changes not saved yet" (for changes by hand, still saved with the button). Checked in Edge against a stubbed API: queue (card flagged) → Open in 3D → ask for a change → the draft received the new model, score and checks, then its picture → back in the queue the card scores 100 and is no longer flagged. A slider change saved with the button reached the draft too (r = 0.08). Same at phone width.
- **Lesson:** when a page can be opened for different things (your model, a library model, a draft under review), every way of changing it must know which one it is writing to; test the whole trip, not the page alone.

### 75. The dimension sliders looked usable while a change was being built (2026-11-08)
- **Problem:** while a rebuild or change ran in the model view, the Dimensions sliders looked active, but moving them did nothing; it looked broken.
- **Cause:** their changes were ignored during a build (the new model replaces the sizes when it lands), but the sliders were never shown as locked. The part panel, materials, adding and removing parts and renaming already locked.
- **Solution:** the shared slider has a locked state (`controls.tsx`, `disabled`). The Dimensions sliders use it during a build, under a line saying they unlock when it is done (`ModelLab.tsx`). Checked in Edge: during a build, all 6 dimension sliders are locked (the toolbar's view controls stay usable); after it, they unlock, motion resumes, and a slider change saves to the draft.
- **Lesson:** a control that does nothing must look like it does nothing.

### 76. A solved question came back without its solution (2026-11-08)
- **Problem:** testing "Solve a question", the model was built and the request carried the question and its screenshot, but the model view showed no worked solution, just the usual panels.
- **Cause:** the new fields (`question`, and each step's `step` and `answer`) were added to the types and to the cleaning step, but the final schema check at the end of cleaning (`noteSceneSpecSchema`) silently drops any field it doesn't list.
- **Solution:** the fields are in the schema too (`schema.ts`), and a worked step's LaTeX may be up to 400 characters. Checked by cleaning a sample model (the fields survive), then in Edge: the question, Given, Find, four numbered steps and the boxed answers show. They match the hand working (R_A = 28.33 kN, R_B = 21.67 kN, M = 46.67 kN·m), and moving the point load to 30 kN re-solves to 35, 25 and 60.
- **Lesson:** a new field has to be added everywhere the data is filtered: the type, the cleaner and the schema. Test the whole path with real data, not each piece alone.

### 77. The model view was wider than a phone (2026-11-08)
- **Problem:** at 390 px the model view's page was 473 px wide: the side panel's text and the 3D toolbar ran off the right edge.
- **Cause:** on a phone the page grid has a single column with no width set, so it grew to fit its widest child. Each Parts row's material dropdown is as wide as its longest material name.
- **Solution:** the phone grid's column is pinned to the screen (`grid-cols-[minmax(0,1fr)]`), and the parts' material dropdowns are a fixed narrow width (`ModelLab.tsx`). Measured in Edge: 390 px wide at 390 px, nothing past the edge, desktop unchanged.
- **Lesson:** a grid or flex column without a minimum of 0 grows to fit its content; on any page that holds model output, set it, and measure the page width at 390 px rather than trusting the screenshot.

### 78. The shell turned a "\n" inside a test request into a real line break (2026-11-08)
- **Problem:** after adding the nightly "solve-beam" case, the type-check failed with "Unterminated string literal" in `cases.ts`.
- **Cause:** the case was written through a shell heredoc into a Python script, and the `\n` in the request became a real newline inside a single-quoted TypeScript string: the trap in entry 35 again.
- **Solution:** fixed with the editor; the type-check caught it before anything ran.
- **Lesson:** as entry 35: text with backslashes goes in with the file editor, never through the shell.

### 79. A calculation that couldn't be worked out showed as 0 (2026-11-08)
- **Problem:** testing new numbers for solved questions, a step that cannot be worked out (the root of a negative) came back as an ordinary 0. The nightly check "calculations work", which looks for results that aren't numbers, could therefore never fail.
- **Cause:** the formula evaluator was written to size 3D parts, where a bad value must never stop a part drawing. So it falls back quietly: an expression that fails gives 0, √ of a negative is √0, log of zero or less is 0, a division by zero is 0, and an unknown name is 0. Calculations used the same evaluator.
- **Solution:** a strict mode for calculations (`evalDim(…, strict)`, used by `evaluateCalculations`). There, each of these makes the step "can't be worked out": marked `broken`, shown as "—", explained in the worked solution, and failed by the nightly check. Sizes keep the forgiving behaviour. Tests in `note3d/formulaFunctions.test.ts`. None of the downloaded drafts had a broken step, so nothing that worked before changed.
- **Lesson:** as entry 53: a value that can't be worked out must never pass for a plausible one. A fallback that suits geometry does not suit engineering answers.

### 80. asin and other common functions silently returned their input (2026-11-08)
- **Problem:** the quick-return draft's "Lever swing half-angle" read 21.91°; the right answer is 22.48°.
- **Cause:** the evaluator knew 14 functions, and any other one returned its own argument, so `asin(r / c)` became `r / c`. Gemini uses asin, acos, ln and others because textbooks do, and nothing flagged it.
- **Solution:** added asin, acos (outside −1…1 they can't be worked out), atan2, ln, log10, pow, sinh, cosh, tanh, hypot, floor, ceil and round. An unknown function in a calculation now can't be worked out. The list is one constant (`FORMULA_FUNCTIONS`), the prompt names exactly those, and a test checks that each one really computes and that the prompt lists every one.
- **Lesson:** what the model is told it may use and what the code can do must come from one list, checked by a test.

### 81. Exam practice's 3D view was cropped and its toolbar cut off (2026-11-08)
- **Problem:** putting each exam problem beside its rig, the engine was cut off at the edges of the view, and the toolbar ran past the view's rounded corners. On a phone the toolbar covered most of the view.
- **Cause:** a rig's camera and toolbar are set up for the rig's own, wider page; the toolbar caps its width at the screen, not at its container.
- **Solution:** the side view frames the rig further back (`Stage frame`), and its toolbar is capped at the view's width (it scrolls sideways if needed). On a phone the toolbar is left to the full rig, a link away (`study/ui/RigView.tsx`). Checked in Edge at 1366 and 390 px: the whole engine shows, and New numbers and Next reload the rig with the problem's numbers.
- **Lesson:** a component borrowed from a full page into a smaller box needs its framing and its size limits checked in that box.

### 82. Switching to a problem on another rig threw "removeChild: not a child of this node" (2026-11-08)
- **Problem:** in Exam practice, choosing a subject whose first problem uses a different rig (engine → tensile test) raised an uncaught React error in the browser, in about two runs of three.
- **Cause:** the rig view loaded the new rig into the same view: it emptied it, then built the new one. One of the old rig's 3D labels (drawn as a page overlay with its own React root) was then cleaned up after its container had already gone. The rig pages never hit it, because each rig there gets a new view.
- **Solution:** a new rig gets a new view (`key` per rig on `RigView` in `ExamPage.tsx`), as on the rig pages. Checked by bisecting in Edge: with the 3D off, no error; without the key, the error in 2 of 3 runs; with it, 7 of 7 clean.
- **Lesson:** when a view holds things with their own lifetimes (3D labels, canvases), swap the whole view rather than its contents; and repeat an intermittent check several times before trusting a pass or a fail.

### 83. Read notes' 3D figures stopped drawing on the live site (2026-11-08)
- **Problem:** the owner reported 3D in PDFs not showing again. On solidify.studio, switching from one note to another threw "removeChild: the node to be removed is not a child of this node", after which React's picture of the page could be wrong and figures could stop drawing. The dev server never showed it; only the production bundle did.
- **Cause:** the labels on 3D figures (load arrows' "18 kN", value tags) use drei's `Html` (10.7.9), which gives each label its own React root. Its cleanup takes the label's wrapper off the page and then unmounts that root straight away, while React is in the middle of removing the figure. React 19 defers that unmount, then removes the label a second time from a wrapper that is already empty. Found by building production locally, wrapping `removeChild` to log the failing element (it was the "18 kN" and "85" labels, already detached), and reading drei's source. Entry 82 was the same fault, met in Exam practice; the per-rig key there only avoided it.
- **Solution:** our own `Html` (`render/Html.tsx`) for the simple labels the app uses (a point, centred or not, ordered by distance). It unmounts the label's root first, just after the current update, and only then takes its wrapper off. All 16 files switched to it. Figure views in Read notes are also keyed by document, page and figure, since figure ids repeat across documents. Checked on a local production build: 3 of 3 runs through all the sample notes, no error and no bad removal, where before every run failed. 2264 tests pass.
- **Lesson:** check fixes against a production build when the fault is only seen live; and when a library's cleanup order is wrong, replacing a small part of it can be simpler and safer than working around it at every use.

### 84. Formulas in chat answers and solutions were not written as maths (2026-11-08)
- **Problem:** feedback on "Cylindrical cantilever: strength and stiffness performance indices" said the formulas were not clear, for the question "Give me a formula derivation for strength index without numbers". Answers in the model view's chat, and solution steps without their own LaTeX, showed equations as code-like text ("sigma = M*y/I", "(P * a + W * L / 2) / L").
- **Cause:** the model view's chat printed Gemini's answer as plain text, though the app already had a renderer for maths in text (used by the tutor). The prompt asked for answers "in plain words, 2 to 5 sentences", which allowed no proper derivation, and a calculation's LaTeX was optional. Steps without it fell back to the raw formula, and the "numbers put in" line was always monospaced code.
- **Solution:** chat answers go through `RichText` (maths, lists, paragraphs), which now also reads LaTeX's own `\( \)` and `\[ \]` delimiters and keeps the numbers of a numbered list split by a displayed equation. A formula with no LaTeX is written out as an equation by `note3d/exprTex.ts`: fractions, roots, powers, inverse trig, Macaulay brackets, subscripts and Greek names. Its tests check that everything it writes is valid KaTeX. The numbers-put-in line is an equation too, with earlier results as they are shown (21.67, not 21.7) and full-size fractions. The prompt asks for every equation in LaTeX, derivations as numbered steps (symbolic when asked "without numbers"), LaTeX on every calculation, and symbols in step sentences in LaTeX. Saved chat answers may be up to 4000 characters. Checked in Edge at desktop and phone width: a four-step derivation in all three delimiter styles draws fully, and a step stripped of its LaTeX shows R_B as a fraction with its numbers.
- **Lesson:** on an engineering platform an equation is never plain text; render maths wherever model text is shown, and keep one renderer for it.

### 85. A problem with nothing physical in it was still built in 3D (2026-11-09)
- **Problem:** in the first user test, a transportation problem (supply, demand, costs) came back as a 3D model view that added nothing, with the worked answer pushed to the side and the chat not the focus.
- **Cause:** the prompt treated every pasted problem as a setup to build, and the app had no way to show an answer without a model: a question-style reply was only accepted when a model was already open.
- **Solution:** the prompt lists what has nothing to build (operations research, statistics, engineering economics, pure maths, definitions, non-physical derivations). For those Gemini replies `answerOnly` with the full worked answer: given and asked, numbered steps, LaTeX equations, Markdown tables, charts in ```` ```chart ```` blocks (a curve from a formula, or bars from data), and the answer in bold. The API passes it through (`readCreateReply`, counted as "answer"). The model view shows it as a centred reading column with no 3D area or side panel, headed "Worked answer". It is saved with the models (marked `answerOnly`, so it reopens as text and shows in Your questions as "Read the answer"). A follow-up question carries the conversation. Along the way: the reopened answer stayed behind the loading skeleton (the "still opening" test waited for a model that never comes; now a conversation counts as open), and charts stretched to the full column width (capped). Tests: API reply test, Markdown table and chart parsing, chart reading; checked in Edge at desktop and phone width (table, two charts, equations, saved and reopened as text).
- **Lesson:** not every engineering question is a 3D question; the app must be as good at a written answer as at a model.

### 86. A derivation asked "without numbers" came back with made-up values (2026-11-09)
- **Problem:** a request for a derivation produced numbers the question never gave.
- **Cause:** the problem rules said "every number the problem gives is a parameter", and the sliders need values. Chat answers were told to use "the model's real numbers". So Gemini invented givens and worked with them.
- **Solution:** never invent a number; a derivation with no numbers is solved in symbols (`question.symbolic`): each parameter's value only draws the model and its label says "(illustrative)". The solution panel then shows Given as symbols only, steps as equations with no numbers put in, the Answer as the derived equation, no Try-it or New numbers, and a note that the sliders only size the model. Engineering derivations still get their 3D model. Chat answers use a model's numbers only when a value is asked for. Nightly case derive-cantilever checks it.
- **Lesson:** a model must never present an assumption as a given; when values are only for drawing, say so on the page.

### 87. The app read as being for machines only; a materials science student felt left out (2026-11-09)
- **Problem:** the tester studied materials science; the home page, the prompt ("the user describes a machine, mechanism, component or tool") and the examples all spoke to machines.
- **Cause:** Solidify grew from agricultural machinery; nothing had widened its words since.
- **Solution:** the prompt covers any engineering or science subject, with materials science spelled out (unit cells as spheres and edges, slip planes, defects, grains; phase diagrams and S-N curves as charts). The home page leads with "Paste any question, from materials science to machine design" and a Solve a question button, and has a For students / For teachers section with real starting links in place of the hidden Pro / Study one. The question box's example is a BCC packing-factor question, and the page title reads "Engineering in 3D: models, labs and worked answers". Nightly case bcc-cell.
- **Lesson:** the words on the first screen decide who feels the app is for them; check them against who actually uses it.

### 88. Formulas in the right-hand panel showed as raw text (2026-11-09)
- **Problem:** in the solution panel and the Live and Working cards, labels, Find items and the question text showed LaTeX or symbols as typed ("$\sigma_{max}$", "\sigma").
- **Cause:** those places printed text as text; only the chat and the step equations were drawn as maths.
- **Solution:** `RichInline` (maths in a short label, and a label in bare LaTeX taken as maths) for Given, Find, step and answer labels and the Live and Working labels; the question text through `RichText`. Checked in Edge.
- **Lesson:** every place model text appears is a place maths can appear.

### 89. The four-bar's crank vanished in the cutaway (home page and its rig) (2026-11-09)
- **Problem:** the owner saw the crank of the home page's linkage disappear; the Mechanisms tile picture showed the four-bar with no crank at all.
- **Cause:** planar rigs stack their links in front of a board at different depths (four-bar: frame 6 mm, rocker 14, coupler 22, crank 30). The cutaway "through the links" put its plane at 20 mm and cut moving parts too, which removes everything in front of the plane. The coupler was cut through, but the crank lay wholly in front, so it vanished. The cutaway is part of the home page's show reel and the default for the tile pictures.
- **Solution:** each plane goes through the front link instead: four-bar at 30 mm (the crank shows hatched), slider-crank at 36 mm (the connecting rod), velocity diagram at 30 mm (the coupler), inversions at 50 mm (the connecting rod and crank). Found by an audit of all 115 rigs (`scripts/audit-cuts.mjs`), which applies every cutaway that cuts moving parts and lists any moving part whose whole box lies on the removed side. The other hits are half sections where the far half is meant to go (a right wheel, push rods). All 12 mechanisms rigs pass, the tile and the four rigs' pictures were retaken, and the cut was checked in Edge.
- **Lesson:** a section plane must go through what it is meant to show; check that every moving part is still drawn in each cutaway, for every rig, not just the one reported.

### 90. The phone menu ran off the right edge of the screen (2026-11-09)
- **Problem:** on a phone the Menu sheet was a fixed 256 px panel hung from the Menu button, about 140 px in, so it ran past the right edge and was cut off. It also listed Solve a question twice.
- **Cause:** the sheet was positioned from the button, not from the page; the item is in both Create and Study.
- **Solution:** the sheet hangs from the header bar with a 16 px margin each side (a 320 px panel on tablets), and a link a later section also has is listed there only. Measured in Edge at 360, 390 and 820 px: inside the screen every time, page width unchanged.
- **Lesson:** a popover on a phone belongs to the page's margins, not to the button that opens it; measure its box at the narrowest width.
## Nightly tests, admin and labs pages (2026-11-06)

### 91. A propped-cantilever model crashed the whole workspace
- **Problem:** `Cannot read properties of undefined (reading '0')`, blank page.
- **Cause:** Gemini sent a `recommendedCut` without a `normal`; the cleaner passed the object through unchecked and an effect read `normal[0]`.
- **Solution:** `cleanCut` in `note3d/sanitize.ts` checks every field (also applied when opening saved models and in the notes reader), and error boundaries round the 3D view, the side panel and each page.
- **Lesson:** validate every nested field of model output, not just its presence; and no page should be one bad value away from blank.

### 92. Nightly builds failed with "Something went wrong on the server" (500)
- **Problem:** Nightly builds failed with "Something went wrong on the server" (500).
- **Cause:** Gemini answered 429 RESOURCE_EXHAUSTED when three builds ran at once, and the API gave up on the first refusal.
- **Solution:** `api/src/retry.ts` waits and retries (2, 6, 15 s) on 429/503, streamed builds retry if refused before their first word, the final failure says the model is busy (503), and the runner tries once more after 30 s.
- **Lesson:** treat rate limits as normal for a hosted model; read the service's logs before guessing.

### 93. A draft scored 100 while visibly broken
- **Problem:** (rods not reaching the crank, a tilted flywheel through the casing, labels on top of each other).
- **Cause:** the checks only covered layout overlap, drawability and calculations.
- **Solution:** checks for moving parts joined by relation and for overlapping labels, and the prompt states the same rules.
- **Lesson:** a score is only as good as its checks; look at high scorers before trusting the number.

### 94. Deploy failed: "Build failed; check build logs"
- **Problem:** Deploy failed: "Build failed; check build logs".
- **Cause:** `gcloud run deploy --source .` run from the repo root, which has no Dockerfile.
- **Solution:** run it from `api/`.
- **Lesson:** `--source .` uploads the current folder; check where you are.

### 95. Rig thumbnails came out blank, and with a stray `_` in their names
- **Problem:** Rig thumbnails came out blank, and with a stray `_` in their names.
- **Cause:** two scenes photographed before they had drawn in a reused tab; and the rig list written by Python on Windows had CRLF line endings, so each id ended in `\r`.
- **Solution:** retook those two in a fresh tab (`SHOT_COLD=1`); renamed the files and strip `\r` when reading lists.
- **Lesson:** check the smallest output files of a batch capture, and strip `\r` from lists made on Windows.

### 96. Inline scripts lost their backslashes
- **Problem:** A `node -e` / heredoc script through the shell turned `C:\Program Files` into `C:\Program Files`, so the browser path was not found.
- **Solution:** forward slashes in Windows paths in scripts, and the editor rather than the shell for code containing escapes.
- **Lesson:** don't pass escape-heavy code through the shell.

### 97. Prettier reformatted a file into another style
- **Problem:** With no project config it used its defaults (double quotes, semicolons).
- **Solution:** re-run with the project's settings (`--no-semi --single-quote --print-width 220`).
- **Lesson:** don't run a formatter the project doesn't configure.

### 98. The Labs page was wider than a phone
- **Problem:** The Labs page was wider than a phone.
- **Cause:** one-line rig names in a grid item set its minimum width.
- **Solution:** `min-w-0` on the card.
- **Lesson:** any `truncate` text inside a grid or flex child needs `min-w-0` on that child.

### 99. Gearbox levers hung in the air, and the reverse idler had no shaft
- **Problem:** Gearbox levers hung in the air, and the reverse idler had no shaft.
- **Cause:** the cut-away removed the half of the casing the lever towers stood on (moving parts are not cut, so the levers stayed); the idler's shaft was defined but never drawn, and a full-length pin would have run through third gear and the range gears.
- **Solution:** a shift cover the towers stand on; a stub shaft and wall boss for the idler; and the cut now removes the other half, with the cameras moved to that side, so everything kept is attached to something.
- **Lesson:** a cut-away must keep whatever holds up the parts it leaves whole; check every part has a visible support, in every cut, not only the opening view. I missed this twice by checking the framing instead of the model.


### 100. The draft review card was chaotic on a phone (2026-11-09)
- **Problem:** on a phone each review draft showed its checks, the full problem list, the checklist, a notes box, a fix box and seven buttons at once, wrapping into a wall of controls.
- **Cause:** every tool for a draft was added to the card as its own row as it was built, with nothing grouped or folded.
- **Solution:** the card shows one problems line (opens to the list), the review checklist folded to a count ("Review · 1 of 3 checked"), and two buttons, Open in 3D and Approve; Fix with Gemini, Rebuild, Download, History and Reject sit under More, and the ones that need input or confirmation open in a dialog (the fix dialog can fill in the problems found).
- **Lesson:** when adding a control to a card, decide which two actions matter most and group the rest; check the card at phone width each time it grows.

### 101. The phone Menu button sat beside the logo (2026-11-09)
- **Problem:** on a phone the Menu button sat right after the logo, with the account button alone at the far right; the owner read it as misplaced.
- **Cause:** the button was placed where the desktop nav pills go, in the middle of the bar.
- **Solution:** Menu sits at the far right after the account button, where phone menus usually are; its sheet now opens from the right on tablets.
- **Lesson:** place phone controls where phone users look for them, not where the desktop version happens to have them.

### 102. Formulas had their own tiny scroll bars (2026-11-09)
- **Problem:** in the model view the calculation cards scrolled up and down a few pixels each, so the panel felt "weirdly scrollable".
- **Cause:** the maths boxes set `overflow-x: auto` for long formulas; CSS then makes the other direction scroll too, and KaTeX draws a few pixels above and below its line box.
- **Solution:** `overflow-y-hidden` with a little padding on every maths box (calculation cards, part inspector, worked solution, formula sheet, chat maths).
- **Lesson:** a horizontal scroller needs its vertical overflow set as well, or it scrolls both ways.

### 103. The model view on a phone left the model a thin strip (2026-11-09)
- **Problem:** a draft opened from review on a phone showed a four-row title bar, a four-line problems banner, the toolbar and the Chat/Engineering tabs, leaving about 130 px of model; the page also scrolled while the panel under it scrolled inside it.
- **Cause:** desktop pieces stacked on the phone unchanged; the lower row was sized to its content, so the page grew past the screen.
- **Solution:** a two-row title bar (back arrow and name; state and Save), a one-line problems banner that opens on tap, the chat as a round button that opens a sheet (with a dot when a reply comes in while shut), Engineering always under the model, and the page fitted to the screen: the model half, the panel the rest, which scrolls by itself.
- **Lesson:** on a phone measure what the model actually gets, and check that only one thing scrolls.

### 104. The installable app never offered to install (2026-11-09)
- **Problem:** after the app became installable, the owner opened it on their phone and saw no install prompt.
- **Cause:** the code took the browser's install offer (to stop Chrome's own mini bar) and only added a quiet "Install the app" line inside the Menu sheet, so nothing on screen said it could be installed.
- **Solution:** a small "Install Solidify" card appears a few seconds into a visit once the browser offers it (Install / Not now, away for a month after Not now); on iPhone Safari, which has no offer, it explains Share, then Add to Home Screen. The menus keep the item.
- **Lesson:** when replacing a browser's own prompt, replace it with something at least as visible.

### 105. The class page crashed on a malformed report, and teachers could not run a class from it (2026-11-09)
- **Problem:** the owner found the Classes view weak for teachers: one course at a time in a single list, only rigs, questions and challenges could be set, no way to edit a class or its work, a bare student page; and the class report crashed with "r.students is not iterable" when a results reply came back without its list.
- **Cause:** the class page grew one section at a time on a single long page; the report read `students` from every reply without checking it was a list (model output and server replies must both be treated as untrusted).
- **Solution:** a teacher page in four tabs (Work, Students, Report, Settings); a Set work dialog that ticks any number of rigs, questions, challenges and library models, narrowed to the class's subjects, plus links and notes, all with one due date and instructions; work grouped by overdue, coming up and undated with how many have done each; edit and remove in dialogs; a join panel with an invitation to copy and a new-code button; a student list with each one's progress; settings for name, description and subjects, and closing the class. Students get a summary (done, next due, overdue), a to-do list in due order with instructions, Mark done for links, notes and models, and the done list folded. The report checks every reply.
- **Lesson:** the role a feature exists for (teachers here) needs the whole job covered, set up to follow-up; and every list read from a reply needs an `Array.isArray` check.

### 106. A rig opened from a link sometimes came up with nothing picked (2026-11-09)
- **Problem:** "Open in the rig" from the home hero opened the four-bar without the part the visitor had clicked; the same path serves search results and "seen in" links.
- **Cause:** the rig looked for the named part once, 0.45 s after the scene loaded; when the scene's code was already loaded (the hero had just shown it) its parts were not registered yet at that moment, and a big machine can take seconds.
- **Solution:** the rig keeps looking for the part every 0.3 s for about 4 s, and picks it once it is drawn.
- **Lesson:** never wait a fixed time for something that loads at its own pace; poll for it with a limit.

### 107. Oil and other liquids flashed as the camera moved (2026-11-09)
- **Problem:** in cut-aways the oil in a sump (the differential's crown wheel, the gearboxes, the engine's water jacket) flickered with streaks of the casing breaking through as the camera turned; the owner sent a screenshot of the final-drive sump.
- **Cause:** each liquid's volume is drawn right up to its container's inner walls, so the two surfaces are in the same place and the depth test picks either one from frame to frame (z-fighting). In a cut-away the liquid's far side is drawn as its section face at the far wall's depth, exactly where the casing's inner wall is, so whole patches swapped.
- **Solution:** every liquid material (oil, hydraulic oil, coolant, fuel, water, and the live gas volumes) gets a small polygon offset toward the camera, so the liquid wins wherever the surfaces coincide. Measured with `web/scripts/flicker.mjs` (turns the camera in small steps with the motion paused and maps pixels that jump away and back): flashing pixels on the differential fell from 402 to 149 (the rest are single-pixel edges of gear teeth and bolts), and the oil patches are gone on every rig checked. Hiding the liquids with the cut-away off changes no pixel of a closed casing, so nothing shows through a wall.
- **Lesson:** two surfaces modelled in the same place will fight; when a volume fills a container, give one of them a depth preference (or leave a gap). Measure flicker by frames, not by eye.

### 108. Demo videos of the rigs were not smooth (2026-11-09)
- **Problem:** the screen recordings made for the demo videos stuttered; the owner asked whether their PC was the cause.
- **Cause:** the recordings used the browser's screencast, which sends a frame only when the browser has time to draw one, so a busy WebGL scene gave an uneven 15–40 frames a second that was then stretched to 30. A faster computer would hide it, not fix it. A first portrait reel also framed the machines far too small, because the scene's size included the 33 m shadow catcher, the floor grid and the backdrop.
- **Solution:** `web/scripts/reel/make-reel.mjs` freezes the page's clock (its own `performance.now` and `requestAnimationFrame`), moves it exactly one frame, takes a picture and repeats, so every frame is evenly spaced however long it takes to draw. The framing measures only lit machine parts and fits their corners to the portrait frame.
- **Follow-up:** the owner found the first reel bland (plain backdrop, nothing being used). Each machine now plays out on the blueprint backdrop with a drawn pointer driving the real mouse: the app's own hover highlight and tip, then a click that opens the part card, all on beats. The first try clicked the crankshaft instead of the piston it had hovered, because the piston had slid out from under the pointer; automatic picks now prefer parts that stay in place, and a click re-finds its part first.
- **Lesson:** for video, record frame by frame on a controlled clock rather than in real time; a slow machine should only make the recording take longer. Size a scene by its parts, not everything in it. A demo should show the app being used, not just the models.

### 109. The social reel's pace jumped between fast and slow, and it didn't show the app's controls (2026-11-09)
- **Problem:** reviewing the beat-cut reels, the owner listed these, and the checks found more:
  1. The pace was not consistent: the camera drifted slowly (about 4° a second), then a drag-spin whipped it 160° in one or two beats, then it went back to the drift.
  2. The zoom went in within one beat, sat still, then came out within one beat.
  3. Every pointer move took exactly one beat, so long moves whipped across and short ones crawled.
  4. A 6% zoom punch on every cut and click jolted the frame.
  5. Taking the machine apart took 0.6 s while everything else was slow.
  6. There was no real zoom onto a part (the owner: "so no zoom").
  7. The cut-away and the take-apart just happened, with no control being used; the app does them from its toolbar.
  8. The background was near-black: the app's dark backdrops (#07090a, #06101e, #12100e) plus an added vignette measured about rgb(21, 27, 33).
  9. A click sometimes picked a different part from the one hovered (a piston slid out from under the pointer; a click over the cooling system's liners picked the crankshaft).
  10. Framing: a tall engine ran under the caption, a combine came out tiny because its field was counted, and the machine later sat behind the part card.
  11. The automatic part pick chose the gearbox casing twice; named parts give better shots.
  12. "Look closer" was skipped: the pointer looked for it before the part card had opened, and a target not on screen yet was treated as missing instead of waited for.
- **Cause:** each move had been given its own fixed timing (a beat per move, 0.6 s per take-apart, a spin as a burst) rather than one pace for the whole shot, and the reel drove the view's state directly instead of the app's own controls.
- **Solution:** in `web/scripts/reel/make-reel.mjs`: the machine turns at one steady rate (degrees per beat, the same in every shot so a cut carries the motion on); the pointer moves at one speed and sets off as early as it needs (up to two beats) to land on its beat; a spin is the pointer holding a point on the machine as it turns; zooms ease in and out over a beat and a half; take-apart is a steady one-beat drag of the toolbar's Explode slider; the cut-away is a click on the toolbar's Section button; "Look closer" on the part card flies the camera to the picked part; the zoom punches are gone. The recording page (`#/shot/...?reel=1`) shows the rig's real toolbar under the part card. The backdrop is a navy glow behind the app's grid. Clicks are checked against the hovered part, automatic picks prefer parts that stay in place, the framing counts only lit machine parts within the rig's view and leaves room for the caption, card and toolbar, and a pointer target not on screen yet is waited for. `REEL_DEBUG=1` prints when each pointer move sets off and lands.
- **Lesson:** a video's motion needs one pace, set for the whole piece, not per move; and a demo should drive the app's real controls on screen, not change its state behind the scenes.

### 110. Long generated models ran off both sides of the workspace's 3D view (2026-11-10)
- **Problem:** opening the worked beam question (a 6 m beam) from a model file, the beam ran off both sides of the 3D view and its force labels overlapped, even after the camera settled. Found while checking the new Open a model file page.
- **Cause:** `fitView` set the camera distance from the vertical field of view only (32°). The workspace's 3D column is narrower than it is tall (about 670 × 776 px on a desktop; nearly square on a phone), so the sideways angle is the tighter one, and a long, flat model was fitted to a view wider than the one it had. It affected every generated model longer than it is tall, beam questions above all.
- **Solution:** `fitView` fits whichever angle is tighter, taking the view as 0.85 wide to 1 tall. Checked in the browser: the beam, the gear pair, the shaft, the differential and the block all show whole at 1366 × 900, and the beam and gears at 390 × 844.
- **Lesson:** framing must use the narrower of the two angles; check opening views with long models, not only compact ones.

### 111. The format's public viewer almost shipped every lab rig's code (2026-11-10)
- **Problem:** the first build of the standalone .slfy viewer (for slfy.solidify.studio) came to 8.2 MB, and its files included a chunk for every hand-built lab rig (governors, gearboxes, brakes…). Published, that would have put Solidify's private rig code in a public repository. The first build also copied the app's whole `public` folder (36 MB of media).
- **Cause:** the viewer took the studio lighting from `InlineFigure3D.tsx`, which also imports the rig catalog for Read notes figures; the catalog's lazy imports became chunks of the viewer build even though the viewer never loads them. The separate Vite config used the default `publicDir`.
- **Solution:** the lighting moved to its own file (`web/src/note3d/studioLights.tsx`) that both use; the viewer config sets `publicDir: false`. The build is now 3.1 MB: the viewer and KaTeX's fonts only. Checked the bundle for Firebase keys, API addresses, Gemini prompts and rig names (none). The site's examples list was also split on commas in its template, which broke cards whose text had commas; it is now a data file (`_data/examples.yml`).
- **Lesson:** before publishing any build, list what is in it and search it for private code and keys; one convenience import can pull a whole private module tree into a public bundle.

### 112. Four published example models came apart: floating gears, a yoke above its frame (2026-11-12)
- **Problem:** on slfy.solidify.studio (and in the app's Open a model file page) the worm reducer, helical gear pair, quick-return mechanism and scotch yoke showed parts floating: the helical gears hung above a bare base plate, the scotch yoke sat above its frame and did not follow the pin, the worm wheel stood outside its housing, the shaper's lever swung beside a ram that did not follow it. The owner spotted it; the gallery pictures showed it too.
- **Cause:** the examples were AI-generated test models exported from the admin lab, and their own review records listed the faults ("Scotch Yoke Crosshead is floating", "Drag Link is floating", scores 75–88). They were published as examples without reading those checks or looking at each one closely. The models placed parts with `against` plus hand shifts and animated linkages with `oscillate` instead of the lever and follower mounts.
- **Solution:** the four models' parts were rebuilt by hand in `format/source`: only the driver has a motion; the yoke and the ram are followers of the crank pin and the lever's tip; the lever uses the lever mount; gears mesh; bearings sit in pedestals or housing walls sized from the same formulas as the gears, so they stay together when a slider moves. The crank pin is part of the crank so the lever's plane is the crank's (a pin as a separate part further forward tilted the lever). A worm thread is drawn with a spring shape. `web/scripts/check-asm.ts` prints each part's place and the layout problems for a source file. Pictures retaken; checked in the viewer at two moments of the motion.
- **Lesson:** a generated model is not an example until its review checks pass and someone has watched it move; read the stored `checks` before publishing any library model, and never publish a model scored under 100 without opening it.

### 113. The muff coupling's key spun on the spot inside a sleeve that stood still (2026-11-12)
- **Problem:** in the muff coupling example the sunk key turned about its own centre on the shaft axis, the setscrew lay along the axis, and the sleeve stood still while both shafts turned in it. The owner spotted the key "spinning weirdly".
- **Cause:** another generated model published unread (its checks said "Sunk key is buried inside Driven shaft"). The key and setscrew were mounted coaxial with the sleeve and shifted along X, which is the shaft axis, not across it; each turning part had its own rotate motion, so nothing turned as one body.
- **Solution:** the sleeve is the one driver; the key and setscrew are its `children` (placed in its frame at the shaft radius, the screw radial over the key), so they go round with it; the shafts are coaxial with the sleeve and turn with it, keyways on the key's side. The viewer's parts list now includes child parts (it listed top-level parts only, so the key could no longer be picked).
- **Lesson:** parts that are fixed to a turning part belong in its `children`, not on mounts with their own motion; and a list of parts must walk children.

### 114. A gear and its shaft seemed to turn at unrelated speeds; all 23 stored models checked (2026-11-12)
- **Problem:** in an admin draft (a stepped shaft with a gear, 1,200 rpm) the gear and the shaft's keyway seemed to turn at different speeds, and differently again at every rpm setting. The owner recorded it. Checking every stored model (16 drafts, 7 published) the same way found: 12 with real speeds far too fast for a screen (25–188 rad/s); 16 with a motion written on mounted parts as well as the driver (ignored, harmless); 7 placing a part by "against" plus a large hand shift; 5 with LaTeX in 3D labels ("T_{in}" drawn as typed); 4 with a key, pin or setscrew mounted coaxial with a shift so it spins on the shaft's centre (one of them the published muff coupling, scored 100).
- **Cause:** the prompt rightly asks for real speeds in rad/s, but the renderer played them in real time: at 20 turns a second a shaft moves a third of a turn per frame, so teeth and keyway each strobe their own way. The prompt never mentioned `children`, said a shift is "small" without a limit, and did not say labels are plain text. The score has no check for parts fixed to a turning part, so a spinning key scored 100.
- **Solution:** `playbackPace` (kinematics.ts) slows the whole model by one factor (ratios hold): under 2 rad/s is real time; faster is squeezed in under the speed at which the smallest gear's teeth still read frame to frame, rising gently so a faster setting still looks faster; applied to the shared clock and to parts with their own motion. `plainLabel` (sanitize.ts) turns LaTeX in a label into plain text. Prompt: keys, pins and setscrews go in the `children` of the part they are fixed in; a shift is at most about 0.03 m; a coupling turns with its shafts; labels are plain text. `web/scripts/check-all-models.ts` runs a folder of saved models through the layout and motion checks and tallies the faults. The examples' hand-slowed speeds were put back to real ones.
- **Lesson:** real-world speeds need a display pace, never real time; and when one generated model shows a fault, run the whole stored set through a script before deciding whether it is the model, the prompt or the renderer. Still open: a score check for keys and pins that do not ride with their part; the published muff coupling still has the fault.

### 115. A spinning key scored 100; a typo had switched off a motion rule for months (2026-11-12)
- **Problem:** the published muff coupling (key spinning at the shaft's centre, sleeve standing still round turning shafts) scored 100, so nothing stopped it reaching the library. While adding a check, the new pattern never matched "Sunk key".
- **Cause:** no score check looked at parts fixed in a turning part. The pattern failed because `\b` written through a shell heredoc into a Python string became a backspace character (0x08) in the file, invisible in the editor. The same character was already in `kinematics.ts` (`FIXTURE`, from the commit behind build log 69/70): the rule that keeps a fixed pivot pin from being taken for a lever had never matched anything.
- **Solution:** `fixedParts` (evals/score.ts) adds the check "fixed parts ride along": a key, setscrew, dowel, rivet or circlip with a motion of its own, or a sleeve, hub, coupling or collar standing still while a part mounted in it turns, is a fault (shown on the admin page as "a key or sleeve not riding with its part"). Both patterns now hold a real `\b`. Run over the 23 stored models it names the published coupling and one draft (a hub's grease cap left standing).
- **Lesson:** after writing a regular expression through a script, grep the file for control characters (`grep -c $'\x08'`) and test the pattern on a string it must match; a pattern that never matches fails silently.

### 116. Removing a temporary worktree started deleting the app's real node_modules (2026-11-12)
- **Problem:** after landing commits on `main` from a second worktree (`../AgriTech-main`), `git worktree remove --force` ran for minutes and deleted part of `AgriTech/web/node_modules` (the `.bin` folder and some packages), so the dev server, tests and builds would not run.
- **Cause:** to type-check and test the worktree without a second install, its `web/node_modules` and `api/node_modules` were made directory junctions to the real ones. The `api` junction was unlinked before removal; the `web` one was forgotten, and git's forced removal followed it into the real folder.
- **Solution:** the removal was stopped, the junction unlinked with `rmdir` (which does not follow it), `npm ci` run in `web/` (type check clean, 2,288 web and 107 API tests pass), then the leftover folder deleted only after listing it for links (none) and the worktree pruned. No source, commits or remote were touched.
- **Lesson:** do not junction `node_modules` into a throwaway worktree; if one must, list reparse points (`Get-ChildItem -Recurse -Attributes ReparsePoint`) and unlink every one before any recursive delete.

### 117. The review page froze for about ten seconds; a rack sat half its length from its pinion (2026-11-12)
- **Problem:** (a) the admin review page was slow to open. (b) Looking at all 25 stored models (18 drafts, 7 published) one by one found a rack-and-pinion draft, scored 100, whose rack was a plain bar lying far below the pinion and sliding out of the model for ever; an open differential with its gears stacked flat (63); a worm reducer with the wheel outside its housing (100); two stepped shafts and the published muff coupling with a key spinning on the shaft's centre; a hub grease cap standing still; labels on top of each other.
- **Cause:** (a) every draft card re-scored its draft while the page first drew: `scoreBuild` builds each part's shape (0.05–3 s a draft, 11 s for 18), all on the main thread. (b) `mesh` placed any part like a gear: its axis along the pinion's and its centre "pitch radius" away, which for a rack fell back to half its longest side; the `rack` shape was a box; a pinion's `rotate` never reverses. The other faults were in the models (see 112–114).
- **Solution:** (a) the page shows the stored score at once and re-scores in the background, one draft between paints (`useLiveScores`, AdminPage). (b) `rack` is drawn with 20° teeth at pitch π·module; a rack meshing with a pinion lies along the turning direction, teeth towards the pinion, pitch line on the pitch circle; a mechanism with a rack swings its driver so the rack uses about two thirds of its length. Ten stored models were corrected in the database (originals saved first): the faults above, plus LaTeX out of labels and `N*m` written `N·m`. `web/scripts/time-score.ts` and `score-fixes.ts` score a folder of dumped models.
- **Lesson:** never do per-item heavy work in render; and a score of 100 only means the checks passed, so render every stored model and look at it. Still open: no check that a rack actually sits on its pinion, or that a part is visibly held (the wheel outside its housing passed).

### 118. Models the checks passed were plainly wrong: a disc in front of its yoke, balls on their side, gears in mid-air (2026-11-12)
- **Problem:** after the fixes in 117 the owner still found, in the admin review queue, a scotch yoke whose crank disc sat in front of the yoke, a ball bearing with its balls stood on edge out of the races, and a quick-return whose bull gear floated beside the column. None was flagged. Rendering all 25 stored models from two angles found more: a compound gear train and a helical pair whose shafts and gears hung above their pedestals, Hooke's joints whose output bearing hung on the shaft with nothing under it, a cantilever's bracket 35 mm off its column.
- **Cause:** two placement bugs and a blind check. `coaxial` lined a part up with the middle of the target's whole bounding box, so a crank mounted in a frame's bearing boss went to the middle of the frame (base plate and posts included), 75 mm off. A part made of a ring of shapes (`radialCount`) had no round "lead" shape, so its axis was taken as its longest side and the ring was laid on its side. The floating check only asked whether each part's box touched some other box: a gear touching its own shaft passed while both hung in the air, and a bearing block on a shaft passed with nothing under it.
- **Solution:** `LocalInfo` gains `axisCenter`/`axisLength`: the line of the main round shape; when that line holds most of the round material and the part's middle is off it (a frame and its boss), coaxial uses the boss end to end; otherwise the part's own middle on that line (unchanged for shafts, gears, rivet rows). A ring of shapes turns about the part's Y. New check **every part held** (`note3d/held.ts`): parts joined shape-to-shape all the way to the main body; fixed parts held by fixed parts; gears inside the gearbox drawn round them; gear centre distances. A part in a slot cut for it is no longer "buried". Before changing placement, every stored model was placed with the old and new code and each moved part looked at (nine models moved: all corrections). 21 stored models were corrected in the database in two rounds (originals saved first; the second round only where the model was unchanged since it was checked).
- **Lesson:** a check that looks at boxes one pair at a time cannot see an assembly; test connectivity of the whole. And look at every stored model from two angles after any change to placement, comparing old and new positions part by part.

### 119. Keeping bad generated models out for good (2026-11-12)
- **Problem:** the same kinds of fault kept reaching the review queue and the library: the model places parts by guesswork, the checks missed what a person sees, and nothing stopped a draft with known faults being approved or re-checked stored models when the rules improved.
- **Cause:** the pipeline was build → score → queue: a failed check was only shown, never acted on, and the score of 100 was read as "looks right".
- **Solution:** five layers (SOLIDIFY.md §6): repair before review (`buildWithRepair`, up to two automatic repairs with the faults named); a picture check by a vision model (`POST /v1/admin/look`, kept as the check "looks right", one repair if it looks wrong); a publish gate (409 without `override`, recorded in the audit trail); a standing re-check of published models per `CHECKS_VERSION`; and the `keyed` mount, so a key's place is worked out, not written. The prompt now says what goes in `children`, caps a shift at about 30 mm and uses `keyed` for keys.
- **Lesson:** a check that only reports is a suggestion: wire every serious check to an action (repair, block, re-check). Costs: each repair and each picture check is a Gemini call; the picture check runs once per draft picture.

### 120. Force and moment arrows were never checked: moments about a beam's own length, radial loads along the axis (2026-11-12)
- **Problem:** the owner asked whether the load arrows had been verified. They had not: only overlapping labels were checked. Checking every arrow in the 25 stored models found two published cantilevers whose fixed-end moment turned about the beam's own length (a twist, not a bend), two ball bearings whose radial load pointed down the bore along the axis, helical pairs with the axial thrust across the shaft and the tangential force along it, and an axial force ending hidden in the middle of its gear. Pulls (a lap joint in tension, a shaft pulled at its end, a rack's output) were drawn starting inside the part. On screen, labels covered each other in the helical pairs and the differential.
- **Cause:** nothing compared an arrow with what its name says it is. A force was always drawn ending at its anchor, so a force pointing away from a face started inside the part. The label-overlap check measured tails seen straight from the front, while labels are drawn at an arrow's middle (a moment's at the end of its arc) and the model opens in a three-quarter view.
- **Solution:** `annotationProblems` (`note3d/annotationCheck.ts`) and the serious check **loads act right**: axial or thrust forces along the part's axis, radial across it, tangential across both axis and radius, reactions against the main load, bending moments across the member, nothing hidden in or drawn through its part, every arrow's part placed. A force pointing away from its face is drawn from the face outward. `labelPoint` is shared by the renderer and the overlap check, which now projects from the opening view with labels' real on-screen size. The renderer lays labels out on screen every frame (`LabelLayout`): a label that would cover another moves up or down a label's height, so none overlap from any angle. Eight stored models' arrows corrected (two on top of rebuilds the review page had just made), each looked at after; all 25 live models now pass.
- **Lesson:** an annotation is engineering content: check that it acts the way its name says, and look at it where the reader sees it (draw position, opening view), not where a quick check assumes.

### 121. A universal joint drawn by the model was a jumble of boxes; a slider block swept through its slot (2026-11-12)
- **Problem:** the owner sent a close-up of a generated universal joint: yokes and cross from boxes and cylinders, overlapping, the cross not in the yokes. Then a scotch yoke whose bronze block turned with the crank, its corners sweeping through the slot's edges; its crank disc ran through the yoke and its guide rods missed their bushings by 10 mm.
- **Cause:** a universal joint is three bodies that must line up exactly, which a model placing boxes by guesswork cannot do; nothing checked the machine while it moved. The block was put in the crank's `children` by the automatic repair, following a prompt rule of mine (small parts fixed in a part are its children), which does not hold for a part that turns freely on a pin. The disc and bushings came from hand-written offsets measured from a base that was itself offset.
- **Solution:** `HookeJoint.tsx`: the app draws any hooke-mounted joint itself, from the rigs' yokes, cross and cups (`parts/lib/driveline.ts`), sized to the shafts; each frame the cross arms are the input yoke's ear line and the line square to it and the output shaft, which is Hooke's law by construction; yokes and a cross the model drew are not drawn. The prompt says to draw only the two shafts, and that a part turning freely on a pin is a round roller, not a child. The scotch yoke was corrected in the database (roller, disc behind the yoke, bushings on the rods' line).
- **Lesson:** a precise assembly is the app's job, not the model's; and a fault that only exists in motion needs a check that moves the machine (122).

### 122. The motion check, the lab look, opening cut away, reports from students (2026-11-12)
- **Problem:** faults that only exist in motion passed every check; generated models looked patchy beside the labs (half a dozen greys, sharp slabs); a mechanism closed in its casing opened as a box; students had no way to say a model looked wrong.
- **Cause:** every check looked at the model at rest; the renderer used whatever finish the model chose; nothing chose a section for a model that asked for none; feedback was a thumbs-down on a reply.
- **Solution:** `motionCheck.ts`: each mechanism turned through one cycle in 10 steps, every part placed as the renderer places it; points spread over each moving part's surface (by area, not by vertex: vertices crowd round a bore) tested against every other part's real solid (a BVH, holes and slots cut); a part running clearly further into another than at rest, at two steps or more, or coming away from the part it is mounted on, is named (serious check **moves freely**, made when a model is built and kept with the draft: it takes up to seconds). It found the renderer never turned a ring of balls (no round lead shape), so a cage swept through still balls: a ring now turns about its axis. `finishFor` (NoteSceneRenderer): the drive in the labs' power-path orange (`paintOrange`, as the gearbox rig's "Colour the power path"), casings cast iron, turned parts machined steel, other metal greys mapped to those; boxes in parts with no cuts get 3 mm rounded edges (a rounded box does not combine reliably with cuts: tried, one part came out empty). `openingCut.ts`: a casing (hollowed, or named as one) round the drive opens cut away. `ReportProblem.tsx` and `POST /v1/reports`: a student picks what looks wrong and adds a note; a library model's reports are counted on it (matched by its request, as a student's copy has no library id) and shown on its row in Admin → Library (`GET /v1/admin/reports`); students never see them.
- **Lesson:** after writing a regular expression through a script, check the file for a backspace character: `\b` became one again, twice (the casing test never matched).

### 123. Plan, then build; standard bearings (2026-11-12)
- **Problem:** most faults began with the model deciding parts and positions in one go; rolling bearings built from tubes, tori and spheres had their balls on edge and out of their races.
- **Cause:** one call wrote the whole model; there was no bearing shape.
- **Solution:** `planned()` in `api/src/note3d.ts`: a new model asked to plan first lists every part, how it is held (by a named part, or the anchor), whether it drives, and whether it is a standard part; `planText` checks one anchor, every part held by a named part and something driving, asks again once if not, and the build is given the plan to draw. Library drafts always plan (admin page and nightly drafting; the night's test cases do not, so its score measures the plain build); students may tick **Careful build**, which says it takes about half a minute longer and uses two of the day's builds (refused up front, using none, when only one is left). A `bearing` shape (ball, roller, taper, needle, thrust) is drawn from the rigs' bearings scaled to bore `d` and width `h`; a rolling bearing built by hand is a serious fault (**standard parts**).
- **Lesson:** decide the structure before the geometry, and give the model named standard parts instead of asking it to draw them.

### 124. "Bevel gears" were flat spur gears; a worm thread was faked with a spring (2026-11-12)
- **Problem:** a generated bevel gear was drawn as a spur gear and meshed like one (parallel axes); the worm reducer example's thread was a spring, and its wheel's ratio and placement were the model's guesses.
- **Cause:** the `bevelGear` shape fell through to the spur gear builder; there was no worm shape, and `mesh` only knew parallel gears.
- **Solution:** `bevelGear` is built from the library's straight bevel geometry with a `pitchAngle`; meshing two bevel gears sets them at 90° with their pitch cones' apexes together (`bevelSize` gives the apex). A `worm` shape (starts, module, pitch radius, length) is a core and helical threads; a gear meshed with a worm stands square to it at the sum of the pitch radii, and the motion turns the wheel starts/teeth of a turn per worm turn. Checked: a 18 : 36 bevel pair turns 2 : 1, a single-start worm on a 30-tooth wheel 30 : 1, both pass the motion check.
- **Lesson:** a shape name the model may use must be drawn as what it names; a fallthrough to a look-alike hides the gap.

### 125. Parts placed by offsets from the middle of another part; the backup headset video framed wrong (2026-11-12)
- **Problem:** a pin meant for one hole of a clevis, or a shaft for one boss of a frame, was placed with a coaxial mount and a hand-written shift, which drifted when a slider changed the sizes. Separately, the first recordings of the backup headset video cut off the top of the engine, placed the engine at floor scale far away, and walked the camera through the room's wall to see the real-size tractor, which then drove out of the frame.
- **Cause:** a mount could only aim at a whole part's middle and axis, so any other place needed coordinates. In the video, entering the emulated session reset the head pose set just before it, so the model was put down where the default head looked; the tractor rig drives forward when run.
- **Solution:** the `fit` mount and shape `name` (`schema.ts`, `assembly.ts`): a part's own named (or main round) shape goes into the target's named shape, axes on one line, `at` along it, or against one of its faces; it turns with a turning target like a coaxial part (`kinematics.ts`); a name the target does not have is reported. The prompt, `format/SPEC.md` and the JSON schema describe it. `web/scripts/demo-vr.mjs` sets the head again once the session is running, frames each segment with a pose, and shows the real-size tractor standing.
- **Lesson:** give the model names to point at, not numbers to compute; and in the emulator, set the pose after the session starts.

### 126. Load labels showed raw symbols (T_1, F_t); the demo video's gear change lost its power path (2026-11-12)
- **Problem:** recording the desktop demo, the helical gear pair's arrows read `T_1 = 59.68 N·m` and `F_t = 1496 N`. In the same recording the gearbox's orange power path vanished after a gear change and did not come back.
- **Cause:** the label sprite drew the model's symbol exactly as written (LaTeX-like). The gearbox is synchromesh: the baulk ring holds the sleeve until the speeds match, and two quick changes (2 to 1 to 3) never left time to engage.
- **Solution:** `symbolText.ts`: subscripts in Unicode when every character has one (T₁, Fₜ, Fₘₐₓ), Greek letters by name, braces and backslashes dropped; used by `LabelSprite`. The demo makes one change and waits for the synchroniser. `web/scripts/demo-desktop.mjs` records the desktop demo (1080p, eased orbits and sways, timed captions, the simulated-headset part and an end card); controls are found by their labels (`aria-label="Explode"`, radio buttons), not by position, after the "right-most slider" picked the engine-speed slider.
- **Lesson:** find controls by name, never by where they sit; and give a simulated mechanism the time it really takes.

### 127. The site still introduced itself as a tractor simulator; the demo video sped the home page up and had no pointer (2026-11-12)
- **Problem:** the page title, share card, description and README called Solidify "Interactive 3D Tractor & Farm Machinery" with "66 scenes across 12 systems", long after Create in 3D, the open format and VR. In the demo video, the home page's showcase played several times too fast; buttons changed with no pointer to show what was pressed; and the headset part showed a gear model whose cut and take-apart showed nothing.
- **Cause:** the copy was written for the first version and never revisited. The recorder took over the page's clock for frames but not its timers, so anything paced by setTimeout ran at wall-clock speed while frames came several times slower; a screenshot never includes the mouse; the gear model is open already, so cutting it changes little.
- **Solution:** the home page leads with three cards (labs, your own machine, in a headset), moves Create in 3D up and adds the open format; the title, description, share card (retaken from the hero) and README now say what Solidify is, with counts taken from the code. The recorder (`web/scripts/demo-desktop.mjs`) steps timers as well, draws its own pointer with a ring where it presses and glides it to each control, opens on the home page for 10 s then scrolls to the three cards, and the headset part is a torque converter cut open and taken apart.
- **Lesson:** a recording on a stepped clock must step every clock the page uses; and a demo should show where each action comes from.

### 128. In the headset a big machine stood far off past the table, and the tractor drove out of the room (2026-11-12)
- **Problem:** recording the headset demo, the real-size differential stood about 2.6 m away, beyond the far end of the table; brought closer, the control panel stood in front of it; the configurator's tractor drove off out of the room when run.
- **Cause:** a big machine stands where the gaze meets the floor; looking at a table (or in a room whose floor is not found) it fell back to 0.75 of its size plus 1.3 m ahead. The panel rests straight ahead at desk height, which only clears a far machine. On the desktop the camera follows the tractor (`scene.follow`); the headset had no equivalent.
- **Solution:** `web/src/xr/lab.tsx`: the fallback is 0.6 of its size plus 0.9 m (1.9 m for the differential); the panel rests 32 cm to the right; for a scene with `follow`, the anchor moves with the followed part, so the tractor runs on the spot. Checked in the emulated headset (screenshots, not on a Quest).
- **Lesson:** a fallback distance chosen for "see it whole" needs checking against a real room with furniture in it.

### 129. Gears stayed cut after "Section the gears too" (2026-11-12)
- **Problem:** in the headset recording the differential's gears and shafts were sectioned in every cut, though moving parts stay whole unless asked.
- **Cause:** `applyPreset` kept the previous `sectionMoving` when a preset said nothing, so once the "Section the gears too" preset had been chosen (the headset's Cut button steps through every preset), every later cut sectioned the gears too, on the desktop as well.
- **Solution:** `web/src/render/view.ts`: moving parts sectioned by a preset go back whole at the next preset; a student's own tick still carries across (`view.test.ts`). In the headset the panel now rests 18 cm to the right, beside the machine.
- **Lesson:** a setting a preset turns on must be turned off by the next preset, or it outlives the preset that set it.

### 130. In the headset, a touched part was named only on the panel (2026-11-12)
- **Problem:** pointing at a part and pinching lit it up, but its name and what it does appeared only on the control panel, which is often out of view when looking closely at the machine (it was out of frame in the demo recording).
- **Cause:** the headset had no equivalent of the desktop's card beside a picked part.
- **Solution:** `PartTag` in `web/src/xr/lab.tsx`: a small card just above the touched part, turned to face the student, with its name and up to three lines of what it does; drawn in the headset's own metres (24 cm wide), so it reads the same over a table model and a machine at real size; the panel still shows the same. Checked in the emulated headset on the engine (table size) and the differential (real size).
- **Lesson:** in a headset, information belongs where the student is looking, not only on a panel.


### 131. Share links: a path the app doesn't route, and a workspace bar that overflowed on phones (2026-11-15)
- **Problem:** the first share links were written as `solidify.studio/s/<id>`, which the app never sees (it routes after `#/`, so the link would have opened the home page); and on a phone, adding Share and Keep a copy made the workspace bar wrap its buttons onto two lines each ("Keep / a copy", "New / model"), squeeze "Shared by Ada" into three lines, and then run off the right edge.
- **Cause:** the router is a HashRouter (Netlify serves one page); the bar's action group was one unwrapping row whose buttons and state text could break inside, sized for fewer buttons.
- **Solution:** links are `origin/#/s/<id>` (`shareUrl`, like the class invitation); the bar's buttons and state never break inside (`whitespace-nowrap`, the headset button too), the action group wraps as a whole to its own row when it doesn't fit, and New model sits only in the phone Menu (Create › Build a new model). Checked in Edge at 390 and 1366 wide, signed out and as the sharer.
- **Lesson:** build any link to a page from the router the app really uses; each button added to a bar must be checked at phone width with the longest state text beside it.

### 132. Every unit test failed to start while a dev server was running (2026-11-16)
- **Problem:** all 178 web test files, and later all 12 API test files, failed before running a single test with "Cannot read properties of undefined (reading 'config')" at their first `describe`. The same code passed in a fresh copy of the repo with the same packages, and an earlier run in the same folder had passed.
- **Cause:** a Vite dev server left running from `web/` (started for a browser check, its wrapper task stopped but the server itself still alive) disturbed Vitest in the same tree; the fault came and went with it.
- **Solution:** stopped the stray server (found by its port, 5180); every suite passed at once (web 2,328, API 117). Browser checks now stop their servers by port when they finish, and nothing runs Vitest while one is up.
- **Lesson:** when every test file fails before any test runs, look for a stray dev server before suspecting the code or the packages; stopping a task's wrapper does not always stop the server it started.

### 133. A shared link showed no preview in WhatsApp (2026-11-16)
- **Problem:** a share link pasted into WhatsApp showed only the bare address: no title, no picture, nothing saying what it was.
- **Cause:** the app routes after `#/` and link previewers never see that part, nor run the page's script: every link looked like the home page to them, and the shared model's picture lived only inside the API as a data URL.
- **Solution:** share links are now `solidify.studio/s/<id>`, answered by a Netlify edge function with the model's title, its question or summary, who shared it and its picture (`GET /v1/shared/:id/image`), and a redirect to `/#/s/<id>` for people (keeping `?try=1`); the site's own preview if the API is down; the app also opens a `/s/<id>` address that reaches it directly. Tested with the API's replies stubbed: a question, practice, a model, a stopped link, the API down, a bad path.
- **Lesson:** a link meant for sharing needs a server-side page for previewers; anything after `#` is invisible to them.

### 134. A one-file edit emptied the owner's working copy of the home page (2026-11-16)
- **Problem:** swapping the home page's test video meant committing one change to `web/src/ui/Landing.tsx` while leaving the owner's own uncommitted changes in it out of the commit. The script that applied the edit to the working copy left the file empty.
- **Cause:** it called `open(path, 'w').write(edit(text))`: Python opens (and so empties) the file before working out what to write, and the edit then failed on Windows line endings, so nothing was written back.
- **Solution:** rebuilt the file from the staged copy plus the owner's three changes, taken from the diff printed just before (the diff afterwards matches it line for line); later edits work out the new text in full, check it, and only then open the file.
- **Lesson:** never open a file for writing until the new contents exist; when a file holds someone else's uncommitted work, print its diff first so it can be restored.

### 135. In the headset the diesel engine stood on the floor 2 m away, as if it were a tractor (2026-11-17)
- **Problem:** recording the headset video without a Quest (an emulated Quest 3 in a synthetic room), the four-stroke diesel did not go on the table: it stood on the floor about 2 m off, small, with the "Table model" button offered as for a big machine.
- **Cause:** the headset sizes a machine by the bounding boxes of what it is drawn with. The fuel and gas flow (`Flow`) is an instanced mesh whose geometry is a unit sphere scaled down per particle; its own bounding box is 2 m across, and before its first frame every particle sits at the origin at full size. The engine measured 2 m, over the 1.3 m limit for a table.
- **Solution:** `web/src/xr/lab.tsx`: an instanced mesh is measured by where its instances are (`computeBoundingBox`), and a mesh marked `userData.effect` is not measured at all; `Flow` marks its particles as an effect. The engine now measures 0.85 m and sits on the table at real size. A dev-only `__xrPress(x, y)` presses the panel at one of its own points (buttons, choices, sliders), for recordings.
- **Lesson:** measure a machine by what it is, not by everything drawn with it; an instanced mesh's geometry is one instance, not the whole.
