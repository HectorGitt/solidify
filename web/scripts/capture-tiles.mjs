import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'

/**
 * Photographs each system's featured scene for the home-page tiles, in the light and dark themes,
 * with the current lighting: public/media/modules/<id>-<theme>.webp.
 *
 *   node scripts/capture-tiles.mjs            all shots
 *   node scripts/capture-tiles.mjs engine pto only these ids
 *
 * Trying other scenes: pass module/scene paths and an output folder, e.g.
 *   SHOT_OUT=../shots SHOT_THEMES=light node scripts/capture-tiles.mjs engine/cooling engine/ignition
 * writes ../shots/engine--cooling-light.webp and so on.
 */

const WIDTH = 1280
const HEIGHT = 800
// saved smaller than captured: tiles never show wider than ~700 px, so 1024 keeps them sharp on 2x screens
const SAVE_WIDTH = 1024
const QUALITY = 0.78
const OUT = path.resolve('public/media')

// keep in step with FEATURED in src/ui/Landing.tsx
const SHOTS = {
  engine: 'engine/cooling',
  powertrain: 'powertrain/differential',
  pto: 'pto/pto-shaft',
  hydraulics: 'hydraulics/draft-control',
  steering: 'steering/boxes',
  traction: 'traction/tracks',
  chassis: 'chassis/stability',
  implements: 'implements/combine',
  elements: 'elements/chains',
  testing: 'testing/dynamometers',
  vibration: 'vibration/seat',
  field: 'field/field',
  processing: 'processing/palm-oil',
  water: 'water/irrigation-methods',
  structures: 'structures/farmstead',
  precision: 'precision/see-and-spray',
}

const BROWSERS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
]

const args = process.argv.slice(2)
const trial = args.some((a) => a.includes('/'))
const OUT_DIR = process.env.SHOT_OUT ? path.resolve(process.env.SHOT_OUT) : null
const THEMES = (process.env.SHOT_THEMES || 'light,dark').split(',')
const ids = trial ? args : Object.keys(SHOTS).filter((id) => !args.length || args.includes(id))
const target = (id) => (trial ? id : SHOTS[id])
const fileFor = (id, theme) => {
  if (trial) return path.join(OUT_DIR ?? OUT, `${id.replace('/', '--')}-${theme}.webp`)
  return path.join(OUT, 'modules', `${id}-${theme}.webp`)
}
if (OUT_DIR) fs.mkdirSync(OUT_DIR, { recursive: true })

const server = await createServer({ server: { port: 4179, strictPort: false, hmr: false, watch: null } })
await server.listen()
const base = (server.resolvedUrls?.local[0] || 'http://localhost:4179/').replace(/\/$/, '')

const browser = await chromium.launch({
  executablePath: BROWSERS.find((p) => fs.existsSync(p)),
  headless: true,
  args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
})

const failed = []
try {
  for (const theme of THEMES) {
    const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 })
    await context.addInitScript((t) => localStorage.setItem('solidify.theme', t), theme)
    // SHOT_COLD=1: a fresh tab per shot, to time each scene's build from a cold start
    const cold = !!process.env.SHOT_COLD
    let page = null
    const open = async () => {
      if (page) await page.close()
      page = await context.newPage()
      page.on('pageerror', (err) => console.error('  page error:', err.message))
    }
    await open()
    for (const id of ids) {
      if (cold) await open()
      const file = fileFor(id, theme)
      process.stdout.write(`${theme} ${id} … `)
      try {
        // a hash change doesn't reload the page, so clear the last scene's flags first
        await page.evaluate(() => ((window.__shotReady = false), (window.__shotError = undefined))).catch(() => {})
        await page.goto(`${base}/#/shot/${target(id)}`, { waitUntil: 'networkidle', timeout: 90000 })
        await page.waitForFunction(() => window.__shotReady === true || !!window.__shotError, null, { timeout: 120000 })
        const err = await page.evaluate(() => window.__shotError)
        if (err) throw new Error(err)
        const png = await page.screenshot({ type: 'png' })
        // scale and encode as WebP with the browser's own encoder (no image library needed)
        const webp = await page.evaluate(
          async ({ b64, w, q }) => {
            const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
            const c = new OffscreenCanvas(w, Math.round((bmp.height * w) / bmp.width))
            const ctx = c.getContext('2d')
            ctx.imageSmoothingQuality = 'high'
            ctx.drawImage(bmp, 0, 0, c.width, c.height)
            const blob = await c.convertToBlob({ type: 'image/webp', quality: q })
            const bytes = new Uint8Array(await blob.arrayBuffer())
            let bin = ''
            for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
            return btoa(bin)
          },
          { b64: png.toString('base64'), w: SAVE_WIDTH, q: QUALITY },
        )
        fs.writeFileSync(file, Buffer.from(webp, 'base64'))
        const built = await page.evaluate(() => window.__shotBuiltMs)
        console.log(`ok (built in ${(built / 1000).toFixed(1)} s)`)
      } catch (e) {
        console.log(`FAILED (${e.message})`)
        failed.push(`${theme}/${id}`)
      }
    }
    await context.close()
  }
} finally {
  await browser.close()
  await server.close()
}
if (failed.length) {
  console.error(`Failed: ${failed.join(', ')}`)
  process.exitCode = 1
}
