import { box, csg, cylinder, lathe, mat4, merge, tube, xform, type V2 } from '@/geometry'
import { bevelGear, hexBolt, rim, tyre } from '@/geometry/parts'
import { APEX, CROWN_ANGLES, DIFF_ANGLES, DIM } from './model'

const { PI } = Math
/** rotate a +Y-axis solid so its axis lies along +X / +Z */
const alongX = mat4.rz(-PI / 2)
const alongZ = mat4.rx(PI / 2)

/** Bevel pinion (local frame of bevelGear: axis +Z towards the apex) with its shaft and drive flange behind. */
function pinion() {
  const teeth = bevelGear({ teeth: DIM.zPinion, module: DIM.crownModule, faceWidth: DIM.crownFace, pitchAngleDeg: CROWN_ANGLES.pinion })
  const shaft = xform(cylinder(0.022, 0.2, 32), mat4.c(mat4.t(0, 0, -0.1), alongZ))
  const flange = xform(lathe([[0.022, 0], [0.06, 0], [0.06, 0.012], [0.03, 0.022], [0.022, 0.022]], 48), mat4.c(mat4.t(0, 0, -0.2), mat4.rx(-PI / 2)))
  return { teeth, shaft: merge(shaft, flange) }
}

/** Crown wheel with its backing ring and bolts (local bevel frame; the back is −Z). */
function crown() {
  const teeth = bevelGear({ teeth: DIM.zCrown, module: DIM.crownModule, faceWidth: DIM.crownFace, pitchAngleDeg: CROWN_ANGLES.gear, bore: 0.095 })
  const back = APEX.crown
  const ringDepth = 0.046 - back
  const ring = xform(tube(0.142, 0.095, ringDepth, 96), mat4.c(mat4.t(0, 0, -ringDepth / 2), alongZ))
  const bolts = []
  for (let i = 0; i < 10; i++) {
    const a = (2 * PI * i) / 10 + 0.1
    // bolt heads on the far side of the cage flange, pointing back towards the crown
    bolts.push(xform(hexBolt(0.01, 0.03), mat4.c(mat4.t(0.107 * Math.cos(a), 0.107 * Math.sin(a), -(0.058 - back) - 0.0005), mat4.rx(-PI / 2))))
  }
  return { teeth, ring, bolts: merge(...bolts) }
}

function sideGear() {
  const g = bevelGear({ teeth: DIM.zSide, module: DIM.diffModule, faceWidth: DIM.diffFace, pitchAngleDeg: DIFF_ANGLES.gear, bore: DIM.shaftR })
  const hub = xform(tube(0.029, DIM.shaftR, 0.062, 40), mat4.c(mat4.t(0, 0, -0.031), alongZ))
  return merge(g, hub)
}

function spider() {
  return bevelGear({ teeth: DIM.zSpider, module: DIM.diffModule, faceWidth: DIM.diffFace, pitchAngleDeg: DIFF_ANGLES.pinion, bore: 0.0085 })
}

/** Differential cage (two-piece in practice) with the crown-wheel flange and four windows. Axis X. */
function cage() {
  const prof: V2[] = [
    [0.0305, -0.095],
    [0.042, -0.095],
    [0.042, -0.074],
    [0.066, -0.07],
    [DIM.caseOuter, -0.06],
    [DIM.caseOuter, 0.046],
    [0.118, 0.046],
    [0.118, 0.058],
    [0.07, 0.06],
    [0.066, 0.07],
    [0.042, 0.074],
    [0.042, 0.105],
    [0.0305, 0.105],
    [0.0305, 0.04],
    [DIM.caseInner, 0.04],
    [DIM.caseInner, -0.04],
    [0.0305, -0.04],
  ]
  const shell = xform(lathe(prof, 64), alongX)
  // windows on the diagonals so the cross-pins stay whole
  const ops = [PI / 4, -PI / 4].map((a) => ({ op: 'sub' as const, geometry: xform(cylinder(0.024, 0.2, 32), mat4.rx(a)) }))
  const body = csg(shell, ops)
  // dog teeth for the diff lock on the end of the left hub
  const dogs = []
  for (let i = 0; i < 6; i++) {
    const a = (2 * PI * i) / 6
    dogs.push(xform(box(0.01, 0.012, 0.012), mat4.c(mat4.rx(a), mat4.t(0.11, 0.04, 0))))
  }
  return { body, dogs: merge(...dogs) }
}

function crossPins() {
  const L = 2 * (DIM.caseOuter - 0.002)
  return { y: cylinder(0.0085, L, 24), z: xform(cylinder(0.0085, L, 24), alongZ) }
}

