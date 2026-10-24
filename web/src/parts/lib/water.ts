import * as THREE from 'three'
import { box, cylinder, lathe, mat4, merge, pipe, tube, xform } from '@/geometry'
import { centrifugalFan, electricMotor, handwheel, legStand } from './processing'

/**
 * Shared parts library — water supply and irrigation: pipes, pump sets, the vertical well-pump
 * head, well casing and screen, sprinkler heads, drip emitters, screen filters, gate valves and
 * storage tanks (ground and elevated). Moved from the irrigation, wells-and-ponds, farmstead,
 * plant-layout and palm-oil scenes, which now call these. Worker-safe, no CSG; closed solids.
 */

const { PI } = Math
const at = (x: number, y: number, z: number) => mat4.t(x, y, z)
const V = (p: [number, number, number]) => new THREE.Vector3(...p)

/* ============================== pipes and fittings ============================== */

/** Straight pipe from a to b (world points), outer and inner radius. Hollow, closed annular ends. */
export function pipeRun({ a, b, outer, inner, radial = 20 }: { a: [number, number, number]; b: [number, number, number]; outer: number; inner: number; radial?: number }) {
  return pipe(new THREE.LineCurve3(V(a), V(b)), outer, inner, 8, radial)
}

/**
 * Gate valve: body of side `size`, bonnet, stem and handwheel on top. Centred on the bore, which
 * runs along X; stem up +Y.
 */
export function gateValve({ size = 0.18 }: { size?: number } = {}) {
  const s = size
  const body = box(s, s, s)
  const flanges = [-1, 1].map((k) => xform(cylinder(s * 0.42, s * 0.12, 20), mat4.c(at((k * s) / 2, 0, 0), mat4.rz(PI / 2))))
  const bonnet = xform(cylinder(s * 0.25, s * 0.35, 16), at(0, s / 2 + s * 0.17, 0))
  const stem = xform(cylinder(s * 0.08, s * 0.6, 8), at(0, s / 2 + s * 0.45, 0))
  const wheel = xform(handwheel({ r: s * 0.45 }), mat4.c(at(0, s / 2 + s * 0.75, 0), mat4.rx(PI / 2), mat4.ry(PI / 2)))
  return merge(body, ...flanges, bonnet, stem, wheel)
}

/** Screen (disc) filter of the drip control head: canister and lid. Axis Y, base at y = 0. */
export function screenFilter({ r = 0.18, h = 0.8 }: { r?: number; h?: number } = {}) {
  return merge(xform(cylinder(r, h, 20), at(0, h / 2, 0)), xform(cylinder(r * 1.1, h * 0.075, 20), at(0, h + h * 0.0375, 0)))
}

/* ============================== pumps ============================== */

/**
 * Horizontal end-suction pump set on a skid: the pump volute (axis X, outlet up) at +X, coupled
 * to an electric motor at −X. Skid base at y = 0, centred on x = 0; shafts on y = shaftY.
 */
export function pumpSet({ motorR = 0.22, motorL = 0.7, pumpR = 0.2 }: { motorR?: number; motorL?: number; pumpR?: number } = {}) {
  const y = Math.max(motorR, pumpR * 1.3) + 0.08
  const pw = pumpR * 0.9
  const len = motorL + pw + 0.25
  const skid = xform(box(len, 0.08, motorR * 2.4), at(0, 0.04, 0))
  const motor = xform(electricMotor({ r: motorR, length: motorL, feet: true }), mat4.c(at(-len / 2 + motorL / 2 + 0.05, y, 0), mat4.ry(PI / 2)))
  const volute = centrifugalFan({ r: pumpR, width: pw, blades: 6 })
  const pump = xform(merge(volute.housing, volute.impeller), mat4.c(at(len / 2 - pw / 2 - 0.05, y, 0), mat4.ry(PI / 2)))
  const pedestal = xform(box(pw * 0.8, y - 0.08 - pumpR * 0.6, pumpR), at(len / 2 - pw / 2 - 0.05, 0.08 + (y - 0.08 - pumpR * 0.6) / 2, 0))
  return { geometry: merge(skid, motor, pump, pedestal), shaftY: y, length: len }
}

/**
 * Vertical turbine (borehole) pump head: discharge head of side w and height h on y = 0…h, with
 * the vertical motor standing on it (shaft down into the head).
 */
export function wellPumpHead({ w = 1, h = 0.7, motorR = 0.3, motorL = 0.8 }: { w?: number; h?: number; motorR?: number; motorL?: number } = {}) {
  const head = xform(box(w, h, w), at(0, h / 2, 0))
  const motor = xform(electricMotor({ r: motorR, length: motorL }), mat4.c(at(0, h + motorL / 2 + motorL * 0.15, 0), mat4.rx(PI / 2)))
  return merge(head, motor)
}

/* ============================== wells ============================== */

/** Well casing tube of radius r, wall t, from y = 0 up to y = length. */
export function wellCasing({ r, t = 0.07, length }: { r: number; t?: number; length: number }) {
  return xform(tube(r, r - t, length, 24), at(0, length / 2, 0))
}

/** Slotted well screen (shown as a slightly fatter tube) centred on y = 0, length along Y. */
export function wellScreen({ r, length }: { r: number; length: number }) {
  return tube(r + 0.02, r - 0.08, length, 24)
}

/* ============================== irrigation ============================== */

/** Rotating impact sprinkler head (body and nozzle arm). Axis Y, base at y = 0; turns about Y. */
export function sprinklerHead() {
  return merge(xform(cylinder(0.035, 0.08, 12), at(0, 0.04, 0)), xform(box(0.22, 0.03, 0.03), mat4.c(at(0.09, 0.1, 0), mat4.rz(0.45))))
}

/** In-line drip emitter on a lateral running along X: a short barrel centred on the origin. */
export function dripEmitter({ r = 0.022, length = 0.05 }: { r?: number; length?: number } = {}) {
  return xform(cylinder(r, length, 8), mat4.rz(PI / 2))
}

/* ============================== tanks ============================== */

/** Vertical storage tank with a cone roof and a stiffening ring. Axis Y, base at y = 0. */
export function storageTank({ r, h, roofRise = 0.25, ring = true, segments = 36 }: { r: number; h: number; roofRise?: number; ring?: boolean; segments?: number }) {
  const shell = lathe(
    [
      [0, 0],
      [r, 0],
      [r, h],
      [0, h + roofRise],
    ],
    segments,
  )
  return ring ? merge(shell, xform(tube(r + 0.05, r, 0.08, segments), at(0, h * 0.9, 0))) : shell
}

/**
 * Elevated water tank on a four-leg steel stand: tank radius r and height h on top of legs of
 * height standH at (±spread, ±spread). Ground at y = 0. Returns the tank and the stand.
 */
export function elevatedTank({ r, h, standH, spread = r * 0.65, leg = 0.15 }: { r: number; h: number; standH: number; spread?: number; leg?: number }) {
  return {
    tank: xform(storageTank({ r, h, roofRise: r * 0.15, ring: false, segments: 24 }), at(0, standH, 0)),
    stand: legStand({ x: spread, z: spread, h: standH, leg, tieY: standH * 0.5, tie: leg * 0.6 }),
  }
}
