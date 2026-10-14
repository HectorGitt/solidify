import * as THREE from 'three'
import { cylinder, mat4, merge, xform } from '@/geometry'
import { bandBrake, baulkRing, bevelPinion, brakeDisc, crownHousing, crownWheel, diffCase, gearLever, plateStackZ, shiftCollar, slidingCluster, synchroGear } from '@/parts/lib/driveline'
import { axial, boxFrom, casing, dogRing, helical, internalGear, ringZ, shaftZ, splineZ, spur } from '@/parts/lib/shapes'
import { BEVEL, BOT, FRONT_Y, GW, M, RANGE_L, SS, ST, Z } from './dims'

/** MF 16-speed gearbox geometry (worker-safe). Gears built at the origin in XY; placed in the scene. */

const { PI } = Math
const HX = 20
const SLEEVE = 0.027

/** Free gear with its dog ring and (synchromesh) cone on one face. */
const freeGear = (z: number, hand: 1 | -1, side: 1 | -1, cone: boolean) =>
  synchroGear({ teeth: z, module: M, width: GW, helixDeg: HX, hand, bore: SLEEVE, side, dog: { rRoot: 0.034, rTip: 0.038, width: 0.006 }, cone: cone ? { rBig: 0.036, rSmall: 0.033, length: 0.008 } : null })

/** Selector collar: internal splines and the fork groove. */
const collar = (width: number) => shiftCollar({ rOut: 0.05, rRoot: 0.0385, rTip: 0.0345, width })

function carrier() {
  const pins: THREE.BufferGeometry[] = []
  const rc = ((SS.zs + SS.zp) * SS.m) / 2
  const half = SS.w / 2 + 0.003
  for (let i = 0; i < SS.n; i++) {
    const a = (2 * PI * i) / SS.n
    pins.push(xform(cylinder(0.0055, 2 * half, 16), mat4.c(mat4.t(rc * Math.cos(a), rc * Math.sin(a), 0), mat4.rx(PI / 2))))
  }
  const front = ringZ(0.103, 0.03, -half - 0.008, -half, 72)
  const rear = ringZ(0.103, SLEEVE - 0.0005, half, half + 0.008, 72)
  // drum of the high clutch, forward from the front plate
  const drum = ringZ(0.066, 0.06, -half - 0.05, -half - 0.008, 64)
  return { plates: merge(front, rear, drum), pins: merge(...pins) }
}

function highClutch() {
  const hub = ringZ(0.04, 0.026, -0.065, -0.03, 48)
  // friction plates on the hub alternating with steel plates in the carrier drum
  const pack = plateStackZ({ count: 6, z0: -0.063, pitch: 0.0052, t: 0.0034, a: { rOut: 0.054, rIn: 0.0405 }, b: { rOut: 0.0595, rIn: 0.046 } })
  return { hub, friction: pack.a, steel: pack.b! }
}

