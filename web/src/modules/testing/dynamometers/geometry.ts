import * as THREE from 'three'
import { box, cylinder, gear, lathe, mat4, merge, pipe, tube, xform } from '@/geometry'
import { torus } from '@/geometry/parts'
import { absorberCasing, absorberWater, columnLoadCell, cradleBearings, dialGauge, gaugeNeedle, springBalance as springBalanceParts, vanedRotor, type AbsorberSpec } from '@/parts/lib/chassis'
import { toLeft, wheel } from '@/parts/lib/wheels'
import { SHAFT_Y } from './model'

/**
 * Test-bed geometry (main thread, no CSG). Frame: X along the shafts, Y up, metres.
 * Revolved parts are built about Y and laid along X with AX.
 */

const { PI, cos, sin } = Math
const AX = mat4.rz(-PI / 2)
const alongX = (g: THREE.BufferGeometry) => xform(g, AX)
const at = (g: THREE.BufferGeometry, x: number, y: number, z: number) => xform(g, mat4.t(x, y, z))
const Y = SHAFT_Y
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const curve = (pts: [number, number, number][]) => new THREE.CatmullRomCurve3(pts.map((p) => v3(...p)), false, 'catmullrom', 0.3)

/** Positions shared with the scene. */
export const POS = {
  pulleyX: 0.15,
  casingX: 0.3,
  casingHalf: 0.18,
  casingR: 0.26,
  rotorXs: [-0.09, 0, 0.09],
  dcX: 0.32,
}

/* ------------------------------ test bed & engine ------------------------------ */

function bed() {
  const plate = at(box(2.3, 0.1, 0.9), -0.2, 0.05, 0)
  const rails = [-0.25, 0.25].map((z) => at(box(2.2, 0.025, 0.06), -0.2, 0.1125, z))
  return merge(plate, ...rails)
}

function engine() {
  const block = at(box(0.56, 0.34, 0.3), -0.86, Y + 0.08, 0)
  const head = at(box(0.54, 0.1, 0.27), -0.86, Y + 0.3, 0)
  const sump = at(box(0.5, 0.16, 0.26), -0.86, Y - 0.17, 0)
  const bell = alongX(lathe([[0, 0], [0.23, 0], [0.23, 0.04], [0.2, 0.1], [0, 0.1]], 48))
  const feet = [-1.05, -0.67].flatMap((x) => [-0.17, 0.17].map((z) => at(box(0.08, 0.36, 0.06), x, 0.28, z)))
  return { block: merge(block, head, sump, ...feet), bell: at(bell, -0.58, Y, 0) }
}

function rockerCover() {
  return at(box(0.5, 0.07, 0.22), -0.86, Y + 0.385, 0)
}

function exhaustPipe() {
  return pipe(curve([[-0.98, Y + 0.24, 0.15], [-0.98, Y + 0.26, 0.24], [-1.0, Y + 0.5, 0.26], [-1.0, Y + 0.75, 0.26]]), 0.028, 0.022, 32, 14)
}

/** Output shaft + coupling (unit frame on the shaft axis, X along the shaft). */
function outputShaft(x0: number, x1: number) {
  const s = at(alongX(cylinder(0.03, x1 - x0, 24)), (x0 + x1) / 2, 0, 0)
  const flanges = [-0.25, -0.22].map((x) => at(alongX(cylinder(0.075, 0.025, 32)), x, 0, 0))
  return merge(s, ...flanges)
}

/* ------------------------------ Prony brake (Fig 15.2) ------------------------------ */

