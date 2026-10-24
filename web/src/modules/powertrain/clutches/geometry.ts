import * as THREE from 'three'
import { box, cylinder, mat4, merge, xform, type V2 } from '@/geometry'
import { bellevilleSpring, clutchDisc, clutchPlate, pressurePlate, releaseBearing, releaseLever } from '@/parts/lib/driveline'
import { flywheel } from '@/parts/lib/engine'
import { axial, coilZ, dogRing, ringZ, shaftZ, spur } from '@/parts/lib/shapes'
import { DC, SP, WP, WP_STACK } from './dims'

/** Clutch geometry (worker-safe). Axis Z, flywheel face at z = 0, gearbox towards +Z. */

const { PI } = Math

/* ------------------------------ shared pieces ------------------------------ */

/**
 * Engine flywheel from the parts library (starter ring gear included; 136 teeth at the default
 * 2.9 mm module on r = 190 mm), its friction face at z = 0. The crank flange meets the boss.
 */
function flywheelSet() {
  const fw = flywheel({ r: SP.flyR, width: 0.055 })
  const boss = 0.03 * (SP.flyR / 0.15)
  const crank = merge(axial([[0, -boss - 0.02], [0.075, -boss - 0.02], [0.075, -boss], [0, -boss]], 48), shaftZ(0.045, -0.24, -boss - 0.02, 40))
  return { body: fw.disc, ring: fw.ring, crank }
}

/** Friction disc: hub, steel core and a lining on each face. z = 0 is the flywheel face. */
const disc = (Ro: number, Ri: number, hubZ0: number, hubZ1: number, bore: number) => clutchDisc({ Ro, Ri, lining: SP.lining, core: SP.core, bore, hubR: 0.05, hubZ0, hubZ1 })

/** Pressure plate with lugs for the lever struts (z from 0 to thickness). */
const pressurePlateL = (rIn: number, rOut: number, t: number, lugs: number, lugR: number) => pressurePlate({ rIn, rOut, t, lugs, lugR })

/** Release lever drawn in its radial plane (X = radius, Z = axial), pivot at the origin. */
const lever = (rIn: number, rPivot: number, rOut: number, zIn: number, zOut: number) => releaseLever({ rIn, rPivot, rOut, zIn, zOut })

function bellHousing(zEnd: number) {
  return axial(
    [
      [0.235, -0.03],
      [0.25, -0.03],
      [0.25, zEnd - 0.06],
      [0.12, zEnd],
      [0.045, zEnd],
      [0.045, zEnd - 0.012],
      [0.115, zEnd - 0.012],
      [0.235, zEnd - 0.068],
    ],
    96,
  )
}

/** Gearbox stub: input gear on the input shaft and a layshaft gear below it. */
export const BOX = { z: 0.33, m: 0.004, zIn: 20, zLay: 34, lay: -(0.004 * (20 + 34)) / 2 }
function gearboxStub(zFront: number) {
  const casing = merge(
    xform(box(0.2, 0.012, 0.18), mat4.t(0, 0.07, BOX.z)),
    xform(box(0.2, 0.012, 0.18), mat4.t(0, BOX.lay - 0.09, BOX.z)),
    xform(box(0.012, BOX.lay * -1 + 0.148, 0.18), mat4.t(-0.1, (0.064 + BOX.lay - 0.084) / 2, BOX.z)),
  )
  const front = xform(box(0.2, 0.28, 0.012), mat4.t(0, -0.04, zFront))
  return {
    casing: merge(casing, front),
    inputGear: spur(BOX.zIn, BOX.m, 0.026, 0.02, 3),
    layGear: spur(BOX.zLay, BOX.m, 0.026, 0.016, 3),
    layShaft: shaftZ(0.016, BOX.z - 0.09, BOX.z + 0.09, 24),
  }
}

/** Release fork on its cross-shaft (pivot on the X axis at y = forkY), arm up to the bearing collar. */
export const FORK = { y: -0.09, z: 0.11, outX: 0.29 }
function fork() {
  const arm = merge(
    xform(box(0.012, 0.09, 0.012), mat4.t(0.058, 0.045, 0)),
    xform(box(0.012, 0.09, 0.012), mat4.t(-0.058, 0.045, 0)),
    xform(box(0.128, 0.012, 0.012), mat4.t(0, 0.006, 0)),
  )
  const shaft = xform(cylinder(0.009, FORK.outX + 0.03, 20), mat4.c(mat4.t((FORK.outX + 0.03) / 2 - 0.03, 0, 0), mat4.rz(PI / 2)))
  const outer = xform(box(0.014, 0.16, 0.02), mat4.t(FORK.outX, -0.08, 0))
  return { arm, shaft: merge(shaft), outer }
}

