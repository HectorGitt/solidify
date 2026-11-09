// Audit: in every rig, every cut preset that sections moving parts: is any moving part removed entirely
// (its whole box on the removed side), so it vanishes instead of showing in section?
// A plane { normal n, pos p } keeps n·x <= p. Planes combine as a union of removed regions, or (intersection)
// remove only where every plane removes.
import { chromium } from 'playwright-core'
const [from = 0, to = 999] = process.argv.slice(2).map(Number)
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--use-angle=d3d11'] })
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } })
await page.route('**/solidify-api-6b27sr35hq-ew.a.run.app/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' }))
await page.goto('http://localhost:5179/#/labs', { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForTimeout(4000)
const routes = await page.evaluate(async () => {
  const mod = (re) => import(performance.getEntriesByType('resource').map((r) => r.name).findLast((n) => re.test(n)))
  const { MODULES } = await mod(/src\/modules\/catalog\.ts/)
  return MODULES.flatMap((m) => m.scenes.filter((s) => s.load).map((s) => `${m.id}/${s.id}`))
})
const only = process.argv[4]
const list = routes.slice(from, to).filter((r) => !only || r.startsWith(only))
const found = []
for (const r of list) {
  await page.evaluate((h) => (location.hash = `#/m/${h}`), r)
  await page.waitForTimeout(4500)
  const res = await page.evaluate(async () => {
    const mod = (re) => import(performance.getEntriesByType('resource').map((r) => r.name).findLast((n) => re.test(n)))
    const { useView } = await mod(/src\/render\/view\.ts/)
    const { partObjects, useParts } = await mod(/src\/parts\/registry\.ts/)
    const T = window.__THREE
    const presets = useView.getState().cutPresets ?? []
    const parts = useParts.getState().parts
    const out = []
    for (const pr of presets) {
      if (!pr.sectionMoving) continue
      for (const [id, o] of partObjects) {
        const role = parts[id]?.role
        if (role !== 'moving') continue
        const box = new T.Box3().setFromObject(o)
        if (box.isEmpty()) continue
        const corners = []
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push([x, y, z])
        const removedBy = (pl) => corners.every((c) => c[0] * pl.normal[0] + c[1] * pl.normal[1] + c[2] * pl.normal[2] > pl.pos + 1e-6)
        const gone = pr.intersection ? pr.planes.every(removedBy) : pr.planes.some(removedBy)
        if (gone) out.push(`${pr.id}: ${parts[id]?.name ?? id}`)
      }
    }
    return out
  })
  if (res.length) found.push(`${r}  ->  ${res.join('; ')}`)
}
console.log(`checked ${list.length} rigs (${from}..${from + list.length - 1} of ${routes.length})`)
console.log(found.length ? found.join('\n') : 'no moving part vanishes in any cutaway')
await browser.close()
