# Solidify build log

A running record of problems met while building Solidify: what went wrong, why, how it was fixed,
and what to do differently. Add an entry whenever something costs real time, newest at the top of
its section.

Each entry: **Symptom** · **Cause** · **Fix** · **Lesson**.

---

## 3D rendering and scenes

### Exploded parts on spinning shafts orbit instead of spinning (2026-10-24)
- **Symptom:** in explode mode, gears and hubs on a turning shaft swung around the shaft axis instead of spinning in place.
- **Cause:** explode offsets were applied inside the part's own frame. A part inside a spinning shaft group had its "lift up" offset turning with the shaft. Parts without an explicit offset got an automatic one (added 14 Oct) that had the same problem, which made it much more visible.
- **Fix:** all offsets, explicit and automatic, are now held in the whole machine's frame (the top-level part) and converted into the part's current frame every frame (`web/src/render/Part.tsx`, `toFrame`/`toLocal`). Regression test: `web/src/render/explode.test.ts`. Verified in the gearbox scene: zero drift of any mesh while exploded and spinning.
- **Lesson:** any per-part offset must say which frame it lives in. Animated groups between a part and its assembly will carry anything expressed in local space.

### Flat metal faces render almost black (2026-10-08)
- **Symptom:** gear sides in the Gears scene were near-black even when well lit.
- **Cause:** fully metallic materials (metalness 1) have no diffuse light; a flat face seen from above only reflects the dark floor and backdrop.
- **Fix:** a `steelMatte` material (metalness 0.55) for broad flat machined faces; camera moved off-axis.
- **Lesson:** use the polished metals for curved parts; use `steelMatte` for large flat faces.

### Positive `useFrame` priority turns the canvas black (2026-10-11)
- **Cause:** in React Three Fiber, a frame callback with priority > 0 takes over rendering.
- **Lesson:** never pass a positive priority to `useFrame`/`useSimFrame`.

### Floor z-fighting in several scenes (2026-10-11, 2026-10-13)
- **Fix:** floor overlays use polygon offset and no depth write; stacked ground layers are spaced apart.

### Scenes without a default cut preset sliced the tractor in half (2026-10-13)
- **Fix:** scenes with no `defaultPreset` open uncut.

### Tractor left/right and steering sign confusion (2026-10-08, 2026-10-11)
- **Cause:** the frame comment said +Z is left; it is right, and positive steer is left.
- **Fix:** knuckles, labels and Ackermann signs corrected; comment fixed. Steering signs in costs, farmstead and autosteer fixed.
- **Lesson:** write a test for any sign convention a scene depends on.

### Chrome stops repainting an element animated through `scale(0)` (promo video, 2026-10-11)
- **Fix/lesson:** clamp scale animations to 0.001, never exactly 0.

### A full-screen 3D hero swallowed page scrolling (2026-10-25)
- **Symptom:** on the redesigned home page the live scene fills the hero, and scrolling over it zoomed the camera instead of scrolling the page; a one-finger swipe on a phone orbited the model.
- **Cause:** camera-controls takes the mouse wheel and one-finger touch by default, and sets `touch-action: none` on the canvas.
- **Fix:** `Stage pageScroll` turns off wheel and one-finger actions (drag and pinch still work), and the hero overrides the canvas to `touch-action: pan-y`.
- **Follow-up (2026-10-26):** on real phones swipes that started on the model still didn't scroll: the camera controls capture the touch regardless. On touch screens the hero is now look-only (`pointer-coarse:[&_*]:!pointer-events-none`; `!important` because R3F sets `pointer-events` inline on its wrapper), and "Open scene" is the way in.
- **Lesson:** any canvas embedded in a scrolling page needs its scroll gestures given back to the page; on touch, the reliable way is not to let it receive them at all. Headless swipe tests (`Input.synthesizeScrollGesture`) don't scroll inner containers, so check `touch-action` and `pointer-events` under the finger instead.

### Blank canvas after the loader went away (2026-10-26)
- **Symptom:** "Building the model…" disappeared, then the stage sat empty (white in the light theme) for several seconds.
- **Cause:** the loader only waited for the scene's code; its parts are then generated on worker threads, and nothing tracked them.
- **Fix:** `useGeometryPending` in `geometry/build.ts` counts the builds a scene is waiting on; the stage's build cover stays up until that reaches zero and settles, then fades out. The tile capture script waits on the same signal instead of a fixed delay.
- **Lesson:** "loaded" means the thing on screen is ready, not the code behind it.

### The loader covered the hero headline (2026-10-26)
- **Symptom:** while a hero scene built, the headline and buttons vanished.
- **Cause:** the cover's `z-10` had no stacking context around it, so it rose above the page's later siblings.
- **Fix:** the stage renders inside its own `isolate` layer.