/* ------------------------------ actuation ------------------------------ */

export const PEDAL = { x: FORK.outX + 0.03, pivot: [0, -0.36, 0.36] as [number, number, number], len: 0.36 }
function pedalSet() {
  const arm = merge(xform(box(0.016, PEDAL.len, 0.02), mat4.t(0, PEDAL.len / 2, 0)), xform(box(0.07, 0.012, 0.045), mat4.t(0, PEDAL.len, 0.012)))
  const pivot = xform(cylinder(0.014, 0.05, 20), mat4.rz(PI / 2))
  const rod = xform(cylinder(0.006, 1, 12), mat4.t(0, 0.5, 0))
  const master = merge(xform(cylinder(0.018, 0.1, 24), mat4.rx(PI / 2)), xform(cylinder(0.022, 0.05, 24), mat4.t(0, 0.05, -0.02)))
  const slave = xform(cylinder(0.016, 0.08, 24), mat4.rx(PI / 2))
  const motor = merge(xform(cylinder(0.03, 0.09, 24), mat4.rx(PI / 2)), xform(box(0.05, 0.04, 0.05), mat4.t(0, 0.04, 0.02)))
  const sw = box(0.05, 0.03, 0.04)
  return { arm, pivot, rod, master, slave, motor, sw }
}

/* ------------------------------ single plate ------------------------------ */

function single() {
  const d = disc(SP.Ro, SP.Ri, -0.012, 0.026, SP.shaftR + 0.001)
  const pp = pressurePlateL(SP.ppIn, SP.ppOut, SP.ppT, SP.levers, SP.leverOut)
  // pressed-steel cover, its flange bolted to the flywheel face (z = 0)
  const cover = axial(
    [
      [0.162, 0],
      [0.19, 0],
      [0.19, 0.006],
      [0.168, 0.006],
      [0.168, SP.coverZ + 0.006],
      [0.07, SP.coverZ + 0.006],
      [0.07, SP.coverZ],
      [0.162, SP.coverZ],
    ],
    96,
  )
  const lev = lever(SP.leverIn, SP.leverPivot, SP.leverOut, 0.022, -0.022)
  const eyes: THREE.BufferGeometry[] = []
  for (let i = 0; i < SP.levers; i++) {
    const a = (2 * PI * i) / SP.levers
    eyes.push(xform(box(0.016, 0.01, 0.03), mat4.c(mat4.rz(a), mat4.t(SP.leverPivot, 0, SP.coverZ - 0.012))))
  }
  return { disc: d, pp, cover, lever: lev, eyes: merge(...eyes), spring: coilZ(SP.springCoil, 0.0026, 6) }
}

/* ------------------------------ dual (live PTO) ------------------------------ */

function dual() {
  const primary = disc(DC.pRo, DC.pRi, -0.012, 0.024, SP.shaftR + 0.001)
  const secondary = disc(DC.sRo, DC.sRi, -0.008, 0.026, DC.ptoOut + 0.001)
  const pp1 = pressurePlateL(0.082, 0.145, DC.ppT, 3, 0.145)
  const pp2 = ringZ(0.14, 0.076, 0, DC.spT, 96)
  const falseFly = axial(
    [
      [0.074, DC.ffZ0],
      [0.158, DC.ffZ0],
      [0.158, 0.0],
      [0.1715, 0.0],
      [0.1715, DC.ffZ1],
      [0.074, DC.ffZ1],
    ],
    96,
  )
  // dished Belleville spring between the secondary pressure plate and the cover
  const z0 = DC.spZ + DC.spT
  const belleville = bellevilleSpring({ rIn: 0.08, rOut: 0.138, rise: 0.011, t: 0.0022, z0: z0 + 0.001 })
  const cover = axial(
    [
      [0.158, DC.ffZ1],
      [0.172, DC.ffZ1],
      [0.172, DC.coverZ + 0.006],
      [0.07, DC.coverZ + 0.006],
      [0.07, DC.coverZ],
      [0.158, DC.coverZ],
    ],
    96,
  )
  const lev = lever(0.05, 0.128, 0.15, 0.02, -0.006)
  const rod = shaftZ(0.0045, 0, 1, 12)
  const setScrew = xform(cylinder(0.005, 0.02, 12), mat4.rx(PI / 2))
  const ptoShaft = ringZ(DC.ptoOut, DC.ptoIn, 0.09, 0.3, 48)
  const ptoGear = spur(26, 0.004, 0.022, DC.ptoIn, 3)
  return { primary, secondary, pp1, pp2, falseFly, belleville, cover, lever: lev, rod, setScrew, ptoShaft, ptoGear, spring: coilZ(0.011, 0.0024, 5) }
}

/* ------------------------------ wet multi-plate IPTO ------------------------------ */