export function buildStatic() {
  const pinion = bevelPinion({ teeth: Z.pinion, module: BEVEL.m, face: 0.038, pitchAngleDeg: BEVEL.angles.pinion }).teeth
  const crown = crownWheel({ teeth: Z.crown, module: BEVEL.m, face: 0.038, pitchAngleDeg: BEVEL.angles.gear, bore: 0.03 }).teeth
  const ptoStub = splineZ(6, 0.0175, 0.0145, 0.9, 0.95)
  return {
    pto: merge(shaftZ(0.016, -0.2, 0.9, 24), ptoStub),
    input: ringZ(0.026, 0.0185, -0.2, SS.z - SS.w / 2, 40),
    sun: spur(SS.zs, SS.m, SS.w, 0.0185, 3),
    planet: spur(SS.zp, SS.m, SS.w, 0.0055, 3),
    carrier: carrier(),
    ring: internalGear(SS.zr, SS.m, SS.w, 0.116, 3),
    band: bandBrake({ r: 0.1155, width: 0.026, gap: 0.002, t: 0.0045, lug: { w: 0.03, h: 0.02, at: 0.0145 } }),
    hiClutch: highClutch(),
    shuttleSleeve: ringZ(SLEEVE, 0.0185, SS.z + SS.w / 2, 0.245, 40),
    revSpur: spur(Z.rev, M, GW, SLEEVE, 3),
    fwdSpur: spur(Z.fwd, M, GW, SLEEVE, 3),
    shuttleDogs: dogRing(24, 0.034, 0.038, SLEEVE, 0.006),
    hub: dogRing(24, 0.034, 0.038, SLEEVE - 0.003, 0.02),
    collar: collar(0.02),
    idler: spur(Z.idler, M, GW, 0.014, 3),
    idlerShaft: shaftZ(0.014, ST.rev - 0.03, ST.rev + 0.03, 16),
    cm: spur(Z.cm, M, ST.cmZ1 - ST.cmZ0, 0.024, 3),
    main: shaftZ(0.024, ST.mainZ0, ST.mainZ1, 32),
    // keyed objects, not arrays: the worker serialiser turns arrays into plain objects
    m1: freeGear(Z.m[0], -1, -1, true),
    m2: freeGear(Z.m[1], -1, 1, true),
    m3: freeGear(Z.m[2], -1, -1, true),
    m4: freeGear(Z.m[3], -1, 1, true),
    l1: helical(Z.l[0], M, GW, HX, 1, 0.028, 3, 3),
    l2: helical(Z.l[1], M, GW, HX, 1, 0.028, 3, 3),
    l3: helical(Z.l[2], M, GW, HX, 1, 0.028, 3, 3),
    l4: helical(Z.l[3], M, GW, HX, 1, 0.028, 3, 3),
    baulk: baulkRing({ rOut: 0.039, coneA: 0.0335, coneB: 0.0325, width: 0.008, toothRoot: 0.0385, toothTip: 0.0415, toothBore: 0.037 }),
    lay: ringZ(0.028, 0.0185, ST.layZ0, ST.layZ1, 40),
    lh: spur(Z.lh, M, GW, 0.028, 3),
    ll: spur(Z.ll, M, GW, 0.028, 3),
    rangeCluster: (() => {
      const c = slidingCluster({ za: Z.oh, zb: Z.ol, module: M, width: GW, bore: 0.024, d: ST.slide.d, flangeR: 0.044, grooveHalf: 0.003, flangeW: 0.004 })
      return merge(c.gears, c.sleeve)
    })(),
    output: merge(shaftZ(0.018, ST.mainZ1 - 0.03, ST.mainZ1, 20), splineZ(12, 0.0245, 0.022, ST.mainZ1, ST.outZ1)),
    t1: spur(Z.t1, M, GW, 0.024, 3),
    t2: spur(Z.t2, M, GW, 0.022, 3),
    brakeDisc: brakeDisc({ rOut: 0.09, bore: 0.024, t: 0.01 }).disc,
    caliper: boxFrom([-0.025, 0.07, -0.016], [0.025, 0.1, 0.016]),
    front: shaftZ(0.022, -0.3, ST.transfer + 0.02, 24),
    fourWD: merge(ringZ(0.07, 0.064, ST.transfer - 0.075, ST.transfer - 0.02, 56), ringZ(0.07, 0.024, ST.transfer - 0.02, ST.transfer - 0.014, 56)),
    fourWDPlates: plateStackZ({ count: 6, z0: ST.transfer - 0.07, pitch: 0.008, t: 0.005, a: { rOut: 0.056, rIn: 0.033 }, b: { rOut: 0.0635, rIn: 0.04 }, segments: 48 }).all,
    fourWDHub: ringZ(0.034, 0.022, ST.transfer - 0.072, ST.transfer - 0.022, 40),
    pinion,
    crown,
    diffCase: diffCase({ length: 0.09, rEnd: 0.07, rBody: 0.08, rFlange: 0.1 }),
    halfShafts: shaftZ(0.022, -0.3, 0.18, 24),
    casing: casing([-0.13, 0.165], [-0.27, 0.15], [-0.03, 0.9], 0.012, [
      { x: 0, y: 0, r: 0.03 },
      { x: 0, y: BOT, r: 0.03 },
    ]),
    transferCase: casing([-0.1, 0.1], [-0.39, -0.27], [0.7, 0.9], 0.012, [{ x: 0, y: FRONT_Y, r: 0.026 }]),
    axleHousing: xform(crownHousing({ rIn: 0.155, rOut: 0.166, z0: -0.16, z1: 0.07 }), mat4.ry(PI / 2)),
    oil: boxFrom([-0.117, -0.257, -0.017], [0.152, -0.2, 0.887]),
    nozzle: merge(shaftZ(0.004, 0, 0.08, 10)),
    lever: (() => {
      const l = gearLever({ length: 0.24, knobR: 0.018 })
      return merge(l.stick, l.knob)
    })(),
    tower: xform(axial([[0.025, 0], [0.045, 0], [0.032, 0.045], [0.025, 0.045]], 28), mat4.rx(-PI / 2)),
    /** for tests */
    rangeL: RANGE_L,
  }
}

export type MFGeometry = ReturnType<typeof buildStatic>

let ready: MFGeometry | null = null

export async function prepareMFGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('powertrain/mf-16-speed', buildStatic)
  return ready
}

export function getMFGeometry(): MFGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
