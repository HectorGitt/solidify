import * as THREE from 'three'
import { box, cylinder, extrude, gear, lathe, mat4, merge, pipe, roundedBox, tube, xform } from '@/geometry'
import { bevelGear, bevelPair, splineShaft, torus } from '@/geometry/parts'
import { FARMLAND_FRONT, FARMLAND_REAR, wheel } from '@/parts/lib/wheels'
import { frontAxle, frontSupport, intakeStack, steeringKnuckle } from '@/parts/lib/chassis'
import { clutchDisc, clutchDiscThickness } from '@/parts/lib/driveline'
import { LINKAGE, TRACTOR } from './dims'

/**
 * Main-thread geometry for the shared tractor (no CSG, so it builds in a few ms).
 * Frame as in dims.ts: +X forward, Y up, +Z right, origin on the ground under the rear axle.
 * Moving parts are built in their own local frames (noted per item) and placed by Tractor.tsx.
 */

const { PI } = Math
const R = TRACTOR.rear
const F = TRACTOR.front

/** Driveline centre height (the rear axle). */
export const AXLE_Y = 0.64
export const FRONT_Y = 0.38
export const DRIVE_Y = AXLE_Y
/** PTO stub: rear face of the centre housing; the splined stub projects 0.1 m behind it */
export const PTO_Y = TRACTOR.pto.y
export const PTO_STUB_X = -0.2
export const REAR_Z = R.track / 2
export const FRONT_Z = F.track / 2
export const KINGPIN_Z = FRONT_Z - 0.09

/** Crown wheel / pinion (straight bevel stand-ins for the spiral bevel set). */
export const CROWN = { teeth: 37, pinion: 9, module: 0.006 }
/** Gearbox: input constant-mesh pair and one selected pair (x-ray illustration). */
/** layshaft 140 mm below the input, level with the PTO stub (the PTO is taken off the layshaft); every pair sums to 60 teeth */
export const GEARBOX = { module: (2 * 0.14) / 60, centre: 0.14, input: [20, 40] as const, selected: [32, 28] as const }

/** Closed solid with a cavity: outer shell plus the inner shell turned inside out. */
export function hollow(outer: THREE.BufferGeometry, inner: THREE.BufferGeometry) {
  const g = inner.index ? inner.toNonIndexed() : inner.clone()
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const a = pos.array as Float32Array
  for (let i = 0; i < a.length; i += 9) {
    for (let k = 0; k < 3; k++) {
      const t = a[i + 3 + k]
      a[i + 3 + k] = a[i + 6 + k]
      a[i + 6 + k] = t
    }
  }
  pos.needsUpdate = true
  return merge(outer, g)
}

/** Rounded box shell with wall thickness t, centred at (x, y, z). */
function shellBox(w: number, h: number, d: number, r: number, t: number, x: number, y: number, z = 0) {
  const g = hollow(roundedBox(w, h, d, r), roundedBox(w - 2 * t, h - 2 * t, d - 2 * t, Math.max(0.004, r - t)))
  g.translate(x, y, z)
  return g
}

function zAxis(g: THREE.BufferGeometry) {
  g.rotateX(PI / 2)
  return g
}
function xAxis(g: THREE.BufferGeometry) {
  g.rotateZ(-PI / 2)
  return g
}

function bonnetShell() {
  // Π-section sheet metal (open underneath) swept along X
  const hw = 0.33
  const t = 0.012
  const y0 = 0.98
  const top = 1.42
  // rounded crown: large-radius shoulders instead of a chamfer
  const rc = 0.12
  const s = new THREE.Shape()
  s.moveTo(-hw, y0)
  s.lineTo(-hw, top - rc)
  s.quadraticCurveTo(-hw, top, -hw + rc, top)
  s.lineTo(hw - rc, top)
  s.quadraticCurveTo(hw, top, hw, top - rc)
  s.lineTo(hw, y0)
  s.lineTo(hw - t, y0)
  s.lineTo(hw - t, top - rc)
  s.quadraticCurveTo(hw - t, top - t, hw - rc, top - t)
  s.lineTo(-hw + rc, top - t)
  s.quadraticCurveTo(-hw + t, top - t, -hw + t, top - rc)
  s.lineTo(-hw + t, y0)
  s.closePath()
  const len = 1.28
  const g = extrude(s, len, { curveSegments: 10 })
  g.rotateY(PI / 2)
  g.translate(0.76 + len / 2, 0, 0)
  return g
}

