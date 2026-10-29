// Shared capture helpers for the promo: drive one ShotPage scene frame by frame from a headless GPU Chrome.
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'

export const FPS = 60
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))

/** easing */
export const ease = {
  io: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  sine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  lin: (t) => t,
}
export const clamp01 = (t) => Math.max(0, Math.min(1, t))
export const lerp = (a, b, t) => a + (b - a) * t

export async function launch({ width = 1920, height = 1080, scale = 1, theme = 'light', base = 'http://127.0.0.1:4173' } = {}) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] })
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale })
  await ctx.addInitScript((t) => localStorage.setItem('solidify.theme', t), theme)
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('  pageerror', e.message))

  const js = (code, arg) => page.evaluate(({ code, arg }) => new Function('arg', `return (async () => { ${code} })()`)(arg), { code, arg })
  /** code runs with (scene, camera, gl, THREE, controls) of the live stage */
  const dev = async (code) => {
    const r = await page.evaluate((c) => {
      document.dispatchEvent(new CustomEvent('agri-debug', { detail: c }))
      return document.body.dataset.agriDebug
    }, code)
    const v = r === undefined ? undefined : JSON.parse(r)
    if (v && v.error) throw new Error(v.error)
    return v
  }
  const raf = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(0)))))
  const view = (code) => js(`const { useView } = await import('/src/render/view.ts'); const v = useView.getState(); ${code}`)
  const sim = (code, arg) => js(`const { useSim } = await import('/src/core/sim.ts'); ${code}`, arg)

  async function open(route, query = '') {
    await page.goto('about:blank')
    await page.goto(`${base}/#/shot/${route}${query}`)
    await page.waitForFunction(() => window.__shotReady || window.__shotError, null, { timeout: 180000, polling: 250 })
    const err = await page.evaluate(() => window.__shotError)
    if (err) throw new Error(err)
    // some systems (the tractor's engine, cooling, fuel…) arrive after the scene reports ready:
    // wait until the mesh count has held still for 3 s
    let last = -1, still = 0
    for (let i = 0; i < 60 && still < 6; i++) {
      const n = await dev(`let n = 0; scene.traverse((o) => { if (o.isMesh) n++ }); return n`)
      still = n === last ? still + 1 : 0
      last = n
      await page.waitForTimeout(500)
    }
    await view(`v.setLabels(false)`)
    await raf()
  }

  const TRACK = (ids) => `const ids = ${JSON.stringify(ids)}; const out = {}; const b = new THREE.Box3(); const v = new THREE.Vector3();
    const w = gl.domElement.clientWidth, h = gl.domElement.clientHeight;
    scene.updateMatrixWorld(true);
    for (const id of ids) {
      b.makeEmpty();
      scene.traverse((o) => { if (o.isMesh && o.visible && o.userData && o.userData.partId === id) b.expandByObject(o) });
      if (b.isEmpty()) continue;
      b.getCenter(v); v.project(camera);
      out[id] = [+(((v.x + 1) / 2) * w).toFixed(1), +(((1 - v.y) / 2) * h).toFixed(1)];
    }
    return out`

  /**
   * Record n frames into dir. Per frame: each(u, i) sets camera/cut/explode (u = 0…1 through the clip),
   * step(u, i) gives the sim seconds to advance (default: the scene's own speed), track lists part ids
   * whose screen positions are written to track.json for callouts.
   */
  async function clip(dir, n, { each, step, track } = {}) {
    fs.mkdirSync(dir, { recursive: true })
    await sim(`useSim.setState({ playing: false, stepSize: useSim.getState().timeScale / ${FPS} })`)
    const t0 = Date.now()
    const tracks = []
    for (let i = 0; i < n; i++) {
      const u = n > 1 ? i / (n - 1) : 0
      if (each) await each(u, i)
      if (step) await sim(`useSim.setState({ stepSize: arg })`, step(u, i))
      await sim(`useSim.setState({ stepRequest: useSim.getState().stepRequest + 1 })`)
      await raf()
      if (track) tracks.push(await dev(TRACK(track)))
      await page.screenshot({ path: path.join(dir, String(i).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 93 })
    }
    if (track) fs.writeFileSync(path.join(dir, 'track.json'), JSON.stringify(tracks))
    console.log(`  ${path.basename(dir)}: ${n} frames, ${((Date.now() - t0) / n).toFixed(0)} ms/frame`)
  }

  /**
   * Camera rig relative to the scene's opening camera: returns (u) => sets the camera for progress u.
   * az/el in degrees added to the opening view, dist a factor of the opening distance, aim offsets the target.
   */
  async function rig({ az = [0, 0], el = [0, 0], dist = [1, 1], aim = [[0, 0, 0], [0, 0, 0]], e = ease.sine } = {}) {
    const c = await dev(`return { p: controls.getPosition(new THREE.Vector3()).toArray(), t: controls.getTarget(new THREE.Vector3()).toArray() }`)
    const [px, py, pz] = c.p.map((x, k) => x - c.t[k])
    const r0 = Math.hypot(px, py, pz)
    const th0 = Math.atan2(px, pz)
    const ph0 = Math.acos(py / r0)
    return (u) => {
      const k = e(u)
      const th = th0 + (lerp(az[0], az[1], k) * Math.PI) / 180
      const ph = Math.min(Math.PI / 2 - 0.02, Math.max(0.05, ph0 - (lerp(el[0], el[1], k) * Math.PI) / 180))
      const r = r0 * lerp(dist[0], dist[1], k)
      const t = c.t.map((x, j) => x + lerp(aim[0][j], aim[1][j], k))
      const p = [t[0] + r * Math.sin(ph) * Math.sin(th), t[1] + r * Math.cos(ph), t[2] + r * Math.sin(ph) * Math.cos(th)]
      return dev(`controls.setLookAt(${p.join(',')}, ${t.join(',')}, false); controls.update(0); return 1`)
    }
  }

  return { browser, page, js, dev, raf, view, sim, open, clip, rig }
}