function prony() {
  const x = POS.pulleyX
  const pulley = alongX(
    lathe(
      [
        [0.032, -0.07],
        [0.07, -0.07],
        [0.07, -0.015],
        [0.17, -0.015],
        [0.17, -0.06],
        [0.2, -0.06],
        [0.2, 0.06],
        [0.17, 0.06],
        [0.17, 0.015],
        [0.07, 0.015],
        [0.07, 0.07],
        [0.032, 0.07],
      ],
      64,
    ),
  )
  const n = 14
  const blocks: THREE.BufferGeometry[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 2 * PI
    const b = box(0.1, 0.034, 0.075)
    b.applyMatrix4(new THREE.Matrix4().makeRotationX(a).setPosition(x, Y + 0.218 * cos(a), 0.218 * sin(a)))
    blocks.push(b)
  }
  const band = at(alongX(tube(0.247, 0.236, 0.07, 72)), x, Y, 0)
  // clamp lugs at −Z joined by the screw of handwheel c
  const lugs = [0.035, -0.035].map((dy) => at(box(0.06, 0.03, 0.08), x, Y + dy, -0.27))
  const screw = at(xform(cylinder(0.008, 0.2, 12), mat4.rx(PI / 2)), x, Y, -0.36)
  const wheel = merge(
    at(torus(0.06, 0.008, 10, 40), x, Y, -0.46),
    ...[0, 1, 2].map((k) => {
      const g = box(0.008, 0.12, 0.008)
      g.applyMatrix4(new THREE.Matrix4().makeRotationZ((k * PI) / 3).setPosition(x, Y, -0.46))
      return g
    }),
  )
  const shaft = at(alongX(cylinder(0.032, 0.72, 20)), 0.13, 0, 0)
  return { pulley: merge(at(pulley, x, 0, 0), shaft), blocks: merge(...blocks), band: merge(band, ...lugs), screw, wheel, bearing: bearingPedestal(0.42) }
}

/** Plain pedestal bearing for the brake shaft. */
function bearingPedestal(x: number) {
  const ped = at(box(0.1, Y - 0.1, 0.2), x, (Y + 0.1) / 2 - 0.02, 0)
  const cap = at(alongX(tube(0.075, 0.032, 0.09, 40)), x, Y, 0)
  return merge(ped, cap)
}

/** Unit-length bar along +Z (scale z to the arm length). */
export function armBar(w = 0.03, h = 0.05) {
  return at(box(w, h, 1), 0, 0, 0.5)
}

/** Spring balance hanging from a gantry: body origin at the arm end (parts library). */
const springBalance = springBalanceParts

function gantry(height: number) {
  const post = at(box(0.06, height, 0.06), 0, height / 2, 0.14)
  const beam = at(box(0.06, 0.05, 0.2), 0, height, 0.07)
  return merge(post, beam)
}

/* ------------------------------ hydraulic dynamometer (Fig 15.3) ------------------------------ */

const FIN_YS = [-0.135, -0.045, 0.045, 0.135]
/** the test-bed water brake (Fig 15.3): absorber casing with four stator fins */
const HYD: AbsorberSpec = { R: POS.casingR, half: POS.casingHalf, cav: 0.23, bore: 0.04, fins: FIN_YS, finTip: 0.205 }

function hydraulic() {
  const x = POS.casingX
  const H = POS.casingHalf
  const casing = at(absorberCasing(HYD), x, Y, 0)
  // water fills the cavity around the fins; trunnions swing in ball cradle bearings on pedestals
  const water = at(absorberWater(HYD), x, Y, 0)
  const cb = cradleBearings({ half: H })
  const peds = [-1, 1].map((s) => at(box(0.09, Y - 0.1 - 0.1, 0.3), x + s * (H + 0.04), (Y - 0.1 + 0.1) / 2 + 0.0, 0))
  // rotors: discs with radial vanes on both faces, in shaft-local frame
  const rotor = vanedRotor()
  const rotors = POS.rotorXs.map((rx) => at(rotor, x + rx, 0, 0))
  const shaft = at(alongX(cylinder(0.035, 0.77, 24)), 0.165, 0, 0)
  // intake, needle valves, exhaust, gauge, thermometer
  const top = Y + POS.casingR
  const intake = pipe(curve([[x + 0.16, top + 0.5, 0], [x + 0.16, top + 0.25, 0], [x + 0.1, top + 0.13, 0], [x - 0.12, top + 0.12, 0]]), 0.024, 0.018, 40, 14)
  const needles = POS.rotorXs.map((rx) => merge(at(cylinder(0.012, 0.13, 14), x + rx, top + 0.055, 0), at(cylinder(0.02, 0.03, 16), x + rx, top + 0.15, 0), at(box(0.06, 0.008, 0.008), x + rx, top + 0.17, 0)))
  const intakeValve = merge(at(box(0.07, 0.07, 0.07), x + 0.16, top + 0.38, 0), at(xform(torus(0.045, 0.006, 8, 32), mat4.ry(PI / 2)), x + 0.25, top + 0.38, 0), at(alongX(cylinder(0.006, 0.09, 8)), x + 0.205, top + 0.38, 0))
  const exhaustCtl = merge(at(cylinder(0.014, 0.16, 12), x - 0.14, top + 0.04, 0.05), at(xform(torus(0.04, 0.006, 8, 32), mat4.rx(PI / 2)), x - 0.14, top + 0.13, 0.05))
  const gauge = merge(at(cylinder(0.008, 0.12, 10), x + 0.1, top + 0.03, 0.12), at(dialGauge(0.06, 0.03), x + 0.1, top + 0.12, 0.12))
  const outlet = pipe(curve([[x, Y - POS.casingR + 0.01, 0], [x, Y - POS.casingR - 0.08, 0], [x + 0.2, Y - POS.casingR - 0.12, 0], [x + 0.5, Y - POS.casingR - 0.12, 0]]), 0.03, 0.024, 40, 14)
  const thermo = merge(at(cylinder(0.012, 0.16, 16), x + 0.38, Y - POS.casingR - 0.02, 0), at(lathe([[0, 0], [0.02, 0], [0.02, 0.03], [0, 0.03]], 16), x + 0.38, Y - POS.casingR - 0.11, 0))
  return {
    casing: merge(casing, at(cb.trunnions, x, Y, 0)),
    water,
    cradles: at(cb.cradles, x, Y, 0),
    peds: merge(...peds),
    rotors: merge(...rotors),
    shaft,
    intake: merge(intake, intakeValve, ...needles),
    exhaustCtl,
    gauge,
    outlet,
    thermo,
  }
}

