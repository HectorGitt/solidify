// The promo as one take: a single session in the real app, on one tractor, with no cuts.
//   node scripts/promo/take.mjs <outdir> <base url> <tutor-answer.json> [--preview]
// The page runs on a virtual clock and is stepped one frame at a time, so a heavy scene still plays
// (camera moves, panels, sim, streaming) at exactly film speed. Every action is a real pointer event.
// Writes frames, plus take.json: the crops, captions and clicks the comp and the score follow.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.argv[2])
const BASE = process.argv[3]
const TUTOR = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'))
const PREVIEW = process.argv.includes('--preview')
const FRAMES = path.join(OUT, PREVIEW ? 'sheet' : 'take')
fs.rmSync(FRAMES, { recursive: true, force: true })
fs.mkdirSync(FRAMES, { recursive: true })

const FPS = 60
const W = 1920
const H = 1080
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] })
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 })
await ctx.addInitScript(() => localStorage.setItem('solidify.theme', 'light'))
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  pageerror', e.message))
const realSleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------------------------------------------------------------- the film's own timeline */
const film = { fps: FPS, crops: [], captions: [], clicks: [], marks: {}, frames: 0 }
let n = 0
const now = () => n / FPS
const mark = (k) => { film.marks[k] = now(); console.log(`${now().toFixed(1).padStart(5)} s  ${k}`) }
/** ease the view to this crop (centre and width, in the app's CSS pixels) over d seconds, starting now */
const crop = (cx, cy, w, d = 0.9) => film.crops.push({ t: now(), d, cx, cy, w })
const caption = (eyebrow, title, sub, d, pos = 'tr') => film.captions.push({ t: now(), d, eyebrow, title, sub, pos })

/* ---------------------------------------------------------------- one frame */
let mouse = { x: W * 0.62, y: H * 0.5 }
async function frame() {
  await page.clock.runFor(16)
  await page.evaluate(([x, y]) => {
    // CSS transitions and animations run on the real clock: walk them by hand, one frame at a time
    for (const a of document.getAnimations()) {
      if (a.playState === 'finished') continue
      a.pause()
      a.currentTime = (Number(a.currentTime) || 0) + 16
      const end = a.effect?.getComputedTiming().endTime
      if (typeof end === 'number' && Number.isFinite(end) && a.currentTime >= end) a.finish()
    }
    const c = document.getElementById('__cur')
    c.style.transform = `translate3d(${x - 3}px, ${y - 3}px, 0) scale(${window.__down ? 0.88 : 1})`
    const r = document.getElementById('__ring')
    const k = window.__ring ?? 1
    window.__ring = Math.min(1, k + 1 / 30)
    const e = 1 - (1 - k) ** 3
    r.style.opacity = String(1 - k)
    r.style.transform = `translate3d(${x - 40}px, ${y - 40}px, 0) scale(${0.25 + e})`
  }, [mouse.x, mouse.y])
  if (!PREVIEW || n % 20 === 0) {
    const name = PREVIEW ? `t${now().toFixed(2).padStart(6, '0')}.jpg` : `${String(n).padStart(5, '0')}.jpg`
    await page.screenshot({ path: path.join(FRAMES, name), type: 'jpeg', quality: PREVIEW ? 70 : 92 })
  } else await realSleep(3)
  n++
}
const hold = async (s) => { for (let i = Math.round(s * FPS); i > 0; i--) await frame() }

