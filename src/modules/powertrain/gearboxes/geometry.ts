import * as THREE from 'three'
import { box, cylinder, mat4, merge, xform } from '@/geometry'
import { bevelGear, splineShaft } from '@/geometry/parts'
import { axial, boxFrom, casing, dogRing, helical, internalSplinePlate, ringZ, shaftZ, spur } from '../common/geo'
import { BAULK_W, BEVEL, BOTTOM_Y, DOG_W, GW, HUB_W, INPUT_END, M, OUTPUT_END, RANGE, SLIDE, Z } from './dims'

/** Gearbox geometry (worker-safe). Gears in XY, shafts along Z; gear centres at z = 0 (positioned in the scene). */

const { PI } = Math
const HELIX = 22
const BORE = 0.0235

function slidingCluster(za: number, zb: number) {
  const a = xform(spur(za, M, GW, BORE, 3), mat4.t(0, 0, -SLIDE.d))
  const b = xform(spur(zb, M, GW, BORE, 3), mat4.t(0, 0, SLIDE.d))
  const sleeve = ringZ(0.034, BORE, -SLIDE.d + GW / 2, SLIDE.d - GW / 2, 40)
  const groove = merge(ringZ(0.042, 0.033, -0.011, -0.006, 40), ringZ(0.042, 0.033, 0.006, 0.011, 40))
  return { gears: merge(a, b), sleeve: merge(sleeve, groove) }
}

/** Free gear with its dog ring (and, for synchromesh, its cone) on the face towards the hub (side = +1: +Z face). */
function freeGear(z: number, hand: 1 | -1, side: 1 | -1) {
  const gearG = helical(z, M, GW, HELIX, hand, 0.024, 3, 3)
  const dz = side * (GW / 2 + DOG_W / 2)
  const dog = xform(dogRing(24, 0.03, 0.034, 0.024, DOG_W), mat4.t(0, 0, dz))
  const c0 = side * (GW / 2 + DOG_W)
  const cone = axial(
    side > 0
      ? [
          [0.024, c0],
          [0.031, c0],
          [0.028, c0 + BAULK_W],
          [0.024, c0 + BAULK_W],
        ]
      : [
          [0.024, c0 - BAULK_W],
          [0.028, c0 - BAULK_W],
          [0.031, c0],
          [0.024, c0],
        ],
    40,
  )
  return { gear: gearG, dog, cone }
}

function baulkRing() {
  const body = axial(
    [
      [0.0315, -BAULK_W / 2],
      [0.034, -BAULK_W / 2],
      [0.034, BAULK_W / 2],
      [0.0285, BAULK_W / 2],
    ],
    48,
  )
  const teeth = dogRing(24, 0.0335, 0.0365, 0.033, BAULK_W * 0.5)
  return merge(body, teeth)
}

function collar() {
  const ring = internalSplinePlate(24, 0.044, 0.0345, 0.0305, HUB_W)
  const groove = merge(ringZ(0.05, 0.0435, -0.007, -0.003, 48), ringZ(0.05, 0.0435, 0.003, 0.007, 48))
  return merge(ring, groove)
}

function fork(dropTo: number, xRail: number) {
  const yRail = 0.112
  return merge(
    boxFrom([xRail - 0.006, dropTo + 0.012, -0.006], [xRail + 0.006, yRail, 0.006]),
    boxFrom([Math.min(xRail, 0) - 0.006, dropTo + 0.006, -0.006], [Math.max(xRail, 0) + 0.006, dropTo + 0.018, 0.006]),
    boxFrom([-0.03, dropTo, -0.0025], [0.03, dropTo + 0.008, 0.0025]),
  )
}

function lever() {
  const ball = axial(
    Array.from({ length: 9 }, (_, i) => {
      const a = -PI / 2 + (PI * i) / 8
      return [0.022 * Math.cos(a), 0.022 * Math.sin(a)] as [number, number]
    }),
    24,
  )
  const stick = xform(cylinder(0.007, 0.26, 16), mat4.t(0, 0.13, 0))
  const knob = xform(axial(Array.from({ length: 9 }, (_, i) => {
    const a = -PI / 2 + (PI * i) / 8
    return [0.02 * Math.cos(a), 0.02 * Math.sin(a)] as [number, number]
  }), 20), mat4.t(0, 0.27, 0))
  return { ball: xform(ball, mat4.rx(-PI / 2)), stick, knob }
}

export function buildStatic() {
  const pinionG = bevelGear({ teeth: Z.pinion, module: BEVEL.m, faceWidth: 0.04, pitchAngleDeg: BEVEL.angles.pinion, bore: 0 })
  const crownG = bevelGear({ teeth: Z.crown, module: BEVEL.m, faceWidth: 0.04, pitchAngleDeg: BEVEL.angles.gear, bore: 0.03 })
  const splined = xform(splineShaft(12, 0.0235, 0.021, INPUT_END - 0.005), mat4.c(mat4.t(0, 0, (INPUT_END - 0.005) / 2), mat4.rx(PI / 2)))
  const lv = lever()
  return {
    // shafts
    input: merge(shaftZ(0.022, -0.16, 0.0, 32), splined),
    inputPlain: shaftZ(0.022, -0.16, INPUT_END, 32),
    output: merge(shaftZ(0.016, INPUT_END - 0.03, INPUT_END, 20), xform(splineShaft(12, 0.0235, 0.021, OUTPUT_END - INPUT_END), mat4.c(mat4.t(0, 0, (INPUT_END + OUTPUT_END) / 2), mat4.rx(PI / 2)))),
    bottom: shaftZ(0.024, -0.008, RANGE.l + 0.03, 32),
    idlerShaft: shaftZ(0.016, 0.0, 0.44, 20),
    // sliding mesh
    clusterA: slidingCluster(Z.t1, Z.t2),
    clusterB: slidingCluster(Z.t3, Z.tr),
    clusterR: slidingCluster(Z.rho, Z.rlo),
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
    collar: collar(),
    baulk: baulkRing(),
    forkSlide: fork(0.042, -0.04),
    forkSlideB: fork(0.042, 0.0),
    forkRange: fork(0.042, 0.04),
    forkCollarA: fork(0.05, -0.04),
    forkCollarB: fork(0.05, 0.0),
    rails: merge(...[-0.04, 0, 0.04].map((x) => xform(cylinder(0.006, 0.58, 16), mat4.c(mat4.t(x, 0.112, 0.29), mat4.rx(PI / 2))))),
    // bevel pinion, crown wheel, differential
    pinion: pinionG,
    crown: crownG,
    diffCase: axial(
      [
        [0.03, -0.1],
        [0.075, -0.1],
        [0.085, -0.03],
        [0.11, -0.012],
        [0.11, 0],
        [0.03, 0],
      ],
      48,
    ),
    halfShafts: shaftZ(0.022, -0.32, 0.2, 24),
    // housings and oil
    casing: casing([-0.12, 0.145], [-0.255, 0.13], [-0.012, 0.585], 0.01, [
      { x: 0, y: 0, r: 0.032 },
      { x: 0, y: BOTTOM_Y, r: 0.03 },
    ]),
    axleHousing: xform(
      axial(
        [
          [0.165, -0.17],
          [0.177, -0.17],
          [0.177, 0.08],
          [0.04, 0.08],
          [0.04, 0.07],
          [0.165, 0.07],
        ],
        72,
      ),
      mat4.ry(PI / 2),
    ),
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
