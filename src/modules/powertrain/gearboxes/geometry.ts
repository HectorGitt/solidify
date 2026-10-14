import * as THREE from 'three'
import { box, cylinder, mat4, merge, xform } from '@/geometry'
import { baulkRing, bevelPinion, crownHousing, crownWheel, diffCase, gearLever, shiftCollar, shiftFork, slidingCluster, synchroGear } from '@/parts/lib/driveline'
import { axial, boxFrom, casing, dogRing, helical, shaftZ, splineZ, spur } from '@/parts/lib/shapes'
import { BAULK_W, BEVEL, BOTTOM_Y, DOG_W, GW, HUB_W, INPUT_END, M, OUTPUT_END, RANGE, SLIDE, Z } from './dims'

/** Gearbox geometry (worker-safe). Gears in XY, shafts along Z; gear centres at z = 0 (positioned in the scene). */

const { PI } = Math
const HELIX = 22
const BORE = 0.0235

/** Sliding-mesh cluster: two spur gears on a splined sleeve with the fork groove between them. */
const slidingClusterG = (za: number, zb: number) => slidingCluster({ za, zb, module: M, width: GW, bore: BORE, d: SLIDE.d })

/** Free gear with its dog ring and synchro cone on the face towards the hub (side = +1: +Z face). */
function freeGear(z: number, hand: 1 | -1, side: 1 | -1) {
  const g = synchroGear({ teeth: z, module: M, width: GW, helixDeg: HELIX, hand, bore: 0.024, side, dog: { rRoot: 0.03, rTip: 0.034, width: DOG_W }, cone: { rBig: 0.031, rSmall: 0.028, length: BAULK_W } })
  return { gear: g.gear, dog: g.dog, cone: g.cone! }
}

const fork = (dropTo: number, xRail: number) => shiftFork({ dropTo, xRail, yRail: 0.112 })

export function buildStatic() {
  const pinionG = bevelPinion({ teeth: Z.pinion, module: BEVEL.m, face: 0.04, pitchAngleDeg: BEVEL.angles.pinion }).teeth
  const crownG = crownWheel({ teeth: Z.crown, module: BEVEL.m, face: 0.04, pitchAngleDeg: BEVEL.angles.gear, bore: 0.03 }).teeth
  const splined = splineZ(12, 0.0235, 0.021, 0, INPUT_END - 0.005)
  const lv = gearLever()
  return {
    // shafts
    input: merge(shaftZ(0.022, -0.16, 0.0, 32), splined),
    inputPlain: shaftZ(0.022, -0.16, INPUT_END, 32),
    output: merge(shaftZ(0.016, INPUT_END - 0.03, INPUT_END, 20), splineZ(12, 0.0235, 0.021, INPUT_END, OUTPUT_END)),
    bottom: shaftZ(0.024, -0.008, RANGE.l + 0.03, 32),
    idlerShaft: shaftZ(0.016, 0.0, 0.44, 20),
    // sliding mesh
    clusterA: slidingClusterG(Z.t1, Z.t2),
    clusterB: slidingClusterG(Z.t3, Z.tr),
    clusterR: slidingClusterG(Z.rho, Z.rlo),
    spurB1: spur(Z.b1, M, GW, 0.024, 3),
    spurB2: spur(Z.b2, M, GW, 0.024, 3),
    spurB3: spur(Z.b3, M, GW, 0.024, 3),
    spurBR: spur(Z.br, M, GW, 0.024, 3),
    spurIdler: spur(Z.idler, M, GW, 0.016, 3),
    rhb: spur(Z.rhb, M, GW, 0.024, 3),
    rlb: spur(Z.rlb, M, GW, 0.024, 3),
    // constant mesh / synchromesh (top gears hand +1, bottom −1; the idler −1, so BR is +1)
    t1: freeGear(Z.t1, 1, 1),
    t2: freeGear(Z.t2, 1, -1),
    t3: freeGear(Z.t3, 1, 1),
    tr: freeGear(Z.tr, 1, -1),
    hB1: helical(Z.b1, M, GW, HELIX, -1, 0.024, 3, 3),
    hB2: helical(Z.b2, M, GW, HELIX, -1, 0.024, 3, 3),
    hB3: helical(Z.b3, M, GW, HELIX, -1, 0.024, 3, 3),
    hBR: helical(Z.br, M, GW, HELIX, 1, 0.024, 3, 3),
    hIdler: helical(Z.idler, M, GW, HELIX, -1, 0.016, 3, 3),
    hub: dogRing(24, 0.03, 0.034, 0.022, HUB_W),
    collar: shiftCollar({ rOut: 0.044, rRoot: 0.0345, rTip: 0.0305, width: HUB_W }),
    baulk: baulkRing({ width: BAULK_W }),
    forkSlide: fork(0.042, -0.04),
    forkSlideB: fork(0.042, 0.0),
    forkRange: fork(0.042, 0.04),
    forkCollarA: fork(0.05, -0.04),
    forkCollarB: fork(0.05, 0.0),
    rails: merge(...[-0.04, 0, 0.04].map((x) => xform(cylinder(0.006, 0.58, 16), mat4.c(mat4.t(x, 0.112, 0.29), mat4.rx(PI / 2))))),
    // bevel pinion, crown wheel, differential
    pinion: pinionG,
    crown: crownG,
    diffCase: diffCase(),
    halfShafts: shaftZ(0.022, -0.32, 0.2, 24),
    // housings and oil
    casing: casing([-0.12, 0.145], [-0.255, 0.13], [-0.012, 0.585], 0.01, [
      { x: 0, y: 0, r: 0.032 },
      { x: 0, y: BOTTOM_Y, r: 0.03 },
    ]),
    axleHousing: xform(crownHousing(), mat4.ry(PI / 2)),
    oil: boxFrom([-0.109, -0.244, 0.0], [0.134, -0.2, 0.574]),
    tower: axial(
      [
        [0.03, 0],
        [0.05, 0],
        [0.035, 0.05],
        [0.03, 0.05],
      ],
      32,
    ),
    lever: lv,
    gate: xform(box(0.09, 0.006, 0.07), mat4.t(0, 0.06, 0)),
  }
}

export type GearboxGeometry = ReturnType<typeof buildStatic>

let ready: GearboxGeometry | null = null

export async function prepareGearboxGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('powertrain/gearboxes', buildStatic)
  return ready
}

export function getGearboxGeometry(): GearboxGeometry {
  if (!ready) ready = buildStatic()
  return ready
}

export { THREE }