/* ---------------------------------------------------------------- a hand on the mouse */
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
async function moveTo(x, y, s = 0.5) {
  const a = { ...mouse }
  const steps = Math.max(2, Math.round(s * FPS))
  const bend = 0.12 * Math.hypot(x - a.x, y - a.y)
  for (let i = 1; i <= steps; i++) {
    const u = ease(i / steps)
    mouse = { x: a.x + (x - a.x) * u, y: a.y + (y - a.y) * u - Math.sin(Math.PI * u) * bend * 0.35 }
    await page.mouse.move(mouse.x, mouse.y)
    await frame()
  }
}
async function press(down) {
  await page.evaluate((d) => { window.__down = d; if (d) window.__ring = 0 }, down)
  if (down) { film.clicks.push(now()); await page.mouse.down() } else await page.mouse.up()
}
async function click(x, y, s = 0.5) {
  await moveTo(x, y, s)
  await hold(0.07)
  await press(true)
  await hold(0.07)
  await press(false)
  await hold(0.12)
}
async function dragTo(x, y, s = 0.9) {
  await press(true)
  await hold(0.08)
  await moveTo(x, y, s)
  await hold(0.06)
  await press(false)
  await hold(0.1)
}
async function centre(loc) {
  const b = await loc.boundingBox()
  if (!b) throw new Error('not on screen: ' + loc)
  return [b.x + b.width / 2, b.y + b.height / 2]
}
async function clickOn(loc, s = 0.5) {
  const [x, y] = await centre(loc)
  await click(x, y, s)
}
const thumb = (loc) => loc.evaluate((el) => {
  const r = el.getBoundingClientRect()
  const k = (+el.value - +el.min) / (+el.max - +el.min)
  return { x: r.left + 8 + k * (r.width - 16), y: r.top + r.height / 2, left: r.left + 8, width: r.width - 16 }
})
/** drag a range input's thumb to a fraction of its travel */
async function slide(loc, to, s = 1.1, reach = 0.5) {
  const t = await thumb(loc)
  await moveTo(t.x, t.y, reach)
  await hold(0.06)
  await dragTo(t.left + t.width * to, t.y, s)
}
async function typeIn(text, perChar = 2) {
  for (const ch of text) {
    await page.keyboard.type(ch)
    await hold(perChar / FPS)
  }
}

/* ---------------------------------------------------------------- the app */
const js = (code, arg) => page.evaluate(({ code, arg }) => new Function('arg', `return (async () => { ${code} })()`)(arg), { code, arg })
const view = (code) => js(`const { useView } = await import('/src/render/view.ts'); const v = useView.getState(); ${code}`)
const fly = (position, target) => js(`const { flyTo } = await import('/src/ui/camera.ts'); flyTo(arg)`, { position, target })
const partId = (name) => js(`const { useParts } = await import('/src/parts/registry.ts'); return Object.values(useParts.getState().parts).find((p) => p.name === arg)?.id ?? null`, name)
/** a screen point where a click really lands on the part (nothing else in front of it) */
const pickPoint = (id) => js(`
  const { partObjects } = await import('/src/parts/registry.ts')
  const st = window.__agriState, THREE = window.__THREE
  const o = partObjects.get(arg)
  if (!o) return null
  const box = new THREE.Box3().setFromObject(o)
  let x0 = 1, x1 = -1, y0 = 1, y1 = -1
  for (let k = 0; k < 8; k++) {
    const v = new THREE.Vector3(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(st.camera)
    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y)
  }
  const ray = new THREE.Raycaster()
  const inside = (obj) => { for (let p = obj; p; p = p.parent) if (p === o) return true; return false }
  const r = st.gl.domElement.getBoundingClientRect()
  const pts = []
  for (let i = 1; i < 14; i++) for (let j = 1; j < 14; j++) pts.push([x0 + ((x1 - x0) * i) / 14, y0 + ((y1 - y0) * j) / 14])
  pts.sort((a, b) => Math.hypot(a[0] - (x0 + x1) / 2, a[1] - (y0 + y1) / 2) - Math.hypot(b[0] - (x0 + x1) / 2, b[1] - (y0 + y1) / 2))
  for (const [x, y] of pts) {
    if (Math.abs(x) > 1 || Math.abs(y) > 1) continue
    ray.setFromCamera(new THREE.Vector2(x, y), st.camera)
    const hit = ray.intersectObjects(st.scene.children, true).find((h) => h.object.visible && h.object.isMesh)
    if (hit && inside(hit.object)) return [r.left + ((x + 1) / 2) * r.width, r.top + ((1 - y) / 2) * r.height]
  }
  return null`, id)
const selected = () => view(`return v.selectedId`)
const frameBeside = (id, dir, fit = 3.4) => js(`
  const { partObjects } = await import('/src/parts/registry.ts')
  const { flyTo } = await import('/src/ui/camera.ts')
  const THREE = window.__THREE
  const box = new THREE.Box3().setFromObject(partObjects.get(arg.id))
  const c = box.getCenter(new THREE.Vector3())
  const r = box.getSize(new THREE.Vector3()).length() / 2
  const d = new THREE.Vector3(...arg.dir).normalize()
  const right = new THREE.Vector3().crossVectors(d.clone().negate(), new THREE.Vector3(0, 1, 0)).normalize()
  const target = c.clone().addScaledVector(right, -r * 0.55)
  const eye = target.clone().addScaledVector(d, r * arg.fit)
  flyTo({ position: eye.toArray(), target: target.toArray() })`, { id, dir, fit })
