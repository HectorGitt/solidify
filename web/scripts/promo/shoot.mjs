// Shoot the promo's 3D footage from the dev server (npx vite --host 127.0.0.1 --port 4173):
//   node scripts/promo/shoot.mjs <outdir> [shot,shot,…]
// Every shot is a real scene, stepped in sim time at 60 fps with a scripted camera.
import path from 'node:path'
import { launch, ease, lerp, clamp01, FPS } from './lib.mjs'

const OUT = path.resolve(process.argv[2])
const only = process.argv[3] ? process.argv[3].split(',') : null
const seg = (u, a, b) => clamp01((u - a) / (b - a))

const MONTAGE = ['implements/combine', 'powertrain/torque-converter', 'implements/sprayer', 'hydraulics/pumps', 'steering/boxes', 'powertrain/differential', 'engine/diesel-fuel', 'traction/tracks', 'powertrain/planetary', 'implements/mower-baler', 'hydraulics/three-point', 'implements/mouldboard']

/** the tractor-types turntable spins the tractor away from the section plane: stop it and square it up */
async function stopTurntable(s) {
  await s.js(`const m = await import('/src/modules/chassis/tractor-types/model.ts'); m.useTypes.getState().set({ spin: false })`)
  await s.dev(`const done = new Set(); scene.traverse((o) => {
    if (!o.isMesh || !o.userData || !o.userData.partId || o.userData.partId === 'platform') return
    for (let p = o.parent; p && p !== scene; p = p.parent) if (!done.has(p) && p.isGroup && Math.abs(p.rotation.y) > 1e-4 && p.rotation.x === 0 && p.rotation.z === 0) { done.add(p); p.rotation.y = 0 }
  }); return done.size`)
}

const SHOTS = {
  // cold open, dark theme: four pistons firing in section, the camera drifting in
  cold: { theme: 'dark', route: 'engine/multi-cylinder', n: 230, rig: { az: [-30, -8], el: [-4, 4], dist: [0.62, 0.46], aim: [[0, 0.1, 0], [0, 0.14, 0]] } },
  // the whole tractor, the section plane sweeping in from the near side
  tractor: {
    route: 'chassis/tractor-types', hide: ['platform'], before: stopTurntable, n: 340, rig: { az: [-26, 4], el: [3, 0], dist: [0.98, 0.8], aim: [[0, 0, 0], [0, -0.1, 0]] },
    // the section opens in the first 1.7 s, so the engine is exposed for most of the title
    each: (s, u) => s.view(`v.setPlane(0, { pos: ${lerp(1.7, 0, ease.io(seg(u, 0, 0.3)))} })`),
  },
  // a 16-speed gearbox in section, parts tracked for callouts
  gearbox: {
    route: 'powertrain/mf-16-speed', n: 340, rig: { az: [-22, 14], el: [0, 4], dist: [1.08, 0.92] },
    each: (s, u) => s.view(`v.setPlane(0, { pos: ${lerp(0.32, 0, ease.out(seg(u, 0, 0.35)))} })`),
    track: ['synchros', 'ss-carrier', 'layshaft', 'crown'],
  },
  // real speed, ramping down to 1/200
  // the whole tractor turns to x-ray and the camera pushes in to the engine while it slows to 1/200
  slowmo: {
    route: 'chassis/tractor-types', hide: ['platform'], n: 340,
    before: async (s) => { await stopTurntable(s); await s.view(`v.setCut({ enabled: false })`) },
    // engine centre in the tractor frame ≈ (0.51, 0.76, 0); the opening target is (0, 1, 0)
    rig: { az: [-24, 18], el: [4, 12], dist: [0.95, 0.21], aim: [[0, 0, 0], [0.51, -0.24, 0]], e: ease.io },
    each: (s, u) => s.view(`if (v.xray !== ${u >= 0.18}) v.setXray(${u >= 0.18})`),
    step: (u) => Math.exp(lerp(Math.log(1 / FPS), Math.log(1 / (200 * FPS)), ease.io(seg(u, 0.3, 0.75)))),
  },
  // the whole tractor taken apart
  explode: {
    route: 'chassis/tractor-types', hide: ['platform'], n: 340,
    before: async (s) => { await stopTurntable(s); await s.view(`v.setCut({ enabled: false })`) },
    rig: { az: [-30, 22], el: [2, 8], dist: [1.0, 0.92] },
    each: (s, u) => s.view(`v.setExplode(${lerp(0, 1, ease.io(seg(u, 0.1, 0.6)))})`),
  },
  // the traction lab working in the field
  traction: { route: 'traction/traction-lab', n: 390, rig: { az: [-12, 8], el: [0, 3], dist: [1, 0.86] } },
  // end card plate: the tractor in section from the rear quarter
  end: {
    route: 'chassis/tractor-types', hide: ['platform'], before: stopTurntable, n: 360, rig: { az: [118, 142], el: [4, 2], dist: [0.95, 0.86] },
    each: (s) => s.view(`v.setPlane(0, { pos: 0 })`),
  },
}
for (const [i, r] of MONTAGE.entries()) SHOTS['m' + String(i).padStart(2, '0')] = { route: r, n: 52, rig: { az: [-9, 9], el: [0, 2], dist: [1, 0.9], e: ease.lin } }

const byTheme = {}
for (const [k, v] of Object.entries(SHOTS)) if (!only || only.includes(k) || (only.includes('montage') && /^m\d\d$/.test(k))) (byTheme[v.theme ?? 'light'] ??= []).push([k, v])

for (const [theme, shots] of Object.entries(byTheme)) {
  const s = await launch({ theme })
  for (const [name, shot] of shots) {
    console.log(name, shot.route)
    try {
      await s.open(shot.route)
      // the tractor's engine detail arrives well after the scene reports ready
      await s.page.waitForTimeout(15000)
      if (shot.before) await shot.before(s)
      if (shot.hide) await s.view(`for (const id of ${JSON.stringify(shot.hide)}) if (!v.hidden.includes(id)) v.toggleHidden(id)`)
      await s.page.waitForTimeout(500)
      const cam = await s.rig(shot.rig)
      await s.clip(path.join(OUT, name), shot.n, {
        each: async (u, i) => {
          if (shot.each) await shot.each(s, u, i)
          await cam(u)
        },
        step: shot.step,
        track: shot.track,
      })
    } catch (e) {
      console.log('  FAILED', e.message.slice(0, 200))
    }
  }
  await s.browser.close()
}
