import * as THREE from 'three'
import { cylinder, mat4, merge, xform, type V2 } from '@/geometry'
import { flexPlate, statorWheel, torusBand, torusBlades, torusPoint } from '@/parts/lib/driveline'
import { axial, ccwProfile, ringZ, shaftZ } from '@/parts/lib/shapes'
import { TC } from './model'

/** Cheap (no CSG) torque-converter geometry, built once on the main thread. Axis along Z. */
const { PI } = Math

const ccw = ccwProfile

/** Point on the torus section: centre (RC, 0), radius R, angle θ (θ = 0 outer, +π/2 rear). */
const tp = (R: number, th: number): V2 => torusPoint(TC.RC, R, th)

/** Half-annulus band R0…R1 for θ from t0 to t1, revolved about Z. */
const band = (R0: number, R1: number, t0: number, t1: number) => torusBand(TC.RC, R0, R1, t0, t1)

/** Flat blade in the meridional plane, R from B to A, θ from t0 to t1, thickness t; copies round Z. */
const blades = (count: number, t0: number, t1: number, thick: number, phase = 0) => torusBlades({ RC: TC.RC, A: TC.A, B: TC.B, count, t0, t1, thick, phase })

/** Stator: hub plus inclined blades (they turn the returning oil to the impeller's direction). */
const stator = () => statorWheel({ r0: TC.statorR0, r1: TC.statorR1, half: TC.statorHalf, bore: TC.rollerR + 0.003, blades: TC.statorBlades })

export function buildTcGeometry() {
  const g = TC.innerGap
  const t = TC.shell
  // impeller: rear half (θ 0…π−gap), shell + core + blades + web to its hub
  const impellerShell = band(TC.A, TC.A + t, 0.004, PI - g)
  const impellerCore = band(TC.B - 0.005, TC.B, 0.02, PI - g)
  const impellerBlades = blades(TC.impellerBlades, 0.02, PI - g, 0.0022)
  const [rw, zw] = tp(TC.A, PI - g)
  const impellerHub = merge(
    axial(ccw([[0.034, zw - 0.004], [rw + 0.002, zw - 0.004], [rw + 0.002, zw + 0.004], [0.04, zw + 0.004], [0.04, 0.15], [0.034, 0.15]]), 64),
  )
  // front cover, welded to the impeller rim; the engine bolts to it
  const coverOuter = TC.RC + TC.A + t
  const cover = axial(
    ccw([
      [0.03, TC.coverZ - 0.008],
      [coverOuter + 0.004, TC.coverZ - 0.008],
      [coverOuter + 0.004, 0.006],
      [coverOuter - 0.002, 0.006],
      [coverOuter - 0.002, TC.coverZ],
      [0.03, TC.coverZ],
    ]),
    96,
  )
  const lugs = merge(...Array.from({ length: 6 }, (_, k) => xform(cylinder(0.008, 0.02, 12), mat4.c(mat4.rz((2 * PI * k) / 6), mat4.t(0.17, 0, TC.coverZ - 0.018), mat4.rx(PI / 2)))))
  // turbine: front half, splined to the output shaft
  const turbineShell = band(TC.A, TC.A + t, -(PI - g), -0.004)
  const turbineCore = band(TC.B - 0.005, TC.B, -(PI - g), -0.02)
  const turbineBlades = blades(TC.turbineBlades, -(PI - g), -0.02, 0.0022, 0.06)
  const [rt, zt] = tp(TC.A, -(PI - g))
  const turbineHub = axial(ccw([[TC.shaftR, zt - 0.012], [0.026, zt - 0.012], [0.026, zt - 0.004], [rt + 0.002, zt - 0.004], [rt + 0.002, zt + 0.004], [TC.shaftR, zt + 0.004]]), 64)
  const shaft = merge(shaftZ(TC.shaftR, zt - 0.012, 0.3, 32), ringZ(0.05, TC.shaftR, 0.285, 0.297, 48))
  // stator, one-way clutch rollers and the stationary sleeve
  const statorG = stator()
  const roller = xform(cylinder(0.0028, 2 * TC.statorHalf, 12), mat4.rx(PI / 2))
  const sleeve = merge(ringZ(TC.sleeveR1, TC.sleeveR0, -0.02, 0.19, 48))
  const outerRace = ringZ(TC.rollerR + 0.003, TC.sleeveR1, -TC.statorHalf - 0.004, -TC.statorHalf - 0.0005, 48)
  // stationary bell housing (engine at −Z, transmission front wall at +Z) and engine flywheel
  const housing = merge(
    axial(ccw([[TC.housingR - 0.008, -0.16], [TC.housingR, -0.16], [TC.housingR, 0.2], [0.05, 0.2], [0.05, 0.19], [TC.housingR - 0.008, 0.19]]), 96),
  )
  // the converter is driven through a starter-ring flex plate, not a flywheel: its own mass smooths the engine
  const fp = flexPlate({ r: 0.198, t: 0.015 })
  const flywheel = { plate: xform(fp.disc, mat4.t(0, 0, -0.14)), ring: xform(fp.ring, mat4.t(0, 0, -0.14)), crank: shaftZ(0.03, -0.24, -0.155, 32) }
  return {
    impellerShell,
    impellerCore,
    impellerBlades,
    impellerHub,
    cover: merge(cover, lugs),
    turbineShell,
    turbineCore,
    turbineBlades,
    turbineHub,
    shaft,
    stator: statorG,
    roller,
    sleeve: merge(sleeve, outerRace),
    housing,
    flywheel,
  }
}

let cache: ReturnType<typeof buildTcGeometry> | null = null
export const tcGeometry = () => (cache ??= buildTcGeometry())

/** Vortex loop in the meridional plane at angle α: impeller (rear) → outer → turbine → stator → back. */
export function vortexLoop(alpha: number) {
  const R = (TC.A + TC.B) / 2
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 48; i++) {
    const th = PI - (2 * PI * i) / 48
    const [r, z] = tp(R, th)
    pts.push(new THREE.Vector3(r * Math.cos(alpha), r * Math.sin(alpha), z))
  }
  return new THREE.CatmullRomCurve3(pts, false)
}

/** Ring of rotary flow round the axis at radius r and height z. */
export function rotaryRing(r: number, z: number) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < 64; i++) pts.push(new THREE.Vector3(r * Math.cos((2 * PI * i) / 64), r * Math.sin((2 * PI * i) / 64), z))
  return new THREE.CatmullRomCurve3(pts, true)
}
