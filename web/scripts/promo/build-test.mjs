// smoke test for build mode on the four-stroke engine
import { launch } from './lib.mjs'
const out = process.argv[2]
const s = await launch({ width: 1440, height: 900 })
const p = s.page
await p.goto('http://127.0.0.1:4173/#/m/engine/four-stroke-diesel')
await p.waitForFunction(() => !!window.__scene && !!document.querySelector('[aria-label^="Build it"]'), null, { timeout: 180000 })
await p.waitForTimeout(6000)
await p.click('[aria-label^="Build it"]')
await p.waitForTimeout(8000)
await p.screenshot({ path: `${out}/b1-tray.jpg`, type: 'jpeg', quality: 85 })
const at = (id) => s.js(`const { partObjects } = await import('/src/parts/registry.ts'); const THREE = window.__THREE; const st = window.__agriState; const o = partObjects.get('${id}'); const b = new THREE.Box3().setFromObject(o); const c = b.getCenter(new THREE.Vector3()).project(st.camera); const r = st.gl.domElement.getBoundingClientRect(); return [r.left + (c.x + 1) / 2 * r.width, r.top + (1 - c.y) / 2 * r.height]`)
const own = (id) => s.dev(`const b = new THREE.Box3(); scene.traverse((x) => { if (x.isMesh && x.userData && x.userData.partId === '${id}') b.expandByObject(x) }); const c = b.getCenter(new THREE.Vector3()).project(camera); const r = gl.domElement.getBoundingClientRect(); return [r.left + (c.x + 1) / 2 * r.width, r.top + (1 - c.y) / 2 * r.height]`)
const state = () => s.js(`const { useBuild } = await import('/src/render/build.ts'); const b = useBuild.getState(); return { placed: b.placed.length, msg: b.message && b.message.text, wrong: b.wrong, done: !!b.finishedAt }`)
const dragTo = async (from, to) => { await p.mouse.move(from[0], from[1]); await p.mouse.down(); await p.mouse.move(to[0], to[1], { steps: 15 }); await p.mouse.up(); await p.waitForTimeout(900) }
const block = await own('block')
await dragTo(await at('piston'), block)
console.log('piston early →', JSON.stringify(await state()))
await dragTo(await at('liner'), block)
console.log('liner →', JSON.stringify(await state()))
await p.screenshot({ path: `${out}/b2-liner.jpg`, type: 'jpeg', quality: 85 })
for (let i = 0; i < 25; i++) {
  const st = await state()
  if (st.done) break
  const id = await s.js(`const { useBuild, nextSteps } = await import('/src/render/build.ts'); const b = useBuild.getState(); return nextSteps(b.def, b.placed)[0]?.id`)
  const xy = await at(id)
  await p.mouse.click(xy[0], xy[1])
  await p.waitForTimeout(600)
  const after = await state()
  if (after.placed === st.placed) console.log('  tap on', id, 'missed →', after.msg)
}
await p.waitForTimeout(3000)
console.log('end →', JSON.stringify(await state()), '| playing:', await s.sim(`return useSim.getState().playing`))
await p.screenshot({ path: `${out}/b3-done.jpg`, type: 'jpeg', quality: 85 })
await s.browser.close()
