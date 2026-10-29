// node scripts/promo/measure.mjs <route> id… — x/y extents of each part in the scene (tractor frame for tractor scenes)
import { launch } from './lib.mjs'
const [route, ...ids] = process.argv.slice(2)
const s = await launch({ width: 960, height: 540 })
await s.open(route)
await s.page.waitForTimeout(15000)
const r = await s.dev(`const out = {}; const b = new THREE.Box3(); scene.updateMatrixWorld(true);
  for (const id of ${JSON.stringify(ids)}) { b.makeEmpty(); scene.traverse((o) => { if (o.isMesh && o.userData && o.userData.partId === id) b.expandByObject(o) }); if (!b.isEmpty()) out[id] = [b.min.x, b.max.x, b.min.y, b.max.y].map((v) => +v.toFixed(3)) }
  return out`)
for (const [k, [x0, x1, y0, y1]] of Object.entries(r).sort((a, b) => a[1][0] - b[1][0])) console.log(k.padEnd(26), 'x', String(x0).padStart(7), '…', String(x1).padStart(7), '  y', y0, '…', y1)
await s.browser.close()