export const IP = {
  packEnd: 0.04,
  packStart: 0.04 - WP_STACK,
  cylZ0: -0.03,
  /** piston face at rest is at cylZ0 + 0.01 + pistonLen = 0.0135 */
  pistonLen: 0.0335,
  /** piston stroke to clamp the pack (exaggerated) */
  stroke: 0.0015,
  bellevilleZ: 0.0135,
}
function ipto() {
  const input = merge(shaftZ(0.025, -0.3, 0.038, 32))
  // hub with the annular piston cylinder (open towards +Z)
  const body = axial(
    [
      [0.025, IP.cylZ0],
      [0.104, IP.cylZ0],
      [0.104, 0.008],
      [WP.pistonOut + 0.0005, 0.008],
      [WP.pistonOut + 0.0005, IP.cylZ0 + 0.01],
      [WP.pistonIn - 0.0005, IP.cylZ0 + 0.01],
      [WP.pistonIn - 0.0005, 0.0],
      [WP.hubR, 0.0],
      [WP.hubR, 0.038],
      [0.025, 0.038],
    ],
    96,
  )
  const hubTeeth = xform(dogRing(24, WP.hubR - 0.001, WP.hubR + 0.0025, 0.03, 0.036), mat4.t(0, 0, 0.019))
  const piston = axial(
    [
      [WP.pistonIn, 0],
      [WP.pistonOut, 0],
      [WP.pistonOut, IP.pistonLen],
      [WP.pistonIn, IP.pistonLen],
    ],
    96,
  )
  // friction plates splined to the hub, steel inter-plates lugged into the drum
  const fr = clutchPlate({ rOut: WP.fOut, rIn: WP.hubR + 0.003, t: WP.plateT, n: 24, depth: 0.0027, teeth: 'inner' })
  const st = clutchPlate({ rOut: WP.sOut, rIn: WP.sIn, t: WP.steelT, n: 30, depth: WP.drumIn - 0.0005 - WP.sOut, teeth: 'outer' })
  const drum = axial(
    [
      [WP.drumIn, 0.014],
      [WP.drumOut, 0.014],
      [WP.drumOut, IP.packEnd + 0.01],
      [0.025, IP.packEnd + 0.01],
      [0.025, IP.packEnd],
      [WP.drumIn, IP.packEnd],
    ],
    96,
  )
  const output = shaftZ(0.025, IP.packEnd + 0.01, 0.34, 32)
  const ptoStub = xform(box(0.03, 0.03, 0.06), mat4.t(0, 0, 0.36))
  // dished Belleville spring between piston and pack: returns the piston when the oil is released
  const belleville = bellevilleSpring({ rIn: 0.058, rOut: 0.094, rise: 0.0025, t: 0.0015, segments: 64 })
  const pad = box(0.06, 0.012, 0.04)
  const valve = merge(xform(box(0.07, 0.07, 0.06), mat4.t(0, 0, 0)), xform(cylinder(0.008, 0.06, 16), mat4.t(0, -0.06, 0)))
  const spool = xform(cylinder(0.011, 0.09, 20), mat4.rz(PI / 2))
  const filter = xform(cylinder(0.03, 0.12, 32), mat4.rz(PI / 2))
  const pump = axial(
    [
      [0.03, -0.24],
      [0.12, -0.24],
      [0.12, -0.1],
      [0.03, -0.1],
    ],
    64,
  )
  const housing = merge(xform(box(0.32, 0.014, 0.62), mat4.t(0, -0.17, 0.03)), xform(box(0.014, 0.33, 0.62), mat4.t(-0.16, -0.0, 0.03)))
  return { input, body, hubTeeth, piston, friction: fr, steel: st, drum, output, ptoStub, belleville, pad, valve, spool, filter, pump, housing }
}

/* ------------------------------ build ------------------------------ */

export function buildStatic() {
  return {
    flywheel: flywheelSet(),
    bearing: releaseBearing({ rIn: SP.bearingIn, rOut: SP.bearingOut }),
    bell: bellHousing(0.24),
    box: gearboxStub(0.24),
    fork: fork(),
    pedal: pedalSet(),
    inputShaft: shaftZ(SP.shaftR, -0.03, 0.43, 32),
    quill: ringZ(0.032, 0.022, 0.09, 0.24, 48),
    single: single(),
    dual: dual(),
    ipto: ipto(),
  }
}

export type ClutchGeometry = ReturnType<typeof buildStatic>

let ready: ClutchGeometry | null = null

export async function prepareClutchGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('powertrain/clutches', buildStatic)
  return ready
}

export function getClutchGeometry(): ClutchGeometry {
  if (!ready) ready = buildStatic()
  return ready
}

export type { V2 }