/** Water path for the flow particles (world). */
export function waterPath() {
  const x = POS.casingX
  const top = Y + POS.casingR
  const pts: [number, number, number][] = [
    [x + 0.16, top + 0.5, 0],
    [x + 0.16, top + 0.25, 0],
    [x + 0.06, top + 0.13, 0],
    [x, top + 0.12, 0],
    [x, top - 0.05, 0],
  ]
  // swirl round the rotors inside the casing
  for (let i = 1; i <= 24; i++) {
    const a = PI / 2 + (i / 24) * 2 * PI * 1.75
    const r = 0.15 + 0.05 * sin(i * 0.9)
    pts.push([x - 0.12 + (0.24 * i) / 24, Y + r * sin(a), r * cos(a)])
  }
  pts.push([x, Y - POS.casingR - 0.05, 0], [x + 0.2, Y - POS.casingR - 0.12, 0], [x + 0.5, Y - POS.casingR - 0.12, 0])
  return new THREE.CatmullRomCurve3(pts.map((p) => v3(...p)))
}

/* ------------------------------ eddy-current dynamometer ------------------------------ */

function eddy() {
  const x = POS.casingX
  const H = 0.16
  const stator = at(absorberCasing({ R: 0.27, half: H, cav: 0.235, bore: 0.04 }), x, Y, 0)
  const cb = cradleBearings({ half: H })
  const peds = [-1, 1].map((s) => at(box(0.09, Y - 0.2, 0.3), x + s * (H + 0.04), Y / 2 + 0.05, 0))
  const rotor = merge(at(xform(gear({ teeth: 14, module: 0.026, width: 0.07, bore: 0.03 }), mat4.ry(PI / 2)), x, 0, 0), at(alongX(cylinder(0.035, 0.77, 24)), 0.165, 0, 0))
  const coils = [-1, 1].map((s) => at(xform(torus(0.2, 0.026, 12, 64), mat4.ry(PI / 2)), x + s * 0.075, Y, 0))
  const top = Y + 0.27
  const pipes = [
    pipe(curve([[x - 0.08, top + 0.35, 0.05], [x - 0.08, top + 0.12, 0.05], [x - 0.08, top - 0.01, 0.05]]), 0.02, 0.015, 24, 12),
    pipe(curve([[x + 0.08, top - 0.01, 0.05], [x + 0.08, top + 0.12, 0.05], [x + 0.12, top + 0.25, 0.05], [x + 0.35, top + 0.3, 0.05]]), 0.02, 0.015, 24, 12),
  ]
  return { stator: merge(stator, at(cb.trunnions, x, Y, 0)), cradles: at(cb.cradles, x, Y, 0), peds: merge(...peds), rotor, coils: merge(...coils), pipes: merge(...pipes) }
}