### Switching hero scenes looked like a page reload (2026-10-26)
- **Cause:** the hero dropped the old scene before loading the new one, so the whole hero blanked.
- **Fix:** the old scene stays up while the next one's code loads; the new one builds under a frosted veil and fades in.

### Tile captures could photograph the previous scene (2026-10-26)
- **Cause:** moving between `#/shot/…` URLs only changes the hash, so the page never reloads and the last scene's "ready" flag was still set.
- **Fix:** the script clears the flags before each navigation; the page clears them too.

### Known, open: React "synchronously unmount a root" warning on scene switch
- drei `Html` labels unmount while React is rendering. Harmless (no crash); listed in `web/docs/QA.md`.

---

## Study tools and content

### Following one question link to another showed the old question (2026-10-25)
- **Symptom:** while on Exam practice, opening another `/exam?q=…` link kept showing the previous question.
- **Cause:** the subject and topic filters were read from the link only when the page first opened, so the new question was filtered out.
- **Fix:** a new `?q=` re-applies the subject, topic and practice mode (`web/src/study/ui/ExamPage.tsx`).
- **Lesson:** state initialised from the URL must also react to URL changes; class assignment links depend on it.

### Exam questions had fixed numbers (2026-10-24)
- **Symptom:** once a student had seen an answer, the question was spent; students could share answers.
- **Fix:** parametric questions (`web/src/study/variants.ts`). Every question declares its inputs with realistic ranges and builds its statement, answers, working and 3D setup from them. All 68 questions are converted, and each is tested against 200 variants.
- **Lesson:** a test that every input value appears in the statement catches numbers left hard-coded.

### Course codes and note citations showed in the UI (2026-10-24)
- **Symptom:** Study mode showed codes like AEE510, and solutions printed note file names.
- **Cause:** codes and citations were authoring references that leaked into labels.
- **Fix:** subjects are shown by name (Engines, Machine design, …); citations stay in code and are never rendered.
- **Lesson:** Solidify serves many schools: no course codes, school names or source files in any visible text.

### Large numbers in worked solutions printed with a comma (2026-10-24)
- **Cause:** a backslash was lost to shell escaping, so `\,` (LaTeX thin space) became a plain comma.
- **Fix:** corrected in `tnum()`, with a test of the exact output.

---

## Backend, cloud and deployment

### A second paper hand-in in the same millisecond was accepted (2026-10-25)
- **Symptom:** a test showed a student could submit a paper twice when both requests carried the same timestamp.
- **Cause:** "already submitted?" was decided by comparing the stored submission time with this request's time.
- **Fix:** the transaction records whether this request created the submission (`api/src/app.ts`, paper submit).
- **Lesson:** never infer "did I write this?" from timestamps; record it explicitly inside the transaction.

### Firebase was added to the wrong project
- **Cause:** the Firebase console defaulted to an auto-created "My First Project".
- **Fix:** once the Firebase terms were accepted, Firebase was added to `solidify-studio` through the API.
- **Lesson:** check the project picker; confirm with `firebase.googleapis.com/v1beta1/projects/<id>`.

### The free-trial credit can't pay for Claude
- **Cause:** the $300 trial credit excludes partner models served as managed APIs.
- **Fix:** the tutor uses Gemini on Vertex AI, authenticated as the Cloud Run service account (no API key).

### Gemini model IDs that don't exist on Vertex
- `gemini-flash-latest` (an AI Studio alias) and `gemini-2.5-flash` return 404 on Vertex for this project. `gemini-3.8-flash` works.
- **Lesson:** probe model IDs with a one-line `generateContent` call before deploying.

### Cloud Run deploy failed on a new project
- **Cause:** the default compute service account that Cloud Build runs as couldn't read the uploaded source.
- **Fix:** granted it `roles/cloudbuild.builds.builder`.

### gcloud split an environment variable at the email's `@`
- **Cause:** `--set-env-vars "^@^…"` used `@` as the separator, and `ADMIN_EMAILS` contains an `@`.
- **Fix/lesson:** use `^;^` as the separator.

### `/healthz` returned Google's 404
- **Cause:** Cloud Run reserves some paths ending in `z`.
- **Fix:** the health check is `/health`.

### The API couldn't be made public
- **Cause:** the `solidify.studio` organization has Domain Restricted Sharing, which blocks `allUsers`. Separately, Claude's auto mode refuses to make services public.
- **Fix:** the owner ran `gcloud run services update solidify-api … --no-invoker-iam-check`. The API itself checks Firebase sign-in on every route that touches user data.

### Moving the app into `web/` would have broken Netlify
- **Cause:** Netlify built from the repo root.
- **Fix:** root `netlify.toml` (`base = "web"`) committed in the same commit as the move; a clean checkout was built before pushing.

