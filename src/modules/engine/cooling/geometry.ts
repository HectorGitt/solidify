import * as THREE from 'three'
import { box, csg, cylinder, lathe, mat4, merge, pipe, xform, type CsgOp, type V2 } from '@/geometry'
import { beltBand, loopPath } from '@/geometry/parts'
import { AIRC, CRANK_Y, ENG, FAN, PULLEY_Z, PUMP, RAD, THERMO } from './model'
import {
  fan as libFan,
  impeller as libImpeller,
  pumpVolute as libPumpVolute,
  radiatorCap,
  radiatorCore as libRadiatorCore,
  radiatorFrame as libRadiatorFrame,
  radiatorTank,
  thermostatHousing as libThermostatHousing,
  thermostatParts as libThermostatParts,
  tubeXs,
  vPulley,
} from '@/parts/lib/cooling'
import { cylinderLiner } from '@/parts/lib/engine'

const { PI } = Math
const at = (x: number, y: number, z: number) => mat4.t(x, y, z)
const alongZ = mat4.rx(PI / 2)
const alongX = mat4.rz(-PI / 2)
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const curve = (pts: THREE.Vector3[], t = 0.3) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', t)
/** box from min/max corners */
const bx = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => xform(box(x1 - x0, y1 - y0, z1 - z0), at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))

/* ------------------------------ liquid-cooled engine ------------------------------ */

const J = ENG.jacket
const HJ = ENG.headJacket
/** coolant transfer holes through the head gasket face, (x, z) */
const TRANSFER: [number, number][] = ENG.cylZ.flatMap((z) => [
  [-0.062, z + 0.04],
  [0.062, z - 0.04],
])

function block() {
  const outer = bx(-ENG.x, ENG.x, 0, ENG.deck, ENG.z0, ENG.z1)
  const ops: CsgOp[] = [
    { op: 'sub', geometry: bx(-J.x, J.x, J.y0, J.y1, J.z0, J.z1) },
    { op: 'sub', geometry: bx(-ENG.x + 0.012, ENG.x - 0.012, -0.01, 0.1, ENG.z0 + 0.012, ENG.z1 - 0.012) },
  ]
  for (const z of ENG.cylZ) ops.push({ op: 'sub', geometry: xform(cylinder(ENG.linerOuter, 0.24, 40), at(0, 0.2, z)) })
  for (const [x, z] of TRANSFER) ops.push({ op: 'sub', geometry: xform(cylinder(0.006, 0.04, 16), at(x, J.y1 + 0.005, z)) })
  // water-pump outlet into the front of the jacket
  ops.push({ op: 'sub', geometry: xform(cylinder(0.014, 0.05, 20), mat4.c(at(0, PUMP.y - 0.04, ENG.z1), alongZ)) })
  return csg(outer, ops)
}

function liners() {
  const liner = cylinderLiner({ bore: ENG.bore, outer: ENG.linerOuter, y0: 0.08, y1: ENG.deck, segments: 48 })
  return merge(...ENG.cylZ.map((z) => xform(liner, at(0, 0, z))))
}

function head() {
  const outer = bx(-ENG.x, ENG.x, ENG.deck, ENG.headTop, ENG.z0, ENG.z1)
  const ops: CsgOp[] = [{ op: 'sub', geometry: bx(-HJ.x, HJ.x, HJ.y0, HJ.y1, HJ.z0, HJ.z1) }]
  for (const [x, z] of TRANSFER) ops.push({ op: 'sub', geometry: xform(cylinder(0.006, 0.08, 16), at(x, ENG.deck + 0.02, z)) })
  ops.push({ op: 'sub', geometry: xform(cylinder(0.016, 0.06, 24), at(THERMO.x, ENG.headTop - 0.01, THERMO.z)) })
  for (const z of ENG.cylZ) ops.push({ op: 'sub', geometry: xform(cylinder(0.035, 0.02, 32), at(0, ENG.deck + 0.006, z)) })
  return csg(outer, ops)
}