/** pick a part in the model; if it can't be hit from here, from the parts tree */
async function clickPart(name, s = 0.6) {
  const id = await partId(name)
  const at = id && (await pickPoint(id))
  if (at) {
    await click(at[0], at[1], s)
    if ((await selected()) === id) return id
    console.log(`  ${name}: the 3D click selected ${await selected()}, using the tree`)
  } else console.log(`  ${name}: not reachable in 3D, using the tree`)
  const row = page.locator('aside button', { hasText: new RegExp('^' + name + '$') }).first()
  await row.scrollIntoViewIfNeeded()
  await clickOn(row, s)
  return id
}
const button = (name) => page.getByRole('button', { name, exact: true })
const meshes = () => page.evaluate(() => { let c = 0; window.__agriState?.scene.traverse((o) => { if (o.isMesh) c++ }); return c })
/** wait on the real clock for a scene to finish building (nothing is filmed) */
async function settled() {
  let last = -1, still = 0
  for (let i = 0; i < 180 && still < 8; i++) {
    const c = await meshes()
    still = c === last && c > 0 ? still + 1 : 0
    last = c
    await realSleep(1000)
  }
  return last
}

/* ---------------------------------------------------------------- set up off camera */
await page.clock.install()
await page.goto(`${BASE}/#/m/powertrain/line-of-drive`)
await page.waitForFunction(() => !!window.__agriState, null, { timeout: 180000 })
console.log('meshes', await settled())
await js(`
  const { useAuth } = await import('/src/cloud/auth.ts')
  useAuth.setState({ status: 'signed-in', user: { uid: 'promo', email: '', name: 'Ola', photo: null }, token: async () => null })
  // the tutor's reply, played back: a genuine answer from the tutor model, streamed as the API streams it
  const real = window.fetch
  window.fetch = async (url, init) => {
    if (!String(url).includes('/v1/tutor')) return real(url, init)
    const enc = new TextEncoder()
    const words = arg.match(/\\S+\\s*/g) ?? [arg]
    const sse = (event, data) => enc.encode('event: ' + event + '\\ndata: ' + JSON.stringify(data) + '\\n\\n')
    const body = new ReadableStream({
      async start(c) {
        c.enqueue(sse('meta', { remaining: 39 }))
        await new Promise((r) => setTimeout(r, 500))
        for (let i = 0; i < words.length; i += 4) {
          c.enqueue(sse('delta', { text: words.slice(i, i + 4).join('') }))
          await new Promise((r) => setTimeout(r, 48))
        }
        c.close()
      },
    })
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
  }
  // the pointer and the ring a click opens, drawn into the page so they zoom with it
  const cur = document.createElement('div')
  cur.id = '__cur'
  cur.innerHTML = '<svg width="28" height="33" viewBox="0 0 17 20"><path d="M1.5 1.5 L1.5 16 L5.2 12.6 L7.9 18.5 L10.4 17.4 L7.8 11.6 L12.8 11.4 Z" fill="#fff" stroke="#0e120c" stroke-width="1.4" stroke-linejoin="round"/></svg>'
  cur.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;pointer-events:none;transform-origin:3px 3px;filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))'
  const ring = document.createElement('div')
  ring.id = '__ring'
  ring.style.cssText = 'position:fixed;left:0;top:0;width:80px;height:80px;border-radius:50%;border:3px solid #4d7c0f;z-index:99998;pointer-events:none;opacity:0'
  document.body.append(ring, cur)
`, TUTOR.answer)
await view(`v.setCut({ enabled: false }); v.setLabels(false)`)
await page.mouse.move(mouse.x, mouse.y)
await page.clock.pauseAt(Date.now() + 120000)
await hold(0) // the clock is now ours