function fender(side: 1 | -1) {
  const r0 = R.radius + 0.07
  const t = 0.01
  const a0 = (12 * PI) / 180
  const a1 = (168 * PI) / 180
  const s = new THREE.Shape()
  s.absarc(0, 0, r0 + t, a0, a1, false)
  s.absarc(0, 0, r0, a1, a0, true)
  s.closePath()
  const outer = extrude(s, R.width + 0.1, { curveSegments: 48 })
  // inner side plate (towards the operator) — a flat half-disc ring segment
  const p = new THREE.Shape()
  p.absarc(0, 0, r0 + t, a0, a1, false)
  p.lineTo(-(r0 + t) * 0.9, 0.08)
  p.lineTo((r0 + t) * 0.9, 0.08)
  p.closePath()
  const plate = extrude(p, 0.008)
  plate.translate(0, 0, -side * ((R.width + 0.1) / 2 + 0.0045))
  return xform(merge(outer, plate), mat4.t(0, AXLE_Y, side * REAR_Z))
}

function ropsFrame() {
  const xr = -0.42
  const zs = 0.4
  const top = 2.25
  const pts = [
    new THREE.Vector3(xr, 0.95, -zs),
    new THREE.Vector3(xr, top - 0.12, -zs),
    new THREE.Vector3(xr, top - 0.02, -zs + 0.04),
    new THREE.Vector3(xr, top, -zs + 0.12),
    new THREE.Vector3(xr, top, zs - 0.12),
    new THREE.Vector3(xr, top - 0.02, zs - 0.04),
    new THREE.Vector3(xr, top - 0.12, zs),
    new THREE.Vector3(xr, 0.95, zs),
  ]
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  return pipe(curve, 0.04, 0.032, 96, 18)
}

/** Link of length `l` along +X from the origin (forged bar with eyes). */
function link(l: number, w: number, t: number, eye: number) {
  const bar = box(l, w, t)
  bar.translate(l / 2, 0, 0)
  const e0 = zAxis(tube(eye, eye * 0.45, t * 1.2, 24))
  const e1 = xform(e0, mat4.t(l, 0, 0))
  return merge(bar, e0, e1)
}

/** Top link turnbuckle along +X, length l. */
function topLink(l: number) {
  const body = xAxis(cylinder(0.026, l * 0.5, 24))
  body.translate(l / 2, 0, 0)
  const rodA = xAxis(cylinder(0.016, l * 0.3, 16))
  rodA.translate(l * 0.15 + 0.02, 0, 0)
  const rodB = xform(rodA, mat4.t(l * 0.7 - 0.04, 0, 0))
  const e0 = zAxis(tube(0.03, 0.013, 0.04, 24))
  const e1 = xform(e0, mat4.t(l, 0, 0))
  return merge(body, rodA, rodB, e0, e1)
}

/* ------------------------------ detail (closed solids, standing proud of what they sit on) ------------------------------ */

/** lamp facing +X: housing cup and lens, front face at x = 0 */
function lamp(r: number, depth: number) {
  const housing = lathe([[0, -depth], [r * 0.7, -depth], [r, -depth * 0.3], [r, 0], [r * 0.86, 0], [r * 0.86, -depth * 0.25], [0, -depth * 0.25]], 24)
  const lens = lathe([[0, -depth * 0.25], [r * 0.86, -depth * 0.25], [r * 0.84, -depth * 0.1], [0, -depth * 0.05]], 24)
  return { housing: housing.rotateZ(-PI / 2), lens: lens.rotateZ(-PI / 2) }
}