/** One coolant solid: block jacket + transfer holes + head passages + outlet, minus the liners. */
function jacketCoolant() {
  const e = 0.0003
  const base = bx(-J.x + e, J.x - e, J.y0 + e, J.y1 - e, J.z0 + e, J.z1 - e)
  const ops: CsgOp[] = []
  for (const [x, z] of TRANSFER) ops.push({ op: 'add', geometry: xform(cylinder(0.0058, HJ.y0 - J.y1 + 0.004, 16), at(x, (J.y1 + HJ.y0) / 2, z)) })
  ops.push({ op: 'add', geometry: bx(-HJ.x + e, HJ.x - e, HJ.y0 + e, HJ.y1 - e, HJ.z0 + e, HJ.z1 - e) })
  ops.push({ op: 'add', geometry: xform(cylinder(0.0157, ENG.headTop - HJ.y1 + 0.002, 24), at(THERMO.x, (HJ.y1 + ENG.headTop) / 2, THERMO.z)) })
  for (const z of ENG.cylZ) ops.push({ op: 'sub', geometry: xform(cylinder(ENG.linerOuter, 0.24, 40), at(0, 0.2, z)) })
  return csg(base, ops)
}

function sump() {
  const o = bx(-ENG.x, ENG.x, -0.1, 0, ENG.z0, ENG.z1)
  return csg(o, [{ op: 'sub', geometry: bx(-ENG.x + 0.006, ENG.x - 0.006, -0.094, 0.01, ENG.z0 + 0.006, ENG.z1 - 0.006) }])
}

function rockerCover() {
  const o = bx(-ENG.x + 0.006, ENG.x - 0.006, ENG.headTop, ENG.headTop + 0.06, ENG.z0 + 0.01, -0.03)
  return csg(o, [{ op: 'sub', geometry: bx(-ENG.x + 0.012, ENG.x - 0.012, ENG.headTop - 0.01, ENG.headTop + 0.054, ENG.z0 + 0.016, -0.036) }])
}

/* ------------------------------ thermostat ------------------------------ */

/** Housing on the head outlet, local origin at the head top face. Outlet to the top hose on +Z, bypass on −X. */
function thermostatHousing() {
  return libThermostatHousing()
}

function thermostatParts() {
  return libThermostatParts()
}

/* ------------------------------ water pump, fan, belt ------------------------------ */

function pumpVolute() {
  return libPumpVolute()
}

function impeller() {
  return libImpeller()
}

function fan() {
  return libFan(FAN.r)
}

function pulley(r: number) {
  return vPulley(r)
}

export const CRANK_PULLEY_R = 0.065
export const FAN_PULLEY_R = 0.05

function belt() {
  const lp = loopPath(new THREE.Vector2(0, CRANK_Y), CRANK_PULLEY_R - 0.006, new THREE.Vector2(0, PUMP.y), FAN_PULLEY_R - 0.006)
  return xform(beltBand(lp.path, 0.014, 0.009), at(0, 0, PULLEY_Z))
}

/* ------------------------------ radiator ------------------------------ */

const TUBES = 12
export const TUBE_X = tubeXs({ ...RAD, tubes: TUBES })

function radiatorCore() {
  return libRadiatorCore(RAD)
}

function tank(y0: number, y1: number) {
  return radiatorTank(RAD, y0, y1)
}

function radiatorFrame() {
  return libRadiatorFrame(RAD)
}

function capParts() {
  return radiatorCap()
}

/* ------------------------------ hoses (shared with the flows) ------------------------------ */

const tankMidTop = (RAD.y1 + RAD.topY1) / 2
const tankMidBot = (RAD.botY0 + RAD.y0) / 2

