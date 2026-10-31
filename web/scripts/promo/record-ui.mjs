// Record the app's own screens for the promo (headless GPU Chrome on the dev server):
//   node scripts/promo/record-ui.mjs <outdir> [clip,clip,…]
// Each clip is a real interaction, captured as a screencast (frames + timestamps) with the pointer's
// path logged alongside, so the comp can draw a clean cursor and zoom where it matters.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve(process.argv[2])
const only = process.argv[3] ? process.argv[3].split(',') : null
const BASE = 'http://localhost:4173/#/'
const W = 1920
const H = 1080

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] })
// recorded at 1.5x so the comp can zoom into the panels and keep text sharp
const DPR = 1.5
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR })
await ctx.addInitScript(() => localStorage.setItem('solidify.theme', 'light'))
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('  pageerror', e.message))
const cdp = await ctx.newCDPSession(page)
/**
 * The tutor's reply, played back: a genuine answer from the tutor model (tutor-answer.json, made with
 * the API's own prompt), streamed in small pieces as the API streams it. The panel is shown signed in.
 */
const TUTOR = (() => { try { return JSON.parse(fs.readFileSync(path.join(OUT, '..', 'tutor-answer.json'), 'utf8')) } catch { return null } })()
async function playTutor() {
  if (!TUTOR) throw new Error('no tutor-answer.json')
  await page.evaluate(async (answer) => {
    const { useAuth } = await import('/src/cloud/auth.ts')
    useAuth.setState({ status: 'signed-in', user: { uid: 'promo', email: 'ola@solidify.studio', name: 'Ola', photo: null }, token: async () => null })
    const real = window.fetch
    window.fetch = async (url, init) => {
      if (!String(url).includes('/v1/tutor')) return real(url, init)
      const enc = new TextEncoder()
      const words = answer.match(/\S+\s*/g) ?? [answer]
      const sse = (event, data) => enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      const body = new ReadableStream({
        async start(c) {
          c.enqueue(sse('meta', { remaining: 39 }))
          await new Promise((r) => setTimeout(r, 900))
          for (let i = 0; i < words.length; i += 3) {
            c.enqueue(sse('delta', { text: words.slice(i, i + 3).join('') }))
            await new Promise((r) => setTimeout(r, 55))
          }
          c.close()
        },
      })
      return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } })
    }
  }, TUTOR.answer)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------------------------------------------------------------- capture */
let rec = null
cdp.on('Page.screencastFrame', async (f) => {
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {})
  if (!rec) return
  const n = rec.frames.length
  const file = String(n).padStart(5, '0') + '.jpg'
  fs.writeFileSync(path.join(rec.dir, file), Buffer.from(f.data, 'base64'))
  rec.frames.push({ file, t: f.metadata.timestamp })
})
let mouse = { x: W / 2, y: H / 2 }
const log = (ev) => rec && rec.events.push({ t: Date.now() / 1000, x: mouse.x, y: mouse.y, ...ev })
async function record(name, fn) {
  const dir = path.join(OUT, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  rec = { dir, frames: [], events: [] }
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: W * DPR, maxHeight: H * DPR, everyNthFrame: 2 })
  const t0 = Date.now() / 1000
  log({ k: 'start' })
  try {
    await fn()
  } finally {
    log({ k: 'end' })
    await sleep(300)
    await cdp.send('Page.stopScreencast')
    fs.writeFileSync(path.join(dir, 'clip.json'), JSON.stringify({ t0, frames: rec.frames, events: rec.events }))
    console.log(`  ${name}: ${rec.frames.length} frames over ${(Date.now() / 1000 - t0).toFixed(1)} s`)
    rec = null
  }
}