export function coolantPath() {
  const x = POS.casingX
  const top = Y + 0.27
  return curve([
    [x - 0.08, top + 0.35, 0.05],
    [x - 0.08, top + 0.02, 0.05],
    [x - 0.06, Y + 0.24, 0.1],
    [x, Y + 0.24, 0.12],
    [x + 0.06, Y + 0.24, 0.1],
    [x + 0.08, top + 0.02, 0.05],
    [x + 0.1, top + 0.22, 0.05],
    [x + 0.35, top + 0.3, 0.05],
  ])
}

/* ------------------------------ DC cradle dynamometer (Fig 15.4) ------------------------------ */

function dc() {
  const x = POS.dcX
  const H = 0.26
  const frame = at(absorberCasing({ R: 0.3, half: H, cav: 0.26, bore: 0.05 }, 80), x, Y, 0)
  const poles: THREE.BufferGeometry[] = []
  for (let i = 0; i < 4; i++) {
    const a = PI / 4 + (i / 4) * 2 * PI
    const p = box(0.32, 0.05, 0.12)
    p.applyMatrix4(new THREE.Matrix4().makeRotationX(a).setPosition(x, Y + 0.232 * cos(a), 0.232 * sin(a)))
    poles.push(p)
  }
  const cb = cradleBearings({ half: H, trunnionR: 0.1, bore: 0.05 })
  const peds = [-1, 1].map((s) => at(box(0.1, Y - 0.2, 0.36), x + s * (H + 0.04), Y / 2 + 0.05, 0))
  const armature = merge(at(alongX(cylinder(0.18, 0.34, 48)), x, 0, 0), at(alongX(cylinder(0.11, 0.08, 32)), x - 0.21, 0, 0), at(alongX(cylinder(0.04, 1.0, 24)), 0.2, 0, 0))
  const grille = at(alongX(cylinder(0.24, 0.02, 48)), x + H + 0.005, Y, 0)
  // resistor bank (load) beside the bed
  const bankX = 0.35
  const bankZ = -0.7
  const rods: THREE.BufferGeometry[] = [at(box(0.6, 0.04, 0.3), bankX, 0.6, bankZ), at(box(0.6, 0.04, 0.3), bankX, 1.0, bankZ)]
  for (let i = 0; i < 9; i++) for (const dz of [-0.08, 0.08]) rods.push(at(cylinder(0.012, 0.36, 10), bankX - 0.24 + i * 0.06, 0.8, bankZ + dz))
  for (const [dx, dz] of [[-0.28, -0.13], [0.28, -0.13], [-0.28, 0.13], [0.28, 0.13]]) rods.push(at(box(0.03, 1.0, 0.03), bankX + dx, 0.5, bankZ + dz))
  const cable = pipe(curve([[x, Y - 0.2, -0.22], [x, 0.25, -0.4], [bankX, 0.3, -0.55], [bankX, 0.58, bankZ + 0.1]]), 0.014, 0, 32, 10)
  return { frame: merge(frame, at(cb.trunnions, x, Y, 0)), poles: merge(...poles), cradles: at(cb.cradles, x, Y, 0), peds: merge(...peds), armature, grille, bank: merge(...rods), cable }
}

/* ------------------------------ PTO shop dynamometer (Fig 15.5) ------------------------------ */

