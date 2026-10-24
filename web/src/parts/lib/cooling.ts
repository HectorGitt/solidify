import * as THREE from 'three'
import { box, csg, cylinder, extrude, helixSpring, lathe, mat4, merge, pipe, tube, xform, type V2 } from '@/geometry'
import { vPulley as enginePulley } from './engine'

/**
 * Shared parts library — liquid cooling: tube-and-fin radiator with top and bottom tanks, pressure
 * cap, centrifugal water pump (volute and impeller), fan, V-pulley and thermostat. Moved from the
 * cooling scene, which now uses it, as does the whole-tractor view. Worker-safe (some CSG).
 *
 * Radiator local frame: core in the XY plane (width along X, tubes vertical along Y), air passing
 * along Z between z0 and z1. Pump, fan and pulley: axis along Z.
 */

const { PI } = Math
const at = (x: number, y: number, z: number) => mat4.t(x, y, z)
const alongZ = mat4.rx(PI / 2)
const alongX = mat4.rz(-PI / 2)
const bx = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => xform(box(x1 - x0, y1 - y0, z1 - z0), at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))

export interface RadiatorSpec {
  /** half the core width */
  x: number
  /** core bottom and top */
  y0: number
  y1: number
  /** core depth (air side) */
  z0: number
  z1: number
  /** tank depth, slightly more than the core */
  tankZ0: number
  tankZ1: number
  /** bottom of the bottom tank, top of the top tank */
  botY0: number
  topY1: number
  tubes?: number
  fins?: number
}

/** x positions of the radiator's water tubes */
export const tubeXs = (r: RadiatorSpec) => {
  const n = r.tubes ?? 12
  return Array.from({ length: n }, (_, i) => -r.x + 0.02 + (i * (2 * r.x - 0.04)) / (n - 1))
}

export function radiatorCore(r: RadiatorSpec) {
  const h = r.y1 - r.y0
  const zc = (r.z0 + r.z1) / 2
  const xs = tubeXs(r)
  const tubes = xs.map((x) => csg(bx(x - 0.003, x + 0.003, r.y0 - 0.004, r.y1 + 0.004, r.z0, r.z1), [{ op: 'sub', geometry: bx(x - 0.002, x + 0.002, r.y0 - 0.01, r.y1 + 0.01, r.z0 + 0.002, r.z1 - 0.002) }]))
  const fins: THREE.BufferGeometry[] = []
  const nf = r.fins ?? 30
  for (let i = 0; i < nf; i++) fins.push(xform(box(2 * r.x - 0.012, 0.0008, r.z1 - r.z0 + 0.004), at(0, r.y0 + ((i + 0.5) / nf) * h, zc)))
  const water = merge(...xs.map((x) => bx(x - 0.0019, x + 0.0019, r.y0 - 0.004, r.y1 + 0.004, r.z0 + 0.0021, r.z1 - 0.0021)))
  return { tubes: merge(...tubes), fins: merge(...fins), water }
}

/** A header tank spanning y0…y1 (the top tank keeps an air space above the coolant). */
export function radiatorTank(r: RadiatorSpec, y0: number, y1: number) {
  const o = bx(-r.x - 0.012, r.x + 0.012, y0, y1, r.tankZ0, r.tankZ1)
  const i = bx(-r.x - 0.008, r.x + 0.008, y0 + 0.004, y1 - 0.004, r.tankZ0 + 0.004, r.tankZ1 - 0.004)
  const water = bx(-r.x - 0.0077, r.x + 0.0077, y0 + 0.0043, y1 - 0.0043 - (y1 > r.y1 ? 0.012 : 0), r.tankZ0 + 0.0043, r.tankZ1 - 0.0043)
  return { shell: csg(o, [{ op: 'sub', geometry: i }]), water }
}

export function radiatorFrame(r: RadiatorSpec) {
  const sides = [-1, 1].map((s) => bx(s * (r.x + 0.012) - 0.006, s * (r.x + 0.012) + 0.006, r.botY0, r.topY1, r.z0 - 0.004, r.z1 + 0.004))
  return merge(...sides)
}