/* ---------------------------------------------------------------- a human-ish pointer */
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
async function moveTo(x, y, ms = 650) {
  const a = { ...mouse }
  const steps = Math.max(8, Math.round(ms / 16))
  // a slight arc, as a hand moves
  const bend = 0.12 * Math.hypot(x - a.x, y - a.y)
  for (let i = 1; i <= steps; i++) {
    const u = ease(i / steps)
    const arc = Math.sin(Math.PI * u) * bend
    mouse = { x: a.x + (x - a.x) * u, y: a.y + (y - a.y) * u - arc * 0.35 }
    await page.mouse.move(mouse.x, mouse.y)
    log({ k: 'move' })
    await sleep(ms / steps)
  }
}
async function click(x, y, ms) {
  await moveTo(x, y, ms)
  await sleep(120)
  log({ k: 'down' })
  await page.mouse.down()
  await sleep(90)
  await page.mouse.up()
  log({ k: 'up' })
  await sleep(200)
}
async function dragTo(x, y, ms = 900) {
  log({ k: 'down' })
  await page.mouse.down()
  await sleep(120)
  await moveTo(x, y, ms)
  await sleep(100)
  await page.mouse.up()
  log({ k: 'up' })
  await sleep(250)
}
async function centre(locator) {
  const b = await locator.boundingBox()
  if (!b) throw new Error('not on screen: ' + locator)
  return [b.x + b.width / 2, b.y + b.height / 2, b]
}
async function clickOn(locator, ms) {
  const [x, y] = await centre(locator)
  await click(x, y, ms)
}
async function typeIn(text, perChar = 45) {
  for (const ch of text) {
    await page.keyboard.type(ch)
    await sleep(perChar + (/[ ,.?]/.test(ch) ? 40 : 0))
  }
}
/** screen position of a part (its whole subtree), via the dev bridge */
async function partAt(id) {
  return page.evaluate(async (id) => {
    const { partObjects } = await import('/src/parts/registry.ts')
    const st = window.__agriState
    const THREE = window.__THREE
    const o = partObjects.get(id)
    const b = new THREE.Box3().setFromObject(o)
    const c = b.getCenter(new THREE.Vector3()).project(st.camera)
    const r = st.gl.domElement.getBoundingClientRect()
    return [r.left + ((c.x + 1) / 2) * r.width, r.top + ((1 - c.y) / 2) * r.height]
  }, id)
}
/** a screen point where a click really lands on the part (nothing else in front of it) */
async function pickPoint(id) {
  return page.evaluate(async (id) => {
    const { partObjects } = await import('/src/parts/registry.ts')
    const st = window.__agriState
    const THREE = window.__THREE
    const o = partObjects.get(id)
    const box = new THREE.Box3().setFromObject(o)
    let x0 = 1, x1 = -1, y0 = 1, y1 = -1
    for (let k = 0; k < 8; k++) {
      const v = new THREE.Vector3(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(st.camera)
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y)
    }
    const ray = new THREE.Raycaster()
    const inside = (obj) => { for (let p = obj; p; p = p.parent) if (p === o) return true; return false }
    const r = st.gl.domElement.getBoundingClientRect()
    // from the middle outwards, the first point whose nearest hit is this part
    const pts = []
    for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) pts.push([x0 + ((x1 - x0) * i) / 12, y0 + ((y1 - y0) * j) / 12])
    pts.sort((a, b) => Math.hypot(a[0] - (x0 + x1) / 2, a[1] - (y0 + y1) / 2) - Math.hypot(b[0] - (x0 + x1) / 2, b[1] - (y0 + y1) / 2))
    for (const [x, y] of pts) {
      ray.setFromCamera(new THREE.Vector2(x, y), st.camera)
      const hit = ray.intersectObjects(st.scene.children, true).find((h) => h.object.visible && h.object.isMesh)
      if (hit && inside(hit.object)) return [r.left + ((x + 1) / 2) * r.width, r.top + ((1 - y) / 2) * r.height]
    }
    return null
  }, id)
}
async function open(route) {
  await page.goto(BASE + route)
  await page.waitForFunction(() => !!window.__scene && !document.querySelector('main')?.innerText.includes('Building'), null, { timeout: 180000 })
  await sleep(2500)
  mouse = { x: W * 0.6, y: H * 0.55 }
  await page.mouse.move(mouse.x, mouse.y)
}
const want = (k) => !only || only.includes(k)

/* ---------------------------------------------------------------- the clips */
if (want('ui-settings')) {
  await open('m/engine/four-stroke-diesel')
  // the Controls panel scrolled so the cycle sliders and the P–V / T–s diagrams are both in view
  await page.evaluate(() => {
    const label = [...document.querySelectorAll('aside *')].find((e) => e.childElementCount === 0 && /^Cycle model$/i.test(e.textContent?.trim() ?? ''))
    label?.scrollIntoView({ block: 'start' })
  })
  await sleep(600)
  /** where a range input's thumb is, from its own min / max / value */
  const thumbOf = (loc) => loc.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const k = (+el.value - +el.min) / (+el.max - +el.min)
    return [r.left + 8 + k * (r.width - 16), r.top + r.height / 2, r.left, r.width]
  })
  await record('ui-settings', async () => {
    await sleep(500)
    const cr = page.locator('aside input[type="range"]').first()
    const [tx, ty, left, width] = await thumbOf(cr)
    await moveTo(tx, ty, 700)
    await dragTo(left + width * 0.94, ty, 1300)
    await sleep(500)
    const heat = page.locator('aside input[type="range"]').nth(1)
    const [hx, hy, hl, hw] = await thumbOf(heat)
    await moveTo(hx, hy, 600)
    await dragTo(hl + hw * 0.18, hy, 1100)
    await sleep(900)
  })
}

