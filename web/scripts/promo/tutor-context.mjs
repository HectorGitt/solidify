// the context the tutor panel would send for "piston selected on the four-stroke scene" (headless, dev server)
import { launch } from './lib.mjs'
import fs from 'node:fs'
const s = await launch({ width: 1920, height: 1080, base: 'http://localhost:4173' })
const p = s.page
await p.goto('http://localhost:4173/#/m/engine/four-stroke-diesel')
await p.waitForFunction(() => !!window.__scene, null, { timeout: 180000 })
await p.waitForTimeout(6000)
const ctx = await s.js(`
  const { useView } = await import('/src/render/view.ts'); useView.getState().select('piston')
  await new Promise((r) => setTimeout(r, 1500))
  const o = await import('/src/cloud/onScreen.ts')
  return { route: '/m/engine/four-stroke-diesel', part: o.selectedPart(), live: o.collectReadouts(), working: o.collectWorking() }`)
fs.writeFileSync(process.argv[2], JSON.stringify(ctx, null, 1))
console.log(JSON.stringify(ctx).slice(0, 600))
await s.browser.close()