/** Pressure cap on its filler neck, with the overflow pipe (local: neck base at the origin). */
export function radiatorCap() {
  const curve = (pts: THREE.Vector3[]) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.3)
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const neck = tube(0.02, 0.016, 0.03, 32)
  const cap = lathe([[0, 0.03], [0.026, 0.03], [0.028, 0.034], [0.028, 0.046], [0, 0.046]], 40)
  const valve = lathe([[0, 0], [0.015, 0], [0.015, 0.003], [0, 0.003]], 32)
  const spring = helixSpring(0.009, 0.0009, 1, 4)
  const overflow = pipe(curve([V(0.02, 0.015, 0), V(0.035, 0.012, 0), V(0.05, -0.02, 0), V(0.05, -0.1, 0)]), 0.004, 0.0025, 24, 10)
  return { neck, cap, valve, spring, overflow }
}

/** Thermostat housing (outlet towards +Z) and its wax-element valve. Local: axis Y, base at the origin. */
export function thermostatHousing() {
  const prof: V2[] = [
    [0.022, 0],
    [0.028, 0],
    [0.028, 0.062],
    [0, 0.062],
    [0, 0.056],
    [0.022, 0.056],
  ]
  return csg(lathe(prof, 40), [
    { op: 'sub', geometry: xform(cylinder(0.012, 0.04, 20), mat4.c(at(0, 0.038, 0.025), alongZ)) },
    { op: 'sub', geometry: xform(cylinder(0.008, 0.04, 16), mat4.c(at(-0.025, 0.012, 0), alongX)) },
  ])
}

export function thermostatParts() {
  const seat = tube(0.0218, 0.012, 0.003, 40)
  const valve = lathe([[0, 0], [0.0135, 0], [0.0135, 0.002], [0, 0.003]], 32)
  const pellet = xform(cylinder(0.0065, 0.016, 24), at(0, -0.009, 0))
  const spring = helixSpring(0.011, 0.0011, 1, 4)
  const bridge = xform(box(0.044, 0.002, 0.006), at(0, 0, 0))
  return { seat, valve, pellet, spring, bridge }
}

/** Water-pump volute (inlet on −X, outlet on +X), spanning local z = 0 … 0.045. */
export function pumpVolute() {
  const prof: V2[] = [
    [0.012, 0],
    [0.055, 0],
    [0.055, 0.045],
    [0.012, 0.045],
    [0.012, 0.04],
    [0.048, 0.04],
    [0.048, 0.005],
    [0.012, 0.005],
  ]
  const v = xform(lathe(prof, 48), alongZ)
  return csg(v, [
    { op: 'sub', geometry: xform(cylinder(0.01, 0.04, 16), mat4.c(at(0.05, 0, 0.0225), alongX)) },
    { op: 'sub', geometry: xform(cylinder(0.0075, 0.04, 16), mat4.c(at(-0.05, 0, 0.0225), alongX)) },
  ])
}

export function impeller() {
  const blades: THREE.BufferGeometry[] = [xform(cylinder(0.014, 0.03, 24), alongZ)]
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2
    blades.push(xform(box(0.03, 0.004, 0.026), mat4.c(mat4.rz(a + 0.35), at(0.027, 0, 0))))
  }
  return merge(...blades)
}

/** Six-blade fan of radius r, blades pitched to push air along +Z. */
export function fan(r: number) {
  const parts: THREE.BufferGeometry[] = [xform(cylinder(0.035, 0.03, 32), alongZ)]
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * PI * 2
    const s = new THREE.Shape()
    s.moveTo(0.03, -0.022)
    s.quadraticCurveTo(r * 0.75, -0.04, r, -0.03)
    s.lineTo(r, 0.03)
    s.quadraticCurveTo(r * 0.6, 0.042, 0.03, 0.022)
    s.lineTo(0.03, -0.022)
    parts.push(xform(extrude(s, 0.004, { curveSegments: 8 }), mat4.c(mat4.rz(a), mat4.rx(0.45))))
  }
  return merge(...parts)
}

/** Single-groove fan / water-pump V-pulley of radius r, centred on z = 0 (the engine library pulley in this size). */
export function vPulley(r: number) {
  return enginePulley({ r, bore: 0.012, grooveW: 0.014, grooveDepth: 0.012, centred: true, segments: 48 })
}