function detailGeometry() {
  // nose: dark backing, bars, chrome surround, headlamps, badge
  const nx = 2.042
  const grilleBack = box(0.012, 0.4, 0.58)
  grilleBack.translate(nx + 0.006, 1.19, 0)
  const bars: THREE.BufferGeometry[] = []
  for (let i = 0; i < 6; i++) bars.push(xform(box(0.022, 0.016, 0.54), mat4.t(nx + 0.023, 1.02 + i * 0.036, 0)))
  const frame = merge(
    // bars overlap into each other (no edges shared), so the merged surround stays a clean solid
    xform(box(0.03, 0.03, 0.6), mat4.t(nx + 0.018, 1.405, 0)),
    xform(box(0.03, 0.03, 0.6), mat4.t(nx + 0.018, 0.985, 0)),
    xform(box(0.032, 0.452, 0.03), mat4.t(nx + 0.018, 1.195, 0.305)),
    xform(box(0.032, 0.452, 0.03), mat4.t(nx + 0.018, 1.195, -0.305)),
  )
  const lamps = [1, -1].map((sz) => {
    const l = lamp(0.055, 0.05)
    l.housing.translate(nx + 0.05, 1.3, sz * 0.19)
    l.lens.translate(nx + 0.05, 1.3, sz * 0.19)
    return l
  })
  const badge = roundedBox(0.16, 0.06, 0.012, 0.01)
  badge.rotateY(PI / 2)
  badge.translate(nx + 0.03, 1.3, 0)
  // bonnet side louvres and pinstripe (stand proud of the panel)
  const hw = 0.33
  const louvres: THREE.BufferGeometry[] = []
  for (const sz of [1, -1]) for (let i = 0; i < 5; i++) louvres.push(xform(box(0.16, 0.014, 0.008), mat4.t(1.62, 1.1 + i * 0.032, sz * (hw + 0.004))))
  const stripe = merge(...[1, -1].map((sz) => xform(box(1.18, 0.028, 0.006), mat4.t(1.36, 1.3, sz * (hw + 0.003)))))
  // exhaust: manifold pipe, muffler, tailpipe (tip at y 2.06, where the smoke leaves)
  const exPipe = merge(
    pipe(new THREE.CatmullRomCurve3([new THREE.Vector3(1.45, 1.16, 0.16), new THREE.Vector3(1.45, 1.4, 0.2), new THREE.Vector3(1.45, 1.53, 0.2)]), 0.034, 0.026, 24, 14),
    xform(cylinder(0.03, 0.24, 18), mat4.t(1.45, 1.94, 0.2)),
  )
  const muffler = lathe([[0.028, 1.5], [0.034, 1.5], [0.066, 1.53], [0.066, 1.8], [0.034, 1.84], [0.028, 1.84]], 28)
  muffler.translate(1.45, 0, 0.2)
  // instrument pod and gauges (facing the driver, towards -X)
  const pod = roundedBox(0.1, 0.13, 0.38, 0.03)
  pod.translate(0.37, 1.335, 0)
  const bezels: THREE.BufferGeometry[] = []
  const faces: THREE.BufferGeometry[] = []
  for (const z of [-0.11, 0, 0.11]) {
    const b = tube(0.042, 0.032, 0.012, 24)
    b.rotateZ(PI / 2)
    b.translate(0.314, 1.34, z)
    bezels.push(b)
    const fc = cylinder(0.032, 0.006, 24)
    fc.rotateZ(PI / 2)
    fc.translate(0.317, 1.34, z)
    faces.push(fc)
  }
  // seat bolsters and armrests, fuel filler
  const seatSides = merge(
    ...[1, -1].map((sz) => xform(roundedBox(0.4, 0.09, 0.06, 0.025), mat4.t(-0.08, 1.31, sz * 0.205))),
    ...[1, -1].map((sz) => xform(roundedBox(0.32, 0.05, 0.07, 0.02), mat4.t(-0.06, 1.45, sz * 0.27))),
    ...[1, -1].map((sz) => xform(box(0.04, 0.16, 0.04), mat4.t(-0.18, 1.36, sz * 0.27))),
  )
  const filler = merge(xform(cylinder(0.038, 0.035, 20), mat4.t(0.6, 1.385, 0.15)), xform(cylinder(0.045, 0.015, 20), mat4.t(0.6, 1.41, 0.15)))
  // tail lights on the fenders; hoses down to the rear remote couplers
  const fz = REAR_Z + (R.width + 0.1) / 2
  const tail = merge(...[1, -1].map((sz) => xform(roundedBox(0.09, 0.05, 0.03, 0.01), mat4.t(-0.62, AXLE_Y + 0.4, sz * (fz + 0.016)))))
  const hoses: THREE.BufferGeometry[] = []
  const couplers: THREE.BufferGeometry[] = []
  for (const sz of [1, -1]) {
    for (const dz of [0, 0.07]) {
      const z = sz * (0.12 + dz)
      hoses.push(pipe(new THREE.CatmullRomCurve3([new THREE.Vector3(0.0, 1.06, z), new THREE.Vector3(-0.14, 1.06, z), new THREE.Vector3(-0.26, 0.96, z), new THREE.Vector3(-0.27, 0.88, z)]), 0.011, 0, 20, 8))
      couplers.push(xform(xAxis(cylinder(0.016, 0.06, 12)), mat4.t(-0.27, 0.86, z)), xform(xAxis(cylinder(0.02, 0.02, 12)), mat4.t(-0.31, 0.86, z)))
    }
  }
  // wheel hardware (local wheel frames, outer face +Z)
  // wheel nuts and hub caps come with the shared wheels (parts library)
  const rearHub = wheel(FARMLAND_REAR).hub!
  const frontHub = wheel(FARMLAND_FRONT).hub!
  // ROPS work lights and beacon
  const wl = [1, -1].map((sz) => {
    const l = lamp(0.04, 0.05)
    l.housing.translate(-0.36, 2.19, sz * 0.3)
    l.lens.translate(-0.36, 2.19, sz * 0.3)
    return l
  })
  const brackets = merge(...[1, -1].map((sz) => xform(box(0.06, 0.03, 0.03), mat4.t(-0.42, 2.19, sz * 0.3))))
  const beacon = lathe([[0, 2.29], [0.045, 2.29], [0.045, 2.31], [0.038, 2.36], [0, 2.38]], 20)
  beacon.translate(-0.42, 0, -0.26)
  return {
    grilleBack,
    grilleBars: merge(...bars),
    grilleFrame: frame,
    lampHousings: merge(lamps[0].housing, lamps[1].housing),
    lampLenses: merge(lamps[0].lens, lamps[1].lens),
    badge,
    louvres: merge(...louvres),
    stripe,
    exPipe,
    muffler,
    pod,
    bezels: merge(...bezels),
    gaugeFaces: merge(...faces),
    seatSides,
    filler,
    tail,
    hoses: merge(...hoses),
    couplers: merge(...couplers),
    rearHub,
    frontHub,
    workLights: merge(wl[0].housing, wl[1].housing, brackets),
    workLenses: merge(wl[0].lens, wl[1].lens),
    beacon,
    cab: cabGeometry(),
  }
}

