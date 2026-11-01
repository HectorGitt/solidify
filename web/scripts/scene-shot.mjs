// Screenshot a scene in the real app (dev server running), for checking a new scene by eye:
//   node scripts/scene-shot.mjs <base url> <module/scene> <out prefix> [JS to run first] [theta…]
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const [base, route, out, setup] = process.argv.slice(2)
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } })
await ctx.addInitScript(() => localStorage.setItem('solidify.theme', 'light'))
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(`${base}/#/m/${route}`)
await page.waitForFunction(() => !!window.__agriState, null, { timeout: 120000 })
await page.waitForTimeout(2500)
if (setup) await page.evaluate((code) => new Function(`return (async () => { ${code} })()`)(), setup)
for (let i = 0; i < 3; i++) {
  await page.waitForTimeout(1300)
  await page.screenshot({ path: `${out}-${i}.png` })
}
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].slice(0, 12).join('\n') : 'no page errors')
await browser.close()
