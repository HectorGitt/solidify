import * as THREE from 'three'
import { box, cylinder, extrude, gear, lathe, mat4, merge, pipe, roundedBox, tube, xform } from '@/geometry'
import { bevelGear, bevelPair, rim, splineShaft, torus, tyre } from '@/geometry/parts'
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
export const GEARBOX = { module: 0.005, centre: 0.15, input: [20, 40] as const, selected: [32, 28] as const }

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
  const ch = 0.07
  const s = new THREE.Shape()
  s.moveTo(-hw, y0)
  s.lineTo(-hw, top - ch)
  s.lineTo(-hw + ch, top)
  s.lineTo(hw - ch, top)
  s.lineTo(hw, top - ch)
  s.lineTo(hw, y0)
  s.lineTo(hw - t, y0)
  s.lineTo(hw - t, top - ch - t * 0.4)
  s.lineTo(hw - ch - t * 0.4, top - t)
  s.lineTo(-hw + ch + t * 0.4, top - t)
  s.lineTo(-hw + t, top - ch - t * 0.4)
  s.lineTo(-hw + t, y0)
  s.closePath()
  const len = 1.28
  const g = extrude(s, len)
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

export function buildTractorGeometry() {
  // ------------------------------------------------------------ wheels (local, axis Z)
  const rearTyre = zAxis(tyre({ radius: R.radius, width: R.width, rimRadius: R.rimRadius, lugs: 23, lugAngleDeg: 45, pattern: 'R1' }))
  const rearRim = zAxis(rim(R.rimRadius, R.width * 0.86, 0.11, 0.07))
  const frontTyre = zAxis(tyre({ radius: F.radius, width: F.width, rimRadius: F.rimRadius, pattern: 'F2' }))
  const frontRim = zAxis(rim(F.rimRadius, F.width * 0.8, 0.065, 0.035))

  // ------------------------------------------------------------ engine (housings)
  const block = shellBox(0.9, 0.5, 0.42, 0.03, 0.03, 1.27, 0.8) // x 0.82–1.72, y 0.55–1.05
  const sump = shellBox(0.8, 0.12, 0.36, 0.02, 0.008, 1.27, 0.49)
  const head = roundedBox(0.86, 0.12, 0.38, 0.02)
  head.translate(1.27, 1.11, 0)
  const timingCover = roundedBox(0.08, 0.5, 0.4, 0.03)
  timingCover.translate(1.76, 0.78, 0)
  const bonnet = bonnetShell()
  const grille = box(0.03, 0.42, 0.64)
  grille.translate(2.055, 1.19, 0)
  const radiator = box(0.07, 0.36, 0.5)
  radiator.translate(1.96, 1.16, 0)
  const bolster = box(0.3, 0.17, 0.34)
  bolster.translate(1.92, 0.535, 0)
  const exhaust = pipe(
    new THREE.CatmullRomCurve3([new THREE.Vector3(1.45, 1.16, 0.16), new THREE.Vector3(1.45, 1.45, 0.2), new THREE.Vector3(1.45, 2.02, 0.2)]),
    0.034,
    0.028,
    32,
    16,
  )
  const airCleaner = cylinder(0.065, 0.4, 28)
  airCleaner.translate(1.2, 1.62, -0.18)
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
  const gearbox = shellBox(0.32, 0.5, 0.46, 0.03, 0.022, 0.36, DRIVE_Y - 0.06) // x 0.20–0.52
  const centre = shellBox(0.4, 0.56, 0.56, 0.04, 0.025, 0, DRIVE_Y) // x −0.20–0.20, y 0.36–0.92
  const liftCover = roundedBox(0.36, 0.13, 0.5, 0.02)
  liftCover.translate(-0.04, 0.985, 0)
  const trumpets = merge(
    ...[1, -1].map((s) => {
      const t = zAxis(lathe([[0.065, 0], [0.13, 0], [0.085, 0.08], [0.085, REAR_Z - R.width / 2 - 0.36], [0.11, REAR_Z - R.width / 2 - 0.3], [0.11, REAR_Z - R.width / 2 - 0.28], [0.065, REAR_Z - R.width / 2 - 0.28]], 40))
      if (s < 0) t.rotateY(PI)
      t.translate(0, AXLE_Y, s * 0.28)
      return t
    }),
  )
  const topLinkBracket = box(0.3, 0.12, 0.14)
  topLinkBracket.translate(-0.35, LINKAGE.topPivot.y, 0)
  const lowerBrackets = merge(
    ...[1, -1].map((s) => {
      const b = box(0.08, 0.14, 0.05)
      b.translate(LINKAGE.lowerPivot.x - 0.02, LINKAGE.lowerPivot.y + 0.03, s * (LINKAGE.lowerPivot.z + 0.045))
      return b
    }),
  )
  const drawbar = box(0.48, 0.035, 0.1)
  drawbar.translate(-0.43, TRACTOR.drawbar.y, 0)
  const drawbarHanger = box(0.06, 0.12, 0.1)
  drawbarHanger.translate(-0.23, TRACTOR.drawbar.y + 0.06, 0)
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

  // ------------------------------------------------------------ front axle (static beam)
  const axleBeam = box(0.12, 0.1, 2 * KINGPIN_Z - 0.04)
  axleBeam.translate(1.88, FRONT_Y, 0)
  /** knuckle (local, kingpin axis Y through origin) */
  const knuckle = merge(cylinder(0.04, 0.22, 20), xform(zAxis(cylinder(0.03, 0.12, 20)), mat4.t(0, -0.06, 0.06)))

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
  const clutchDisc = xAxis(tube(0.2, 0.06, 0.02, 48))
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
    grille,
    radiator,
    bolster,
    exhaust,
    airCleaner: merge(airCleaner, preCleaner),
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
    knuckle,
    crank,
    flywheel,
    clutchDisc,
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
  }
}

export type TractorGeometry = ReturnType<typeof buildTractorGeometry>

let cache: TractorGeometry | null = null
/** Built once and shared by every scene that shows the tractor. */
export function tractorGeometry() {
  return (cache ??= buildTractorGeometry())
}