/** Optional enclosed cab, in place of the ROPS: posts, roof, rails and glass. */
function cabGeometry() {
  const x0 = -0.56
  const x1 = 0.46
  const hz = 0.455
  const y0 = 0.98
  const y1 = 2.28
  const posts = merge(...[x0, x1].flatMap((x) => [1, -1].map((sz) => xform(roundedBox(0.06, y1 - y0, 0.06, 0.02), mat4.t(x, (y0 + y1) / 2, sz * hz)))))
  const roof = roundedBox(x1 - x0 + 0.16, 0.1, 2 * hz + 0.14, 0.04)
  roof.translate((x0 + x1) / 2, y1 + 0.05, 0)
  const rails = merge(...[1, -1].map((sz) => xform(box(x1 - x0 - 0.06, 0.04, 0.04), mat4.t((x0 + x1) / 2, y0 + 0.42, sz * hz))))
  const t = 0.008
  const h = y1 - y0 - 0.06
  const glass = merge(
    xform(box(t, h, 2 * hz - 0.07), mat4.t(x1, (y0 + y1) / 2, 0)),
    xform(box(t, h, 2 * hz - 0.07), mat4.t(x0, (y0 + y1) / 2, 0)),
    ...[1, -1].map((sz) => xform(box(x1 - x0 - 0.07, h, t), mat4.t((x0 + x1) / 2, (y0 + y1) / 2, sz * hz))),
  )
  const lights = merge(...[1, -1].map((sz) => xform(roundedBox(0.05, 0.05, 0.12, 0.015), mat4.t(x1 + 0.07, y1 + 0.03, sz * 0.3))))
  return { posts, roof, rails, glass, lights }
}