/** Cart local frame: input shaft on the X axis at the origin, ground at y = −yShaft. */
function ptoCart(yShaft: number) {
  const g = -yShaft
  const spec: AbsorberSpec = { R: 0.2, half: 0.15, cav: 0.17, bore: 0.035, fins: [-0.05, 0.05], finTip: 0.16 }
  const absorber = at(absorberCasing(spec, 64), 0.35, 0, 0)
  const water = at(absorberWater(spec, 48), 0.35, 0, 0)
  const disc = vanedRotor({ r: 0.14, t: 0.02, vanes: 12, vaneR: 0.095, vaneLen: 0.08 })
  const rotor = merge(at(alongX(cylinder(0.03, 0.7, 20)), 0.25, 0, 0), ...[-0.08, 0, 0.08].map((dx) => at(disc, 0.35 + dx, 0, 0)))
  const frame = merge(
    at(box(0.9, 0.05, 0.6), 0.45, g + 0.25, 0),
    ...[0.1, 0.6].map((xx) => at(box(0.05, 0.23, 0.08), xx, -0.11, 0)),
    ...[0.1, 0.6].map((xx) => at(alongX(tube(0.06, 0.03, 0.06, 24)), xx, 0, 0)),
    at(box(0.06, 0.23, 0.06), 0.05, g + 0.115, 0),
    at(box(0.04, 0.49, 0.04), 0.42, 0.02, -0.27),
  )
  // castor-type cart wheels (parts library): tyre, and rim + hub turned outward on each side
  const w = wheel({ radius: 0.24, width: 0.1, rimRadius: 0.14, pattern: 'smooth' })
  const wheels = [-1, 1].map((s) => at(w.tyre, 0.62, g + 0.24, s * 0.37))
  const rims = [-1, 1].flatMap((s) => [w.rim, ...(w.hub ? [w.hub] : [])].map((q) => at(s > 0 ? q : toLeft(q), 0.62, g + 0.24, s * 0.37)))
  const axle = at(xform(cylinder(0.02, 0.84, 12), mat4.rx(PI / 2)), 0.62, g + 0.24, 0)
  const handle = pipe(curve([[0.05, g + 0.34, 0.25], [-0.05, g + 0.6, 0.25], [-0.1, g + 0.9, 0.25], [-0.1, g + 0.9, -0.25], [-0.05, g + 0.6, -0.25], [0.05, g + 0.34, -0.25]]), 0.016, 0, 48, 10)
  const panel = at(box(0.36, 0.34, 0.08), 0.42, 0.43, -0.2)
  const dials = [0.34, 0.5].map((dx) => at(toLeft(dialGauge(0.06, 0.02)), dx, 0.46, -0.245))
  const armCyl = merge(at(cylinder(0.03, 0.2, 20), 0.35, -0.12, 0.42), at(cylinder(0.012, 0.06, 10), 0.35, 0, 0.42))
  return { absorber, water, rotor, frame: merge(frame, axle), wheels: merge(...wheels), rims: merge(...rims), handle, panel, dials: merge(...dials), armCyl }
}

/** Telescopic PTO drive shaft with two Hooke's-joint yokes, along X from 0 to length (unit frame). */
function ptoShaft(length: number) {
  const tubeG = at(alongX(tube(0.03, 0.022, length - 0.2, 24)), length / 2, 0, 0)
  const inner = at(alongX(cylinder(0.02, length - 0.12, 16)), length / 2, 0, 0)
  const yoke = (xx: number, rot: number) => {
    const arms = [-1, 1].map((s) => at(box(0.06, 0.016, 0.02), xx, s * 0.035, 0))
    const g = merge(at(alongX(cylinder(0.035, 0.03, 24)), xx + (xx < length / 2 ? 0.04 : -0.04), 0, 0), ...arms)
    return xform(g, mat4.rx(rot))
  }
  const cross = (xx: number) => merge(at(xform(cylinder(0.01, 0.09, 10), mat4.rx(PI / 2)), xx, 0, 0), at(cylinder(0.01, 0.09, 10), xx, 0, 0))
  return merge(tubeG, inner, yoke(0.05, 0), yoke(0.1, PI / 2), cross(0.075), yoke(length - 0.05, 0), yoke(length - 0.1, PI / 2), cross(length - 0.075))
}

/* ------------------------------ build ------------------------------ */

export function buildDynoGeometry() {
  const e = engine()
  return {
    bed: bed(),
    engine: e.block,
    bell: e.bell,
    cover: rockerCover(),
    exhaust: exhaustPipe(),
    output: outputShaft(-0.5, -0.12),
    prony: prony(),
    springBalance: springBalance(),
    gantry: gantry(1.25),
    arm: armBar(),
    hydraulic: hydraulic(),
    eddy: eddy(),
    dc: dc(),
    cart: ptoCart(0.5),
    ptoShaft: ptoShaft(0.62),
    loadCell: columnLoadCell(),
    dialNeedle: gaugeNeedle(0.045, 0.004, 0.004),
  }
}

let cache: ReturnType<typeof buildDynoGeometry> | null = null
export function dynoGeometry() {
  return (cache ??= buildDynoGeometry())
}
