import { cylinder, mat4, merge, xform, type V2 } from '@/geometry'
import { bevelGear, bevelPair, hexBolt } from '@/geometry/parts'
import { axial, casing, internalGear, ringZ, shaftZ, spur } from '../common/geo'
import { BEVEL, EPI, EPI_RC, EPI_RING_R, SPUR, SPUR_C, stations } from './model'

/**
 * Cheap (no CSG) final-drive geometry in the LOCAL frame of model.ts (half-shaft axis = +Z).
 * Built once on the main thread and cached.
 */
const { PI } = Math
const rad = (d: number) => (d * PI) / 180

export const ANGLES = bevelPair(BEVEL.zPinion, BEVEL.zCrown)
export const R_PINION = (BEVEL.zPinion * BEVEL.module) / 2
export const R_CROWN = (BEVEL.zCrown * BEVEL.module) / 2
export const APEX = { pinion: R_PINION / Math.tan(rad(ANGLES.pinion)), crown: R_CROWN / Math.tan(rad(ANGLES.gear)) }

function ccw(pts: V2[]) {
  let a = 0
  for (let i = 0; i < pts.length; i++) a += pts[i][0] * pts[(i + 1) % pts.length][1] - pts[(i + 1) % pts.length][0] * pts[i][1]
  return a > 0 ? pts : pts.slice().reverse()
}

/** Hollow revolved shell from an outer (r, z) polyline and a wall thickness (closed ends optional). */
const shell = (pts: V2[], seg = 64) => axial(ccw(pts), seg)

