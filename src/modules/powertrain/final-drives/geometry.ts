import { merge, xform, mat4 } from '@/geometry'
import { bevelPair } from '@/geometry/parts'
import { bevelPinion, crownWheel } from '@/parts/lib/driveline'
import { axleBrakeDisc, diffLockPlates, epicyclicCarrier, epicyclicGears, wheelHub } from '@/parts/lib/finalDrive'
import { casing, ringZ, shaftZ, shellZ as shell, spur } from '@/parts/lib/shapes'
import { BEVEL, EPI, EPI_RING_R, SPUR, SPUR_C, stations } from './model'

/**
 * Cheap (no CSG) final-drive geometry in the LOCAL frame of model.ts (half-shaft axis = +Z).
 * Built once on the main thread and cached. Gears, carrier, hub and brake discs come from the
 * shared parts library (the same builders as the tractor's MF axle).
 */
const { PI } = Math
const rad = (d: number) => (d * PI) / 180

export const ANGLES = bevelPair(BEVEL.zPinion, BEVEL.zCrown)
export const R_PINION = (BEVEL.zPinion * BEVEL.module) / 2
export const R_CROWN = (BEVEL.zCrown * BEVEL.module) / 2
export const APEX = { pinion: R_PINION / Math.tan(rad(ANGLES.pinion)), crown: R_CROWN / Math.tan(rad(ANGLES.gear)) }

export function buildFinalGeometry() {
  const p = bevelPinion({ teeth: BEVEL.zPinion, module: BEVEL.module, face: BEVEL.face, pitchAngleDeg: ANGLES.pinion, shaftR: 0.022, shaftLen: 0.24 })
  const pinion = merge(p.teeth, p.shaft!)
  const cw = crownWheel({ teeth: BEVEL.zCrown, module: BEVEL.module, face: BEVEL.face, pitchAngleDeg: ANGLES.gear, bore: 0.09, backing: { rOut: 0.138, depth: 0.016 }, bolts: { n: 10, r: 0.112, z: -0.016 } })
  const crown = merge(cw.teeth, cw.ring!)
  const crownBolts = cw.bolts!
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
  const disc = (r: number, z: number, w = 0.012) => axleBrakeDisc(r, z, w).disc
  const lining = (r: number, z: number, w = 0.012) => axleBrakeDisc(r, z, w).lining
  const hub = wheelHub
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
  const { sun: sunG, planet: planetG, ring: ringG } = epicyclicGears(EPI)
  const carrier = (z: number, toHub: number) => epicyclicCarrier(EPI, z, toHub)
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
    lockPlates: diffLockPlates(0.122),
    lockPiston: ringZ(0.058, 0.032, 0.15, 0.155, 48),
  }
  return { pinion, crown, crownBolts, cage, centre, straight, spurSet, spurPinion, spurGear, sunG, planetG, ringG, epiOut, mfSet }
}

let cache: ReturnType<typeof buildFinalGeometry> | null = null
export const finalGeometry = () => (cache ??= buildFinalGeometry())