const TOOLBAR = { cx: 898, cy: 660, w: 1500 }
const STAGE = { cx: 898, cy: 420, w: 1284 }
const sliders = {
  section: page.getByRole('slider', { name: 'Sweep section plane' }),
  explode: page.getByRole('slider', { name: 'Explode' }),
}
const bar = (label) => page.locator(`[aria-label^="${label}"], [title^="${label}"]`).first()
const camStart = [[4.6, 1.75, 4.2], [0.7, 0.85, 0]]

/* ---------------------------------------------------------------- action */
film.crops.push({ t: 0, d: 0, ...STAGE })
await js(`const { getCameraControls } = await import('/src/ui/camera.ts'); getCameraControls().setLookAt(...arg, false)`, [...camStart[0], ...camStart[1]])

// 1. under the intro card, then the whole tractor, running
await hold(3.3)
mark('open')
caption('The machine', 'A whole tractor, running.', 'Every part of it is yours to open.', 3.5, 'tl')
await fly([3.4, 1.7, 4.9], camStart[1])
await hold(3.9)

// 2. section it: sweep the plane across the tractor
mark('section')
crop(TOOLBAR.cx, TOOLBAR.cy, TOOLBAR.w, 0.8)
caption('Section', 'Cut through it.', 'Sweep a plane across the running tractor.', 4.6)
await clickOn(bar('Section'), 0.6)
await hold(0.2)
await slide(sliders.section, 1, 0.45, 0.3)
await hold(0.1)
await slide(sliders.section, 0, 2.9, 0.05)
await hold(0.2)

// 3. x-ray, and turn the tractor by hand
mark('xray')
caption('X-ray', 'See through it.', 'Housings turn to glass. Everything keeps working.', 4.2)
await clickOn(bar('Section'), 0.45)
await clickOn(bar('X-ray'), 0.5)
crop(STAGE.cx, STAGE.cy + 40, STAGE.w, 0.9)
await moveTo(760, 650, 0.45)
await dragTo(1090, 620, 1.2)
await hold(0.2)

// 4. slow it down, and move in on the engine
mark('slow')
caption('Time', 'Slow it down.', 'From full speed to one two-hundredth.', 3.6)
crop(TOOLBAR.cx, TOOLBAR.cy, TOOLBAR.w, 0.6)
const speed = page.locator('main select').first()
await clickOn(speed, 0.5)
await js(`const { useSim } = await import('/src/core/sim.ts'); useSim.getState().setTimeScale(1 / 100)`)
await fly([2.5, 1.45, 1.75], [1.15, 0.95, 0])
crop(STAGE.cx, STAGE.cy + 30, STAGE.w, 1.0)
await moveTo(1130, 720, 0.6)
await hold(1.6)

// 5. take it apart with the explode slider
mark('explode')
caption('Explode', 'Take it apart.', 'One slider, every part pulled clear.', 4.6)
crop(TOOLBAR.cx, TOOLBAR.cy, TOOLBAR.w, 0.6)
await clickOn(bar('X-ray'), 0.5)
await js(`const { useSim } = await import('/src/core/sim.ts'); useSim.getState().setTimeScale(1 / 4)`)
await fly([3.6, 3.2, 6.4], [0.7, 0.95, 0])
await slide(sliders.explode, 1, 1.9, 0.45)
await hold(1.1)

// 6. isolate a part, show the context again, isolate another
mark('isolate')
crop(STAGE.cx, STAGE.cy, STAGE.w, 0.8)
caption('Isolate', 'Pick any part.', 'Isolate it, read what it does.', 2.6)
await clickPart('Gearbox')
await hold(0.4)
await clickOn(button('Isolate'), 0.45)
await hold(0.6)
mark('openbox')
caption('Look inside', 'Open the box.', 'The gears, the dog collar, going into gear.', 4.2)
await clickOn(page.getByRole('button', { name: /Look inside/ }), 0.45)
await hold(3.1)
await clickOn(page.locator('main button', { hasText: /^Back$/ }).first(), 0.45)
await hold(0.3)
mark('context')
caption('Isolate', 'Then the next.', 'Back to the machine, on to another part.', 3.6)
crop(800, 480, 1600, 0.4)
const gearRow = page.locator('aside button', { hasText: /^Gearbox$/ }).first()
await gearRow.scrollIntoViewIfNeeded()
await clickOn(gearRow, 0.45)
await hold(0.2)
await clickOn(button('Show context'), 0.4)
await fly([3.6, 3.2, 6.4], [0.7, 0.95, 0])
await hold(0.7)
crop(800, 480, 1600, 0.4)
const engineRow = page.locator('aside button', { hasText: /^Engine$/ }).first()
await engineRow.scrollIntoViewIfNeeded()
await clickOn(engineRow, 0.55)
crop(STAGE.cx, STAGE.cy, STAGE.w, 0.5)
await hold(0.4)
await clickOn(button('Isolate'), 0.45)
await hold(1.0)

