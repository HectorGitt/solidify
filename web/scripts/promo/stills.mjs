// node scripts/promo/stills.mjs <outdir> module/scene ... — one still per scene, as the scene opens
import { launch } from './lib.mjs'
import path from 'node:path'
const [out, ...routes] = process.argv.slice(2)
const s = await launch({ width: 1280, height: 720 })
for (const r of routes) {
  const t0 = Date.now()
  try {
    await s.open(r)
    await s.page.waitForTimeout(800)
    await s.page.screenshot({ path: path.join(out, r.replace('/', '--') + '.jpg'), type: 'jpeg', quality: 80 })
    console.log(r, Date.now() - t0, 'ms')
  } catch (e) { console.log(r, 'FAILED', e.message.slice(0, 120)) }
}
await s.browser.close()
