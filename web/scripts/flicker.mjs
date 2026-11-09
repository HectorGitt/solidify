// Finds surfaces that flash as the camera turns: the motion is paused, the camera turned in small steps,
// and a pixel that jumps away and straight back (frame k unlike both k-1 and k+1, which agree) is a flash.
// Writes a heat map over the first frame for each scene. Usage: node scripts/flicker.mjs module/scene ...
import { chromium } from 'playwright-core'
import fs from 'node:fs'
const out = process.env.FLICKER_OUT ?? 'flicker-out'
fs.mkdirSync(out, { recursive: true })
const routes = process.argv.slice(2)
const STEPS = Number(process.env.FLICKER_STEPS ?? 30)
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--use-angle=d3d11'] })
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } })
await page.addInitScript((step) => { window.__step = step; for (const k of ['rig', 'workspace']) localStorage.setItem(`solidify.tour.${k}`, '1') }, process.env.FLICKER_STEP ?? '0.006')
await page.route('**/solidify-api-6b27sr35hq-ew.a.run.app/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }))
for (const route of routes) {
  await page.goto(`http://localhost:5179/#/m/${route}${process.env.FLICKER_QUERY ?? ''}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForTimeout(9000)
  await page.evaluate(async (cut) => {
    const mod = (re) => import(performance.getEntriesByType('resource').map((r) => r.name).findLast((n) => re.test(n)))
    const { useSim } = await mod(/src\/core\/sim\.ts/)
    useSim.getState().setPlaying(false)
    if (cut) {
      const { useView } = await mod(/src\/render\/view\.ts/)
      useView.getState().setCut({ enabled: true })
    }
  }, !!process.env.FLICKER_CUT)
  await page.waitForTimeout(1500)
  const canvas = page.locator('canvas').first()
  const box = await canvas.boundingBox()
  const frames = []
  for (let i = 0; i < STEPS; i++) {
    frames.push((await page.screenshot({ clip: box })).toString('base64'))
    await page.evaluate(async () => {
      const mod = (re) => import(performance.getEntriesByType('resource').map((r) => r.name).findLast((n) => re.test(n)))
      const { getCameraControls } = await mod(/src\/ui\/camera\.ts/)
      void getCameraControls()?.rotate(Number(window.__step ?? 0.006), Number(window.__step ?? 0.006) * 0.25, false)
    })
    await page.waitForTimeout(120)
  }
  const result = await page.evaluate(async (frames) => {
    const load = (b64) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.src = `data:image/png;base64,${b64}` })
    const imgs = await Promise.all(frames.map(load))
    const w = imgs[0].width, h = imgs[0].height
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const g = c.getContext('2d', { willReadFrequently: true })
    const data = imgs.map((im) => { g.drawImage(im, 0, 0); return g.getImageData(0, 0, w, h).data })
    const heat = new Uint16Array(w * h)
    const T = 40
    let total = 0
    const lum = (d, i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]
    for (let k = 1; k < data.length - 1; k++) {
      const a = data[k - 1], b = data[k], n = data[k + 1]
      for (let p = 0; p < w * h; p++) {
        const i = p * 4
        const la = lum(a, i), lb = lum(b, i), ln = lum(n, i)
        if (Math.abs(lb - la) > T && Math.abs(lb - ln) > T && Math.abs(la - ln) < T / 2 && Math.sign(lb - la) === Math.sign(lb - ln)) { heat[p]++; total++ }
      }
    }
    // the first frame, dimmed, with the flashes in red
    g.drawImage(imgs[0], 0, 0)
    const base = g.getImageData(0, 0, w, h)
    for (let p = 0; p < w * h; p++) {
      const i = p * 4
      for (let ch = 0; ch < 3; ch++) base.data[i + ch] *= 0.45
      if (heat[p]) { base.data[i] = 255; base.data[i + 1] = Math.max(0, 80 - heat[p] * 20); base.data[i + 2] = 40 }
    }
    g.putImageData(base, 0, 0)
    return { total, pixels: heat.filter(Boolean).length, png: c.toDataURL('image/png').split(',')[1] }
  }, frames)
  const file = `${out}/${route.replace(/\//g, '--')}${process.env.FLICKER_CUT ? '-cut' : ''}.png`
  fs.writeFileSync(file, Buffer.from(result.png, 'base64'))
  console.log(route, `flash pixels ${result.pixels}, flashes ${result.total}`, file)
}
await browser.close()
