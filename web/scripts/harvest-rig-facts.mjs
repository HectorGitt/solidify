import { chromium } from 'playwright-core'
import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'

/**
 * Reads each rig's own numbers and equations, as its controls panel shows them at the default settings,
 * into src/ui/rigFacts.json for the home page and the Labs page: the first readouts (label, value, unit)
 * and the first steps of its working (label and TeX). Nothing is typed in by hand, so the figures are
 * always the rig's own; run again after changing a rig.
 *
 *   node scripts/harvest-rig-facts.mjs engine/cooling powertrain/differential …   (module/scene paths)
 */
const ids = process.argv.slice(2)
if (!ids.length) throw new Error('Pass module/scene paths.')
const OUT = path.resolve('src/ui/rigFacts.json')
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
]

const facts = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {}
const server = await createServer({ server: { port: 5329, strictPort: false, hmr: false, watch: null } })
await server.listen()
const base = (server.resolvedUrls?.local[0] || 'http://localhost:5329/').replace(/\/$/, '')
const browser = await chromium.launch({ executablePath: BROWSERS.find((p) => fs.existsSync(p)), headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] })
const failed = []
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  for (const id of ids) {
    process.stdout.write(`${id} … `)
    try {
      await page.evaluate(() => ((window.__shotReady = false), (window.__shotError = undefined))).catch(() => {})
      await page.goto(`${base}/#/shot/${id}?panel=1`, { waitUntil: 'networkidle', timeout: 90000 })
      await page.waitForFunction(() => window.__shotReady === true || !!window.__shotError, null, { timeout: 120000 })
      const err = await page.evaluate(() => window.__shotError)
      if (err) throw new Error(err)
      const got = await page.evaluate(() => {
        const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
        const readings = [...document.querySelectorAll('[data-shot-panel] [data-readout]')]
          .map((r) => {
            const v = r.querySelector('[data-readout-value]')
            const unit = text(v?.querySelector('span'))
            const value = text(v).slice(0, text(v).length - unit.length).trim()
            return { label: text(r.querySelector('[data-readout-label]')), value, unit }
          })
          // a reading at rest (0 kN before a test starts, a dash) says nothing about the rig
          .filter((r) => r.label && r.value && r.value.length <= 24 && !/^[-−–—]?\s*0*([.,]0*)?$/.test(r.value) && /\d/.test(r.value))
        const equations = [...document.querySelectorAll('[data-shot-panel] [data-working-step]')]
          .map((w) => {
            const [label, tex] = (w.getAttribute('data-working-step') ?? '').split(' | ')
            return { label: (label ?? '').trim(), tex: (tex ?? '').trim() }
          })
          .filter((e) => e.label && e.tex && e.tex.length <= 160)
        return { readings: readings.slice(0, 4), equations: equations.slice(0, 3) }
      })
      facts[id] = got
      console.log(`${got.readings.length} readings, ${got.equations.length} equations`)
    } catch (e) {
      console.log(`FAILED (${e.message})`)
      failed.push(id)
    }
  }
} finally {
  await browser.close()
  await server.close()
}
fs.writeFileSync(OUT, JSON.stringify(Object.fromEntries(Object.entries(facts).sort()), null, 1) + '\n')
if (failed.length) console.error(`Failed: ${failed.join(', ')}`)