// 7. look inside the engine, in place
mark('inside')
caption('Look inside', 'Open it up, right there.', 'The full four-cylinder diesel, firing in slow motion.', 4.0)
await clickOn(page.getByRole('button', { name: /Look inside/ }), 0.5)
await hold(0.9)
await moveTo(700, 620, 0.4)
await dragTo(1180, 560, 1.9)
await hold(0.2)

// ask about this part: the tutor sees the part, the view and the numbers on screen
mark('ask')
caption('Ask', 'Ask about this part.', 'A tutor that sees what you picked, the view and the numbers.', 7.6, 'bl')
await js(`const { useSim } = await import('/src/core/sim.ts'); useSim.getState().setPlaying(false)`)
await clickPart('Pistons', 0.55)
await js(`const { useSim } = await import('/src/core/sim.ts'); useSim.getState().setPlaying(true)`)
await hold(0.3)
await clickOn(page.getByRole('button', { name: 'Ask about this part' }), 0.5)
await hold(0.35)
crop(1400, 450, 1040, 0.9)
await clickOn(page.locator('textarea[placeholder="Ask a question…"]'), 0.4)
await typeIn(TUTOR.question, 2)
await hold(0.15)
await page.keyboard.press('Enter')
await hold(4.2)
await page.locator('[aria-label*="lose" i]').last().click({ timeout: 2000 }).catch(() => console.log('  tutor close: not found'))
await view(`v.select(null)`)
crop(STAGE.cx, STAGE.cy, STAGE.w, 0.6)
await clickOn(page.locator('main button', { hasText: /^Back$/ }).first(), 0.5)
await hold(0.4)

// 8. back together, and change the load
mark('settings')
await view(`v.isolate(null); v.select(null)`)
crop(TOOLBAR.cx, TOOLBAR.cy, TOOLBAR.w, 0.6)
await slide(sliders.explode, 0, 0.9, 0.45)
await fly([3.3, 2.3, 4.3], [0.55, 0.75, 0])
crop(1100, 560, 1640, 0.9)
await clickOn(bar('Section'), 0.45)
caption('Settings', 'Change anything.', 'Every control drives the physics. The readouts follow.', 5.2, 'bl')
await page.locator('aside .overflow-y-auto').last().evaluate((el) => { el.scrollTop = 0 })
await clickOn(page.getByRole('radio', { name: '4-wheel' }), 0.55)
await hold(0.4)
await page.getByText('Drawbar pull P').first().scrollIntoViewIfNeeded()
await hold(0.1)
await slide(page.getByRole('slider', { name: /Drawbar pull/ }).or(page.locator('label', { hasText: 'Drawbar pull P' }).locator('input')).first(), 0.6, 1.1, 0.45)
await hold(0.5)

// 9. exam practice, marked, with the working
mark('practise')
crop(1560, 800, 1000, 0.8)
caption('Practise', 'Question and solution.', 'Fresh numbers, marked, with the working shown.', 6.2, 'bl')
await clickOn(page.getByRole('button', { name: /Exam Practice/ }), 0.55)
await hold(0.5)
const answers = await js(`
  const { QUESTIONS } = await import('/src/study/questions/index.ts')
  const list = QUESTIONS.filter((x) => x.moduleId === 'powertrain' && x.sceneId === 'line-of-drive')
  const q = list[0]; const s = q.solve()
  const fmt = (v) => { const a = Math.abs(v); return String(+v.toPrecision(a >= 100 ? 4 : 3)) }
  return q.answers.map((a) => fmt(s[a.key]))`)