if (want('ui-ask')) {
  await open('m/engine/four-stroke-diesel')
  await playTutor()
  await record('ui-ask', async () => {
    await sleep(400)
    // hold the engine still for the click (the piston moves), then let it run again
    const run = (on) => page.evaluate(async (on) => { const { useSim } = await import('/src/core/sim.ts'); useSim.getState().setPlaying(on) }, on)
    await run(false)
    await sleep(150)
    const [px, py] = (await pickPoint('piston-assembly')) ?? (await partAt('piston'))
    await click(px, py, 800)
    await sleep(300)
    await run(true)
    await sleep(400)
    await clickOn(page.getByRole('button', { name: 'Ask about this part' }), 700)
    await sleep(700)
    const box = page.locator('textarea[placeholder="Ask a question…"]')
    await clickOn(box, 500)
    await typeIn('Why does a diesel piston have a bowl in its crown?')
    await sleep(300)
    await page.keyboard.press('Enter')
    log({ k: 'send' })
    // wait for the tutor's answer to finish streaming
    let last = ''
    let still = 0
    for (let i = 0; i < 120 && still < 6; i++) {
      await sleep(500)
      const t = await page.evaluate(() => document.querySelector('[data-tutor-log]')?.textContent ?? document.body.innerText.slice(-2000))
      still = t === last ? still + 1 : 0
      last = t
    }
    await sleep(600)
  })
}

if (want('ui-practise')) {
  await open('m/engine/four-stroke-diesel')
  await record('ui-practise', async () => {
    await sleep(400)
    await clickOn(page.getByRole('button', { name: /Exam Practice/ }), 700)
    await sleep(1100)
    // the right answers, from the question's own solution (the first question linked to this scene)
    const answers = await page.evaluate(async () => {
      const { QUESTIONS } = await import('/src/study/questions/index.ts')
      const q = QUESTIONS.find((x) => x.moduleId === 'engine' && x.sceneId === 'four-stroke-diesel')
      const s = q.solve()
      const fmt = (v) => { const a = Math.abs(v); return String(+v.toPrecision(a >= 100 ? 4 : 3)) }
      return q.answers.map((a) => fmt(s[a.key]))
    })
    const inputs = page.locator('aside input[placeholder="Enter value…"]')
    for (let i = 0; i < answers.length; i++) {
      await clickOn(inputs.nth(i), i ? 450 : 700)
      await typeIn(answers[i], 70)
      await sleep(250)
    }
    await clickOn(page.getByRole('button', { name: 'Check Answer' }), 600)
    await sleep(1400)
    await clickOn(page.getByRole('button', { name: /Show Working/ }), 700)
    await sleep(2400)
    // scroll the working into view, slowly
    await page.evaluate(async () => {
      const el = [...document.querySelectorAll('aside .overflow-y-auto')].find((e) => e.scrollHeight > e.clientHeight)
      if (!el) return
      const to = Math.min(el.scrollHeight - el.clientHeight, 520)
      for (let y = 0; y <= to; y += 8) { el.scrollTop = y; await new Promise((r) => setTimeout(r, 16)) }
    })
    await sleep(1800)
  })
}

if (want('ui-build')) {
  await open('m/engine/four-stroke-diesel')
  await record('ui-build', async () => {
    await sleep(300)
    await clickOn(page.locator('[aria-label^="Build it"]'), 800)
    await sleep(2600)
    // the first few by hand, dragged onto the block; then quicker taps (the comp speeds this up)
    const own = (id) => page.evaluate((id) => {
      const st = window.__agriState
      const THREE = window.__THREE
      const b = new THREE.Box3()
      st.scene.traverse((x) => { if (x.isMesh && x.userData && x.userData.partId === id) b.expandByObject(x) })
      const c = b.getCenter(new THREE.Vector3()).project(st.camera)
      const r = st.gl.domElement.getBoundingClientRect()
      return [r.left + ((c.x + 1) / 2) * r.width, r.top + ((1 - c.y) / 2) * r.height]
    }, id)
    const next = () => page.evaluate(async () => { const { useBuild, nextSteps } = await import('/src/render/build.ts'); const b = useBuild.getState(); return b.finishedAt ? null : nextSteps(b.def, b.placed)[0]?.id })
    for (let i = 0; i < 4; i++) {
      const id = await next()
      if (!id) break
      const [x, y] = await partAt(id)
      await moveTo(x, y, 650)
      await sleep(150)
      const [bx, by] = await own('block')
      await dragTo(bx, by - 20, 850)
      await sleep(500)
    }
    log({ k: 'fast' })
    for (let i = 0; i < 30; i++) {
      const id = await next()
      if (!id) break
      const [x, y] = await partAt(id)
      await click(x, y, 280)
      await sleep(250)
    }
    log({ k: 'built' })
    await sleep(3200)
  })
}

await browser.close().catch(() => {})