export const HOSES = {
  top: curve([V(0, ENG.headTop + 0.038, THERMO.z + 0.03), V(0, ENG.headTop + 0.045, 0.12), V(0, tankMidTop + 0.005, 0.2), V(0, tankMidTop, RAD.tankZ0 + 0.002)]),
  bottom: curve([V(0.15, tankMidBot, RAD.tankZ0 + 0.002), V(0.15, tankMidBot + 0.02, 0.17), V(0.12, PUMP.y - 0.05, 0.12), V(0.068, PUMP.y, PUMP.z)]),
  bypass: curve([V(THERMO.x - 0.03, ENG.headTop + 0.012, THERMO.z), V(-0.06, ENG.headTop - 0.03, 0.09), V(-0.078, PUMP.y + 0.03, PUMP.z + 0.004), V(-0.06, PUMP.y, PUMP.z)]),
}

/* ------------------------------ air-cooled engine (TB Fig 7.1) ------------------------------ */

function finned(y0: number, y1: number, rIn: number, core: number, fin: number, pitch = 0.012, t = 0.003) {
  const prof: V2[] = [
    [rIn, y0],
    [core + 0.01, y0],
    [core + 0.01, y0 + 0.006],
    [core, y0 + 0.006],
  ]
  for (let y = y0 + 0.012; y + t < y1 - 0.004; y += pitch) prof.push([core, y], [fin, y], [fin, y + t], [core, y + t])
  prof.push([core, y1], [rIn, y1])
  return lathe(prof, 56)
}

function airCooled() {
  const crankcase = csg(bx(-0.1, 0.1, -0.06, AIRC.barrelY0, -0.085, 0.085), [
    { op: 'sub', geometry: xform(cylinder(0.07, 0.17, 40), alongX) },
    { op: 'sub', geometry: xform(cylinder(0.046, 0.06, 32), at(0, AIRC.barrelY0, 0)) },
  ])
  const barrel = finned(AIRC.barrelY0, AIRC.barrelY1, 0.045, AIRC.core, AIRC.fin)
  const headG = csg(finned(AIRC.barrelY1, AIRC.headY1, 0, 0.065, 0.1), [
    { op: 'sub', geometry: lathe([[0, AIRC.barrelY1 - 0.001], [0.04, AIRC.barrelY1 - 0.001], [0.03, AIRC.barrelY1 + 0.012], [0, AIRC.barrelY1 + 0.016]], 40) },
  ])
  // cowling: open-ended duct round the cylinder, inlet facing the fan (−X), outlet on +X
  const cowl = csg(bx(-0.15, 0.15, AIRC.barrelY0, AIRC.headY1 + 0.03, -0.14, 0.14), [
    { op: 'sub', geometry: bx(-0.144, 0.2, AIRC.barrelY0 + 0.006, AIRC.headY1 + 0.024, -0.134, 0.134) },
    { op: 'sub', geometry: bx(-0.2, -0.1, AIRC.barrelY0 + 0.01, 0.2, -0.1, 0.1) },
    { op: 'sub', geometry: xform(cylinder(0.072, 0.03, 40), at(0, AIRC.barrelY0, 0)) },
  ])
  const fanBlades: THREE.BufferGeometry[] = [lathe([[0.02, -0.012], [0.07, -0.012], [AIRC.fanR, -0.004], [AIRC.fanR, 0.004], [0.02, 0.004]], 48)]
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * PI * 2
    fanBlades.push(xform(box(AIRC.fanR - 0.06, 0.03, 0.004), mat4.c(mat4.ry(a), at((AIRC.fanR + 0.06) / 2, 0.019, 0))))
  }
  const flywheelFan = xform(merge(...fanBlades), alongX)
  const scroll = csg(xform(lathe([[0, -0.02], [AIRC.fanR + 0.025, -0.02], [AIRC.fanR + 0.025, 0.06], [0, 0.06]], 48), alongX), [
    { op: 'sub', geometry: xform(lathe([[0, -0.016], [AIRC.fanR + 0.018, -0.016], [AIRC.fanR + 0.018, 0.08], [0, 0.08]], 48), alongX) },
    { op: 'sub', geometry: xform(cylinder(0.06, 0.02, 32), mat4.c(at(-0.018, 0, 0), alongX)) },
    { op: 'sub', geometry: bx(-0.015, 0.07, 0.1, 0.2, -0.1, 0.1) },
  ])
  return { crankcase, barrel, head: headG, cowl, flywheelFan, scroll }
}