const inputs = page.locator('aside input[placeholder="Enter value…"]')
for (let i = 0; i < answers.length; i++) {
  await clickOn(inputs.nth(i), 0.4)
  await typeIn(answers[i], 3)
  await hold(0.12)
}
await clickOn(page.getByRole('button', { name: 'Check Answer' }), 0.4)
await hold(0.4)
await clickOn(page.getByRole('button', { name: /Show Working/ }), 0.4)
await hold(0.7)
for (let i = 1; i <= 42; i++) {
  await page.evaluate((u) => { const el = [...document.querySelectorAll('aside .overflow-y-auto')].find((e) => e.scrollHeight > e.clientHeight); if (el) el.scrollTop = u * Math.min(el.scrollHeight - el.clientHeight, 420) }, ease(i / 42))
  await frame()
}
await hold(0.4)
await clickOn(page.getByRole('button', { name: /Controls/ }), 0.4)

// 10. go deeper: from the tractor's engine into the engine's own scene, the app's own transition
mark('deeper')
crop(800, 480, 1600, 0.7)
caption('Go deeper', 'Follow it down.', 'From the tractor to the engine in detail.', 2.4)
await clickPart('Pistons', 0.5)
await hold(0.4)
await clickOn(page.locator('main button', { hasText: /Four-stroke/ }).first(), 0.5)
crop(STAGE.cx, STAGE.cy, STAGE.w, 0.3)
await hold(0.34) // the fade closes
await page.clock.resume()
await page.waitForFunction(() => /Four-stroke/i.test(document.title), null, { timeout: 180000 })
console.log('engine meshes', await settled())
await page.clock.pauseAt(Date.now() + 120000)
await hold(0.5) // and opens

// 12. build it yourself
mark('build')
crop(STAGE.cx, 560, 1500, 0.8)
caption('Build', 'Build it yourself.', 'Part by part. Wrong order? It tells you why.', 6.0, 'tl')
await clickOn(page.locator('[aria-label^="Build it"]'), 0.45)
await hold(0.9)
const own = (id) => js(`
  const st = window.__agriState, THREE = window.__THREE, b = new THREE.Box3()
  st.scene.traverse((x) => { if (x.isMesh && x.userData && x.userData.partId === arg) b.expandByObject(x) })
  const c = b.getCenter(new THREE.Vector3()).project(st.camera)
  const r = st.gl.domElement.getBoundingClientRect()
  return [r.left + ((c.x + 1) / 2) * r.width, r.top + ((1 - c.y) / 2) * r.height]`, id)
const partAt = (id) => js(`
  const { partObjects } = await import('/src/parts/registry.ts')
  const st = window.__agriState, THREE = window.__THREE
  const c = new THREE.Box3().setFromObject(partObjects.get(arg)).getCenter(new THREE.Vector3()).project(st.camera)
  const r = st.gl.domElement.getBoundingClientRect()
  return [r.left + ((c.x + 1) / 2) * r.width, r.top + ((1 - c.y) / 2) * r.height]`, id)
const next = () => js(`const { useBuild, nextSteps } = await import('/src/render/build.ts'); const b = useBuild.getState(); return b.finishedAt ? null : nextSteps(b.def, b.placed)[0]?.id ?? null`)
for (let i = 0; i < 2; i++) {
  const id = await next()
  if (!id) break
  const [x, y] = await partAt(id)
  await moveTo(x, y, 0.42)
  const [bx, by] = await own('block')
  await dragTo(bx, by - 20, 0.5)
  await hold(0.15)
}
for (let i = 0; i < 30; i++) {
  const id = await next()
  if (!id) break
  const [x, y] = await partAt(id)
  await moveTo(x, y, 0.05)
  await press(true)
  await hold(0.03)
  await press(false)
  await hold(0.03)
}
mark('built')
await hold(0.5)
await clickOn(button('Done'), 0.4)
await clickOn(page.locator('[aria-label="Reset camera"]'), 0.4)
await moveTo(1500, 980, 0.3)

// 13. the end card plays over the finished engine, on the bar line, with the app still running
const BAR = 1.8
const endAt = Math.ceil(now() / BAR) * BAR
await hold(endAt - now())
mark('end')
await hold(5.4)

film.frames = n
film.duration = n / FPS
fs.writeFileSync(path.join(OUT, PREVIEW ? 'take-preview.json' : 'take.json'), JSON.stringify(film, null, 1))
console.log('frames', n, 'seconds', film.duration.toFixed(1), 'clicks', film.clicks.length)
await browser.close()