export function buildTractorGeometry() {
  // ------------------------------------------------------------ wheels (local, axis Z)
  // the shared wheels: the library's Farmland presets are this tractor's 14.9-28 and 7.50-16
  const rearTyre = wheel(FARMLAND_REAR).tyre
  const rearRim = wheel(FARMLAND_REAR).rim
  const frontTyre = wheel(FARMLAND_FRONT).tyre
  const frontRim = wheel(FARMLAND_FRONT).rim

  // ------------------------------------------------------------ engine (housings)
  // sized to the real four-cylinder (EngineDetail): crank centre at x = 1.1, 0.6 m long
  const block = shellBox(0.6, 0.5, 0.42, 0.03, 0.03, 1.1, 0.8) // x 0.80–1.40, y 0.55–1.05
  const sump = shellBox(0.56, 0.12, 0.36, 0.02, 0.008, 1.1, 0.49)
  const head = roundedBox(0.58, 0.12, 0.38, 0.02)
  head.translate(1.1, 1.11, 0)
  const timingCover = roundedBox(0.08, 0.5, 0.4, 0.03)
  timingCover.translate(1.44, 0.78, 0)
  const bonnet = bonnetShell()
  const radiator = box(0.07, 0.36, 0.5)
  radiator.translate(1.96, 1.16, 0)
  // cast front support under the radiator, carrying the axle pivot (parts library)
  // its neck runs back under the crank pulley and bolts to the front of the sump: the engine is the frame
  const fs = frontSupport({ l: 0.3, h: 0.17, w: 0.34, neck: { l: 1.77 - 1.385, h: 0.105, dy: 0.5025 - 0.535 } })
  const atSupport = mat4.t(1.92, 0.535, 0)
  const bolster = xform(fs.body, atSupport)
  const bolsterSteel = xform(merge(fs.bolts, fs.eye), atSupport)
  // air-intake stack up through the bonnet (pre-cleaner on top)
  const st = intakeStack({ r: 0.065, length: 0.4 })
  const atStack = mat4.t(1.2, 1.42, -0.18)
  const airCleaner = xform(merge(st.pipe, st.collar), atStack)
  const airCleanerBands = xform(st.bands, atStack)
  const preCleaner = lathe(
    [
      [0.02, 1.82],
      [0.08, 1.84],
      [0.08, 1.92],
      [0.02, 1.94],
    ],
    28,
  )
  preCleaner.translate(1.2, 0, -0.18)

  // ------------------------------------------------------------ transmission housings
  const clutchHousing = xAxis(lathe([[0.16, -0.15], [0.27, -0.15], [0.27, 0.15], [0.25, 0.15], [0.25, -0.13], [0.16, -0.13]], 48))
  clutchHousing.translate(0.67, DRIVE_Y, 0) // x 0.52–0.82
  const gearbox = shellBox(0.32, 0.46, 0.46, 0.03, 0.022, 0.36, 0.56) // x 0.20–0.52, y 0.33–0.79
  const centre = shellBox(0.4, 0.47, 0.56, 0.04, 0.025, 0, 0.555) // x −0.20–0.20, y 0.32–0.79 (the hydraulic pump sits low inside)
  // the lift cover is a hollow casting on the centre housing and gearbox: the control valve, the ram on
  // its front pivot and the crank arm all work inside it, the rockshaft runs across it
  const liftCover = shellBox(0.72, 0.25, 0.5, 0.02, 0.014, 0, 0.915) // x −0.36–0.36, y 0.79–1.04
  const trumpets = merge(
    ...[1, -1].map((s) => {
      const t = zAxis(lathe([[0.065, 0], [0.13, 0], [0.085, 0.08], [0.085, REAR_Z - R.width / 2 - 0.36], [0.11, REAR_Z - R.width / 2 - 0.3], [0.11, REAR_Z - R.width / 2 - 0.28], [0.065, REAR_Z - R.width / 2 - 0.28]], 40))
      if (s < 0) t.rotateY(PI)
      t.translate(0, AXLE_Y, s * 0.28)
      return t
    }),
  )
  // top-link bracket: a clevis on the back of the lift cover, its two cheeks either side of the pin
  const tp = LINKAGE.topPivot
  const topLinkBracket = merge(
    xform(box(0.02, 0.15, 0.16), mat4.t(-0.37, tp.y, 0)),
    ...[1, -1].map((sz) => xform(box(0.36 - (tp.x - 0.04), 0.12, 0.022), mat4.t((tp.x - 0.04 - 0.36) / 2, tp.y, sz * 0.05))),
    xform(zAxis(cylinder(0.016, 0.14, 16)), mat4.t(tp.x, tp.y, 0)),
  )
  const lowerBrackets = merge(
    ...[1, -1].map((s) => {
      const b = box(0.08, 0.14, 0.05)
      b.translate(LINKAGE.lowerPivot.x - 0.02, LINKAGE.lowerPivot.y + 0.03, s * (LINKAGE.lowerPivot.z + 0.045))
      return b
    }),
  )
  // from the hanger straps back to the pin
  const drawbar = box(0.45, 0.035, 0.1)
  drawbar.translate(-0.445, TRACTOR.drawbar.y, 0)
  // drawbar hanger: a strap each side, clear of the PTO shaft that runs out between them
  const drawbarHanger = merge(...[1, -1].map((sz) => xform(box(0.06, 0.12, 0.02), mat4.t(-0.23, TRACTOR.drawbar.y + 0.06, sz * 0.045))))
  const ptoShield = (() => {
    const s = new THREE.Shape()
    s.absarc(0, 0, 0.12, 0, PI, false)
    s.absarc(0, 0, 0.11, PI, 0, true)
    s.closePath()
    const g = extrude(s, 0.18)
    g.rotateY(PI / 2)
    g.translate(PTO_STUB_X - 0.09, PTO_Y, 0)
    return g
  })()

  // ------------------------------------------------------------ operator station
  const platform = merge(
    ...[1, -1].map((s) => {
      const p = box(0.7, 0.025, 0.24)
      p.translate(0.25, 0.56, s * 0.42)
      return p
    }),
  )
  const fenders = merge(fender(1), fender(-1))
  const tank = roundedBox(0.3, 0.36, 0.5, 0.05)
  tank.translate(0.6, 1.19, 0)
  const dash = roundedBox(0.12, 0.3, 0.46, 0.03)
  dash.translate(0.39, 1.14, 0)
  const seatPan = roundedBox(0.42, 0.08, 0.46, 0.035)
  seatPan.translate(-0.08, 1.24, 0)
  const seatBack = roundedBox(0.08, 0.36, 0.44, 0.035)
  seatBack.rotateZ(0.18)
  seatBack.translate(-0.3, 1.44, 0)
  const seatPost = xform(cylinder(0.035, 0.18, 20), mat4.t(-0.08, 1.11, 0))
  const column = (() => {
    const c = cylinder(0.03, 0.4, 20)
    c.rotateZ(0.62)
    c.translate(0.29, 1.46, 0)
    return c
  })()
  const wheelRing = torus(0.2, 0.014, 10, 48)
  const spokes = merge(
    ...[0, (2 * PI) / 3, (4 * PI) / 3].map((a) => {
      const b = box(0.19, 0.016, 0.012)
      b.translate(0.095, 0, 0)
      b.rotateZ(a)
      return b
    }),
  )
  const steeringWheel = merge(wheelRing, spokes)
  steeringWheel.rotateX(-PI / 2)
  steeringWheel.rotateZ(0.62)
  steeringWheel.translate(0.18, 1.62, 0)
  const rops = ropsFrame()

  // ------------------------------------------------------------ front axle (telescopic beam) and knuckles
  // pivot brackets up to the front support's underside; radius rods back to a ball under the clutch housing
  const fa = frontAxle({ kingpinZ: KINGPIN_Z, supportY: 0.45 - FRONT_Y, radiusRods: { z: 0.36, ball: new THREE.Vector3(0.82 - TRACTOR.wheelbase, 0.33 - FRONT_Y, 0) } })
  const onAxle = mat4.t(TRACTOR.wheelbase, FRONT_Y, 0)
  const axleBeam = xform(merge(fa.centre, fa.extensions, fa.lugs, fa.rods!), onAxle)
  const axleBolts = xform(merge(fa.bolts, fa.pin), onAxle)
  const axleHoles = xform(fa.holes, onAxle)
  /** knuckle (local, kingpin axis Y through origin, spindle towards +Z) */
  const sk = steeringKnuckle({ reach: FRONT_Z - KINGPIN_Z })
  const knuckle = sk.body
  const knuckleSteel = merge(sk.spindle, sk.nut, sk.kingpin, sk.thrust)

  // ------------------------------------------------------------ drivetrain internals (local frames)
  /** crankshaft along X, local origin on its axis at the front main bearing */
  const crank = (() => {
    const parts: THREE.BufferGeometry[] = [xform(xAxis(cylinder(0.032, 0.9, 24)), mat4.t(-0.45, 0, 0))]
    for (let i = 0; i < 4; i++) {
      const w = box(0.03, 0.15, 0.11)
      w.translate(-0.12 - i * 0.22, (i === 0 || i === 3 ? 1 : -1) * 0.045, 0)
      parts.push(w)
    }
    return merge(...parts)
  })()
  const flywheel = xAxis(lathe([[0.03, -0.035], [0.23, -0.035], [0.24, 0.035], [0.03, 0.035]], 48))
  // the library clutch disc (linings either side of a steel core on a splined hub), centred and turned on to X
  const cd = clutchDisc({ Ro: 0.2, Ri: 0.11, bore: 0.022, hubR: 0.05, hubZ0: -0.012, hubZ1: 0.02 })
  const cdT = clutchDiscThickness({})
  const onX = (g: THREE.BufferGeometry) => xAxis(g.translate(0, 0, -cdT / 2).rotateX(-PI / 2))
  const clutchLinings = onX(cd.linings)
  const clutchCore = onX(merge(cd.core, cd.hub))
  const m = GEARBOX.module
  const inputShaft = xform(xAxis(cylinder(0.022, 0.5, 20)), mat4.t(0.25, 0, 0)) // local x 0 → 0.5
  const gearAt = (teeth: number, width: number) => {
    const g = gear({ teeth, module: m, width, bore: 0.012 })
    g.rotateY(PI / 2)
    return g
  }
  const inputPinion = gearAt(GEARBOX.input[0], 0.03)
  const layGear = gearAt(GEARBOX.input[1], 0.03)
  const mainSelected = gearAt(GEARBOX.selected[0], 0.03)
  const laySelected = gearAt(GEARBOX.selected[1], 0.03)
  const layShaft = xform(xAxis(cylinder(0.018, 0.28, 20)), mat4.t(0, 0, 0))
  const { pinion: gp, gear: gg } = bevelPair(CROWN.pinion, CROWN.teeth)
  const crownR = (CROWN.teeth * CROWN.module) / 2
  const pinR = (CROWN.pinion * CROWN.module) / 2
  /** crown wheel: axis Z, apex at origin (the axle centre) */
  const crownWheel = (() => {
    const g = bevelGear({ teeth: CROWN.teeth, module: CROWN.module, faceWidth: 0.03, pitchAngleDeg: gg, bore: 0.05 })
    g.translate(0, 0, -crownR / Math.tan((gg * PI) / 180))
    return g
  })()
  /** pinion: axis X pointing back to the apex at origin */
  const pinion = (() => {
    const g = bevelGear({ teeth: CROWN.pinion, module: CROWN.module, faceWidth: 0.03, pitchAngleDeg: gp })
    g.translate(0, 0, -pinR / Math.tan((gp * PI) / 180))
    g.rotateY(-PI / 2)
    const shaft = xform(xAxis(cylinder(0.018, 0.2, 20)), mat4.t(pinR / Math.tan((gp * PI) / 180) + 0.1, 0, 0))
    return merge(g, shaft)
  })()
  const diffCage = zAxis(lathe([[0.03, -0.09], [0.075, -0.08], [0.085, 0], [0.075, 0.08], [0.03, 0.09]], 32))
  const halfShafts = zAxis(cylinder(0.03, 2 * REAR_Z - 0.2, 24))
  const ptoShaft = xform(xAxis(cylinder(0.016, 0.82, 16)), mat4.t(0.12, 0, 0))
  const ptoStub = (() => {
    const s = splineShaft(6, 0.0175, 0.0145, 0.1)
    s.rotateZ(PI / 2) // +Y → −X
    s.translate(-0.05, 0, 0)
    return s
  })()

  // ------------------------------------------------------------ linkage (local, along +X)
  const lower3D = Math.hypot(LINKAGE.lowerLength, LINKAGE.hitchSpread - LINKAGE.lowerPivot.z)
  const lowerLink = link(lower3D, 0.06, 0.03, 0.035)
  const topLinkG = topLink(LINKAGE.topLength)
  const liftArm = link(LINKAGE.liftArm, 0.07, 0.035, 0.04)
  const liftRod = link(LINKAGE.liftRod, 0.028, 0.028, 0.026)
  const rockshaft = zAxis(cylinder(0.035, 2 * LINKAGE.rockshaft.z + 0.06, 24))

  return {
    rearTyre,
    rearRim,
    frontTyre,
    frontRim,
    block,
    sump,
    head,
    timingCover,
    bonnet,
    radiator,
    bolster,
    bolsterSteel,
    airCleaner: merge(airCleaner, preCleaner),
    airCleanerBands,
    clutchHousing,
    gearbox,
    centre,
    liftCover,
    trumpets,
    brackets: merge(topLinkBracket, lowerBrackets, drawbarHanger),
    drawbar,
    ptoShield,
    platform,
    fenders,
    tank,
    dash,
    seat: merge(seatPan, seatBack),
    seatPost,
    column,
    steeringWheel,
    rops,
    axleBeam,
    axleBolts,
    axleHoles,
    knuckle,
    knuckleSteel,
    crank,
    flywheel,
    clutchDisc: clutchLinings,
    clutchCore,
    inputShaft,
    inputPinion,
    layGear,
    layShaft,
    mainSelected,
    laySelected,
    crownWheel,
    pinion,
    diffCage,
    halfShafts,
    ptoShaft,
    ptoStub,
    lowerLink,
    topLink: topLinkG,
    liftArm,
    liftRod,
    rockshaft,
    detail: detailGeometry(),
  }
}

export type TractorGeometry = ReturnType<typeof buildTractorGeometry>

let cache: TractorGeometry | null = null
/** Built once and shared by every scene that shows the tractor. */
export function tractorGeometry() {
  return (cache ??= buildTractorGeometry())
}
