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