export function buildFinalGeometry() {
  const pinion = merge(
    bevelGear({ teeth: BEVEL.zPinion, module: BEVEL.module, faceWidth: BEVEL.face, pitchAngleDeg: ANGLES.pinion }),
    xform(cylinder(0.022, 0.24, 24), mat4.c(mat4.t(0, 0, -0.12), mat4.rx(PI / 2))),
  )
  const crown = merge(
    bevelGear({ teeth: BEVEL.zCrown, module: BEVEL.module, faceWidth: BEVEL.face, pitchAngleDeg: ANGLES.gear, bore: 0.09 }),
    ringZ(0.138, 0.09, -0.016, 0, 72),
  )
  const crownBolts = merge(...Array.from({ length: 10 }, (_, k) => xform(hexBolt(0.01, 0.03), mat4.c(mat4.rz((2 * PI * k) / 10), mat4.t(0.112, 0, -0.016), mat4.rx(-PI / 2)))))
  // differential cage (detail in the Differential scene), local z axis
  const cage = shell([
    [0.03, -0.09],
    [0.07, -0.07],
    [0.075, 0.0],
    [0.07, APEX.crown + 0.016],
    [0.142, APEX.crown + 0.016],
    [0.142, APEX.crown + 0.03],
    [0.05, APEX.crown + 0.05],
    [0.045, 0.12],
    [0.03, 0.12],
  ])
  // centre housing (left half), with the pinion nose towards local −X
  const centre = merge(
    shell([
      [0.06, 0.13],
      [0.07, 0.13],
      [0.07, 0.12],
      [0.2, 0.1],
      [0.21, 0.0],
      [0.21, -0.1],
      [0.0, -0.1],
      [0.0, -0.09],
      [0.2, -0.09],
      [0.2, 0.0],
      [0.19, 0.09],
      [0.06, 0.11],
    ]),
    xform(ringZ(0.06, 0.03, -0.37, -0.19, 40), mat4.ry(PI / 2)),
  )
  const halfShaft = (z1: number) => shaftZ(0.022, 0.05, z1, 24)
  const disc = (r: number, z: number, w = 0.012) => merge(ringZ(r, 0.03, z - w / 2, z + w / 2, 64))
  const lining = (r: number, z: number, w = 0.012) => merge(ringZ(r - 0.003, r * 0.55, z - w / 2 - 0.003, z - w / 2, 64), ringZ(r - 0.003, r * 0.55, z + w / 2, z + w / 2 + 0.003, 64))
  const hub = (z: number) => merge(ringZ(0.13, 0.0, z, z + 0.02, 64), ...Array.from({ length: 8 }, (_, k) => xform(cylinder(0.008, 0.05, 12), mat4.c(mat4.rz((2 * PI * k) / 8), mat4.t(0.1, 0, z + 0.035), mat4.rx(PI / 2)))))
  const trumpet = (z0: number, z1: number, r0 = 0.07) => shell([[0.05, z0], [r0 + 0.01, z0], [0.06, z0 + 0.06], [0.06, z1], [0.07, z1], [0.07, z1 + 0.012], [0.05, z1 + 0.012]], 48)

  // ---------- straight axle
  const st = stations('straight')
  const straight = { shaft: halfShaft(st.hub), hub: hub(st.hub), trumpet: trumpet(0.11, st.trumpetEnd), disc: disc(0.12, st.brake), lining: lining(0.12, st.brake) }

  // ---------- spur reduction (Fig 35a): brake on the outer end of the fast differential shaft
  const sp = stations('spur')
  const spurPinion = spur(SPUR.pinion, SPUR.module, SPUR.width, 0.022)
  const spurGear = spur(SPUR.gear, SPUR.module, SPUR.width, 0.03)
  const box = casing([-0.205, 0.205], [-SPUR_C - 0.205, 0.07], [sp.reduction - 0.05, sp.reduction + 0.05], 0.008, [
    { x: 0, y: 0, r: 0.03 },
    { x: 0, y: -SPUR_C, r: 0.036 },
  ])
  const spurSet = {
    shaft: halfShaft(sp.brake + 0.02),
    axle: merge(shaftZ(0.03, sp.reduction - 0.04, sp.hub, 24)),
    hub: hub(sp.hub),
    trumpet: trumpet(0.11, sp.trumpetEnd - 0.012),
    disc: disc(0.12, sp.brake),
    lining: lining(0.12, sp.brake),
    box,
    brakeCover: shell([[0.03, sp.brake - 0.03], [0.14, sp.brake - 0.03], [0.14, sp.brake + 0.03], [0.03, sp.brake + 0.03], [0.03, sp.brake + 0.024], [0.132, sp.brake + 0.024], [0.132, sp.brake - 0.024], [0.03, sp.brake - 0.024]]),
  }

  // ---------- epicyclic sets (Fig 35b outboard, A2.15 inboard)
  const sunG = spur(EPI.sun, EPI.module, EPI.width, 0.022)
  const planetG = spur(EPI.planet, EPI.module, EPI.width * 0.95, 0.012)
  const ringG = internalGear(EPI.ring, EPI.module, EPI.width, EPI_RING_R + 0.022)
  const carrier = (z: number, toHub: number) =>
    merge(
      ringZ(EPI_RC + 0.025, 0.0, z + EPI.width / 2 + 0.002, z + EPI.width / 2 + 0.016, 64),
      ringZ(EPI_RC + 0.025, 0.026, z - EPI.width / 2 - 0.012, z - EPI.width / 2 - 0.002, 64),
      ...Array.from({ length: EPI.planets }, (_, k) => xform(shaftZ(0.0115, z - EPI.width / 2 - 0.002, z + EPI.width / 2 + 0.002, 16), mat4.t(EPI_RC * Math.cos((2 * PI * k) / EPI.planets), EPI_RC * Math.sin((2 * PI * k) / EPI.planets), 0))),
      shaftZ(0.035, z + EPI.width / 2 + 0.016, toHub, 32),
    )
  const ep = stations('epicyclic')
  const epiOut = {
    shaft: halfShaft(ep.reduction + EPI.width / 2),
    carrier: carrier(ep.reduction, ep.hub),
    hub: hub(ep.hub),
    trumpet: trumpet(0.11, ep.trumpetEnd - 0.012),
    housing: shell([[0.06, ep.trumpetEnd - 0.012], [EPI_RING_R + 0.032, ep.trumpetEnd - 0.012], [EPI_RING_R + 0.032, ep.hub - 0.004], [0.05, ep.hub - 0.004], [0.05, ep.hub - 0.014], [EPI_RING_R + 0.024, ep.hub - 0.014], [EPI_RING_R + 0.024, ep.trumpetEnd], [0.06, ep.trumpetEnd]]),
    disc: disc(0.13, ep.brake),
    lining: lining(0.13, ep.brake),
    brakeCover: shell([[0.03, ep.brake - 0.03], [0.15, ep.brake - 0.03], [0.15, ep.brake + 0.03], [0.03, ep.brake + 0.03], [0.03, ep.brake + 0.024], [0.142, ep.brake + 0.024], [0.142, ep.brake - 0.024], [0.03, ep.brake - 0.024]]),
  }
  const mf = stations('mf2000')
  const mfSet = {
    shaft: halfShaft(mf.reduction + EPI.width / 2),
    carrier: carrier(mf.reduction, mf.hub),
    hub: hub(mf.hub),
    // trumpet bell round the brake and epicyclic, tapering to the axle tube
    trumpet: shell([
      [0.06, 0.13],
      [0.2, 0.13],
      [0.21, 0.29],
      [0.09, 0.42],
      [0.065, 0.5],
      [0.065, mf.trumpetEnd],
      [0.075, mf.trumpetEnd],
      [0.075, mf.trumpetEnd + 0.012],
      [0.042, mf.trumpetEnd + 0.012],
      [0.042, mf.trumpetEnd - 0.01],
      [0.055, mf.trumpetEnd - 0.01],
      [0.055, 0.5],
      [0.08, 0.42],
      [0.198, 0.29],
      [0.19, 0.14],
      [0.06, 0.14],
    ]),
    disc: disc(0.185, mf.brake, 0.01),
    lining: lining(0.185, mf.brake, 0.01),
    brakePiston: ringZ(0.185, 0.12, mf.brake - 0.019, mf.brake - 0.0095, 64),
    lockPlates: merge(...Array.from({ length: 6 }, (_, k) => ringZ(0.058, 0.032, 0.122 + k * 0.0045, 0.1245 + k * 0.0045, 48))),
    lockPiston: ringZ(0.058, 0.032, 0.15, 0.155, 48),
  }
  return { pinion, crown, crownBolts, cage, centre, straight, spurSet, spurPinion, spurGear, sunG, planetG, ringG, epiOut, mfSet }
}

let cache: ReturnType<typeof buildFinalGeometry> | null = null
export const finalGeometry = () => (cache ??= buildFinalGeometry())