/** Axle centre housing round the crown wheel, with the pinion nose, plus its oil bath. */
function carrier() {
  const outer: V2[] = [
    [0.047, -0.13],
    [0.07, -0.13],
    [0.09, -0.105],
    [0.185, -0.05],
    [0.19, 0.0],
    [0.19, 0.06],
    [0.15, 0.1],
    [0.07, 0.102],
    [0.047, 0.102],
  ]
  const inner: V2[] = [
    [0.047, -0.12],
    [0.062, -0.12],
    [0.082, -0.097],
    [0.177, -0.045],
    [0.182, 0.0],
    [0.182, 0.056],
    [0.145, 0.092],
    [0.062, 0.094],
    [0.047, 0.094],
  ]
  // shell = outer solid minus the inner cavity
  const solidOuter = xform(lathe(outer, 72), alongX)
  const cavityProfile: V2[] = [[0, inner[0][1]], ...inner, [0, inner[inner.length - 1][1]]]
  const cavity = xform(lathe(cavityProfile, 72), alongX)
  const nose = xform(cylinder(0.058, 0.2, 48), mat4.c(mat4.t(0, 0, 0.26), alongZ))
  const noseFlange = xform(cylinder(0.075, 0.016, 48), mat4.c(mat4.t(0, 0, 0.352), alongZ))
  const bore = xform(cylinder(0.04, 0.4, 40), mat4.c(mat4.t(0, 0, 0.25), alongZ))
  const shell = csg(solidOuter, [
    { op: 'add', geometry: nose },
    { op: 'add', geometry: noseFlange },
    { op: 'sub', geometry: cavity },
    { op: 'sub', geometry: bore },
  ])
  const oil = csg(cavity, [{ op: 'and', geometry: xform(box(0.5, 0.2, 0.5), mat4.t(0, -0.2, 0)) }])
  return { shell, oil }
}

/** Trumpet (axle tube) for one side, along +X starting at the carrier. Left side has the lock chamber. */
function trumpet(lockChamber: boolean) {
  const x0 = 0.1
  const prof: V2[] = lockChamber
    ? [
        [0.052, x0],
        [0.064, x0],
        [0.064, 0.2],
        [0.04, 0.215],
        [0.04, 0.55],
        [0.07, 0.55],
        [0.07, 0.565],
        [0.032, 0.565],
        [0.032, 0.21],
        [0.052, 0.198],
      ]
    : [
        [0.032, x0],
        [0.064, x0],
        [0.064, 0.112],
        [0.04, 0.125],
        [0.04, 0.55],
        [0.07, 0.55],
        [0.07, 0.565],
        [0.032, 0.565],
      ]
  return xform(lathe(prof, 48), alongX)
}

function halfShaft() {
  const shaft = xform(cylinder(DIM.shaftR, DIM.shaftEnd - 0.02, 24), mat4.c(mat4.t((DIM.shaftEnd + 0.02) / 2, 0, 0), alongX))
  const flange = xform(cylinder(0.075, 0.014, 40), mat4.c(mat4.t(DIM.shaftEnd + 0.007, 0, 0), alongX))
  const stub = xform(cylinder(0.05, DIM.wheelX - DIM.shaftEnd, 32), mat4.c(mat4.t((DIM.wheelX + DIM.shaftEnd) / 2, 0, 0), alongX))
  return merge(shaft, flange, stub)
}

/** Diff-lock dog collar (slides on the left half-shaft splines). */
function lockCollar() {
  const ring = xform(lathe([[DIM.shaftR, 0], [0.045, 0], [0.045, 0.012], [0.038, 0.012], [0.038, 0.02], [0.045, 0.02], [0.045, 0.034], [DIM.shaftR, 0.034]], 48), alongX)
  const dogs = []
  for (let i = 0; i < 6; i++) {
    const a = (2 * PI * i) / 6 + PI / 6
    dogs.push(xform(box(0.01, 0.012, 0.012), mat4.c(mat4.rx(a), mat4.t(-0.004, 0.04, 0))))
  }
  return merge(ring, ...dogs)
}

function wheel() {
  const t = xform(tyre({ radius: DIM.tyreR, width: 0.15, rimRadius: 0.17, lugs: 16, lugHeight: 0.022 }), alongX)
  const r = xform(rim(0.17, 0.13, 0.07, 0.02), alongX)
  return { tyre: t, rim: r }
}

/** Heavy, parameter-independent parts — built once, in the geometry worker. */
export function buildStatic() {
  const p = pinion()
  const c = crown()
  const cg = cage()
  const pins = crossPins()
  const car = carrier()
  const w = wheel()
  return {
    pinionTeeth: p.teeth,
    pinionShaft: p.shaft,
    crownTeeth: c.teeth,
    crownRing: c.ring,
    crownBolts: c.bolts,
    sideGear: sideGear(),
    spider: spider(),
    cage: cg.body,
    cageDogs: cg.dogs,
    pinY: pins.y,
    pinZ: pins.z,
    carrier: car.shell,
    oil: car.oil,
    trumpetLeft: trumpet(true),
    trumpetRight: trumpet(false),
    halfShaft: halfShaft(),
    collar: lockCollar(),
    tyre: w.tyre,
    rim: w.rim,
    chock: box(0.12, 0.08, 0.16),
  }
}

export type DiffGeometry = ReturnType<typeof buildStatic>

let ready: DiffGeometry | null = null

export async function prepareDiffGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('powertrain/differential', buildStatic)
  return ready
}

export function getDiffGeometry(): DiffGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
