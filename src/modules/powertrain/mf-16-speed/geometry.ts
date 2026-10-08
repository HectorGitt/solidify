import * as THREE from 'three'
import { cylinder, mat4, merge, xform } from '@/geometry'
import { bevelGear, splineShaft } from '@/geometry/parts'
import { axial, boxFrom, casing, dogRing, helical, internalGear, internalSplinePlate, ringZ, shaftZ, spur } from '../common/geo'
import { BEVEL, BOT, FRONT_Y, GW, M, RANGE_L, SS, ST, Z } from './dims'

/** MF 16-speed gearbox geometry (worker-safe). Gears built at the origin in XY; placed in the scene. */

const { PI } = Math
const HX = 20
const SLEEVE = 0.027

function freeGear(z: number, hand: 1 | -1, side: 1 | -1, cone: boolean) {
  const g = helical(z, M, GW, HX, hand, SLEEVE, 3, 3)
  const dog = xform(dogRing(24, 0.034, 0.038, SLEEVE, 0.006), mat4.t(0, 0, side * (GW / 2 + 0.003)))
  const c0 = side * (GW / 2 + 0.006)
  const c = cone
    ? axial(
        side > 0
          ? [
              [SLEEVE, c0],
              [0.036, c0],
              [0.033, c0 + 0.008],
              [SLEEVE, c0 + 0.008],
            ]
          : [
              [SLEEVE, c0 - 0.008],
              [0.033, c0 - 0.008],
              [0.036, c0],
              [SLEEVE, c0],
            ],
        40,
      )
    : null
  return { gear: g, dog, cone: c }
}

function collar(width: number) {
  return merge(internalSplinePlate(24, 0.05, 0.0385, 0.0345, width), ringZ(0.056, 0.0495, -0.004, 0.004, 48))
}

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
  const fr: THREE.BufferGeometry[] = []
  const stl: THREE.BufferGeometry[] = []
  for (let k = 0; k < 6; k++) {
    const z = -0.063 + k * 0.0052
    if (k % 2 === 0) fr.push(ringZ(0.054, 0.0405, z, z + 0.0034, 56))
    else stl.push(ringZ(0.0595, 0.046, z, z + 0.0034, 56))
  }
  return { hub, friction: merge(...fr), steel: merge(...stl) }
}

export function buildStatic() {
  const pinion = bevelGear({ teeth: Z.pinion, module: BEVEL.m, faceWidth: 0.038, pitchAngleDeg: BEVEL.angles.pinion })
  const crown = bevelGear({ teeth: Z.crown, module: BEVEL.m, faceWidth: 0.038, pitchAngleDeg: BEVEL.angles.gear, bore: 0.03 })
  const ptoStub = xform(splineShaft(6, 0.0175, 0.0145, 0.05), mat4.c(mat4.t(0, 0, 0.925), mat4.rx(PI / 2)))
  return {
    pto: merge(shaftZ(0.016, -0.2, 0.9, 24), ptoStub),
    input: ringZ(0.026, 0.0185, -0.2, SS.z - SS.w / 2, 40),
    sun: spur(SS.zs, SS.m, SS.w, 0.0185, 3),
    planet: spur(SS.zp, SS.m, SS.w, 0.0055, 3),
    carrier: carrier(),
    ring: internalGear(SS.zr, SS.m, SS.w, 0.116, 3),
    band: merge(ringZ(0.122, 0.1175, -0.013, 0.013, 72), boxFrom([-0.015, 0.12, -0.013], [0.015, 0.14, 0.013])),
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
    baulk: merge(axial([[0.0335, -0.004], [0.039, -0.004], [0.039, 0.004], [0.0325, 0.004]], 48), dogRing(24, 0.0385, 0.0415, 0.037, 0.004)),
    lay: ringZ(0.028, 0.0185, ST.layZ0, ST.layZ1, 40),
    lh: spur(Z.lh, M, GW, 0.028, 3),
    ll: spur(Z.ll, M, GW, 0.028, 3),
    rangeCluster: merge(
      xform(spur(Z.oh, M, GW, 0.024, 3), mat4.t(0, 0, -ST.slide.d)),
      xform(spur(Z.ol, M, GW, 0.024, 3), mat4.t(0, 0, ST.slide.d)),
      ringZ(0.034, 0.024, -ST.slide.d + GW / 2, ST.slide.d - GW / 2, 40),
      ringZ(0.044, 0.033, -0.004, 0.004, 40),
    ),
    output: merge(shaftZ(0.018, ST.mainZ1 - 0.03, ST.mainZ1, 20), xform(splineShaft(12, 0.0245, 0.022, ST.outZ1 - ST.mainZ1), mat4.c(mat4.t(0, 0, (ST.mainZ1 + ST.outZ1) / 2), mat4.rx(PI / 2)))),
    t1: spur(Z.t1, M, GW, 0.024, 3),
    t2: spur(Z.t2, M, GW, 0.022, 3),
    brakeDisc: ringZ(0.09, 0.024, -0.005, 0.005, 64),
    caliper: boxFrom([-0.025, 0.07, -0.016], [0.025, 0.1, 0.016]),
    front: shaftZ(0.022, -0.3, ST.transfer + 0.02, 24),
    fourWD: merge(ringZ(0.07, 0.064, ST.transfer - 0.075, ST.transfer - 0.02, 56), ringZ(0.07, 0.024, ST.transfer - 0.02, ST.transfer - 0.014, 56)),
    fourWDPlates: merge(...[0, 1, 2, 3, 4, 5].map((k) => ringZ(k % 2 ? 0.0635 : 0.056, k % 2 ? 0.04 : 0.033, ST.transfer - 0.07 + k * 0.008, ST.transfer - 0.065 + k * 0.008, 48))),
    fourWDHub: ringZ(0.034, 0.022, ST.transfer - 0.072, ST.transfer - 0.022, 40),
    pinion,
    crown,
    diffCase: axial(
      [
        [0.03, -0.09],
        [0.07, -0.09],
        [0.08, -0.03],
        [0.1, -0.012],
        [0.1, 0],
        [0.03, 0],
      ],
      48,
    ),
    halfShafts: shaftZ(0.022, -0.3, 0.18, 24),
    casing: casing([-0.13, 0.165], [-0.27, 0.15], [-0.03, 0.9], 0.012, [
      { x: 0, y: 0, r: 0.03 },
      { x: 0, y: BOT, r: 0.03 },
    ]),
    transferCase: casing([-0.1, 0.1], [-0.39, -0.27], [0.7, 0.9], 0.012, [{ x: 0, y: FRONT_Y, r: 0.026 }]),
    axleHousing: xform(
      axial(
        [
          [0.155, -0.16],
          [0.166, -0.16],
          [0.166, 0.07],
          [0.04, 0.07],
          [0.04, 0.06],
          [0.155, 0.06],
        ],
        72,
      ),
      mat4.ry(PI / 2),
    ),
    oil: boxFrom([-0.117, -0.257, -0.017], [0.152, -0.2, 0.887]),
    nozzle: merge(shaftZ(0.004, 0, 0.08, 10)),
    lever: merge(xform(cylinder(0.007, 0.24, 14), mat4.t(0, 0.12, 0)), xform(cylinder(0.018, 0.03, 16), mat4.t(0, 0.25, 0))),
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
