// the context the tutor panel would send for a selected part (headless, dev server):
//   node scripts/promo/tutor-context.mjs <out.json> <base url> <route> <part id> [<part id to look inside first>]
import { launch } from './lib.mjs'
import fs from 'node:fs'
const [out, base = 'http://localhost:4173', route = 'engine/four-stroke-diesel', part = 'piston', inside] = process.argv.slice(2)
const s = await launch({ width: 1920, height: 1080, base })
const p = s.page
await p.goto(`${base}/#/m/${route}`)
await p.waitForFunction(() => !!window.__scene, null, { timeout: 180000 })
await p.waitForTimeout(6000)
const ctx = await s.js(`
  const { useView } = await import('/src/render/view.ts')
  const { useParts } = await import('/src/parts/registry.ts')
  if (arg.inside) { const { enterInside } = await import('/src/ui/inside.ts'); enterInside(useParts.getState().parts[arg.inside]); await new Promise((r) => setTimeout(r, 3000)) }
  // as the film has it at this point: the section is off
  useView.getState().setCut({ enabled: false })
  useView.getState().select(arg.part)
  await new Promise((r) => setTimeout(r, 1500))
  const o = await import('/src/cloud/onScreen.ts')
  return { route: '/m/' + arg.route, scene: window.__scene?.title, sceneSummary: window.__scene?.summary, view: o.describeView(), part: o.selectedPart(), live: o.collectReadouts(), working: o.collectWorking() }`, { route, part, inside })
fs.writeFileSync(out, JSON.stringify(ctx, null, 1))
console.log(JSON.stringify(ctx).slice(0, 1200))
await s.browser.close()