export const AIR_PATHS = (() => {
  const paths: THREE.CatmullRomCurve3[] = []
  for (const [y, z] of [
    [0.13, -0.08],
    [0.17, 0.06],
    [0.21, -0.03],
    [0.25, 0.09],
    [0.31, -0.06],
    [0.34, 0.03],
  ] as const) {
    paths.push(curve([V(AIRC.fanX - 0.07, 0, z * 0.5), V(AIRC.fanX + 0.01, -0.06, z * 0.6), V(AIRC.fanX + 0.06, y - 0.05, z), V(-0.08, y, z), V(0, y, z * 1.25 + Math.sign(z) * 0.01), V(0.08, y, z), V(0.22, y + 0.02, z)], 0.4))
  }
  return paths
})()

/* ------------------------------ build ------------------------------ */

export function buildStatic() {
  const core = radiatorCore()
  const top = tank(RAD.y1, RAD.topY1)
  const bot = tank(RAD.botY0, RAD.y0)
  const th = thermostatParts()
  const cp = capParts()
  const ac = airCooled()
  return {
    block: block(),
    liners: liners(),
    head: head(),
    coolant: jacketCoolant(),
    sump: sump(),
    rockerCover: rockerCover(),
    thermostatHousing: thermostatHousing(),
    thSeat: th.seat,
    thValve: th.valve,
    thPellet: th.pellet,
    thSpring: th.spring,
    thBridge: th.bridge,
    pumpVolute: pumpVolute(),
    impeller: impeller(),
    fan: fan(),
    fanPulley: pulley(FAN_PULLEY_R),
    crankPulley: pulley(CRANK_PULLEY_R),
    crankNose: xform(cylinder(0.02, PULLEY_Z - ENG.z1 + 0.01, 24), mat4.c(at(0, CRANK_Y, (PULLEY_Z + ENG.z1) / 2), alongZ)),
    pumpShaft: xform(cylinder(0.008, FAN.z - PUMP.z + 0.03, 16), mat4.c(at(0, 0, (FAN.z - PUMP.z) / 2), alongZ)),
    belt: belt(),
    coreTubes: core.tubes,
    coreFins: core.fins,
    coreWater: core.water,
    topTank: top.shell,
    topWater: top.water,
    bottomTank: bot.shell,
    bottomWater: bot.water,
    radFrame: radiatorFrame(),
    capNeck: cp.neck,
    cap: cp.cap,
    capValve: cp.valve,
    capSpring: cp.spring,
    overflow: cp.overflow,
    topHose: pipe(HOSES.top, 0.02, 0.016, 48, 20),
    bottomHose: pipe(HOSES.bottom, 0.02, 0.016, 48, 20),
    bypassHose: pipe(HOSES.bypass, 0.011, 0.008, 40, 16),
    topHoseWater: pipe(HOSES.top, 0.0158, 0, 48, 16),
    bottomHoseWater: pipe(HOSES.bottom, 0.0158, 0, 48, 16),
    bypassWater: pipe(HOSES.bypass, 0.0078, 0, 40, 12),
    airCrankcase: ac.crankcase,
    airBarrel: ac.barrel,
    airHead: ac.head,
    airCowl: ac.cowl,
    airFan: ac.flywheelFan,
    airScroll: ac.scroll,
  }
}

export type CoolingGeometry = ReturnType<typeof buildStatic>

let ready: CoolingGeometry | null = null

export async function prepareCoolingGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('engine/cooling', buildStatic)
  return ready
}

export function buildCoolingGeometry(): CoolingGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