### Sign-in from the live site needs an authorized domain
- **Fix:** `solidify.studio` and `www.solidify.studio` added to Firebase Auth's authorized domains.

---

## Tooling and process

### Usage limits stopped parallel builders mid-task (several times)
- **Symptom:** half-built scene folders, and agents that "failed" partway through.
- **Fix/lesson:** before resuming, re-read what's on disk instead of trusting the agent's memory. Keep to about 5 builders at a time. Each builder owns its own files.

### Two Claude sessions building in the same folder
- **Risk:** both write the same files, and one overwrites the other.
- **Lesson:** only one session builds at a time. Check `ListAgents` and recent file changes before starting.

### Claude attribution in commit messages
- **Cause:** some sessions added `Co-Authored-By: Claude` despite the owner's rule.
- **Fix:** history rewritten on both branches and force-pushed (contents verified identical commit by commit; backups kept locally). A `.git/hooks/commit-msg` hook now strips attribution lines.

### A cloud session's branch was named `claude/…`
- **Fix:** renamed to `promo-video-v1`.

### The dev server couldn't start on 5173 or 5180
- **Cause:** Windows (Hyper-V) reserves TCP ports 5077–5276, and another project was already serving on 5173.
- **Fix:** run the app with `npx vite --host 127.0.0.1 --port 4173`. The API allows that origin.
- **Lesson:** `netsh int ipv4 show excludedportrange protocol=tcp` lists reserved ports.

### Shell layers mangle backslashes and newlines
- **Symptom:** a `\n` written through a Python one-liner became a real line break inside a TypeScript string (parse error), and `\\,` collapsed to `\,`.
- **Lesson:** use the file editor (not shell heredocs or inline scripts) for code containing backslashes, and test the exact output.

### Local Google credentials expired
- **Symptom:** `invalid_grant` when testing Vertex from this computer.
- **Fix:** for one-off checks, use `gcloud auth print-access-token`. Deployed code uses its service account and is unaffected.

### Heavy geometry tests time out under the full parallel run
- `steering/boxes` and `traction/tyre` geometry tests occasionally time out under full load and pass when run alone. Rerun alone before treating them as failures.

### Browser checks raced with hot reload
- **Symptom:** a click landed just as an edit hot-reloaded the page, resetting UI state.
- **Lesson:** reload the page before measuring or testing behaviour in the browser.

## Live test rollout and thermal lab (2026-11-01)

- **Rail test logged one temperature.** Symptom: every row read 15 °C and the chart was empty. Cause: the default target equalled the laying temperature, so the test had no range. Fix: default target 45 °C. Lesson: when a slider becomes a test's end point, check its default differs from the start.
- **Governor test seemed to hang.** Cause: the driver runs on sim time and that scene runs at 1/20 speed, so a 7.5 s test took 150 s. Fix: shorter steps. Lesson: set test lengths against the scene's `timeScale`.
- **`tyre/build.test.ts` fails under load.** It asserts a wall-clock limit of 1.5 s, and reads 1.5 to 1.7 s when the machine is busy. It passes alone. Not a logic failure, but it makes the full run unreliable.
- **Source error.** The heat exchanger tutorial's first answer, 2.07 m², works out at 2.03 m²; that question is left out of Exam Practice.

## Notes to 3D review (2026-11-04)

- **Figures showed the rig's defaults, not the document's values.** Cause: the samples and the vision prompt used their own names (`span`, `l2`, `mainR`), and `applyParams` passed them straight into the stores. Fix: `web/src/note3d/catalogTargets.ts` turns a figure's values into each rig's real settings, with aliases and unit factors. The API prompt lists the same rigs and keys (`api/src/noteCatalog.ts`), and a test keeps the two in step. Lesson: a test that only checks a figure "renders" can't catch this; check the values that reach the store.
- **Hiding in-scene readings behind the Labels toggle removed them from the main app.** Labels are off by default, so the steam plant, beam and torsion readouts disappeared. Fix: reverted, with a patch kept in the scratchpad. Lesson: a reader-only need belongs in the reader, not in shared scene code.
- **The client called the live API from unit tests.** `generateOrEdit3DScene` would have sent real Gemini requests during `vitest`. Fix: the backend call returns early outside a browser.
- **"Low confidence stays 2D" never fired.** A missing confidence defaulted to 0.92, and the prompt never asked for one. Fix: missing means 0, and the prompt requires it.

## Creation Lab (2026-11-06)

- **Unknown shapes crashed Create in 3D.** Symptom: `Cannot read properties of undefined (reading 'clone')`. Cause: the API's Create prompt was four lines with no field list, so Gemini invented shape kinds; the client passed a spec that failed validation through anyway, and the builder returned `undefined` for an unknown kind. Fix: the full prompt now lives in `api/src/createPrompt.ts` (fields, units, axes, and only these kinds), the client drops unusable shapes, the builder falls back to a small box, and a web test keeps the API's shape and material lists equal to the builder's. Lesson: a list in a prompt is a request, not a guarantee; validate what comes back and never pass an invalid result on "as is".
- **Updates were blocked in the browser.** Symptom: renaming, slider autosave and card pictures never saved; the console showed a CORS error for `PUT`. Cause: the API's CORS `allowMethods` listed GET, POST, PATCH and DELETE only. Fix: added PUT, with a preflight test. Lesson: server tests call the app directly and skip CORS; test a new HTTP method through a real browser (or a preflight test) before shipping.
- **Every update wiped the slider values and history.** Cause: the update schema was `creationInput.partial()`, and zod `.default()` values still apply in a partial schema, so a thumbnail-only update reset `params` and `history` to empty. Fix: a separate update schema with no defaults, and a test that a one-field update leaves the rest alone. Lesson: never build a PATCH/PUT schema from a create schema that has defaults.

## Model workspace and live builds (2026-11-06)

- **The first build never started in development.** Cause: StrictMode mounts, unmounts and remounts each page; the workspace's "stop the stream when leaving" clean-up aborted the build that had just started, and a guard stopped it restarting. Fix: abort only if the page has not come straight back (checked a tick later). Lesson: a clean-up that cancels work must survive StrictMode's simulated unmount.
- **`destroy is not a function` on opening the workspace.** Cause: an effect written as `() => el.scrollIntoView({ behavior: 'smooth' })` returned a promise, because recent Chromium returns one from smooth scrolling. Fix: effects with block bodies. Lesson: never let an arrow effect return a call's result.
- **The loading cover hid the live assembly.** Each streamed part makes a new scene, and the viewer's build cover is keyed on the scene, so it reappeared on every part. Fix: no cover while a build streams, or after one has streamed in that workspace.

## Nightly tests, admin and labs pages (2026-11-06)

- **A propped-cantilever model crashed the whole workspace.** Symptom: `Cannot read properties of undefined (reading '0')`, blank page. Cause: Gemini sent a `recommendedCut` without a `normal`; the cleaner passed the object through unchecked and an effect read `normal[0]`. Fix: `cleanCut` in `note3d/sanitize.ts` checks every field (also applied when opening saved models and in the notes reader), and error boundaries round the 3D view, the side panel and each page. Lesson: validate every nested field of model output, not just its presence; and no page should be one bad value away from blank.
- **Nightly builds failed with "Something went wrong on the server" (500).** Cause: Gemini answered 429 RESOURCE_EXHAUSTED when three builds ran at once, and the API gave up on the first refusal. Fix: `api/src/retry.ts` waits and retries (2, 6, 15 s) on 429/503, streamed builds retry if refused before their first word, the final failure says the model is busy (503), and the runner tries once more after 30 s. Lesson: treat rate limits as normal for a hosted model; read the service's logs before guessing.
- **A draft scored 100 while visibly broken** (rods not reaching the crank, a tilted flywheel through the casing, labels on top of each other). Cause: the checks only covered layout overlap, drawability and calculations. Fix: checks for moving parts joined by relation and for overlapping labels, and the prompt states the same rules. Lesson: a score is only as good as its checks; look at high scorers before trusting the number.
- **Deploy failed: "Build failed; check build logs".** Cause: `gcloud run deploy --source .` run from the repo root, which has no Dockerfile. Fix: run it from `api/`. Lesson: `--source .` uploads the current folder; check where you are.
- **Rig thumbnails came out blank, and with a stray `_` in their names.** Causes: two scenes photographed before they had drawn in a reused tab; and the rig list written by Python on Windows had CRLF line endings, so each id ended in `\r`. Fixes: retook those two in a fresh tab (`SHOT_COLD=1`); renamed the files and strip `\r` when reading lists. Lesson: check the smallest output files of a batch capture, and strip `\r` from lists made on Windows.
- **Inline scripts lost their backslashes.** A `node -e` / heredoc script through the shell turned `C:\Program Files` into `C:\Program Files`, so the browser path was not found. Fix: forward slashes in Windows paths in scripts, and the editor rather than the shell for code containing escapes. Lesson: don't pass escape-heavy code through the shell.
- **Prettier reformatted a file into another style.** With no project config it used its defaults (double quotes, semicolons). Fix: re-run with the project's settings (`--no-semi --single-quote --print-width 220`). Lesson: don't run a formatter the project doesn't configure.
- **The Labs page was wider than a phone.** Cause: one-line rig names in a grid item set its minimum width. Fix: `min-w-0` on the card. Lesson: any `truncate` text inside a grid or flex child needs `min-w-0` on that child.
